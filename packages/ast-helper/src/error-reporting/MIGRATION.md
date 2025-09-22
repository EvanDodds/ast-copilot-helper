# Migration Guide - Error Reporting System

This guide helps you migrate to the new comprehensive error reporting system.

## Overview

The new error reporting system (v2.0+) introduces significant improvements:

- 🛡️ **Enhanced Privacy Controls** - GDPR/CCPA compliance, PII scrubbing, data anonymization
- 🧠 **AI-Powered Suggestions** - Intelligent error resolution recommendations
- 💥 **Advanced Crash Detection** - Automatic crash detection with recovery mechanisms
- 📊 **Comprehensive Analytics** - Pattern recognition, trend analysis, and reporting
- 🔒 **Secure Transmission** - Encrypted data transmission with rate limiting
- 🏥 **System Diagnostics** - Detailed system health monitoring and context collection

## Breaking Changes

### 1. Constructor and Initialization

**Before (v1.x):**
```typescript
import { ErrorReportingManager } from './error-reporting';

const errorManager = new ErrorReportingManager({
  enabled: true,
  endpoint: 'https://api.example.com/errors'
});

// Ready to use immediately
```

**After (v2.0+):**
```typescript
import { ComprehensiveErrorReportingManager } from './error-reporting/manager';

const errorManager = new ComprehensiveErrorReportingManager();

// Must initialize before use
await errorManager.initialize({
  enabled: true,
  endpoint: 'https://api.example.com/errors',
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
    includeProcessInfo: true
  }
});
```

### 2. Error Reporting API

**Before (v1.x):**
```typescript
// Simple error reporting
const errorId = await errorManager.reportError({
  message: 'Something went wrong',
  type: 'error',
  severity: 'high'
});

console.log(`Error reported: ${errorId}`);
```

**After (v2.0+):**
```typescript
// Two-step process: generate report + report error
const error = new Error('Something went wrong');
const report = await errorManager.generateErrorReport(error, {
  operation: 'user-action',
  component: 'MyComponent',
  customContext: 'additional-info'
});

const result = await errorManager.reportError(report);
console.log(`Error reported: ${result.errorId}`);
console.log(`Suggestions: ${result.suggestions?.length || 0}`);
```

### 3. Configuration Structure

**Before (v1.x):**
```typescript
interface OldConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  collectDiagnostics?: boolean;
  enableCrashReporting?: boolean;
}
```

