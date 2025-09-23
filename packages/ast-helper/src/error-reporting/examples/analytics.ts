/**
 * Analytics Integration Example
 * 
 * This example demonstrates analytics and reporting features:
 * - Error trend analysis
 * - Pattern recognition
 * - Custom metrics and dashboards
 * - Performance monitoring
 * - Historical analysis
 */

import { ComprehensiveErrorReportingManager } from '../manager';
import type { ErrorReportingConfig } from '../types';

async function analyticsIntegrationExample() {
  console.log('📊 Starting Analytics Integration Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();

  const analyticsConfig: ErrorReportingConfig = {
    enabled: true,
    enableCrashReporting: true,
    enableAutomaticReporting: true,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    privacyMode: false,
    userReportingEnabled: true,
    maxReportSize: 2 * 1024 * 1024,
    maxHistoryEntries: 1000, // Large history for analytics
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true, // Important for analytics
      dependencies: true,
      maxCollectionTimeMs: 10000,
      includeEnvironmentVars: true,
      includeProcessInfo: true
    }
  };

  await errorManager.initialize(analyticsConfig);

  try {
    console.log('📈 Generating Sample Data for Analytics\n');

    // Generate various types of errors for analysis
    const errorScenarios = [
      {
        name: 'API Timeout',
        count: 15,
        error: () => {
          const error = new Error(`API request timeout after ${5000 + Math.random() * 3000}ms`);
          error.name = 'TimeoutError';
          return error;
        },
        context: () => ({
          operation: 'api-request',
          endpoint: '/api/v1/users',
          timeout: 5000 + Math.random() * 3000,
          retries: Math.floor(Math.random() * 3)
        })
      },
      {
        name: 'Database Connection',
        count: 8,
        error: () => {
          const error = new Error('Connection to database lost');
          error.name = 'DatabaseError';
          return error;
        },
        context: () => ({
          operation: 'database-query',
          query: 'SELECT * FROM users WHERE active = true',
          connectionPool: Math.floor(Math.random() * 10) + 1,
          activeConnections: Math.floor(Math.random() * 8)
        })
      },
      {
        name: 'Memory Pressure',
        count: 5,
        error: () => {
          const error = new Error('Memory usage exceeded threshold');
          error.name = 'MemoryError';
          return error;
        },
        context: () => ({
          operation: 'memory-monitoring',
          heapUsed: Math.floor(Math.random() * 100) + 80,
          heapTotal: 150,
          threshold: 80
        })
      },
      {
        name: 'Parse Error',
        count: 12,
        error: () => {
          const error = new Error(`Unexpected token at line ${Math.floor(Math.random() * 100) + 1}`);
          error.name = 'SyntaxError';
          return error;
        },
        context: () => ({
          operation: 'code-parsing',
          fileName: `src/components/Component${Math.floor(Math.random() * 50)}.tsx`,
          line: Math.floor(Math.random() * 100) + 1,
          column: Math.floor(Math.random() * 50) + 1
        })
      },
      {
        name: 'Network Error',
        count: 10,
        error: () => {
          const error = new Error('Network request failed');
          error.name = 'NetworkError';
          return error;
        },
        context: () => ({
          operation: 'network-request',
          url: 'https://api.external-service.com/data',
          statusCode: [404, 500, 502, 503][Math.floor(Math.random() * 4)],
          responseTime: Math.floor(Math.random() * 5000) + 1000
        })
      }
    ];

    // Generate sample errors over time
    let totalErrors = 0;
    for (const scenario of errorScenarios) {
      console.log(`📝 Generating ${scenario.count} ${scenario.name} errors...`);
      
      for (let i = 0; i < scenario.count; i++) {
        const error = scenario.error();
        const context = scenario.context();
        
        const report = await errorManager.generateErrorReport(error, context);
        
        // Simulate errors happening over time by slightly adjusting timestamp
        const timestampOffset = Math.random() * 24 * 60 * 60 * 1000; // Random time within 24 hours
        report.timestamp = new Date(Date.now() - timestampOffset);
        
        await errorManager.reportError(report);
        totalErrors++;
        
        // Small delay to avoid overwhelming the system
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }
    
    console.log(`✅ Generated ${totalErrors} sample errors for analysis\n`);

    // Example 1: Error history analysis
    console.log('📊 Example 1: Error History Analysis');
    const errorHistory = await errorManager.getErrorHistory();
    
    // Analyze errors by category
    const errorsByCategory = errorHistory.reduce((acc, entry) => {
      const category = entry.error.category;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📈 Error Distribution by Category:');
    Object.entries(errorsByCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        const percentage = ((count / errorHistory.length) * 100).toFixed(1);
        console.log(`   ${category}: ${count} errors (${percentage}%)`);
      });
    console.log();

    // Example 2: Severity analysis
    console.log('📊 Example 2: Error Severity Analysis');
    const errorsBySeverity = errorHistory.reduce((acc, entry) => {
      const severity = entry.error.severity;
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('⚡ Error Distribution by Severity:');
    Object.entries(errorsBySeverity)
      .sort(([,a], [,b]) => b - a)
      .forEach(([severity, count]) => {
        const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${icon} ${severity}: ${count} errors`);
      });
    console.log();

    // Example 3: Time-based analysis
    console.log('📊 Example 3: Time-based Error Analysis');
    const now = new Date();
    const timeRanges = {
      'Last Hour': 60 * 60 * 1000,
      'Last 6 Hours': 6 * 60 * 60 * 1000,
      'Last 24 Hours': 24 * 60 * 60 * 1000
    };
    
    Object.entries(timeRanges).forEach(([label, milliseconds]) => {
      const cutoff = new Date(now.getTime() - milliseconds);
      const recentErrors = errorHistory.filter(entry => entry.error.timestamp > cutoff);
      console.log(`   ${label}: ${recentErrors.length} errors`);
    });
    console.log();

    // Example 4: Performance correlation analysis
    console.log('📊 Example 4: Performance Correlation Analysis');
    const performanceErrors = errorHistory.filter(entry => 
      entry.error.category.includes('timeout') || 
      entry.error.category.includes('memory') ||
      entry.error.category.includes('performance')
    );
    
    if (performanceErrors.length > 0) {
      console.log(`🔍 Performance-related errors: ${performanceErrors.length}`);
      console.log('   Common patterns:');
      
      // Analyze patterns in performance errors
      const patterns = performanceErrors.reduce((acc, entry) => {
        const operation = entry.error.context.operation;
        if (operation) {
          acc[operation] = (acc[operation] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(patterns)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .forEach(([operation, count]) => {
          console.log(`   - ${operation}: ${count} occurrences`);
        });
    }
    console.log();

    // Example 5: System health metrics
    console.log('📊 Example 5: System Health Metrics');
    const diagnostics = await errorManager.exportDiagnostics('json');
    const diagnosticsData = JSON.parse(diagnostics);
    
    console.log('🏥 System Health Overview:');
    if (diagnosticsData.environment) {
      console.log(`   - Platform: ${diagnosticsData.environment.platform}`);
      console.log(`   - Architecture: ${diagnosticsData.environment.arch}`);
      console.log(`   - Node.js: ${diagnosticsData.environment.nodeVersion}`);
      
      if (diagnosticsData.environment.memoryUsage) {
        const memUsage = diagnosticsData.environment.memoryUsage;
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        console.log(`   - Memory: ${heapUsedMB}MB / ${heapTotalMB}MB heap`);
      }
      
      if (diagnosticsData.environment.uptime) {
        const uptimeHours = Math.round(diagnosticsData.environment.uptime / 3600);
        console.log(`   - Uptime: ${uptimeHours} hours`);
      }
    }
    console.log();

    // Example 6: Predictive analytics insights
    console.log('📊 Example 6: Predictive Analytics Insights');
    
    // Simple trend analysis
    const recentErrors = errorHistory
      .filter(entry => entry.error.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .sort((a, b) => a.error.timestamp.getTime() - b.error.timestamp.getTime());
    
    if (recentErrors.length >= 10) {
      const firstHalf = recentErrors.slice(0, Math.floor(recentErrors.length / 2));
      const secondHalf = recentErrors.slice(Math.floor(recentErrors.length / 2));
      
      const firstHalfRate = firstHalf.length / 12; // errors per hour (assuming 24h period)
      const secondHalfRate = secondHalf.length / 12;
      
      console.log('📈 Error Rate Trends (24h period):');
      console.log(`   - First half: ${firstHalfRate.toFixed(2)} errors/hour`);
      console.log(`   - Second half: ${secondHalfRate.toFixed(2)} errors/hour`);
      
      if (secondHalfRate > firstHalfRate * 1.2) {
        console.log('   ⚠️ Warning: Error rate is increasing');
      } else if (secondHalfRate < firstHalfRate * 0.8) {
        console.log('   ✅ Good: Error rate is decreasing');
      } else {
        console.log('   📊 Stable: Error rate is consistent');
      }
    }
    
    console.log('\n✅ Analytics integration example completed successfully!');
    console.log('📊 Comprehensive error analytics and insights generated');

  } catch (error) {
    console.error('❌ Error in analytics integration example:', error);
  } finally {
    await errorManager.cleanup();
    console.log('🧹 Analytics example cleanup completed');
  }
}

async function customMetricsExample() {
  console.log('\n📏 Custom Metrics and KPIs Example\n');

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
    maxHistoryEntries: 500,
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

  // Generate some errors with custom metrics
  const customMetricErrors = [
    {
      message: 'API response time SLA violation',
      context: {
        operation: 'api-monitoring',
        responseTime: 3500,
        slaTarget: 2000,
        endpoint: '/api/v1/search',
        customMetrics: {
          'response_time_ms': 3500,
          'sla_violation': true,
          'user_impact_score': 8.5,
          'business_priority': 'high'
        }
      }
    },
    {
      message: 'Database query performance degradation',
      context: {
        operation: 'database-monitoring',
        queryTime: 1200,
        averageTime: 300,
        customMetrics: {
          'query_time_ms': 1200,
          'performance_degradation_ratio': 4.0,
          'affected_users': 25,
          'data_freshness_impact': 'medium'
        }
      }
    },
    {
      message: 'Memory usage approaching critical threshold',
      context: {
        operation: 'resource-monitoring',
        currentUsage: 89,
        criticalThreshold: 90,
        customMetrics: {
          'memory_usage_percent': 89,
          'time_to_critical_seconds': 180,
          'gc_frequency_increase': 2.5,
          'performance_impact_score': 7.2
        }
      }
    }
  ];

  for (const errorData of customMetricErrors) {
    const error = new Error(errorData.message);
    error.name = 'CustomMetricsError';
    
    const report = await errorManager.generateErrorReport(error, errorData.context);
    const result = await errorManager.reportError(report);
    
    console.log(`📏 Custom metrics error reported: ${result.errorId}`);
    console.log(`   Metrics: ${Object.keys(errorData.context.customMetrics).join(', ')}`);
  }

  console.log('\n📊 Custom KPIs can be tracked and analyzed based on these metrics');
  console.log('   - Response time violations and trends');
  console.log('   - User impact scoring and prioritization');
  console.log('   - Resource utilization patterns');
  console.log('   - Business priority correlation with technical issues\n');

  await errorManager.cleanup();
}

// Run the examples
if (require.main === module) {
  (async () => {
    await analyticsIntegrationExample();
    await customMetricsExample();
  })().catch(console.error);
}

export { analyticsIntegrationExample, customMetricsExample };