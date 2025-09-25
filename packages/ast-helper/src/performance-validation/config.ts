/**
 * @fileoverview Performance validation configuration with production-ready benchmarks
 */

import type {
  PerformanceConfig,
  PerformanceBenchmark,
  ScalabilityTest,
  PerformanceEnvironment,
} from "./types.js";
import * as os from "os";

export const DEFAULT_PERFORMANCE_BENCHMARKS: PerformanceBenchmark[] = [
  // CLI Performance Benchmarks
  {
    name: "cli-basic-parsing",
    description: "Time to parse a basic TypeScript project (10-20 files)",
    category: "cli",
    target: { value: 500, unit: "ms", constraint: "max" },
    tolerance: 20, // 20% tolerance
    critical: true,
  },
  {
    name: "cli-medium-project",
    description: "Time to parse a medium TypeScript project (100-200 files)",
    category: "cli",
    target: { value: 2000, unit: "ms", constraint: "max" },
    tolerance: 25,
    critical: true,
  },
  {
    name: "cli-large-project",
    description: "Time to parse a large TypeScript project (1000+ files)",
    category: "cli",
    target: { value: 15000, unit: "ms", constraint: "max" },
    tolerance: 30,
    critical: false,
  },
  {
    name: "cli-startup-time",
    description: "Time from CLI invocation to first output",
    category: "cli",
    target: { value: 200, unit: "ms", constraint: "max" },
    tolerance: 50,
    critical: true,
  },
  {
    name: "cli-memory-usage-basic",
    description: "Peak memory usage during basic project parsing",
    category: "memory",
    target: { value: 256, unit: "mb", constraint: "max" },
    tolerance: 25,
    critical: true,
  },
  {
    name: "cli-memory-usage-large",
    description: "Peak memory usage during large project parsing",
    category: "memory",
    target: { value: 1024, unit: "mb", constraint: "max" },
    tolerance: 30,
    critical: false,
  },

  // MCP Server Performance Benchmarks
  {
    name: "mcp-server-startup",
    description: "Time for MCP server to start and be ready for connections",
    category: "mcp-server",
    target: { value: 500, unit: "ms", constraint: "max" },
    tolerance: 20,
    critical: true,
  },
  {
    name: "mcp-query-response",
    description: "Average response time for AST queries",
    category: "mcp-server",
    target: { value: 200, unit: "ms", constraint: "max" },
    tolerance: 25,
    critical: true,
  },
  {
    name: "mcp-embedding-generation",
    description: "Time to generate embeddings for code segments",
    category: "mcp-server",
    target: { value: 1000, unit: "ms", constraint: "max" },
    tolerance: 30,
    critical: false,
  },
  {
    name: "mcp-vector-search",
    description: "Time to perform similarity search in vector database",
    category: "mcp-server",
    target: { value: 100, unit: "ms", constraint: "max" },
    tolerance: 50,
    critical: true,
  },
  {
    name: "mcp-concurrent-connections",
    description: "Number of concurrent connections supported",
    category: "mcp-server",
    target: { value: 10, unit: "connections", constraint: "min" },
    tolerance: 0,
    critical: true,
  },
  {
    name: "mcp-server-memory",
    description: "Peak memory usage during normal operation",
    category: "memory",
    target: { value: 512, unit: "mb", constraint: "max" },
    tolerance: 25,
    critical: true,
  },

  // VSCode Extension Performance Benchmarks
  {
    name: "vscode-activation-time",
    description: "Time for extension to activate",
    category: "vscode-extension",
    target: { value: 1000, unit: "ms", constraint: "max" },
    tolerance: 30,
    critical: true,
  },
  {
    name: "vscode-command-response",
    description: "Time for commands to execute and show results",
    category: "vscode-extension",
    target: { value: 2000, unit: "ms", constraint: "max" },
    tolerance: 25,
    critical: false,
  },
  {
    name: "vscode-ui-responsiveness",
    description: "UI responsiveness during heavy operations",
    category: "vscode-extension",
    target: { value: 100, unit: "ms", constraint: "max" },
    tolerance: 50,
    critical: true,
  },

  // Disk I/O Performance Benchmarks
  {
    name: "disk-read-speed",
    description: "Speed of reading source files from disk",
    category: "disk-io",
    target: { value: 100, unit: "files/s", constraint: "min" },
    tolerance: 20,
    critical: false,
  },
  {
    name: "disk-cache-write",
    description: "Speed of writing cache files",
    category: "disk-io",
    target: { value: 50, unit: "mb", constraint: "min" },
    tolerance: 30,
    critical: false,
  },

  // Network Performance Benchmarks (for distributed scenarios)
  {
    name: "network-latency",
    description: "Network latency for remote operations",
    category: "network",
    target: { value: 100, unit: "ms", constraint: "max" },
    tolerance: 50,
    critical: false,
  },
];

