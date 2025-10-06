# Issue #150 Examples

Practical examples demonstrating the powerful features of Issue #150 components.

## Table of Contents

- [Tree-sitter Integration Examples](#tree-sitter-integration-examples)
- [Enhanced Watch Command Examples](#enhanced-watch-command-examples)
- [Advanced Annotations Examples](#advanced-annotations-examples)
- [Performance Optimization Examples](#performance-optimization-examples)
- [Real-world Integration Examples](#real-world-integration-examples)

---

## Tree-sitter Integration Examples

### Basic Multi-language Parsing

```typescript
import { TreeSitterManager } from "@ast-copilot-helper/ast-helper";

const parser = new TreeSitterManager({
  languages: ["typescript", "python", "rust"],
  performanceMode: "optimized",
  errorRecovery: true,
  caching: true,
});

// Parse TypeScript code
const tsCode = `
interface User {
  id: number;
  name: string;
  email?: string;
}

class UserService {
  private users: User[] = [];
  
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = { ...userData, id: Date.now() };
    this.users.push(user);
    return user;
  }
}
`;

const tsResult = await parser.parseCode(tsCode, "typescript");
if (tsResult.success) {
  console.log(`Parsed ${tsResult.metadata?.nodeCount} AST nodes`);
  console.log(`Parse time: ${tsResult.metadata?.parseTime}ms`);

  // Navigate AST nodes
  const classes = findNodesByType(tsResult.ast, "class_declaration");
  console.log(`Found ${classes.length} classes`);
}

// Parse Python code
const pythonCode = `
from typing import Optional, List
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None

class UserService:
    def __init__(self):
        self.users: List[User] = []
    
    async def create_user(self, name: str, email: Optional[str] = None) -> User:
        user = User(id=len(self.users) + 1, name=name, email=email)
        self.users.append(user)
        return user
`;

const pythonResult = await parser.parseCode(pythonCode, "python");
if (pythonResult.success) {
  console.log("Python parsing successful");

  // Find all function definitions
  const functions = findNodesByType(pythonResult.ast, "function_definition");
  functions.forEach((func, index) => {
    console.log(`Function ${index + 1}: ${func.children?.[1]?.text}`);
  });
}
```

### Error Recovery and Debugging

```typescript
// Parse code with intentional syntax errors
const buggyCode = `
class Calculator {
  add(a: number, b: number {  // Missing closing parenthesis
    return a + b;
  }
  
  multiply(a, b) // Missing parameter types
    return a * b;  // Missing opening brace
  }
}
`;

const result = await parser.parseCode(buggyCode, "typescript");

if (!result.success) {
  console.log("Parsing failed, but errors are recoverable:");
  result.errors?.forEach((error, index) => {
    console.log(`Error ${index + 1}:`);
    console.log(`  Type: ${error.type}`);
    console.log(`  Message: ${error.message}`);
    console.log(
      `  Location: Line ${error.location?.line}, Column ${error.location?.column}`,
    );

    if (error.suggestions?.length) {
      console.log(`  Suggestions:`);
      error.suggestions.forEach((suggestion) => {
        console.log(`    - ${suggestion}`);
      });
    }
  });
}
```

### Incremental Parsing for Performance

```typescript
let previousTree: Tree | undefined;

const originalCode = `
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`;

// Initial parse
let result = await parser.parseIncremental(
  originalCode,
  "typescript",
  previousTree,
);
previousTree = result.ast?.tree;

// Update code incrementally
const updatedCode = `
function calculateTotal(items: Item[]): number {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const tax = total * 0.1;
  return total + tax;
}
`;

// Incremental parse (much faster)
result = await parser.parseIncremental(updatedCode, "typescript", previousTree);
console.log(`Incremental parse completed in ${result.metadata?.parseTime}ms`);
```

### Custom Language Support

```typescript
// Extend support for additional languages
const advancedParser = new TreeSitterManager({
  languages: ["typescript", "python", "rust", "go", "java"],
  performanceMode: "optimized",
  customLanguages: [
    {
      name: "dockerfile",
      grammarPath: "./grammars/tree-sitter-dockerfile.wasm",
      extensions: [".dockerfile", "Dockerfile"],
    },
  ],
});

// Parse Dockerfile
const dockerCode = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;

const dockerResult = await advancedParser.parseCode(dockerCode, "dockerfile");
```

---

## Enhanced Watch Command Examples

### Basic File Watching

```typescript
import { EnhancedWatcher } from "@ast-copilot-helper/ast-helper";

const watcher = new EnhancedWatcher({
  patterns: ["**/*.{ts,js,tsx,jsx}"],
  excludePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.{ts,js}",
    "**/coverage/**",
  ],
  debounceMs: 300,
  batchSize: 20,
});

// Handle individual file changes
watcher.on("change", (event) => {
  console.log(`File ${event.type}: ${event.path}`);
  console.log(`Size: ${event.metadata?.size} bytes`);
  console.log(`Modified: ${event.metadata?.modified}`);
});

// Handle batch changes (more efficient)
watcher.on("batch", (events) => {
  console.log(`Processing batch of ${events.length} changes:`);

  const byType = events.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} files`);
  });
});

