# Model Management API Documentation

Comprehensive API reference for the AST Copilot Helper model management system.

## Core Interfaces

### ModelConfig

Defines model configuration and metadata.

```typescript
interface ModelConfig {
  /** Unique model identifier */
  name: string;
  
  /** Model version (semver format) */
  version: string;
  
  /** Download URL for the model file */
  url: string;
  
  /** SHA256 checksum for integrity verification */
  checksum: string;
  
  /** File size in bytes */
  size: number;
  
  /** Model file format */
  format: 'onnx' | 'pytorch' | 'tensorflow' | 'huggingface';
  
  /** Model embedding dimensions */
  dimensions: number;
  
  /** Human-readable description */
  description: string;
  
  /** System requirements */
  requirements: {
    /** Minimum memory required */
    memoryMB: number;
    
    /** Supported architectures */
    architecture: string[];
    
    /** Supported platforms */
    platforms: string[];
  };
  
  /** Optional metadata */
  metadata?: {
    author?: string;
    license?: string;
    tags?: string[];
    performance?: {
      latency?: number;
      throughput?: number;
    };
  };
}
```

### ModelMetadata

Runtime metadata for cached models.

```typescript
interface ModelMetadata {
  /** Associated model configuration */
  config: ModelConfig;
  
  /** Download timestamp */
  downloadedAt: Date;
  
  /** Last verification timestamp */
  lastVerified: Date;
  
  /** Download duration in milliseconds */
  downloadDuration: number;
  
  /** Whether file passed verification */
  verified: boolean;
  
  /** Usage statistics */
  usage?: {
    accessCount: number;
    lastAccessed: Date;
  };
}
```

## ModelRegistry

Static registry for managing model configurations.

### Methods

#### getInstance()

Get the singleton ModelRegistry instance.

```typescript
static getInstance(): ModelRegistry
```

**Example:**
```typescript
const registry = ModelRegistry.getInstance();
```

#### getModel()

Retrieve a model configuration by name.

```typescript
async getModel(name: string): Promise<ModelConfig>
```

**Parameters:**
- `name` - Model identifier

**Returns:** Promise resolving to ModelConfig

**Throws:** `ModelNotFoundError` if model doesn't exist

**Example:**
```typescript
try {
  const model = await registry.getModel('code-embedding-v1');
  console.log(`Model: ${model.name} v${model.version}`);
} catch (error) {
  console.error('Model not found:', error.message);
}
```

#### getAvailableModels()

List all available model configurations.

```typescript
async getAvailableModels(): Promise<ModelConfig[]>
```

**Returns:** Promise resolving to array of ModelConfig objects

**Example:**
```typescript
const models = await registry.getAvailableModels();
models.forEach(model => {
  console.log(`${model.name} v${model.version} (${model.format})`);
});
```

#### addModel()

Add a custom model configuration to the registry.

```typescript
async addModel(config: ModelConfig): Promise<void>
```

**Parameters:**
- `config` - Model configuration to add

**Throws:** `InvalidModelConfigError` if configuration is invalid

**Example:**
```typescript
const customModel: ModelConfig = {
  name: 'custom-embedding',
  version: '1.0.0',
  url: 'https://example.com/model.onnx',
  checksum: 'sha256-hash-here',
  size: 1024000,
  format: 'onnx',
  dimensions: 768,
  description: 'Custom embedding model',
  requirements: {
    memoryMB: 512,
    architecture: ['x64'],
    platforms: ['linux', 'windows', 'darwin']
  }
};

await registry.addModel(customModel);
```

## ModelDownloader

High-performance model downloading with streaming and retry logic.

### Constructor

```typescript
constructor(options?: DownloadOptions)
```

**Options:**
```typescript
interface DownloadOptions {
  /** Maximum retry attempts (default: 3) */
  retryAttempts?: number;
  
  /** Request timeout in milliseconds (default: 300000) */
  timeout?: number;
  
  /** Download chunk size in bytes (default: 1MB) */
  chunkSize?: number;
  
  /** Progress callback function */
  progressCallback?: (progress: ProgressInfo) => void;
  
  /** Bandwidth limit (e.g., '50MB/s') */
  bandwidthLimit?: string;
  
  /** Enable resume for partial downloads */
  enableResume?: boolean;
}

interface ProgressInfo {
  /** Percentage complete (0-100) */
  percentage: number;
  
  /** Download speed in MB/s */
  speed: number;
  
  /** Estimated time remaining in seconds */
  eta: number;
  
  /** Bytes downloaded */
  downloaded: number;
  
  /** Total bytes */
  total: number;
}
```

### Methods

#### downloadModel()

Download a model to the specified destination.

```typescript
async downloadModel(
  config: ModelConfig, 
  destination: string, 
  options?: DownloadOptions
): Promise<string>
```

