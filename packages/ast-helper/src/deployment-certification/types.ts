/**
 * @fileoverview Deployment and Release Certification Types
 * Comprehensive types for deployment validation and release certification
 */

/**
 * Deployment validation categories
 */
export type DeploymentCategory = 
  | 'build-verification'
  | 'package-distribution'
  | 'health-checks'
  | 'rollback-testing'
  | 'monitoring-setup'
  | 'documentation-validation'
  | 'production-approval';

/**
 * Deployment environment types
 */
export type DeploymentEnvironment = 
  | 'development'
  | 'staging'
  | 'pre-production'
  | 'production'
  | 'canary'
  | 'blue-green';

/**
 * Deployment status types
 */
export type DeploymentStatus = 
  | 'pending'
  | 'in-progress'
  | 'validating'
  | 'certified'
  | 'failed'
  | 'rolled-back'
  | 'approved';

/**
 * Release certification level
 */
export type CertificationLevel = 
  | 'basic'
  | 'standard'
  | 'premium'
  | 'enterprise'
  | 'critical';

/**
 * Deployment priority levels
 */
export type DeploymentPriority = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'emergency';

/**
 * Build verification configuration
 */
export interface BuildVerificationConfig {
  enabled: boolean;
  timeout: number;
  stages: {
    compile: boolean;
    test: boolean;
    lint: boolean;
    bundle: boolean;
    analyze: boolean;
  };
  thresholds: {
    testCoverage: number;
    bundleSize: number;
    buildTime: number;
    errorThreshold: number;
  };
  quality: {
    codeQuality: boolean;
    securityScan: boolean;
    dependencyCheck: boolean;
    licenseCheck: boolean;
  };
}

/**
 * Package distribution configuration
 */
export interface PackageDistributionConfig {
  enabled: boolean;
  timeout: number;
  registries: {
    npm: boolean;
    docker: boolean;
    maven: boolean;
    pypi: boolean;
  };
  verification: {
    integrity: boolean;
    signatures: boolean;
    metadata: boolean;
    dependencies: boolean;
  };
  rollback: {
    enabled: boolean;
    strategy: 'immediate' | 'gradual' | 'manual';
    timeout: number;
  };
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  timeout: number;
  endpoints: Array<{
    name: string;
    url: string;
    method: 'GET' | 'POST' | 'HEAD';
    expectedStatus: number[];
    timeout: number;
    retries: number;
  }>;
  services: {
    database: boolean;
    cache: boolean;
    messageQueue: boolean;
    externalApis: boolean;
  };
  thresholds: {
    responseTime: number;
    errorRate: number;
    availability: number;
  };
}

/**
 * Monitoring setup configuration
 */
export interface MonitoringSetupConfig {
  enabled: boolean;
  timeout: number;
  metrics: {
    system: boolean;
    application: boolean;
    business: boolean;
    security: boolean;
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    escalation: boolean;
    suppressionRules: boolean;
  };
  logging: {
    structured: boolean;
    centralized: boolean;
    retention: number;
    levels: string[];
  };
  tracing: {
    distributed: boolean;
    sampling: number;
    storage: string;
  };
}

/**
 * Rollback testing configuration
 */
export interface RollbackTestingConfig {
  enabled: boolean;
  timeout: number;
  scenarios: {
    gracefulShutdown: boolean;
    dataConsistency: boolean;
    serviceRecovery: boolean;
    userImpact: boolean;
  };
  automation: {
    triggers: string[];
    actions: string[];
    notifications: string[];
  };
  validation: {
    postRollback: boolean;
    dataIntegrity: boolean;
    serviceHealth: boolean;
  };
}

/**
 * Documentation validation configuration
 */
export interface DocumentationValidationConfig {
  enabled: boolean;
  timeout: number;
  types: {
    api: boolean;
    deployment: boolean;
    operations: boolean;
    troubleshooting: boolean;
  };
  quality: {
    completeness: number;
    accuracy: boolean;
    upToDate: boolean;
    examples: boolean;
  };
  formats: {
    markdown: boolean;
    openapi: boolean;
    swagger: boolean;
    postman: boolean;
  };
}

/**
 * Production approval configuration
 */
export interface ProductionApprovalConfig {
  enabled: boolean;
  timeout: number;
  approvers: {
    required: number;
    roles: string[];
    teams: string[];
  };
  criteria: {
    allTestsPassed: boolean;
    securityApproval: boolean;
    performanceBaseline: boolean;
    rollbackPlan: boolean;
  };
  automation: {
    autoApprove: boolean;
    conditions: string[];
    overrides: boolean;
  };
}

/**
 * Complete deployment certification configuration
 */
export interface DeploymentCertificationConfig {
  environment: DeploymentEnvironment;
  priority: DeploymentPriority;
  certificationLevel: CertificationLevel;
  timeout: number;
  parallel: boolean;
  buildVerification: BuildVerificationConfig;
  packageDistribution: PackageDistributionConfig;
  healthChecks: HealthCheckConfig;
  rollbackTesting: RollbackTestingConfig;
  monitoringSetup: MonitoringSetupConfig;
  documentationValidation: DocumentationValidationConfig;
  productionApproval: ProductionApprovalConfig;
}