await watcher.start("/path/to/project");
```

### Advanced Pattern Matching

```typescript
const advancedWatcher = new EnhancedWatcher({
  patterns: [
    // Source files
    "src/**/*.{ts,tsx}",

    // Configuration files
    "{package.json,tsconfig.json,*.config.{js,ts}}",

    // Documentation
    "**/*.{md,mdx}",

    // Test files (separate pattern for different handling)
    "**/*.{test,spec}.{ts,tsx}",
  ],
  excludePatterns: [
    // Dependencies
    "**/node_modules/**",

    // Build outputs
    "**/dist/**",
    "**/build/**",
    "**/.next/**",

    // IDE files
    "**/.vscode/**",
    "**/.idea/**",

    // Temporary files
    "**/*.tmp",
    "**/*.log",
  ],
  debounceMs: 250,
  batchSize: 50,
  performanceMode: true,
});

// Different handling for different file types
advancedWatcher.on("batch", (events) => {
  const sourceFiles = events.filter(
    (e) => e.path.match(/\.tsx?$/) && !e.path.includes(".test."),
  );

  const testFiles = events.filter((e) => e.path.match(/\.(test|spec)\.tsx?$/));

  const configFiles = events.filter((e) =>
    e.path.match(/(package\.json|tsconfig\.json|\.config\.)/),
  );

  if (sourceFiles.length > 0) {
    console.log(`Source files changed: ${sourceFiles.length}`);
    // Trigger TypeScript compilation
    runTypeScriptBuildIfChanged(sourceFiles);
  }

  if (testFiles.length > 0) {
    console.log(`Test files changed: ${testFiles.length}`);
    // Run tests
    runTestsForChangedFiles(testFiles);
  }

  if (configFiles.length > 0) {
    console.log(`Configuration changed: ${configFiles.length}`);
    // Restart development server
    restartDevServer();
  }
});
```

### Performance Monitoring

```typescript
const performanceWatcher = new EnhancedWatcher({
  patterns: ["**/*.{ts,js,py,rs,go}"],
  debounceMs: 200,
  batchSize: 100,
  performanceMode: true,
  maxConcurrency: 8,
});