**Parameters:**
- `config` - Model configuration
- `destination` - Download directory path
- `options` - Download options (optional)

**Returns:** Promise resolving to downloaded file path

**Throws:** `DownloadError` on failure

**Example:**
```typescript
const downloader = new ModelDownloader({
  retryAttempts: 5,
  progressCallback: (progress) => {
    console.log(`${progress.percentage}% - ${progress.speed} MB/s - ETA: ${progress.eta}s`);
  }
});

try {
  const filePath = await downloader.downloadModel(model, './downloads/');
  console.log(`Downloaded to: ${filePath}`);
} catch (error) {
  console.error('Download failed:', error.message);
}
```

#### resumeDownload()

Resume a partially downloaded model.

```typescript
async resumeDownload(filePath: string): Promise<string>
```

**Parameters:**
- `filePath` - Path to partial download

**Returns:** Promise resolving to completed file path

**Example:**
```typescript
// Resume interrupted download
const completedPath = await downloader.resumeDownload('./downloads/partial-model.onnx');
```

#### cancelDownload()

Cancel an active download.

```typescript
cancelDownload(downloadId: string): void
```

**Parameters:**
- `downloadId` - Unique download identifier

**Example:**
```typescript
// Start download and get ID
const downloadPromise = downloader.downloadModel(model, './downloads/');
const downloadId = downloader.getLastDownloadId();

// Cancel after 30 seconds
setTimeout(() => {
  downloader.cancelDownload(downloadId);
}, 30000);
```

## ModelCache

Intelligent caching system with automatic cleanup and metadata tracking.

### Constructor

```typescript
constructor(options: CacheOptions)
```

**Options:**
```typescript
interface CacheOptions {
  /** Cache directory path */
  cacheDir: string;
  
  /** Maximum cache size (e.g., '10GB') */
  maxSize?: string;
  
  /** Cleanup strategy */
  cleanupStrategy?: 'lru' | 'ttl' | 'size';
  
  /** Enable compression */
  compressionEnabled?: boolean;
  
  /** Maximum age in seconds (for TTL strategy) */
  maxAge?: number;
  
  /** Cleanup interval in seconds */
  cleanupInterval?: number;
}

interface CacheResult {
  /** Whether model was found in cache */
  hit: boolean;
  
  /** Path to cached file (if hit) */
  filePath?: string;
  
  /** Cache metadata */
  metadata?: ModelMetadata;
}

interface CacheStats {
  /** Total models in cache */
  modelCount: number;
  
  /** Used space in bytes */
  usedSpace: number;
  
  /** Total space limit in bytes */
  totalSpace: number;
  
  /** Cache hit rate percentage */
  hitRate: number;
  
  /** Most recently used models */
  recentModels: string[];
}
```

### Methods

#### initialize()

Initialize the cache system.

```typescript
async initialize(): Promise<void>
```

**Example:**
```typescript
const cache = new ModelCache({
  cacheDir: './models',
  maxSize: '5GB',
  cleanupStrategy: 'lru'
});

await cache.initialize();
```

#### checkCache()

Check if a model exists in cache.

```typescript
async checkCache(config: ModelConfig): Promise<CacheResult>
```

**Parameters:**
- `config` - Model configuration to check

**Returns:** Promise resolving to CacheResult

**Example:**
```typescript
const result = await cache.checkCache(model);
if (result.hit) {
  console.log(`Cache hit! File at: ${result.filePath}`);
  console.log(`Last verified: ${result.metadata.lastVerified}`);
} else {
  console.log('Cache miss, need to download');
}
```

#### storeModel()

Store a downloaded model in cache.

```typescript
async storeModel(config: ModelConfig, filePath: string): Promise<void>
```

**Parameters:**
- `config` - Model configuration
- `filePath` - Path to downloaded file

**Throws:** `CacheError` if storage fails

**Example:**
```typescript
// Download and cache
const filePath = await downloader.downloadModel(model, './downloads/');
await cache.storeModel(model, filePath);
console.log('Model cached successfully');
```

#### removeModel()

Remove a model from cache.

```typescript
async removeModel(name: string, version?: string): Promise<void>
```

**Parameters:**
- `name` - Model name
- `version` - Specific version (optional, removes all versions if omitted)

**Example:**
```typescript
// Remove specific version
await cache.removeModel('code-embedding-v1', '1.2.0');

// Remove all versions
await cache.removeModel('code-embedding-v1');
```

#### getStats()

Get cache statistics and metrics.

```typescript
async getStats(): Promise<CacheStats>
```

**Returns:** Promise resolving to CacheStats

