/**
 * Core types and interfaces for memory management and resource optimization
 */

export interface ResourceConfig {
  /** Maximum memory usage limit in MB */
  maxMemoryMB: number;
  /** Memory threshold to trigger GC in MB */
  gcTriggerThreshold: number;
  /** Resource pool configurations */
  poolSizes: PoolConfiguration;
  /** Resource monitoring frequency in ms */
  monitoringInterval: number;
  /** Enable memory profiling */
  enableProfiling: boolean;
  /** Enable leak detection */
  leakDetectionEnabled: boolean;
}

export interface PoolConfiguration {
  /** Maximum database connections */
  databaseConnections: number;
  /** Maximum embedding workers */
  embeddingWorkers: number;
  /** Maximum file handles */
  fileHandles: number;
  /** Embedding cache size */
  embeddingCacheSize: number;
}

export interface ResourceManager {
  initialize(config: ResourceConfig): Promise<void>;
  optimizeMemoryUsage(): Promise<OptimizationResult>;
  detectMemoryLeaks(): Promise<MemoryLeakReport>;
  manageResourcePools(): Promise<PoolStatus>;
  monitorResourceUsage(): ResourceMonitor;
  cleanup(): Promise<void>;
}

export interface OptimizationResult {
  duration: number;
  beforeMemory: NodeJS.MemoryUsage;
  afterMemory: NodeJS.MemoryUsage;
  memorySaved: number;
  optimizations: OptimizationStep[];
  success: boolean;
  error?: string;
}

