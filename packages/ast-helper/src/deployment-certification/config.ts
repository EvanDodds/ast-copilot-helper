/**
 * @fileoverview Deployment Certification Configuration Manager
 * Manages comprehensive deployment and release certification configuration
 */

import type {
  DeploymentCertificationConfig as IDeploymentCertificationConfig,
  BuildVerificationConfig,
  PackageDistributionConfig,
  HealthCheckConfig,
  RollbackTestingConfig,
  MonitoringSetupConfig,
  DocumentationValidationConfig,
  ProductionApprovalConfig,
  DeploymentEnvironment,
  DeploymentPriority,
  CertificationLevel,
  DeploymentCategory,
} from "./types.js";

/**
 * Default build verification configuration
 */
const DEFAULT_BUILD_VERIFICATION: BuildVerificationConfig = {
  enabled: true,
  timeout: 300000, // 5 minutes
  stages: {
    compile: true,
    test: true,
    lint: true,
    bundle: true,
    analyze: true,
  },
  thresholds: {
    testCoverage: 80,
    bundleSize: 10485760, // 10MB
    buildTime: 180000, // 3 minutes
    errorThreshold: 0,
  },
  quality: {
    codeQuality: true,
    securityScan: true,
    dependencyCheck: true,
    licenseCheck: true,
  },
};

/**
 * Default package distribution configuration
 */
const DEFAULT_PACKAGE_DISTRIBUTION: PackageDistributionConfig = {
  enabled: true,
  timeout: 600000, // 10 minutes
  registries: {
    npm: true,
    docker: false,
    maven: false,
    pypi: false,
  },
  verification: {
    integrity: true,
    signatures: true,
    metadata: true,
    dependencies: true,
  },
  rollback: {
    enabled: true,
    strategy: "immediate",
    timeout: 300000,
  },
};

/**
 * Default health check configuration
 */
const DEFAULT_HEALTH_CHECKS: HealthCheckConfig = {
  enabled: true,
  timeout: 120000, // 2 minutes
  endpoints: [
    {
      name: "api-health",
      url: "/health",
      method: "GET",
      expectedStatus: [200],
      timeout: 5000,
      retries: 3,
    },
    {
      name: "readiness",
      url: "/ready",
      method: "GET",
      expectedStatus: [200],
      timeout: 10000,
      retries: 2,
    },
  ],
  services: {
    database: true,
    cache: true,
    messageQueue: false,
    externalApis: true,
  },
  thresholds: {
    responseTime: 1000,
    errorRate: 5,
    availability: 99.9,
  },
};

/**
 * Default rollback testing configuration
 */
const DEFAULT_ROLLBACK_TESTING: RollbackTestingConfig = {
  enabled: true,
  timeout: 300000, // 5 minutes
  scenarios: {
    gracefulShutdown: true,
    dataConsistency: true,
    serviceRecovery: true,
    userImpact: true,
  },
  automation: {
    triggers: ["high_error_rate", "performance_degradation", "manual_trigger"],
    actions: ["stop_deployment", "rollback_version", "notify_team"],
    notifications: ["email", "slack", "pagerduty"],
  },
  validation: {
    postRollback: true,
    dataIntegrity: true,
    serviceHealth: true,
  },
};

/**
 * Default monitoring setup configuration
 */
const DEFAULT_MONITORING_SETUP: MonitoringSetupConfig = {
  enabled: true,
  timeout: 180000, // 3 minutes
  metrics: {
    system: true,
    application: true,
    business: false,
    security: true,
  },
  alerting: {
    enabled: true,
    channels: ["email", "slack"],
    escalation: true,
    suppressionRules: false,
  },
  logging: {
    structured: true,
    centralized: true,
    retention: 30, // days
    levels: ["error", "warn", "info"],
  },
  tracing: {
    distributed: false,
    sampling: 0.1,
    storage: "memory",
  },
};

/**
 * Default documentation validation configuration
 */
const DEFAULT_DOCUMENTATION_VALIDATION: DocumentationValidationConfig = {
  enabled: true,
  timeout: 120000, // 2 minutes
  types: {
    api: true,
    deployment: true,
    operations: true,
    troubleshooting: true,
  },
  quality: {
    completeness: 80,
    accuracy: true,
    upToDate: true,
    examples: true,
  },
  formats: {
    markdown: true,
    openapi: false,
    swagger: false,
    postman: false,
  },
};