// Monitor watcher performance
setInterval(() => {
  const stats = performanceWatcher.getStats();

  console.log("Watcher Performance:");
  console.log(`  Total files: ${stats.totalFiles}`);
  console.log(`  Watched files: ${stats.watchedFiles}`);
  console.log(`  Events processed: ${stats.processedEvents}`);
  console.log(`  Avg processing time: ${stats.averageProcessingTime}ms`);
  console.log(
    `  Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`  CPU usage: ${stats.cpuUsage.toFixed(2)}%`);
}, 10000);

await performanceWatcher.start("/large/project");
```

### Real-time Development Workflow

```typescript
const devWatcher = new EnhancedWatcher({
  patterns: ["src/**/*.{ts,tsx,scss,json}"],
  excludePatterns: ["**/*.d.ts", "**/node_modules/**"],
  debounceMs: 150,
  batchSize: 25,
});

interface BuildContext {
  typeScript: boolean;
  styles: boolean;
  assets: boolean;
}

devWatcher.on("batch", async (events) => {
  const context: BuildContext = {
    typeScript: false,
    styles: false,
    assets: false,
  };

  // Analyze what types of files changed
  events.forEach((event) => {
    if (event.path.match(/\.tsx?$/)) {
      context.typeScript = true;
    } else if (event.path.match(/\.s?css$/)) {
      context.styles = true;
    } else if (event.path.match(/\.(json|png|svg|jpg)$/)) {
      context.assets = true;
    }
  });

  // Execute builds in parallel based on context
  const buildTasks = [];

  if (context.typeScript) {
    buildTasks.push(compileTypeScript());
  }

  if (context.styles) {
    buildTasks.push(compileSass());
  }

  if (context.assets) {
    buildTasks.push(processAssets());
  }

  try {
    await Promise.all(buildTasks);
    console.log("✅ Build completed successfully");

    // Trigger hot reload
    notifyHotReload();
  } catch (error) {
    console.error("❌ Build failed:", error);
  }
});
```

---

## Advanced Annotations Examples

### Comprehensive Code Documentation

```typescript
import { AnnotationManager } from "@ast-copilot-helper/ast-helper";

const annotations = new AnnotationManager({
  validation: true,
  inheritance: true,
  relationships: true,
  versioning: true,
  storage: "file",
  storageOptions: {
    filePath: "./project-annotations.json",
    backupEnabled: true,
  },
});

// Document a complex function
await annotations.create({
  target: "function:UserService.createUser",
  type: "documentation",
  content: `
    Creates a new user in the system with comprehensive validation and security checks.
    
    This function performs several operations:
    1. Validates input data using Joi schemas
    2. Checks for duplicate email addresses
    3. Hashes the password using bcrypt
    4. Generates a unique user ID
    5. Stores the user in the database
    6. Sends a welcome email
    
    Error handling includes retry logic for database operations and 
    graceful degradation for email service failures.
  `,
  metadata: {
    complexity: "high",
    performance: "medium",
    security: "critical",
    parameters: [
      {
        name: "userData",
        type: "CreateUserRequest",
        required: true,
        description: "User data including email, password, and profile info",
      },
    ],
    returns: {
      type: "Promise<User>",
      description: "Newly created user object with generated ID",
    },
    throws: [
      "ValidationError: Invalid input data",
      "DuplicateEmailError: Email already exists",
      "DatabaseError: Database operation failed",
    ],
    examples: [
      {
        description: "Basic user creation",
        code: `
          const user = await userService.createUser({
            email: 'john@example.com',
            password: 'securePassword123',
            profile: { firstName: 'John', lastName: 'Doe' }
          });
        `,
      },
    ],
  },
  relationships: [
    { type: "depends_on", target: "function:ValidationService.validate" },
    { type: "depends_on", target: "function:EmailService.sendWelcome" },
    { type: "implements", target: "interface:IUserService.createUser" },
  ],
  tags: ["user-management", "security", "validation", "email"],
});
```

### Project Architecture Documentation

```typescript
// Document system architecture
await annotations.create({
  target: "module:UserService",
  type: "documentation",
  content: `
    # User Service Architecture
    
    The UserService is a core component responsible for all user-related operations
    in the system. It follows a layered architecture pattern:
    
    ## Layers
    1. **Controller Layer**: Handles HTTP requests and responses
    2. **Service Layer**: Contains business logic and orchestration
    3. **Repository Layer**: Manages data persistence
    4. **Validation Layer**: Ensures data integrity
    
    ## Dependencies
    - Database: PostgreSQL with TypeORM
    - Cache: Redis for session management
    - Email: SendGrid for notifications
    - Validation: Joi for schema validation
    
    ## Security Considerations
    - All passwords are hashed using bcrypt with salt rounds of 12
    - Input validation prevents SQL injection and XSS attacks
    - Rate limiting prevents brute force attacks
    - JWT tokens expire after 24 hours
  `,
  metadata: {
    category: "architecture",
    level: "system",
    audience: ["developers", "architects", "security-team"],
    maintainers: ["john.doe@company.com", "jane.smith@company.com"],
    lastReviewed: new Date("2024-01-15"),
    nextReview: new Date("2024-04-15"),
    dependencies: [
      "postgresql",
      "redis",
      "sendgrid",
      "joi",
      "bcrypt",
      "jsonwebtoken",
    ],
  },
  tags: ["architecture", "user-service", "security", "dependencies"],
});
```

### Performance and Optimization Annotations

```typescript
// Mark performance-critical code sections
await annotations.create({
  target: "function:DataProcessor.processLargeDataset",
  type: "performance",
  content: `
    PERFORMANCE CRITICAL: This function processes large datasets and is a key
    performance bottleneck. Current optimization strategies:
    
    1. Streaming processing to handle datasets larger than memory
    2. Parallel processing using worker threads
    3. Intelligent caching of intermediate results
    4. Progressive result reporting for user feedback
    
    Benchmark results (1M records):
    - Memory usage: ~200MB peak
    - Processing time: 45-60 seconds
    - CPU utilization: 80-90%
    
    Known issues:
    - Memory usage spikes during sort operations
    - Performance degrades significantly with corrupted data
    - Cold start penalty of ~5 seconds for worker thread initialization
  `,
  metadata: {
    benchmarks: {
      small: { records: 1000, timeMs: 150, memoryMB: 25 },
      medium: { records: 100000, timeMs: 8500, memoryMB: 85 },
      large: { records: 1000000, timeMs: 52000, memoryMB: 200 },
    },
    optimizations: [
      "streaming",
      "parallel-processing",
      "caching",
      "progressive-reporting",
    ],
    bottlenecks: [
      "sort-operations",
      "data-validation",
      "worker-initialization",
    ],
    targetMetrics: {
      maxTimeMs: 45000,
      maxMemoryMB: 150,
      minThroughput: 20000, // records/second
    },
  },
  tags: ["performance", "critical", "optimization", "bottleneck"],
});

// Security annotation
await annotations.create({
  target: "function:AuthController.login",
  type: "security",
  content: `
    SECURITY CRITICAL: Authentication endpoint with multiple security measures:
    
    Security implementations:
    1. Rate limiting: 5 attempts per minute per IP
    2. Account lockout: 10 failed attempts locks for 30 minutes
    3. Password hashing: bcrypt with 12 salt rounds
    4. Session management: Secure HTTP-only cookies
    5. Audit logging: All authentication events logged
    
    Security considerations:
    - Timing attack prevention through constant-time comparisons
    - CSRF protection via SameSite cookies
    - SQL injection prevention through parameterized queries
    - Input sanitization prevents XSS attacks
  `,
  metadata: {
    securityLevel: "critical",
    threats: [
      "brute-force-attacks",
      "timing-attacks",
      "csrf",
      "sql-injection",
      "xss",
    ],
    mitigations: [
      "rate-limiting",
      "account-lockout",
      "secure-hashing",
      "secure-cookies",
      "audit-logging",
      "input-sanitization",
    ],
    compliance: ["GDPR", "SOC2", "PCI-DSS"],
    lastSecurityReview: new Date("2024-01-10"),
    nextSecurityReview: new Date("2024-04-10"),
  },
  tags: ["security", "authentication", "critical", "compliance"],
});
```

### Complex Relationship Management

```typescript
// Create annotations with complex relationships
const authAnnotation = await annotations.create({
  target: "class:AuthController",
  type: "documentation",
  content: "Main authentication controller handling user login/logout",
  tags: ["authentication", "controller"],
});

const userServiceAnnotation = await annotations.create({
  target: "class:UserService",
  type: "documentation",
  content: "Service layer for user management operations",
  tags: ["user-management", "service"],
});

const authMiddlewareAnnotation = await annotations.create({
  target: "function:authMiddleware",
  type: "documentation",
  content: "Middleware for protecting authenticated routes",
  tags: ["authentication", "middleware"],
});

// Establish complex relationships
await annotations.update(authAnnotation.id, {
  relationships: [
    {
      type: "depends_on",
      target: userServiceAnnotation.id,
      metadata: {
        strength: 0.9,
        description: "Auth controller depends heavily on user service",
      },
    },
    {
      type: "related",
      target: authMiddlewareAnnotation.id,
      metadata: {
        strength: 0.7,
        description: "Auth controller works with auth middleware",
      },
    },
  ],
});

// Query related annotations
const authRelated = await annotations.query({
  relationships: {
    type: "depends_on",
    strength: { min: 0.8 },
  },
  includeRelated: true,
});

console.log(
  `Found ${authRelated.annotations.length} strongly related components`,
);
```

### Advanced Querying and Filtering

```typescript
// Complex query with multiple filters
const complexQuery = await annotations.query({
  type: ["performance", "security"],
  metadata: {
    complexity: ["high", "critical"],
    lastReviewed: {
      before: new Date("2024-01-01"),
    },
  },
  tags: ["critical"],
  relationships: {
    hasType: "depends_on",
    count: { min: 2 },
  },
  dateRange: {
    from: new Date("2023-01-01"),
    to: new Date("2024-12-31"),
  },
  sortBy: "priority",
  sortOrder: "desc",
  limit: 50,
});

// Process results
complexQuery.annotations.forEach((annotation) => {
  console.log(`${annotation.type}: ${annotation.target}`);
  console.log(`  Priority: ${annotation.priority}`);
  console.log(`  Tags: ${annotation.tags.join(", ")}`);
  console.log(`  Relationships: ${annotation.relationships.length}`);

  if (annotation.metadata.lastReviewed) {
    const daysSinceReview = Math.floor(
      (Date.now() - annotation.metadata.lastReviewed.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    console.log(`  Days since review: ${daysSinceReview}`);
  }
});
```

---

## Performance Optimization Examples

### Complete Performance Suite

```typescript
import { PerformanceOptimizer } from "@ast-copilot-helper/ast-helper";

const optimizer = new PerformanceOptimizer({
  memory: {
    enabled: true,
    gcThreshold: 0.8, // Trigger GC at 80% heap usage
    leakDetection: true, // Enable memory leak detection
    maxHeapSize: 512 * 1024 * 1024, // 512MB max heap
    cleanupInterval: 30000, // Cleanup every 30 seconds
    aggressive: false, // Conservative cleanup
  },
  cache: {
    enabled: true,
    maxMemory: 128 * 1024 * 1024, // 128MB cache
    evictionPolicy: "lru", // Least Recently Used
    ttl: 3600000, // 1 hour TTL
    maxItems: 10000, // Max 10k items
    compression: true, // Compress cached data
  },
  processing: {
    enabled: true,
    maxConcurrency: 8, // 8 concurrent workers
    batchSize: 100, // Process 100 items per batch
    queueMaxSize: 1000, // Max queue size
    circuitBreaker: {
      enabled: true,
      failureThreshold: 10, // Open after 10 failures
      resetTimeout: 60000, // Reset after 1 minute
    },
    priorityLevels: 5, // 5 priority levels
  },
  monitoring: {
    enabled: true,
    metricsInterval: 5000, // Collect metrics every 5 seconds
    historySize: 1000, // Keep 1000 metric points
    exporters: [
      {
        type: "console",
        interval: 30000, // Log every 30 seconds
      },
      {
        type: "prometheus",
        endpoint: "http://localhost:9090",
      },
    ],
  },
  alerting: {
    enabled: true,
    channels: ["console", "webhook"],
    rules: [
      {
        name: "high_memory_usage",
        condition: "memory.heapUsed > 400MB",
        severity: "warning",
        threshold: 400 * 1024 * 1024,
        enabled: true,
      },
      {
        name: "low_cache_hit_rate",
        condition: "cache.hitRate < 0.8",
        severity: "warning",
        threshold: 0.8,
        enabled: true,
      },
      {
        name: "high_error_rate",
        condition: "processing.errorRate > 0.05",
        severity: "error",
        threshold: 0.05,
        enabled: true,
      },
    ],
  },
});

// Start comprehensive optimization
async function runOptimization() {
  console.log("Starting performance optimization...");

  // Run initial optimization
  const result = await optimizer.optimize();

  console.log("Optimization Results:");
  console.log(`  Success: ${result.success}`);
  console.log(`  Optimizations applied: ${result.optimizations.length}`);
  console.log(`  Duration: ${result.duration}ms`);

  // Show improvements
  const improvements = result.improvements;
  console.log("\nPerformance Improvements:");
  console.log(`  Memory reduction: ${improvements.memoryReduction}%`);
  console.log(`  Speed improvement: ${improvements.speedImprovement}%`);
  console.log(`  Cache efficiency: ${improvements.cacheEfficiency}%`);
  console.log(`  Overall score: ${improvements.overallScore}/100`);

  // Show recommendations
  console.log("\nRecommendations:");
  result.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec.title}`);
    console.log(`     Priority: ${rec.priority}`);
    console.log(`     Impact: ${rec.expectedImpact}`);
    console.log(`     Description: ${rec.description}`);
  });
}

