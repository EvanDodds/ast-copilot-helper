/**
 * @fileoverview End-to-end testing framework types
 */

// Base E2E Testing Types
export interface E2ETestingConfig {
  enabled: boolean;
  scenarios: E2EScenarioConfig[];
  resources: ResourceConfig;
  simulation: SimulationConfig;
  monitoring: MonitoringConfig;
  reporting: E2EReportConfig;
}

export interface E2EScenarioConfig {
  name: string;
  description: string;
  enabled: boolean;
  category: E2ECategory;
  timeout: number; // milliseconds
  retries: number;
  prerequisites: string[];
  cleanup: boolean;
  parallel: boolean;
  environment: EnvironmentRequirement[];
}

export interface ResourceConfig {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskSpaceMB: number;
  maxNetworkBandwidthMB: number;
  maxConcurrentUsers: number;
  testDataSizeMB: number;
}

export interface SimulationConfig {
  realWorldCodebases: CodebaseConfig[];
  userProfiles: UserProfile[];
  networkConditions: NetworkCondition[];
  systemLoad: SystemLoadConfig;
  failureScenarios: FailureScenario[];
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsCollection: boolean;
  performanceTracking: boolean;
  resourceMonitoring: boolean;
  errorTracking: boolean;
  healthChecks: boolean;
  alerting: AlertConfig;
}

export interface E2EReportConfig {
  enabled: boolean;
  format: ReportFormat[];
  outputPath: string;
  includeScreenshots: boolean;
  includeVideos: boolean;
  includeLogs: boolean;
  detailLevel: DetailLevel;
}

export type E2ECategory =
  | "codebase-analysis"
  | "collaboration"
  | "incremental-updates"
  | "error-recovery"
  | "resource-management"
  | "cross-component"
  | "production-simulation";

export type EnvironmentRequirement =
  | "cli"
  | "mcp-server"
  | "vscode-extension"
  | "database"
  | "network";
export type ReportFormat = "html" | "json" | "junit" | "markdown";
export type DetailLevel = "minimal" | "standard" | "detailed" | "verbose";

export interface CodebaseConfig {
  name: string;
  type: CodebaseType;
  size: CodebaseSize;
  languages: string[];
  files: number;
  complexity: ComplexityLevel;
  testDataPath?: string;
  generatedData: boolean;
}

export interface UserProfile {
  name: string;
  type: UserType;
  concurrency: number;
  actions: UserAction[];
  thinkTime: number; // milliseconds between actions
  sessionDuration: number; // minutes
}

export interface NetworkCondition {
  name: string;
  bandwidth: number; // Mbps
  latency: number; // milliseconds
  packetLoss: number; // percentage
  jitter: number; // milliseconds
}

export interface SystemLoadConfig {
  cpuLoad: number; // percentage
  memoryUsage: number; // percentage
  diskIo: number; // MB/s
  networkIo: number; // MB/s
  backgroundProcesses: number;
}

export interface FailureScenario {
  name: string;
  type: FailureType;
  probability: number; // 0-1
  duration: number; // milliseconds
  recovery: RecoveryStrategy;
  impact: ImpactLevel;
}

export interface AlertConfig {
  enabled: boolean;
  thresholds: AlertThreshold[];
  channels: AlertChannel[];
  escalation: EscalationPolicy;
}

export type CodebaseType =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "mixed";
export type CodebaseSize = "small" | "medium" | "large" | "enterprise";
export type ComplexityLevel =
  | "simple"
  | "moderate"
  | "complex"
  | "highly-complex";
export type UserType =
  | "developer"
  | "architect"
  | "analyst"
  | "manager"
  | "automated";
export type UserAction =
  | "query"
  | "analyze"
  | "navigate"
  | "modify"
  | "collaborate";
export type FailureType =
  | "network"
  | "service"
  | "resource"
  | "data"
  | "timeout";
export type RecoveryStrategy =
  | "retry"
  | "fallback"
  | "graceful-degradation"
  | "manual";
export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type AlertChannel = "log" | "email" | "webhook" | "console";

export interface AlertThreshold {
  metric: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  value: number;
  duration: number; // milliseconds
  severity: AlertSeverity;
}

export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
  timeout: number; // minutes
}

export interface EscalationLevel {
  level: number;
  delay: number; // minutes
  channels: AlertChannel[];
  contacts: string[];
}

export type AlertSeverity = "info" | "warning" | "error" | "critical";

