# Model Management System

The AST Copilot Helper model management system provides comprehensive infrastructure for downloading, caching, verifying, and managing AI models with enterprise-grade reliability and performance.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Components](#core-components)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

```typescript
import { 
  ModelRegistry, 
  ModelDownloader, 
  ModelCache, 
  PerformanceOptimizer 
} from '@ast-copilot-helper/ast-helper';

// Initialize the model management system
const registry = ModelRegistry.getInstance();
const downloader = new ModelDownloader();
const cache = new ModelCache({
  cacheDir: './models',
  maxSize: '10GB'
});

// Download and cache a model
const model = await registry.getModel('code-embedding-v1');
const filePath = await downloader.downloadModel(model, './downloads/');
await cache.storeModel(model, filePath);

console.log('Model ready for use!');
```

## Core Components

### 1. Model Registry 🗂️

Central registry managing available models with automatic discovery and configuration.

```typescript
const registry = ModelRegistry.getInstance();
const availableModels = await registry.getAvailableModels();
const model = await registry.getModel('code-embedding-v1');
```

**Features:**
- ✅ Centralized model configuration
- ✅ Automatic model discovery
- ✅ Version management
- ✅ Platform compatibility checking

### 2. Model Downloader 📥

High-performance model download system with streaming, retry logic, and progress tracking.

```typescript
const downloader = new ModelDownloader({
  retryAttempts: 3,
  chunkSize: 1024 * 1024, // 1MB chunks
  progressCallback: (progress) => console.log(`${progress}% complete`)
});

const filePath = await downloader.downloadModel(model, './downloads/');
```

**Features:**
- ✅ HTTP streaming downloads
- ✅ Automatic retry with exponential backoff
- ✅ Real-time progress tracking
- ✅ Resume partial downloads
- ✅ Bandwidth throttling
- ✅ Integrity verification

### 3. Model Cache 🗃️

Intelligent caching system with size management, metadata tracking, and cleanup strategies.

```typescript
const cache = new ModelCache({
  cacheDir: './models',
  maxSize: '10GB',
  cleanupStrategy: 'lru',
  compressionEnabled: true
});

await cache.initialize();
const cacheHit = await cache.checkCache(model);
if (!cacheHit.hit) {
  await cache.storeModel(model, filePath);
}
```

**Features:**
- ✅ Automatic size management
- ✅ LRU and TTL cleanup strategies
- ✅ Compression support
- ✅ Metadata tracking
- ✅ Cache statistics
- ✅ Concurrent access safety

### 4. File Verification 🔐

Comprehensive security and integrity verification with quarantine system.

```typescript
const verifier = new FileVerifier('./quarantine');
const result = await verifier.verifyModelFile(filePath, model);

if (!result.valid) {
  console.error('Verification failed:', result.errors);
  // File automatically quarantined
}
```

**Features:**
- ✅ SHA256 checksum verification
- ✅ File format validation
- ✅ Size validation
- ✅ Automatic quarantine system
- ✅ Security threat detection
- ✅ Detailed error reporting

### 5. Performance Optimizer ⚡

Advanced performance optimization with parallel processing and resource management.

```typescript
const optimizer = new PerformanceOptimizer({
  maxConcurrentDownloads: 3,
  bandwidthLimit: '50MB/s',
  memoryLimit: '2GB'
});

const result = await optimizer.optimizeDownload(model, {
  enableParallelChunks: true,
  enableCompression: true
});
```

**Features:**
- ✅ Parallel chunk downloads
- ✅ Memory-efficient streaming
- ✅ Bandwidth throttling
- ✅ Resource monitoring
- ✅ Performance metrics
- ✅ Automatic optimization

### 6. Error Handling 🛡️

Robust error handling with classification, recovery, and graceful degradation.

```typescript
const errorHandler = new ErrorHandler({
  maxRetries: 3,
  fallbackEnabled: true,
  degradedMode: true
});

try {
  await downloader.downloadModel(model, filePath);
} catch (error) {
  const handled = await errorHandler.handleError(error);
  if (handled.shouldRetry) {
    // Automatic retry with backoff
  }
}
```

**Features:**
- ✅ Comprehensive error classification
- ✅ Automatic retry logic
- ✅ Fallback mechanisms
- ✅ Network connectivity monitoring
- ✅ Graceful degradation
- ✅ Detailed logging

## Configuration

### Environment Variables

```bash
# Cache configuration
AST_MODEL_CACHE_DIR=./models
AST_MODEL_CACHE_SIZE=10GB
AST_MODEL_CLEANUP_STRATEGY=lru

# Download configuration
AST_MODEL_DOWNLOAD_RETRIES=3
AST_MODEL_DOWNLOAD_TIMEOUT=300000
AST_MODEL_BANDWIDTH_LIMIT=50MB/s

# Performance configuration
AST_MODEL_MAX_CONCURRENT=3
AST_MODEL_MEMORY_LIMIT=2GB
AST_MODEL_ENABLE_COMPRESSION=true

# Security configuration
AST_MODEL_VERIFY_CHECKSUMS=true
AST_MODEL_QUARANTINE_DIR=./quarantine
AST_MODEL_STRICT_VALIDATION=false
```

### Configuration File

Create `models.config.json`:

```json
{
  "cache": {
    "directory": "./models",
    "maxSize": "10GB",
    "cleanupStrategy": "lru",
    "compressionEnabled": true
  },
  "downloads": {
    "retryAttempts": 3,
    "timeout": 300000,
    "chunkSize": 1048576,
    "bandwidthLimit": "50MB/s"
  },
  "performance": {
    "maxConcurrentDownloads": 3,
    "memoryLimit": "2GB",
    "enableParallelChunks": true
  },
  "security": {
    "verifyChecksums": true,
    "quarantineDirectory": "./quarantine",
    "strictValidation": false
  }
}
```

## Usage Examples

### Basic Model Download

```typescript
import { ModelRegistry, ModelDownloader } from '@ast-copilot-helper/ast-helper';

async function downloadModel() {
  const registry = ModelRegistry.getInstance();
  const downloader = new ModelDownloader();
  
  // Get model configuration
  const model = await registry.getModel('code-embedding-v1');
  
  // Download with progress tracking
  const filePath = await downloader.downloadModel(model, './downloads/', {
    onProgress: (progress) => {
      console.log(`Download progress: ${progress.percentage}%`);
      console.log(`Speed: ${progress.speed} MB/s`);
      console.log(`ETA: ${progress.eta} seconds`);
    }
  });
  
  console.log(`Model downloaded to: ${filePath}`);
}
```

### Advanced Caching Workflow

```typescript
import { ModelCache, ModelConfig } from '@ast-copilot-helper/ast-helper';

async function manageCachedModels() {
  const cache = new ModelCache({
    cacheDir: './models',
    maxSize: '5GB',
    cleanupStrategy: 'lru'
  });
  
  await cache.initialize();
  
  // Check if model is cached
  const model: ModelConfig = { /* model config */ };
  const cacheResult = await cache.checkCache(model);
  
  if (cacheResult.hit) {
    console.log(`Cache hit! Model at: ${cacheResult.filePath}`);
  } else {
    console.log('Cache miss, need to download');
    // Download and store
    const filePath = await downloadModel(model);
    await cache.storeModel(model, filePath);
  }
  
  // Get cache statistics
  const stats = await cache.getStats();
  console.log(`Cache usage: ${stats.usedSpace}/${stats.totalSpace}`);
  console.log(`Cache hit rate: ${stats.hitRate}%`);
}
```

### Performance Optimization

```typescript
import { PerformanceOptimizer } from '@ast-copilot-helper/ast-helper';

async function optimizedDownload() {
  const optimizer = new PerformanceOptimizer({
    maxConcurrentDownloads: 4,
    bandwidthLimit: '100MB/s',
    memoryLimit: '4GB'
  });
  
  // Optimize multiple downloads
  const models = await registry.getAvailableModels();
  const downloads = models.slice(0, 3).map(model => 
    optimizer.optimizeDownload(model, {
      enableParallelChunks: true,
      enableCompression: true,
      priority: 'high'
    })
  );
  
  const results = await Promise.all(downloads);
  
  // Get performance metrics
  const metrics = optimizer.getMetrics();
  console.log(`Average download speed: ${metrics.averageSpeed} MB/s`);
  console.log(`Total bandwidth used: ${metrics.totalBandwidth}`);
  console.log(`Memory efficiency: ${metrics.memoryEfficiency}%`);
}
```

### Error Handling and Recovery

```typescript
import { ErrorHandler, ModelDownloader } from '@ast-copilot-helper/ast-helper';

async function robustDownload(model: ModelConfig) {
  const errorHandler = new ErrorHandler({
    maxRetries: 5,
    fallbackEnabled: true
  });
  
  const downloader = new ModelDownloader();
  
  try {
    return await downloader.downloadModel(model, './downloads/');
  } catch (error) {
    const handled = await errorHandler.handleError(error);
    
    if (handled.shouldRetry) {
      console.log(`Retrying download... (attempt ${handled.retryCount})`);
      await new Promise(resolve => setTimeout(resolve, handled.retryDelay));
      return robustDownload(model); // Recursive retry
    }
    
    if (handled.fallbackAvailable) {
      console.log('Using fallback model');
      return await downloader.downloadModel(handled.fallbackModel, './downloads/');
    }
    
    throw new Error(`Download failed after ${handled.retryCount} attempts: ${error.message}`);
  }
}
```

### Batch Operations

```typescript
async function batchModelOperations() {
  const registry = ModelRegistry.getInstance();
  const cache = new ModelCache({ cacheDir: './models' });
  const optimizer = new PerformanceOptimizer();
  
  await cache.initialize();
  
  // Get all available models
  const models = await registry.getAvailableModels();
  
  // Filter models that need downloading
  const modelsToDownload = [];
  for (const model of models) {
    const cached = await cache.checkCache(model);
    if (!cached.hit) {
      modelsToDownload.push(model);
    }
  }
  
  console.log(`Downloading ${modelsToDownload.length} models...`);
  
  // Download with performance optimization
  const downloads = modelsToDownload.map(model => 
    optimizer.optimizeDownload(model)
  );
  
  const results = await Promise.allSettled(downloads);
  
  // Process results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`✅ ${modelsToDownload[index].name} downloaded successfully`);
    } else {
      console.error(`❌ ${modelsToDownload[index].name} failed: ${result.reason}`);
    }
  });
}
```

## API Reference

### ModelRegistry

Static registry for managing model configurations.

#### Methods

- `getInstance(): ModelRegistry` - Get singleton instance
- `getModel(name: string): Promise<ModelConfig>` - Get model by name
- `getAvailableModels(): Promise<ModelConfig[]>` - List all models
- `addModel(config: ModelConfig): Promise<void>` - Add custom model
- `removeModel(name: string): Promise<void>` - Remove model

### ModelDownloader

High-performance model downloader.

#### Constructor Options

```typescript
interface DownloadOptions {
  retryAttempts?: number;
  timeout?: number;
  chunkSize?: number;
  progressCallback?: (progress: ProgressInfo) => void;
  bandwidthLimit?: string;
}
```

#### Methods

- `downloadModel(config: ModelConfig, destination: string, options?: DownloadOptions): Promise<string>`
- `resumeDownload(filePath: string): Promise<string>`
- `cancelDownload(downloadId: string): void`

### ModelCache

Intelligent model caching system.

#### Constructor Options

```typescript
interface CacheOptions {
  cacheDir: string;
  maxSize?: string;
  cleanupStrategy?: 'lru' | 'ttl' | 'size';
  compressionEnabled?: boolean;
  maxAge?: number;
}
```

#### Methods

- `initialize(): Promise<void>`
- `checkCache(config: ModelConfig): Promise<CacheResult>`
- `storeModel(config: ModelConfig, filePath: string): Promise<void>`
- `removeModel(name: string, version?: string): Promise<void>`
- `getStats(): Promise<CacheStats>`
- `cleanup(): Promise<void>`

### FileVerifier

File integrity and security verification.

#### Constructor

```typescript
constructor(quarantineDir: string)
```

#### Methods

- `verifyModelFile(filePath: string, config: ModelConfig, options?: VerificationOptions): Promise<VerificationResult>`
- `quarantineFile(filePath: string, reason: string): Promise<string>`
- `getQuarantineInfo(): Promise<QuarantineInfo[]>`

### PerformanceOptimizer

Performance optimization and resource management.

#### Constructor Options

```typescript
interface OptimizerOptions {
  maxConcurrentDownloads?: number;
  bandwidthLimit?: string;
  memoryLimit?: string;
  enableCompression?: boolean;
}
```

#### Methods

- `optimizeDownload(config: ModelConfig, options?: OptimizationOptions): Promise<string>`
- `getMetrics(): PerformanceMetrics`
- `cleanup(): void`

### ErrorHandler

Comprehensive error handling and recovery.

#### Constructor Options

```typescript
interface ErrorHandlerOptions {
  maxRetries?: number;
  fallbackEnabled?: boolean;
  degradedMode?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}
```

#### Methods

- `handleError(error: Error): Promise<ErrorHandlerResult>`
- `checkConnectivity(): Promise<ConnectivityInfo>`
- `enableFallbackMode(): void`

## Performance Optimization

### Download Performance

1. **Parallel Chunks**: Enable parallel chunk downloads for large models
2. **Compression**: Use compression for bandwidth-limited scenarios
3. **Caching**: Implement aggressive caching strategies
4. **Memory Streaming**: Use memory-efficient streaming for large files

```typescript
const optimizer = new PerformanceOptimizer({
  maxConcurrentDownloads: 4,
  enableCompression: true,
  memoryLimit: '2GB'
});
```

### Memory Management

- Monitor memory usage during operations
- Use streaming for large file processing
- Implement proper cleanup procedures
- Configure memory limits appropriately

### Network Optimization

- Implement bandwidth throttling
- Use CDN endpoints when available
- Enable connection pooling
- Monitor network latency

## Error Handling

### Common Error Types

1. **Network Errors**: Connection timeouts, DNS failures
2. **Storage Errors**: Disk full, permission denied
3. **Verification Errors**: Checksum mismatches, corrupt files
4. **Configuration Errors**: Invalid model configs, missing dependencies

### Error Recovery Strategies

```typescript
// Automatic retry with exponential backoff
const errorHandler = new ErrorHandler({
  maxRetries: 3,
  fallbackEnabled: true
});

// Network connectivity monitoring
const connectivity = await errorHandler.checkConnectivity();
if (connectivity.status === 'offline') {
  // Handle offline scenario
}

// Graceful degradation
if (error.type === 'MODEL_UNAVAILABLE') {
  const fallback = await registry.getFallbackModel();
  // Use fallback model
}
```

## Troubleshooting

### Common Issues

#### Download Failures

**Problem**: Models fail to download consistently

**Solutions**:
1. Check network connectivity: `await errorHandler.checkConnectivity()`
2. Verify model URLs are accessible
3. Check disk space availability
4. Increase retry attempts in configuration

```typescript
const downloader = new ModelDownloader({
  retryAttempts: 5,
  timeout: 600000 // 10 minutes
});
```

#### Cache Issues

**Problem**: Cache not working correctly

**Solutions**:
1. Verify cache directory permissions
2. Check available disk space
3. Clear corrupted cache entries
4. Rebuild cache metadata

```typescript
// Clear cache
await cache.clear();

// Rebuild metadata
await cache.rebuildMetadata();
```

#### Performance Issues

**Problem**: Slow download speeds

**Solutions**:
1. Enable parallel downloads
2. Increase bandwidth limits
3. Use compression
4. Check network latency

```typescript
const optimizer = new PerformanceOptimizer({
  maxConcurrentDownloads: 6,
  bandwidthLimit: '100MB/s',
  enableCompression: true
});
```

#### Verification Failures

**Problem**: File verification keeps failing

**Solutions**:
1. Check checksum accuracy in model config
2. Verify download completeness
3. Check file corruption
4. Disable strict validation temporarily

```typescript
const verifier = new FileVerifier('./quarantine');
const result = await verifier.verifyModelFile(filePath, model, {
  skipChecksum: false,
  strictValidation: false
});
```

### Debug Logging

Enable detailed logging for troubleshooting:

```typescript
// Set environment variable
process.env.AST_MODEL_DEBUG = 'true';
process.env.AST_MODEL_LOG_LEVEL = 'debug';

// Or configure programmatically
const errorHandler = new ErrorHandler({
  logLevel: 'debug'
});
```

## Best Practices

### 1. Configuration Management

- Use environment variables for production
- Keep sensitive information secure
- Validate configuration on startup
- Provide sensible defaults

### 2. Error Handling

- Always implement retry logic
- Use graceful degradation
- Log errors appropriately
- Monitor error rates

### 3. Performance

- Enable caching for frequently used models
- Use performance optimization features
- Monitor resource usage
- Implement proper cleanup

### 4. Security

- Always verify model checksums
- Use quarantine for suspicious files
- Keep models up to date
- Monitor for security issues

### 5. Monitoring

- Track download success rates
- Monitor cache hit rates
- Log performance metrics
- Set up alerts for failures

### 6. Testing

- Test with different network conditions
- Validate error scenarios
- Performance test with large models
- Test concurrent operations

---

## Support

For issues, questions, or contributions, please visit our [GitHub repository](https://github.com/your-org/ast-copilot-helper) or contact the development team.

**Version**: 1.0.0  
**Last Updated**: December 2024  
**License**: MIT