/**
 * Individual certification step result
 */
export interface CertificationStepResult {
  step: string;
  category: DeploymentCategory;
  passed: boolean;
  score: number;
  duration: number;
  startTime: string;
  endTime: string;
  details: {
    action: string;
    input?: any;
    output?: any;
    metrics: {
      responseTime: number;
      resourceUsage: any;
      errorCount: number;
      warningCount: number;
    };
  };
  error?: string;
  warnings: string[];
  recommendations: string[];
}

/**
 * Deployment scenario result
 */
export interface DeploymentScenarioResult {
  scenario: string;
  category: DeploymentCategory;
  environment: DeploymentEnvironment;
  passed: boolean;
  score: number;
  duration: number;
  startTime: string;
  endTime: string;
  steps: CertificationStepResult[];
  errors: Array<{
    type: 'validation' | 'system' | 'network' | 'timeout';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    resolved: boolean;
    resolution?: string;
  }>;
  performance: {
    averageStepDuration: number;
    peakStepDuration: number;
    totalOperations: number;
    operationsPerSecond: number;
    errorRate: number;
  };
  resources: {
    deploymentSize: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkUsage: number;
    costs: {
      infrastructure: number;
      bandwidth: number;
      storage: number;
      compute: number;
    };
  };
  approval: {
    required: boolean;
    obtained: boolean;
    approvers: string[];
    timestamp?: string;
    notes?: string;
  };
}

/**
 * Deployment certification summary
 */
export interface DeploymentSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  pendingApproval: number;
  totalSteps: number;
  passedSteps: number;
  averageDuration: number;
  certificationLevel: CertificationLevel;
  readinessScore: number;
  deploymentRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'proceed' | 'fix-issues' | 'rollback' | 'hold';
}

/**
 * Deployment performance metrics
 */
export interface DeploymentPerformanceMetrics {
  averageDeploymentTime: number;
  peakDeploymentTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  rollbackRate: number;
  mttr: number; // Mean Time To Recovery
  mtbf: number; // Mean Time Between Failures
}

/**
 * Deployment resource metrics
 */
export interface DeploymentResourceMetrics {
  totalDeploymentSize: number;
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  peakCpuUsage: number;
  averageCpuUsage: number;
  diskUsage: number;
  networkBandwidth: number;
  costs: {
    total: number;
    infrastructure: number;
    bandwidth: number;
    storage: number;
    compute: number;
    operational: number;
  };
  efficiency: {
    resourceUtilization: number;
    costPerDeployment: number;
    timeToValue: number;
  };
}

/**
 * Deployment environment status
 */
export interface DeploymentEnvironmentStatus {
  environment: DeploymentEnvironment;
  version: string;
  status: DeploymentStatus;
  healthy: boolean;
  lastDeployment: string;
  uptime: number;
  services: Array<{
    name: string;
    status: 'running' | 'stopped' | 'error' | 'unknown';
    version: string;
    healthy: boolean;
    lastCheck: string;
    metrics: {
      responseTime: number;
      errorRate: number;
      throughput: number;
      availability: number;
    };
  }>;
  infrastructure: {
    servers: number;
    containers: number;
    databases: number;
    queues: number;
  };
  monitoring: {
    enabled: boolean;
    alertsActive: number;
    metricsCollected: number;
    dashboards: number;
  };
}

/**
 * Deployment recommendation
 */
export interface DeploymentRecommendation {
  category: DeploymentCategory;
  priority: DeploymentPriority;
  title: string;
  description: string;
  action: string;
  impact: {
    risk: 'low' | 'medium' | 'high' | 'critical';
    effort: 'low' | 'medium' | 'high';
    timeline: string;
    cost: 'low' | 'medium' | 'high';
  };
  implementation: {
    steps: string[];
    resources: string[];
    dependencies: string[];
    risks: string[];
  };
}

/**
 * Complete deployment certification result
 */
export interface DeploymentCertificationResult {
  certificationId: string;
  environment: DeploymentEnvironment;
  version: string;
  passed: boolean;
  certified: boolean;
  score: number;
  certificationLevel: CertificationLevel;
  timestamp: string;
  duration: number;
  scenarios: DeploymentScenarioResult[];
  summary: DeploymentSummary;
  performance: DeploymentPerformanceMetrics;
  resources: DeploymentResourceMetrics;
  environmentStatus: DeploymentEnvironmentStatus;
  recommendations: DeploymentRecommendation[];
  approval: {
    required: boolean;
    obtained: boolean;
    approvers: Array<{
      name: string;
      role: string;
      timestamp: string;
      decision: 'approved' | 'rejected' | 'pending';
      notes?: string;
    }>;
    finalDecision: 'approved' | 'rejected' | 'pending';
    decisionTimestamp?: string;
    conditions: string[];
  };
  deployment: {
    strategy: 'blue-green' | 'canary' | 'rolling' | 'recreate';
    rollbackPlan: {
      enabled: boolean;
      triggers: string[];
      steps: string[];
      timeline: string;
    };
    monitoring: {
      dashboards: string[];
      alerts: string[];
      slos: string[];
    };
    documentation: {
      deploymentGuide: string;
      rollbackGuide: string;
      troubleshooting: string;
      contacts: string[];
    };
  };
}