export const DEFAULT_SCALABILITY_TESTS: ScalabilityTest[] = [
  {
    name: "cli-file-count-scaling",
    description: "Test CLI performance as file count increases",
    workload: {
      type: "file-count",
      startValue: 10,
      endValue: 1000,
      stepSize: 50,
      unit: "files",
    },
    expectedBehavior: "linear",
    maxScale: 1000,
    metrics: ["parsing-time", "memory-usage"],
  },
  {
    name: "mcp-concurrent-requests",
    description: "Test MCP server performance under concurrent load",
    workload: {
      type: "concurrent-requests",
      startValue: 1,
      endValue: 50,
      stepSize: 5,
      unit: "requests",
    },
    expectedBehavior: "degraded-graceful",
    maxScale: 50,
    metrics: ["response-time", "error-rate", "memory-usage"],
  },
  {
    name: "vector-database-scaling",
    description: "Test vector database performance as data size increases",
    workload: {
      type: "file-size",
      startValue: 1,
      endValue: 100,
      stepSize: 10,
      unit: "mb",
    },
    expectedBehavior: "logarithmic",
    maxScale: 100,
    metrics: ["query-time", "index-time", "memory-usage"],
  },
  {
    name: "vscode-workspace-scaling",
    description: "Test VSCode extension performance with workspace size",
    workload: {
      type: "file-count",
      startValue: 100,
      endValue: 5000,
      stepSize: 500,
      unit: "files",
    },
    expectedBehavior: "linear",
    maxScale: 5000,
    metrics: ["activation-time", "command-response-time", "memory-usage"],
  },
];

function getSystemEnvironment(): PerformanceEnvironment {
  return {
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    memory: os.totalmem(),
    cpuCores: os.cpus().length,
    testLoad: "normal",
  };
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  benchmarks: DEFAULT_PERFORMANCE_BENCHMARKS,
  scalabilityTests: DEFAULT_SCALABILITY_TESTS,
  environments: {
    development: {
      testLoad: "light",
    },
    ci: {
      testLoad: "normal",
    },
    staging: {
      testLoad: "heavy",
    },
    production: {
      testLoad: "stress",
    },
    current: getSystemEnvironment(),
  },
  reporting: {
    outputDir: "test-output/performance",
    formats: ["json", "html"],
    includeCharts: true,
  },
  thresholds: {
    warningPercentage: 80, // warn if > 80% of target
    criticalPercentage: 100, // fail if > 100% of target
    minSuccessRate: 90, // require 90% of benchmarks to pass
  },
};

export const PRODUCTION_READY_PERFORMANCE_TARGETS = {
  // CLI Performance Targets (Production Ready)
  CLI_BASIC_PARSING_MAX_MS: 500,
  CLI_MEDIUM_PROJECT_MAX_MS: 2000,
  CLI_LARGE_PROJECT_MAX_MS: 15000,
  CLI_STARTUP_MAX_MS: 200,
  CLI_MEMORY_BASIC_MAX_MB: 256,
  CLI_MEMORY_LARGE_MAX_MB: 1024,

  // MCP Server Performance Targets (Production Ready)
  MCP_SERVER_STARTUP_MAX_MS: 500,
  MCP_QUERY_RESPONSE_MAX_MS: 200,
  MCP_EMBEDDING_GENERATION_MAX_MS: 1000,
  MCP_VECTOR_SEARCH_MAX_MS: 100,
  MCP_MIN_CONCURRENT_CONNECTIONS: 10,
  MCP_SERVER_MEMORY_MAX_MB: 512,

  // VSCode Extension Performance Targets (Production Ready)
  VSCODE_ACTIVATION_MAX_MS: 1000,
  VSCODE_COMMAND_RESPONSE_MAX_MS: 2000,
  VSCODE_UI_RESPONSIVENESS_MAX_MS: 100,

  // System Resource Targets
  DISK_READ_MIN_FILES_PER_SEC: 100,
  DISK_CACHE_WRITE_MIN_MB_PER_SEC: 50,
  NETWORK_LATENCY_MAX_MS: 100,

  // Scalability Targets
  CLI_MAX_SUPPORTED_FILES: 1000,
  MCP_MAX_CONCURRENT_REQUESTS: 50,
  VECTOR_DB_MAX_SIZE_MB: 100,
  VSCODE_MAX_WORKSPACE_FILES: 5000,
} as const;