**Example:**
```typescript
const stats = await cache.getStats();
console.log(`Cache: ${stats.modelCount} models, ${stats.usedSpace} bytes used`);
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Recent models: ${stats.recentModels.join(', ')}`);
```

#### cleanup()

Manually trigger cache cleanup.

```typescript
async cleanup(): Promise<void>
```

**Example:**
```typescript
// Force cleanup
await cache.cleanup();
```

## FileVerifier

Comprehensive file verification and security system.

### Constructor

```typescript
constructor(quarantineDir: string)
```

**Parameters:**
- `quarantineDir` - Directory for quarantined files

### Methods

#### verifyModelFile()

Verify a model file's integrity and security.

```typescript
async verifyModelFile(
  filePath: string, 
  config: ModelConfig, 
  options?: VerificationOptions
): Promise<VerificationResult>
```

**Options:**
```typescript
interface VerificationOptions {
  /** Skip checksum verification */
  skipChecksum?: boolean;
  
  /** Skip file format validation */
  skipFormatCheck?: boolean;
  
  /** Enable strict validation */
  strictValidation?: boolean;
  
  /** Custom validation rules */
  customRules?: ValidationRule[];
}

interface VerificationResult {
  /** Whether file is valid */
  valid: boolean;
  
  /** Verification errors */
  errors: string[];
  
  /** Verification warnings */
  warnings: string[];
  
  /** File was quarantined */
  quarantined: boolean;
  
  /** Quarantine path (if quarantined) */
  quarantinePath?: string;
}
```

**Example:**
```typescript
const verifier = new FileVerifier('./quarantine');

const result = await verifier.verifyModelFile(filePath, model, {
  strictValidation: true
});

if (result.valid) {
  console.log('File verification passed');
} else {
  console.error('Verification failed:', result.errors);
  if (result.quarantined) {
    console.log(`File quarantined to: ${result.quarantinePath}`);
  }
}
```

#### quarantineFile()

Manually quarantine a suspicious file.

```typescript
async quarantineFile(filePath: string, reason: string): Promise<string>
```

**Parameters:**
- `filePath` - Path to file to quarantine
- `reason` - Reason for quarantine

**Returns:** Promise resolving to quarantine path

**Example:**
```typescript
const quarantinePath = await verifier.quarantineFile(
  './suspicious-model.onnx',
  'manual_review_required'
);
console.log(`File quarantined to: ${quarantinePath}`);
```

## PerformanceOptimizer

Advanced performance optimization and resource management.

### Constructor

```typescript
constructor(options?: OptimizerOptions)
```

**Options:**
```typescript
interface OptimizerOptions {
  /** Maximum concurrent downloads */
  maxConcurrentDownloads?: number;
  
  /** Bandwidth limit (e.g., '100MB/s') */
  bandwidthLimit?: string;
  
  /** Memory limit (e.g., '2GB') */
  memoryLimit?: string;
  
  /** Enable compression */
  enableCompression?: boolean;
  
  /** Enable parallel chunk downloads */
  enableParallelChunks?: boolean;
}

interface OptimizationOptions {
  /** Enable parallel chunk downloads */
  enableParallelChunks?: boolean;
  
  /** Enable compression */
  enableCompression?: boolean;
  
  /** Download priority */
  priority?: 'low' | 'normal' | 'high';
  
  /** Custom chunk size */
  chunkSize?: number;
}

interface PerformanceMetrics {
  /** Average download speed in MB/s */
  averageSpeed: number;
  
  /** Total bandwidth used in bytes */
  totalBandwidth: number;
  
  /** Memory efficiency percentage */
  memoryEfficiency: number;
  
  /** Active downloads count */
  activeDownloads: number;
  
  /** Queue length */
  queueLength: number;
}
```

### Methods

#### optimizeDownload()

Download a model with performance optimizations.

```typescript
async optimizeDownload(
  config: ModelConfig, 
  options?: OptimizationOptions
): Promise<string>
```

**Parameters:**
- `config` - Model configuration
- `options` - Optimization options

**Returns:** Promise resolving to downloaded file path

**Example:**
```typescript
const optimizer = new PerformanceOptimizer({
  maxConcurrentDownloads: 4,
  bandwidthLimit: '100MB/s',
  enableCompression: true
});

const filePath = await optimizer.optimizeDownload(model, {
  enableParallelChunks: true,
  priority: 'high',
  chunkSize: 2 * 1024 * 1024 // 2MB chunks
});
```

#### getMetrics()

Get current performance metrics.

```typescript
getMetrics(): PerformanceMetrics
```

**Returns:** Current performance metrics

**Example:**
```typescript
const metrics = optimizer.getMetrics();
console.log(`Average speed: ${metrics.averageSpeed} MB/s`);
console.log(`Memory efficiency: ${metrics.memoryEfficiency}%`);
console.log(`Active downloads: ${metrics.activeDownloads}`);
```

## ErrorHandler

Comprehensive error handling and recovery system.

### Constructor

```typescript
constructor(options?: ErrorHandlerOptions)
```

**Options:**
```typescript
interface ErrorHandlerOptions {
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Enable fallback mechanisms */
  fallbackEnabled?: boolean;
  