/**
 * Default production approval configuration
 */
const DEFAULT_PRODUCTION_APPROVAL: ProductionApprovalConfig = {
  enabled: true,
  timeout: 86400000, // 24 hours
  approvers: {
    required: 2,
    roles: ["tech-lead", "devops-engineer"],
    teams: ["development", "operations"],
  },
  criteria: {
    allTestsPassed: true,
    securityApproval: true,
    performanceBaseline: true,
    rollbackPlan: true,
  },
  automation: {
    autoApprove: false,
    conditions: ["all_tests_green", "security_scan_passed"],
    overrides: true,
  },
};

/**
 * Default deployment certification configuration
 */
const DEFAULT_CONFIG: IDeploymentCertificationConfig = {
  environment: "staging",
  priority: "medium",
  certificationLevel: "standard",
  timeout: 1800000, // 30 minutes
  parallel: true,
  buildVerification: DEFAULT_BUILD_VERIFICATION,
  packageDistribution: DEFAULT_PACKAGE_DISTRIBUTION,
  healthChecks: DEFAULT_HEALTH_CHECKS,
  rollbackTesting: DEFAULT_ROLLBACK_TESTING,
  monitoringSetup: DEFAULT_MONITORING_SETUP,
  documentationValidation: DEFAULT_DOCUMENTATION_VALIDATION,
  productionApproval: DEFAULT_PRODUCTION_APPROVAL,
};

/**
 * Deployment certification configuration manager
 */
export class DeploymentCertificationConfigManager {
  private config: IDeploymentCertificationConfig;

  constructor(customConfig?: Partial<IDeploymentCertificationConfig>) {
    this.config = this.mergeConfigurations(DEFAULT_CONFIG, customConfig);
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): IDeploymentCertificationConfig {
    return { ...this.config };
  }

  /**
   * Get build verification configuration
   */
  public getBuildVerificationConfig(): BuildVerificationConfig {
    return { ...this.config.buildVerification };
  }

  /**
   * Get package distribution configuration
   */
  public getPackageDistributionConfig(): PackageDistributionConfig {
    return { ...this.config.packageDistribution };
  }

  /**
   * Get health check configuration
   */
  public getHealthCheckConfig(): HealthCheckConfig {
    return { ...this.config.healthChecks };
  }

  /**
   * Get rollback testing configuration
   */
  public getRollbackTestingConfig(): RollbackTestingConfig {
    return { ...this.config.rollbackTesting };
  }

  /**
   * Get monitoring setup configuration
   */
  public getMonitoringSetupConfig(): MonitoringSetupConfig {
    return { ...this.config.monitoringSetup };
  }

  /**
   * Get documentation validation configuration
   */
  public getDocumentationValidationConfig(): DocumentationValidationConfig {
    return { ...this.config.documentationValidation };
  }

  /**
   * Get production approval configuration
   */
  public getProductionApprovalConfig(): ProductionApprovalConfig {
    return { ...this.config.productionApproval };
  }

  /**
   * Update environment configuration
   */
  public updateEnvironment(environment: DeploymentEnvironment): void {
    this.config.environment = environment;
    this.adjustConfigurationForEnvironment(environment);
  }

  /**
   * Update certification level
   */
  public updateCertificationLevel(level: CertificationLevel): void {
    this.config.certificationLevel = level;
    this.adjustConfigurationForCertificationLevel(level);
  }

  /**
   * Update deployment priority
   */
  public updatePriority(priority: DeploymentPriority): void {
    this.config.priority = priority;
    this.adjustConfigurationForPriority(priority);
  }

  /**
   * Enable/disable a certification category
   */
  public toggleCategory(category: DeploymentCategory, enabled: boolean): void {
    switch (category) {
      case "build-verification":
        this.config.buildVerification.enabled = enabled;
        break;
      case "package-distribution":
        this.config.packageDistribution.enabled = enabled;
        break;
      case "health-checks":
        this.config.healthChecks.enabled = enabled;
        break;
      case "rollback-testing":
        this.config.rollbackTesting.enabled = enabled;
        break;
      case "monitoring-setup":
        this.config.monitoringSetup.enabled = enabled;
        break;
      case "documentation-validation":
        this.config.documentationValidation.enabled = enabled;
        break;
      case "production-approval":
        this.config.productionApproval.enabled = enabled;
        break;
    }
  }

