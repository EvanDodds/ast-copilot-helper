import { EventEmitter } from "events";
import { promises as fs } from "fs";
import { join } from "path";
import {
  BaseIntegrationTestSuite,
  TestEnvironment,
  TestConfiguration,
  WorkflowValidation as _WorkflowValidation,
} from "./framework/integration-test-suite";

/**
 * Main test runner for orchestrating integration tests
 */
export class IntegrationTestRunner extends EventEmitter {
  private testSuites: Map<string, BaseIntegrationTestSuite> = new Map();
  private results: Map<string, any> = new Map();

  constructor(private config: TestConfiguration) {
    super();
  }

  registerTestSuite(name: string, suite: BaseIntegrationTestSuite): void {
    this.testSuites.set(name, suite);

    // Forward events from test suites
    suite.on("environment-setup", (env: any) =>
      this.emit("suite-environment-setup", name, env),
    );
    suite.on("tests-completed", (results: any) =>
      this.emit("suite-completed", name, results),
    );
    suite.on("tests-failed", (error: any) =>
      this.emit("suite-failed", name, error),
    );
    suite.on("cleanup-completed", () =>
      this.emit("suite-cleanup-completed", name),
    );
  }

  async runAllTests(): Promise<Map<string, any>> {
    console.log(`Running ${this.testSuites.size} test suites...`);
    this.emit("run-started", this.testSuites.size);

    const startTime = Date.now();
    const results = new Map();

    try {
      if (this.config.parallelTestCount > 1) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }

      const totalDuration = Date.now() - startTime;
      this.emit("run-completed", results, totalDuration);

      return this.results;
    } catch (_error) {
      this.emit("run-failed", _error);
      throw _error;
    }
  }

  async runTestSuite(suiteName: string): Promise<any> {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    console.log(`Running test suite: ${suiteName}`);
    this.emit("suite-started", suiteName);

    try {
      await suite.setupTestEnvironment();
      const testResults = await suite.runEndToEndTests();
      const workflowValidations = await suite.validateWorkflows();
      const testReport = suite.generateTestReport();

      const suiteResults = {
        testResults,
        workflowValidations,
        testReport,
        success: testResults.tests.every((t: any) => t.success),
      };

      this.results.set(suiteName, suiteResults);
      await suite.cleanupTestEnvironment();

      console.log(`Test suite '${suiteName}' completed successfully`);
      return suiteResults;
    } catch (_error) {
      console.error(`Test suite '${suiteName}' failed:`, _error);
      await suite.cleanupTestEnvironment();
      throw _error;
    }
  }

  private async runTestsSequentially(): Promise<void> {
    for (const [suiteName] of this.testSuites) {
      await this.runTestSuite(suiteName);
    }
  }

  private async runTestsInParallel(): Promise<void> {
    const suiteNames = Array.from(this.testSuites.keys());
    const chunks = this.chunkArray(suiteNames, this.config.parallelTestCount);

    for (const chunk of chunks) {
      const promises = chunk.map((suiteName) => this.runTestSuite(suiteName));
      await Promise.all(promises);
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async generateCombinedReport(): Promise<any> {
    const combinedReport = {
      timestamp: new Date().toISOString(),
      configuration: this.config,
      suites: {} as any,
      summary: {
        totalSuites: this.testSuites.size,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalDuration: 0,
      },
      recommendations: [] as string[],
    };

    for (const [suiteName, results] of this.results) {
      combinedReport.suites[suiteName] = results;

      if (results.success) {
        combinedReport.summary.passedSuites++;
      } else {
        combinedReport.summary.failedSuites++;
      }

      combinedReport.summary.totalTests +=
        results.testReport.summary.totalTests;
      combinedReport.summary.passedTests += results.testReport.summary.passed;
      combinedReport.summary.failedTests += results.testReport.summary.failed;
      combinedReport.summary.totalDuration +=
        results.testReport.summary.duration;

      // Collect recommendations
      combinedReport.recommendations.push(
        ...results.testReport.recommendations,
      );
    }

    // Add global recommendations
    if (combinedReport.summary.failedSuites > 0) {
      combinedReport.recommendations.push(
        `${combinedReport.summary.failedSuites} test suites failed. Review individual suite reports.`,
      );
    }

    if (this.config.generateReports) {
      await this.saveReport(combinedReport);
    }

    return combinedReport;
  }

  private async saveReport(report: any): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `integration-test-report-${timestamp}`;

    switch (this.config.reportFormat) {
      case "json": {
        await fs.writeFile(
          join(process.cwd(), `${filename}.json`),
          JSON.stringify(report, null, 2),
        );
        break;
      }

      case "html": {
        const htmlContent = this.generateHtmlReport(report);
        await fs.writeFile(
          join(process.cwd(), `${filename}.html`),
          htmlContent,
        );
        break;
      }

      case "junit": {
        const junitContent = this.generateJunitReport(report);
        await fs.writeFile(
          join(process.cwd(), `${filename}.xml`),
          junitContent,
        );
        break;
      }
    }

    console.log(`Test report saved: ${filename}.${this.config.reportFormat}`);
  }

  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .suite { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .suite-header { background: #e7e7e7; padding: 10px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .pass { color: green; }
        .fail { color: red; }
        .recommendations { background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Integration Test Report</h1>
    <p>Generated: ${report.timestamp}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Suites: ${report.summary.totalSuites}</p>
        <p class="pass">Passed Suites: ${report.summary.passedSuites}</p>
        <p class="fail">Failed Suites: ${report.summary.failedSuites}</p>
        <p>Total Tests: ${report.summary.totalTests}</p>
        <p class="pass">Passed Tests: ${report.summary.passedTests}</p>
        <p class="fail">Failed Tests: ${report.summary.failedTests}</p>
        <p>Total Duration: ${report.summary.totalDuration}ms</p>
    </div>

    ${
      report.recommendations.length > 0
        ? `
    <div class="recommendations">
        <h3>Recommendations</h3>
        <ul>
            ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join("")}
        </ul>
    </div>
    `
        : ""
    }

    <h2>Test Suites</h2>
    ${Object.entries(report.suites)
      .map(
        ([name, results]: [string, any]) => `
    <div class="suite">
        <div class="suite-header ${results.success ? "pass" : "fail"}">
            ${name} - ${results.success ? "PASSED" : "FAILED"}
        </div>
        <div class="suite-content">
            <p>Tests: ${results.testReport.summary.totalTests}</p>
            <p>Duration: ${results.testReport.summary.duration}ms</p>
            ${
              results.testReport.failures.length > 0
                ? `
            <h4>Failures:</h4>
            <ul>
                ${results.testReport.failures.map((failure: any) => `<li>${failure.testName}: ${failure.error}</li>`).join("")}
            </ul>
            `
                : ""
            }
        </div>
    </div>
    `,
      )
      .join("")}
</body>
</html>
    `;
  }

  private generateJunitReport(report: any): string {
    const testsuites = Object.entries(report.suites)
      .map(([name, results]: [string, any]) => {
        const testcases = results.testResults.tests
          .map((test: any) => {
            if (test.success) {
              return `<testcase name="${test.name}" time="${test.duration / 1000}" />`;
            } else {
              return `
            <testcase name="${test.name}" time="${test.duration / 1000}">
              <failure message="${test.error || "Test failed"}">${test.stackTrace || ""}</failure>
            </testcase>
          `;
            }
          })
          .join("\n");

        return `
        <testsuite name="${name}" 
                   tests="${results.testReport.summary.totalTests}"
                   failures="${results.testReport.summary.failed}"
                   time="${results.testReport.summary.duration / 1000}">
          ${testcases}
        </testsuite>
      `;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${report.summary.totalTests}" 
            failures="${report.summary.failedTests}"
            time="${report.summary.totalDuration / 1000}">
  ${testsuites}
</testsuites>`;
  }
}

/**
 * Utility class for test data generation and management
 */
export class TestDataGenerator {
  static async generateSampleWorkspace(
    size: "small" | "medium" | "large",
    basePath: string,
  ): Promise<void> {
    const fileCounts = {
      small: 10,
      medium: 50,
      large: 200,
    };

    const fileCount = fileCounts[size];
    console.log(`Generating ${size} workspace with ${fileCount} files...`);

    // Create directory structure
    await fs.mkdir(join(basePath, "src"), { recursive: true });
    await fs.mkdir(join(basePath, "tests"), { recursive: true });
    await fs.mkdir(join(basePath, "lib"), { recursive: true });

    // Generate TypeScript files
    for (let i = 0; i < Math.floor(fileCount * 0.6); i++) {
      const content = this.generateTypeScriptFile(i);
      await fs.writeFile(join(basePath, "src", `module-${i}.ts`), content);
    }

    // Generate JavaScript files
    for (let i = 0; i < Math.floor(fileCount * 0.3); i++) {
      const content = this.generateJavaScriptFile(i);
      await fs.writeFile(join(basePath, "lib", `utility-${i}.js`), content);
    }

    // Generate test files
    for (let i = 0; i < Math.floor(fileCount * 0.1); i++) {
      const content = this.generateTestFile(i);
      await fs.writeFile(join(basePath, "tests", `test-${i}.test.ts`), content);
    }

    // Generate package.json
    const packageJson = {
      name: `test-workspace-${size}`,
      version: "1.0.0",
      dependencies: {
        typescript: "^4.9.0",
        "@types/node": "^18.0.0",
      },
    };
    await fs.writeFile(
      join(basePath, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );

    console.log(`Generated ${size} workspace at ${basePath}`);
  }

  private static generateTypeScriptFile(index: number): string {
    return `
export interface Data${index} {
  id: number;
  name: string;
  value: any;
}

export class DataProcessor${index} {
  private data: Data${index}[] = [];

  constructor(private config: { batchSize: number }) {}

  async processData(input: Data${index}[]): Promise<Data${index}[]> {
    console.log('Processing data batch...');
    
    for (const item of input) {
      const processed = await this.processItem(item);
      this.data.push(processed);
    }

    return this.data;
  }

  private async processItem(item: Data${index}): Promise<Data${index}> {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 1));
    
    return {
      ...item,
      value: item.value * 2,
      name: \`processed-\${item.name}\`,
    };
  }

  getResults(): Data${index}[] {
    return [...this.data];
  }

  clear(): void {
    this.data = [];
  }
}

export function createProcessor${index}(batchSize = 10): DataProcessor${index} {
  return new DataProcessor${index}({ batchSize });
}

export const CONSTANTS_${index} = {
  MAX_ITEMS: 1000,
  DEFAULT_TIMEOUT: 5000,
  RETRY_COUNT: 3,
} as const;
    `;
  }

  private static generateJavaScriptFile(index: number): string {
    return `
const utils${index} = {
  formatNumber: (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  },

  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  deepClone: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => utils${index}.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        clonedObj[key] = utils${index}.deepClone(obj[key]);
      }
      return clonedObj;
    }
  },

  validateEmail: (email) => {
    const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return re.test(email);
  },

  generateId: () => {
    return Math.random().toString(36).substr(2, 9);
  },

  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

module.exports = utils${index};
    `;
  }

  private static generateTestFile(index: number): string {
    return `
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DataProcessor${index}, createProcessor${index}, CONSTANTS_${index} } from '../src/module-${index}';

describe('DataProcessor${index}', () => {
  let processor: DataProcessor${index};

  beforeEach(() => {
    processor = createProcessor${index}();
  });

  afterEach(() => {
    processor.clear();
  });

  it('should process data correctly', async () => {
    const inputData = [
      { id: 1, name: 'test1', value: 10 },
      { id: 2, name: 'test2', value: 20 },
    ];

    const result = await processor.processData(inputData);

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(20);
    expect(result[0].name).toBe('processed-test1');
    expect(result[1].value).toBe(40);
    expect(result[1].name).toBe('processed-test2');
  });

  it('should handle empty input', async () => {
    const result = await processor.processData([]);
    expect(result).toHaveLength(0);
  });

  it('should use correct constants', () => {
    expect(CONSTANTS_${index}.MAX_ITEMS).toBe(1000);
    expect(CONSTANTS_${index}.DEFAULT_TIMEOUT).toBe(5000);
    expect(CONSTANTS_${index}.RETRY_COUNT).toBe(3);
  });

  it('should clear data correctly', async () => {
    const inputData = [{ id: 1, name: 'test', value: 10 }];
    await processor.processData(inputData);
    
    expect(processor.getResults()).toHaveLength(1);
    
    processor.clear();
    expect(processor.getResults()).toHaveLength(0);
  });
});
    `;
  }
}

/**
 * Environment manager for test isolation
 */
export class TestEnvironmentManager {
  private environments: Map<string, TestEnvironment> = new Map();

  async createIsolatedEnvironment(
    name: string,
    config: TestConfiguration,
  ): Promise<TestEnvironment> {
    if (this.environments.has(name)) {
      throw new Error(`Environment '${name}' already exists`);
    }

    const suite = new BaseIntegrationTestSuite(config);
    const environment = await suite.setupTestEnvironment();
    this.environments.set(name, environment);

    return environment;
  }

  getEnvironment(name: string): TestEnvironment | undefined {
    return this.environments.get(name);
  }

  async cleanupEnvironment(name: string): Promise<void> {
    const environment = this.environments.get(name);
    if (!environment) {
      return;
    }

    // Cleanup logic here
    await fs.rm(environment.tempDirectory, { recursive: true, force: true });
    this.environments.delete(name);
  }

  async cleanupAllEnvironments(): Promise<void> {
    const cleanupPromises = Array.from(this.environments.keys()).map((name) =>
      this.cleanupEnvironment(name),
    );
    await Promise.all(cleanupPromises);
  }

  listEnvironments(): string[] {
    return Array.from(this.environments.keys());
  }
}
