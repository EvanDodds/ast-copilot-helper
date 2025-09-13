/**
 * Model configuration types and interfaces for ML model management
 */

/**
 * Supported model formats
 */
export type ModelFormat = 'onnx' | 'pytorch' | 'tensorflow' | 'json';

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
  phase: 'downloading' | 'verifying' | 'extracting' | 'complete';
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
  
  /** Usage statistics */
  usageStats?: {
    loadCount: number;
    lastUsed: Date;
  };
}