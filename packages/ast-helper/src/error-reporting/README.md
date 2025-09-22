# Error Reporting and Diagnostics System

A comprehensive error reporting and diagnostics system for the AST Copilot Helper project. This system provides intelligent error handling, crash detection, privacy-compliant data collection, and automated recovery mechanisms.

## 🚀 Features

### Core Capabilities
- **Hierarchical Error Reporting** - Structured error categorization and severity management
- **Intelligent Diagnostics** - Context-aware system information collection
- **Crash Detection & Recovery** - Automatic crash detection with recovery suggestions
- **Privacy-First Design** - GDPR/CCPA compliant data handling with user consent
- **Analytics & Insights** - Trend analysis and pattern recognition
- **Secure Transmission** - Encrypted data transmission with rate limiting

### Key Components
- `ComprehensiveErrorReportingManager` - Central orchestrator for all error reporting
- `DiagnosticCollector` - System context and diagnostic data collection
- `SuggestionEngine` - AI-powered error resolution suggestions
- `CrashDetector` - Real-time crash monitoring and recovery
- `ErrorAnalyticsManager` - Historical analysis and trend detection
- `PrivacyManager` - Privacy controls and compliance management
- `SecureTransmissionManager` - Secure data transmission and storage

## 📦 Installation

The error reporting system is included as part of the AST Helper package:

```bash
npm install @ast-copilot-helper/ast-helper
```

## 🔧 Quick Start

### Basic Usage

```typescript
import { ComprehensiveErrorReportingManager } from '@ast-copilot-helper/ast-helper';

// Initialize the error reporting system
const errorManager = new ComprehensiveErrorReportingManager({
  enableCrashReporting: true,
  enableAnalytics: true,
  privacySettings: {
    collectDiagnostics: true,
    allowTelemetry: true
  }
});

// Report an error
await errorManager.reportError({
  type: 'error',
  severity: 'high',
  message: 'Failed to parse AST',
  category: 'parse-error',
  operation: 'ast-parsing',
  context: {
    fileName: 'example.ts',
    line: 42,
    userId: 'user-123'
  }
});
```

### Advanced Configuration

```typescript
const errorManager = new ComprehensiveErrorReportingManager({
  // Core settings
  enableCrashReporting: true,
  enableAnalytics: true,
  maxErrorHistory: 10000,
  
  // Privacy settings
  privacySettings: {
    collectDiagnostics: true,
    allowTelemetry: true,
    retentionDays: 30,
    allowedCategories: ['error', 'crash', 'performance']
  },
  
  // Analytics settings
  analyticsSettings: {
    enableTrendAnalysis: true,
    enablePatternRecognition: true,
    batchSize: 100,
    flushInterval: 60000
  },
  
  // Transmission settings
  transmissionSettings: {
    endpoint: 'https://api.example.com/errors',
    apiKey: 'your-api-key',
    enableEncryption: true,
    retryAttempts: 3
  }
});
```

## 📚 API Reference

### ComprehensiveErrorReportingManager

The main class that orchestrates all error reporting functionality.

#### Constructor Options

```typescript
interface ErrorReportingOptions {
  enableCrashReporting?: boolean;
  enableAnalytics?: boolean;
  maxErrorHistory?: number;
  privacySettings?: PrivacySettings;
  analyticsSettings?: AnalyticsSettings;
  transmissionSettings?: TransmissionSettings;
}
```

#### Key Methods

```typescript
// Report an error
async reportError(error: ErrorReport): Promise<string>

// Get error suggestions
async getErrorSuggestions(errorId: string): Promise<ErrorSuggestion[]>

// Export diagnostics
async exportDiagnostics(format: 'json' | 'csv'): Promise<string>

// Get analytics report
async getAnalyticsReport(timeRange?: TimeRange): Promise<AnalyticsReport>

// Update privacy settings
async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<void>
```

### Error Types

```typescript
interface ErrorReport {
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  category: string;
  operation?: string;
  context?: Record<string, unknown>;
  timestamp?: Date;
  userId?: string;
}
```

## 🛡️ Privacy & Security

### Privacy Controls

The system includes comprehensive privacy controls:

```typescript
// Configure privacy settings
await errorManager.updatePrivacySettings({
  collectDiagnostics: true,
  allowTelemetry: false,
  retentionDays: 7,
  allowedCategories: ['error', 'crash'],
  scrubPII: true,
  anonymizeData: true
});
```

### Data Handling

- **PII Scrubbing** - Automatic removal of personally identifiable information
- **Data Anonymization** - User data is anonymized before storage
- **Consent Management** - User consent is required for data collection
- **Retention Policies** - Configurable data retention periods
- **GDPR/CCPA Compliance** - Built-in compliance with data protection regulations

### Security Features