await runOptimization();
```

### Memory Management and Leak Detection

```typescript
// Comprehensive memory monitoring
async function monitorMemoryUsage() {
  // Start monitoring
  optimizer.startMonitoring();

  // Get detailed memory report
  const memoryReport = await optimizer.monitorMemory();

  console.log("Memory Analysis:");
  console.log(`  Current heap usage: ${memoryReport.current.heapUsed} bytes`);
  console.log(`  Heap total: ${memoryReport.current.heapTotal} bytes`);
  console.log(`  External memory: ${memoryReport.current.external} bytes`);
  console.log(`  RSS: ${memoryReport.current.rss} bytes`);
  console.log(`  GC count: ${memoryReport.current.gcCount}`);
  console.log(`  GC duration: ${memoryReport.current.gcDuration}ms`);
  console.log(`  Leak detected: ${memoryReport.current.leakDetected}`);

  // Analyze memory trends
  console.log("\nMemory Trends:");
  memoryReport.trends.forEach((trend, index) => {
    console.log(`  Period ${index + 1}:`);
    console.log(`    Growth rate: ${trend.growthRate}%`);
    console.log(`    Peak usage: ${trend.peakUsage} bytes`);
    console.log(`    Average usage: ${trend.averageUsage} bytes`);
  });

  // Check for memory leaks
  if (memoryReport.leaks.length > 0) {
    console.log("\n⚠️ Memory Leaks Detected:");
    memoryReport.leaks.forEach((leak, index) => {
      console.log(`  Leak ${index + 1}:`);
      console.log(`    Type: ${leak.type}`);
      console.log(`    Size: ${leak.size} bytes`);
      console.log(`    Location: ${leak.location}`);
      console.log(`    Stack trace: ${leak.stackTrace}`);
    });
  }

  // Apply memory recommendations
  console.log("\nMemory Recommendations:");
  memoryReport.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec.action}`);
    console.log(`     Impact: ${rec.impact}`);
    console.log(`     Priority: ${rec.priority}`);
  });
}

// Monitor memory every minute
setInterval(monitorMemoryUsage, 60000);
```

