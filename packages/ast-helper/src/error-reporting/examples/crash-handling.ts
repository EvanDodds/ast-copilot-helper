/**
 * Custom Crash Handling Example
 * 
 * This example demonstrates advanced crash detection and handling:
 * - Custom crash detection rules
 * - Automatic recovery mechanisms
 * - Crash pattern analysis
 * - Custom recovery strategies
 * - Emergency response procedures
 */

import { ComprehensiveErrorReportingManager } from '../manager';
import { ErrorReportingConfig } from '../types';

async function customCrashHandlingExample() {
  console.log('💥 Starting Custom Crash Handling Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();

  const crashConfig: ErrorReportingConfig = {
    enabled: true,
    enableCrashReporting: true, // Enable comprehensive crash detection
    enableAutomaticReporting: true,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    privacyMode: false,
    userReportingEnabled: true,
    maxReportSize: 2 * 1024 * 1024,
    maxHistoryEntries: 1000,
    diagnosticDataCollection: {
      system: true, // Important for crash analysis
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 15000, // Extended time for crash scenarios
      includeEnvironmentVars: true,
      includeProcessInfo: true
    }
  };

  await errorManager.initialize(crashConfig);

  try {
    console.log('🔧 Setting up Custom Crash Detection and Recovery\n');

    // Example 1: Memory leak simulation and detection
    console.log('📝 Example 1: Memory leak detection and recovery');
    console.log('🧠 Simulating memory leak scenario...');
    
    // Simulate memory pressure that would trigger crash detection
    const memoryError = new Error('Memory usage exceeded critical threshold: 95%');
    memoryError.name = 'MemoryExhaustionError';
    
    const memoryReport = await errorManager.generateErrorReport(memoryError, {
      operation: 'memory-monitoring',
      currentHeapUsed: 950 * 1024 * 1024, // 950MB
      heapLimit: 1000 * 1024 * 1024, // 1GB
      utilizationPercent: 95,
      trendingUp: true,
      gcFrequency: 'high',
      customRecoveryAction: 'memory-cleanup'
    });
    
    await errorManager.reportError(memoryReport);
    console.log('✅ Memory leak detected and recovery initiated\n');

    // Example 2: Unhandled exception simulation
    console.log('📝 Example 2: Unhandled exception with custom recovery');
    console.log('💥 Simulating unhandled exception...');
    
    const unhandledException = new Error('Unhandled promise rejection in critical component');
    unhandledException.name = 'UnhandledPromiseRejection';
    
    const exceptionReport = await errorManager.generateErrorReport(unhandledException, {
      operation: 'promise-handling',
      component: 'UserAuthenticationService',
      promiseChain: 'login -> validateToken -> fetchUserData',
      failurePoint: 'fetchUserData',
      cascadeRisk: 'high',
      customRecoveryAction: 'service-restart'
    });
    
    await errorManager.reportError(exceptionReport);
    console.log('✅ Unhandled exception captured and recovery plan activated\n');

    // Example 3: Resource exhaustion scenario
    console.log('📝 Example 3: Resource exhaustion with emergency procedures');
    console.log('📊 Simulating resource exhaustion...');
    
    const resourceError = new Error('Database connection pool exhausted');
    resourceError.name = 'ResourceExhaustionError';
    
    const resourceReport = await errorManager.generateErrorReport(resourceError, {
      operation: 'resource-management',
      resourceType: 'database-connections',
      currentUsage: 100,
      maxCapacity: 100,
      queuedRequests: 50,
      averageWaitTime: 5000,
      businessImpact: 'critical',
      customRecoveryAction: 'pool-expansion'
    });
    
    await errorManager.reportError(resourceReport);
    console.log('✅ Resource exhaustion handled with emergency scaling\n');

    // Example 4: Application hang detection
    console.log('📝 Example 4: Application hang detection and intervention');
    console.log('⏸️ Simulating application hang...');
    
    const hangError = new Error('Main event loop blocked for extended period');
    hangError.name = 'EventLoopBlockError';
    
    const hangReport = await errorManager.generateErrorReport(hangError, {
      operation: 'event-loop-monitoring',
      blockDuration: 30000, // 30 seconds
      blockingOperation: 'synchronous-file-processing',
      queuedEvents: 1500,
      userRequests: 25,
      customRecoveryAction: 'process-restart'
    });
    
    await errorManager.reportError(hangReport);
    console.log('✅ Application hang detected and intervention triggered\n');

    // Example 5: Cascade failure prevention
    console.log('📝 Example 5: Cascade failure prevention');
    console.log('🔗 Simulating potential cascade failure...');
    
    const cascadeError = new Error('Primary service failure triggering cascade protection');
    cascadeError.name = 'CascadeFailureError';
    
    const cascadeReport = await errorManager.generateErrorReport(cascadeError, {
      operation: 'cascade-prevention',
      primaryService: 'payment-processor',
      dependentServices: ['order-service', 'inventory-service', 'notification-service'],
      circuitBreakerState: 'open',
      fallbackActivated: true,
      customRecoveryAction: 'circuit-breaker-fallback'
    });
    
    await errorManager.reportError(cascadeReport);
    console.log('✅ Cascade failure prevented with circuit breaker activation\n');

    // Example 6: Custom recovery strategy implementation
    console.log('📝 Example 6: Custom recovery strategies');
    
    const recoveryStrategies = [
      {
        name: 'Graceful Degradation',
        description: 'Disable non-essential features to maintain core functionality',
        triggers: ['high-memory-usage', 'high-cpu-usage', 'slow-response-times']
      },
      {
        name: 'Load Shedding',
        description: 'Reject lower priority requests to preserve system stability',
        triggers: ['resource-exhaustion', 'queue-overflow', 'response-timeout']
      },
      {
        name: 'Emergency Scaling',
        description: 'Automatically scale resources to handle increased load',
        triggers: ['capacity-exceeded', 'performance-degradation', 'user-wait-times']
      },
      {
        name: 'Failover Activation',
        description: 'Switch to backup systems or redundant components',
        triggers: ['service-unavailable', 'data-corruption', 'network-partition']
      },
      {
        name: 'Data Recovery',
        description: 'Restore from backups or rebuild corrupted data structures',
        triggers: ['data-corruption', 'index-corruption', 'state-inconsistency']
      }
    ];
    
    console.log('🛠️ Available Recovery Strategies:');
    recoveryStrategies.forEach((strategy, index) => {
      console.log(`   ${index + 1}. ${strategy.name}`);
      console.log(`      ${strategy.description}`);
      console.log(`      Triggers: ${strategy.triggers.join(', ')}`);
    });
    console.log();

    // Example 7: Crash analysis and pattern recognition
    console.log('📊 Example 7: Crash Analysis and Pattern Recognition');
    
    const errorHistory = await errorManager.getErrorHistory();
    const crashLikeErrors = errorHistory.filter(entry => 
      entry.error.severity === 'critical' || 
      entry.error.category.includes('memory') ||
      entry.error.category.includes('crash') ||
      entry.error.message.toLowerCase().includes('crash') ||
      entry.error.message.toLowerCase().includes('hang') ||
      entry.error.message.toLowerCase().includes('exhaustion')
    );
    
    if (crashLikeErrors.length > 0) {
      console.log(`🔍 Crash Pattern Analysis (${crashLikeErrors.length} critical incidents):`);
      
      // Analyze crash patterns
      const crashPatterns = crashLikeErrors.reduce((acc, entry) => {
        const pattern = entry.error.context.operation || 'unknown';
        acc[pattern] = (acc[pattern] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('   Common crash patterns:');
      Object.entries(crashPatterns)
        .sort(([,a], [,b]) => b - a)
        .forEach(([pattern, count]) => {
          console.log(`   - ${pattern}: ${count} incidents`);
        });
      
      // Time-based analysis
      const recentCrashes = crashLikeErrors.filter(entry => 
        entry.error.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      
      console.log(`   Recent critical incidents (24h): ${recentCrashes.length}`);
      
      if (recentCrashes.length > 0) {
        console.log('   ⚠️ System stability concern detected');
        console.log('   🔧 Recommended actions:');
        console.log('      - Increase monitoring frequency');
        console.log('      - Review resource allocation');
        console.log('      - Consider emergency scaling');
        console.log('      - Activate enhanced logging');
      }
    }
    
    console.log('\n✅ Custom crash handling example completed successfully!');
    console.log('🛡️ Advanced crash detection and recovery systems demonstrated');

  } catch (error) {
    console.error('❌ Error in custom crash handling example:', error);
  } finally {
    await errorManager.cleanup();
    console.log('🧹 Crash handling example cleanup completed');
  }
}

async function emergencyResponseExample() {
  console.log('\n🚨 Emergency Response Procedures Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();
  await errorManager.initialize({
    enabled: true,
    enableCrashReporting: true,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    enableAutomaticReporting: true,
    privacyMode: false,
    userReportingEnabled: true,
    maxReportSize: 2 * 1024 * 1024,
    maxHistoryEntries: 1000,
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 10000,
      includeEnvironmentVars: true,
      includeProcessInfo: true
    }
  });

  console.log('🚨 Emergency Response Procedures:');
  console.log();

  const emergencyScenarios = [
    {
      name: 'System-wide Failure',
      severity: 'critical',
      description: 'Multiple services down, user access compromised',
      response: [
        'Immediate failover to backup systems',
        'Activate incident command center',
        'Notify all stakeholders',
        'Begin root cause analysis'
      ]
    },
    {
      name: 'Data Corruption',
      severity: 'critical',
      description: 'Database integrity compromised, data loss risk',
      response: [
        'Stop all write operations',
        'Activate point-in-time recovery',
        'Verify backup integrity',
        'Implement data validation procedures'
      ]
    },
    {
      name: 'Security Breach',
      severity: 'critical',
      description: 'Unauthorized access detected, potential data exposure',
      response: [
        'Isolate affected systems',
        'Revoke all authentication tokens',
        'Activate security incident response',
        'Begin forensic analysis'
      ]
    },
    {
      name: 'Performance Degradation',
      severity: 'high',
      description: 'System response times severely impacted',
      response: [
        'Enable load shedding',
        'Scale critical resources',
        'Activate performance monitoring',
        'Identify and isolate bottlenecks'
      ]
    }
  ];

  for (const scenario of emergencyScenarios) {
    console.log(`🚨 Scenario: ${scenario.name}`);
    console.log(`   Severity: ${scenario.severity.toUpperCase()}`);
    console.log(`   Description: ${scenario.description}`);
    console.log('   Response Procedures:');
    scenario.response.forEach((step, index) => {
      console.log(`      ${index + 1}. ${step}`);
    });
    console.log();

    // Simulate emergency response
    const emergencyError = new Error(`Emergency: ${scenario.description}`);
    emergencyError.name = 'EmergencyScenario';
    
    const emergencyReport = await errorManager.generateErrorReport(emergencyError, {
      operation: 'emergency-response',
      scenario: scenario.name,
      severity: scenario.severity,
      responseActivated: true,
      proceduresFollowed: scenario.response,
      estimatedRecoveryTime: Math.floor(Math.random() * 60) + 30 // 30-90 minutes
    });
    
    const result = await errorManager.reportError(emergencyReport);
    console.log(`📋 Emergency response logged: ${result.errorId}\n`);
  }

  console.log('✅ Emergency response procedures documented and tested');
  await errorManager.cleanup();
}

// Run the examples
if (require.main === module) {
  (async () => {
    await customCrashHandlingExample();
    await emergencyResponseExample();
  })().catch(console.error);
}

export { customCrashHandlingExample, emergencyResponseExample };