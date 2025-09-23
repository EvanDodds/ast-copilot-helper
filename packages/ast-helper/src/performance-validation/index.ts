/**
 * @fileoverview Performance validation module exports
 */

export type {
  PerformanceBenchmark,
  PerformanceTestResult,
  ScalabilityTest,
  ScalabilityResult,
  MemoryProfileResult,
  CpuProfileResult,
  NetworkPerformanceResult,
  PerformanceConfig,
  PerformanceValidationResult,
  PerformanceMeasurement,
  PerformanceEnvironment,
  PerformanceRecommendation,
  PerformanceTarget,
  ScalabilityWorkload,
  ScalabilityDataPoint,
  CpuHotspot,
  DiskPerformanceResult,
} from './types.js';

export { 
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_PERFORMANCE_BENCHMARKS,
  DEFAULT_SCALABILITY_TESTS,
  PRODUCTION_READY_PERFORMANCE_TARGETS,
} from './config.js';

export { PerformanceBenchmarkRunner } from './runner.js';

// Performance validation main entry point
export async function validatePerformance(config?: Partial<import('./types.js').PerformanceConfig>): Promise<import('./types.js').PerformanceValidationResult> {
  const { DEFAULT_PERFORMANCE_CONFIG } = await import('./config.js');
  const { PerformanceBenchmarkRunner } = await import('./runner.js');
  
  const runner = new PerformanceBenchmarkRunner({ 
    ...DEFAULT_PERFORMANCE_CONFIG, 
    ...config 
  });
  
  return runner.validatePerformance();
}

// Quick benchmark utilities
export async function quickBenchmark(benchmarkName: string): Promise<import('./types.js').PerformanceTestResult> {
  const { DEFAULT_PERFORMANCE_BENCHMARKS } = await import('./config.js');
  const { PerformanceBenchmarkRunner } = await import('./runner.js');
  
  const benchmark = DEFAULT_PERFORMANCE_BENCHMARKS.find(b => b.name === benchmarkName);
  if (!benchmark) {
    throw new Error(`Benchmark '${benchmarkName}' not found`);
  }
  
  const runner = new PerformanceBenchmarkRunner();
  return runner.runBenchmark(benchmark);
}

// Performance monitoring utilities
export async function startPerformanceMonitoring() {
  const { PerformanceBenchmarkRunner } = await import('./runner.js');
  return new PerformanceBenchmarkRunner();
}

export async function generatePerformanceReport(results: import('./types.js').PerformanceValidationResult, outputDir: string): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  const reportPath = path.join(outputDir, 'performance-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  // Generate HTML report if requested
  if (results.overall.score < 90) {
    const htmlReport = generateHTMLReport(results);
    const htmlPath = path.join(outputDir, 'performance-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    return htmlPath;
  }
  
  return reportPath;
}

function generateHTMLReport(results: import('./types.js').PerformanceValidationResult): string {
  const statusColor = results.overall.passed ? 'green' : 'red';
  const scoreColor = results.overall.score > 80 ? 'green' : results.overall.score > 60 ? 'orange' : 'red';
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>Performance Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .status { font-weight: bold; color: ${statusColor}; }
        .score { font-size: 24px; font-weight: bold; color: ${scoreColor}; }
        .category { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .benchmark { margin: 10px 0; padding: 10px; background: #f9f9f9; }
        .passed { color: green; }
        .failed { color: red; }
        .recommendation { background: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Validation Report</h1>
        <p class="status">Overall Status: ${results.overall.passed ? 'PASSED' : 'FAILED'}</p>
        <p class="score">Score: ${results.overall.score.toFixed(1)}%</p>
        <p>Generated: ${results.timestamp}</p>
        <p>Duration: ${results.duration}ms</p>
    </div>
    
    <h2>Categories</h2>
    ${Object.entries(results.categories).map(([category, data]) => `
    <div class="category">
        <h3>${category} - ${data.passed ? 'PASSED' : 'FAILED'} (${data.score.toFixed(1)}%)</h3>
        ${data.benchmarks.map(benchmark => `
        <div class="benchmark ${benchmark.passed ? 'passed' : 'failed'}">
            <strong>${benchmark.benchmark}</strong> - ${benchmark.passed ? 'PASSED' : 'FAILED'}
            <br>Target: ${benchmark.target.value}${benchmark.target.unit}
            <br>Measured: ${benchmark.measurement.value.toFixed(2)}${benchmark.measurement.unit}
            <br>Deviation: ${benchmark.deviation.toFixed(1)}%
            <br>${benchmark.details}
            ${benchmark.suggestions && benchmark.suggestions.length > 0 ? 
              `<div>Suggestions: ${benchmark.suggestions.join(', ')}</div>` : ''}
        </div>
        `).join('')}
    </div>
    `).join('')}
    
    <h2>Recommendations</h2>
    ${results.recommendations.map(rec => `
    <div class="recommendation">
        <strong>${rec.title}</strong> (${rec.severity})
        <br>${rec.description}
        <br><em>Impact:</em> ${rec.impact}
        <br><em>Effort:</em> ${rec.effort}
    </div>
    `).join('')}
    
    <h2>Environment</h2>
    <ul>
        <li>Node Version: ${results.environment.nodeVersion}</li>
        <li>Platform: ${results.environment.platform}</li>
        <li>Architecture: ${results.environment.arch}</li>
        <li>CPU Cores: ${results.environment.cpuCores}</li>
        <li>Memory: ${(results.environment.memory / (1024*1024*1024)).toFixed(2)} GB</li>
    </ul>
</body>
</html>`;
}