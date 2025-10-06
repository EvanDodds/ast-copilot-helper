# Watch Command Enhancement Guide

This guide covers the advanced watch command implementation for AST Copilot Helper, providing sophisticated file monitoring capabilities with intelligent change detection and performance optimization.

## Overview

The enhanced watch command provides:

- **Advanced Pattern Matching**: Sophisticated glob patterns with exclusions
- **Intelligent Debouncing**: Configurable debouncing and throttling
- **Batch Processing**: Efficient handling of multiple file changes
- **Change Classification**: Detailed analysis of modification types
- **Performance Monitoring**: Real-time statistics and optimization

## Architecture

### Core Components

#### 1. Watch Manager (`packages/ast-helper/src/commands/watch/`)

Central coordinator for file watching operations:

```typescript
import { WatchManager } from "@ast-copilot-helper/ast-helper";

const watcher = new WatchManager({
  patterns: ["src/**/*.ts", "test/**/*.test.ts"],
  excludePatterns: ["node_modules/**", "dist/**"],
  debounceMs: 300,
  batchSize: 10,
});

await watcher.start();
```

#### 2. Pattern Engine

Advanced glob pattern matching with intelligent exclusions:

```typescript
// Include patterns
const includePatterns = [
  "src/**/*.{ts,js,tsx,jsx}", // Source files
  "test/**/*.{test,spec}.ts", // Test files
  "docs/**/*.md", // Documentation
  "*.config.{js,ts,json}", // Config files
];

// Exclude patterns
const excludePatterns = [
  "node_modules/**", // Dependencies
  "dist/**", // Build output
  ".git/**", // Git files
  "**/*.{log,tmp,cache}", // Temporary files
];
```

#### 3. Change Detector

Analyzes file changes and classifies modification types:

```typescript
interface FileChange {
  path: string;
  type: "created" | "modified" | "deleted" | "renamed";
  timestamp: number;
  size?: number;
  hash?: string;
  previousHash?: string;
}
```

## Usage Examples

### Basic Watch Setup

```typescript
import { watchFiles } from "@ast-copilot-helper/ast-helper";

// Simple file watching
await watchFiles(["src/**/*.ts"], {
  onFileChange: (changes) => {
    console.log(`${changes.length} files changed`);
    changes.forEach((change) => {
      console.log(`${change.type}: ${change.path}`);
    });
  },
});
```

### Advanced Configuration

```typescript
import { WatchManager, WatchConfig } from "@ast-copilot-helper/ast-helper";

const config: WatchConfig = {
  // File patterns
  patterns: ["src/**/*.{ts,tsx,js,jsx}"],
  excludePatterns: ["**/*.test.ts", "node_modules/**"],

  // Performance tuning
  debounceMs: 500, // Wait 500ms before processing
  throttleMs: 100, // Max 10 events per second
  batchSize: 20, // Process up to 20 files at once

  // Change detection
  useHashing: true, // Enable content hashing
  detectRenames: true, // Detect file renames
  followSymlinks: false, // Don't follow symbolic links

  // Monitoring
  enableMetrics: true, // Collect performance metrics
  logLevel: "info", // Log level for watch events
};

const watcher = new WatchManager(config);

// Event handlers
watcher.on("change", (changes) => {
  console.log(`Batch of ${changes.length} changes processed`);
});

watcher.on("error", (error) => {
  console.error("Watch error:", error.message);
});

watcher.on("ready", () => {
  console.log("File watcher is ready");
});

await watcher.start();
```

## Pattern Matching

### Glob Patterns

The watch system supports advanced glob patterns:

```typescript
const patterns = [
  // Basic wildcards
  "*.ts", // All .ts files in current directory
  "**/*.js", // All .js files recursively

  // Character classes
  "src/[abc]*.ts", // Files starting with a, b, or c
  "test/**/*.{test,spec}.ts", // Test files with multiple extensions

  // Negation
  "!node_modules/**", // Exclude node_modules
  "!dist/**", // Exclude build output

  // Complex patterns
  "src/**/!(*.test).ts", // All .ts files except tests
  "packages/*/src/**/*.ts", // Multiple package sources
];
```

### Pattern Priority

Pattern evaluation follows priority rules:

1. **Explicit Excludes**: `excludePatterns` always take priority
2. **Negation Patterns**: `!pattern` excludes matching files
3. **Include Patterns**: `patterns` define files to watch
4. **Default Excludes**: Built-in excludes for common directories

