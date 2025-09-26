# Model Management System - Usage Examples

Practical examples and code snippets for using the AST Copilot Helper model management system.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Advanced Scenarios](#advanced-scenarios)
3. [Error Handling](#error-handling)
4. [Performance Optimization](#performance-optimization)
5. [Production Patterns](#production-patterns)
6. [Testing and Debugging](#testing-and-debugging)

## Basic Usage

### Simple Model Download

```typescript
import { ModelRegistry, ModelDownloader } from "@ast-copilot-helper/ast-copilot-helper";

async function downloadBasicModel() {
  // Get model configuration
  const registry = ModelRegistry.getInstance();
  const model = await registry.getModel("code-embedding-v1");

  // Download model
  const downloader = new ModelDownloader();
  const filePath = await downloader.downloadModel(model, "./models/");

  console.log(`Model downloaded to: ${filePath}`);
  return filePath;
}

// Usage
downloadBasicModel()
  .then((path) => console.log("Success:", path))
  .catch((error) => console.error("Error:", error));
```

### Basic Caching

```typescript
import { ModelCache, ModelRegistry } from "@ast-copilot-helper/ast-copilot-helper";

async function basicCaching() {
  // Initialize cache
  const cache = new ModelCache({ cacheDir: "./cache" });
  await cache.initialize();

  const registry = ModelRegistry.getInstance();
  const model = await registry.getModel("code-embedding-v1");

  // Check cache first
  const cacheResult = await cache.checkCache(model);
  if (cacheResult.hit) {
    console.log("Using cached model:", cacheResult.filePath);
    return cacheResult.filePath;
  }

  // Download if not cached
  const downloader = new ModelDownloader();
  const filePath = await downloader.downloadModel(model, "./downloads/");

  // Store in cache
  await cache.storeModel(model, filePath);
  console.log("Model downloaded and cached");

  return filePath;
}
```

### Model Verification

```typescript
import { FileVerifier } from "@ast-copilot-helper/ast-copilot-helper";

async function verifyDownloadedModel(filePath: string, model: ModelConfig) {
  const verifier = new FileVerifier("./quarantine");

  const result = await verifier.verifyModelFile(filePath, model);

  if (result.valid) {
    console.log("✅ Model verification passed");
    return true;
  } else {
    console.error("❌ Model verification failed:");
    result.errors.forEach((error) => console.error(`  - ${error}`));

    if (result.quarantined) {
      console.log(`🛡️ File quarantined to: ${result.quarantinePath}`);
    }
    return false;
  }
}
```

## Advanced Scenarios

### Complete Workflow with All Components

```typescript
import {
  ModelRegistry,
  ModelDownloader,
  ModelCache,
  FileVerifier,
  ErrorHandler,
  PerformanceOptimizer,
} from "@ast-copilot-helper/ast-copilot-helper";

class ModelManager {
  private registry: ModelRegistry;
  private downloader: ModelDownloader;
  private cache: ModelCache;
  private verifier: FileVerifier;
  private errorHandler: ErrorHandler;
  private optimizer: PerformanceOptimizer;

  constructor() {
    this.registry = ModelRegistry.getInstance();
    this.downloader = new ModelDownloader({
      retryAttempts: 3,
      progressCallback: this.onDownloadProgress.bind(this),
    });
    this.cache = new ModelCache({
      cacheDir: "./models",
      maxSize: "10GB",
      cleanupStrategy: "lru",
    });
    this.verifier = new FileVerifier("./quarantine");
    this.errorHandler = new ErrorHandler({
      maxRetries: 3,
      fallbackEnabled: true,
    });
    this.optimizer = new PerformanceOptimizer({
      maxConcurrentDownloads: 3,
      bandwidthLimit: "50MB/s",
    });
  }

  async initialize() {
    await this.cache.initialize();
    console.log("Model manager initialized");
  }

  async getModel(modelName: string): Promise<string> {
    try {
      // 1. Get model configuration
      const model = await this.registry.getModel(modelName);
      console.log(`Getting model: ${model.name} v${model.version}`);

      // 2. Check cache first
      const cacheResult = await this.cache.checkCache(model);
      if (cacheResult.hit) {
        console.log("✅ Cache hit");
        // Re-verify cached file
        const isValid = await this.verifier.verifyModelFile(
          cacheResult.filePath!,
          model,
        );
        if (isValid.valid) {
          return cacheResult.filePath!;
        } else {
          console.log("⚠️ Cached file invalid, removing from cache");
          await this.cache.removeModel(model.name, model.version);
        }
      }

      // 3. Download with optimization
      console.log("📥 Downloading model...");
      const filePath = await this.optimizer.optimizeDownload(model, {
        enableParallelChunks: true,
        enableCompression: true,
        priority: "high",
      });

      // 4. Verify downloaded file
      console.log("🔍 Verifying model...");
      const verification = await this.verifier.verifyModelFile(filePath, model);
      if (!verification.valid) {
        throw new Error(
          `Model verification failed: ${verification.errors.join(", ")}`,
        );
      }

      // 5. Cache the verified model
      console.log("💾 Caching model...");
      await this.cache.storeModel(model, filePath);

      console.log("✅ Model ready");
      return filePath;
    } catch (error) {
      return this.handleModelError(error, modelName);
    }
  }

  private async handleModelError(
    error: Error,
    modelName: string,
  ): Promise<string> {
    const result = await this.errorHandler.handleError(error);

    if (result.shouldRetry) {
      console.log(`🔄 Retrying... (attempt ${result.retryCount})`);
      await new Promise((resolve) => setTimeout(resolve, result.retryDelay));
      return this.getModel(modelName);
    }

    if (result.fallbackAvailable && result.fallbackModel) {
      console.log("🔄 Using fallback model");
      return this.getModel(result.fallbackModel.name);
    }

    throw error;
  }

  private onDownloadProgress(progress: ProgressInfo) {
    const percent = Math.round(progress.percentage);
    const speed = progress.speed.toFixed(1);
    const eta = Math.round(progress.eta);

    console.log(`📥 ${percent}% - ${speed} MB/s - ETA: ${eta}s`);
  }

  async getStats() {
    const cacheStats = await this.cache.getStats();
    const performanceMetrics = this.optimizer.getMetrics();

    return {
      cache: cacheStats,
      performance: performanceMetrics,
    };
  }

  async cleanup() {
    await this.cache.cleanup();
    this.optimizer.cleanup();
    console.log("✅ Cleanup complete");
  }
}

// Usage
async function useModelManager() {
  const manager = new ModelManager();
  await manager.initialize();

  try {
    // Get a model (will download, verify, and cache)
    const modelPath = await manager.getModel("code-embedding-v1");
    console.log(`Model available at: ${modelPath}`);

    // Get statistics
    const stats = await manager.getStats();
    console.log("Cache stats:", stats.cache);
    console.log("Performance metrics:", stats.performance);
  } finally {
    await manager.cleanup();
  }
}
```

### Batch Model Operations

```typescript
async function batchDownloadModels(modelNames: string[]) {
  const registry = ModelRegistry.getInstance();
  const cache = new ModelCache({ cacheDir: "./models" });
  const optimizer = new PerformanceOptimizer({
    maxConcurrentDownloads: 3,
  });

  await cache.initialize();

  console.log(`📦 Processing ${modelNames.length} models...`);

  // Get all model configurations
  const models = await Promise.all(
    modelNames.map((name) => registry.getModel(name)),
  );

  // Filter out already cached models
  const uncachedModels = [];
  for (const model of models) {
    const cached = await cache.checkCache(model);
    if (!cached.hit) {
      uncachedModels.push(model);
    } else {
      console.log(`✅ ${model.name} already cached`);
    }
  }

  if (uncachedModels.length === 0) {
    console.log("🎉 All models already cached!");
    return;
  }

  console.log(`📥 Downloading ${uncachedModels.length} models...`);

  // Download with performance optimization
  const downloads = uncachedModels.map((model) =>
    optimizer
      .optimizeDownload(model, {
        enableParallelChunks: true,
        priority: "normal",
      })
      .then(async (filePath) => {
        // Cache after download
        await cache.storeModel(model, filePath);
        console.log(`✅ ${model.name} downloaded and cached`);
        return { model, filePath, success: true };
      })
      .catch((error) => {
        console.error(`❌ ${model.name} failed: ${error.message}`);
        return { model, error, success: false };
      }),
  );

  const results = await Promise.all(downloads);

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n📊 Batch download complete:`);
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);

  return results;
}

// Usage
batchDownloadModels([
  "code-embedding-v1",
  "text-embedding-v2",
  "classification-model-v1",
]);
```

### Custom Model Configuration

```typescript
async function addCustomModel() {
  const registry = ModelRegistry.getInstance();

  // Define custom model
  const customModel: ModelConfig = {
    name: "my-custom-embedding",
    version: "1.0.0",
    url: "https://my-cdn.example.com/models/embedding-v1.onnx",
    checksum:
      "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    size: 256 * 1024 * 1024, // 256MB
    format: "onnx",
    dimensions: 512,
    description: "Custom text embedding model trained on domain-specific data",
    requirements: {
      memoryMB: 1024,
      architecture: ["x64", "arm64"],
      platforms: ["linux", "windows", "darwin"],
    },
    metadata: {
      author: "My Team",
      license: "MIT",
      tags: ["text", "embedding", "custom"],
      performance: {
        latency: 50, // ms
        throughput: 1000, // tokens/sec
      },
    },
  };

  // Add to registry
  await registry.addModel(customModel);
  console.log("✅ Custom model added to registry");

  // Now use it like any other model
  const modelManager = new ModelManager();
  await modelManager.initialize();

  const filePath = await modelManager.getModel("my-custom-embedding");
  console.log(`Custom model ready: ${filePath}`);
}
```

## Error Handling

### Comprehensive Error Recovery

```typescript
import { ErrorHandler, ConnectivityInfo } from "@ast-copilot-helper/ast-copilot-helper";

async function robustModelDownload(modelName: string): Promise<string> {
  const errorHandler = new ErrorHandler({
    maxRetries: 5,
    fallbackEnabled: true,
    degradedMode: true,
  });

  const registry = ModelRegistry.getInstance();
  const downloader = new ModelDownloader();

  async function attemptDownload(
    modelName: string,
    attempt: number = 1,
  ): Promise<string> {
    try {
      console.log(`🔄 Attempt ${attempt}: ${modelName}`);

      // Check connectivity first
      const connectivity = await errorHandler.checkConnectivity();
      console.log(`📡 Network status: ${connectivity.status}`);

      if (connectivity.status === "offline") {
        throw new Error("No network connectivity");
      }

      const model = await registry.getModel(modelName);
      return await downloader.downloadModel(model, "./downloads/");
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      const handled = await errorHandler.handleError(error);

      if (handled.shouldRetry && attempt < 5) {
        console.log(`⏳ Waiting ${handled.retryDelay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, handled.retryDelay));
        return attemptDownload(modelName, attempt + 1);
      }

      if (handled.fallbackAvailable && handled.fallbackModel) {
        console.log(`🔄 Trying fallback: ${handled.fallbackModel.name}`);
        return attemptDownload(handled.fallbackModel.name, 1);
      }

      throw new Error(
        `Download failed permanently after ${attempt} attempts: ${error.message}`,
      );
    }
  }

  return attemptDownload(modelName);
}

// Usage with comprehensive error handling
async function safeModelOperation() {
  try {
    const modelPath = await robustModelDownload("code-embedding-v1");
    console.log("✅ Success:", modelPath);
  } catch (error) {
    console.error("💥 Final error:", error.message);

    // Implement graceful degradation
    console.log("🔧 Falling back to local processing...");
    // Use local fallback logic here
  }
}
```

### Network-Aware Operations

```typescript
async function networkAwareDownload(modelName: string) {
  const errorHandler = new ErrorHandler();
  const connectivity = await errorHandler.checkConnectivity();

  console.log(`📡 Network Status: ${connectivity.status}`);
  if (connectivity.latency) {
    console.log(`📡 Latency: ${connectivity.latency}ms`);
  }
  if (connectivity.bandwidth) {
    console.log(`📡 Bandwidth: ${connectivity.bandwidth}`);
  }

  // Adjust download strategy based on network
  const optimizerOptions = {
    maxConcurrentDownloads: 1,
    enableCompression: true,
    enableParallelChunks: false,
  };

  if (connectivity.status === "online" && connectivity.latency! < 100) {
    // Good connection - use aggressive settings
    optimizerOptions.maxConcurrentDownloads = 4;
    optimizerOptions.enableParallelChunks = true;
  } else if (connectivity.status === "limited") {
    // Poor connection - conservative settings
    optimizerOptions.enableCompression = true;
    optimizerOptions.maxConcurrentDownloads = 1;
  } else if (connectivity.status === "offline") {
    throw new Error("Cannot download in offline mode");
  }

  console.log("📥 Optimizing for network conditions...");
  const optimizer = new PerformanceOptimizer(optimizerOptions);

  const registry = ModelRegistry.getInstance();
  const model = await registry.getModel(modelName);

  return optimizer.optimizeDownload(model);
}
```

## Performance Optimization

### High-Performance Bulk Operations

```typescript
async function highPerformanceBulkDownload(modelNames: string[]) {
  const optimizer = new PerformanceOptimizer({
    maxConcurrentDownloads: 6,
    bandwidthLimit: "100MB/s",
    memoryLimit: "4GB",
    enableCompression: true,
  });

  const registry = ModelRegistry.getInstance();
  const cache = new ModelCache({
    cacheDir: "./models",
    maxSize: "50GB",
    cleanupStrategy: "lru",
  });

  await cache.initialize();

  console.log(`🚀 High-performance download of ${modelNames.length} models`);

  // Group models by size for optimal batching
  const models = await Promise.all(
    modelNames.map((name) => registry.getModel(name)),
  );

  const modelsBySize = {
    small: models.filter((m) => m.size < 100 * 1024 * 1024), // < 100MB
    medium: models.filter(
      (m) => m.size >= 100 * 1024 * 1024 && m.size < 1024 * 1024 * 1024,
    ), // 100MB - 1GB
    large: models.filter((m) => m.size >= 1024 * 1024 * 1024), // > 1GB
  };

  console.log(`📊 Model distribution:`);
  console.log(`  Small (< 100MB): ${modelsBySize.small.length}`);
  console.log(`  Medium (100MB-1GB): ${modelsBySize.medium.length}`);
  console.log(`  Large (> 1GB): ${modelsBySize.large.length}`);

  // Download small models in parallel (higher concurrency)
  const smallDownloads = modelsBySize.small.map((model) =>
    optimizer.optimizeDownload(model, {
      enableParallelChunks: false, // Not worth it for small files
      priority: "high",
    }),
  );

  // Download medium models with parallel chunks
  const mediumDownloads = modelsBySize.medium.map((model) =>
    optimizer.optimizeDownload(model, {
      enableParallelChunks: true,
      priority: "normal",
      chunkSize: 2 * 1024 * 1024, // 2MB chunks
    }),
  );

  // Download large models with maximum optimization
  const largeDownloads = modelsBySize.large.map((model) =>
    optimizer.optimizeDownload(model, {
      enableParallelChunks: true,
      priority: "normal",
      chunkSize: 10 * 1024 * 1024, // 10MB chunks
    }),
  );

  // Execute downloads in phases
  console.log("📥 Phase 1: Small models...");
  const smallResults = await Promise.allSettled(smallDownloads);

  console.log("📥 Phase 2: Medium models...");
  const mediumResults = await Promise.allSettled(mediumDownloads);

  console.log("📥 Phase 3: Large models...");
  const largeResults = await Promise.allSettled(largeDownloads);

  // Cache all successful downloads
  const allResults = [...smallResults, ...mediumResults, ...largeResults];
  const allModels = [
    ...modelsBySize.small,
    ...modelsBySize.medium,
    ...modelsBySize.large,
  ];

  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i];
    const model = allModels[i];

    if (result.status === "fulfilled") {
      await cache.storeModel(model, result.value);
      console.log(`✅ ${model.name} cached`);
    } else {
      console.error(`❌ ${model.name} failed: ${result.reason}`);
    }
  }

  // Performance summary
  const metrics = optimizer.getMetrics();
  console.log(`\n📊 Performance Summary:`);
  console.log(`  Average Speed: ${metrics.averageSpeed} MB/s`);
  console.log(`  Total Bandwidth: ${formatBytes(metrics.totalBandwidth)}`);
  console.log(`  Memory Efficiency: ${metrics.memoryEfficiency}%`);

  optimizer.cleanup();
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
```

### Memory-Efficient Streaming

```typescript
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";

async function memoryEfficientProcessing(modelPath: string) {
  console.log("🔄 Processing large model with streaming...");

  // Create streaming pipeline for memory-efficient processing
  const readStream = createReadStream(modelPath, {
    highWaterMark: 64 * 1024, // 64KB buffer
  });

  const processStream = new Transform({
    objectMode: false,
    transform(chunk, encoding, callback) {
      // Process chunk without loading entire file into memory
      const processedChunk = this.processChunk(chunk);
      callback(null, processedChunk);
    },

    processChunk(chunk: Buffer): Buffer {
      // Your processing logic here
      return chunk;
    },
  });

  const writeStream = createWriteStream(modelPath + ".processed");

  // Stream processing with automatic backpressure handling
  await pipeline(readStream, processStream, writeStream);

  console.log("✅ Streaming processing complete");
}
```

## Production Patterns

### Singleton Model Manager

```typescript
class SingletonModelManager {
  private static instance: SingletonModelManager;
  private initialized = false;
  private modelCache = new Map<string, string>();

  private constructor() {}

  static getInstance(): SingletonModelManager {
    if (!SingletonModelManager.instance) {
      SingletonModelManager.instance = new SingletonModelManager();
    }
    return SingletonModelManager.instance;
  }

  async initialize() {
    if (this.initialized) return;

    // Initialize all components
    this.cache = new ModelCache({
      cacheDir: process.env.MODEL_CACHE_DIR || "./models",
      maxSize: process.env.MODEL_CACHE_SIZE || "10GB",
    });

    await this.cache.initialize();
    this.initialized = true;
    console.log("✅ Model manager initialized");
  }

  async getModel(name: string): Promise<string> {
    if (!this.initialized) {
      throw new Error("Model manager not initialized");
    }

    // Check in-memory cache first
    if (this.modelCache.has(name)) {
      return this.modelCache.get(name)!;
    }

    // Full model acquisition logic
    const filePath = await this.acquireModel(name);

    // Cache in memory for future requests
    this.modelCache.set(name, filePath);
    return filePath;
  }

  private async acquireModel(name: string): Promise<string> {
    // Full model acquisition logic here
    // (similar to previous examples)
    return "./path/to/model";
  }

  async warmUp(modelNames: string[]) {
    console.log(`🔥 Warming up ${modelNames.length} models...`);
    await Promise.all(modelNames.map((name) => this.getModel(name)));
    console.log("✅ Warm-up complete");
  }
}

// Usage in production
const modelManager = SingletonModelManager.getInstance();
await modelManager.initialize();

// Warm up critical models at startup
await modelManager.warmUp(["code-embedding-v1", "text-classification-v2"]);
```

### Health Monitoring

```typescript
class ModelHealthMonitor {
  private healthChecks = new Map<string, Date>();
  private readonly healthCheckInterval = 5 * 60 * 1000; // 5 minutes

  async startMonitoring(modelPaths: string[]) {
    console.log("🏥 Starting health monitoring...");

    setInterval(async () => {
      for (const modelPath of modelPaths) {
        await this.checkModelHealth(modelPath);
      }
    }, this.healthCheckInterval);
  }

  private async checkModelHealth(modelPath: string) {
    try {
      const stats = await fs.stat(modelPath);
      const lastCheck = this.healthChecks.get(modelPath);

      // Check if file was modified (potential corruption)
      if (lastCheck && stats.mtime > lastCheck) {
        console.warn(`⚠️ Model file modified: ${modelPath}`);
        await this.handleModifiedModel(modelPath);
      }

      // Verify file integrity
      const verifier = new FileVerifier("./quarantine");
      // Note: This requires model config - implement based on your needs

      this.healthChecks.set(modelPath, new Date());
    } catch (error) {
      console.error(`❌ Health check failed for ${modelPath}:`, error);
      await this.handleUnhealthyModel(modelPath);
    }
  }

  private async handleModifiedModel(modelPath: string) {
    // Re-verify and potentially re-download
    console.log(`🔄 Re-verifying modified model: ${modelPath}`);
  }

  private async handleUnhealthyModel(modelPath: string) {
    // Quarantine and trigger re-download
    console.log(`🚨 Quarantining unhealthy model: ${modelPath}`);
  }
}
```

## Testing and Debugging

### Mock Model for Testing

```typescript
// Create mock model for testing
function createMockModel(name: string = "test-model"): ModelConfig {
  return {
    name,
    version: "1.0.0-test",
    url: `https://test.example.com/${name}.onnx`,
    checksum: "mock-checksum-for-testing",
    size: 1024 * 1024, // 1MB
    format: "onnx",
    dimensions: 768,
    description: `Mock model for testing: ${name}`,
    requirements: {
      memoryMB: 512,
      architecture: ["x64"],
      platforms: ["linux", "windows", "darwin"],
    },
  };
}

// Mock downloader for testing
class MockModelDownloader extends ModelDownloader {
  async downloadModel(
    config: ModelConfig,
    destination: string,
  ): Promise<string> {
    console.log(`Mock downloading: ${config.name}`);

    // Simulate download delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create mock file
    const filePath = join(destination, `${config.name}.onnx`);
    await fs.writeFile(filePath, "mock model content");

    return filePath;
  }
}
```

### Debug Utilities

```typescript
class ModelDebugger {
  static async debugModelPath(modelName: string) {
    console.log(`🐛 Debugging model path for: ${modelName}`);

    const registry = ModelRegistry.getInstance();
    const cache = new ModelCache({ cacheDir: "./models" });
    await cache.initialize();

    try {
      // Check registry
      const model = await registry.getModel(modelName);
      console.log("✅ Model found in registry:", {
        name: model.name,
        version: model.version,
        size: formatBytes(model.size),
        url: model.url,
      });

      // Check cache
      const cacheResult = await cache.checkCache(model);
      console.log("📁 Cache status:", {
        hit: cacheResult.hit,
        path: cacheResult.filePath,
        metadata: cacheResult.metadata
          ? {
              downloadedAt: cacheResult.metadata.downloadedAt,
              verified: cacheResult.metadata.verified,
            }
          : null,
      });

      // Check file system
      if (cacheResult.filePath) {
        const exists = await fs
          .access(cacheResult.filePath)
          .then(() => true)
          .catch(() => false);
        console.log("💾 File exists:", exists);

        if (exists) {
          const stats = await fs.stat(cacheResult.filePath);
          console.log("📊 File stats:", {
            size: formatBytes(stats.size),
            modified: stats.mtime,
            permissions: stats.mode,
          });
        }
      }
    } catch (error) {
      console.error("❌ Debug failed:", error.message);
    }
  }

  static async debugCacheState() {
    const cache = new ModelCache({ cacheDir: "./models" });
    await cache.initialize();

    const stats = await cache.getStats();
    console.log("🗂️ Cache Debug Info:", {
      modelCount: stats.modelCount,
      usedSpace: formatBytes(stats.usedSpace),
      totalSpace: formatBytes(stats.totalSpace),
      hitRate: `${stats.hitRate}%`,
      recentModels: stats.recentModels,
    });
  }
}

// Usage
await ModelDebugger.debugModelPath("code-embedding-v1");
await ModelDebugger.debugCacheState();
```

### Performance Testing

```typescript
async function performanceTest() {
  console.log("🏁 Starting performance test...");

  const iterations = 10;
  const modelName = "code-embedding-v1";
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();

    const manager = new ModelManager();
    await manager.initialize();

    try {
      await manager.getModel(modelName);
      const end = Date.now();
      times.push(end - start);
      console.log(`🔄 Iteration ${i + 1}: ${end - start}ms`);
    } finally {
      await manager.cleanup();
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log(`📊 Performance Results:`);
  console.log(`  Average: ${avgTime}ms`);
  console.log(`  Minimum: ${minTime}ms`);
  console.log(`  Maximum: ${maxTime}ms`);
  console.log(
    `  Std Dev: ${Math.sqrt(times.reduce((sq, n) => sq + Math.pow(n - avgTime, 2), 0) / times.length)}ms`,
  );
}
```

---

These examples demonstrate real-world usage patterns and best practices for the model management system. Copy and adapt them for your specific use cases!