  /**
   * Get enabled certification categories
   */
  public getEnabledCategories(): DeploymentCategory[] {
    const categories: DeploymentCategory[] = [];

    if (this.config.buildVerification.enabled) {
      categories.push("build-verification");
    }
    if (this.config.packageDistribution.enabled) {
      categories.push("package-distribution");
    }
    if (this.config.healthChecks.enabled) {
      categories.push("health-checks");
    }
    if (this.config.rollbackTesting.enabled) {
      categories.push("rollback-testing");
    }
    if (this.config.monitoringSetup.enabled) {
      categories.push("monitoring-setup");
    }
    if (this.config.documentationValidation.enabled) {
      categories.push("documentation-validation");
    }
    if (this.config.productionApproval.enabled) {
      categories.push("production-approval");
    }

    return categories;
  }

  /**
   * Validate configuration consistency
   */
  public validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check timeout consistency
    if (this.config.timeout <= 0) {
      errors.push("Overall timeout must be positive");
    }

    // Check that at least one category is enabled
    const enabledCategories = this.getEnabledCategories();
    if (enabledCategories.length === 0) {
      errors.push("At least one certification category must be enabled");
    }

    // Validate build verification
    if (this.config.buildVerification.enabled) {
      if (
        this.config.buildVerification.thresholds.testCoverage < 0 ||
        this.config.buildVerification.thresholds.testCoverage > 100
      ) {
        errors.push("Test coverage threshold must be between 0 and 100");
      }
    }

    // Validate health checks
    if (this.config.healthChecks.enabled) {
      if (this.config.healthChecks.endpoints.length === 0) {
        errors.push("At least one health check endpoint must be configured");
      }

      for (const endpoint of this.config.healthChecks.endpoints) {
        if (!endpoint.name || !endpoint.url) {
          errors.push(
            `Health check endpoint missing name or URL: ${endpoint.name}`,
          );
        }
      }
    }

