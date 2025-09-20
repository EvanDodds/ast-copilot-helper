import * as path from 'path';
import * as fs from 'fs/promises';
import { PerformanceBenchmarkRunner } from '../performance/benchmark-runner.js';
import { PerformanceReport } from '../performance/types.js';
import { createLogger } from '../logging/index.js';
import type { Config } from '../types.js';

/**
 * Command handler interface
 */
interface CommandHandler<T = any> {
  execute(options: T, config: Config): Promise<void>;
}

/**
 * Performance benchmark command options
 */
export interface PerformanceBenchmarkOptions {
  type?: string;
  verbose?: boolean;
  outputDir?: string;
  targets?: string;
  format?: string;
  config?: string;
  workspace?: string;
}

/**
 * Handler for performance benchmark command
 */
export class PerformanceBenchmarkCommandHandler implements CommandHandler<PerformanceBenchmarkOptions> {
  private logger = createLogger();

  async execute(options: PerformanceBenchmarkOptions, _config: Config): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🚀 Starting performance benchmark suite...');
      
      // Initialize benchmark runner
      const runner = new PerformanceBenchmarkRunner();
      
      // Configure benchmark types
      const benchmarkTypes = this.getBenchmarkTypes(options.type || 'all');
      this.logger.info(`Running benchmark types: ${benchmarkTypes.join(', ')}`);
      
      // Run benchmarks
      let report: PerformanceReport;
      
      if (benchmarkTypes.includes('all')) {
        report = await runner.generatePerformanceReport();
      } else {
        // Run specific benchmark types
        report = await this.runSpecificBenchmarks(runner, benchmarkTypes);
      }
      
      // Output results
      await this.outputResults(report, options);
      
      // Performance validation
      const validationPassed = report.validation.passed;
      const duration = Date.now() - startTime;
      
      this.logger.info(`✅ Benchmark completed in ${duration}ms`);
      this.logger.info(`📊 Validation: ${validationPassed ? 'PASSED' : 'FAILED'} (${report.validation.summary.passedTests}/${report.validation.summary.totalTests})`);
      
