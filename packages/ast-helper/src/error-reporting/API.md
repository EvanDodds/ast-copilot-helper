# Error Reporting System API Reference

Complete API documentation for the comprehensive error reporting and diagnostics system.

## Table of Contents

1. [Core Classes](#core-classes)
2. [Interfaces](#interfaces)
3. [Configuration](#configuration)
4. [Error Types](#error-types)
5. [Methods](#methods)
6. [Examples](#examples)
7. [Migration Guide](#migration-guide)

## Core Classes

### ComprehensiveErrorReportingManager

The main class that orchestrates all error reporting functionality.

```typescript
import { ComprehensiveErrorReportingManager } from "@ast-copilot-helper/ast-copilot-helper";

const errorManager = new ComprehensiveErrorReportingManager();
```

#### Constructor

```typescript
constructor();
```

Creates a new instance of the error reporting manager. The manager must be initialized with a configuration before use.

#### Methods

##### initialize(config: ErrorReportingConfig): Promise<void>

Initializes the error reporting system with the provided configuration.

```typescript
await errorManager.initialize({
  enabled: true,
  enableCrashReporting: true,
  collectSystemInfo: true,
  collectCodebaseInfo: true,
  enableAutomaticReporting: false,
  privacyMode: false,
  userReportingEnabled: true,
  maxReportSize: 1024 * 1024,
  maxHistoryEntries: 1000,
  diagnosticDataCollection: {
    system: true,
    runtime: true,
    codebase: true,
    configuration: true,
    performance: true,
    dependencies: true,
    maxCollectionTimeMs: 10000,
    includeEnvironmentVars: false,
    includeProcessInfo: true,
  },
});
```

##### reportError(error: ErrorReport): Promise<ReportResult>

Reports an error to the system and returns the result.

```typescript
const report = await errorManager.generateErrorReport(
  new Error("Something went wrong"),
  {
    operation: "data-processing",
    component: "UserService",
  },
);

const result = await errorManager.reportError(report);
console.log(`Error reported: ${result.errorId}`);
```

##### generateErrorReport(error: Error, context?: any): Promise<ErrorReport>

Generates a comprehensive error report from a JavaScript Error object and optional context.

```typescript
const error = new Error("Database connection failed");
error.name = "DatabaseError";

const report = await errorManager.generateErrorReport(error, {
  operation: "database-connection",
  connectionString: "postgresql://***:***@localhost:5432/mydb",
  retryAttempts: 3,
  timeout: 5000,
});
```

##### provideSuggestions(error: ErrorReport): Promise<SuggestionResult[]>

Generates intelligent suggestions for resolving an error.

```typescript
const suggestions = await errorManager.provideSuggestions(errorReport);
suggestions.forEach((suggestion) => {
  console.log(`Suggestion: ${suggestion.title}`);
  console.log(`Description: ${suggestion.description}`);
  console.log(`Confidence: ${suggestion.confidence}`);
});
```

##### collectDiagnostics(context: DiagnosticContext): Promise<DiagnosticData>

Collects comprehensive diagnostic information about the system state.

```typescript
const diagnostics = await errorManager.collectDiagnostics({
  operation: "system-health-check",
  includePerformanceMetrics: true,
  includeSystemInfo: true,
});
```

##### exportDiagnostics(format: 'json' | 'text'): Promise<string>

Exports diagnostic information in the specified format.

```typescript
const jsonDiagnostics = await errorManager.exportDiagnostics("json");
const textDiagnostics = await errorManager.exportDiagnostics("text");
```

##### getErrorHistory(): Promise<ErrorHistoryEntry[]>

Retrieves the complete error history.

```typescript
const history = await errorManager.getErrorHistory();
console.log(`Total errors: ${history.length}`);
```

##### clearErrorHistory(): Promise<void>

Clears the error history.

```typescript
await errorManager.clearErrorHistory();
```

##### cleanup(): Promise<void>

Cleans up resources and stops background processes.

```typescript
await errorManager.cleanup();
```

## Interfaces

### ErrorReportingConfig

Configuration options for the error reporting system.

```typescript
interface ErrorReportingConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  enableCrashReporting: boolean;
  enableAutomaticReporting: boolean;
  collectSystemInfo: boolean;
  collectCodebaseInfo: boolean;
  maxReportSize: number;
  maxHistoryEntries: number;
  privacyMode: boolean;
  userReportingEnabled: boolean;
  diagnosticDataCollection: DiagnosticDataCollectionConfig;
}
```

### DiagnosticDataCollectionConfig

Configuration for diagnostic data collection.

```typescript
interface DiagnosticDataCollectionConfig {
  system: boolean;
  runtime: boolean;
  codebase: boolean;
  configuration: boolean;
  performance: boolean;
  dependencies: boolean;
  maxCollectionTimeMs: number;
  includeEnvironmentVars: boolean;
  includeProcessInfo: boolean;
}
```

### ErrorReport

Comprehensive error report structure.

```typescript
interface ErrorReport {
  id: string;
  timestamp: Date;
  type: "error" | "crash" | "warning" | "performance";
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  operation: string;
  message: string;
  originalError?: Error;
  stackTrace?: string;
  context: ErrorContext;
  environment: EnvironmentInfo;
  diagnostics: DiagnosticData;
  userProvided: boolean;
  reportedToServer: boolean;
  suggestions: SuggestionResult[];
  resolution?: ResolutionInfo;
}
```

### ErrorContext

Context information about when and where the error occurred.

```typescript
interface ErrorContext {
  operation: string;
  component: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  parameters?: Record<string, any>;
  files?: string[];
  environment?: Record<string, string>;
  userAgent?: string;
  platform: string;
  architecture: string;
  nodeVersion: string;
  processId: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}
```

### SuggestionResult

Error resolution suggestion.

```typescript
interface SuggestionResult {
  id: string;
  title: string;
  description: string;
  confidence: number;
  type: "code-fix" | "configuration" | "documentation" | "best-practice";
  steps: string[];
  resources: Array<{
    type: "documentation" | "tutorial" | "example" | "tool";
    title: string;
    url: string;
    description: string;
  }>;
  estimatedTimeToResolve: number;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  applicableVersions?: string[];
  prerequisites?: string[];
  metadata?: Record<string, any>;
}
```

### ReportResult

Result of reporting an error.

```typescript
interface ReportResult {
  success: boolean;
  errorId: string;
  suggestions: SuggestionResult[];
  serverReported: boolean;
  message: string;
}
```

## Configuration

### Basic Configuration

Minimal configuration for getting started:

```typescript
const config: ErrorReportingConfig = {
  enabled: true,
  enableCrashReporting: true,
  enableAutomaticReporting: false,
  collectSystemInfo: true,
  collectCodebaseInfo: true,
  privacyMode: false,
  userReportingEnabled: true,
  maxReportSize: 1024 * 1024, // 1MB
  maxHistoryEntries: 1000,
  diagnosticDataCollection: {
    system: true,
    runtime: true,
    codebase: true,
    configuration: true,
    performance: true,
    dependencies: true,
    maxCollectionTimeMs: 10000,
    includeEnvironmentVars: false,
    includeProcessInfo: true,
  },
};
```

### Privacy-Focused Configuration

Configuration that prioritizes user privacy:

```typescript
const privacyConfig: ErrorReportingConfig = {
  enabled: true,
  enableCrashReporting: true,
  enableAutomaticReporting: false, // Require user consent
  collectSystemInfo: false, // Minimal system info
  collectCodebaseInfo: false, // No codebase details
  privacyMode: true, // Enable strict privacy mode
  userReportingEnabled: true,
  maxReportSize: 512 * 1024, // 512KB limit
  maxHistoryEntries: 100, // Limited history
  diagnosticDataCollection: {
    system: false,
    runtime: true, // Basic runtime info only
    codebase: false,
    configuration: false,
    performance: false,
    dependencies: false,
    maxCollectionTimeMs: 2000, // Quick collection
    includeEnvironmentVars: false, // Never include env vars
    includeProcessInfo: false, // No process details
  },
};
```

### Production Configuration

Configuration optimized for production use:

```typescript
const productionConfig: ErrorReportingConfig = {
  enabled: true,
  endpoint: "https://errors.example.com/api/v1/reports",
  apiKey: process.env.ERROR_REPORTING_API_KEY,
  enableCrashReporting: true,
  enableAutomaticReporting: true, // Auto-report in production
  collectSystemInfo: true,
  collectCodebaseInfo: true,
  privacyMode: false,
  userReportingEnabled: true,
  maxReportSize: 2 * 1024 * 1024, // 2MB
  maxHistoryEntries: 5000, // Large history for analysis
  diagnosticDataCollection: {
    system: true,
    runtime: true,
    codebase: true,
    configuration: true,
    performance: true,
    dependencies: true,
    maxCollectionTimeMs: 15000, // Extended collection time
    includeEnvironmentVars: true, // Include for debugging
    includeProcessInfo: true,
  },
};
```

## Error Types

### Supported Error Types

The system categorizes errors into the following types:

- **error**: Standard application errors
- **crash**: System crashes and critical failures
- **warning**: Non-critical issues that may indicate problems
- **performance**: Performance-related issues

### Severity Levels

- **low**: Minor issues that don't significantly impact functionality
- **medium**: Moderate issues that may affect some users
- **high**: Serious issues that impact functionality for many users
- **critical**: Severe issues that may cause system instability or data loss

### Common Categories

The system automatically categorizes errors into common categories:

- `parse-error`: Code parsing and syntax errors
- `network-error`: Network connectivity and API issues
- `database-error`: Database connection and query issues
- `memory-error`: Memory usage and leak issues
- `configuration-error`: Configuration and setup issues
- `security-error`: Security-related issues
- `performance-error`: Performance degradation issues
- `system-error`: General system errors
- `unknown-error`: Uncategorized errors

## Methods

### Error Reporting Methods

#### Basic Error Reporting

```typescript
// Generate error report from JavaScript Error
const error = new Error("Something went wrong");
const report = await errorManager.generateErrorReport(error, {
  operation: "user-action",
  component: "UserInterface",
});

// Report the error
const result = await errorManager.reportError(report);
```

#### Custom Error Context

```typescript
const report = await errorManager.generateErrorReport(error, {
  operation: "data-processing",
  component: "DataProcessor",
  userId: "user-123",
  customField: "custom-value",
  performanceMetrics: {
    processingTime: 1500,
    memoryUsage: 85.5,
    cpuUsage: 42.1,
  },
});
```

### Diagnostic Methods

#### System Diagnostics

```typescript
const diagnostics = await errorManager.collectDiagnostics({
  operation: "health-check",
  includePerformanceMetrics: true,
  includeSystemInfo: true,
  includeProcessInfo: true,
});

console.log("System Health:", diagnostics.system?.cpuUsage);
console.log("Memory Usage:", diagnostics.system?.memoryUsage);
```

#### Export Diagnostics

```typescript
// Export as JSON
const jsonData = await errorManager.exportDiagnostics("json");
const diagnosticsObject = JSON.parse(jsonData);

// Export as human-readable text
const textData = await errorManager.exportDiagnostics("text");
console.log(textData);
```

### History Methods

#### Retrieve Error History

```typescript
const history = await errorManager.getErrorHistory();

// Filter by severity
const criticalErrors = history.filter(
  (entry) => entry.error.severity === "critical",
);

// Filter by time range
const recentErrors = history.filter(
  (entry) => entry.error.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000),
);
```

#### Analyze Error Patterns

```typescript
const history = await errorManager.getErrorHistory();

// Group by category
const errorsByCategory = history.reduce(
  (acc, entry) => {
    const category = entry.error.category;
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

// Find most frequent errors
const mostFrequent = Object.entries(errorsByCategory)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5);
```

## Examples

### Basic Usage

```typescript
import { ComprehensiveErrorReportingManager } from "@ast-copilot-helper/ast-copilot-helper";

async function basicExample() {
  const errorManager = new ComprehensiveErrorReportingManager();

  await errorManager.initialize({
    enabled: true,
    enableCrashReporting: true,
    collectSystemInfo: true,
    // ... other config options
  });

  try {
    // Your application code
    throw new Error("Something went wrong");
  } catch (error) {
    const report = await errorManager.generateErrorReport(error, {
      operation: "user-action",
      component: "MyComponent",
    });

    const result = await errorManager.reportError(report);
    console.log(`Error reported: ${result.errorId}`);

    // Get suggestions
    result.suggestions?.forEach((suggestion) => {
      console.log(`💡 ${suggestion.title}: ${suggestion.description}`);
    });
  }

  await errorManager.cleanup();
}
```

### Advanced Usage with Analytics

```typescript
async function analyticsExample() {
  const errorManager = new ComprehensiveErrorReportingManager();

  await errorManager.initialize({
    enabled: true,
    enableCrashReporting: true,
    collectSystemInfo: true,
    maxHistoryEntries: 5000, // Keep more history for analytics
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      performance: true,
      // ... other options
    },
  });

  // Generate some sample errors
  for (let i = 0; i < 10; i++) {
    const error = new Error(`Test error ${i}`);
    const report = await errorManager.generateErrorReport(error, {
      operation: "test-operation",
      testId: i,
    });
    await errorManager.reportError(report);
  }

  // Analyze error patterns
  const history = await errorManager.getErrorHistory();
  const patterns = analyzeErrorPatterns(history);

  console.log("Error Analysis:", patterns);

  await errorManager.cleanup();
}

function analyzeErrorPatterns(history: ErrorHistoryEntry[]) {
  return {
    totalErrors: history.length,
    errorsByCategory: groupBy(history, (entry) => entry.error.category),
    errorsBySeverity: groupBy(history, (entry) => entry.error.severity),
    recentTrend: calculateTrend(history),
  };
}
```

### Privacy-Focused Usage

```typescript
async function privacyExample() {
  const errorManager = new ComprehensiveErrorReportingManager();

  await errorManager.initialize({
    enabled: true,
    privacyMode: true,
    enableAutomaticReporting: false, // Require explicit consent
    collectSystemInfo: false,
    collectCodebaseInfo: false,
    diagnosticDataCollection: {
      system: false,
      runtime: true, // Minimal info only
      codebase: false,
      configuration: false,
      performance: false,
      dependencies: false,
      includeEnvironmentVars: false,
      includeProcessInfo: false,
    },
  });

  // All error reports will be automatically anonymized
  const error = new Error("User data validation failed");
  const report = await errorManager.generateErrorReport(error, {
    operation: "user-validation",
    // PII will be automatically scrubbed
    userEmail: "john.doe@example.com",
    userId: "user-12345",
  });

  const result = await errorManager.reportError(report);
  console.log("Privacy-compliant error reported:", result.errorId);

  await errorManager.cleanup();
}
```

## Migration Guide

### Migrating from Version 1.x

If you're upgrading from an earlier version, here are the key changes:

#### Constructor Changes

**Old (v1.x):**

```typescript
const errorManager = new ErrorReportingManager(config);
```

**New (v2.x):**

```typescript
const errorManager = new ComprehensiveErrorReportingManager();
await errorManager.initialize(config);
```

#### Configuration Changes

**Old (v1.x):**

```typescript
const config = {
  enableReporting: true,
  collectDiagnostics: true,
};
```

**New (v2.x):**

```typescript
const config = {
  enabled: true,
  enableCrashReporting: true,
  diagnosticDataCollection: {
    system: true,
    runtime: true,
    // ... more granular options
  },
};
```

#### Method Changes

**Old (v1.x):**

```typescript
const errorId = await errorManager.reportError(error);
```

**New (v2.x):**

```typescript
const report = await errorManager.generateErrorReport(error, context);
const result = await errorManager.reportError(report);
const errorId = result.errorId;
```

### Breaking Changes

1. **Constructor**: Now requires explicit initialization
2. **Configuration**: More detailed and granular options
3. **Error Reporting**: Two-step process (generate + report)
4. **Return Types**: More detailed result objects
5. **Privacy**: Built-in privacy controls and anonymization

### Migration Steps

1. **Update Constructor Usage**:

   ```typescript
   // Before
   const errorManager = new ErrorReportingManager(config);

   // After
   const errorManager = new ComprehensiveErrorReportingManager();
   await errorManager.initialize(config);
   ```

2. **Update Configuration**:
   - Review and update configuration object structure
   - Set appropriate privacy settings
   - Configure diagnostic data collection options

3. **Update Error Reporting**:
   - Replace direct `reportError()` calls with `generateErrorReport()` + `reportError()`
   - Update code expecting simple error ID return to handle `ReportResult` objects

4. **Add Cleanup**:
   - Add `await errorManager.cleanup()` before application shutdown

5. **Test Privacy Features**:
   - Verify that PII scrubbing works as expected
   - Test privacy mode if enabled
   - Ensure compliance with your privacy requirements

## Best Practices

1. **Always Initialize**: Never use the error manager without initializing it first
2. **Handle Cleanup**: Always call `cleanup()` before application shutdown
3. **Use Context**: Provide rich context information for better error analysis
4. **Configure Privacy**: Set appropriate privacy settings for your use case
5. **Monitor History**: Regularly analyze error history for patterns and trends
6. **Handle Async**: All methods are async - use proper error handling
7. **Resource Limits**: Set appropriate limits for report size and history entries
8. **Environment Specific**: Use different configurations for development vs production
