/**
 * @fileoverview Type definitions for production readiness validation
 */

export interface ProductionReadinessConfig {
  testing: FinalTestingConfig;
  performance: PerformanceValidationConfig;
  security: SecurityValidationConfig;
  deployment: DeploymentValidationConfig;
  compliance: ComplianceConfig;
  certification: CertificationConfig;
  monitoring: MonitoringConfig;
  rollback: RollbackValidationConfig;
}

export interface FinalTestingConfig {
  testSuites: TestSuiteConfig[];
  coverage: {
    minimum: number;
    target: number;
  };
  performance: {
    timeout: number;
    retries: number;
    parallel: boolean;
  };
  platforms: string[];
  languages: string[];
}

export interface TestSuiteConfig {
  name: string;
  type: 'cli-integration' | 'mcp-integration' | 'vscode-integration' | 'cross-platform' | 'e2e-workflows';
  tests: string[];
  timeout: number;
  parallel: boolean;
  retries: number;
}

export interface PerformanceValidationConfig {
  targets: PerformanceTargets;
  monitoring: {
    duration: number;
    sampleRate: number;
  };
  scalability: {
    maxNodes: number;
    maxFiles: number;
    concurrentUsers: number;
  };
}

export interface PerformanceTargets {
  cliQueryResponseTime: number; // ms
  mcpServerResponseTime: number; // ms
  memoryUsage: number; // bytes
  parsingTime: number; // ms for 1000 files
  concurrentConnections: number;
}

export interface SecurityValidationConfig {
  vulnerabilityScanning: {
    enabled: boolean;
    severity: ('low' | 'moderate' | 'high' | 'critical')[];
  };
  inputValidation: {
    enabled: boolean;
    testCases: string[];
  };
  dataPrivacy: {
    enabled: boolean;
    policies: string[];
  };
  authentication: {
    enabled: boolean;
    mechanisms: string[];
  };
}

export interface DeploymentValidationConfig {
  buildValidation: {
    platforms: string[];
    artifacts: string[];
  };
  packageDistribution: {
    registries: string[];
    verification: boolean;
  };
  healthChecks: {
    endpoints: string[];
    timeout: number;
  };
}

export interface ComplianceConfig {
  requirements: ComplianceRequirement[];
  auditing: {
    enabled: boolean;
    retention: number;
  };
}

export interface ComplianceRequirement {
  name: string;
  type: 'legal' | 'regulatory' | 'internal';
  mandatory: boolean;
  validator: string;
}

export interface CertificationConfig {
  levels: ('STAGING_READY' | 'PRODUCTION_READY' | 'NOT_READY')[];
  signOff: {
    required: boolean;
    approvers: string[];
  };
  documentation: {
    required: string[];
    optional: string[];
  };
}

export interface MonitoringConfig {
  metrics: MetricConfig[];
  alerting: {
    enabled: boolean;
    channels: string[];
  };
  dashboards: {
    enabled: boolean;
    providers: string[];
  };
}

export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  labels: string[];
  threshold?: number;
}

export interface RollbackValidationConfig {
  enabled: boolean;
  procedures: string[];
  validationSteps: string[];
  timeout: number;
}

// Result Types

export interface IntegrationTestResult {
  success: boolean;
  testSuites: TestSuiteResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage: CoverageReport;
  performanceMetrics: PerformanceMetrics;
  issues: TestIssue[];
  recommendations: TestRecommendation[];
}

export interface TestSuiteResult {
  name: string;
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failedTests: FailedTest[];
  performanceData: Record<string, number>;
}

export interface FailedTest {
  name: string;
  error: string;
  stackTrace?: string;
  duration: number;
}

export interface CoverageReport {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage?: number;
  diskUsage?: number;
}

export interface TestIssue {
  type: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details?: string;
  recommendation: string;
}

export interface TestRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  benefit: string;
}

export interface ProductionReadinessReport {
  overallReady: boolean;
  readinessScore: number; // 0-100
  categories: ReadinessCategory[];
  criticalIssues: ProductionIssue[];
  recommendations: ProductionRecommendation[];
  signOffRequired: SignOffRequirement[];
  deploymentApproval: DeploymentApproval;
  riskAssessment: RiskAssessment;
}

export interface ReadinessCategory {
  name: string;
  description: string;
  score: number; // 0-100
  status: 'pass' | 'warning' | 'fail';
  checks: ReadinessCheck[];
  issues: string[];
  recommendations: string[];
}

export interface ReadinessCheck {
  name: string;
  description: string;
  status: 'pass' | 'warning' | 'fail';
  value?: string | number;
  threshold?: string | number;
  details?: string;
}

export interface ProductionIssue {
  type: 'code-quality' | 'performance' | 'security' | 'infrastructure' | 'monitoring' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  impact: string;
  recommendation: string;
}

export interface ProductionRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  benefit: string;
}

export interface SignOffRequirement {
  category: string;
  required: boolean;
  approver: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
}

export interface DeploymentApproval {
  approved: boolean;
  approvalLevel: 'none' | 'conditional' | 'full';
  conditions: string[];
  approvedBy?: string;
  approvedAt?: Date;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  recommendedActions: string[];
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  impact: string;
  mitigation: string;
}

// E2E Testing Types

export interface E2ETestResult {
  success: boolean;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: E2EScenarioResult[];
  duration: number;
  performanceSummary: PerformanceSummary;
  issues: E2EIssue[];
}

export interface E2EScenarioResult {
  name: string;
  description: string;
  success: boolean;
  duration: number;
  steps: E2EStepResult[];
  performanceData: Record<string, number>;
  issues?: E2EIssue[];
}

export interface E2EStepResult {
  name: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

export interface PerformanceSummary {
  avgScenarioDuration: number;
  maxMemoryUsage: number;
  avgResponseTime: number;
  throughput: number;
  errorRate: number;
}

export interface E2EIssue {
  scenario: string;
  step?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
}

// Certification Types

export interface ReleaseCertification {
  certified: boolean;
  certificationId: string;
  timestamp: Date;
  version: string;
  certificationLevel: 'PRODUCTION_READY' | 'STAGING_READY' | 'NOT_READY';
  validations: ValidationResults;
  blockers: ReleaseBlocker[];
  recommendations: FinalRecommendation[];
  signedOff: boolean;
  report: CertificationReport;
}

export interface ValidationResults {
  integrationTests: boolean;
  productionReadiness: boolean;
  endToEndTests: boolean;
  performance: boolean;
  security: boolean;
  deployment: boolean;
}

export interface ReleaseBlocker {
  type: string;
  severity: 'critical' | 'high';
  message: string;
  resolution: string;
  estimatedTime: number;
}

export interface FinalRecommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  implementation: string;
  benefit: string;
}

export interface CertificationReport {
  summary: string;
  details: Record<string, any>;
  metrics: Record<string, number>;
  attachments: string[];
}