### Cache Optimization

```typescript
// Advanced cache management
async function optimizeCache() {
  const cacheOptimization = await optimizer.optimizeCache();

  console.log("Cache Optimization Results:");
  console.log(`  Strategy: ${cacheOptimization.strategy}`);
  console.log(
    `  Hit rate improvement: ${cacheOptimization.hitRateImprovement}%`,
  );
  console.log(`  Memory reduction: ${cacheOptimization.memoryReduction} bytes`);
  console.log(
    `  Response time improvement: ${cacheOptimization.responseTimeImprovement}ms`,
  );

  // Implement recommended cache policies
  cacheOptimization.recommendations.forEach((rec) => {
    console.log(`Recommendation: ${rec.policy}`);
    console.log(`  Expected improvement: ${rec.expectedImprovement}%`);
    console.log(`  Implementation: ${rec.implementation}`);
  });

  // Monitor cache performance
  const cacheStats = await optimizer.getPerformanceStats();
  const cache = cacheStats.metrics.cache;

  console.log("\nCache Performance:");
  console.log(`  Hit rate: ${(cache.hitRate * 100).toFixed(2)}%`);
  console.log(`  Miss rate: ${(cache.missRate * 100).toFixed(2)}%`);
  console.log(`  Eviction rate: ${(cache.evictionRate * 100).toFixed(2)}%`);
  console.log(`  Memory usage: ${cache.memoryUsage} bytes`);
  console.log(`  Item count: ${cache.itemCount}`);
  console.log(`  Avg response time: ${cache.averageResponseTime}ms`);
}
```