    // Validate production approval
    if (this.config.productionApproval.enabled) {
      if (this.config.productionApproval.approvers.required <= 0) {
        errors.push(
          "At least one approver must be required for production approval",
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration for specific environment
   */
  public static getEnvironmentConfig(
    environment: DeploymentEnvironment,
  ): Partial<IDeploymentCertificationConfig> {
    const configs: Record<
      DeploymentEnvironment,
      Partial<IDeploymentCertificationConfig>
    > = {
      development: {
        certificationLevel: "basic",
        priority: "low",
        productionApproval: { ...DEFAULT_PRODUCTION_APPROVAL, enabled: false },
        rollbackTesting: { ...DEFAULT_ROLLBACK_TESTING, enabled: false },
      },
      staging: {
        certificationLevel: "standard",
        priority: "medium",
        productionApproval: { ...DEFAULT_PRODUCTION_APPROVAL, enabled: false },
      },
      "pre-production": {
        certificationLevel: "premium",
        priority: "high",
        productionApproval: { ...DEFAULT_PRODUCTION_APPROVAL, enabled: true },
      },
      production: {
        certificationLevel: "enterprise",
        priority: "critical",
        productionApproval: {
          ...DEFAULT_PRODUCTION_APPROVAL,
          enabled: true,
          approvers: { ...DEFAULT_PRODUCTION_APPROVAL.approvers, required: 3 },
        },
      },
      canary: {
        certificationLevel: "premium",
        priority: "high",
        rollbackTesting: {
          ...DEFAULT_ROLLBACK_TESTING,
          scenarios: {
            ...DEFAULT_ROLLBACK_TESTING.scenarios,
            userImpact: true,
          },
        },
      },
      "blue-green": {
        certificationLevel: "standard",
        priority: "medium",
        rollbackTesting: {
          ...DEFAULT_ROLLBACK_TESTING,
          automation: {
            ...DEFAULT_ROLLBACK_TESTING.automation,
            triggers: ["performance_degradation", "error_spike"],
          },
        },
      },
    };

    return configs[environment] || {};
  }

  /**
   * Merge configurations with proper deep merging
   */
  private mergeConfigurations(
    defaultConfig: IDeploymentCertificationConfig,
    customConfig?: Partial<IDeploymentCertificationConfig>,
  ): IDeploymentCertificationConfig {
    if (!customConfig) {
      return { ...defaultConfig };
    }

    const merged = { ...defaultConfig };

    // Merge top-level properties
    if (customConfig.environment !== undefined) {
      merged.environment = customConfig.environment;
    }
    if (customConfig.priority !== undefined) {
      merged.priority = customConfig.priority;
    }
    if (customConfig.certificationLevel !== undefined) {
      merged.certificationLevel = customConfig.certificationLevel;
    }
    if (customConfig.timeout !== undefined) {
      merged.timeout = customConfig.timeout;
    }
    if (customConfig.parallel !== undefined) {
      merged.parallel = customConfig.parallel;
    }

    // Deep merge nested configurations
    if (customConfig.buildVerification) {
      merged.buildVerification = {
        ...merged.buildVerification,
        ...customConfig.buildVerification,
      };
    }
    if (customConfig.packageDistribution) {
      merged.packageDistribution = {
        ...merged.packageDistribution,
        ...customConfig.packageDistribution,
      };
    }
    if (customConfig.healthChecks) {
      merged.healthChecks = {
        ...merged.healthChecks,
        ...customConfig.healthChecks,
      };
    }
    if (customConfig.rollbackTesting) {
      merged.rollbackTesting = {
        ...merged.rollbackTesting,
        ...customConfig.rollbackTesting,
      };
    }
    if (customConfig.monitoringSetup) {
      merged.monitoringSetup = {
        ...merged.monitoringSetup,
        ...customConfig.monitoringSetup,
      };
    }
    if (customConfig.documentationValidation) {
      merged.documentationValidation = {
        ...merged.documentationValidation,
        ...customConfig.documentationValidation,
      };
    }
    if (customConfig.productionApproval) {
      merged.productionApproval = {
        ...merged.productionApproval,
        ...customConfig.productionApproval,
      };
    }

    return merged;
  }

  /**
   * Adjust configuration for specific environment
   */
  private adjustConfigurationForEnvironment(
    environment: DeploymentEnvironment,
  ): void {
    const environmentConfig =
      DeploymentCertificationConfigManager.getEnvironmentConfig(environment);
    this.config = this.mergeConfigurations(this.config, environmentConfig);
  }

  /**
   * Adjust configuration for certification level
   */
  private adjustConfigurationForCertificationLevel(
    level: CertificationLevel,
  ): void {
    switch (level) {
      case "basic":
        this.config.buildVerification.thresholds.testCoverage = 60;
        this.config.healthChecks.thresholds.availability = 95;
        break;
      case "standard":
        this.config.buildVerification.thresholds.testCoverage = 80;
        this.config.healthChecks.thresholds.availability = 99;
        break;
      case "premium":
        this.config.buildVerification.thresholds.testCoverage = 90;
        this.config.healthChecks.thresholds.availability = 99.9;
        break;
      case "enterprise":
        this.config.buildVerification.thresholds.testCoverage = 95;
        this.config.healthChecks.thresholds.availability = 99.95;
        this.config.buildVerification.quality.securityScan = true;
        break;
      case "critical":
        this.config.buildVerification.thresholds.testCoverage = 98;
        this.config.healthChecks.thresholds.availability = 99.99;
        this.config.buildVerification.quality.securityScan = true;
        this.config.productionApproval.approvers.required = 3;
        break;
    }
  }

  /**
   * Adjust configuration for priority level
   */
  private adjustConfigurationForPriority(priority: DeploymentPriority): void {
    switch (priority) {
      case "low":
        this.config.timeout = 3600000; // 1 hour
        this.config.parallel = true;
        break;
      case "medium":
        this.config.timeout = 1800000; // 30 minutes
        this.config.parallel = true;
        break;
      case "high":
        this.config.timeout = 900000; // 15 minutes
        this.config.parallel = false;
        break;
      case "critical":
        this.config.timeout = 600000; // 10 minutes
        this.config.parallel = false;
        this.config.productionApproval.enabled = true;
        break;
      case "emergency":
        this.config.timeout = 300000; // 5 minutes
        this.config.parallel = false;
        this.config.productionApproval.automation.overrides = true;
        break;
    }
  }
}