**After (v2.0+):**
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
  diagnosticDataCollection: {
    system: boolean;
    runtime: boolean;
    codebase: boolean;
    configuration: boolean;
    performance: boolean;
    dependencies: boolean;
    maxCollectionTimeMs: number;
    includeEnvironmentVars: boolean;
    includeProcessInfo: boolean;
  };
}
```

### 4. Return Values

**Before (v1.x):**
```typescript
// Simple string return
const errorId: string = await errorManager.reportError(error);
```

**After (v2.0+):**
```typescript
// Rich result object
const result: ReportResult = await errorManager.reportError(report);
// {
//   success: true,
//   errorId: 'err_123...',
//   suggestions: [...],
//   serverReported: true,
//   message: 'Error reported successfully'
// }
```

## Step-by-Step Migration

### Step 1: Update Dependencies

Update your package.json to use the new error reporting system:

```json
{
  "dependencies": {
    "@ast-copilot-helper/ast-helper": "^2.0.0"
  }
}
```

### Step 2: Update Imports

**Before:**
```typescript
import { ErrorReportingManager } from './error-reporting';
```

**After:**
```typescript
import { ComprehensiveErrorReportingManager } from '@ast-copilot-helper/ast-helper';
// or if using local files:
import { ComprehensiveErrorReportingManager } from './error-reporting/manager';
```

### Step 3: Update Configuration

Create a new configuration object with the expanded options:

```typescript
// Migration helper function
function migrateConfig(oldConfig: OldConfig): ErrorReportingConfig {
  return {
    enabled: oldConfig.enabled,
    endpoint: oldConfig.endpoint,
    apiKey: oldConfig.apiKey,
    
    // New required fields with sensible defaults
    enableCrashReporting: oldConfig.enableCrashReporting ?? true,
    enableAutomaticReporting: false, // Conservative default
    collectSystemInfo: oldConfig.collectDiagnostics ?? true,
    collectCodebaseInfo: oldConfig.collectDiagnostics ?? true,
    maxReportSize: 1024 * 1024, // 1MB
    maxHistoryEntries: 1000,
    privacyMode: false, // Review and set based on your needs
    userReportingEnabled: true,
    
    diagnosticDataCollection: {
      system: oldConfig.collectDiagnostics ?? true,
      runtime: true,
      codebase: oldConfig.collectDiagnostics ?? true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 10000,
      includeEnvironmentVars: false, // Conservative default
      includeProcessInfo: true
    }
  };
}
```

### Step 4: Update Initialization

**Before:**
```typescript
const errorManager = new ErrorReportingManager(oldConfig);
```

**After:**
```typescript
const errorManager = new ComprehensiveErrorReportingManager();
const newConfig = migrateConfig(oldConfig);
await errorManager.initialize(newConfig);
```

### Step 5: Update Error Reporting Calls

Create a migration helper to update error reporting calls:

```typescript
// Migration helper function
async function migrateErrorReporting(
  errorManager: ComprehensiveErrorReportingManager,
  oldErrorData: any
) {
  // Create Error object from old data
  const error = new Error(oldErrorData.message);
  if (oldErrorData.type) {
    error.name = oldErrorData.type;
  }

  // Generate comprehensive report
  const report = await errorManager.generateErrorReport(error, {
    operation: oldErrorData.operation || 'unknown',
    component: oldErrorData.component || 'unknown',
    ...oldErrorData.context // Spread any additional context
  });

  // Report and return new format
  const result = await errorManager.reportError(report);
  return {
    errorId: result.errorId,
    suggestions: result.suggestions,
    success: result.success
  };
}

// Usage example
try {
  // Your code that might throw errors
  throw new Error('Database connection failed');
} catch (error) {
  const result = await migrateErrorReporting(errorManager, {
    message: error.message,
    type: 'DatabaseError',
    operation: 'database-connection',
    context: { connectionString: 'postgresql://...' }
  });
  
  console.log(`Error reported: ${result.errorId}`);
  if (result.suggestions?.length > 0) {
    console.log('Suggestions:');
    result.suggestions.forEach(suggestion => {
      console.log(`- ${suggestion.title}: ${suggestion.description}`);
    });
  }
}
```

### Step 6: Add Cleanup

Add proper cleanup to prevent resource leaks:

```typescript
// Add cleanup on application shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await errorManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Terminating...');
  await errorManager.cleanup();
  process.exit(0);
});
```

## New Features Available After Migration

### 1. AI-Powered Error Suggestions

```typescript
const suggestions = await errorManager.provideSuggestions(errorReport);
suggestions.forEach(suggestion => {
  console.log(`💡 ${suggestion.title}`);
  console.log(`   Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`);
  console.log(`   Steps: ${suggestion.steps.join(', ')}`);
});
```

### 2. Comprehensive System Diagnostics

```typescript
const diagnostics = await errorManager.exportDiagnostics('json');
const data = JSON.parse(diagnostics);
console.log('System Health:', data.environment);
console.log('Performance:', data.diagnostics.performance);
```

### 3. Error History and Analytics

```typescript
const history = await errorManager.getErrorHistory();

// Analyze error patterns
const patterns = history.reduce((acc, entry) => {
  const category = entry.error.category;
  acc[category] = (acc[category] || 0) + 1;
  return acc;
}, {});

console.log('Error patterns:', patterns);
```

### 4. Privacy Controls

```typescript
// Enable privacy mode for GDPR compliance
await errorManager.initialize({
  // ... other config
  privacyMode: true,
  diagnosticDataCollection: {
    // ... minimal collection settings
    includeEnvironmentVars: false,
    includeProcessInfo: false
  }
});
```

### 5. Crash Detection and Recovery

The system now automatically detects crashes and attempts recovery:

```typescript
// Crash detection is automatic once enabled
await errorManager.initialize({
  // ... other config
  enableCrashReporting: true
});