## Change Detection

### Change Types

The system detects various types of file changes:

```typescript
interface ChangeDetails {
  type: "created" | "modified" | "deleted" | "renamed";
  path: string;
  previousPath?: string; // For renames
  timestamp: number;
  metadata: {
    size: number;
    hash?: string; // Content hash for change verification
    previousHash?: string; // Previous content hash
    isDirectory: boolean;
  };
}
```

### Content Hashing

Enable content-based change detection:

```typescript
const watcher = new WatchManager({
  patterns: ["src/**/*.ts"],
  useHashing: true, // Enable SHA256 hashing
  hashAlgorithm: "md5", // Alternative: 'md5', 'sha1', 'sha256'

  onFileChange: (changes) => {
    changes.forEach((change) => {
      if (change.metadata.hash !== change.metadata.previousHash) {
        console.log(`Content changed: ${change.path}`);
      }
    });
  },
});
```

## Performance Optimization

### Debouncing and Throttling

Control event frequency to optimize performance:

```typescript
const config = {
  // Debouncing: Wait for quiet period before processing
  debounceMs: 300, // Wait 300ms after last change

  // Throttling: Limit maximum event frequency
  throttleMs: 100, // Max 10 events per second

  // Batch processing: Group changes together
  batchSize: 15, // Process up to 15 files at once
  maxBatchWait: 1000, // Max wait time for batch completion
};
```

### Resource Management

Optimize resource usage for large projects:

```typescript
const watcher = new WatchManager({
  patterns: ["**/*.{ts,js,tsx,jsx}"],

  // Memory optimization
  maxWatchers: 1000, // Limit concurrent watchers
  cacheSize: 500, // Hash cache size
  cleanupInterval: 60000, // Cleanup interval (1 minute)

  // I/O optimization
  readBufferSize: 64 * 1024, // 64KB read buffer
  concurrent: 4, // Max concurrent file operations

  // System limits
  maxFileSize: 10 * 1024 * 1024, // Skip files > 10MB
  skipBinaryFiles: true, // Skip binary files
});
```

## Event Handling

### Event Types

The watch system emits various events:

```typescript
watcher.on("ready", () => {
  console.log("Watcher initialized and ready");
});

watcher.on("change", (changes: FileChange[]) => {
  console.log(`${changes.length} files changed`);
});

watcher.on("error", (error: WatchError) => {
  console.error(`Watch error: ${error.message}`);
});

watcher.on("add", (filePath: string) => {
  console.log(`File added: ${filePath}`);
});

watcher.on("unlink", (filePath: string) => {
  console.log(`File removed: ${filePath}`);
});

watcher.on("addDir", (dirPath: string) => {
  console.log(`Directory added: ${dirPath}`);
});

watcher.on("unlinkDir", (dirPath: string) => {
  console.log(`Directory removed: ${dirPath}`);
});
```

### Custom Event Handlers

Create specialized event handlers:

```typescript
class ProjectWatcher extends WatchManager {
  protected async handleSourceChange(changes: FileChange[]) {
    const sourceFiles = changes.filter((c) => c.path.endsWith(".ts"));
    if (sourceFiles.length > 0) {
      await this.runTypeCheck();
    }
  }

  protected async handleTestChange(changes: FileChange[]) {
    const testFiles = changes.filter((c) => c.path.includes(".test."));
    if (testFiles.length > 0) {
      await this.runTests(testFiles.map((f) => f.path));
    }
  }

  private async runTypeCheck() {
    // Custom type checking logic
  }

  private async runTests(testFiles: string[]) {
    // Custom test runner logic
  }
}
```

## Integration Examples

### CI/CD Integration

Integrate with build systems and CI/CD pipelines:

```typescript
import { WatchManager } from "@ast-copilot-helper/ast-helper";
import { spawn } from "child_process";

const watcher = new WatchManager({
  patterns: ["src/**/*.ts", "test/**/*.ts"],

  onFileChange: async (changes) => {
    const hasSourceChanges = changes.some(
      (c) => c.path.startsWith("src/") && !c.path.includes(".test."),
    );

    if (hasSourceChanges) {
      // Run build
      await runCommand("npm run build");

      // Run tests
      await runCommand("npm test");

      // Update documentation
      await runCommand("npm run docs:generate");
    }
  },
});

function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, { stdio: "inherit" });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}
```

