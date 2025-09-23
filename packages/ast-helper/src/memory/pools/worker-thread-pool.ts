/**
 * Worker Thread Pool Implementation
 * Provides pooling for worker threads with task distribution and resource monitoring
 */

import type { BasePoolConfig } from './base-pool.js';
import { BaseResourcePool } from './base-pool.js';
import type { 
  WorkerThread, 
  WorkerThreadFactory,
  WorkerType
} from '../types.js';
import { Worker } from 'worker_threads';
import * as path from 'path';

export interface WorkerThreadPoolConfig extends BasePoolConfig {
  workerScript: string;
  workerType: WorkerType;
  workerOptions?: Record<string, any>;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  maxMemoryPerWorker?: number;
  maxCpuUsagePercent?: number;
}

export class WorkerThreadPool extends BaseResourcePool<WorkerThread> {
  private poolConfig: WorkerThreadPoolConfig;
  
  constructor(config: WorkerThreadPoolConfig) {
    const factory: WorkerThreadFactory = new WorkerThreadFactoryImpl(config);
    super(config, factory);
    this.poolConfig = config;
  }

  async executeTask<T = any>(taskData: any, taskId?: string): Promise<T> {
    const worker = await this.acquire();
    
    try {
      const result = await this.sendTaskToWorker<T>(worker, taskData, taskId);
      await this.release(worker);
      return result;
    } catch (error) {
      // Don't release worker if task failed - it may be in bad state
      await this.destroy(worker);
      throw error;
    }
  }

  private async sendTaskToWorker<T>(worker: WorkerThread, taskData: any, taskId?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker task timeout after ${this.poolConfig.taskTimeout || 30000}ms`));
      }, this.poolConfig.taskTimeout || 30000);

      const messageHandler = (result: any) => {
        clearTimeout(timeout);
        worker.worker.off('message', messageHandler);
        worker.worker.off('error', errorHandler);
        
        worker.lastUsedAt = Date.now();
        worker.taskCount++;
        worker.isProcessing = false;
        worker.currentTask = undefined;
        
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.worker.off('message', messageHandler);
        worker.worker.off('error', errorHandler);
        
        worker.isProcessing = false;
        worker.currentTask = undefined;
        
        reject(error);
      };

      worker.worker.on('message', messageHandler);
      worker.worker.on('error', errorHandler);
      
      worker.isProcessing = true;
      worker.currentTask = taskId || `task_${Date.now()}`;
      
      worker.worker.postMessage({ taskData, taskId });
    });
  }
}

class WorkerThreadFactoryImpl implements WorkerThreadFactory {
  public readonly workerScript: string;
  public readonly workerOptions: Record<string, any>;
  public readonly workerType: WorkerType;

  constructor(private config: WorkerThreadPoolConfig) {
    this.workerScript = config.workerScript;
    this.workerOptions = config.workerOptions || {};
    this.workerType = config.workerType;
  }

  async create(): Promise<WorkerThread> {
    // Resolve worker script path
    const scriptPath = path.resolve(this.workerScript);
    
    // Create worker with options
    const workerOptions = {
      ...this.workerOptions,
      ...(this.config.maxMemoryPerWorker && {
        resourceLimits: {
          maxOldGenerationSizeMb: this.config.maxMemoryPerWorker,
          maxYoungGenerationSizeMb: Math.floor(this.config.maxMemoryPerWorker * 0.2),
        }
      })
    };

    const worker = new Worker(scriptPath, workerOptions);
    
    // Wait for worker to be ready
    await this.waitForWorkerReady(worker);
    
    return {
      id: `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      worker,
      type: this.workerType,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      taskCount: 0,
      isProcessing: false,
      currentTask: undefined,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  async destroy(resource: WorkerThread): Promise<void> {
    try {
      if (resource.worker) {
        // Set longer timeout for clean shutdown
        const terminatePromise = resource.worker.terminate();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Worker termination timeout')), 5000);
        });
        
        // Race between termination and timeout
        await Promise.race([terminatePromise, timeoutPromise]);
      }
    } catch (error) {
      // Force termination if graceful shutdown fails
      try {
        if (resource.worker) {
          // Force terminate without waiting
          resource.worker.terminate().catch(() => {});
        }
      } catch (forceError) {
        // Ignore force termination errors
      }
      console.debug(`Worker thread ${resource.id} cleanup completed with error:`, error);
    }
  }

  async validate(resource: WorkerThread): Promise<boolean> {
    try {
      if (!resource.worker) {
        return false;
      }
      
      // Check if worker is still running and responsive
      const isResponsive = await this.pingWorker(resource.worker);
      const memoryOk = this.config.maxMemoryPerWorker ? 
        resource.memoryUsage <= this.config.maxMemoryPerWorker : true;
      const cpuOk = this.config.maxCpuUsagePercent ? 
        resource.cpuUsage <= this.config.maxCpuUsagePercent : true;
      
      return isResponsive && memoryOk && cpuOk;
    } catch (error) {
      return false;
    }
  }

  async reset(resource: WorkerThread): Promise<void> {
    try {
      // Reset worker state
      resource.isProcessing = false;
      resource.currentTask = undefined;
      
      // Send reset message to worker if it supports it
      if (resource.worker) {
        resource.worker.postMessage({ type: 'reset' });
      }
    } catch (error) {
      console.warn(`Error resetting worker thread ${resource.id}:`, error);
    }
  }

  private async waitForWorkerReady(worker: Worker): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker startup timeout'));
      }, 10000); // 10 second timeout

      const messageHandler = (message: any) => {
        if (message.type === 'ready') {
          clearTimeout(timeout);
          worker.off('message', messageHandler);
          worker.off('error', errorHandler);
          resolve();
        }
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(error);
      };

      worker.on('message', messageHandler);
      worker.on('error', errorHandler);
    });
  }

  private async pingWorker(worker: Worker): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000); // 5 second ping timeout

      const messageHandler = (message: any) => {
        if (message.type === 'pong') {
          clearTimeout(timeout);
          worker.off('message', messageHandler);
          resolve(true);
        }
      };

      worker.on('message', messageHandler);
      worker.postMessage({ type: 'ping' });
    });
  }
}