// E2E Test Results
export interface E2ETestResult {
  testSuiteId: string;
  passed: boolean;
  score: number; // 0-100
  timestamp: string;
  duration: number; // milliseconds
  environment: E2EEnvironment;
  scenarios: E2EScenarioResult[];
  summary: E2ESummary;
  performance: E2EPerformanceMetrics;
  resources: E2EResourceMetrics;
  recommendations: E2ERecommendation[];
}

export interface E2EEnvironment {
  platform: string;
  nodeVersion: string;
  components: ComponentStatus[];
  resources: ResourceStatus;
  network: NetworkStatus;
  system: SystemStatus;
}

export interface ComponentStatus {
  component: EnvironmentRequirement;
  status: ComponentState;
  version: string;
  healthy: boolean;
  lastCheck: string;
  metrics?: ComponentMetrics;
}

export interface ResourceStatus {
  memory: ResourceMetric;
  cpu: ResourceMetric;
  disk: ResourceMetric;
  network: ResourceMetric;
}

export interface NetworkStatus {
  connectivity: boolean;
  latency: number;
  bandwidth: number;
  packetLoss: number;
}

export interface SystemStatus {
  uptime: number;
  load: number[];
  processes: number;
  fileDescriptors: number;
  threads: number;
}

export interface E2EScenarioResult {
  scenario: string;
  category: E2ECategory;
  passed: boolean;
  score: number;
  duration: number;
  steps: E2EStepResult[];
  errors: E2EError[];
  performance: ScenarioPerformanceMetrics;
  resources: ScenarioResourceMetrics;
}

export interface E2EStepResult {
  step: string;
  passed: boolean;
  duration: number;
  startTime: string;
  endTime: string;
  details?: StepDetails;
  error?: string;
}

export interface E2EError {
  type: E2EErrorType;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  timestamp: string;
  step?: string;
  recoverable: boolean;
  recovered: boolean;
}

export interface E2ESummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  totalSteps: number;
  passedSteps: number;
  averageDuration: number;
  resourceEfficiency: number; // 0-100
  reliabilityScore: number; // 0-100
}

export interface E2EPerformanceMetrics {
  averageResponseTime: number;
  peakResponseTime: number;
  throughput: number; // operations per second
  errorRate: number; // percentage
  availability: number; // percentage
  scalabilityScore: number; // 0-100
}

export interface E2EResourceMetrics {
  peakMemoryMB: number;
  averageMemoryMB: number;
  peakCpuPercent: number;
  averageCpuPercent: number;
  diskUsageMB: number;
  networkUsageMB: number;
  resourceLeaks: ResourceLeak[];
}

export interface E2ERecommendation {
  category: E2ECategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  action: string;
  impact: ImpactAssessment;
  effort: EffortAssessment;
}

export type ComponentState = "running" | "stopped" | "error" | "unknown";
export type E2EErrorType =
  | "assertion"
  | "timeout"
  | "network"
  | "resource"
  | "system"
  | "data";
export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type RecommendationPriority = "low" | "medium" | "high" | "urgent";

export interface ComponentMetrics {
  responseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
}

export interface ResourceMetric {
  current: number;
  peak: number;
  average: number;
  limit: number;
  utilization: number; // percentage
}

export interface StepDetails {
  action: string;
  input?: unknown;
  output?: unknown;
  metrics?: StepMetrics;
}

export interface StepMetrics {
  responseTime: number;
  resourceUsage: ResourceSnapshot;
  networkCalls: number;
  cacheHits: number;
}

export interface ResourceSnapshot {
  memoryMB: number;
  cpuPercent: number;
  diskIoMB: number;
  networkIoMB: number;
  timestamp: string;
}

export interface ScenarioPerformanceMetrics {
  averageStepDuration: number;
  peakStepDuration: number;
  totalDataProcessed: number;
  operationsPerSecond: number;
  errorRate: number;
}

export interface ScenarioResourceMetrics {
  memoryProfile: ResourceSnapshot[];
  cpuProfile: ResourceSnapshot[];
  peakUsage: ResourceSnapshot;
  averageUsage: ResourceSnapshot;
  leakDetected: boolean;
}

export interface ResourceLeak {
  type: ResourceLeakType;
  severity: ErrorSeverity;
  location: string;
  description: string;
  recommendation: string;
  trend: LeakTrend;
}

export interface ImpactAssessment {
  performance: ImpactLevel;
  reliability: ImpactLevel;
  scalability: ImpactLevel;
  maintainability: ImpactLevel;
  security: ImpactLevel;
}

