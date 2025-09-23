/**
 * @fileoverview Configuration for production readiness validation
 */

import type { ProductionReadinessConfig } from './types.js';

/**
 * Default configuration for production readiness validation
 */
export const DEFAULT_PRODUCTION_READINESS_CONFIG: ProductionReadinessConfig = {
  testing: {
    testSuites: [
      {
        name: 'cli-integration',
        type: 'cli-integration',
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
        timeout: 300000, // 5 minutes per test
        parallel: true,
        retries: 2,
      },
      {
        name: 'mcp-integration',
        type: 'mcp-integration',
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
        timeout: 180000, // 3 minutes per test
        parallel: false, // Sequential for server tests
        retries: 3,
      },
      {
        name: 'vscode-integration',
        type: 'vscode-integration',
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
        timeout: 240000, // 4 minutes per test
        parallel: true,
        retries: 2,
      },
      {
        name: 'cross-platform',
        type: 'cross-platform',
        tests: [
          'test-windows-compatibility',
          'test-macos-compatibility',
          'test-linux-compatibility',
          'test-node-version-compatibility',
          'test-path-handling',
          'test-file-system-permissions',
          'test-environment-variables',
        ],
        timeout: 360000, // 6 minutes per test
        parallel: true,
        retries: 1,
      },
      {
        name: 'e2e-workflows',
        type: 'e2e-workflows',
        tests: [
          'test-full-codebase-analysis-workflow',
          'test-incremental-update-workflow',
          'test-multi-project-workflow',
          'test-collaboration-workflow',
          'test-backup-recovery-workflow',
          'test-migration-workflow',
        ],
        timeout: 600000, // 10 minutes per test
        parallel: false, // Sequential for E2E tests
        retries: 1,
      },
    ],
    coverage: {
      minimum: 80,
      target: 90,
    },
    performance: {
      timeout: 300000,
      retries: 2,
      parallel: true,
    },
    platforms: ['linux', 'darwin', 'win32'],
    languages: ['typescript', 'javascript', 'python', 'java'],
  },

  performance: {
    targets: {
      cliQueryResponseTime: 500, // 500ms
      mcpServerResponseTime: 200, // 200ms
      memoryUsage: 512 * 1024 * 1024, // 512MB
      parsingTime: 120000, // 2 minutes for 1000 files
      concurrentConnections: 5,
    },
    monitoring: {
      duration: 300000, // 5 minutes
      sampleRate: 1000, // 1 second
    },
    scalability: {
      maxNodes: 100000,
      maxFiles: 10000,
      concurrentUsers: 10,
    },
  },

  security: {
    vulnerabilityScanning: {
      enabled: true,
      severity: ['moderate', 'high', 'critical'],
    },
    inputValidation: {
      enabled: true,
      testCases: [
        'sql-injection',
        'xss-attacks',
        'path-traversal',
        'command-injection',
        'buffer-overflow',
      ],
    },
    dataPrivacy: {
      enabled: true,
      policies: [
        'data-retention',
        'data-cleanup',
        'user-consent',
        'data-anonymization',
      ],
    },
    authentication: {
      enabled: false, // Currently not implemented
      mechanisms: [],
    },
  },

  deployment: {
    buildValidation: {
      platforms: ['linux', 'darwin', 'win32'],
      artifacts: ['cli', 'mcp-server', 'vscode-extension'],
    },
    packageDistribution: {
      registries: ['npm', 'vscode-marketplace'],
      verification: true,
    },
    healthChecks: {
      endpoints: ['/health', '/status', '/metrics'],
      timeout: 5000,
    },
  },

  compliance: {
    requirements: [
      {
        name: 'MIT License Compliance',
        type: 'legal',
        mandatory: true,
        validator: 'license-validator',
      },
      {
        name: 'GDPR Compliance',
        type: 'regulatory',
        mandatory: false,
        validator: 'gdpr-validator',
      },
      {
        name: 'Code Quality Standards',
        type: 'internal',
        mandatory: true,
        validator: 'quality-validator',
      },
    ],
    auditing: {
      enabled: true,
      retention: 365 * 24 * 60 * 60 * 1000, // 1 year
    },
  },

  certification: {
    levels: ['NOT_READY', 'STAGING_READY', 'PRODUCTION_READY'],
    signOff: {
      required: true,
      approvers: ['maintainer', 'security-lead'],
    },
    documentation: {
      required: [
        'README.md',
        'API documentation',
        'Installation guide',
        'Configuration guide',
        'Troubleshooting guide',
      ],
      optional: [
        'Architecture documentation',
        'Performance benchmarks',
        'Security audit report',
      ],
    },
  },

  monitoring: {
    metrics: [
      {
        name: 'response_time',
        type: 'histogram',
        labels: ['method', 'endpoint'],
        threshold: 500,
      },
      {
        name: 'error_count',
        type: 'counter',
        labels: ['error_type', 'component'],
      },
      {
        name: 'memory_usage',
        type: 'gauge',
        labels: ['component'],
        threshold: 512 * 1024 * 1024,
      },
      {
        name: 'active_connections',
        type: 'gauge',
        labels: ['server_type'],
        threshold: 10,
      },
    ],
    alerting: {
      enabled: true,
      channels: ['console', 'log'],
    },
    dashboards: {
      enabled: false,
      providers: [],
    },
  },

  rollback: {
    enabled: true,
    procedures: [
      'validate-current-state',
      'backup-configuration',
      'revert-changes',
      'verify-rollback',
      'notify-stakeholders',
    ],
    validationSteps: [
      'health-check',
      'functionality-test',
      'performance-test',
      'data-integrity-check',
    ],
    timeout: 300000, // 5 minutes
  },
};

