/**
 * Performance Testing Framework for AST Copilot Helper
 *
 * Provides comprehensive performance validation, benchmarking, and optimization
 * validation to ensure the system meets specified performance targets.
 */

export interface PerformanceTester {
  runBenchmarkSuite(): Promise<BenchmarkResults>;
  validatePerformanceTargets(): Promise<PerformanceValidation>;
  profileMemoryUsage(): Promise<MemoryProfile>;
  testConcurrentOperations(): Promise<ConcurrencyResults>;
  measureScalabilityLimits(): Promise<ScalabilityReport>;
  generatePerformanceReport(): Promise<PerformanceReport>;
}

export interface BenchmarkResults {
  parsingBenchmarks: ParsingBenchmark[];
  queryBenchmarks: QueryBenchmark[];
  embeddingBenchmarks: EmbeddingBenchmark[];
  vectorSearchBenchmarks: VectorSearchBenchmark[];
  systemBenchmarks: SystemBenchmark[];
}

export interface ParsingBenchmark {
  testName: string;
  fileCount: number;
  totalNodes: number;
  significantNodes: number;
  parseTime: number; // Total parsing time in ms
  nodesPerSecond: number; // Processing rate
  memoryUsage: number; // Peak memory usage in MB
  cpuUsage: number; // Average CPU usage percentage
  language: string; // Programming language tested
}

export interface QueryBenchmark {
  testName: string;
  queryType: "semantic" | "signature" | "file";
  query: string;
  resultCount: number;
  responseTime: number; // Query response time in ms
  vectorSearchTime: number; // Vector search portion
  rankingTime: number; // Result ranking portion
  databaseTime: number; // Database query portion
  memoryAllocated: number; // Memory allocated during query
}

export interface EmbeddingBenchmark {
  testName: string;
  nodeCount: number;
  embeddingTime: number; // Time to generate embeddings in ms
  embeddingsPerSecond: number; // Processing rate
  memoryUsage: number; // Memory usage in MB
  modelSize: string; // Embedding model used
}

export interface VectorSearchBenchmark {
  testName: string;
  vectorCount: number;
  queryVectorDimensions: number;
  searchTime: number; // Vector search time in ms
  accuracy: number; // Search accuracy percentage
  memoryUsage: number; // Memory usage in MB
}

export interface SystemBenchmark {
  testName: string;
  operation: string;
  duration: number; // Operation duration in ms
  memoryUsage: number; // Memory usage in MB
  cpuUsage: number; // CPU usage percentage
  diskIO: number; // Disk I/O in MB/s
}

export interface PerformanceTargets {
  maxParseTimeFor100k: number; // 100k nodes in X milliseconds
  maxMCPQueryTime: number; // <200ms for MCP queries
  maxCLIQueryTime: number; // <500ms for CLI queries
  maxMemoryUsage: number; // Peak memory limit in MB
  minThroughput: number; // Nodes processed per second
  maxConcurrentQueries: number; // Concurrent query limit
}

export interface PerformanceValidation {
  passed: boolean;
  results: PerformanceValidationResult[];
  summary: ValidationSummary;
}

export interface PerformanceValidationResult {
  criterion: string;
  target: number;
  actual: number;
  passed: boolean;
  message: string;
}

export interface ValidationSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
}

export interface ConcurrencyResults {
  levels: ConcurrencyLevel[];
  maxSustainableConcurrency: number;
  degradationPoint: number;
}

export interface ConcurrencyLevel {
  concurrencyLevel: number;
  totalTime: number;
  avgResponseTime: number;
  maxResponseTime: number;
  successCount: number;
  failureCount: number;
  throughput: number;
}

/**
 * Node count specifications for benchmarks
 */
export type NodeCount = "small" | "medium" | "large" | "xlarge" | number;

/**
 * Query type specifications for benchmarks
 */
export type QueryType = "file" | "ast" | "semantic";

/**
 * Individual benchmark run result
 */
