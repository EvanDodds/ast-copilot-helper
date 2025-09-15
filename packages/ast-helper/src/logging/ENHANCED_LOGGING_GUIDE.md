# Enhanced Logging Infrastructure

## Overview

This document describes the new enhanced logging infrastructure implemented as part of milestone-week-3 improvements. The enhanced logging system provides structured logging with configurable levels, performance tracking, operation correlation, and contextual metadata for better debugging and operations monitoring.

## Features

### 🎯 **Core Capabilities**

- **Operation Tracking**: Start, monitor, and complete operations with automatic timing
- **Performance Monitoring**: Add checkpoints and track performance metrics
- **Correlation IDs**: Automatic request/operation correlation across distributed calls
- **Contextual Metadata**: Rich context information attached to all log entries
- **Error Isolation**: Comprehensive error handling with stack traces and context
- **Hierarchical Operations**: Support for parent-child operation relationships

### 🏗️ **Architecture Components**

1. **EnhancedLogger**: Main logging interface with automatic context management
2. **Performance Tracking**: Built-in operation timing and checkpoint system
3. **Context Management**: Automatic correlation ID and operation ID generation
4. **Factory Functions**: Convenient logger creation for different use cases

## Quick Start

### Basic Usage

```typescript
import { createEnhancedLogger, createLogger, LogLevel } from '../logging/index.js';

// Create a base logger
const baseLogger = createLogger({ level: LogLevel.DEBUG });

// Create enhanced logger with context
const logger = createEnhancedLogger(baseLogger, {
  component: 'EmbeddingService',
  version: '1.0.0'
});

// Start an operation
const context = logger.startOperation('generate_embeddings', {
  batchSize: 100,
  model: 'all-MiniLM-L6-v2'
});

// Add performance checkpoints
logger.addCheckpoint(context, 'model_loaded', { memoryUsage: '150MB' });
logger.addCheckpoint(context, 'embeddings_computed', { vectorCount: 100 });

// Complete the operation
logger.endPerformanceTracking(context, 'generate_embeddings', true);
```

### Request Correlation

```typescript
import { createRequestLogger } from '../logging/index.js';

// Create logger with automatic request correlation
const requestLogger = createRequestLogger(baseLogger, 'req-12345', 'user-789');

const context = requestLogger.startOperation('handle_search', {
  endpoint: '/api/search',
  query: 'machine learning'
});

// All logs will include the same correlation ID
requestLogger.info('Processing search request', { terms: 2 });
requestLogger.addCheckpoint(context, 'query_validated');
requestLogger.endPerformanceTracking(context, 'handle_search', true);
```

### Component-Specific Logging

```typescript
import { createComponentLogger } from '../logging/index.js';

// Create logger for a specific component
const componentLogger = createComponentLogger(baseLogger, 'DatabaseManager', 'indexAnnotations');

const context = componentLogger.startOperation('index_batch', {
  annotationCount: 500,
  indexType: 'HNSW'
});

try {
  // Simulate work
  componentLogger.addCheckpoint(context, 'validation_complete');
  componentLogger.addCheckpoint(context, 'vectors_generated');
  componentLogger.endPerformanceTracking(context, 'index_batch', true);
} catch (error) {
  componentLogger.endPerformanceTracking(context, 'index_batch', false, error);
}
```

### Hierarchical Operations

```typescript
// Parent operation
const parentContext = logger.startOperation('process_repository', {
  repoPath: '/path/to/repo',
  fileCount: 50
});

// Child operation with parent reference
const childContext = logger.startOperation('parse_typescript_files', {
  parentOperation: parentContext.operationId,
  fileExtension: '.ts'
});

// Complete child first
logger.addCheckpoint(childContext, 'parsing_complete', { nodesProcessed: 1500 });
logger.endPerformanceTracking(childContext, 'parse_typescript_files', true);

// Complete parent
logger.addCheckpoint(parentContext, 'all_parsing_complete');
logger.endPerformanceTracking(parentContext, 'process_repository', true);
```

## API Reference

### EnhancedLogger Class

#### Methods

- `startOperation(operation: string, context?: Record<string, any>): PerformanceContext`
- `startPerformanceTracking(operation: string, context?: Partial<EnhancedLogContext>): PerformanceContext`
- `addCheckpoint(context: PerformanceContext, name: string, metadata?: Record<string, any>): void`
- `endPerformanceTracking(context: PerformanceContext, operation: string, success?: boolean, error?: Error): void`
- `info(message: string, context?: Record<string, any>): void`
- `error(message: string, context?: Record<string, any>): void`
- `warn(message: string, context?: Record<string, any>): void`
- `debug(message: string, context?: Record<string, any>): void`