- **Encrypted Transmission** - All data is encrypted during transmission
- **Rate Limiting** - Prevents abuse and ensures fair usage
- **Authentication** - Secure API key-based authentication
- **Audit Logging** - Complete audit trail of all operations

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Configure default settings via environment variables
AST_ERROR_REPORTING_ENDPOINT=https://api.example.com/errors
AST_ERROR_REPORTING_API_KEY=your-api-key
AST_ERROR_REPORTING_ENABLE_ENCRYPTION=true
AST_ERROR_REPORTING_MAX_HISTORY=10000
```

### Configuration File

Create an `error-reporting.config.json` file:

```json
{
  "enableCrashReporting": true,
  "enableAnalytics": true,
  "privacySettings": {
    "collectDiagnostics": true,
    "allowTelemetry": true,
    "retentionDays": 30
  },
  "analyticsSettings": {
    "enableTrendAnalysis": true,
    "batchSize": 100
  }
}
```

## 📊 Analytics & Reporting

### Getting Analytics Data

```typescript
// Get comprehensive analytics report
const report = await errorManager.getAnalyticsReport({
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-12-31')
});

console.log(report.errorTrends);
console.log(report.topCategories);
console.log(report.severityDistribution);
```

### Exporting Data

```typescript
// Export error data in various formats
const jsonData = await errorManager.exportDiagnostics('json');
const csvData = await errorManager.exportDiagnostics('csv');
```

## 🚨 Crash Detection

### Automatic Crash Detection

The system automatically detects various types of crashes:

- Memory leaks and out-of-memory errors
- Unhandled exceptions and promise rejections
- System resource exhaustion
- Performance degradation
- Application hangs

### Custom Crash Handlers

```typescript
// Register custom crash handler
errorManager.onCrashDetected((crash) => {
  console.log('Crash detected:', crash.type);
  console.log('Recovery attempted:', crash.recoveryAttempted);
  console.log('Final state:', crash.finalState);
});
```

## 🧠 AI-Powered Suggestions

### Error Resolution Suggestions

The system provides intelligent suggestions for error resolution:

```typescript
// Get suggestions for a specific error
const suggestions = await errorManager.getErrorSuggestions('error-id-123');

suggestions.forEach(suggestion => {
  console.log('Suggestion:', suggestion.title);
  console.log('Description:', suggestion.description);
  console.log('Confidence:', suggestion.confidence);
  console.log('Steps:', suggestion.steps);
});
```

### Suggestion Types

- **Code Fixes** - Direct code suggestions to resolve errors
- **Configuration Changes** - System/environment configuration recommendations
- **Documentation Links** - Relevant documentation and resources
- **Best Practices** - General best practice recommendations

## 🧪 Testing

### Integration Tests

Run the comprehensive integration test suite:

```bash
npm test -- packages/ast-helper/src/test/error-reporting/integration.test.ts
```

### Unit Tests

Run individual component tests:

```bash
# Test core error reporting
npm test -- packages/ast-helper/src/test/error-reporting/manager.test.ts

# Test crash detection
npm test -- packages/ast-helper/src/test/error-reporting/crash/detector.test.ts

# Test privacy controls
npm test -- packages/ast-helper/src/test/error-reporting/privacy/privacy-manager.test.ts
```

## 🚀 Performance Optimization

### Best Practices

1. **Batch Error Reporting** - Use batching to reduce network overhead
2. **Asynchronous Processing** - All operations are non-blocking
3. **Memory Management** - Automatic cleanup of old error data
4. **Rate Limiting** - Built-in rate limiting to prevent abuse
5. **Caching** - Intelligent caching of suggestions and analytics

### Performance Monitoring

```typescript
// Monitor system performance
const metrics = await errorManager.getPerformanceMetrics();
console.log('Average response time:', metrics.avgResponseTime);
console.log('Memory usage:', metrics.memoryUsage);
console.log('Error processing rate:', metrics.processingRate);
```

## 🛠️ Troubleshooting

### Common Issues

**Issue**: Error reporting not working
**Solution**: Check API key and endpoint configuration

**Issue**: Privacy settings not applied
**Solution**: Ensure settings are updated before reporting errors

**Issue**: Crash detection not triggering
**Solution**: Verify crash detection is enabled in configuration

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const errorManager = new ComprehensiveErrorReportingManager({
  debug: true,
  logLevel: 'debug'
});
```

## 📖 Examples

See the `/examples` directory for complete implementation examples:

- [Basic Error Reporting](examples/basic-usage.ts)
- [Advanced Configuration](examples/advanced-config.ts)
- [Privacy-First Setup](examples/privacy-focused.ts)
- [Analytics Integration](examples/analytics.ts)
- [Custom Crash Handling](examples/crash-handling.ts)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

## 🆘 Support

For support and questions:

- 📧 Email: support@ast-copilot-helper.dev
- 💬 Discord: [Join our community](https://discord.gg/ast-copilot-helper)
- 🐛 Issues: [GitHub Issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
- 📚 Documentation: [Full Documentation](https://docs.ast-copilot-helper.dev)