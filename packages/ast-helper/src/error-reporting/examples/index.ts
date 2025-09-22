/**
 * Error Reporting Examples Index
 * 
 * Collection of comprehensive examples demonstrating the error reporting system capabilities.
 * Run individual examples or the complete demonstration suite.
 */

// Import all example modules
import { basicUsageExample, errorTypeExamples } from './basic-usage';
import { advancedConfigurationExample, customErrorCategoriesExample } from './advanced-config';
import { privacyFocusedExample, gdprComplianceExample, dataAnonymizationExample } from './privacy-focused';
import { analyticsIntegrationExample, customMetricsExample } from './analytics';
import { customCrashHandlingExample, emergencyResponseExample } from './crash-handling';

/**
 * Run all examples in sequence
 */
async function runAllExamples() {
  console.log('🚀 Running Complete Error Reporting System Examples Suite\n');
  console.log('=' .repeat(80));
  
  const examples = [
    { name: 'Basic Usage', fn: basicUsageExample },
    { name: 'Error Types', fn: errorTypeExamples },
    { name: 'Advanced Configuration', fn: advancedConfigurationExample },
    { name: 'Custom Error Categories', fn: customErrorCategoriesExample },
    { name: 'Privacy-Focused Setup', fn: privacyFocusedExample },
    { name: 'GDPR Compliance', fn: gdprComplianceExample },
    { name: 'Data Anonymization', fn: dataAnonymizationExample },
    { name: 'Analytics Integration', fn: analyticsIntegrationExample },
    { name: 'Custom Metrics', fn: customMetricsExample },
    { name: 'Custom Crash Handling', fn: customCrashHandlingExample },
    { name: 'Emergency Response', fn: emergencyResponseExample }
  ];

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (!example) continue;
    
    try {
      console.log(`\n📋 Running Example ${i + 1}/${examples.length}: ${example.name}`);
      console.log('-'.repeat(60));
      
      await example.fn();
      completed++;
      
      console.log(`✅ Example "${example.name}" completed successfully`);
      
    } catch (error) {
      failed++;
      console.error(`❌ Example "${example.name}" failed:`, error);
    }
    
    // Add a separator between examples (except for the last one)
    if (i < examples.length - 1) {
      console.log('\n' + '='.repeat(80));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Examples Suite Summary');
  console.log('-'.repeat(30));
  console.log(`✅ Completed: ${completed}/${examples.length}`);
  console.log(`❌ Failed: ${failed}/${examples.length}`);
  console.log(`📈 Success Rate: ${((completed / examples.length) * 100).toFixed(1)}%`);
  
  if (completed === examples.length) {
    console.log('\n🎉 All examples completed successfully!');
    console.log('💡 The error reporting system is fully functional and ready for use.');
  } else if (failed > 0) {
    console.log('\n⚠️  Some examples failed. Please check the error messages above.');
  }
  
  console.log('\n🚀 Error Reporting System Examples Suite Complete');
}

/**
 * Run a specific example by name
 */
async function runExample(exampleName: string) {
  const exampleMap: Record<string, () => Promise<void>> = {
    'basic-usage': basicUsageExample,
    'error-types': errorTypeExamples,
    'advanced-config': advancedConfigurationExample,
    'custom-categories': customErrorCategoriesExample,
    'privacy-focused': privacyFocusedExample,
    'gdpr-compliance': gdprComplianceExample,
    'data-anonymization': dataAnonymizationExample,
    'analytics': analyticsIntegrationExample,
    'custom-metrics': customMetricsExample,
    'crash-handling': customCrashHandlingExample,
    'emergency-response': emergencyResponseExample
  };

  const exampleFn = exampleMap[exampleName];
  if (!exampleFn) {
    console.error(`❌ Example "${exampleName}" not found.`);
    console.log('\nAvailable examples:');
    Object.keys(exampleMap).forEach(name => {
      console.log(`  - ${name}`);
    });
    return;
  }

  console.log(`🚀 Running example: ${exampleName}\n`);
  
  try {
    await exampleFn();
    console.log(`\n✅ Example "${exampleName}" completed successfully!`);
  } catch (error) {
    console.error(`\n❌ Example "${exampleName}" failed:`, error);
  }
}

/**
 * Interactive example selector
 */
async function selectAndRunExample() {
  console.log('🎯 Error Reporting System - Interactive Example Selector\n');
  
  const examples = [
    { key: '1', name: 'basic-usage', description: 'Basic error reporting and suggestions' },
    { key: '2', name: 'error-types', description: 'Different error types and severities' },
    { key: '3', name: 'advanced-config', description: 'Advanced configuration options' },
    { key: '4', name: 'custom-categories', description: 'Custom error categories and handling' },
    { key: '5', name: 'privacy-focused', description: 'Privacy-first error reporting' },
    { key: '6', name: 'gdpr-compliance', description: 'GDPR compliance features' },
    { key: '7', name: 'data-anonymization', description: 'Data anonymization capabilities' },
    { key: '8', name: 'analytics', description: 'Analytics and reporting features' },
    { key: '9', name: 'custom-metrics', description: 'Custom metrics and KPIs' },
    { key: '10', name: 'crash-handling', description: 'Advanced crash detection and recovery' },
    { key: '11', name: 'emergency-response', description: 'Emergency response procedures' },
    { key: 'all', name: 'run-all', description: 'Run all examples in sequence' }
  ];

  console.log('📋 Available Examples:');
  examples.forEach(example => {
    console.log(`  ${example.key}. ${example.name} - ${example.description}`);
  });
  
  console.log('\n💡 To run an example, use: npm run examples <example-name>');
  console.log('💡 To run all examples, use: npm run examples all');
  console.log('\nExample usage:');
  console.log('  npm run examples basic-usage');
  console.log('  npm run examples privacy-focused');
  console.log('  npm run examples all\n');
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    selectAndRunExample().catch(console.error);
  } else if (args[0] === 'all') {
    runAllExamples().catch(console.error);
  } else if (args[0]) {
    runExample(args[0]).catch(console.error);
  }
}

// Export all functions for programmatic use
export {
  runAllExamples,
  runExample,
  selectAndRunExample,
  
  // Re-export individual examples
  basicUsageExample,
  errorTypeExamples,
  advancedConfigurationExample,
  customErrorCategoriesExample,
  privacyFocusedExample,
  gdprComplianceExample,
  dataAnonymizationExample,
  analyticsIntegrationExample,
  customMetricsExample,
  customCrashHandlingExample,
  emergencyResponseExample
};