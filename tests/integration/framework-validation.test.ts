import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { IntegrationTestRunner } from './integration-test-runner';
import { TestEnvironmentManager } from './framework/test-environment-manager';
import { MockIntegrationTestSuite, TestConfiguration } from './framework/integration-test-suite';
import { TestReportGenerator } from './framework/test-report-generator';

describe('Integration Test Framework', () => {
  let runner: IntegrationTestRunner;
  let envManager: TestEnvironmentManager;
  let reportGenerator: TestReportGenerator;

  beforeAll(async () => {
    envManager = new TestEnvironmentManager();
    
    const config: TestConfiguration = {
      testWorkspaceSize: 'small',
      enablePerformanceTests: false,
      enableStressTests: false,
      parallelTestCount: 2,
      timeoutMs: 5000,
      retryCount: 1,
      generateReports: true,
      reportFormat: 'json',
    };
    
    runner = new IntegrationTestRunner(config);
    reportGenerator = new TestReportGenerator('./test-reports');
  });

  afterAll(async () => {
    await envManager.cleanupAll();
  });

  test('should create test environment', async () => {
    const env = await envManager.createEnvironment('test-basic', {
      useDatabase: true,
      enableDebug: false,
    });

    expect(env).toBeDefined();
    expect(env.tempDir).toBeTruthy();
    expect(env.configPath).toBeTruthy();
    expect(env.databasePath).toBeTruthy();
    expect(typeof env.cleanup).toBe('function');
  });

  test('should create and run mock test suite', async () => {
    const mockSuite = new MockIntegrationTestSuite();
    
    // Verify mock suite has required methods
    expect(typeof mockSuite.setupTestEnvironment).toBe('function');
    expect(typeof mockSuite.cleanupTestEnvironment).toBe('function');
    expect(typeof mockSuite.runTests).toBe('function');
    expect(typeof mockSuite.runEndToEndTests).toBe('function');

    // Run basic setup and teardown
    const env = await mockSuite.setupTestEnvironment();
    expect(env).toBeDefined();
    
    const results = await mockSuite.runTests();
    expect(results).toBeDefined();
    expect(results.tests).toBeDefined();
    expect(Array.isArray(results.tests)).toBe(true);
    
    await mockSuite.cleanupTestEnvironment();
  });

  test('should register and run test suite with runner', async () => {
    const mockSuite = new MockIntegrationTestSuite();
    
    // Register suite with runner
    runner.registerTestSuite('mock-suite', mockSuite);
    
    // Run tests
    const results = await runner.runAllTests();
    
    expect(results).toBeDefined();
    expect(results instanceof Map).toBe(true);
    expect(results.has('mock-suite')).toBe(true);
  });

  test('should generate test report', async () => {
    const mockResults = {
      tests: [
        { name: 'test1', success: true, duration: 100 },
        { name: 'test2', success: false, duration: 200, error: 'Test failed' },
      ],
      totalDuration: 300,
      coverage: { statements: 85, branches: 80, functions: 90, lines: 82 },
      performance: { parseTime: 50, indexTime: 25, queryTime: 15, memoryUsage: 1000000, diskUsage: 1024 },
    };
    
    const report = reportGenerator.generateReport(mockResults);
    
    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.performance).toBeDefined();
    expect(report.failures).toBeDefined();
    expect(report.recommendations).toBeDefined();
  });
});