# Advanced Features API Reference

Complete API documentation for all advanced features components.

## Table of Contents

- [Tree-sitter Integration](#tree-sitter-integration)
- [Watch Command Enhancement](#watch-command-enhancement)
- [Advanced Annotation Features](#advanced-annotation-features)
- [Performance Optimization](#performance-optimization)

---

## Tree-sitter Integration

### TreeSitterManager

Main class for managing tree-sitter-based AST parsing across multiple languages.

#### Constructor

```typescript
constructor(options: TreeSitterOptions)
```

**Parameters:**

- `options: TreeSitterOptions` - Configuration options

**TreeSitterOptions Interface:**

```typescript
interface TreeSitterOptions {
  languages: SupportedLanguage[];
  performanceMode?: "development" | "optimized" | "minimal";
  errorRecovery?: boolean;
  caching?: boolean;
  maxCacheSize?: number;
  parsingTimeout?: number;
  memoryLimit?: number;
  concurrency?: number;
}
```

#### Methods

##### `parseCode(code: string, language: SupportedLanguage): Promise<ParseResult>`

Parses source code and returns AST with metadata.

**Parameters:**

- `code: string` - Source code to parse
- `language: SupportedLanguage` - Target language

**Returns:** `Promise<ParseResult>`

**ParseResult Interface:**

```typescript
interface ParseResult {
  success: boolean;
  ast?: SyntaxNode;
  errors?: ParseError[];
  metrics?: ParseMetrics;
  metadata?: {
    language: SupportedLanguage;
    parseTime: number;
    nodeCount: number;
    memoryUsage: number;
  };
}
```

##### `parseFile(filePath: string): Promise<ParseResult>`

Parses a file by detecting language from extension.

**Parameters:**

- `filePath: string` - Path to source file

**Returns:** `Promise<ParseResult>`

##### `parseIncremental(code: string, language: SupportedLanguage, previousTree?: Tree): Promise<ParseResult>`

Performs incremental parsing for improved performance.

**Parameters:**

- `code: string` - Updated source code
- `language: SupportedLanguage` - Target language
- `previousTree?: Tree` - Previous parse tree for incremental parsing

**Returns:** `Promise<ParseResult>`

##### `getSupportedLanguages(): SupportedLanguage[]`

Returns list of currently supported languages.

**Returns:** `SupportedLanguage[]`

##### `getLanguageStats(): LanguageStats`

Returns usage statistics for each supported language.

**Returns:** `LanguageStats`

```typescript
interface LanguageStats {
  [language: string]: {
    totalParses: number;
    successfulParses: number;
    averageParseTime: number;
    totalErrors: number;
    cacheHitRate: number;
  };
}
```

##### `clearCache(): void`

Clears the internal parsing cache.

##### `dispose(): Promise<void>`

Releases all resources and cleans up parsers.

### Supported Languages

```typescript
type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "cpp"
  | "c"
  | "json"
  | "yaml";
```

### Error Types

```typescript
interface ParseError {
  type: "syntax" | "timeout" | "memory" | "unknown";
  message: string;
  location?: {
    line: number;
    column: number;
    index: number;
  };
  severity: "error" | "warning" | "info";
  suggestions?: string[];
}
```

---

## Watch Command Enhancement

### EnhancedWatcher

Advanced file system watcher with pattern matching and performance optimization.

#### Constructor

```typescript
constructor(options: WatcherOptions)
```

**WatcherOptions Interface:**

```typescript
interface WatcherOptions {
  patterns: string[];
  excludePatterns?: string[];
  debounceMs?: number;
  throttleMs?: number;
  batchSize?: number;
  batchTimeoutMs?: number;
  maxConcurrency?: number;
  performanceMode?: boolean;
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  depth?: number;
  usePolling?: boolean;
  pollingInterval?: number;
}
```

#### Methods

##### `start(rootPath: string): Promise<void>`

Starts watching the specified directory.

**Parameters:**

- `rootPath: string` - Root directory to watch

##### `stop(): Promise<void>`

Stops the file watcher and cleans up resources.

##### `addPattern(pattern: string): void`

Adds a new pattern to watch.

**Parameters:**

- `pattern: string` - Glob pattern to add

##### `removePattern(pattern: string): void`

Removes a pattern from watching.

**Parameters:**

- `pattern: string` - Glob pattern to remove

##### `getStats(): WatcherStats`

Returns watcher performance statistics.

**Returns:** `WatcherStats`

```typescript
interface WatcherStats {
  totalFiles: number;
  watchedFiles: number;
  totalEvents: number;
  processedEvents: number;
  batchedEvents: number;
  averageProcessingTime: number;
  memoryUsage: number;
  cpuUsage: number;
}
```

#### Events

The `EnhancedWatcher` extends `EventEmitter` and emits the following events:

##### `'change'`

Emitted for individual file changes.

```typescript
watcher.on("change", (event: WatchEvent) => {
  // Handle single file change
});
```

**WatchEvent Interface:**

```typescript
interface WatchEvent {
  type: "add" | "change" | "unlink" | "addDir" | "unlinkDir";
  path: string;
  absolutePath: string;
  stats?: FileStats;
  timestamp: number;
  metadata?: {
    size: number;
    modified: Date;
    checksum?: string;
  };
}
```

##### `'batch'`

Emitted for batched file changes.

```typescript
watcher.on("batch", (events: WatchEvent[]) => {
  // Handle batch of file changes
});
```

##### `'error'`

Emitted when errors occur.

```typescript
watcher.on("error", (error: WatchError) => {
  // Handle watcher error
});
```

##### `'ready'`

Emitted when initial scan is complete.

```typescript
watcher.on("ready", (stats: WatcherStats) => {
  // Watcher is ready
});
```

---

## Advanced Annotation Features

### AnnotationManager

Comprehensive annotation system with metadata, relationships, and validation.

#### Constructor

```typescript
constructor(options: AnnotationOptions)
```

**AnnotationOptions Interface:**

```typescript
interface AnnotationOptions {
  validation?: boolean;
  inheritance?: boolean;
  relationships?: boolean;
  versioning?: boolean;
  storage?: "memory" | "file" | "database";
  storageOptions?: StorageOptions;
  caching?: boolean;
  maxCacheSize?: number;
}
```

#### Methods

##### `create(annotation: CreateAnnotationRequest): Promise<Annotation>`

Creates a new annotation.

**Parameters:**

- `annotation: CreateAnnotationRequest` - Annotation data

**CreateAnnotationRequest Interface:**

```typescript
interface CreateAnnotationRequest {
  target: string;
  type: AnnotationType;
  content?: string;
  metadata?: AnnotationMetadata;
  relationships?: RelationshipRequest[];
  validation?: ValidationRule[];
  tags?: string[];
  priority?: number;
  visibility?: "public" | "private" | "protected";
}
```

**Returns:** `Promise<Annotation>`

##### `update(id: string, updates: UpdateAnnotationRequest): Promise<Annotation>`

Updates an existing annotation.

**Parameters:**

- `id: string` - Annotation ID
- `updates: UpdateAnnotationRequest` - Update data

**Returns:** `Promise<Annotation>`

##### `delete(id: string): Promise<boolean>`

Deletes an annotation.

**Parameters:**

- `id: string` - Annotation ID

**Returns:** `Promise<boolean>`

##### `get(id: string): Promise<Annotation | null>`

Retrieves an annotation by ID.

**Parameters:**

- `id: string` - Annotation ID

**Returns:** `Promise<Annotation | null>`

##### `query(query: AnnotationQuery): Promise<QueryResult>`

Queries annotations with advanced filtering.

**Parameters:**

- `query: AnnotationQuery` - Query parameters

**AnnotationQuery Interface:**

```typescript
interface AnnotationQuery {
  target?: string | RegExp;
  type?: AnnotationType | AnnotationType[];
  metadata?: MetadataFilter;
  relationships?: RelationshipFilter;
  tags?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: "created" | "updated" | "priority" | "target";
  sortOrder?: "asc" | "desc";
  includeRelated?: boolean;
}
```

**Returns:** `Promise<QueryResult>`

```typescript
interface QueryResult {
  annotations: Annotation[];
  total: number;
  hasMore: boolean;
  metadata?: {
    queryTime: number;
    cacheHit: boolean;
  };
}
```

##### `validate(annotation: Annotation): ValidationResult`

Validates an annotation against defined rules.

**Parameters:**

- `annotation: Annotation` - Annotation to validate

**Returns:** `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}
```

#### Core Types

```typescript
interface Annotation {
  id: string;
  target: string;
  type: AnnotationType;
  content?: string;
  metadata: AnnotationMetadata;
  relationships: Relationship[];
  tags: string[];
  priority: number;
  visibility: "public" | "private" | "protected";
  version: number;
  created: Date;
  updated: Date;
  createdBy?: string;
  updatedBy?: string;
}

type AnnotationType =
  | "comment"
  | "documentation"
  | "todo"
  | "bug"
  | "performance"
  | "security"
  | "test"
  | "refactor"
  | "custom";

interface AnnotationMetadata {
  [key: string]: any;
  description?: string;
  category?: string;
  severity?: "low" | "medium" | "high" | "critical";
  status?: "active" | "completed" | "archived" | "ignored";
  assignee?: string;
  dueDate?: Date;
  estimatedEffort?: number;
  actualEffort?: number;
}

interface Relationship {
  id: string;
  type: RelationshipType;
  targetId: string;
  metadata?: {
    strength?: number;
    bidirectional?: boolean;
    [key: string]: any;
  };
}

type RelationshipType =
  | "related"
  | "depends_on"
  | "blocks"
  | "parent_of"
  | "child_of"
  | "duplicate_of"
  | "implements"
  | "tests"
  | "documents";
```

---

## Performance Optimization

### PerformanceOptimizer

Comprehensive performance monitoring and optimization system.

#### Constructor

```typescript
constructor(config: PerformanceConfig)
```

**PerformanceConfig Interface:**

```typescript
interface PerformanceConfig {
  memory: MemoryConfig;
  cache: CacheConfig;
  processing: ProcessingConfig;
  monitoring: MonitoringConfig;
  alerting?: AlertingConfig;
}
```

#### Core Configuration Types

```typescript
interface MemoryConfig {
  enabled: boolean;
  gcThreshold?: number;
  leakDetection?: boolean;
  maxHeapSize?: number;
  cleanupInterval?: number;
  aggressive?: boolean;
}

interface CacheConfig {
  enabled: boolean;
  maxMemory: number;
  evictionPolicy: "lru" | "lfu" | "fifo" | "ttl" | "random";
  ttl?: number;
  maxItems?: number;
  compression?: boolean;
}

interface ProcessingConfig {
  enabled: boolean;
  maxConcurrency: number;
  batchSize: number;
  queueMaxSize?: number;
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
  priorityLevels?: number;
}

interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  historySize?: number;
  exporters?: MetricsExporter[];
  customMetrics?: CustomMetric[];
}
```

#### Methods

##### `optimize(): Promise<OptimizationResult>`

Runs comprehensive system optimization.

**Returns:** `Promise<OptimizationResult>`

```typescript
interface OptimizationResult {
  success: boolean;
  optimizations: AppliedOptimization[];
  improvements: PerformanceImprovements;
  recommendations: Recommendation[];
  metrics: {
    before: SystemMetrics;
    after: SystemMetrics;
  };
  duration: number;
}
```

##### `getPerformanceStats(): Promise<PerformanceStats>`

Returns current performance statistics.

**Returns:** `Promise<PerformanceStats>`

```typescript
interface PerformanceStats {
  timestamp: number;
  metrics: {
    memory: MemoryMetrics;
    cache: CacheMetrics;
    processing: ProcessingMetrics;
    system: SystemMetrics;
  };
  health: {
    overall: HealthStatus;
    components: ComponentHealth[];
  };
  trends: TrendData[];
}
```

##### `monitorMemory(): Promise<MemoryReport>`

Performs detailed memory analysis.

**Returns:** `Promise<MemoryReport>`

```typescript
interface MemoryReport {
  current: MemoryMetrics;
  trends: MemoryTrend[];
  leaks: MemoryLeak[];
  recommendations: MemoryRecommendation[];
  gcAnalysis: GCAnalysis;
}
```

##### `optimizeCache(): Promise<CacheOptimization>`

Optimizes caching strategy and performance.

**Returns:** `Promise<CacheOptimization>`

##### `processWithOptimization<T>(items: T[], processor: (item: T) => Promise<any>): Promise<ProcessingResult>`

Processes items with optimization applied.

**Parameters:**

- `items: T[]` - Items to process
- `processor: (item: T) => Promise<any>` - Processing function

**Returns:** `Promise<ProcessingResult>`

##### `startMonitoring(): void`

Starts continuous performance monitoring.

##### `stopMonitoring(): void`

Stops performance monitoring.

##### `exportMetrics(exporter: MetricsExporter): Promise<void>`

Exports metrics to external system.

**Parameters:**

- `exporter: MetricsExporter` - Metrics exporter configuration

#### Metrics Types

```typescript
interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  gcCount: number;
  gcDuration: number;
  leakDetected: boolean;
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  itemCount: number;
  averageResponseTime: number;
}

interface ProcessingMetrics {
  throughput: number;
  averageLatency: number;
  errorRate: number;
  queueSize: number;
  activeWorkers: number;
  completedJobs: number;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: DiskUsage;
  networkUsage: NetworkUsage;
  uptime: number;
  loadAverage: number[];
}
```

#### Health and Alerting

```typescript
type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

interface ComponentHealth {
  component: string;
  status: HealthStatus;
  message?: string;
  metrics?: { [key: string]: number };
  lastCheck: Date;
}

interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  rules: AlertRule[];
  rateLimiting?: {
    maxAlertsPerMinute: number;
    cooldownPeriod: number;
  };
}

interface AlertRule {
  name: string;
  condition: string;
  severity: "info" | "warning" | "error" | "critical";
  threshold: number;
  enabled: boolean;
}
```

## Error Handling

All API methods follow consistent error handling patterns:

```typescript
// Standard error response
interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  requestId?: string;
}

// Common error codes
type ErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "RESOURCE_EXHAUSTED"
  | "INTERNAL_ERROR"
  | "TIMEOUT"
  | "CANCELLED";
```

## Events and Observability

All components emit standardized events for monitoring and debugging:

```typescript
// Standard event interface
interface SystemEvent {
  type: string;
  source: string;
  timestamp: number;
  data: any;
  severity: "debug" | "info" | "warning" | "error";
  traceId?: string;
}

// Common event types
type EventType =
  | "performance.optimization.completed"
  | "memory.cleanup.triggered"
  | "cache.eviction.occurred"
  | "processing.batch.completed"
  | "annotation.created"
  | "annotation.updated"
  | "watcher.file.changed"
  | "parser.parse.completed";
```

---

## Usage Examples

### Complete Integration Example

```typescript
import {
  TreeSitterManager,
  EnhancedWatcher,
  AnnotationManager,
  PerformanceOptimizer,
} from "@ast-copilot-helper/ast-helper";

// Initialize all components
const parser = new TreeSitterManager({
  languages: ["typescript", "python"],
  performanceMode: "optimized",
  errorRecovery: true,
});

const watcher = new EnhancedWatcher({
  patterns: ["**/*.{ts,py}"],
  debounceMs: 300,
  batchSize: 50,
});

const annotations = new AnnotationManager({
  validation: true,
  relationships: true,
  versioning: true,
});

const optimizer = new PerformanceOptimizer({
  memory: { enabled: true, gcThreshold: 0.8 },
  cache: { enabled: true, maxMemory: 128 * 1024 * 1024 },
  processing: { enabled: true, maxConcurrency: 4 },
  monitoring: { enabled: true, metricsInterval: 5000 },
});

// Coordinate all components
async function processProject(projectPath: string) {
  // Start performance monitoring
  optimizer.startMonitoring();

  // Start file watching
  await watcher.start(projectPath);

  // Handle file changes
  watcher.on("batch", async (changes) => {
    for (const change of changes) {
      if (change.type === "change" || change.type === "add") {
        // Parse the file
        const parseResult = await parser.parseFile(change.path);

        if (parseResult.success) {
          // Create annotations for important nodes
          await annotations.create({
            target: `file:${change.path}`,
            type: "documentation",
            metadata: {
              nodeCount: parseResult.metadata?.nodeCount,
              parseTimeMs: parseResult.metadata?.parseTime,
            },
          });
        }
      }
    }

    // Run optimization after batch processing
    await optimizer.optimize();
  });

  // Get performance stats
  const stats = await optimizer.getPerformanceStats();
  console.log("Performance Stats:", stats);
}
```

This comprehensive API reference provides complete documentation for all Issue #150 components, enabling developers to effectively integrate and utilize the advanced features.