/**
 * Validate production readiness configuration
 */
export function validateConfig(config: ProductionReadinessConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate testing config
  if (!config.testing || !config.testing.testSuites || config.testing.testSuites.length === 0) {
    errors.push('Testing configuration must include at least one test suite');
  }

  if (config.testing?.coverage?.minimum < 0 || config.testing?.coverage?.minimum > 100) {
    errors.push('Coverage minimum must be between 0 and 100');
  }

  // Validate performance config
  if (!config.performance || !config.performance.targets) {
    errors.push('Performance configuration must include targets');
  }

  if (config.performance?.targets?.cliQueryResponseTime <= 0) {
    errors.push('CLI query response time target must be positive');
  }

  if (config.performance?.targets?.memoryUsage <= 0) {
    errors.push('Memory usage target must be positive');
  }

  // Validate security config
  if (config.security?.vulnerabilityScanning?.enabled && 
      (!config.security.vulnerabilityScanning.severity || config.security.vulnerabilityScanning.severity.length === 0)) {
    errors.push('Vulnerability scanning requires severity levels');
  }

  // Validate deployment config
  if (!config.deployment?.buildValidation?.platforms || config.deployment.buildValidation.platforms.length === 0) {
    errors.push('Deployment configuration must include platforms');
  }

  // Validate certification config
  if (!config.certification?.levels || config.certification.levels.length === 0) {
    errors.push('Certification configuration must include levels');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge user configuration with defaults
 */
export function mergeConfig(userConfig: Partial<ProductionReadinessConfig>): ProductionReadinessConfig {
  return {
    testing: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.testing,
      ...(userConfig.testing && {
        ...userConfig.testing,
        coverage: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.testing.coverage,
          ...userConfig.testing.coverage,
        },
        performance: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.testing.performance,
          ...userConfig.testing.performance,
        },
      }),
    },
    performance: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.performance,
      ...(userConfig.performance && {
        ...userConfig.performance,
        targets: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.performance.targets,
          ...userConfig.performance.targets,
        },
        monitoring: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.performance.monitoring,
          ...userConfig.performance.monitoring,
        },
        scalability: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.performance.scalability,
          ...userConfig.performance.scalability,
        },
      }),
    },
    security: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.security,
      ...(userConfig.security && {
        ...userConfig.security,
        vulnerabilityScanning: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.security.vulnerabilityScanning,
          ...userConfig.security.vulnerabilityScanning,
        },
        inputValidation: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.security.inputValidation,
          ...userConfig.security.inputValidation,
        },
        dataPrivacy: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.security.dataPrivacy,
          ...userConfig.security.dataPrivacy,
        },
        authentication: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.security.authentication,
          ...userConfig.security.authentication,
        },
      }),
    },
    deployment: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.deployment,
      ...(userConfig.deployment && {
        ...userConfig.deployment,
        buildValidation: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.deployment.buildValidation,
          ...userConfig.deployment.buildValidation,
        },
        packageDistribution: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.deployment.packageDistribution,
          ...userConfig.deployment.packageDistribution,
        },
        healthChecks: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.deployment.healthChecks,
          ...userConfig.deployment.healthChecks,
        },
      }),
    },
    compliance: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.compliance,
      ...(userConfig.compliance && {
        ...userConfig.compliance,
        auditing: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.compliance.auditing,
          ...userConfig.compliance.auditing,
        },
      }),
    },
    certification: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.certification,
      ...(userConfig.certification && {
        ...userConfig.certification,
        signOff: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.certification.signOff,
          ...userConfig.certification.signOff,
        },
        documentation: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.certification.documentation,
          ...userConfig.certification.documentation,
        },
      }),
    },
    monitoring: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.monitoring,
      ...(userConfig.monitoring && {
        ...userConfig.monitoring,
        alerting: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.monitoring.alerting,
          ...userConfig.monitoring.alerting,
        },
        dashboards: {
          ...DEFAULT_PRODUCTION_READINESS_CONFIG.monitoring.dashboards,
          ...userConfig.monitoring.dashboards,
        },
      }),
    },
    rollback: {
      ...DEFAULT_PRODUCTION_READINESS_CONFIG.rollback,
      ...userConfig.rollback,
    },
  };
}