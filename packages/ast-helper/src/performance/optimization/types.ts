/**
 * Performance Optimization Types and Interfaces
 * Part of Issue #150 - Performance Optimization Component
 */

/**
 * Performance metrics for monitoring system health
 */
export interface PerformanceMetrics {
  memory: MemoryMetrics;
  cpu: CpuMetrics;
  cache: CacheMetrics;
  processing: ProcessingMetrics;
  io: IoMetrics;
  timestamp: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  heapUsed: number; // Bytes
  heapTotal: number; // Bytes
  external: number; // Bytes
  rss: number; // Resident Set Size in bytes
  arrayBuffers: number; // Bytes
  peakUsage: number; // Peak memory usage
  gcCount: number; // Garbage collection count
  gcTime: number; // Time spent in GC (ms)
}

/**
 * CPU usage metrics
 */
export interface CpuMetrics {
  usage: number; // CPU usage percentage (0-100)
  loadAverage: number[]; // 1, 5, 15 minute load averages
  userTime: number; // User CPU time (ms)
  systemTime: number; // System CPU time (ms)
  idleTime: number; // Idle CPU time (ms)
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  hitRate: number; // Cache hit rate (0-1)
  missRate: number; // Cache miss rate (0-1)
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
  size: number; // Current cache size
  maxSize: number; // Maximum cache size
  memoryUsage: number; // Memory used by cache (bytes)
}

/**
 * Processing performance metrics
 */
export interface ProcessingMetrics {
  throughput: number; // Items processed per second
  averageLatency: number; // Average processing time (ms)
  p95Latency: number; // 95th percentile latency (ms)
  p99Latency: number; // 99th percentile latency (ms)
  queueSize: number; // Current queue size
  activeWorkers: number; // Number of active workers
  completedTasks: number; // Total completed tasks
  failedTasks: number; // Total failed tasks
}

/**
 * I/O performance metrics
 */
export interface IoMetrics {
  readOperations: number; // Number of read operations
  writeOperations: number; // Number of write operations
  readBytes: number; // Bytes read
  writtenBytes: number; // Bytes written
  readLatency: number; // Average read latency (ms)
  writeLatency: number; // Average write latency (ms)
  diskUsage: number; // Disk usage percentage (0-100)
}

/**
 * Performance optimization configuration
 */
export interface PerformanceOptimizationConfig {
  memory: MemoryOptimizationConfig;
  cache: CacheOptimizationConfig;
  processing: ProcessingOptimizationConfig;
  monitoring: MonitoringConfig;
  io: IoOptimizationConfig;
}

/**
 * Memory management configuration
 */
export interface MemoryOptimizationConfig {
  enabled: boolean;
  maxHeapSize: number; // Maximum heap size in bytes
  gcThreshold: number; // GC threshold (0-1)
  memoryWarningThreshold: number; // Warning threshold (0-1)
  memoryCriticalThreshold: number; // Critical threshold (0-1)
  autoCleanup: boolean;
  cleanupInterval: number; // Cleanup interval in ms
  leakDetection: boolean;
  profiling: boolean;
}

/**
 * Cache optimization configuration
 */
export interface CacheOptimizationConfig {
  enabled: boolean;
  maxSize: number; // Maximum cache entries
  maxMemory: number; // Maximum memory usage (bytes)
  ttl: number; // Time to live (ms)
  evictionPolicy: EvictionPolicy;
  compressionEnabled: boolean;
  persistToDisk: boolean;
  diskCachePath?: string;
  warmupEnabled: boolean;
  preloadKeys: string[];
}

/**
 * Cache eviction policies
 */
export enum EvictionPolicy {
  LRU = "lru", // Least Recently Used
  LFU = "lfu", // Least Frequently Used
  FIFO = "fifo", // First In, First Out
  TTL = "ttl", // Time To Live
  RANDOM = "random",
}

/**
 * Processing optimization configuration
 */
export interface ProcessingOptimizationConfig {
  enabled: boolean;
  batchSize: number;
  maxConcurrency: number;
  queueMaxSize: number;
  processingTimeout: number; // Timeout per item (ms)
  retryAttempts: number;
  retryDelay: number; // Delay between retries (ms)
  priorityQueuing: boolean;
  loadBalancing: boolean;
  circuitBreaker: CircuitBreakerConfig;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number; // Number of failures to trigger circuit breaker
  recoveryTimeout: number; // Time before attempting recovery (ms)
  monitoringWindow: number; // Time window for failure monitoring (ms)
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number; // Metrics collection interval (ms)
  retentionPeriod: number; // How long to keep metrics (ms)
  alertThresholds: AlertThresholds;
  exportMetrics: boolean;
  exportPath?: string;
  realTimeMonitoring: boolean;
}

/**
 * Alert thresholds for performance monitoring
 */
export interface AlertThresholds {
  memoryUsage: number; // Memory usage threshold (0-1)
  cpuUsage: number; // CPU usage threshold (0-1)
  cacheHitRate: number; // Minimum cache hit rate (0-1)
  latency: number; // Maximum acceptable latency (ms)
  queueSize: number; // Maximum queue size
  errorRate: number; // Maximum error rate (0-1)
}

/**
 * I/O optimization configuration
 */
