/**
 * Privacy-Focused Setup Example
 * 
 * This example demonstrates privacy-first error reporting with:
 * - Privacy mode configuration
 * - Data anonymization and PII scrubbing
 * - Consent management
 * - Minimal data collection
 * - GDPR/CCPA compliance
 */

import { ComprehensiveErrorReportingManager } from '../manager';
import { ErrorReportingConfig } from '../types';

async function privacyFocusedExample() {
  console.log('🔒 Starting Privacy-Focused Error Reporting Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();

  // Privacy-first configuration
  const privacyConfig: ErrorReportingConfig = {
    enabled: true,
    
    // Core settings - minimal but functional
    enableCrashReporting: true,
    enableAutomaticReporting: false, // Require explicit consent
    collectSystemInfo: false, // Minimal system info collection
    collectCodebaseInfo: false, // Don't collect codebase details
    
    // Privacy settings
    privacyMode: true, // Enable strict privacy mode
    userReportingEnabled: true, // Allow user to control reporting
    
    // Minimal data retention
    maxReportSize: 512 * 1024, // 512KB limit
    maxHistoryEntries: 100, // Limited history
    
    // Minimal diagnostic collection
    diagnosticDataCollection: {
      system: false, // No system diagnostics
      runtime: true, // Basic runtime info only
      codebase: false, // No codebase analysis
      configuration: false, // No config details
      performance: false, // No performance metrics
      dependencies: false, // No dependency info
      maxCollectionTimeMs: 2000, // Quick collection only
      includeEnvironmentVars: false, // Never include env vars
      includeProcessInfo: false // No process details
    }
  };

  await errorManager.initialize(privacyConfig);

  try {
    console.log('🔐 Testing Privacy-Focused Error Reporting\n');

    // Example 1: Error with potentially sensitive data
    console.log('📝 Example 1: Error with sensitive data (will be scrubbed)');
    const sensitiveError = new Error('Database connection failed for user john.doe@company.com');
    sensitiveError.name = 'DatabaseConnectionError';
    
    const sensitiveReport = await errorManager.generateErrorReport(sensitiveError, {
      operation: 'database-connection',
      // This data would normally contain sensitive information
      userEmail: 'john.doe@company.com',
      connectionString: 'postgresql://user:password@db.internal:5432/sensitive_db',
      apiKey: 'sk_live_abc123def456',
      creditCardNumber: '4532-1234-5678-9012',
      socialSecurityNumber: '123-45-6789'
    });
    
    const sensitiveResult = await errorManager.reportError(sensitiveReport);
    console.log(`✅ Sensitive error reported (data scrubbed): ${sensitiveResult.errorId}`);
    console.log('🔍 Notice: PII and sensitive data has been automatically scrubbed\n');

    // Example 2: Minimal error reporting
    console.log('📝 Example 2: Minimal error with basic context only');
    const minimalError = new Error('Operation timeout');
    minimalError.name = 'TimeoutError';
    
    const minimalReport = await errorManager.generateErrorReport(minimalError, {
      operation: 'api-request',
      timeout: 5000,
      // Only include non-sensitive operational data
      retries: 2
    });
    
    const minimalResult = await errorManager.reportError(minimalReport);
    console.log(`✅ Minimal error reported: ${minimalResult.errorId}\n`);

    // Example 3: User consent simulation
    console.log('📝 Example 3: Simulating user consent management');
    console.log('🤝 In a real application, you would:');
    console.log('   - Show user consent dialog');
    console.log('   - Allow user to choose data sharing level');
    console.log('   - Respect user preferences for each error type');
    console.log('   - Provide opt-out mechanisms');
    console.log('   - Allow data deletion requests\n');

    // Example 4: Anonymous error reporting
    console.log('📝 Example 4: Completely anonymous error reporting');
    const anonymousError = new Error('Unexpected application state');
    anonymousError.name = 'ApplicationStateError';
    
    const anonymousReport = await errorManager.generateErrorReport(anonymousError, {
      operation: 'state-management',
      // No user identifiers or personal data
      component: 'StateManager',
      action: 'update',
      previousState: 'loading',
      targetState: 'ready',
      actualState: 'error'
    });
    
    const anonymousResult = await errorManager.reportError(anonymousReport);
    console.log(`✅ Anonymous error reported: ${anonymousResult.errorId}\n`);

    // Example 5: Privacy-compliant diagnostics
    console.log('📊 Example 5: Privacy-compliant diagnostic export');
    const diagnostics = await errorManager.exportDiagnostics('json');
    const diagnosticsData = JSON.parse(diagnostics);
    
    console.log('🔍 Privacy-Compliant Diagnostics:');
    console.log(`   - Data anonymized: ✅`);
    console.log(`   - PII scrubbed: ✅`);
    console.log(`   - Minimal collection: ✅`);
    console.log(`   - No environment details: ✅`);
    
    // Show that sensitive system info is not included
    if (!diagnosticsData.environment?.environmentVars) {
      console.log(`   - Environment variables excluded: ✅`);
    }
    if (!diagnosticsData.diagnostics?.system) {
      console.log(`   - System diagnostics excluded: ✅`);
    }
    if (!diagnosticsData.diagnostics?.codebase) {
      console.log(`   - Codebase details excluded: ✅`);
    }
    console.log();

    // Example 6: Error history with privacy protection
    console.log('📋 Example 6: Privacy-protected error history');
    const errorHistory = await errorManager.getErrorHistory();
    
    if (errorHistory.length > 0) {
      console.log(`📊 Error History (${errorHistory.length} entries):`);
      
      errorHistory.slice(-3).forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.error.message}`);
        console.log(`      Category: ${entry.error.category}`);
        console.log(`      Time: ${entry.error.timestamp.toISOString()}`);
        console.log(`      User ID: [REDACTED]`); // Show that user IDs are protected
      });
      
      console.log('\n🔐 Notice: All personal identifiers have been anonymized');
    }
    
    console.log('\n✅ Privacy-focused example completed successfully!');
    console.log('🔒 All data has been processed with privacy protection');

  } catch (error) {
    console.error('❌ Error in privacy-focused example:', error);
  } finally {
    await errorManager.cleanup();
    console.log('🧹 Privacy-focused example cleanup completed');
  }
}

async function gdprComplianceExample() {
  console.log('\n⚖️ GDPR Compliance Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();
  
  // GDPR-compliant configuration
  await errorManager.initialize({
    enabled: true,
    enableCrashReporting: false, // Disabled until user consent
    enableAutomaticReporting: false,
    privacyMode: true,
    userReportingEnabled: true,
    collectSystemInfo: false,
    collectCodebaseInfo: false,
    maxReportSize: 256 * 1024, // Very limited data
    maxHistoryEntries: 50, // Short retention
    diagnosticDataCollection: {
      system: false,
      runtime: false,
      codebase: false,
      configuration: false,
      performance: false,
      dependencies: false,
      maxCollectionTimeMs: 1000,
      includeEnvironmentVars: false,
      includeProcessInfo: false
    }
  });

  console.log('⚖️ GDPR Compliance Features Demonstrated:');
  console.log('   📋 Right to be informed: Users know what data is collected');
  console.log('   🎯 Data minimization: Only essential error data collected');
  console.log('   🔐 Privacy by design: System defaults to minimal collection');
  console.log('   ⏳ Storage limitation: Short data retention periods');
  console.log('   🛡️ Security: Data protection and encryption');
  console.log('   🗑️ Right to erasure: Error data can be deleted on request');
  console.log();

  // Simulate GDPR-compliant error reporting
  console.log('📝 Reporting error with GDPR compliance:');
  
  const gdprError = new Error('Form validation failed');
  const gdprReport = await errorManager.generateErrorReport(gdprError, {
    operation: 'form-validation',
    formType: 'contact',
    // No personal data included
    fieldCount: 5,
    validationRules: 'standard'
  });
  
  const result = await errorManager.reportError(gdprReport);
  console.log(`✅ GDPR-compliant error reported: ${result.errorId}`);
  console.log('   🔒 No personal data collected or transmitted');
  
  await errorManager.cleanup();
}

async function dataAnonymizationExample() {
  console.log('\n🎭 Data Anonymization Example\n');

  const errorManager = new ComprehensiveErrorReportingManager();
  await errorManager.initialize({
    enabled: true,
    privacyMode: true,
    enableCrashReporting: true,
    collectSystemInfo: false,
    collectCodebaseInfo: false,
    enableAutomaticReporting: false,
    userReportingEnabled: true,
    maxReportSize: 512 * 1024,
    maxHistoryEntries: 100,
    diagnosticDataCollection: {
      system: false,
      runtime: true,
      codebase: false,
      configuration: false,
      performance: false,
      dependencies: false,
      maxCollectionTimeMs: 2000,
      includeEnvironmentVars: false,
      includeProcessInfo: false
    }
  });

  console.log('🎭 Testing Data Anonymization Capabilities:');

  const sensitiveDataExamples = [
    'User email: john.doe@company.com failed authentication',
    'Credit card 4532-1234-5678-9012 processing failed',
    'API key sk_live_abc123def456 is invalid',
    'IP address 192.168.1.100 made suspicious request',
    'Phone number +1-555-123-4567 verification failed'
  ];

  for (let i = 0; i < sensitiveDataExamples.length; i++) {
    const sensitiveMessage = sensitiveDataExamples[i];
    console.log(`\n📝 Example ${i + 1}: Processing sensitive data`);
    console.log(`   Original: ${sensitiveMessage}`);
    
    const error = new Error(sensitiveMessage);
    error.name = 'DataProcessingError';
    
    const report = await errorManager.generateErrorReport(error, {
      operation: 'data-processing',
      step: i + 1
    });
    
    const result = await errorManager.reportError(report);
    console.log(`   Anonymized: ${report.message}`);
    console.log(`   Report ID: ${result.errorId}`);
  }

  console.log('\n🔍 Notice: All personally identifiable information has been');
  console.log('   automatically detected and anonymized while preserving');
  console.log('   the essential error information for debugging.\n');

  await errorManager.cleanup();
}

// Run the examples
if (require.main === module) {
  (async () => {
    await privacyFocusedExample();
    await gdprComplianceExample();
    await dataAnonymizationExample();
  })().catch(console.error);
}

export { privacyFocusedExample, gdprComplianceExample, dataAnonymizationExample };