// System will automatically detect:
// - Memory leaks
// - Unhandled exceptions
// - Application hangs
// - Resource exhaustion
```

## Migration Checklist

- [ ] **Update Dependencies** - Install new version
- [ ] **Update Imports** - Change import statements
- [ ] **Update Configuration** - Migrate to new config structure
- [ ] **Update Initialization** - Use constructor + initialize pattern
- [ ] **Update Error Reporting** - Use generateErrorReport + reportError pattern
- [ ] **Add Cleanup** - Add cleanup calls on shutdown
- [ ] **Review Privacy Settings** - Configure privacy options appropriately
- [ ] **Test New Features** - Verify suggestions, analytics, and crash detection work
- [ ] **Update Documentation** - Update your code documentation
- [ ] **Training** - Train team on new features and API

## Compatibility Mode

If you need to maintain compatibility with existing code during migration, you can create a wrapper:

```typescript
class LegacyErrorReportingWrapper {
  private manager: ComprehensiveErrorReportingManager;
  private initialized = false;

  constructor(private config: OldConfig) {
    this.manager = new ComprehensiveErrorReportingManager();
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.manager.initialize(this.migrateConfig(this.config));
      this.initialized = true;
    }
  }

  async reportError(errorData: any): Promise<string> {
    await this.ensureInitialized();
    
    const error = new Error(errorData.message);
    error.name = errorData.type || 'Error';
    
    const report = await this.manager.generateErrorReport(error, {
      operation: errorData.operation || 'legacy',
      ...errorData.context
    });
    
    const result = await this.manager.reportError(report);
    return result.errorId;
  }

  private migrateConfig(oldConfig: OldConfig): ErrorReportingConfig {
    // Implementation from Step 3
  }
}

// Use legacy wrapper temporarily
const errorManager = new LegacyErrorReportingWrapper(oldConfig);
```

## Common Migration Issues

### 1. Async Initialization

**Problem**: Forgetting to await initialization
```typescript
// ❌ Wrong
const errorManager = new ComprehensiveErrorReportingManager();
errorManager.initialize(config); // Missing await
await errorManager.reportError(report); // Will fail
```

**Solution**: Always await initialization
```typescript
// ✅ Correct
const errorManager = new ComprehensiveErrorReportingManager();
await errorManager.initialize(config);
await errorManager.reportError(report);
```

### 2. Configuration Completeness

**Problem**: Missing required configuration fields
```typescript
// ❌ Incomplete config
await errorManager.initialize({
  enabled: true
  // Missing required fields
});
```

**Solution**: Provide complete configuration
```typescript
// ✅ Complete config
await errorManager.initialize({
  enabled: true,
  enableCrashReporting: true,
  collectSystemInfo: true,
  // ... all required fields
});
```

### 3. Error Context

**Problem**: Not providing sufficient context
```typescript
// ❌ Limited context
const report = await errorManager.generateErrorReport(error);
```

**Solution**: Provide rich context
```typescript
// ✅ Rich context
const report = await errorManager.generateErrorReport(error, {
  operation: 'user-authentication',
  component: 'LoginService',
  userId: user.id,
  attemptNumber: 3,
  ipAddress: request.ip
});
```

## Support and Resources

- **Documentation**: See [API.md](./API.md) for complete API reference
- **Examples**: Check the [examples](./examples/) directory for usage examples
- **Issues**: Report migration issues on GitHub
- **Discussion**: Join community discussions for migration help

## Timeline Recommendations

- **Week 1-2**: Update dependencies and configuration
- **Week 3-4**: Migrate core error reporting functionality
- **Week 5-6**: Implement new features (suggestions, analytics)
- **Week 7-8**: Testing and validation
- **Week 9**: Documentation and training
- **Week 10**: Production deployment

Take your time with the migration to ensure all features work correctly in your specific environment.