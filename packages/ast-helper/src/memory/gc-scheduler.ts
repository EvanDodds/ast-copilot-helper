import { EventEmitter } from 'events';
import type {
  GCResult,
  GCStats,
  MemorySnapshot
} from './types.js';

export interface GCSchedulerConfig {
  /** Enable automatic GC scheduling */
  enabled: boolean;
  /** Minimum interval between GC runs in milliseconds */
  minInterval: number;
  /** Maximum interval between GC runs in milliseconds */
  maxInterval: number;
  /** Memory pressure threshold to trigger GC (0-1) */
  pressureThreshold: number;
  /** Enable adaptive scheduling based on memory patterns */
  adaptiveScheduling: boolean;
  /** Memory growth rate threshold to trigger GC (MB/s) */
  growthRateThreshold: number;
  /** Enable aggressive GC under high pressure */
  aggressiveMode: boolean;
}

export interface MemoryPressure {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-1
  factors: {
    heapUtilization: number;
    growthRate: number;
    gcEffectiveness: number;
    availableMemory: number;
  };
  recommendation: 'none' | 'schedule' | 'immediate' | 'aggressive';
}

export interface GCSchedule {
  nextGC: Date;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  mode: 'normal' | 'aggressive';
}

/**
 * Intelligent garbage collection scheduler with memory pressure detection
 * and adaptive optimization strategies
 */
export class GCScheduler extends EventEmitter {
  private config: GCSchedulerConfig;
  private gcStats: GCStats;
  private isRunning = false;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private lastGCTime = 0;
  private memoryHistory: MemorySnapshot[] = [];
  private readonly maxHistorySize = 100;
  private pressureHistory: MemoryPressure[] = [];

  constructor(config: Partial<GCSchedulerConfig> = {}) {
    super();
    this.config = this.mergeConfig(config);
    this.gcStats = this.initializeStats();
  }

  /**
   * Start the GC scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (!this.config.enabled) {
      this.emit('info', 'GC scheduler is disabled');
      return;
    }

    this.isRunning = true;
    this.emit('started');
    
    // Start monitoring and scheduling cycle
    await this.scheduleNext();
  }

  /**
   * Stop the GC scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    this.emit('stopped');
  }

  /**
   * Force immediate garbage collection
   */
  async forceGC(reason = 'manual'): Promise<GCResult> {
    if (!global.gc) {
      throw new Error('Garbage collection is not exposed. Run with --expose-gc flag.');
    }

    const beforeMemory = process.memoryUsage();
    const startTime = Date.now();

    // Perform garbage collection
    global.gc();

    const endTime = Date.now();
    const afterMemory = process.memoryUsage();

    const result: GCResult = {
      duration: endTime - startTime,
      beforeMemory: beforeMemory.heapUsed,
      afterMemory: afterMemory.heapUsed,
      memoryCleaned: beforeMemory.heapUsed - afterMemory.heapUsed,
      timestamp: new Date(startTime)
    };

    // Update statistics
    this.updateGCStats(result);
    this.lastGCTime = startTime;

    this.emit('gc-completed', result, reason);
    return result;
  }

  /**
   * Analyze current memory pressure
   */
  analyzeMemoryPressure(currentMemory: MemorySnapshot): MemoryPressure {
    // Calculate heap utilization
    const heapUtilization = currentMemory.heapUsed / currentMemory.heapTotal;
    
    // Calculate memory growth rate
    const growthRate = this.calculateGrowthRate();
    
    // Calculate GC effectiveness
    const gcEffectiveness = this.calculateGCEffectiveness();
    
    // Calculate available memory ratio
    const availableMemory = 1 - (currentMemory.rss / (4 * 1024 * 1024 * 1024)); // Assume 4GB limit

    const factors = {
      heapUtilization,
      growthRate,
      gcEffectiveness,
      availableMemory
    };

    // Calculate pressure score (weighted average)
    const weights = {
      heapUtilization: 0.3,
      growthRate: 0.25,
      gcEffectiveness: 0.25,
      availableMemory: 0.2
    };

    const score = (
      factors.heapUtilization * weights.heapUtilization +
      (1 - factors.growthRate) * weights.growthRate + // Higher growth = higher pressure
      (1 - factors.gcEffectiveness) * weights.gcEffectiveness + // Lower effectiveness = higher pressure
      (1 - factors.availableMemory) * weights.availableMemory
    );

    // Determine pressure level
    let level: MemoryPressure['level'];
    let recommendation: MemoryPressure['recommendation'];

    if (score < 0.4) {
      level = 'low';
      recommendation = 'none';
    } else if (score < 0.55) {
      level = 'medium';
      recommendation = 'schedule';
    } else if (score < 0.75) {
      level = 'high';
      recommendation = 'immediate';
    } else {
      level = 'critical';
      recommendation = 'aggressive';
    }

    const pressure: MemoryPressure = {
      level,
      score,
      factors,
      recommendation
    };

    // Store in history
    this.pressureHistory.push(pressure);
    if (this.pressureHistory.length > this.maxHistorySize) {
      this.pressureHistory.shift();
    }

    return pressure;
  }

