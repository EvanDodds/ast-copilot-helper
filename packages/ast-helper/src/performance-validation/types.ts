/**
 * @fileoverview Performance validation types and interfaces
 */

export interface PerformanceBenchmark {
  name: string;
  description: string;
  category: 'cli' | 'mcp-server' | 'vscode-extension' | 'memory' | 'disk-io' | 'network';
  target: PerformanceTarget;
  tolerance: number; // percentage allowed above target
  critical: boolean; // if true, failure blocks production deployment
}

export interface PerformanceTarget {
  value: number;
  unit: 'ms' | 'mb' | 'gb' | 'req/s' | 'files/s' | 'connections';
  constraint: 'max' | 'min' | 'avg';
}

export interface PerformanceMeasurement {
  benchmark: string;
  value: number;
  unit: string;
  timestamp: number;
  environment: PerformanceEnvironment;
  metadata?: Record<string, any>;
}

export interface PerformanceEnvironment {
  nodeVersion: string;
  platform: string;
  arch: string;
  memory: number; // bytes
  cpuCores: number;
  testLoad?: 'light' | 'normal' | 'heavy' | 'stress';
}

export interface PerformanceTestResult {
  benchmark: string;
  passed: boolean;
  measurement: PerformanceMeasurement;
  target: PerformanceTarget;
  deviation: number; // percentage from target
  details: string;
  suggestions?: string[];
}

export interface PerformanceValidationResult {
  overall: {
    passed: boolean;
    score: number; // 0-100
    criticalFailures: number;
    totalBenchmarks: number;
  };
  categories: {
    [category: string]: {
      passed: boolean;
      score: number;
      benchmarks: PerformanceTestResult[];
    };
  };
  recommendations: PerformanceRecommendation[];
  environment: PerformanceEnvironment;
  duration: number;
  timestamp: string;
}

export interface PerformanceRecommendation {
  type: 'optimization' | 'scaling' | 'configuration' | 'hardware';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  resources?: string[];
}

export interface ScalabilityTest {
  name: string;
  description: string;
  workload: ScalabilityWorkload;
  expectedBehavior: 'linear' | 'logarithmic' | 'constant' | 'degraded-graceful';
  maxScale: number;
  metrics: string[]; // which performance metrics to track
}

export interface ScalabilityWorkload {
  type: 'file-count' | 'file-size' | 'concurrent-requests' | 'connection-count';
  startValue: number;
  endValue: number;
  stepSize: number;
  unit: string;
}

export interface ScalabilityResult {
  test: string;
  workloadPoints: ScalabilityDataPoint[];
  behavior: 'linear' | 'logarithmic' | 'constant' | 'degraded-graceful' | 'failure';
  maxSupportedScale: number;
  recommendations: string[];
}

export interface ScalabilityDataPoint {
  workload: number;
  measurements: { [metric: string]: number };
  success: boolean;
  errors?: string[];
}

export interface MemoryProfileResult {
  peak: number; // bytes
  average: number; // bytes
  growth: number; // bytes per operation
  leakDetected: boolean;
  gcPressure: number; // 0-1 scale
  recommendations: string[];
}

export interface CpuProfileResult {
  averageUsage: number; // 0-100 percentage
  peakUsage: number; // 0-100 percentage
  hotspots: CpuHotspot[];
  recommendations: string[];
}

export interface CpuHotspot {
  function: string;
  file: string;
  line?: number;
  percentage: number;
  suggestions: string[];
}

export interface NetworkPerformanceResult {
  latency: number; // ms
  throughput: number; // bytes/second
  connectionTime: number; // ms
  errorRate: number; // 0-1
  recommendations: string[];
}

export interface DiskPerformanceResult {
  readSpeed: number; // bytes/second
  writeSpeed: number; // bytes/second
  iops: number; // operations per second
  recommendations: string[];
}

export interface PerformanceConfig {
  benchmarks: PerformanceBenchmark[];
  scalabilityTests: ScalabilityTest[];
  environments: {
    [name: string]: Partial<PerformanceEnvironment>;
  };
  reporting: {
    outputDir: string;
    formats: ('json' | 'html' | 'csv')[];
    includeCharts: boolean;
  };
  thresholds: {
    warningPercentage: number; // percentage above target to warn
    criticalPercentage: number; // percentage above target to fail
    minSuccessRate: number; // minimum percentage of benchmarks that must pass
  };
}