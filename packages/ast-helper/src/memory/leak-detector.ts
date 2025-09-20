/**
 * Advanced Memory Leak Detection System
 * Provides automated leak detection, heap analysis, and actionable recommendations
 */

import { EventEmitter } from 'events';
import * as v8 from 'v8';
import {
  MemoryLeakDetector as IMemoryLeakDetector,
  LeakDetectionResult,
  DetectedLeak,
  LeakAnalysis,
  HeapSnapshotAnalysis,
  AllocationTracker,
  AllocationStats,
  AllocationSite,
  AllocationPoint,
  LeakRecommendation,
  ObjectTypeCount,
  RetainerPath,
  DominatorNode,
  LargeObject,
  LeakType,
  LeakSeverity,
} from './types.js';

export interface LeakDetectorConfig {
  detectionInterval: number; // ms
  heapSnapshotInterval: number; // ms
  allocationTrackingEnabled: boolean;
  minLeakThreshold: number; // bytes
  confidenceThreshold: number; // 0-1
  maxSnapshots: number;
  enableStackTraces: boolean;
}

export class AdvancedMemoryLeakDetector extends EventEmitter implements IMemoryLeakDetector {
  private isRunning = false;
  private detectionTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;
  private heapSnapshots: HeapSnapshotAnalysis[] = [];
  private allocationTracker?: InternalAllocationTracker;
  private lastDetectionResult?: LeakDetectionResult;