### Factory Functions

#### createEnhancedLogger(baseLogger: Logger, context?: Partial<EnhancedLogContext>): EnhancedLogger
Creates an enhanced logger with optional base context.

#### createRequestLogger(baseLogger: Logger, requestId: string, userId?: string): EnhancedLogger
Creates a logger optimized for HTTP request tracking with automatic correlation.

#### createComponentLogger(baseLogger: Logger, component: string, method?: string): EnhancedLogger
Creates a logger for a specific component/method combination.

### Context Interfaces

```typescript
interface EnhancedLogContext {
  operationId?: string;
  correlationId?: string;
  timestamp?: string;
  component?: string;
  method?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

interface PerformanceContext extends EnhancedLogContext {
  operationId: string;
  startTime: number;
  checkpoints?: PerformanceCheckpoint[];
}

interface PerformanceCheckpoint {
  name: string;
  timestamp: number;
  duration: number;
  metadata?: Record<string, any>;
}
```

## Integration Examples

### With Embedding Generation

```typescript
import { XenovaEmbeddingGenerator } from '../embedder/XenovaEmbeddingGenerator.js';
import { createComponentLogger } from '../logging/index.js';

class EnhancedEmbeddingGenerator extends XenovaEmbeddingGenerator {
  private logger = createComponentLogger(baseLogger, 'EmbeddingGenerator');

  async generateBatch(annotations: Annotation[]): Promise<number[][]> {
    const context = this.logger.startOperation('generate_batch', {
      batchSize: annotations.length,
      modelName: this.modelName
    });

    try {
      this.logger.addCheckpoint(context, 'batch_prepared', { 
        totalTokens: annotations.reduce((sum, ann) => sum + ann.content.length, 0) 
      });

      const embeddings = await super.generateBatch(annotations);

      this.logger.addCheckpoint(context, 'embeddings_generated', { 
        vectorCount: embeddings.length,
        avgDimension: embeddings[0]?.length || 0
      });

      this.logger.endPerformanceTracking(context, 'generate_batch', true);
      return embeddings;
    } catch (error) {
      this.logger.endPerformanceTracking(context, 'generate_batch', false, error as Error);
      throw error;
    }
  }
}
```

### With Database Operations

```typescript
import { HNSWVectorDatabase } from '../database/vector/hnsw-database.js';

class EnhancedHNSWDatabase extends HNSWVectorDatabase {
  private logger = createComponentLogger(baseLogger, 'HNSWDatabase');

  async addAnnotations(annotations: AnnotationVector[]): Promise<void> {
    const context = this.logger.startOperation('add_annotations', {
      annotationCount: annotations.length,
      databasePath: this.dbPath
    });

    try {
      this.logger.addCheckpoint(context, 'validation_complete');
      
      await super.addAnnotations(annotations);
      
      this.logger.addCheckpoint(context, 'vectors_indexed', {
        newTotalCount: await this.getCount()
      });

      this.logger.endPerformanceTracking(context, 'add_annotations', true);
    } catch (error) {
      this.logger.endPerformanceTracking(context, 'add_annotations', false, error as Error);
      throw error;
    }
  }
}
```

## Log Format Examples

### Operation Start
```
[2025-09-14T17:00:00.000Z] ℹ️  INFO  Started operation: generate_embeddings
  {
    "operationId": "op_a1b2c3d4e5f6",
    "correlationId": "corr_f6e5d4c3b2a1",
    "component": "EmbeddingGenerator",
    "batchSize": 100,
    "modelName": "all-MiniLM-L6-v2",
    "operation": "generate_embeddings",
    "event": "operation_start"
  }
```

### Checkpoint
```
[2025-09-14T17:00:01.500Z] 🐛 DEBUG Checkpoint: model_loaded
  {
    "operationId": "op_a1b2c3d4e5f6",
    "correlationId": "corr_f6e5d4c3b2a1",
    "checkpoint": {
      "name": "model_loaded",
      "timestamp": 1694707201500,
      "duration": 1500,
      "metadata": { "memoryUsage": "150MB" }
    }
  }
```

