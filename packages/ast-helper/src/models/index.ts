/**
 * Model management system
 * Provides comprehensive model configuration, downloading, verification, caching, and metadata management
 */

// Core types and interfaces from types.ts
export type {
  ModelConfig,
  ModelMetadata,
  ValidationResult,
  ModelFormat,
} from "./types.js";

// Configuration management - export the class and constants
export { ModelRegistry, SUPPORTED_MODELS, DEFAULT_MODEL } from "./config.js";

// Model downloading
export { ModelDownloader, DownloadError } from "./downloader.js";

// Model verification
export {
  FileVerifier,
  fileVerifier,
  verifyModelFile,
  calculateSHA256,
  QuarantineReason,
  type QuarantineEntry,
  type VerificationOptions,
} from "./verification.js";

// Model caching system
export {
  ModelCache,
  CacheStatus,
  modelCache,
  checkModelCache,
  storeModelInCache,
  type CacheHitResult,
  type CacheStats,
  type CacheOptions,
} from "./cache.js";

// Metadata management
export {
  MetadataManager,
  metadataManager,
  storeModelMetadata,
  getModelMetadata,
  queryModelMetadata,
  type MetadataQuery,
} from "./metadata.js";

// Error handling and fallback logic
export {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  ConnectivityStatus,
  errorHandler,
  categorizeError,
  validateConnectivity,
  validateDiskSpace,
  attemptRecovery,
  type ErrorInfo,
  type ConnectivityInfo,
  type DiskSpaceInfo,
  type FallbackModel,
  type RecoveryResult,
} from "./error-handling.js";

// Performance optimization system
export {
  PerformanceOptimizer,
  DownloadStatus,
  performanceOptimizer,
  downloadModelsParallel,
  downloadModelWithResume,
  getPerformanceMetrics,
  getActiveDownloads,
  type PerformanceMetrics,
  type DownloadProgress,
  type ResumeInfo,
  type ThrottlingConfig,
  type ParallelConfig,
  type StreamingConfig,
} from "./performance.js";

// Convenience functions for common operations
export async function ensureModelReady(modelName: string): Promise<string> {
  const { ModelCache } = await import("./cache.js");
  const { ModelRegistry } = await import("./config.js");

  const config = ModelRegistry.getModel(modelName);
  if (!config) {
    throw new Error(`Model configuration not found: ${modelName}`);
  }

  const cache = new ModelCache();
  await cache.initialize();

  const result = await cache.checkCache(config);
  if (result.hit && result.filePath) {
    return result.filePath;
  }

  // Download and cache model
  const { ModelDownloader } = await import("./downloader.js");
  const downloader = new ModelDownloader();
  const filePath = await downloader.downloadModel(
    config,
    `.astdb/models/downloads/${config.name}-${config.version}.${config.format}`,
  );

  // Verify and store in cache
  const { verifyModelFile } = await import("./verification.js");
  const verified = await verifyModelFile(filePath, config);

  if (!verified.valid) {
    throw new Error(`Model verification failed: ${verified.errors.join(", ")}`);
  }

  await cache.storeModel(config, filePath);
  return filePath;
}

export async function getModelStats(): Promise<{
  cached: number;
  verified: number;
  totalSize: number;
  formats: Record<string, number>;
}> {
  const { ModelCache } = await import("./cache.js");
  const { metadataManager } = await import("./metadata.js");

  const cache = new ModelCache();
  const cacheStats = await cache.getStats();
  const metaStats = await metadataManager.getStats();

  return {
    cached: cacheStats.totalModels,
    verified: metaStats.verifiedModels,
    totalSize: cacheStats.totalSize,
    formats: metaStats.formats,
  };
}
