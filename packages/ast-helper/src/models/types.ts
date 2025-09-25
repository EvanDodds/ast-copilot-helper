/**
 * Model configuration types and interfaces for ML model management
 */

/**
 * Supported model formats
 */
export type ModelFormat = "onnx" | "pytorch" | "tensorflow" | "json";

/**
 * Model configuration interface
 * Defines all metadata required for model downloading, verification, and usage
 */
export interface ModelConfig {
  /** Unique model identifier */
  name: string;

  /** Model version (semantic versioning recommended) */
  version: string;

  /** Download URL (must be HTTPS) */
  url: string;

  /** SHA256 checksum for integrity verification */
  checksum: string;

  /** File size in bytes for validation and progress tracking */
  size: number;

  /** Model file format */
  format: ModelFormat;

  /** Embedding dimensions (output vector size) */
  dimensions: number;

  /** Optional tokenizer configuration for multi-file models */
  tokenizer?: ModelConfig;

  /** Model description and usage notes */
  description?: string;

  /** Compatibility requirements */
  requirements?: ModelRequirements;
}

/**
 * Model requirements and compatibility information
 */
export interface ModelRequirements {
  /** Minimum Node.js version */
  nodeVersion?: string;

  /** Required memory in MB */
  memoryMB?: number;

  /** Architecture requirements (x64, arm64) */
  architecture?: string[];

  /** Operating system compatibility */
  platforms?: string[];
}

/**
 * Model configuration validation result
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** Error messages for invalid configurations */
  errors: string[];

  /** Warning messages for potential issues */
  warnings: string[];
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Bytes downloaded so far */
  bytesDownloaded: number;

  /** Total bytes to download */
  totalBytes: number;

  /** Percentage complete (0-100) */
  percentage: number;

  /** Download speed in bytes per second */
  speed: number;

  /** Estimated time remaining in seconds */
  eta: number;

  /** Current phase of download */
  phase: "downloading" | "verifying" | "extracting" | "complete";
}

/**
 * Model metadata stored with cached models
 */
export interface ModelMetadata {
  /** Model configuration */
  config: ModelConfig;

  /** Download timestamp */
  downloadedAt: Date;

  /** Last verification timestamp */
  lastVerified: Date;

  /** Download duration in milliseconds */
  downloadDuration: number;

  /** Verification status */
  verified: boolean;

  /** Enhanced usage statistics for analytics */
  usageStats?: ModelUsageStats;
}

/**
 * Comprehensive model usage statistics for analytics and optimization
 */
export interface ModelUsageStats {
  /** Total number of times model was loaded */
  loadCount: number;

  /** Last time the model was used */
  lastUsed: Date;

  /** First time the model was used */
  firstUsed: Date;

  /** Total processing time in milliseconds */
  totalProcessingTime: number;

  /** Number of embedding requests processed */
  embeddingRequests: number;

  /** Average processing time per request in milliseconds */
  averageProcessingTime: number;

  /** Peak memory usage during processing in bytes */
  peakMemoryUsage: number;

  /** Total number of errors encountered */
  errorCount: number;

  /** Success rate as percentage (0-100) */
  successRate: number;

  /** Performance metrics over time */
  performanceHistory: ModelPerformanceEntry[];

  /** Usage patterns by hour of day (0-23) */
  hourlyUsage: Record<number, number>;

  /** Usage patterns by day of week (0-6, Sunday=0) */
  weeklyUsage: Record<number, number>;

  /** Cache hit rate percentage (0-100) */
  cacheHitRate?: number;

  /** Last performance optimization date */
  lastOptimized?: Date;
}

/**
 * Performance entry for tracking model performance over time
 */
export interface ModelPerformanceEntry {
  /** Timestamp of the performance measurement */
  timestamp: Date;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Number of items processed in this session */
  itemsProcessed: number;

  /** Whether this session completed successfully */
  success: boolean;

  /** Error message if session failed */
  errorMessage?: string;

  /** Cache hit rate for this session (0-100) */
  cacheHitRate?: number;
}

/**
 * Model usage analytics report
 */
export interface ModelUsageAnalytics {
  modelName: string;
  modelVersion: string;
  totalUsage: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  peakMemoryUsage: number;
  successRate: number;
  errorCount: number;
  daysSinceFirstUse: number;
  recentPerformance: ModelPerformanceEntry[];
  usageByHour: Record<number, number>;
  usageByDay: Record<number, number>;
  cacheEfficiency?: number;
  recommendedOptimizations: string[];
}

/**
 * System-wide usage analytics
 */
export interface SystemUsageAnalytics {
  totalModels: number;
  totalUsage: number;
  averageSuccessRate: number;
  totalProcessingTime: number;
  topPerformingModels: Array<{ name: string; version: string; score: number }>;
  recommendedActions: string[];
}

/**
 * Verification options for model files
 */
export interface VerificationOptions {
  /** Skip checksum verification (useful for testing) */
  skipChecksum?: boolean;
  /** Skip file size verification */
  skipSizeCheck?: boolean;
  /** Skip ONNX format verification */
  skipFormatCheck?: boolean;
  /** Custom quarantine directory */
  quarantineDir?: string;
}

/**
 * Quarantine entry metadata for failed verifications
 */
export interface QuarantineEntry {
  filePath: string;
  reason: string;
  timestamp: Date;
  expectedChecksum?: string;
  actualChecksum?: string;
  expectedSize?: number;
  actualSize?: number;
  errorDetails?: string;
}
