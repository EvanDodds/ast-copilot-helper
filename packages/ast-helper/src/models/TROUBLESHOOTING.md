# Model Management Troubleshooting Guide

Comprehensive troubleshooting guide for the AST Copilot Helper model management system.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Error Messages](#error-messages)
3. [Performance Issues](#performance-issues)
4. [Configuration Problems](#configuration-problems)
5. [Network Issues](#network-issues)
6. [File System Issues](#file-system-issues)
7. [Debug Tools](#debug-tools)
8. [FAQ](#faq)

## Common Issues

### Model Download Failures

#### Problem: Downloads consistently fail or timeout

**Symptoms:**
- `DownloadError: Request timeout` 
- `Network error: ECONNRESET`
- Downloads hang indefinitely

**Diagnosis:**
```typescript
import { ErrorHandler } from '@ast-copilot-helper/ast-helper';

const errorHandler = new ErrorHandler();
const connectivity = await errorHandler.checkConnectivity();
console.log('Network status:', connectivity);
```

**Solutions:**

1. **Increase timeout values**
```typescript
const downloader = new ModelDownloader({
  timeout: 600000, // 10 minutes
  retryAttempts: 5
});
```

2. **Check firewall/proxy settings**
```bash
# Test direct connectivity
curl -I https://huggingface.co/models/model-name/resolve/main/model.onnx

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

3. **Use bandwidth limiting for unstable connections**
```typescript
const optimizer = new PerformanceOptimizer({
  bandwidthLimit: '10MB/s', // Conservative limit
  maxConcurrentDownloads: 1
});
```

4. **Enable resume functionality**
```typescript
// Resume interrupted download
const filePath = await downloader.resumeDownload('./partial-model.onnx');
```

### Cache Issues

#### Problem: Models not found in cache despite being downloaded

**Symptoms:**
- `Cache miss` for recently downloaded models
- `CacheError: Metadata corruption`
- Cache statistics show incorrect values

**Diagnosis:**
```typescript
import { ModelCache } from '@ast-copilot-helper/ast-helper';

const cache = new ModelCache({ cacheDir: './models' });
await cache.initialize();

// Check cache integrity
const stats = await cache.getStats();
console.log('Cache stats:', stats);

// Verify specific model
const result = await cache.checkCache(modelConfig);
console.log('Cache check result:', result);
```

**Solutions:**

1. **Clear corrupted cache**
```typescript
// Clear all cache data
await cache.clear();
await cache.initialize();
```

2. **Rebuild cache metadata**
```typescript
// Rebuild from existing files
await cache.rebuildMetadata();
```

3. **Check directory permissions**
```bash
# Linux/Mac
ls -la ./models/
chmod 755 ./models/

# Windows
icacls ./models /grant Users:F
```

4. **Increase cache size limits**
```typescript
const cache = new ModelCache({
  cacheDir: './models',
  maxSize: '20GB', // Increase limit
  cleanupStrategy: 'lru'
});
```

### Verification Failures

#### Problem: Model verification consistently fails

**Symptoms:**
- `VerificationError: Checksum mismatch`
- `File quarantined: checksum_mismatch`
- Models work but fail verification

**Diagnosis:**
```typescript
import { FileVerifier } from '@ast-copilot-helper/ast-helper';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

// Calculate actual checksum
const fileContent = await readFile(filePath);
const actualChecksum = createHash('sha256').update(fileContent).digest('hex');
const expectedChecksum = modelConfig.checksum;

console.log('Expected:', expectedChecksum);
console.log('Actual:  ', actualChecksum);
console.log('Match:   ', actualChecksum === expectedChecksum);
```

**Solutions:**

1. **Update model configuration with correct checksum**
```typescript
// Calculate and update checksum
const actualChecksum = await calculateChecksum(filePath);
const updatedConfig = { ...modelConfig, checksum: actualChecksum };
await registry.updateModel(updatedConfig);
```

2. **Temporarily disable verification for debugging**
```typescript
const result = await verifier.verifyModelFile(filePath, modelConfig, {
  skipChecksum: true,
  skipFormatCheck: true
});
```

3. **Check for file corruption during download**
```typescript
// Re-download and verify
await fs.unlink(filePath); // Delete corrupted file
const newPath = await downloader.downloadModel(modelConfig, downloadDir);
```

### Performance Issues

#### Problem: Slow download speeds

**Symptoms:**
- Downloads much slower than expected
- High memory usage during downloads
- System becomes unresponsive

**Diagnosis:**
```typescript
const optimizer = new PerformanceOptimizer();

// Monitor performance
const metrics = optimizer.getMetrics();
console.log('Performance metrics:', metrics);

// Check system resources
const memUsage = process.memoryUsage();
console.log('Memory usage:', {
  used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
  total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
});
```

**Solutions:**

1. **Optimize concurrent downloads**
```typescript
// Conservative settings for resource-constrained systems
const optimizer = new PerformanceOptimizer({
  maxConcurrentDownloads: 2,
  memoryLimit: '1GB',
  enableCompression: true
});
```

2. **Use smaller chunk sizes**
```typescript
const downloader = new ModelDownloader({
  chunkSize: 512 * 1024, // 512KB chunks instead of 1MB
});
```

3. **Enable memory-efficient streaming**
```typescript
// Force streaming mode for large files
const options = {
  forceStreaming: true,
  memoryThreshold: 100 * 1024 * 1024 // 100MB
};
```

## Error Messages

### DownloadError: Request timeout

**Cause:** Network request exceeded timeout limit

**Solution:**
```typescript
const downloader = new ModelDownloader({
  timeout: 900000, // 15 minutes
  retryAttempts: 3
});
```

### CacheError: Disk space insufficient

**Cause:** Not enough disk space for cache operations

**Solution:**
```bash
# Check disk space
df -h ./models/

# Clean cache manually
rm -rf ./models/old-models/

# Or use automatic cleanup
```

```typescript
const cache = new ModelCache({
  cacheDir: './models',
  maxSize: '5GB', // Reduce cache size
  cleanupStrategy: 'lru'
});

// Force cleanup
await cache.cleanup();
```

### ModelNotFoundError: Model 'xyz' not found

**Cause:** Model not registered in the model registry

**Solution:**
```typescript
// List available models
const registry = ModelRegistry.getInstance();
const available = await registry.getAvailableModels();
console.log('Available models:', available.map(m => m.name));

// Add custom model
await registry.addModel(customModelConfig);
```

### VerificationError: File format not supported

**Cause:** Model file format not recognized or corrupted

**Solution:**
```typescript
// Check file type
import { readFile } from 'fs/promises';

const header = await readFile(filePath, { encoding: null, length: 100 });
console.log('File header:', header.toString('hex'));

// Skip format check if necessary
const result = await verifier.verifyModelFile(filePath, config, {
  skipFormatCheck: true
});
```

### EACCES: permission denied

**Cause:** Insufficient file system permissions

**Solution:**
```bash
# Linux/Mac
sudo chown -R $USER:$USER ./models/
chmod -R 755 ./models/

# Windows (run as administrator)
takeown /f "./models" /r /d y
icacls "./models" /grant Users:F /t
```

### ENOSPC: no space left on device

**Cause:** Disk full

**Solution:**
```bash
# Check disk usage
du -sh ./models/
df -h

# Clean up space
rm -rf ./models/temp/
rm -rf ./quarantine/old-files/
```

## Performance Issues

### Memory Leaks

**Symptoms:**
- Memory usage continuously increases
- Application crashes with out-of-memory errors
- System becomes slow over time

**Diagnosis:**
```typescript
// Monitor memory usage
function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB'
  });
}

// Log every 30 seconds
setInterval(logMemoryUsage, 30000);
```

**Solutions:**
1. **Proper cleanup after operations**
```typescript
const manager = new ModelManager();
try {
  await manager.getModel('large-model');
} finally {
  await manager.cleanup(); // Always cleanup
}
```

2. **Use streaming for large files**
```typescript
const downloader = new ModelDownloader({
  forceStreaming: true,
  maxMemoryBuffer: 50 * 1024 * 1024 // 50MB max buffer
});
```

3. **Implement garbage collection hints**
```typescript
// Force garbage collection periodically
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 60000); // Every minute
}
```

### Slow Cache Lookups

**Symptoms:**
- Cache checks take several seconds
- Application freezes during cache operations

**Solutions:**
```typescript
// Optimize cache with indexing
const cache = new ModelCache({
  cacheDir: './models',
  enableIndexing: true, // Enable metadata indexing
  indexingInterval: 300000 // 5 minutes
});

// Use cache warming
await cache.warmUp(['frequently-used-model']);
```

### High CPU Usage

**Symptoms:**
- CPU usage spikes during downloads
- System becomes unresponsive

**Solutions:**
```typescript
// Limit CPU-intensive operations
const optimizer = new PerformanceOptimizer({
  maxConcurrentDownloads: Math.min(2, os.cpus().length),
  enableCompression: false, // Disable if CPU-bound
  cpuThrottling: true
});
```

## Configuration Problems

### Invalid Model URLs

**Symptoms:**
- `HTTP 404` errors during downloads
- `DNS resolution failed` errors

**Solutions:**
```typescript
// Validate URLs before using
async function validateModelUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// Check all model URLs
const registry = ModelRegistry.getInstance();
const models = await registry.getAvailableModels();

for (const model of models) {
  const isValid = await validateModelUrl(model.url);
  if (!isValid) {
    console.warn(`⚠️ Invalid URL for ${model.name}: ${model.url}`);
  }
}
```

### Environment Variable Issues

**Common variables:**
```bash
# Check current settings
printenv | grep AST_MODEL

# Required variables
export AST_MODEL_CACHE_DIR=/path/to/cache
export AST_MODEL_CACHE_SIZE=10GB
export AST_MODEL_DOWNLOAD_RETRIES=3

# Optional performance settings
export AST_MODEL_MAX_CONCURRENT=3
export AST_MODEL_BANDWIDTH_LIMIT=50MB/s
```

### Configuration File Problems

**Invalid JSON syntax:**
```bash
# Validate JSON configuration
node -e "console.log(JSON.parse(require('fs').readFileSync('models.config.json')))"
```

**Missing required fields:**
```typescript
// Validate configuration
function validateConfig(config: any): string[] {
  const errors: string[] = [];
  
  if (!config.cache?.directory) {
    errors.push('cache.directory is required');
  }
  
  if (!config.downloads?.retryAttempts || config.downloads.retryAttempts < 1) {
    errors.push('downloads.retryAttempts must be >= 1');
  }
  
  return errors;
}
```

## Network Issues

### Proxy Configuration

**Corporate proxy settings:**
```typescript
// Configure proxy
const downloader = new ModelDownloader({
  proxy: {
    host: 'proxy.company.com',
    port: 8080,
    auth: {
      username: 'user',
      password: 'pass'
    }
  }
});
```

**Environment proxy:**
```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=https://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1
```

### DNS Resolution Issues

**Symptoms:**
- `ENOTFOUND` errors
- Intermittent connection failures

**Solutions:**
```typescript
// Use alternative DNS
const downloader = new ModelDownloader({
  dnsServers: ['8.8.8.8', '1.1.1.1'], // Google, Cloudflare DNS
  dnsTimeout: 5000
});
```

### SSL/TLS Issues

**Certificate problems:**
```typescript
// For development only - disable SSL verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Production - add custom CA
const downloader = new ModelDownloader({
  tlsOptions: {
    ca: fs.readFileSync('custom-ca.pem'),
    rejectUnauthorized: true
  }
});
```

## File System Issues

### Permission Errors

**Linux/Mac permissions:**
```bash
# Fix ownership
sudo chown -R $(whoami):$(whoami) ./models/

# Fix permissions
find ./models -type d -exec chmod 755 {} \;
find ./models -type f -exec chmod 644 {} \;
```

**Windows permissions:**
```cmd
# Run as administrator
takeown /f ".\models" /r /d y
icacls ".\models" /grant %username%:F /t
```

### Disk Space Management

**Monitor disk usage:**
```typescript
import { statfs } from 'fs';

function checkDiskSpace(path: string): Promise<{free: number, total: number}> {
  return new Promise((resolve, reject) => {
    statfs(path, (err, stats) => {
      if (err) reject(err);
      else resolve({
        free: stats.bavail * stats.bsize,
        total: stats.blocks * stats.bsize
      });
    });
  });
}

// Check before downloading
const diskSpace = await checkDiskSpace('./models');
const modelSize = modelConfig.size;

if (diskSpace.free < modelSize * 1.1) { // 10% buffer
  throw new Error('Insufficient disk space');
}
```

### Path Length Issues (Windows)

**Windows path length limit:**
```typescript
import { resolve } from 'path';

function validatePathLength(filePath: string): boolean {
  const fullPath = resolve(filePath);
  const maxLength = process.platform === 'win32' ? 260 : 4096;
  
  if (fullPath.length > maxLength) {
    console.warn(`Path too long: ${fullPath.length} > ${maxLength}`);
    return false;
  }
  
  return true;
}

// Use shorter paths on Windows
const shortCacheDir = process.platform === 'win32' ? './m' : './models';
```

## Debug Tools

### Enable Debug Logging

**Environment variables:**
```bash
export DEBUG=ast-helper:*
export AST_MODEL_DEBUG=true
export AST_MODEL_LOG_LEVEL=debug
```

**Programmatic logging:**
```typescript
import { Logger } from '@ast-copilot-helper/ast-helper';

const logger = new Logger({
  level: 'debug',
  timestamp: true,
  colors: true
});

// Use throughout your application
logger.debug('Cache check for model:', modelName);
logger.info('Download started:', modelUrl);
logger.warn('Retrying download:', attempt);
logger.error('Download failed:', error);
```

### Performance Profiling

**Basic profiling:**
```typescript
function profile<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = process.hrtime.bigint();
    
    try {
      const result = await fn();
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to ms
      
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// Usage
const model = await profile('Model Download', () => 
  downloader.downloadModel(config, destination)
);
```

### Network Debugging

**Debug network requests:**
```typescript
// Enable request logging
const downloader = new ModelDownloader({
  debug: true,
  logRequests: true
});

// Custom request interceptor
downloader.addRequestInterceptor((request) => {
  console.log('→', request.method, request.url);
});

downloader.addResponseInterceptor((response) => {
  console.log('←', response.status, response.headers);
});
```

### Cache Inspection Tools

**Inspect cache contents:**
```typescript
async function inspectCache() {
  const cache = new ModelCache({ cacheDir: './models' });
  await cache.initialize();
  
  const stats = await cache.getStats();
  console.log('📊 Cache Stats:', stats);
  
  // List all cached models
  const models = await cache.listModels();
  console.log('📦 Cached Models:');
  models.forEach(model => {
    console.log(`  ${model.name} v${model.version} - ${formatBytes(model.size)}`);
  });
  
  // Check cache integrity
  const integrity = await cache.checkIntegrity();
  if (!integrity.valid) {
    console.warn('⚠️ Cache integrity issues:', integrity.issues);
  }
}
```

## FAQ

### Q: Why do downloads fail intermittently?

**A:** This is usually due to network instability. Enable retry logic and use conservative download settings:

```typescript
const downloader = new ModelDownloader({
  retryAttempts: 5,
  timeout: 600000, // 10 minutes
  retryDelay: 5000 // 5 seconds between retries
});
```

### Q: How do I reduce memory usage during downloads?

**A:** Use streaming mode and limit concurrent operations:

```typescript
const optimizer = new PerformanceOptimizer({
  memoryLimit: '1GB',
  maxConcurrentDownloads: 1,
  forceStreaming: true
});
```

### Q: Can I use custom model sources?

**A:** Yes, add custom models to the registry:

```typescript
const customModel: ModelConfig = {
  name: 'my-model',
  version: '1.0.0',
  url: 'https://my-server.com/model.onnx',
  checksum: 'sha256-hash',
  size: 1024000,
  format: 'onnx',
  // ... other properties
};

await registry.addModel(customModel);
```

### Q: How do I handle offline scenarios?

**A:** Implement fallback logic and local caching:

```typescript
const errorHandler = new ErrorHandler({
  fallbackEnabled: true,
  degradedMode: true
});

// Check connectivity
const connectivity = await errorHandler.checkConnectivity();
if (connectivity.status === 'offline') {
  // Use cached models only
  const cached = await cache.checkCache(model);
  if (!cached.hit) {
    throw new Error('Model not available offline');
  }
  return cached.filePath;
}
```

### Q: How do I optimize for slow connections?

**A:** Use conservative settings and enable compression:

```typescript
const optimizer = new PerformanceOptimizer({
  bandwidthLimit: '5MB/s',
  maxConcurrentDownloads: 1,
  enableCompression: true,
  enableParallelChunks: false
});
```

### Q: What's the best cache cleanup strategy?

**A:** Use LRU (Least Recently Used) for general purpose, TTL (Time To Live) for time-sensitive data:

```typescript
const cache = new ModelCache({
  cacheDir: './models',
  maxSize: '10GB',
  cleanupStrategy: 'lru', // or 'ttl'
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for TTL
});
```

---

If you encounter issues not covered in this guide, please check the debug logs and submit a bug report with:

1. Full error message and stack trace
2. System information (OS, Node.js version, etc.)
3. Configuration used
4. Steps to reproduce
5. Debug logs with sensitive information removed