      if (!validationPassed) {
        this.logger.warn('⚠️ Performance targets not met. See detailed results for recommendations.');
        
        // Show failed tests
        const failedTests = report.validation.results.filter(r => !r.passed);
        for (const test of failedTests.slice(0, 5)) { // Show first 5 failures
          this.logger.warn(`   ${test.criterion}: ${test.actual} vs target ${test.target} - ${test.message}`);
        }
        
        if (failedTests.length > 5) {
          this.logger.warn(`   ... and ${failedTests.length - 5} more failures`);
        }
      }
      
    } catch (error: any) {
      this.logger.error('Performance benchmark failed:', { error: error.message || error });
      throw error;
    }
  }
  
  /**
   * Get benchmark types from user input
   */
  private getBenchmarkTypes(type: string): string[] {
    if (type === 'all') {
      return ['parsing', 'querying', 'memory', 'concurrency', 'scalability'];
    }
    
    return type.split(',').map(t => t.trim());
  }
  
  /**
   * Run specific benchmark types
   */
  private async runSpecificBenchmarks(
    runner: PerformanceBenchmarkRunner,
    types: string[]
  ): Promise<PerformanceReport> {
    this.logger.info('🔧 Running specific benchmark types...');
    
    // Create a basic report structure
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: require('os').cpus().length,
      totalMemory: Math.round(require('os').totalmem() / 1024 / 1024),
      freeMemory: Math.round(require('os').freemem() / 1024 / 1024),
    };
    
    const benchmarkResults = {
      parsingBenchmarks: [],
      queryBenchmarks: [],
      embeddingBenchmarks: [],
      vectorSearchBenchmarks: [],
      systemBenchmarks: [],
    };
    
    let concurrencyResults;
    let memoryProfile;
    let scalabilityReport;
    
    // Run specific benchmarks
    if (types.includes('concurrency')) {
      this.logger.info('Running concurrency benchmarks...');
      concurrencyResults = await runner.testConcurrentOperations();
    }
    
    if (types.includes('memory')) {
      this.logger.info('Running memory profiling...');
      memoryProfile = await runner.profileMemoryUsage();
    }
    
    if (types.includes('scalability')) {
      this.logger.info('Running scalability tests...');
      scalabilityReport = await runner.measureScalabilityLimits();
    }
    
    // Create validation results
    const validation = {
      passed: true,
      results: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        passRate: 100,
      },
    };
    
    return {
      timestamp: new Date(),
      systemInfo,
      benchmarkResults,
      validation,
      memoryProfile: memoryProfile || {
        phases: [],
        peakUsage: 0,
        averageUsage: 0,
        memoryLeaks: [],
        gcPerformance: [],
      },
      concurrencyResults: concurrencyResults || {
        levels: [],
        maxSustainableConcurrency: 0,
        degradationPoint: 0,
      },
      scalabilityReport: scalabilityReport || {
        results: [],
        scalingFactors: {},
        recommendedLimits: {},
      },
      recommendations: [],
    };
  }
  
  /**
   * Output benchmark results in the requested format
   */
  private async outputResults(report: PerformanceReport, options: any): Promise<void> {
    const format = options.format || 'table';
    
    switch (format) {
      case 'json':
        await this.outputJsonResults(report, options);
        break;
      case 'table':
        this.outputTableResults(report);
        break;
      case 'html':
        await this.outputHtmlResults(report, options);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Output results as JSON
   */
  private async outputJsonResults(report: PerformanceReport, options: any): Promise<void> {
    const output = JSON.stringify(report, null, 2);
    
    if (options.outputDir) {
      const outputPath = path.join(options.outputDir, 'performance-results.json');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, output);
      this.logger.info(`📁 Results saved to: ${outputPath}`);
    } else {
      console.log(output);
    }
  }
  
  /**
   * Output results as formatted table
   */
  private outputTableResults(report: PerformanceReport): void {
    console.log('\n📊 Performance Benchmark Results');
    console.log('================================\n');
    
    // System Information
    console.log('🖥️  System Information:');
    console.log(`   Platform: ${report.systemInfo.platform} (${report.systemInfo.arch})`);
    console.log(`   Node.js: ${report.systemInfo.nodeVersion}`);
    console.log(`   CPUs: ${report.systemInfo.cpuCount}`);
    console.log(`   Memory: ${(report.systemInfo.totalMemory / 1024).toFixed(1)}GB total, ${(report.systemInfo.freeMemory / 1024).toFixed(1)}GB free\n`);
    
    // Memory Profile
    if (report.memoryProfile) {
      console.log('🧠 Memory Profile:');
      console.log(`   Peak Usage: ${report.memoryProfile.peakUsage.toFixed(1)} MB`);
      console.log(`   Average Usage: ${report.memoryProfile.averageUsage.toFixed(1)} MB`);
      console.log(`   Memory Leaks: ${report.memoryProfile.memoryLeaks.length} detected`);
      console.log(`   GC Events: ${report.memoryProfile.gcPerformance.length}\n`);
    }
    
    // Concurrency Results
    if (report.concurrencyResults) {
      console.log('🔄 Concurrency Performance:');
      console.log(`   Max Sustainable: ${report.concurrencyResults.maxSustainableConcurrency} concurrent operations`);
      console.log(`   Degradation Point: ${report.concurrencyResults.degradationPoint} operations`);
      console.log(`   Test Levels: ${report.concurrencyResults.levels.length}\n`);
    }
    
    // Validation Summary
    console.log('✅ Validation Results:');
    console.log(`   Overall: ${report.validation.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Tests: ${report.validation.summary.passedTests}/${report.validation.summary.totalTests} passed (${report.validation.summary.passRate.toFixed(1)}%)`);
    
    if (!report.validation.passed) {
      console.log('\n❌ Failed Tests:');
      const failedTests = report.validation.results.filter(r => !r.passed);
      for (const test of failedTests) {
        console.log(`   ${test.criterion}: ${test.actual} (target: ${test.target}) - ${test.message}`);
      }
    }
    
    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const recommendation of report.recommendations) {
        console.log(`   • ${recommendation}`);
      }
    }
  }
  
  /**
   * Output results as HTML report
   */
  private async outputHtmlResults(report: PerformanceReport, options: any): Promise<void> {
    const html = this.generateHtmlReport(report);
    const outputPath = options.outputDir 
      ? path.join(options.outputDir, 'performance-report.html')
      : './performance-report.html';
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, html);
    this.logger.info(`📁 HTML report saved to: ${outputPath}`);
  }
  
  /**
   * Generate HTML report content
   */
  private generateHtmlReport(report: PerformanceReport): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Benchmark Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px; padding: 10px; background: #e9ecef; border-radius: 5px; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Performance Benchmark Report</h1>
        <p>Generated: ${report.timestamp.toISOString()}</p>
        <p>Status: <span class="${report.validation.passed ? 'status-pass' : 'status-fail'}">${report.validation.passed ? 'PASSED' : 'FAILED'}</span></p>
    </div>
    
    <div class="section">
        <h2>🖥️ System Information</h2>
        <div class="metric">Platform: ${report.systemInfo.platform}</div>
        <div class="metric">Architecture: ${report.systemInfo.arch}</div>
        <div class="metric">Node.js: ${report.systemInfo.nodeVersion}</div>
        <div class="metric">CPUs: ${report.systemInfo.cpuCount}</div>
        <div class="metric">Memory: ${(report.systemInfo.totalMemory / 1024).toFixed(1)}GB</div>
    </div>
    
    <div class="section">
        <h2>🧠 Memory Profile</h2>
        <div class="metric">Peak: ${report.memoryProfile.peakUsage.toFixed(1)} MB</div>
        <div class="metric">Average: ${report.memoryProfile.averageUsage.toFixed(1)} MB</div>
        <div class="metric">Memory Leaks: ${report.memoryProfile.memoryLeaks.length}</div>
        <div class="metric">GC Events: ${report.memoryProfile.gcPerformance.length}</div>
    </div>
    
    <div class="section">
        <h2>🔄 Concurrency Performance</h2>
        <div class="metric">Max Sustainable: ${report.concurrencyResults.maxSustainableConcurrency}</div>
        <div class="metric">Degradation Point: ${report.concurrencyResults.degradationPoint}</div>
        <div class="metric">Test Levels: ${report.concurrencyResults.levels.length}</div>
    </div>
    
    <div class="section">
        <h2>✅ Validation Results</h2>
        <div class="metric">Passed: ${report.validation.summary.passedTests}</div>
        <div class="metric">Failed: ${report.validation.summary.failedTests}</div>
        <div class="metric">Success Rate: ${report.validation.summary.passRate.toFixed(1)}%</div>
    </div>
    
    ${report.recommendations.length > 0 ? `
    <div class="section">
        <h2>💡 Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>`;
  }
}