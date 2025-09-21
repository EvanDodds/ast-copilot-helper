/**
 * Unified Memory Manager
 * 
 * This class provides a single interface to manage all memory-related subsystems
 * in a coordinated manner. It orchestrates resource management, GC scheduling,
 * and performance metrics collection.
 */

import { EventEmitter } from 'events';
import { AdvancedResourceManager } from './resource-manager.js';
import { GCScheduler, type GCSchedulerConfig } from './gc-scheduler.js';
import { PerformanceMetricsCollector } from './metrics-collector.js';
import type {
  MetricsConfig,
  PerformanceRecommendation,
  MetricsSnapshot
} from './metrics-collector.js';

/**
 * Configuration for the unified memory manager
 */
export interface MemoryManagerConfig {
  /** GC scheduling configuration */
  gcScheduling?: Partial<GCSchedulerConfig>;
  
  /** Performance metrics configuration */
  metricsCollection?: Partial<MetricsConfig>;
  
  /** Global settings */
  global?: {
        enabled: boolean;
        targetMemoryLimitGB: number;
        emergencyShutdownGB: number;
        autoOptimization: boolean;
      };
}

/**
 * System-wide memory status
 */
export interface MemorySystemStatus {
  timestamp: number;
  overall: {
    status: 'healthy' | 'warning' | 'critical' | 'emergency';
    memoryUsageGB: number;
    targetMemoryGB: number;
    utilizationPercent: number;
  };
  subsystems: {
    resources: { status: string; activeResources: number };
    gcScheduling: { status: string; totalCollections: number };
    metricsCollection: { status: string; collectionRate: number };
  };
  recommendations: PerformanceRecommendation[];
}

/**
 * Unified Memory Manager
 * 
 * Coordinates memory management subsystems to provide comprehensive
 * memory optimization and monitoring capabilities.
 */
export class UnifiedMemoryManager extends EventEmitter {
  private readonly config: Required<MemoryManagerConfig>;
  private readonly resourceManager: AdvancedResourceManager;
  private readonly gcScheduler: GCScheduler;
  private readonly metricsCollector: PerformanceMetricsCollector;
  
  private isStarted = false;
  private statusCheckInterval?: NodeJS.Timeout;

  constructor(config: MemoryManagerConfig = {}) {
    super();
    
    this.config = this.mergeConfig(config);
    
    // Initialize subsystems with default configurations
    this.resourceManager = new AdvancedResourceManager();
    this.gcScheduler = new GCScheduler(this.config.gcScheduling);
    this.metricsCollector = new PerformanceMetricsCollector(this.config.metricsCollection);
    
    this.setupEventHandlers();
  }