  constructor(private config: LeakDetectorConfig) {
    super();
    this.validateConfig();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Initialize allocation tracker if enabled
    if (this.config.allocationTrackingEnabled) {
      this.allocationTracker = new InternalAllocationTracker();
      this.allocationTracker.start();
    }

    // Start periodic leak detection
    this.detectionTimer = setInterval(async () => {
      try {
        const result = await this.detectLeaks();
        this.emit('leakDetection', result);
        
        if (result.severity === 'critical' || result.severity === 'high') {
          this.emit('criticalLeak', result);
        }
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.detectionInterval);

    // Start periodic heap snapshots
    this.snapshotTimer = setInterval(async () => {
      try {
        const snapshot = await this.analyzeHeapSnapshot();
        this.addHeapSnapshot(snapshot);
        this.emit('heapSnapshot', snapshot);
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.heapSnapshotInterval);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }

    if (this.allocationTracker) {
      this.allocationTracker.stop();
    }

    this.emit('stopped');
  }

  async detectLeaks(): Promise<LeakDetectionResult> {
    const timestamp = Date.now();
    const detectedLeaks: DetectedLeak[] = [];
    
    // Analyze heap growth patterns
    const heapAnalysis = await this.analyzeHeapSnapshot();
    const memoryGrowthLeaks = this.detectMemoryGrowthLeaks(heapAnalysis);
    detectedLeaks.push(...memoryGrowthLeaks);

    // Detect specific leak patterns
    const patternLeaks = this.detectLeakPatterns(heapAnalysis);
    detectedLeaks.push(...patternLeaks);

    // Analyze allocation tracking data
    if (this.allocationTracker) {
      const allocationLeaks = this.analyzeAllocationLeaks();
      detectedLeaks.push(...allocationLeaks);
    }

    // Create leak analysis
    const analysis = this.createLeakAnalysis(detectedLeaks, heapAnalysis);
    
    // Determine overall confidence and severity
    const confidence = this.calculateOverallConfidence(detectedLeaks);
    const severity = this.determineSeverity(analysis);

    // Generate recommendations
    const recommendations = await this.getRecommendations();

    const result: LeakDetectionResult = {
      timestamp,
      detectedLeaks,
      analysis,
      confidence,
      severity,
      recommendations,
    };

    this.lastDetectionResult = result;
    return result;
  }

  async analyzeHeapSnapshot(): Promise<HeapSnapshotAnalysis> {
    // Force garbage collection to get accurate snapshot
    if (global.gc) {
      global.gc();
    }

    const heapStats = v8.getHeapStatistics();
    
    // Analyze object types and sizes
    const objectTypes = this.analyzeObjectTypes();
    const retainerPaths = this.findRetainerPaths();
    const dominatorTree = this.buildDominatorTree();
    const largestObjects = this.findLargestObjects();

    return {
      timestamp: Date.now(),
      totalSize: heapStats.used_heap_size,
      objectTypes,
      retainerPaths,
      dominatorTree,
      largestObjects,
    };
  }

  async trackAllocations(): Promise<AllocationTracker> {
    if (!this.allocationTracker) {
      this.allocationTracker = new InternalAllocationTracker();
      this.allocationTracker.start();
    }
    return this.allocationTracker;
  }

  async getRecommendations(): Promise<LeakRecommendation[]> {
    const recommendations: LeakRecommendation[] = [];

    if (!this.lastDetectionResult) {
      return recommendations;
    }

    const { detectedLeaks, analysis } = this.lastDetectionResult;

    // General memory management recommendations
    if (analysis.totalLeakedMemory > 100 * 1024 * 1024) { // 100MB
      recommendations.push({
        priority: 'high',
        category: 'cleanup',
        title: 'Critical Memory Leak Detected',
        description: `Detected ${this.formatBytes(analysis.totalLeakedMemory)} of leaked memory`,
        action: 'Investigate and fix the largest memory leaks immediately',
        impact: 'High performance impact and potential out-of-memory errors',
        difficulty: 'medium',
      });
    }

    // Leak-specific recommendations
    for (const leak of detectedLeaks) {
      recommendations.push(...this.generateLeakSpecificRecommendations(leak));
    }

    // GC effectiveness recommendations
    if (analysis.gcEffectiveness < 0.5) {
      recommendations.push({
        priority: 'medium',
        category: 'optimization',
        title: 'Poor Garbage Collection Effectiveness',
        description: 'Garbage collection is not effectively freeing memory',
        action: 'Review object lifecycle and ensure proper cleanup',
        impact: 'Gradual memory accumulation over time',
        difficulty: 'medium',
      });
    }

    // Heap fragmentation recommendations
    if (analysis.heapFragmentation > 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'optimization',
        title: 'High Heap Fragmentation',
        description: 'Memory heap is highly fragmented',
        action: 'Consider object pooling or restructuring memory allocation patterns',
        impact: 'Reduced memory efficiency and potential allocation failures',
        difficulty: 'hard',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.heapSnapshots = [];
    this.lastDetectionResult = undefined;
    this.removeAllListeners();
  }

  // Private helper methods
  private validateConfig(): void {
    if (this.config.detectionInterval < 1000) {
      throw new Error('Detection interval must be at least 1000ms');
    }
    if (this.config.heapSnapshotInterval < 5000) {
      throw new Error('Heap snapshot interval must be at least 5000ms');
    }
    if (this.config.confidenceThreshold < 0 || this.config.confidenceThreshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
  }

  private detectMemoryGrowthLeaks(heapAnalysis: HeapSnapshotAnalysis): DetectedLeak[] {
    const leaks: DetectedLeak[] = [];
    
    if (this.heapSnapshots.length < 2) {
      return leaks; // Need at least 2 snapshots for comparison
    }

    const previousSnapshot = this.heapSnapshots[this.heapSnapshots.length - 1];
    if (!previousSnapshot) {
      return leaks;
    }

    const growthRate = (heapAnalysis.totalSize - previousSnapshot.totalSize) / 
                      ((heapAnalysis.timestamp - previousSnapshot.timestamp) / 1000);

    // Detect rapid growth patterns
    if (growthRate > this.config.minLeakThreshold) {
      leaks.push({
        id: `growth_${Date.now()}`,
        type: 'unknown',
        location: 'heap',
        stackTrace: ['Memory growth detected'],
        memoryUsed: heapAnalysis.totalSize - previousSnapshot.totalSize,
        objectCount: 0,
        growthRate,
        firstDetected: previousSnapshot.timestamp,
        lastUpdated: heapAnalysis.timestamp,
        confidence: 0.7,
      });
    }

    return leaks;
  }

  private detectLeakPatterns(heapAnalysis: HeapSnapshotAnalysis): DetectedLeak[] {
    const leaks: DetectedLeak[] = [];

    // Detect common leak patterns based on object types
    for (const objType of heapAnalysis.objectTypes) {
      if (this.isLikelyLeakPattern(objType)) {
        leaks.push({
          id: `pattern_${objType.type}_${Date.now()}`,
          type: this.classifyLeakType(objType.type),
          location: objType.type,
          stackTrace: [`Object type: ${objType.type}`],
          memoryUsed: objType.size,
          objectCount: objType.count,
          growthRate: 0,
          firstDetected: Date.now(),
          lastUpdated: Date.now(),
          confidence: this.calculatePatternConfidence(objType),
        });
      }
    }

    return leaks;
  }

  private analyzeAllocationLeaks(): DetectedLeak[] {
    if (!this.allocationTracker) {
      return [];
    }

    const topAllocators = this.allocationTracker.getTopAllocators();
    const leaks: DetectedLeak[] = [];

    // Analyze high-allocation sites that might indicate leaks
    for (const allocator of topAllocators) {
      if (allocator.rate > this.config.minLeakThreshold / 1000) { // Convert to per-second
        leaks.push({
          id: `allocation_${Date.now()}_${Math.random()}`,
          type: 'unknown',
          location: 'allocation_site',
          stackTrace: allocator.stackTrace,
          memoryUsed: allocator.bytes,
          objectCount: allocator.count,
          growthRate: allocator.rate,
          firstDetected: Date.now(),
          lastUpdated: Date.now(),
          confidence: 0.6,
        });
      }
    }

    return leaks;
  }

  private createLeakAnalysis(leaks: DetectedLeak[], heapAnalysis: HeapSnapshotAnalysis): LeakAnalysis {
    const totalLeakedMemory = leaks.reduce((sum, leak) => sum + leak.memoryUsed, 0);
    const leakGrowthRate = leaks.reduce((sum, leak) => sum + leak.growthRate, 0);
    
    return {
      totalLeakedMemory,
      leakGrowthRate,
      affectedObjects: heapAnalysis.objectTypes,
      memoryTrend: {
        metric: 'heap_size',
        direction: totalLeakedMemory > 0 ? 'increasing' : 'stable',
        rate: leakGrowthRate,
        confidence: 0.8,
        timeWindowMs: this.config.detectionInterval,
      },
      gcEffectiveness: this.calculateGCEffectiveness(),
      heapFragmentation: this.calculateHeapFragmentation(),
    };
  }

  private calculateOverallConfidence(leaks: DetectedLeak[]): number {
    if (leaks.length === 0) return 1.0;
    
    const avgConfidence = leaks.reduce((sum, leak) => sum + leak.confidence, 0) / leaks.length;
    return Math.min(avgConfidence, 1.0);
  }

  private determineSeverity(analysis: LeakAnalysis): LeakSeverity {
    const memoryMB = analysis.totalLeakedMemory / (1024 * 1024);
    
    if (memoryMB > 500) return 'critical';
    if (memoryMB > 100) return 'high';
    if (memoryMB > 10) return 'medium';
    return 'low';
  }

  private addHeapSnapshot(snapshot: HeapSnapshotAnalysis): void {
    this.heapSnapshots.push(snapshot);
    
    // Keep only the most recent snapshots
    if (this.heapSnapshots.length > this.config.maxSnapshots) {
      this.heapSnapshots.shift();
    }
  }

  private analyzeObjectTypes(): ObjectTypeCount[] {
    // Placeholder implementation - in a real scenario, this would use heap profiling
    return [
      { type: 'Object', count: 1000, size: 80000, percentage: 40 },
      { type: 'Array', count: 500, size: 40000, percentage: 20 },
      { type: 'String', count: 2000, size: 30000, percentage: 15 },
      { type: 'Function', count: 300, size: 20000, percentage: 10 },
      { type: 'Buffer', count: 100, size: 30000, percentage: 15 },
    ];
  }

  private findRetainerPaths(): RetainerPath[] {
    // Placeholder implementation
    return [
      {
        objectType: 'Array',
        path: ['global', 'cache', 'items'],
        size: 50000,
        count: 100,
      },
    ];
  }

  private buildDominatorTree(): DominatorNode[] {
    // Placeholder implementation
    return [
      {
        type: 'Object',
        size: 100000,
        retainedSize: 200000,
        children: [],
      },
    ];
  }

  private findLargestObjects(): LargeObject[] {
    // Placeholder implementation
    return [
      {
        type: 'Buffer',
        size: 1000000,
        id: 'buffer_001',
        properties: { length: 1000000 },
      },
    ];
  }

  private isLikelyLeakPattern(objType: ObjectTypeCount): boolean {
    // Heuristics for detecting leak patterns
    return objType.count > 10000 || objType.size > 50 * 1024 * 1024; // 50MB
  }

  private classifyLeakType(objectType: string): LeakType {
    if (objectType.includes('Timer') || objectType.includes('Timeout')) {
      return 'timer_leak';
    }
    if (objectType.includes('EventListener') || objectType.includes('Listener')) {
      return 'event_listener_leak';
    }
    if (objectType.includes('Cache') || objectType.includes('Map')) {
      return 'cache_leak';
    }
    if (objectType.includes('Buffer') || objectType.includes('ArrayBuffer')) {
      return 'buffer_leak';
    }
    if (objectType.includes('Stream')) {
      return 'stream_leak';
    }
    if (objectType.includes('Worker')) {
      return 'worker_leak';
    }
    return 'unknown';
  }

  private calculatePatternConfidence(objType: ObjectTypeCount): number {
    // Higher confidence for known problematic patterns
    let confidence = 0.5;
    
    if (objType.count > 50000) confidence += 0.2;
    if (objType.size > 100 * 1024 * 1024) confidence += 0.2; // 100MB
    if (objType.percentage > 30) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private calculateGCEffectiveness(): number {
    // Placeholder - would analyze GC performance in real implementation
    return 0.75;
  }

  private calculateHeapFragmentation(): number {
    // Placeholder - would analyze heap fragmentation in real implementation
    return 0.3;
  }

  private generateLeakSpecificRecommendations(leak: DetectedLeak): LeakRecommendation[] {
    const recommendations: LeakRecommendation[] = [];

    switch (leak.type) {
      case 'timer_leak':
        recommendations.push({
          priority: 'high',
          category: 'cleanup',
          title: 'Timer Leak Detected',
          description: 'Uncleaned timers are accumulating',
          action: 'Ensure all timers are cleared with clearTimeout/clearInterval',
          impact: 'Gradual memory growth and performance degradation',
          difficulty: 'easy',
        });
        break;

      case 'event_listener_leak':
        recommendations.push({
          priority: 'high',
          category: 'cleanup',
          title: 'Event Listener Leak Detected',
          description: 'Event listeners are not being removed',
          action: 'Add removeEventListener calls when objects are destroyed',
          impact: 'Memory growth and potential performance issues',
          difficulty: 'easy',
        });
        break;

      case 'cache_leak':
        recommendations.push({
          priority: 'medium',
          category: 'optimization',
          title: 'Cache Leak Detected',
          description: 'Cache is growing without bounds',
          action: 'Implement cache size limits and LRU eviction',
          impact: 'Unlimited memory growth over time',
          difficulty: 'medium',
        });
        break;

      case 'buffer_leak':
        recommendations.push({
          priority: 'high',
          category: 'cleanup',
          title: 'Buffer Leak Detected',
          description: 'Large buffers are not being released',
          action: 'Ensure buffers are explicitly freed or set to null',
          impact: 'Large memory consumption',
          difficulty: 'easy',
        });
        break;
    }

    return recommendations;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

/**
 * Internal allocation tracker implementation
 */
class InternalAllocationTracker implements AllocationTracker {
  private isTracking = false;
  private allocations: AllocationPoint[] = [];
  private allocationSites: Map<string, AllocationSite> = new Map();
  private startTime = 0;

  start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.startTime = Date.now();
    this.allocations = [];
    this.allocationSites.clear();
    
    // Note: Real implementation would use V8 heap profiler APIs
    // This is a simplified simulation
  }

  stop(): void {
    this.isTracking = false;
  }

  getStats(): AllocationStats {
    const totalTime = (Date.now() - this.startTime) / 1000; // seconds
    const totalAllocations = this.allocations.reduce((sum, point) => sum + point.allocations, 0);
    const totalBytes = this.allocations.reduce((sum, point) => sum + point.bytes, 0);

    return {
      totalAllocations,
      totalBytes,
      allocationRate: totalTime > 0 ? totalAllocations / totalTime : 0,
      byteRate: totalTime > 0 ? totalBytes / totalTime : 0,
      topTypes: [
        { type: 'Object', count: 500, size: 40000, percentage: 30 },
        { type: 'Array', count: 300, size: 24000, percentage: 20 },
        { type: 'String', count: 800, size: 16000, percentage: 15 },
      ],
      timeline: this.allocations,
    };
  }

  getTopAllocators(): AllocationSite[] {
    return Array.from(this.allocationSites.values())
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);
  }
}

// Default configuration
export const DEFAULT_LEAK_DETECTOR_CONFIG: LeakDetectorConfig = {
  detectionInterval: 60000, // 1 minute
  heapSnapshotInterval: 300000, // 5 minutes
  allocationTrackingEnabled: true,
  minLeakThreshold: 1024 * 1024, // 1MB
  confidenceThreshold: 0.7,
  maxSnapshots: 10,
  enableStackTraces: true,
};