export interface OptimizationStep {
  name: string;
  duration: number;
  memorySaved: number;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface MemoryLeakReport {
  timestamp: Date;
  leaksDetected: MemoryLeak[];
  heapAnalysis: HeapAnalysis;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryLeak {
  type: string;
  count: number;
  memoryUsage: number;
  stackTrace?: string;
  createdAt?: Date;
  lastAccessed?: Date;
}

export interface HeapAnalysis {
  totalHeapSize: number;
  usedHeapSize: number;
  heapSizeLimit: number;
  objectCounts: Record<string, number>;
  topConsumers: Array<{
    type: string;
    count: number;
    size: number;
  }>;
}

export interface PoolStatus {
  pools: Record<string, ResourcePoolInfo>;
  totalResourcesInUse: number;
  totalResourcesAvailable: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface ResourcePoolInfo {
  name: string;
  type: string;
  size: number;
  available: number;
  inUse: number;
  created: number;
  destroyed: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface ResourceMonitor {
  getCurrentUsage(): MemorySnapshot;
  getUsageHistory(): MemorySnapshot[];
  getAlerts(): MemoryAlert[];
  isHealthy(): boolean;
}

export interface MemorySnapshot {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    heapUtilization: number;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'memory_warning' | 'memory_critical' | 'rapid_growth' | 'potential_leak' | 'gc_needed';

export interface MemoryAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    timestamp: number;
    memorySnapshot: MemorySnapshot;
    resolved: boolean;
}

export interface MemoryTrend {
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number; // Percentage change rate
    confidence: number; // 0-1, higher is more confident
    timeWindowMs: number;
}

/**
 * Memory Monitor Interface - Provides real-time memory monitoring capabilities
 */
export interface MemoryMonitor {
    start(): Promise<void>;
    stop(): Promise<void>;
    getCurrentUsage(): Promise<MemorySnapshot>;
    getHistory(): MemorySnapshot[];
    getTrends(): MemoryTrend[];
    getAlerts(limit?: number): MemoryAlert[];
    cleanup(): Promise<void>;
}

export interface AlertThresholds {
  warningThreshold: number;
  criticalThreshold: number;
  gcThreshold: number;
}

export interface GCResult {
  duration: number;
  beforeMemory: number;
  afterMemory: number;
  memoryCleaned: number;
  timestamp: Date;
}

export interface GCStats {
  totalGCs: number;
  totalTimeMS: number;
  totalMemoryCleaned: number;
  averageGCTime: number;
  averageMemoryCleaned: number;
  lastGC: Date | null;
}

/**
 * Memory Leak Detection Interfaces
 */
export interface MemoryLeakDetector {
  start(): Promise<void>;
  stop(): Promise<void>;
  detectLeaks(): Promise<LeakDetectionResult>;
  analyzeHeapSnapshot(): Promise<HeapSnapshotAnalysis>;
  trackAllocations(): Promise<AllocationTracker>;
  getRecommendations(): Promise<LeakRecommendation[]>;
  cleanup(): Promise<void>;
}

export interface LeakDetectionResult {
  timestamp: number;
  detectedLeaks: DetectedLeak[];
  analysis: LeakAnalysis;
  confidence: number; // 0-1, higher is more confident
  severity: LeakSeverity;
  recommendations: LeakRecommendation[];
}

export interface DetectedLeak {
  id: string;
  type: LeakType;
  location: string;
  stackTrace: string[];
  memoryUsed: number;
  objectCount: number;
  growthRate: number; // bytes per second
  firstDetected: number;
  lastUpdated: number;
  confidence: number;
}

export interface LeakAnalysis {
  totalLeakedMemory: number;
  leakGrowthRate: number;
  affectedObjects: ObjectTypeCount[];
  memoryTrend: MemoryTrend;
  gcEffectiveness: number; // 0-1, how well GC is working
  heapFragmentation: number; // 0-1, level of fragmentation
}

export interface ObjectTypeCount {
  type: string;
  count: number;
  size: number;
  percentage: number;
}

export interface HeapSnapshotAnalysis {
  timestamp: number;
  totalSize: number;
  objectTypes: ObjectTypeCount[];
  retainerPaths: RetainerPath[];
  dominatorTree: DominatorNode[];
  largestObjects: LargeObject[];
}

export interface RetainerPath {
  objectType: string;
  path: string[];
  size: number;
  count: number;
}

export interface DominatorNode {
  type: string;
  size: number;
  retainedSize: number;
  children: DominatorNode[];
}

export interface LargeObject {
  type: string;
  size: number;
  id: string;
  properties: Record<string, any>;
}

export interface AllocationTracker {
  start(): void;
  stop(): void;
  getStats(): AllocationStats;
  getTopAllocators(): AllocationSite[];
}

export interface AllocationStats {
  totalAllocations: number;
  totalBytes: number;
  allocationRate: number; // allocations per second
  byteRate: number; // bytes per second
  topTypes: ObjectTypeCount[];
  timeline: AllocationPoint[];
}

export interface AllocationSite {
  stackTrace: string[];
  count: number;
  bytes: number;
  rate: number;
}

export interface AllocationPoint {
  timestamp: number;
  allocations: number;
  bytes: number;
}

export interface LeakRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: RecommendationCategory;
  title: string;
  description: string;
  action: string;
  impact: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export type LeakType = 
  | 'closure_leak'
  | 'event_listener_leak'
  | 'timer_leak'
  | 'cache_leak'
  | 'circular_reference'
  | 'dom_leak'
  | 'worker_leak'
  | 'stream_leak'
  | 'buffer_leak'
  | 'unknown';

export type LeakSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RecommendationCategory = 
  | 'cleanup'
  | 'optimization' 
  | 'architecture'
  | 'monitoring'
  | 'prevention';

// Default configuration values
export const DEFAULT_RESOURCE_CONFIG: ResourceConfig = {
  maxMemoryMB: 4096, // 4GB limit as specified in acceptance criteria
  gcTriggerThreshold: 3276.8, // 80% of max memory (3.2GB)
  poolSizes: {
    databaseConnections: 10,
    embeddingWorkers: 4,
    fileHandles: 100,
    embeddingCacheSize: 10000,
  },
  monitoringInterval: 30000, // 30 seconds
  enableProfiling: false, // Disabled by default for performance
  leakDetectionEnabled: true,
};