# Model Management Configuration Guide

Complete configuration reference for the AST Copilot Helper model management system.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Environment Variables](#environment-variables)
3. [Configuration Files](#configuration-files)
4. [Component Configuration](#component-configuration)
5. [Performance Tuning](#performance-tuning)
6. [Security Settings](#security-settings)
7. [Production Configuration](#production-configuration)

## Configuration Overview

The model management system supports multiple configuration methods:

1. **Environment Variables** - For runtime configuration
2. **Configuration Files** - For structured settings
3. **Programmatic Configuration** - For dynamic setup
4. **Default Values** - Sensible defaults for quick start

### Configuration Priority (highest to lowest)

1. Programmatic configuration (constructor options)
2. Environment variables
3. Configuration file
4. Default values

## Environment Variables

### Core Settings

```bash
# Cache Configuration
AST_MODEL_CACHE_DIR="./models"              # Cache directory path
AST_MODEL_CACHE_SIZE="10GB"                 # Maximum cache size
AST_MODEL_CLEANUP_STRATEGY="lru"            # Cleanup strategy: lru, ttl, size
AST_MODEL_CACHE_TTL="604800"                # TTL in seconds (7 days)
AST_MODEL_CACHE_COMPRESSION="true"          # Enable compression

# Download Configuration  
AST_MODEL_DOWNLOAD_RETRIES="3"              # Retry attempts
AST_MODEL_DOWNLOAD_TIMEOUT="300000"         # Timeout in milliseconds
AST_MODEL_DOWNLOAD_CHUNK_SIZE="1048576"     # Chunk size in bytes (1MB)
AST_MODEL_BANDWIDTH_LIMIT="50MB/s"          # Bandwidth limit
AST_MODEL_ENABLE_RESUME="true"              # Enable download resumption

# Performance Configuration
AST_MODEL_MAX_CONCURRENT="3"                # Max concurrent downloads
AST_MODEL_MEMORY_LIMIT="2GB"                # Memory usage limit
AST_MODEL_ENABLE_COMPRESSION="true"         # Enable compression
AST_MODEL_PARALLEL_CHUNKS="true"            # Enable parallel chunks

# Security Configuration
AST_MODEL_VERIFY_CHECKSUMS="true"           # Verify file checksums
AST_MODEL_QUARANTINE_DIR="./quarantine"     # Quarantine directory
AST_MODEL_STRICT_VALIDATION="false"         # Enable strict validation
AST_MODEL_SCAN_MALWARE="false"              # Enable malware scanning

# Logging Configuration
AST_MODEL_LOG_LEVEL="info"                  # Log level: error, warn, info, debug
AST_MODEL_DEBUG="false"                     # Enable debug mode
AST_MODEL_LOG_FILE="./models.log"           # Log file path
AST_MODEL_ENABLE_METRICS="true"             # Enable performance metrics

# Network Configuration
AST_MODEL_USER_AGENT="AST-Helper/1.0"       # Custom user agent
AST_MODEL_CONNECT_TIMEOUT="30000"           # Connection timeout
AST_MODEL_DNS_TIMEOUT="5000"                # DNS resolution timeout
AST_MODEL_KEEP_ALIVE="true"                 # Enable HTTP keep-alive

# Proxy Configuration
HTTP_PROXY="http://proxy.company.com:8080"  # HTTP proxy
HTTPS_PROXY="https://proxy.company.com:8080" # HTTPS proxy
NO_PROXY="localhost,127.0.0.1,.local"      # Proxy bypass list
```

### Development Settings

```bash
# Development Mode
NODE_ENV="development"
AST_MODEL_DEBUG="true"
AST_MODEL_LOG_LEVEL="debug"
AST_MODEL_STRICT_VALIDATION="false"

# Mock Settings for Testing
AST_MODEL_MOCK_DOWNLOADS="true"             # Use mock downloader
AST_MODEL_MOCK_DELAY="1000"                 # Mock download delay (ms)
AST_MODEL_TEST_MODE="true"                  # Enable test mode
```

### Production Settings

```bash
# Production Mode
NODE_ENV="production"
AST_MODEL_DEBUG="false"
AST_MODEL_LOG_LEVEL="warn"
AST_MODEL_STRICT_VALIDATION="true"
AST_MODEL_ENABLE_METRICS="true"
AST_MODEL_LOG_FILE="/var/log/ast-helper/models.log"

# Production Performance
AST_MODEL_MAX_CONCURRENT="6"
AST_MODEL_MEMORY_LIMIT="4GB"
AST_MODEL_BANDWIDTH_LIMIT="100MB/s"
AST_MODEL_CACHE_SIZE="50GB"
```

## Configuration Files

### Basic Configuration File (`models.config.json`)

```json
{
  "version": "1.0",
  "cache": {
    "directory": "./models",
    "maxSize": "10GB",
    "cleanupStrategy": "lru",
    "compressionEnabled": true,
    "maxAge": 604800,
    "cleanupInterval": 3600
  },
  "downloads": {
    "retryAttempts": 3,
    "timeout": 300000,
    "chunkSize": 1048576,
    "bandwidthLimit": "50MB/s",
    "enableResume": true,
    "userAgent": "AST-Helper/1.0",
    "headers": {
      "Accept": "application/octet-stream",
      "Cache-Control": "no-cache"
    }
  },
  "performance": {
    "maxConcurrentDownloads": 3,
    "memoryLimit": "2GB",
    "enableParallelChunks": true,
    "enableCompression": true,
    "cpuThrottling": false
  },
  "security": {
    "verifyChecksums": true,
    "quarantineDirectory": "./quarantine",
    "strictValidation": false,
    "allowedFormats": ["onnx", "pytorch", "tensorflow"],
    "maxFileSize": "5GB"
  },
  "logging": {
    "level": "info",
    "enableFile": true,
    "filePath": "./logs/models.log",
    "enableConsole": true,
    "enableMetrics": true,
    "rotateSize": "100MB",
    "maxFiles": 10
  },
  "network": {
    "connectTimeout": 30000,
    "dnsTimeout": 5000,
    "keepAlive": true,
    "maxSockets": 10,
    "proxy": {
      "enabled": false,
      "host": "",
      "port": 0,
      "auth": {
        "username": "",
        "password": ""
      }
    }
  }
}
```

### Advanced Configuration File

```json
{
  "version": "1.0",
  "profiles": {
    "development": {
      "cache": {
        "directory": "./dev-models",
        "maxSize": "5GB",
        "cleanupStrategy": "ttl",
        "maxAge": 3600
      },
      "downloads": {
        "retryAttempts": 1,
        "timeout": 60000,
        "mockEnabled": true
      },
      "logging": {
        "level": "debug",
        "enableConsole": true,
        "enableFile": false
      }
    },
    "production": {
      "cache": {
        "directory": "/var/cache/ast-helper/models",
        "maxSize": "100GB",
        "cleanupStrategy": "lru",
        "compressionEnabled": true
      },
      "downloads": {
        "retryAttempts": 5,
        "timeout": 900000,
        "bandwidthLimit": "200MB/s"
      },
      "performance": {
        "maxConcurrentDownloads": 8,
        "memoryLimit": "8GB"
      },
      "security": {
        "strictValidation": true,
        "scanMalware": true
      },
      "logging": {
        "level": "warn",
        "enableFile": true,
        "filePath": "/var/log/ast-helper/models.log"
      }
    },
    "testing": {
      "cache": {
        "directory": "/tmp/test-models",
        "maxSize": "1GB"
      },
      "downloads": {
        "mockEnabled": true,
        "mockDelay": 100
      },
      "logging": {
        "level": "error",
        "enableConsole": false
      }
    }
  },
  "models": {
    "registryUrl": "https://api.huggingface.co/models",
    "defaultFormat": "onnx",
    "autoUpdate": true,
    "updateInterval": 86400,
    "customModels": [
      {
        "name": "custom-embedding",
        "version": "1.0.0",
        "url": "https://my-server.com/model.onnx",
        "checksum": "sha256-hash-here",
        "size": 256000000,
        "format": "onnx",
        "dimensions": 768,
        "description": "Custom embedding model"
      }
    ]
  },
  "monitoring": {
    "enableMetrics": true,
    "metricsPort": 9090,
    "healthCheck": {
      "enabled": true,
      "port": 8080,
      "path": "/health"
    },
    "alerts": {
      "enabled": true,
      "diskSpaceThreshold": 0.9,
      "downloadFailureThreshold": 3,
      "webhookUrl": "https://hooks.slack.com/services/..."
    }
  }
}
```

### YAML Configuration (`models.config.yaml`)

```yaml
version: '1.0'

cache:
  directory: './models'
  maxSize: '10GB'
  cleanupStrategy: 'lru'
  compressionEnabled: true
  maxAge: 604800  # 7 days

downloads:
  retryAttempts: 3
  timeout: 300000  # 5 minutes
  chunkSize: 1048576  # 1MB
  bandwidthLimit: '50MB/s'
  enableResume: true

performance:
  maxConcurrentDownloads: 3
  memoryLimit: '2GB'
  enableParallelChunks: true
  enableCompression: true

security:
  verifyChecksums: true
  quarantineDirectory: './quarantine'
  strictValidation: false
  allowedFormats:
    - 'onnx'
    - 'pytorch'
    - 'tensorflow'

logging:
  level: 'info'
  enableFile: true
  filePath: './logs/models.log'
  enableConsole: true

network:
  connectTimeout: 30000
  keepAlive: true
  proxy:
    enabled: false
```

## Component Configuration

### ModelDownloader Configuration

```typescript
import { ModelDownloader } from '@ast-copilot-helper/ast-helper';

const downloader = new ModelDownloader({
  // Basic settings
  retryAttempts: 3,
  timeout: 300000,
  chunkSize: 1024 * 1024, // 1MB

  // Progress tracking
  progressCallback: (progress) => {
    console.log(`${progress.percentage}% - ${progress.speed} MB/s`);
  },

  // Network settings
  bandwidthLimit: '50MB/s',
  userAgent: 'AST-Helper/1.0',
  keepAlive: true,
  maxSockets: 10,

  // Resume settings
  enableResume: true,
  resumeThreshold: 1024 * 1024, // 1MB minimum for resume

  // Headers
  headers: {
    'Accept': 'application/octet-stream',
    'Cache-Control': 'no-cache'
  },

  // Proxy settings
  proxy: {
    host: 'proxy.company.com',
    port: 8080,
    auth: {
      username: 'user',
      password: 'pass'
    }
  },

  // SSL settings
  tls: {
    rejectUnauthorized: true,
    ca: '/path/to/ca.pem'
  }
});
```

### ModelCache Configuration

```typescript
import { ModelCache } from '@ast-copilot-helper/ast-helper';

const cache = new ModelCache({
  // Basic settings
  cacheDir: './models',
  maxSize: '10GB',
  
  // Cleanup strategy
  cleanupStrategy: 'lru', // 'lru', 'ttl', 'size'
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (for TTL strategy)
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  
  // Compression
  compressionEnabled: true,
  compressionLevel: 6, // 1-9, higher = better compression
  
  // Performance
  enableIndexing: true,
  indexingInterval: 5 * 60 * 1000, // 5 minutes
  
  // File system
  enableWatchdog: true, // Monitor file changes
  syncOnWrite: true,    // Sync writes to disk
  
  // Concurrency
  maxConcurrentOperations: 5,
  lockTimeout: 30000, // 30 seconds
  
  // Validation
  validateOnAccess: true,
  checksumValidation: true
});
```

### FileVerifier Configuration

```typescript
import { FileVerifier } from '@ast-copilot-helper/ast-helper';

const verifier = new FileVerifier('./quarantine', {
  // Basic validation
  verifyChecksums: true,
  verifyFileSize: true,
  verifyFormat: true,
  
  // Strict validation
  strictValidation: false,
  allowedFormats: ['onnx', 'pytorch', 'tensorflow'],
  maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
  
  // Security scanning
  scanMalware: false,
  scannerTimeout: 30000,
  
  // Quarantine settings
  quarantineOnFailure: true,
  quarantineRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Custom validators
  customValidators: [
    {
      name: 'custom-format-check',
      validate: async (filePath: string, config: ModelConfig) => {
        // Custom validation logic
        return { valid: true, errors: [] };
      }
    }
  ]
});
```

### PerformanceOptimizer Configuration

```typescript
import { PerformanceOptimizer } from '@ast-copilot-helper/ast-helper';

const optimizer = new PerformanceOptimizer({
  // Download limits
  maxConcurrentDownloads: 3,
  bandwidthLimit: '50MB/s',
  
  // Memory management
  memoryLimit: '2GB',
  memoryThreshold: 0.8, // 80% of limit
  
  // CPU management
  cpuThrottling: true,
  cpuThreshold: 0.9, // 90% usage
  
  // Chunk settings
  enableParallelChunks: true,
  minChunkSize: 1024 * 1024, // 1MB
  maxChunkSize: 10 * 1024 * 1024, // 10MB
  chunkCount: 4,
  
  // Compression
  enableCompression: true,
  compressionThreshold: 1024 * 1024, // 1MB minimum for compression
  
  // Monitoring
  enableMetrics: true,
  metricsInterval: 1000, // 1 second
  
  // Adaptive settings
  adaptiveBandwidth: true,
  adaptiveChunking: true,
  adaptiveConcurrency: true
});
```

### ErrorHandler Configuration

```typescript
import { ErrorHandler } from '@ast-copilot-helper/ast-helper';

const errorHandler = new ErrorHandler({
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2, // Exponential backoff
  maxRetryDelay: 30000,
  
  // Retry conditions
  retryOnNetworkError: true,
  retryOnTimeout: true,
  retryOnServerError: true,
  retryOn: [408, 429, 502, 503, 504], // HTTP status codes
  
  // Fallback settings
  fallbackEnabled: true,
  fallbackModels: {
    'code-embedding-v1': 'code-embedding-v0'
  },
  
  // Degraded mode
  degradedMode: true,
  degradedModeThreshold: 3, // Failures before entering degraded mode
  
  // Connectivity monitoring
  connectivityCheck: true,
  connectivityInterval: 30000, // 30 seconds
  connectivityEndpoints: [
    'https://api.github.com',
    'https://huggingface.co'
  ],
  
  // Logging
  logLevel: 'info',
  logErrors: true,
  logRetries: true,
  
  // Circuit breaker
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    recoveryTime: 60000, // 1 minute
    monitoringPeriod: 300000 // 5 minutes
  }
});
```

## Performance Tuning

### CPU-Optimized Configuration

```typescript
// For CPU-constrained environments
const config = {
  performance: {
    maxConcurrentDownloads: Math.min(2, os.cpus().length),
    enableCompression: false, // Disable CPU-intensive compression
    cpuThrottling: true,
    enableParallelChunks: false
  },
  cache: {
    compressionEnabled: false,
    indexingInterval: 300000 // Reduce indexing frequency
  }
};
```

### Memory-Optimized Configuration

```typescript
// For memory-constrained environments
const config = {
  performance: {
    memoryLimit: '512MB',
    maxConcurrentDownloads: 1,
    enableStreaming: true
  },
  downloads: {
    chunkSize: 256 * 1024, // 256KB chunks
    enableResume: false // Reduce memory overhead
  },
  cache: {
    compressionEnabled: true, // Trade CPU for memory
    maxSize: '2GB'
  }
};
```

### Network-Optimized Configuration

```typescript
// For bandwidth-constrained environments
const config = {
  performance: {
    bandwidthLimit: '5MB/s',
    maxConcurrentDownloads: 1,
    enableCompression: true,
    enableParallelChunks: false
  },
  downloads: {
    retryAttempts: 5,
    timeout: 900000, // 15 minutes
    chunkSize: 512 * 1024 // 512KB chunks
  },
  network: {
    keepAlive: true,
    maxSockets: 2
  }
};
```

### High-Performance Configuration

```typescript
// For high-end systems
const config = {
  performance: {
    maxConcurrentDownloads: 8,
    bandwidthLimit: '500MB/s',
    memoryLimit: '8GB',
    enableParallelChunks: true,
    chunkCount: 8
  },
  downloads: {
    chunkSize: 10 * 1024 * 1024, // 10MB chunks
    enableResume: true
  },
  cache: {
    maxSize: '100GB',
    compressionEnabled: true,
    enableIndexing: true
  },
  network: {
    maxSockets: 20,
    keepAlive: true
  }
};
```

## Security Settings

### High-Security Configuration

```typescript
const secureConfig = {
  security: {
    verifyChecksums: true,
    strictValidation: true,
    scanMalware: true,
    allowedFormats: ['onnx'], // Restrict formats
    maxFileSize: '1GB',
    
    // File permissions
    fileMode: 0o644,
    dirMode: 0o755,
    
    // Quarantine settings
    quarantineOnFailure: true,
    quarantineRetention: 90 * 24 * 60 * 60 * 1000, // 90 days
    
    // Network security
    tlsMinVersion: 'TLSv1.2',
    validateCertificates: true,
    
    // Custom security checks
    customValidators: [
      {
        name: 'size-validator',
        validate: async (filePath, config) => {
          const stats = await fs.stat(filePath);
          if (stats.size !== config.size) {
            return { valid: false, errors: ['Size mismatch'] };
          }
          return { valid: true, errors: [] };
        }
      }
    ]
  },
  
  network: {
    proxy: {
      enabled: true,
      validateCertificates: true
    },
    tls: {
      rejectUnauthorized: true,
      checkServerIdentity: true
    }
  }
};
```

### Development Security Configuration

```typescript
const devConfig = {
  security: {
    verifyChecksums: false, // Speed up development
    strictValidation: false,
    scanMalware: false,
    allowedFormats: ['onnx', 'pytorch', 'tensorflow', 'bin'], // Allow more formats
    
    // Relaxed settings
    quarantineOnFailure: false,
    validateCertificates: false
  }
};
```

## Production Configuration

### Docker Configuration

```dockerfile
# Dockerfile
ENV AST_MODEL_CACHE_DIR=/app/models
ENV AST_MODEL_CACHE_SIZE=20GB
ENV AST_MODEL_LOG_LEVEL=warn
ENV AST_MODEL_MAX_CONCURRENT=4
ENV AST_MODEL_MEMORY_LIMIT=4GB

# Create cache directory
RUN mkdir -p /app/models /app/logs /app/quarantine

# Set permissions
RUN chown -R node:node /app/models /app/logs /app/quarantine
```

### Kubernetes Configuration

```yaml
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: model-config
data:
  AST_MODEL_CACHE_DIR: "/data/models"
  AST_MODEL_CACHE_SIZE: "50GB"
  AST_MODEL_LOG_LEVEL: "warn"
  AST_MODEL_MAX_CONCURRENT: "6"
  AST_MODEL_MEMORY_LIMIT: "8GB"
  models.config.json: |
    {
      "cache": {
        "directory": "/data/models",
        "maxSize": "50GB",
        "cleanupStrategy": "lru"
      },
      "performance": {
        "maxConcurrentDownloads": 6,
        "memoryLimit": "8GB"
      },
      "logging": {
        "level": "warn",
        "filePath": "/data/logs/models.log"
      }
    }

---
# PersistentVolume for cache
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: model-cache-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ast-helper',
    script: './dist/index.js',
    env: {
      NODE_ENV: 'production',
      AST_MODEL_CACHE_DIR: './data/models',
      AST_MODEL_CACHE_SIZE: '20GB',
      AST_MODEL_LOG_LEVEL: 'warn',
      AST_MODEL_MAX_CONCURRENT: '4'
    },
    env_production: {
      NODE_ENV: 'production',
      AST_MODEL_CACHE_DIR: '/var/lib/ast-helper/models',
      AST_MODEL_CACHE_SIZE: '100GB',
      AST_MODEL_LOG_LEVEL: 'error',
      AST_MODEL_MAX_CONCURRENT: '8'
    }
  }]
};
```

### Systemd Service Configuration

```ini
# /etc/systemd/system/ast-helper.service
[Unit]
Description=AST Copilot Helper
After=network.target

[Service]
Type=simple
User=ast-helper
WorkingDirectory=/opt/ast-helper
ExecStart=/usr/bin/node dist/index.js
Restart=always

# Environment variables
Environment=NODE_ENV=production
Environment=AST_MODEL_CACHE_DIR=/var/cache/ast-helper/models
Environment=AST_MODEL_CACHE_SIZE=50GB
Environment=AST_MODEL_LOG_LEVEL=warn
Environment=AST_MODEL_MAX_CONCURRENT=6

[Install]
WantedBy=multi-user.target
```

---

This configuration guide provides comprehensive options for tuning the model management system for your specific requirements. Start with the default settings and adjust based on your environment's constraints and performance needs.