### Batch Processing Optimization

```typescript
// Optimize batch processing with priorities
async function processBatchWithOptimization() {
  const items = [
    { id: 1, priority: "high", data: "critical task" },
    { id: 2, priority: "medium", data: "normal task" },
    { id: 3, priority: "low", data: "background task" },
    // ... more items
  ];

  // Process with optimization
  const result = await optimizer.processWithOptimization(
    items,
    async (item) => {
      // Simulate processing time based on priority
      const processingTime =
        item.priority === "high"
          ? 100
          : item.priority === "medium"
            ? 500
            : 1000;

      await new Promise((resolve) => setTimeout(resolve, processingTime));

      return {
        id: item.id,
        result: `Processed: ${item.data}`,
        processingTime,
      };
    },
  );

  console.log("Batch Processing Results:");
  console.log(`  Total items: ${result.totalItems}`);
  console.log(`  Successful: ${result.successful}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Total time: ${result.totalTime}ms`);
  console.log(`  Average time per item: ${result.averageTime}ms`);
  console.log(`  Throughput: ${result.throughput} items/second`);

  // Show performance breakdown by priority
  console.log("\nPriority Breakdown:");
  Object.entries(result.priorityStats).forEach(([priority, stats]) => {
    console.log(`  ${priority}:`);
    console.log(`    Count: ${stats.count}`);
    console.log(`    Avg time: ${stats.averageTime}ms`);
    console.log(`    Success rate: ${stats.successRate}%`);
  });
}
```

### Real-time Performance Dashboard

```typescript
// Create a real-time performance dashboard
function createPerformanceDashboard() {
  console.clear();

  setInterval(async () => {
    const stats = await optimizer.getPerformanceStats();

    console.clear();
    console.log("=".repeat(60));
    console.log("           PERFORMANCE DASHBOARD");
    console.log("=".repeat(60));
    console.log(`Timestamp: ${new Date(stats.timestamp).toLocaleString()}`);
    console.log();

    // Memory metrics
    const memory = stats.metrics.memory;
    console.log("MEMORY:");
    console.log(`  Heap Used:     ${formatBytes(memory.heapUsed)}`);
    console.log(`  Heap Total:    ${formatBytes(memory.heapTotal)}`);
    console.log(`  External:      ${formatBytes(memory.external)}`);
    console.log(`  RSS:           ${formatBytes(memory.rss)}`);
    console.log(`  GC Count:      ${memory.gcCount}`);
    console.log(`  GC Duration:   ${memory.gcDuration}ms`);
    console.log(
      `  Leak Status:   ${memory.leakDetected ? "⚠️ DETECTED" : "✅ CLEAN"}`,
    );
    console.log();

    // Cache metrics
    const cache = stats.metrics.cache;
    console.log("CACHE:");
    console.log(`  Hit Rate:      ${(cache.hitRate * 100).toFixed(2)}%`);
    console.log(`  Miss Rate:     ${(cache.missRate * 100).toFixed(2)}%`);
    console.log(`  Memory Usage:  ${formatBytes(cache.memoryUsage)}`);
    console.log(`  Item Count:    ${cache.itemCount.toLocaleString()}`);
    console.log(`  Avg Response:  ${cache.averageResponseTime.toFixed(2)}ms`);
    console.log();

    // Processing metrics
    const processing = stats.metrics.processing;
    console.log("PROCESSING:");
    console.log(
      `  Throughput:    ${processing.throughput.toFixed(2)} items/sec`,
    );
    console.log(`  Avg Latency:   ${processing.averageLatency.toFixed(2)}ms`);
    console.log(`  Error Rate:    ${(processing.errorRate * 100).toFixed(2)}%`);
    console.log(`  Queue Size:    ${processing.queueSize}`);
    console.log(`  Active Workers:${processing.activeWorkers}`);
    console.log(
      `  Completed Jobs:${processing.completedJobs.toLocaleString()}`,
    );
    console.log();

    // System metrics
    const system = stats.metrics.system;
    console.log("SYSTEM:");
    console.log(`  CPU Usage:     ${system.cpuUsage.toFixed(2)}%`);
    console.log(`  Memory Usage:  ${system.memoryUsage.toFixed(2)}%`);
    console.log(`  Uptime:        ${formatUptime(system.uptime)}`);
    console.log(
      `  Load Average:  ${system.loadAverage.map((l) => l.toFixed(2)).join(", ")}`,
    );
    console.log();

    // Health status
    const health = stats.health;
    console.log("HEALTH:");
    console.log(
      `  Overall:       ${getHealthEmoji(health.overall)} ${health.overall.toUpperCase()}`,
    );
    health.components.forEach((component) => {
      console.log(
        `  ${component.component.padEnd(12)}: ${getHealthEmoji(component.status)} ${component.status}`,
      );
    });

    console.log("=".repeat(60));
  }, 5000);
}

// Helper functions
function formatBytes(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function getHealthEmoji(status: string): string {
  const emojis = {
    healthy: "✅",
    warning: "⚠️",
    critical: "🔴",
    unknown: "❓",
  };
  return emojis[status] || "❓";
}

// Start the dashboard
createPerformanceDashboard();
```

