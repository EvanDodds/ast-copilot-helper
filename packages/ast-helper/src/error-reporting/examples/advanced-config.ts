/**
 * Advanced Configuration Example
 * 
 * This example demonstrates advanced configuration options including:
 * - Custom error categories and severity levels
 * - Privacy and security settings
 * - Analytics and reporting configuration
 * - Custom crash handling
 */

import { ComprehensiveErrorReportingManager } from '../manager';
import { ErrorReportingConfig } from '../types';

async function advancedConfigurationExample() {
  console.log('🚀 Starting Advanced Configuration Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();

  // Advanced configuration with all options
  const advancedConfig: ErrorReportingConfig = {
    enabled: true,
    endpoint: 'https://errors.example.com/api/v1/reports',
    apiKey: process.env.ERROR_REPORTING_API_KEY,
    
    // Core reporting settings
    enableCrashReporting: true,
    enableAutomaticReporting: false, // Manual control over reporting
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    maxReportSize: 2 * 1024 * 1024, // 2MB limit
    maxHistoryEntries: 5000, // Keep more history
    
    // Privacy and user settings
    privacyMode: false,
    userReportingEnabled: true,
    
    // Comprehensive diagnostic collection
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 15000, // Extended collection time
      includeEnvironmentVars: true, // Include environment variables
      includeProcessInfo: true
    }
  };

  await errorManager.initialize(advancedConfig);

  try {
    console.log('🔧 Testing Advanced Error Reporting Features\n');

    // Example 1: Custom error with detailed context
    console.log('📝 Example 1: Custom error with comprehensive context');
    const customError = new Error('Database connection timeout after retry attempts');
    customError.name = 'DatabaseConnectionError';
    
    const customReport = await errorManager.generateErrorReport(customError, {
      operation: 'database-connection',
      component: 'UserService',
      connectionString: 'postgresql://***:***@db.example.com:5432/app',
      retryAttempts: 3,
      timeout: 30000,
      lastSuccessfulConnection: new Date(Date.now() - 300000), // 5 minutes ago
      poolSize: 10,
      activeConnections: 8,
      performanceMetrics: {
        avgResponseTime: 1200,
        p95ResponseTime: 2400,
        errorRate: 0.05
      }
    });
    
    const customResult = await errorManager.reportError(customReport);
    console.log(`✅ Custom error reported: ${customResult.errorId}`);
    console.log(`📊 Category: ${customReport.category}`);
    console.log(`⚡ Severity: ${customReport.severity}\n`);

    // Example 2: Performance monitoring
    console.log('📝 Example 2: Performance monitoring with thresholds');
    const performanceError = new Error('API endpoint response time exceeded SLA threshold');
    performanceError.name = 'PerformanceViolation';
    
    const perfReport = await errorManager.generateErrorReport(performanceError, {
      operation: 'api-monitoring',
      endpoint: '/api/v1/users/search',
      responseTime: 5500,
      threshold: 2000,
      slaTarget: 95, // 95% of requests under 2s
      currentSLA: 87,
      requestVolume: 1250,
      errorRate: 0.02,
      timeWindow: '5m'
    });
    
    const perfResult = await errorManager.reportError(perfReport);
    console.log(`⚡ Performance issue reported: ${perfResult.errorId}\n`);

    // Example 3: Complex system error with multiple components
    console.log('📝 Example 3: Multi-component system error');
    const systemError = new Error('Distributed transaction failed across microservices');
    systemError.name = 'DistributedTransactionError';
    
    const systemReport = await errorManager.generateErrorReport(systemError, {
      operation: 'distributed-transaction',
      transactionId: 'tx_12345_67890',
      services: ['user-service', 'payment-service', 'inventory-service', 'notification-service'],
      failedService: 'payment-service',
      compensationAttempted: true,
      partialSuccess: {
        'user-service': 'committed',
        'payment-service': 'failed',
        'inventory-service': 'rolled-back',
        'notification-service': 'not-started'
      },
      correlationId: 'corr_abc123_def456'
    });
    
    const systemResult = await errorManager.reportError(systemReport);
    console.log(`🔄 Distributed system error reported: ${systemResult.errorId}\n`);

    // Example 4: Get comprehensive analytics
    console.log('📊 Example 4: Comprehensive system analytics');
    const diagnostics = await errorManager.exportDiagnostics('json');
    const diagnosticsData = JSON.parse(diagnostics);
    
    console.log('📈 System Health Overview:');
    console.log(`   - Platform: ${diagnosticsData.environment?.platform}`);
    console.log(`   - Node.js Version: ${diagnosticsData.environment?.nodeVersion}`);
    console.log(`   - Memory Usage: ${Math.round((diagnosticsData.environment?.memoryUsage?.heapUsed || 0) / 1024 / 1024)}MB`);
    console.log(`   - Uptime: ${Math.round((diagnosticsData.environment?.uptime || 0) / 3600)}h`);
    
    if (diagnosticsData.diagnostics) {
      console.log('🔍 Diagnostic Information:');
      console.log(`   - System Info Available: ${!!diagnosticsData.diagnostics.system}`);
      console.log(`   - Runtime Info Available: ${!!diagnosticsData.diagnostics.runtime}`);
      console.log(`   - Performance Info Available: ${!!diagnosticsData.diagnostics.performance}`);
    }
    console.log();

    // Example 5: Error history analysis
    console.log('📋 Example 5: Error history and patterns');
    const errorHistory = await errorManager.getErrorHistory();
    
    if (errorHistory.length > 0) {
      // Group errors by category
      const errorsByCategory = errorHistory.reduce((acc, entry) => {
        const category = entry.error.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📊 Error Distribution:');
      Object.entries(errorsByCategory).forEach(([category, count]) => {
        console.log(`   - ${category}: ${count} errors`);
      });
      
      // Find most recent high-severity errors
      const highSeverityErrors = errorHistory
        .filter(entry => entry.error.severity === 'high' || entry.error.severity === 'critical')
        .slice(-3);
      
      if (highSeverityErrors.length > 0) {
        console.log('\n🚨 Recent High-Severity Errors:');
        highSeverityErrors.forEach((entry, index) => {
          console.log(`   ${index + 1}. ${entry.error.message} (${entry.error.severity})`);
          console.log(`      Time: ${entry.error.timestamp.toISOString()}`);
        });
      }
    }
    
    console.log('\n✅ Advanced configuration example completed successfully!');

  } catch (error) {
    console.error('❌ Error in advanced configuration example:', error);
  } finally {
    await errorManager.cleanup();
    console.log('🧹 Advanced example cleanup completed');
  }
}

async function customErrorCategoriesExample() {
  console.log('\n🏷️ Custom Error Categories and Handling\n');

  const errorManager = new ComprehensiveErrorReportingManager();
  await errorManager.initialize({
    enabled: true,
    enableCrashReporting: true,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    enableAutomaticReporting: false,
    privacyMode: false,
    userReportingEnabled: true,
    maxReportSize: 1024 * 1024,
    maxHistoryEntries: 100,
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 5000,
      includeEnvironmentVars: false,
      includeProcessInfo: true
    }
  });

  const customErrorTypes = [
    {
      name: 'Business Logic Error',
      error: new Error('Invalid business rule: Customer credit limit exceeded'),
      context: {
        operation: 'credit-check',
        customerId: 'CUST_12345',
        requestedAmount: 50000,
        currentLimit: 25000,
        currentBalance: 18000,
        riskScore: 0.7
      }
    },
    {
      name: 'Data Validation Error',
      error: new Error('Required fields missing in user registration form'),
      context: {
        operation: 'user-registration',
        missingFields: ['email', 'phoneNumber', 'dateOfBirth'],
        providedFields: ['firstName', 'lastName', 'address'],
        validationRules: 'strict-mode',
        formVersion: 'v2.1'
      }
    },
    {
      name: 'External Service Error',
      error: new Error('Third-party payment gateway returned error'),
      context: {
        operation: 'payment-processing',
        gateway: 'stripe',
        apiVersion: '2023-10-16',
        errorCode: 'card_declined',
        retryAttempt: 2,
        transactionAmount: 99.99,
        currency: 'USD'
      }
    },
    {
      name: 'Security Violation',
      error: new Error('Suspicious activity detected: Multiple failed login attempts'),
      context: {
        operation: 'authentication',
        userId: 'user_suspicious_123',
        ipAddress: '192.168.1.100',
        failedAttempts: 5,
        timeWindow: '10m',
        userAgent: 'Mozilla/5.0...',
        geoLocation: 'Unknown'
      }
    }
  ];

  for (const { name, error, context } of customErrorTypes) {
    console.log(`🏷️ Processing ${name}:`);
    
    // Set appropriate error name for categorization
    error.name = name.replace(/\s+/g, '');
    
    const errorReport = await errorManager.generateErrorReport(error, context);
    const result = await errorManager.reportError(errorReport);
    
    console.log(`   📋 ID: ${result.errorId}`);
    console.log(`   📊 Category: ${errorReport.category}`);
    console.log(`   ⚡ Severity: ${errorReport.severity}`);
    console.log(`   💡 Suggestions: ${result.suggestions?.length || 0} generated`);
    console.log();
  }

  await errorManager.cleanup();
}

// Run the examples
if (require.main === module) {
  (async () => {
    await advancedConfigurationExample();
    await customErrorCategoriesExample();
  })().catch(console.error);
}

export { advancedConfigurationExample, customErrorCategoriesExample };