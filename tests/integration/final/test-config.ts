/**
 * @fileoverview Integration test configurations for final production readiness
 */

import type { TestSuiteConfig } from '../../../packages/ast-helper/src/production-readiness/types.js';

export const CLI_INTEGRATION_TESTS: TestSuiteConfig = {
  name: 'CLI Integration Tests',
  type: 'cli-integration',
  timeout: 300000, // 5 minutes
  parallel: false,
  retries: 2,
  tests: [
    'test-basic-parsing',
    'test-complex-codebases',
    'test-multi-language-support',
    'test-large-file-handling',
    'test-error-scenarios',
    'test-configuration-variations',
    'test-output-formats',
    'test-performance-benchmarks',
  ],
};

export const MCP_INTEGRATION_TESTS: TestSuiteConfig = {
  name: 'MCP Server Integration Tests',
  type: 'mcp-integration',
  timeout: 180000, // 3 minutes
  parallel: false,
  retries: 2,
  tests: [
    'test-server-startup',
    'test-protocol-compliance',
    'test-tool-registration',
    'test-query-processing',
    'test-embedding-generation',
    'test-vector-search',
    'test-concurrent-connections',
    'test-error-handling',
    'test-resource-cleanup',
  ],
};

export const VSCODE_INTEGRATION_TESTS: TestSuiteConfig = {
  name: 'VSCode Extension Integration Tests',
  type: 'vscode-integration',
  timeout: 240000, // 4 minutes
  parallel: false,
  retries: 2,
  tests: [
    'test-extension-activation',
    'test-command-registration',
    'test-mcp-server-communication',
    'test-ui-components',
    'test-settings-integration',
    'test-workspace-handling',
    'test-multi-workspace-support',
    'test-performance-ui',
  ],
};

export const CROSS_PLATFORM_TESTS: TestSuiteConfig = {
  name: 'Cross-Platform Compatibility Tests',
  type: 'cross-platform',
  timeout: 120000, // 2 minutes
  parallel: false,
  retries: 1,
  tests: [
    'test-windows-compatibility',
    'test-macos-compatibility', 
    'test-linux-compatibility',
    'test-node-version-compatibility',
    'test-path-handling',
    'test-file-system-permissions',
    'test-environment-variables',
  ],
};

export const E2E_WORKFLOW_TESTS: TestSuiteConfig = {
  name: 'End-to-End Workflow Tests',
  type: 'e2e-workflows',
  timeout: 600000, // 10 minutes
  parallel: false,
  retries: 1,
  tests: [
    'test-full-codebase-analysis-workflow',
    'test-incremental-update-workflow',
    'test-multi-project-workflow',
    'test-collaboration-workflow',
    'test-backup-recovery-workflow',
    'test-migration-workflow',
  ],
};

export const ALL_INTEGRATION_TEST_SUITES: TestSuiteConfig[] = [
  CLI_INTEGRATION_TESTS,
  MCP_INTEGRATION_TESTS,
  VSCODE_INTEGRATION_TESTS,
  CROSS_PLATFORM_TESTS,
  E2E_WORKFLOW_TESTS,
];

export const INTEGRATION_TEST_PERFORMANCE_TARGETS = {
  'CLI Integration Tests': {
    avgTestDuration: 5000, // 5 seconds per test
    maxTestDuration: 30000, // 30 seconds max per test
    totalSuiteDuration: 180000, // 3 minutes max total
    maxMemoryUsage: 512 * 1024 * 1024, // 512 MB
  },
  'MCP Server Integration Tests': {
    avgTestDuration: 3000, // 3 seconds per test
    maxTestDuration: 15000, // 15 seconds max per test
    totalSuiteDuration: 120000, // 2 minutes max total
    maxMemoryUsage: 256 * 1024 * 1024, // 256 MB
  },
  'VSCode Extension Integration Tests': {
    avgTestDuration: 8000, // 8 seconds per test (UI interactions)
    maxTestDuration: 45000, // 45 seconds max per test
    totalSuiteDuration: 240000, // 4 minutes max total
    maxMemoryUsage: 1024 * 1024 * 1024, // 1 GB (VSCode overhead)
  },
  'Cross-Platform Compatibility Tests': {
    avgTestDuration: 2000, // 2 seconds per test
    maxTestDuration: 10000, // 10 seconds max per test
    totalSuiteDuration: 60000, // 1 minute max total
    maxMemoryUsage: 128 * 1024 * 1024, // 128 MB
  },
  'End-to-End Workflow Tests': {
    avgTestDuration: 30000, // 30 seconds per test (complex workflows)
    maxTestDuration: 120000, // 2 minutes max per test
    totalSuiteDuration: 600000, // 10 minutes max total
    maxMemoryUsage: 1024 * 1024 * 1024, // 1 GB
  },
};

export const INTEGRATION_TEST_COVERAGE_TARGETS = {
  lines: 80, // 80% line coverage
  functions: 85, // 85% function coverage
  branches: 75, // 75% branch coverage
  statements: 80, // 80% statement coverage
};