---

## Real-world Integration Examples

### Complete Development Workflow

```typescript
import {
  TreeSitterManager,
  EnhancedWatcher,
  AnnotationManager,
  PerformanceOptimizer,
} from "@ast-copilot-helper/ast-helper";

class DevelopmentWorkflow {
  private parser: TreeSitterManager;
  private watcher: EnhancedWatcher;
  private annotations: AnnotationManager;
  private optimizer: PerformanceOptimizer;

  constructor() {
    this.parser = new TreeSitterManager({
      languages: ["typescript", "javascript", "python", "rust"],
      performanceMode: "development",
      errorRecovery: true,
      caching: true,
    });

    this.watcher = new EnhancedWatcher({
      patterns: ["src/**/*.{ts,js,py,rs}", "tests/**/*.{ts,js}"],
      excludePatterns: ["**/node_modules/**", "**/target/**"],
      debounceMs: 200,
      batchSize: 30,
    });

    this.annotations = new AnnotationManager({
      validation: true,
      relationships: true,
      versioning: true,
      storage: "file",
    });

    this.optimizer = new PerformanceOptimizer({
      memory: { enabled: true, gcThreshold: 0.9 },
      cache: { enabled: true, maxMemory: 64 * 1024 * 1024 },
      processing: { enabled: true, maxConcurrency: 4 },
      monitoring: { enabled: true, metricsInterval: 10000 },
    });
  }

  async start(projectPath: string) {
    console.log("Starting development workflow...");

    // Initialize performance monitoring
    this.optimizer.startMonitoring();

    // Set up file watching with integrated processing
    this.watcher.on("batch", async (events) => {
      console.log(`Processing ${events.length} file changes...`);

      for (const event of events) {
        if (event.type === "change" || event.type === "add") {
          await this.processFile(event.path);
        } else if (event.type === "unlink") {
          await this.cleanupFile(event.path);
        }
      }

      // Run optimization after batch processing
      await this.optimizer.optimize();
    });

    // Start watching
    await this.watcher.start(projectPath);
    console.log("Development workflow started successfully");
  }

  private async processFile(filePath: string) {
    try {
      // Parse the file
      const parseResult = await this.parser.parseFile(filePath);

      if (parseResult.success && parseResult.ast) {
        // Extract meaningful information from AST
        const analysis = this.analyzeAST(parseResult.ast, filePath);

        // Create or update annotations based on analysis
        await this.updateAnnotations(filePath, analysis);

        // Check for performance issues
        await this.checkPerformanceIssues(filePath, analysis);

        console.log(`✅ Processed ${filePath} successfully`);
      } else {
        console.log(`❌ Failed to parse ${filePath}`);

        // Create annotation for parsing errors
        if (parseResult.errors) {
          await this.annotations.create({
            target: `file:${filePath}`,
            type: "bug",
            content: `Parsing errors found: ${parseResult.errors.length} issues`,
            metadata: {
              errors: parseResult.errors,
              severity: "high",
              category: "syntax",
            },
            tags: ["parsing-error", "syntax"],
          });
        }
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  private analyzeAST(ast: any, filePath: string) {
    const analysis = {
      functions: [],
      classes: [],
      complexity: 0,
      linesOfCode: 0,
      potentialIssues: [],
    };

    // Walk the AST and extract information
    this.walkAST(ast, (node) => {
      switch (node.type) {
        case "function_declaration":
        case "method_definition":
          const func = this.analyzeFunctionNode(node, filePath);
          analysis.functions.push(func);
          analysis.complexity += func.complexity;
          break;

        case "class_declaration":
          const cls = this.analyzeClassNode(node, filePath);
          analysis.classes.push(cls);
          break;

        case "for_statement":
        case "while_statement":
          // Check for potential infinite loops
          if (this.mightBeInfiniteLoop(node)) {
            analysis.potentialIssues.push({
              type: "infinite-loop",
              location: node.startPosition,
              message: "Potential infinite loop detected",
            });
          }
          break;
      }
    });

    analysis.linesOfCode = ast.endPosition.row + 1;
    return analysis;
  }

  private async updateAnnotations(filePath: string, analysis: any) {
    // Create function documentation annotations
    for (const func of analysis.functions) {
      if (func.complexity > 10) {
        await this.annotations.create({
          target: `function:${func.name}`,
          type: "performance",
          content: `High complexity function (${func.complexity}). Consider refactoring.`,
          metadata: {
            complexity: func.complexity,
            file: filePath,
            lines: func.lineCount,
            parameters: func.parameters.length,
          },
          tags: ["high-complexity", "refactor-candidate"],
        });
      }

      if (func.parameters.length > 5) {
        await this.annotations.create({
          target: `function:${func.name}`,
          type: "refactor",
          content: `Function has many parameters (${func.parameters.length}). Consider using an options object.`,
          metadata: {
            parameterCount: func.parameters.length,
            file: filePath,
            suggestion: "Use options object pattern",
          },
          tags: ["too-many-parameters", "refactor"],
        });
      }
    }

    // Create class documentation annotations
    for (const cls of analysis.classes) {
      await this.annotations.create({
        target: `class:${cls.name}`,
        type: "documentation",
        content: `Class with ${cls.methods.length} methods and ${cls.properties.length} properties`,
        metadata: {
          file: filePath,
          methodCount: cls.methods.length,
          propertyCount: cls.properties.length,
          isExported: cls.isExported,
        },
        tags: ["class-documentation"],
      });
    }

    // Create annotations for potential issues
    for (const issue of analysis.potentialIssues) {
      await this.annotations.create({
        target: `file:${filePath}:${issue.location.row}`,
        type: "bug",
        content: issue.message,
        metadata: {
          issueType: issue.type,
          location: issue.location,
          file: filePath,
          severity: "medium",
        },
        tags: ["potential-issue", issue.type],
      });
    }
  }

  private async checkPerformanceIssues(filePath: string, analysis: any) {
    const stats = await this.optimizer.getPerformanceStats();

    // Check if file processing is taking too long
    if (stats.metrics.processing.averageLatency > 1000) {
      await this.annotations.create({
        target: `file:${filePath}`,
        type: "performance",
        content: `File processing is slow (${stats.metrics.processing.averageLatency}ms). Consider optimization.`,
        metadata: {
          processingTime: stats.metrics.processing.averageLatency,
          complexity: analysis.complexity,
          linesOfCode: analysis.linesOfCode,
        },
        tags: ["slow-processing", "performance"],
      });
    }
  }

  private async cleanupFile(filePath: string) {
    // Remove annotations for deleted file
    const annotations = await this.annotations.query({
      metadata: { file: filePath },
    });

    for (const annotation of annotations.annotations) {
      await this.annotations.delete(annotation.id);
    }

    console.log(`🗑️ Cleaned up annotations for deleted file: ${filePath}`);
  }

  // Helper methods for AST analysis
  private walkAST(node: any, callback: (node: any) => void) {
    callback(node);
    if (node.children) {
      for (const child of node.children) {
        this.walkAST(child, callback);
      }
    }
  }

  private analyzeFunctionNode(node: any, filePath: string) {
    return {
      name: this.getFunctionName(node),
      complexity: this.calculateCyclomaticComplexity(node),
      lineCount: node.endPosition.row - node.startPosition.row + 1,
      parameters: this.extractParameters(node),
      file: filePath,
      startLine: node.startPosition.row + 1,
    };
  }

  private analyzeClassNode(node: any, filePath: string) {
    return {
      name: this.getClassName(node),
      methods: this.extractMethods(node),
      properties: this.extractProperties(node),
      isExported: this.isExported(node),
      file: filePath,
      startLine: node.startPosition.row + 1,
    };
  }

  private calculateCyclomaticComplexity(node: any): number {
    let complexity = 1; // Base complexity

    this.walkAST(node, (childNode) => {
      // Add complexity for control flow statements
      if (
        [
          "if_statement",
          "while_statement",
          "for_statement",
          "switch_statement",
          "case_clause",
          "catch_clause",
        ].includes(childNode.type)
      ) {
        complexity++;
      }
    });

    return complexity;
  }

  private mightBeInfiniteLoop(node: any): boolean {
    // Simple heuristic: loop without obvious termination condition
    const hasBreak = this.hasBreakStatement(node);
    const hasReturn = this.hasReturnStatement(node);
    const hasThrow = this.hasThrowStatement(node);

    return !(hasBreak || hasReturn || hasThrow);
  }

  // Additional helper methods...
  private getFunctionName(node: any): string {
    /* implementation */ return "";
  }
  private getClassName(node: any): string {
    /* implementation */ return "";
  }
  private extractParameters(node: any): any[] {
    /* implementation */ return [];
  }
  private extractMethods(node: any): any[] {
    /* implementation */ return [];
  }
  private extractProperties(node: any): any[] {
    /* implementation */ return [];
  }
  private isExported(node: any): boolean {
    /* implementation */ return false;
  }
  private hasBreakStatement(node: any): boolean {
    /* implementation */ return false;
  }
  private hasReturnStatement(node: any): boolean {
    /* implementation */ return false;
  }
  private hasThrowStatement(node: any): boolean {
    /* implementation */ return false;
  }
}

// Usage
const workflow = new DevelopmentWorkflow();
await workflow.start("/path/to/project");
```

This comprehensive example demonstrates how all Issue #150 components work together to create a powerful development workflow with intelligent code analysis, performance optimization, and comprehensive documentation management.