  /** Enable degraded mode operation */
  degradedMode?: boolean;
  
  /** Logging level */
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

interface ErrorHandlerResult {
  /** Whether error was handled */
  handled: boolean;
  
  /** Whether operation should be retried */
  shouldRetry: boolean;
  
  /** Current retry count */
  retryCount: number;
  
  /** Delay before retry (milliseconds) */
  retryDelay: number;
  
  /** Fallback available */
  fallbackAvailable: boolean;
  
  /** Fallback model (if available) */
  fallbackModel?: ModelConfig;
}

interface ConnectivityInfo {
  /** Connection status */
  status: 'online' | 'offline' | 'limited';
  
  /** Network latency in milliseconds */
  latency?: number;
  
  /** Available bandwidth estimate */
  bandwidth?: string;
  
  /** Reachable endpoints */
  reachableEndpoints: string[];
}
```

### Methods

#### handleError()

Handle and classify errors with automatic recovery.

```typescript
async handleError(error: Error): Promise<ErrorHandlerResult>
```

**Parameters:**
- `error` - Error to handle

**Returns:** Promise resolving to ErrorHandlerResult

**Example:**
```typescript
const errorHandler = new ErrorHandler({
  maxRetries: 3,
  fallbackEnabled: true
});

try {
  await downloader.downloadModel(model, filePath);
} catch (error) {
  const result = await errorHandler.handleError(error);
  
  if (result.shouldRetry) {
    console.log(`Retrying in ${result.retryDelay}ms (attempt ${result.retryCount})`);
    await new Promise(resolve => setTimeout(resolve, result.retryDelay));
    // Retry logic here
  } else if (result.fallbackAvailable) {
    console.log('Using fallback model');
    await downloader.downloadModel(result.fallbackModel, filePath);
  } else {
    console.error('Operation failed permanently');
  }
}
```

#### checkConnectivity()

Check network connectivity status.

```typescript
async checkConnectivity(): Promise<ConnectivityInfo>
```

**Returns:** Promise resolving to ConnectivityInfo

**Example:**
```typescript
const connectivity = await errorHandler.checkConnectivity();
console.log(`Status: ${connectivity.status}`);
if (connectivity.latency) {
  console.log(`Latency: ${connectivity.latency}ms`);
}
if (connectivity.bandwidth) {
  console.log(`Bandwidth: ${connectivity.bandwidth}`);
}
```

## Error Types

### Custom Error Classes

```typescript
class ModelNotFoundError extends Error {
  constructor(modelName: string) {
    super(`Model not found: ${modelName}`);
    this.name = 'ModelNotFoundError';
  }
}

class DownloadError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'DownloadError';
  }
}

class VerificationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'VerificationError';
  }
}

class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}
```

## Utility Functions

### Helper Functions

```typescript
// Convert size strings to bytes
function parseSize(size: string): number;

// Format bytes to human-readable string
function formatBytes(bytes: number): string;

// Calculate file checksum
async function calculateChecksum(filePath: string): Promise<string>;

// Check disk space
async function checkDiskSpace(directory: string): Promise<{ free: number; total: number }>;

// Create directory recursively
async function ensureDirectory(path: string): Promise<void>;

// Get file stats
async function getFileStats(filePath: string): Promise<FileStats>;
```

**Example Usage:**
```typescript
import { parseSize, formatBytes, calculateChecksum } from '@ast-copilot-helper/ast-helper';

// Convert size
const bytes = parseSize('10GB'); // 10737418240

// Format size
const formatted = formatBytes(bytes); // "10 GB"

// Calculate checksum
const checksum = await calculateChecksum('./model.onnx');
console.log(`Checksum: ${checksum}`);
```

## TypeScript Types

Complete TypeScript definitions for all interfaces and types used in the model management system.

```typescript
// Re-export all types for convenience
export {
  ModelConfig,
  ModelMetadata,
  DownloadOptions,
  ProgressInfo,
  CacheOptions,
  CacheResult,
  CacheStats,
  VerificationOptions,
  VerificationResult,
  OptimizerOptions,
  OptimizationOptions,
  PerformanceMetrics,
  ErrorHandlerOptions,
  ErrorHandlerResult,
  ConnectivityInfo,
  // Error classes
  ModelNotFoundError,
  DownloadError,
  VerificationError,
  CacheError
} from './types.js';
```

---

*This API documentation is automatically generated from TypeScript source code and kept up to date with each release.*