  /**
   * Start all memory management subsystems
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.emit('starting');

    try {
      // Start subsystems in order
      await this.gcScheduler.start();
      await this.metricsCollector.start();

      // Start periodic status checks
      this.startStatusMonitoring();

      this.isStarted = true;
      this.emit('started');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop all memory management subsystems
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.emit('stopping');

    try {
      // Stop status monitoring
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = undefined;
      }

      // Stop subsystems
      await this.metricsCollector.stop();
      await this.gcScheduler.stop();
      await this.resourceManager.cleanup();

      this.isStarted = false;
      this.emit('stopped');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<MemorySystemStatus> {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    const memoryUsageGB = memoryUsage.rss / (1024 * 1024 * 1024);
    const targetMemoryGB = this.config.global.targetMemoryLimitGB;
    const emergencyShutdownGB = this.config.global.emergencyShutdownGB;
    const utilizationPercent = (memoryUsageGB / targetMemoryGB) * 100;

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' | 'emergency' = 'healthy';
    if (memoryUsageGB >= emergencyShutdownGB) {
      overallStatus = 'emergency';
    } else if (utilizationPercent >= 90) {
      overallStatus = 'critical';
    } else if (utilizationPercent >= 75) {
      overallStatus = 'warning';
    }

    // Get performance metrics
    const recommendations = await this.metricsCollector.getPerformanceRecommendations();

    return {
      timestamp: now,
      overall: {
        status: overallStatus,
        memoryUsageGB,
        targetMemoryGB,
        utilizationPercent
      },
      subsystems: {
        resources: {
          status: 'active',
          activeResources: 0 // Simplified for now
        },
        gcScheduling: {
          status: 'running',
          totalCollections: 0 // Simplified for now
        },
        metricsCollection: {
          status: 'collecting',
          collectionRate: this.metricsCollector.getMetricsHistory().length
        }
      },
      recommendations
    };
  }

  /**
   * Trigger emergency memory cleanup
   */
  async emergencyCleanup(): Promise<void> {
    this.emit('emergency-cleanup-started');

    try {
      // Force immediate cleanup of all subsystems
      await this.resourceManager.cleanup();
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      // Force metrics collection to see immediate results
      await this.metricsCollector.forceCollection();

      this.emit('emergency-cleanup-completed');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Apply performance optimizations based on current system state
   */
  async optimize(): Promise<void> {
    if (!this.config.global.autoOptimization) {
      return;
    }

    this.emit('optimization-started');

    try {
      const recommendations = await this.metricsCollector.getPerformanceRecommendations();

      // Apply high and critical priority recommendations automatically
      for (const rec of recommendations) {
        if (rec.priority === 'high' || rec.priority === 'critical') {
          await this.applyRecommendation(rec);
        }
      }

      this.emit('optimization-completed', { appliedRecommendations: recommendations.length });

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get access to individual subsystems (for advanced usage)
   */
  getSubsystems() {
    return {
      resourceManager: this.resourceManager,
      gcScheduler: this.gcScheduler,
      metricsCollector: this.metricsCollector
    };
  }

  /**
   * Get performance metrics snapshot
   */
  async getPerformanceSnapshot(): Promise<MetricsSnapshot> {
    return await this.metricsCollector.getMetricsSnapshot();
  }

  private setupEventHandlers(): void {
    // GC Scheduler events
    this.gcScheduler.on('gc-completed', (stats) => {
      this.emit('gc-completed', stats);
    });

    // Metrics Collector events
    this.metricsCollector.on('metrics-collected', (metrics) => {
      this.emit('metrics-collected', metrics);
    });
  }

  private startStatusMonitoring(): void {
    this.statusCheckInterval = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        this.emit('status-update', status);

        // Check for emergency conditions
        if (status.overall.status === 'emergency') {
          await this.emergencyCleanup();
        } else if (status.overall.status === 'critical' && this.config.global.autoOptimization) {
          await this.optimize();
        }

      } catch (error) {
        this.emit('error', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async applyRecommendation(recommendation: PerformanceRecommendation): Promise<void> {
    try {
      switch (recommendation.category) {
        case 'memory':
          if (recommendation.id.includes('cleanup')) {
            if (global.gc) {
              global.gc();
            }
          }
          break;
          
        case 'pools':
          if (recommendation.id.includes('cleanup')) {
            await this.resourceManager.cleanup();
          }
          break;
          
        case 'system':
          if (recommendation.id.includes('emergency')) {
            await this.emergencyCleanup();
          }
          break;
      }

      this.emit('recommendation-applied', recommendation);

    } catch (error) {
      this.emit('recommendation-failed', { recommendation, error });
    }
  }

  private mergeConfig(config: MemoryManagerConfig): Required<MemoryManagerConfig> {
    return {
      gcScheduling: {
        enabled: true,
        minInterval: 30000,
        maxInterval: 300000,
        pressureThreshold: 0.8,
        adaptiveScheduling: true,
        growthRateThreshold: 50,
        aggressiveMode: false,
        ...config.gcScheduling
      },
      metricsCollection: {
        enabled: true,
        collectionInterval: 30000,
        maxRetentionSize: 1000,
        detailedProfiling: true,
        statisticalAnalysis: true,
        aggregationWindow: 300000,
        leakCorrelation: true,
        ...config.metricsCollection
      },
      global: {
        enabled: config.global?.enabled ?? true,
        targetMemoryLimitGB: config.global?.targetMemoryLimitGB ?? 4,
        emergencyShutdownGB: config.global?.emergencyShutdownGB ?? 6,
        autoOptimization: config.global?.autoOptimization ?? true
      }
    };
  }
}