### Operation Completion
```
[2025-09-14T17:00:03.200Z] ℹ️  INFO  Completed operation: generate_embeddings (3200ms)
  {
    "operationId": "op_a1b2c3d4e5f6",
    "correlationId": "corr_f6e5d4c3b2a1",
    "operation": "generate_embeddings",
    "success": true,
    "totalDuration": 3200,
    "checkpointCount": 2,
    "event": "operation_complete"
  }
```

### Error Handling
```
[2025-09-14T17:00:05.000Z] ❌ ERROR Failed operation: index_annotations (2500ms)
  {
    "operationId": "op_b2c3d4e5f6a1",
    "correlationId": "corr_a1f6e5d4c3b2",
    "operation": "index_annotations",
    "success": false,
    "totalDuration": 2500,
    "error": {
      "name": "Error",
      "message": "Database connection failed",
      "stack": "Error: Database connection failed\\n    at..."
    }
  }
```

## Testing

The enhanced logging system includes comprehensive integration tests covering:

- **Operation tracking**: Start/end operations with timing
- **Error handling**: Failed operations with error context
- **Request correlation**: Automatic correlation ID generation
- **Hierarchical operations**: Parent-child operation relationships
- **Performance metrics**: Checkpoint timing and summary data

Run tests with:
```bash
npm test packages/ast-helper/src/logging/__tests__/enhanced-logging-integration.test.ts
```

## Best Practices

### 1. Operation Naming
Use consistent, descriptive operation names:
- ✅ `generate_embeddings`, `index_annotations`, `search_vectors`
- ❌ `process`, `do_work`, `handle`

### 2. Checkpoint Strategy
Add meaningful checkpoints at key phases:
```typescript
const context = logger.startOperation('complex_analysis');

logger.addCheckpoint(context, 'data_loaded', { recordCount: 1000 });
logger.addCheckpoint(context, 'validation_complete', { errorCount: 0 });
logger.addCheckpoint(context, 'processing_complete', { resultsCount: 950 });

logger.endPerformanceTracking(context, 'complex_analysis', true);
```

### 3. Context Information
Include relevant metadata in operation context:
```typescript
const context = logger.startOperation('batch_process', {
  batchSize: items.length,
  processingMode: 'parallel',
  maxRetries: 3,
  timeoutMs: 30000
});
```

### 4. Error Handling
Always complete operations, even on failure:
```typescript
try {
  // ... operation logic
  logger.endPerformanceTracking(context, 'operation_name', true);
} catch (error) {
  logger.endPerformanceTracking(context, 'operation_name', false, error);
  throw error; // Re-throw to maintain error flow
}
```

### 5. Component Organization
Use consistent component names and create loggers at class level:
```typescript
class MyService {
  private logger = createComponentLogger(baseLogger, 'MyService');
  
  async myMethod() {
    const context = this.logger.startOperation('my_method');
    // ... method implementation
  }
}
```

## Performance Considerations

- **Minimal Overhead**: Logger setup and context creation are lightweight
- **Async-Safe**: All logging operations are synchronous and thread-safe
- **Memory Efficient**: Context objects are small and automatically cleaned up
- **Configurable**: Use appropriate log levels to control verbosity in production

## Migration Guide

### From Basic Logging
```typescript
// Before
logger.info('Starting embeddings generation');
// ... work
logger.info('Embeddings generation complete');

// After
const context = logger.startOperation('generate_embeddings', { batchSize: 100 });
logger.addCheckpoint(context, 'model_loaded');
logger.endPerformanceTracking(context, 'generate_embeddings', true);
```

### Adding to Existing Classes
```typescript
// Add enhanced logger as private member
private logger = createComponentLogger(baseLogger, 'ExistingClass');

// Replace manual timing with automatic tracking
const context = this.logger.startOperation('existing_method');
// ... existing logic
this.logger.endPerformanceTracking(context, 'existing_method', success);
```

## Conclusion

The enhanced logging infrastructure provides a robust foundation for observability, debugging, and performance monitoring. By following the patterns and best practices outlined in this document, developers can gain deep insights into application behavior and quickly identify and resolve issues.

The system is designed to be:
- **Easy to adopt**: Minimal changes to existing code
- **Powerful**: Rich context and automatic correlation
- **Performant**: Low overhead and efficient implementation
- **Flexible**: Configurable for different environments and use cases

For additional examples and advanced usage patterns, refer to the integration tests and the existing codebase implementations.