export interface BenchmarkRun {
  subtype: string;
  success: boolean;
  duration: number;
  nodeCount: number;
  throughput: number;
  memoryUsed: number;
  cpuUsage: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Parsing benchmark configuration
 */
export interface ParsingBenchmarkConfig {
  nodeCount: NodeCount;
  language: string;
  iterations: number;
  timeout?: number;
}

/**
 * Query benchmark configuration
 */
export interface QueryBenchmarkConfig {
  queryTypes: QueryType[];
  nodeCounts: NodeCount[];
  cacheEnabled: boolean;
  concurrentRequests: number;
  mcpTimeout: number; // MCP response timeout in ms (target: <200ms)
  cliTimeout: number; // CLI response timeout in ms (target: <500ms)
  iterations: number;
}

/**
 * Single benchmark result
 */
export interface BenchmarkResult {
  benchmarkType: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  averageThroughput: number;
  averageMemoryUsed: number;
  averageCpuUsage: number;
  peakMemoryUsed: number;
  totalNodesProcessed: number;
  errors: string[];
  warnings: string[];
  meetsPerformanceTargets: boolean;
  performanceScore: number;
  recommendations: string[];
}

export interface ScalabilityReport {
  results: ScalabilityResult[];
  scalingFactors: Record<string, number>;
  recommendedLimits: Record<string, number>;
}

export interface ScalabilityResult {
  annotationCount: number;
  indexingTime: number;
  avgQueryTime: number;
  maxQueryTime: number;
  memoryUsage: number;
  indexSize: number;
}

export interface MemoryProfile {
  phases: PhaseMemoryProfile[];
  peakUsage: number;
  averageUsage: number;
  memoryLeaks: MemoryLeak[];
  gcPerformance: GCMetrics[];
}

export interface PhaseMemoryProfile {
  phase: string;
  startMemory: number;
  peakMemory: number;
  endMemory: number;
  avgMemory: number;
  duration: number;
}

export interface MemoryLeak {
  location: string;
  severity: "low" | "medium" | "high";
  leakRate: number; // MB/s
  description: string;
}

export interface GCMetrics {
  timestamp: number;
  gcType: string;
  duration: number;
  memoryFreed: number;
}

export interface PerformanceReport {
  timestamp: Date;
  systemInfo: SystemInfo;
  benchmarkResults: BenchmarkResults;
  validation: PerformanceValidation;
  memoryProfile: MemoryProfile;
  concurrencyResults: ConcurrencyResults;
  scalabilityReport: ScalabilityReport;
  recommendations: string[];
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
}

// Concurrency Testing Types

export interface ConcurrencyBenchmarkConfig {
  maxWorkers: number;
  workerCounts: number[];
  totalTasks: number;
  workloadTypes: string[];
  taskTimeout?: number;
  minThroughput?: number;
}

export interface ConcurrencyBenchmarkResult {
  benchmarkType: "concurrency";
  totalWorkers: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageDuration: number;
  peakConcurrency: number;
  averageThroughput: number;
  peakMemoryUsage: number;
  averageCpuUsage: number;
  resourceContentions: number;
  deadlocksDetected: number;
  threadSafetyViolations: number;
  scalabilityMetrics: ScalabilityMetrics;
  meetsPerformanceTargets: boolean;
  performanceScore: number;
  warnings: string[];
  recommendations: string[];
  errors: string[];
}

export interface ConcurrencyMetrics {
  successfulTasks: number;
  failedTasks: number;
  averageDuration: number;
  peakConcurrency: number;
  averageThroughput: number;
  peakMemoryUsage: number;
  resourceContentions: number;
  deadlocksDetected: number;
  threadSafetyViolations: number;
}

export interface WorkerTask {
  id: string;
  type: string;
  data: any;
  priority: number;
  timeout: number;
  resourceRequirements: ResourceRequirements;
}

export interface ResourceRequirements {
  memory: number; // MB
  cpu: number; // Percentage
  sharedResources: string[];
}

export interface ScalabilityMetrics {
  optimalWorkerCount: number;
  throughputScaling: ScalingPoint[];
  memoryScaling: ScalingPoint[];
  latencyScaling: ScalingPoint[];
}

export interface ScalingPoint {
  workerCount: number;
  throughput?: number;
  memoryUsage?: number;
  latency?: number;
}

export interface ResourceContentionResult {
  resource: string;
  contentionCount: number;
  averageWaitTime: number;
  maxWaitTime: number;
  affectedWorkers: string[];
}

export interface DeadlockDetectionResult {
  detected: boolean;
  involvedWorkers: string[];
  involvedResources: string[];
  detectionTime: number;
  resolutionStrategy: string;
}