export interface IoOptimizationConfig {
  enabled: boolean;
  bufferSize: number; // I/O buffer size
  maxConcurrentReads: number;
  maxConcurrentWrites: number;
  readTimeout: number; // Read timeout (ms)
  writeTimeout: number; // Write timeout (ms)
  compressionEnabled: boolean;
  cachingEnabled: boolean;
}

/**
 * Performance optimization results
 */
export interface OptimizationResults {
  optimizations: AppliedOptimization[];
  performanceBefore: PerformanceMetrics;
  performanceAfter: PerformanceMetrics;
  improvements: PerformanceImprovements;
  recommendations: string[];
}

/**
 * Applied optimization details
 */
export interface AppliedOptimization {
  type: OptimizationType;
  description: string;
  impact: OptimizationImpact;
  timestamp: number;
}

/**
 * Types of optimizations
 */
export enum OptimizationType {
  MEMORY_CLEANUP = "memory_cleanup",
  CACHE_OPTIMIZATION = "cache_optimization",
  BATCH_PROCESSING = "batch_processing",
  RESOURCE_POOLING = "resource_pooling",
  IO_OPTIMIZATION = "io_optimization",
  CONCURRENCY_TUNING = "concurrency_tuning",
  GARBAGE_COLLECTION = "garbage_collection",
  CODE_SPLITTING = "code_splitting",
}

/**
 * Optimization impact metrics
 */
export interface OptimizationImpact {
  memoryReduction: number; // Memory reduction in bytes
  latencyImprovement: number; // Latency improvement in ms
  throughputIncrease: number; // Throughput increase (%)
  cacheHitRateImprovement: number; // Cache hit rate improvement (%)
}

/**
 * Performance improvements summary
 */
export interface PerformanceImprovements {
  memoryUsageReduction: number; // Percentage reduction
  latencyImprovement: number; // Percentage improvement
  throughputIncrease: number; // Percentage increase
  cacheEfficiencyGain: number; // Percentage gain
  cpuUsageReduction: number; // Percentage reduction
  overallScore: number; // Overall improvement score (0-100)
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved: boolean;
  recommendations: string[];
}

/**
 * Alert types
 */
export enum AlertType {
  MEMORY_HIGH = "memory_high",
  CPU_HIGH = "cpu_high",
  CACHE_LOW_HIT_RATE = "cache_low_hit_rate",
  LATENCY_HIGH = "latency_high",
  QUEUE_FULL = "queue_full",
  ERROR_RATE_HIGH = "error_rate_high",
  DISK_FULL = "disk_full",
  MEMORY_LEAK = "memory_leak",
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Resource pool configuration
 */
export interface ResourcePoolConfig {
  minSize: number; // Minimum pool size
  maxSize: number; // Maximum pool size
  acquireTimeout: number; // Timeout for acquiring resource (ms)
  idleTimeout: number; // Idle resource timeout (ms)
  validationEnabled: boolean;
  validationInterval: number; // Validation interval (ms)
}

/**
 * Batch processing job
 */
export interface BatchJob<T> {
  id: string;
  items: T[];
  priority: number;
  timeout: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  status: BatchJobStatus;
  results?: BatchJobResult<T>[];
  error?: Error;
}

/**
 * Batch job status
 */
export enum BatchJobStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Batch job result
 */
export interface BatchJobResult<T, R = unknown> {
  item: T;
  success: boolean;
  result?: R;
  error?: Error;
  processingTime: number;
}

/**
 * Default performance optimization configuration
 */
export const DEFAULT_PERFORMANCE_OPTIMIZATION_CONFIG: PerformanceOptimizationConfig =
  {
    memory: {
      enabled: true,
      maxHeapSize: 1024 * 1024 * 1024, // 1GB
      gcThreshold: 0.8,
      memoryWarningThreshold: 0.8,
      memoryCriticalThreshold: 0.95,
      autoCleanup: true,
      cleanupInterval: 60000, // 1 minute
      leakDetection: true,
      profiling: false,
    },
    cache: {
      enabled: true,
      maxSize: 10000,
      maxMemory: 100 * 1024 * 1024, // 100MB
      ttl: 3600000, // 1 hour
      evictionPolicy: EvictionPolicy.LRU,
      compressionEnabled: true,
      persistToDisk: false,
      warmupEnabled: true,
      preloadKeys: [],
    },
    processing: {
      enabled: true,
      batchSize: 100,
      maxConcurrency: 10,
      queueMaxSize: 1000,
      processingTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      priorityQueuing: true,
      loadBalancing: true,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 10,
        recoveryTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
      },
    },
    monitoring: {
      enabled: true,
      metricsInterval: 5000, // 5 seconds
      retentionPeriod: 86400000, // 24 hours
      alertThresholds: {
        memoryUsage: 0.85,
        cpuUsage: 0.8,
        cacheHitRate: 0.7,
        latency: 5000, // 5 seconds
        queueSize: 800,
        errorRate: 0.05, // 5%
      },
      exportMetrics: false,
      realTimeMonitoring: true,
    },
    io: {
      enabled: true,
      bufferSize: 64 * 1024, // 64KB
      maxConcurrentReads: 10,
      maxConcurrentWrites: 5,
      readTimeout: 30000, // 30 seconds
      writeTimeout: 30000, // 30 seconds
      compressionEnabled: true,
      cachingEnabled: true,
    },
  };
