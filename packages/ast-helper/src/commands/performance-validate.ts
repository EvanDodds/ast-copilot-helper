import { PerformanceBenchmarkRunner } from '../performance/benchmark-runner.js';
import { createLogger } from '../logging/index.js';
import type { Config } from '../types.js';

/**
 * Command handler interface
 */
interface CommandHandler<T = any> {
  execute(options: T, config: Config): Promise<void>;
}

/**
 * Performance validate command options
 */
export interface PerformanceValidateOptions {
  targets?: string;
  memoryLimit?: number;
  concurrencyLimit?: number;
  format?: string;
  config?: string;
  workspace?: string;
}

/**
 * Handler for performance validate command
 */
export class PerformanceValidateCommandHandler implements CommandHandler<PerformanceValidateOptions> {
  private logger = createLogger();

  async execute(options: PerformanceValidateOptions, _config: Config): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🔍 Starting performance validation...');
      
      // Initialize benchmark runner
      const runner = new PerformanceBenchmarkRunner();
      
      // Run validation
      const validation = await runner.validatePerformanceTargets();
      
      // Output results
      const duration = Date.now() - startTime;
      const format = options.format || 'table';
      
      if (format === 'json') {
        console.log(JSON.stringify(validation, null, 2));
      } else {
        // Table format
        console.log('\n🔍 Performance Validation Results');
        console.log('=================================\n');
        
        console.log(`Overall Status: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Tests: ${validation.summary.passedTests}/${validation.summary.totalTests} passed (${validation.summary.passRate.toFixed(1)}%)`);
        
        if (!validation.passed) {
          console.log('\nFailed Tests:');
          const failedTests = validation.results.filter(r => !r.passed);
          for (const test of failedTests) {
            console.log(`  ❌ ${test.criterion}: ${test.actual} (target: ${test.target})`);
            console.log(`     ${test.message}`);
          }
        }
      }
      
      this.logger.info(`✅ Validation completed in ${duration}ms`);
      
      // Exit with error code if validation failed
      if (!validation.passed) {
        process.exit(1);
      }
      
    } catch (error: any) {
      this.logger.error('Performance validation failed:', { error: error.message || error });
      throw error;
    }
  }
}