  /**
   * Create optimized GC schedule based on current conditions
   */
  createSchedule(pressure: MemoryPressure): GCSchedule {
    const now = new Date();
    let delay: number;
    let priority: GCSchedule['priority'];
    let mode: GCSchedule['mode'] = 'normal';
    let reason: string;

    switch (pressure.recommendation) {
      case 'none':
        delay = this.config.maxInterval;
        priority = 'low';
        reason = 'Routine maintenance';
        break;
        
      case 'schedule':
        delay = this.calculateAdaptiveDelay(pressure);
        priority = 'medium';
        reason = 'Memory pressure detected';
        break;
        
      case 'immediate':
        delay = Math.max(1000, this.config.minInterval); // At least 1 second
        priority = 'high';
        reason = 'High memory pressure';
        break;
        
      case 'aggressive':
        delay = this.config.minInterval;
        priority = 'critical';
        mode = this.config.aggressiveMode ? 'aggressive' : 'normal';
        reason = 'Critical memory pressure';
        break;
        
      default:
        delay = this.config.maxInterval;
        priority = 'low';
        reason = 'Default schedule';
    }

    // Ensure minimum interval since last GC
    const timeSinceLastGC = now.getTime() - this.lastGCTime;
    if (timeSinceLastGC < this.config.minInterval) {
      delay = Math.max(delay, this.config.minInterval - timeSinceLastGC);
    }

    return {
      nextGC: new Date(now.getTime() + delay),
      reason,
      priority,
      mode
    };
  }

  /**
   * Get current GC statistics
   */
  getStats(): GCStats {
    return { ...this.gcStats };
  }

  /**
   * Get memory pressure history
   */
  getPressureHistory(): MemoryPressure[] {
    return [...this.pressureHistory];
  }

  /**
   * Update memory usage history
   */
  updateMemoryHistory(usage: MemorySnapshot): void {
    this.memoryHistory.push(usage);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
  }

  private mergeConfig(config: Partial<GCSchedulerConfig>): GCSchedulerConfig {
    return {
      enabled: config.enabled ?? true,
      minInterval: config.minInterval ?? 30000, // 30 seconds
      maxInterval: config.maxInterval ?? 300000, // 5 minutes
      pressureThreshold: config.pressureThreshold ?? 0.7,
      adaptiveScheduling: config.adaptiveScheduling ?? true,
      growthRateThreshold: config.growthRateThreshold ?? 10, // 10 MB/s
      aggressiveMode: config.aggressiveMode ?? true
    };
  }

  private initializeStats(): GCStats {
    return {
      totalGCs: 0,
      totalTimeMS: 0,
      totalMemoryCleaned: 0,
      averageGCTime: 0,
      averageMemoryCleaned: 0,
      lastGC: null
    };
  }

  private async scheduleNext(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Get current memory usage
      const memoryUsage = process.memoryUsage();
      const currentMemory: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers,
        heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal
      };

      // Update memory history
      this.updateMemoryHistory(currentMemory);

      // Analyze memory pressure
      const pressure = this.analyzeMemoryPressure(currentMemory);
      
      // Create schedule
      const schedule = this.createSchedule(pressure);

      // Emit pressure analysis
      this.emit('pressure-analysis', pressure, schedule);

      // Handle immediate or critical cases
      if (schedule.priority === 'critical' || schedule.priority === 'high') {
        await this.executeScheduledGC(schedule);
      } else {
        // Schedule for later
        const delay = schedule.nextGC.getTime() - Date.now();
        this.schedulerTimer = setTimeout(async () => {
          await this.executeScheduledGC(schedule);
        }, delay);
      }
    } catch (error) {
      this.emit('error', error);
      // Fallback to maximum interval
      this.schedulerTimer = setTimeout(() => this.scheduleNext(), this.config.maxInterval);
    }
  }

  private async executeScheduledGC(schedule: GCSchedule): Promise<void> {
    try {
      const result = await this.forceGC(schedule.reason);
      this.emit('scheduled-gc', result, schedule);
    } catch (error) {
      this.emit('error', error);
    } finally {
      // Schedule next cycle
      await this.scheduleNext();
    }
  }

  private calculateGrowthRate(): number {
    if (this.memoryHistory.length < 2) {
      return 0;
    }

    const recent = this.memoryHistory.slice(-10); // Last 10 measurements
    if (recent.length < 2) {
      return 0;
    }

    const first = recent[0]!;
    const last = recent[recent.length - 1]!;
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds
    const memoryDiff = (last.heapUsed - first.heapUsed) / (1024 * 1024); // MB

    return timeDiff > 0 ? Math.max(0, memoryDiff / timeDiff) : 0;
  }

  private calculateGCEffectiveness(): number {
    if (this.gcStats.totalGCs < 2) {
      return 1.0; // Assume good effectiveness initially
    }

    // Calculate effectiveness based on average memory cleaned vs time spent
    const avgCleaned = this.gcStats.averageMemoryCleaned / (1024 * 1024); // MB
    const avgTime = this.gcStats.averageGCTime; // ms
    
    if (avgTime === 0) {
return 1.0;
}
    
    // Effectiveness = MB cleaned per ms (normalized)
    const efficiency = avgCleaned / avgTime;
    return Math.min(1.0, efficiency * 1000); // Scale to 0-1 range
  }

  private calculateAdaptiveDelay(pressure: MemoryPressure): number {
    if (!this.config.adaptiveScheduling) {
      return (this.config.minInterval + this.config.maxInterval) / 2;
    }

    // Adaptive delay based on pressure score
    const baseDelay = this.config.maxInterval - this.config.minInterval;
    const adaptiveDelay = baseDelay * (1 - pressure.score);
    
    return Math.max(this.config.minInterval, this.config.minInterval + adaptiveDelay);
  }

  private updateGCStats(result: GCResult): void {
    this.gcStats.totalGCs++;
    this.gcStats.totalTimeMS += result.duration;
    this.gcStats.totalMemoryCleaned += result.memoryCleaned;
    this.gcStats.averageGCTime = this.gcStats.totalTimeMS / this.gcStats.totalGCs;
    this.gcStats.averageMemoryCleaned = this.gcStats.totalMemoryCleaned / this.gcStats.totalGCs;
    this.gcStats.lastGC = result.timestamp;
  }
}