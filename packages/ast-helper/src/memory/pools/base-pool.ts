/**
 * Base Resource Pool Implementation
 * Provides generic pooling functionality with lifecycle management, metrics, and health monitoring
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  ResourcePool as IResourcePool,
  PoolConfig,
  PoolStats,
  ResourceFactory,
  PoolHealthCheck,
  PoolError,
  ResourceLease,
  PoolPerformanceMetrics,
  PoolErrorType,
  ErrorSeverity,
  PoolState,
  PooledResource,
} from '../types.js';

export interface BasePoolConfig extends PoolConfig {
  enableAutoScaling?: boolean;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleCheckInterval?: number;
}

// Internal lease tracking
interface InternalLease<T> {
  lease: ResourceLease<T>;
  resourceId: string;
}

export class BaseResourcePool<T> extends EventEmitter implements IResourcePool<T> {
  private resources: Map<string, PooledResource> = new Map();
  private availableResources: Set<string> = new Set();
  private inUseResources: Map<string, InternalLease<T>> = new Map();
  private waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  private metrics: {
    acquisitionTimes: number[];
    creationTimes: number[];
    totalAcquisitions: number;
    totalCreations: number;
    totalDestroyed: number;
    totalErrors: number;
    lastActivity: number;
  } = {
    acquisitionTimes: [],
    creationTimes: [],
    totalAcquisitions: 0,
    totalCreations: 0,
    totalDestroyed: 0,
    totalErrors: 0,
    lastActivity: Date.now(),
  };

  private state: PoolState = 'initializing';
  private healthCheckTimer?: NodeJS.Timeout;
  private idleCheckTimer?: NodeJS.Timeout;
  private autoScaleTimer?: NodeJS.Timeout;
  private isDraining = false;

  constructor(
    private config: BasePoolConfig,
    private factory: ResourceFactory<T>
  ) {
    super();
    this.validateConfig();
    this.initialize();
  }

  async acquire(): Promise<T> {
    if (this.isDraining || this.state === 'stopped') {
      throw new Error(`Pool "${this.config.name}" is not available (state: ${this.state})`);
    }

    const startTime = performance.now();
    
    try {
      // Check if there's an available resource
      const availableId = Array.from(this.availableResources)[0];
      if (availableId) {
        const resource = await this.acquireExistingResource(availableId);
        this.recordAcquisitionTime(performance.now() - startTime);
        return resource;
      }

      // Try to create a new resource if under max size
      if (this.resources.size < this.config.maxSize) {
        const resource = await this.createNewResource();
        this.recordAcquisitionTime(performance.now() - startTime);
        return resource;
      }

      // Wait for an available resource
      return await this.waitForResource(startTime);
    } catch (error) {
      this.recordError('resource_exhausted', error as Error);
      throw error;
    }
  }

  async release(resource: T): Promise<void> {
    const internalLease = this.findLeaseByResource(resource);
    if (!internalLease) {
      throw new Error('Resource not found in pool or already released');
    }

    const pooledResource = this.resources.get(internalLease.resourceId);
    if (!pooledResource) {
      throw new Error('Pooled resource not found');
    }

    try {
      // Validate resource if configured
      if (this.config.validateOnRelease) {
        const isValid = await this.factory.validate(resource);
        if (!isValid) {
          await this.destroyResource(internalLease.resourceId, 'validation_failed');
          this.processWaitingQueue();
          throw new Error('Resource validation failed during release');
        }
      }

      // Reset resource state
      await this.factory.reset(resource);

      // Return to available pool
      this.inUseResources.delete(internalLease.lease.leaseId);
      this.availableResources.add(internalLease.resourceId);
      
      pooledResource.lastUsedAt = Date.now();
      pooledResource.useCount++;
      this.metrics.lastActivity = Date.now();

      this.emit('resource.released', {
        poolName: this.config.name,
        resourceId: internalLease.resourceId,
        leaseId: internalLease.lease.leaseId,
      });

      // Process waiting queue
      this.processWaitingQueue();
    } catch (error) {
      // If reset fails, destroy the resource
      await this.destroyResource(internalLease.resourceId, 'reset_failed');
      this.recordError('validation_failed', error as Error, internalLease.resourceId);
      this.processWaitingQueue();
    }
  }

  async destroy(resource: T): Promise<void> {
    const internalLease = this.findLeaseByResource(resource);
    if (!internalLease) {
      throw new Error('Resource not found in pool');
    }

    await this.destroyResource(internalLease.resourceId, 'manual_destroy');
    this.processWaitingQueue();
  }

  getStats(): PoolStats {
    return {
      totalResources: this.resources.size,
      availableResources: this.availableResources.size,
      inUseResources: this.inUseResources.size,
      createdResources: this.metrics.totalCreations,
      destroyedResources: this.metrics.totalDestroyed,
      acquisitionWaiting: this.waitingQueue.length,
      acquisitionTime: this.calculatePerformanceMetrics(this.metrics.acquisitionTimes),
      creationTime: this.calculatePerformanceMetrics(this.metrics.creationTimes),
      utilizationRate: this.resources.size > 0 ? this.inUseResources.size / this.resources.size : 0,
      errorRate: this.metrics.totalAcquisitions > 0 ? this.metrics.totalErrors / this.metrics.totalAcquisitions : 0,
      lastActivity: this.metrics.lastActivity,
    };
  }

  async resize(newSize: number): Promise<void> {
    if (newSize < this.config.minSize) {
      throw new Error(`New size ${newSize} is below minimum size ${this.config.minSize}`);
    }

    const currentSize = this.resources.size;
    const oldMaxSize = this.config.maxSize;
    this.config.maxSize = newSize;

    if (newSize > currentSize) {
      // Scale up - create new resources up to min size if needed
      const targetMinSize = Math.min(newSize, this.config.minSize);
      while (this.resources.size < targetMinSize) {
        await this.createResource();
      }
    } else if (newSize < currentSize) {
      // Scale down - destroy excess available resources
      const excessCount = currentSize - newSize;
      const availableIds = Array.from(this.availableResources);
      
      for (let i = 0; i < Math.min(excessCount, availableIds.length); i++) {
        const resourceId = availableIds[i];
        if (resourceId) {
          await this.destroyResource(resourceId, 'pool_resize');
        }
      }
    }

    this.emit('pool.resized', {
      poolName: this.config.name,
      oldSize: oldMaxSize,
      newSize: newSize,
    });
  }

  async drain(): Promise<void> {
    this.isDraining = true;
    this.state = 'draining';

    // Reject all waiting requests
    const waitingRequests = [...this.waitingQueue];
    this.waitingQueue = [];
    
    for (const request of waitingRequests) {
      request.reject(new Error('Pool is being drained'));
    }

    // Wait for in-use resources to be released or force cleanup after timeout
    const drainTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.inUseResources.size > 0 && (Date.now() - startTime) < drainTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force destroy any remaining in-use resources
    const inUseIds = Array.from(this.inUseResources.values()).map(item => item.resourceId);
    for (const resourceId of inUseIds) {
      await this.destroyResource(resourceId, 'forced_drain');
    }

    // Destroy all available resources
    const availableIds = Array.from(this.availableResources);
    for (const resourceId of availableIds) {
      await this.destroyResource(resourceId, 'pool_drain');
    }

    this.emit('pool.drained', {
      poolName: this.config.name,
      resourcesDestroyed: availableIds.length + inUseIds.length,
    });
  }

  async cleanup(): Promise<void> {
    // Stop all timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = undefined;
    }
    if (this.autoScaleTimer) {
      clearInterval(this.autoScaleTimer);
      this.autoScaleTimer = undefined;
    }

    // Drain the pool
    if (!this.isDraining) {
      await this.drain();
    }

    this.state = 'stopped';
    this.removeAllListeners();
  }

  // Private methods
  private validateConfig(): void {
    if (this.config.minSize < 0) {
      throw new Error('minSize must be non-negative');
    }
    if (this.config.maxSize < this.config.minSize) {
      throw new Error('maxSize must be >= minSize');
    }
    if (this.config.acquireTimeoutMs <= 0) {
      throw new Error('acquireTimeoutMs must be positive');
    }
    if (this.config.maxQueueSize < 0) {
      throw new Error('maxQueueSize must be non-negative');
    }
  }

  private async initialize(): Promise<void> {
    try {
      this.state = 'initializing';

      // Create minimum number of resources
      for (let i = 0; i < this.config.minSize; i++) {
        await this.createResource();
      }

      // Start background processes
      this.startHealthCheck();
      this.startIdleCheck();
      
      if (this.config.autoResize) {
        this.startAutoScaling();
      }

      this.state = 'active';
      this.metrics.lastActivity = Date.now();
    } catch (error) {
      this.state = 'error';
      this.recordError('creation_failed', error as Error);
      throw error;
    }
  }

  private async createNewResource(): Promise<T> {
    const startTime = performance.now();
    
    try {
      const resourceData = await this.factory.create();
      const resourceId = this.generateResourceId();
      
      const pooledResource: PooledResource = {
        id: resourceId,
        resource: resourceData,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        useCount: 0,
        isHealthy: true,
        metadata: {},
      };

      this.resources.set(resourceId, pooledResource);
      
      const lease = this.createLease(pooledResource);
      const internalLease: InternalLease<T> = { lease, resourceId };
      this.inUseResources.set(lease.leaseId, internalLease);
      
      this.metrics.totalCreations++;
      this.recordCreationTime(performance.now() - startTime);
      
      this.emit('resource.created', {
        poolName: this.config.name,
        resourceId,
        resource: resourceData,
      });

      this.emit('resource.acquired', {
        poolName: this.config.name,
        resourceId,
        leaseId: lease.leaseId,
      });

      return resourceData;
    } catch (error) {
      this.recordError('creation_failed', error as Error);
      throw error;
    }
  }

  private async acquireExistingResource(resourceId: string): Promise<T> {
    const pooledResource = this.resources.get(resourceId);
    if (!pooledResource) {
      throw new Error('Resource not found');
    }

    // Validate resource if configured
    if (this.config.validateOnAcquire) {
      const isValid = await this.factory.validate(pooledResource.resource);
      if (!isValid) {
        await this.destroyResource(resourceId, 'validation_failed');
        throw new Error('Resource validation failed');
      }
    }

    this.availableResources.delete(resourceId);
    const lease = this.createLease(pooledResource);
    const internalLease: InternalLease<T> = { lease, resourceId };
    this.inUseResources.set(lease.leaseId, internalLease);

    pooledResource.lastUsedAt = Date.now();
    this.metrics.lastActivity = Date.now();
    this.metrics.totalAcquisitions++;

    this.emit('resource.acquired', {
      poolName: this.config.name,
      resourceId,
      leaseId: lease.leaseId,
    });

    return pooledResource.resource;
  }

  private async waitForResource(startTime: number): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.waitingQueue.length >= this.config.maxQueueSize) {
        reject(new Error('Pool queue is full'));
        return;
      }

      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Resource acquisition timeout'));
      }, this.config.acquireTimeoutMs);

      const wrappedResolve = (resource: T) => {
        clearTimeout(timeout);
        this.recordAcquisitionTime(performance.now() - startTime);
        resolve(resource);
      };

      const wrappedReject = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.waitingQueue.push({
        resolve: wrappedResolve,
        reject: wrappedReject,
        timestamp: Date.now(),
      });
    });
  }

  private async processWaitingQueue(): Promise<void> {
    while (this.waitingQueue.length > 0 && this.availableResources.size > 0) {
      const request = this.waitingQueue.shift();
      if (!request) break;

      try {
        const availableId = Array.from(this.availableResources)[0];
        if (availableId) {
          const resource = await this.acquireExistingResource(availableId);
          request.resolve(resource);
        }
      } catch (error) {
        request.reject(error as Error);
      }
    }

    // Try to create new resources if queue is not empty and under max size
    while (this.waitingQueue.length > 0 && this.resources.size < this.config.maxSize) {
      const request = this.waitingQueue.shift();
      if (!request) break;

      try {
        const resource = await this.createNewResource();
        request.resolve(resource);
      } catch (error) {
        request.reject(error as Error);
      }
    }
  }

  private async createResource(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const resourceData = await this.factory.create();
      const resourceId = this.generateResourceId();
      
      const pooledResource: PooledResource = {
        id: resourceId,
        resource: resourceData,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        useCount: 0,
        isHealthy: true,
        metadata: {},
      };

      this.resources.set(resourceId, pooledResource);
      this.availableResources.add(resourceId);
      
      this.metrics.totalCreations++;
      this.recordCreationTime(performance.now() - startTime);
      
      this.emit('resource.created', {
        poolName: this.config.name,
        resourceId,
        resource: resourceData,
      });
    } catch (error) {
      this.recordError('creation_failed', error as Error);
      throw error;
    }
  }

  private async destroyResource(resourceId: string, reason: string): Promise<void> {
    const pooledResource = this.resources.get(resourceId);
    if (!pooledResource) {
      return;
    }

    try {
      await this.factory.destroy(pooledResource.resource);
    } catch (error) {
      this.recordError('unknown', error as Error, resourceId);
    }

    // Clean up references
    this.resources.delete(resourceId);
    this.availableResources.delete(resourceId);
    
    // Find and remove any lease
    for (const [leaseId, internalLease] of this.inUseResources) {
      if (internalLease.resourceId === resourceId) {
        this.inUseResources.delete(leaseId);
        break;
      }
    }

    this.metrics.totalDestroyed++;

    this.emit('resource.destroyed', {
      poolName: this.config.name,
      resourceId,
      reason,
    });
  }

  private createLease(pooledResource: PooledResource): ResourceLease<T> {
    const leaseId = this.generateLeaseId();
    const now = Date.now();
    
    return {
      resource: pooledResource.resource,
      leaseId,
      acquiredAt: now,
      expiresAt: this.config.idleTimeoutMs > 0 ? now + this.config.idleTimeoutMs : undefined,
      autoRelease: false,
    };
  }

  private findLeaseByResource(resource: T): InternalLease<T> | undefined {
    for (const internalLease of this.inUseResources.values()) {
      if (internalLease.lease.resource === resource) {
        return internalLease;
      }
    }
    return undefined;
  }

  private generateResourceId(): string {
    return `${this.config.name}_resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLeaseId(): string {
    return `${this.config.name}_lease_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordAcquisitionTime(time: number): void {
    this.metrics.acquisitionTimes.push(time);
    if (this.metrics.acquisitionTimes.length > 1000) {
      this.metrics.acquisitionTimes = this.metrics.acquisitionTimes.slice(-500);
    }
    this.metrics.totalAcquisitions++;
  }

  private recordCreationTime(time: number): void {
    this.metrics.creationTimes.push(time);
    if (this.metrics.creationTimes.length > 1000) {
      this.metrics.creationTimes = this.metrics.creationTimes.slice(-500);
    }
  }

  private recordError(type: PoolErrorType, error: Error, resourceId?: string): void {
    this.metrics.totalErrors++;
    
    const poolError: PoolError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      poolName: this.config.name,
      resourceId,
      errorType: type,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      severity: this.determineSeverity(type),
      context: { state: this.state },
    };

    this.emit('resource.error', {
      poolName: this.config.name,
      resourceId,
      error: poolError,
    });
  }

  private determineSeverity(errorType: PoolErrorType): ErrorSeverity {
    switch (errorType) {
      case 'resource_exhausted':
      case 'health_check_failed':
        return 'critical';
      case 'creation_failed':
      case 'timeout':
        return 'high';
      case 'validation_failed':
        return 'medium';
      default:
        return 'low';
    }
  }

  private calculatePerformanceMetrics(times: number[]): PoolPerformanceMetrics {
    if (times.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        total: 0,
        count: 0,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      average: sum / times.length,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      total: sum,
      count: times.length,
    };
  }

  private startHealthCheck(): void {
    if (this.config.healthCheckInterval <= 0) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.emit('pool.warning', {
          poolName: this.config.name,
          message: 'Health check failed',
          context: { error: (error as Error).message },
        });
      }
    }, this.config.healthCheckInterval);
  }

  private startIdleCheck(): void {
    if (this.config.idleTimeoutMs <= 0) {
      return;
    }

    this.idleCheckTimer = setInterval(async () => {
      const now = Date.now();
      const idleResourceIds = [];

      for (const [resourceId, resource] of this.resources) {
        if (this.availableResources.has(resourceId) && 
            (now - resource.lastUsedAt) > this.config.idleTimeoutMs) {
          idleResourceIds.push(resourceId);
        }
      }

      // Keep minimum resources but destroy excess idle ones
      const minToKeep = this.config.minSize;
      const currentAvailable = this.availableResources.size;
      const canDestroy = Math.max(0, currentAvailable - minToKeep);
      const toDestroy = Math.min(idleResourceIds.length, canDestroy);

      for (let i = 0; i < toDestroy; i++) {
        const resourceId = idleResourceIds[i];
        if (resourceId) {
          await this.destroyResource(resourceId, 'idle_timeout');
        }
      }
    }, Math.min(this.config.idleTimeoutMs / 2, 60000)); // Check every half timeout or max 1 minute
  }

  private startAutoScaling(): void {
    if (!this.config.autoResize || !this.config.scaleCheckInterval) {
      return;
    }

    this.autoScaleTimer = setInterval(async () => {
      try {
        await this.checkAutoScaling();
      } catch (error) {
        this.emit('pool.warning', {
          poolName: this.config.name,
          message: 'Auto-scaling check failed',
          context: { error: (error as Error).message },
        });
      }
    }, this.config.scaleCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = performance.now();
    const errors: PoolError[] = [];
    let healthyResources = 0;
    let unhealthyResources = 0;

    for (const [resourceId, pooledResource] of this.resources) {
      try {
        const isHealthy = await this.factory.validate(pooledResource.resource);
        if (isHealthy) {
          healthyResources++;
          pooledResource.isHealthy = true;
        } else {
          unhealthyResources++;
          pooledResource.isHealthy = false;
          
          // Destroy unhealthy resources if they're available
          if (this.availableResources.has(resourceId)) {
            await this.destroyResource(resourceId, 'health_check_failed');
          }
        }
      } catch (error) {
        unhealthyResources++;
        pooledResource.isHealthy = false;
        
        const poolError: PoolError = {
          id: `healthcheck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          poolName: this.config.name,
          resourceId,
          errorType: 'health_check_failed',
          message: (error as Error).message,
          timestamp: Date.now(),
          severity: 'medium',
          context: {},
        };
        errors.push(poolError);
      }
    }

    const healthCheck: PoolHealthCheck = {
      poolName: this.config.name,
      isHealthy: unhealthyResources === 0,
      totalResources: this.resources.size,
      healthyResources,
      unhealthyResources,
      errors,
      lastCheckTime: Date.now(),
      checkDuration: performance.now() - startTime,
    };

    this.emit('pool.healthCheck', {
      poolName: this.config.name,
      healthCheck,
    });
  }

  private async checkAutoScaling(): Promise<void> {
    const stats = this.getStats();
    const utilizationRate = stats.utilizationRate;
    const waitingCount = this.waitingQueue.length;

    // Scale up if utilization is high or there are waiting requests
    if ((utilizationRate > (this.config.scaleUpThreshold || 0.8) || waitingCount > 0) &&
        this.resources.size < this.config.maxSize) {
      
      const scaleUpAmount = Math.min(
        Math.max(1, Math.ceil(waitingCount / 2)),
        this.config.maxSize - this.resources.size
      );

      for (let i = 0; i < scaleUpAmount; i++) {
        try {
          await this.createResource();
        } catch (error) {
          break; // Stop scaling up if creation fails
        }
      }
    }
    
    // Scale down if utilization is low and we have excess resources
    else if (utilizationRate < (this.config.scaleDownThreshold || 0.2) &&
             this.availableResources.size > this.config.minSize &&
             waitingCount === 0) {
      
      const excessResources = this.availableResources.size - this.config.minSize;
      const scaleDownAmount = Math.min(1, excessResources);
      
      const availableIds = Array.from(this.availableResources);
      for (let i = 0; i < scaleDownAmount; i++) {
        const resourceId = availableIds[i];
        if (resourceId) {
          await this.destroyResource(resourceId, 'auto_scale_down');
        }
      }
    }
  }
}