### Development Server Integration

Integrate with development servers for hot reloading:

```typescript
import { WatchManager } from "@ast-copilot-helper/ast-helper";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const watcher = new WatchManager({
  patterns: ["src/**/*.{ts,tsx,js,jsx}", "public/**/*"],

  onFileChange: (changes) => {
    // Notify connected clients
    const message = JSON.stringify({
      type: "file-changed",
      changes: changes.map((c) => ({
        path: c.path,
        type: c.type,
        timestamp: c.timestamp,
      })),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  },
});

await watcher.start();
console.log("Development server with hot reload started");
```

## Monitoring and Metrics

### Performance Metrics

Track watch performance with built-in metrics:

```typescript
const watcher = new WatchManager({
  patterns: ["**/*.ts"],
  enableMetrics: true,

  onMetrics: (metrics) => {
    console.log("Watch Metrics:", {
      filesWatched: metrics.filesWatched,
      eventsProcessed: metrics.eventsProcessed,
      averageProcessingTime: metrics.averageProcessingTime,
      memoryUsage: metrics.memoryUsage,
      cacheHitRate: metrics.cacheHitRate,
    });
  },
});

// Get current metrics
const metrics = watcher.getMetrics();
console.log(`Watching ${metrics.filesWatched} files`);
```

### Health Monitoring

Monitor watcher health and performance:

```typescript
watcher.on("health-check", (health) => {
  if (health.status !== "healthy") {
    console.warn("Watcher health issue:", health.issues);

    // Auto-restart if needed
    if (health.shouldRestart) {
      await watcher.restart();
    }
  }
});
```

## Troubleshooting

### Common Issues

1. **Too Many Files Error**

   ```
   Error: EMFILE: too many open files
   ```

   **Solution**: Increase system file limits or reduce watch scope:

   ```typescript
   const watcher = new WatchManager({
     patterns: ["src/**/*.ts"],
     maxWatchers: 500, // Reduce concurrent watchers
     usePolling: true, // Use polling instead of native events
   });
   ```

2. **High CPU Usage**

   ```
   Warning: High CPU usage detected
   ```

   **Solution**: Optimize patterns and increase debounce time:

   ```typescript
   const watcher = new WatchManager({
     patterns: ["src/**/*.ts"],
     excludePatterns: ["**/*.{log,tmp,cache}"],
     debounceMs: 1000, // Increase debounce time
     throttleMs: 200, // Reduce event frequency
   });
   ```

3. **Missing Change Events**
   ```
   Warning: Some file changes may be missed
   ```
   **Solution**: Enable polling for problematic filesystems:
   ```typescript
   const watcher = new WatchManager({
     patterns: ["**/*.ts"],
     usePolling: true, // Enable polling
     pollingInterval: 1000, // Check every second
   });
   ```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
process.env.DEBUG = "ast-helper:watch";
const watcher = new WatchManager({
  patterns: ["src/**/*.ts"],
  logLevel: "debug",
});
```

## Best Practices

### Pattern Design

1. **Be Specific**: Use precise patterns to avoid unnecessary watches
2. **Exclude Early**: Use excludePatterns to avoid scanning irrelevant files
3. **Test Patterns**: Verify patterns match expected files
4. **Monitor Performance**: Watch for performance issues with large file sets

### Performance Optimization

1. **Tune Debouncing**: Balance responsiveness with performance
2. **Batch Changes**: Process related changes together
3. **Cache Intelligently**: Use content hashing for accurate change detection
4. **Monitor Resources**: Track memory and CPU usage

### Error Handling

1. **Handle Gracefully**: Always handle watch errors appropriately
2. **Implement Fallbacks**: Have backup strategies for failed watchers
3. **Log Appropriately**: Log errors without flooding output
4. **Auto-Recovery**: Implement automatic restart mechanisms

## API Reference

For detailed API documentation, see:

- [Watch API Reference](../api/advanced-features.md#watch-command-enhancement)
- [Configuration Options](../api/cli.md#watch-command)
- [Event Handling Guide](../api/interfaces.md#watch-events)

## Examples

Complete working examples are available in:

- [Watch Enhancement Examples](../examples/advanced-features.md#watch-command-enhancement)
- [Integration Examples](../examples/integrations.md#file-watching)

---

_This guide is part of the advanced features implementation. For the complete feature overview, see [Advanced Features Guide](./advanced-features.md)._