export interface EffortAssessment {
  development: EffortLevel;
  testing: EffortLevel;
  deployment: EffortLevel;
  maintenance: EffortLevel;
  risk: RiskLevel;
}

export type ResourceLeakType =
  | "memory"
  | "file-handles"
  | "connections"
  | "threads"
  | "cache";
export type LeakTrend = "increasing" | "stable" | "decreasing" | "periodic";
export type EffortLevel =
  | "trivial"
  | "minor"
  | "moderate"
  | "major"
  | "extreme";
export type RiskLevel = "very-low" | "low" | "medium" | "high" | "very-high";

// E2E Testing Events
export interface E2ETestingEvents {
  "suite:start": { suiteId: string; scenarios: number };
  "scenario:start": { scenario: string; category: E2ECategory };
  "scenario:complete": { scenario: string; result: E2EScenarioResult };
  "step:start": { scenario: string; step: string };
  "step:complete": { scenario: string; step: string; result: E2EStepResult };
  "error:occurred": { error: E2EError; scenario?: string; step?: string };
  "resource:alert": { metric: string; value: number; threshold: number };
  "suite:complete": { result: E2ETestResult };
}

// Default Configuration
export const DEFAULT_E2E_CONFIG: E2ETestingConfig = {
  enabled: true,
  scenarios: [
    {
      name: "basic-codebase-analysis",
      description: "Analyze a medium-sized TypeScript codebase",
      enabled: true,
      category: "codebase-analysis",
      timeout: 300000, // 5 minutes
      retries: 2,
      prerequisites: ["cli", "mcp-server"],
      cleanup: true,
      parallel: false,
      environment: ["cli", "mcp-server"],
    },
    {
      name: "multi-user-collaboration",
      description: "Simulate multiple developers working simultaneously",
      enabled: true,
      category: "collaboration",
      timeout: 600000, // 10 minutes
      retries: 1,
      prerequisites: ["mcp-server", "vscode-extension"],
      cleanup: true,
      parallel: true,
      environment: ["mcp-server", "vscode-extension"],
    },
    {
      name: "incremental-file-updates",
      description: "Test file watching and incremental processing",
      enabled: true,
      category: "incremental-updates",
      timeout: 180000, // 3 minutes
      retries: 3,
      prerequisites: ["cli", "mcp-server"],
      cleanup: true,
      parallel: false,
      environment: ["cli", "mcp-server"],
    },
  ],
  resources: {
    maxMemoryMB: 1024,
    maxCpuPercent: 80,
    maxDiskSpaceMB: 2048,
    maxNetworkBandwidthMB: 100,
    maxConcurrentUsers: 10,
    testDataSizeMB: 500,
  },
  simulation: {
    realWorldCodebases: [
      {
        name: "medium-typescript-project",
        type: "typescript",
        size: "medium",
        languages: ["typescript", "javascript"],
        files: 500,
        complexity: "moderate",
        generatedData: true,
      },
    ],
    userProfiles: [
      {
        name: "active-developer",
        type: "developer",
        concurrency: 1,
        actions: ["query", "analyze", "navigate"],
        thinkTime: 2000,
        sessionDuration: 30,
      },
    ],
    networkConditions: [
      {
        name: "good-connection",
        bandwidth: 100,
        latency: 20,
        packetLoss: 0,
        jitter: 5,
      },
    ],
    systemLoad: {
      cpuLoad: 30,
      memoryUsage: 50,
      diskIo: 10,
      networkIo: 5,
      backgroundProcesses: 20,
    },
    failureScenarios: [
      {
        name: "network-timeout",
        type: "network",
        probability: 0.1,
        duration: 5000,
        recovery: "retry",
        impact: "medium",
      },
    ],
  },
  monitoring: {
    enabled: true,
    metricsCollection: true,
    performanceTracking: true,
    resourceMonitoring: true,
    errorTracking: true,
    healthChecks: true,
    alerting: {
      enabled: true,
      thresholds: [
        {
          metric: "memory_usage_mb",
          operator: "gt",
          value: 800,
          duration: 30000,
          severity: "warning",
        },
        {
          metric: "cpu_usage_percent",
          operator: "gt",
          value: 90,
          duration: 10000,
          severity: "error",
        },
      ],
      channels: ["console", "log"],
      escalation: {
        enabled: false,
        levels: [],
        timeout: 60,
      },
    },
  },
  reporting: {
    enabled: true,
    format: ["json", "html"],
    outputPath: "./test-output/e2e",
    includeScreenshots: false,
    includeVideos: false,
    includeLogs: true,
    detailLevel: "standard",
  },
};
