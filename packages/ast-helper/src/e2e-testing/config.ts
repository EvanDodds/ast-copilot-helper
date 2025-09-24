/**
 * @fileoverview End-to-end testing configuration management
 */

import type {
  E2ETestingConfig,
  E2ECategory,
  E2EScenarioConfig,
} from "./types.js";
import { DEFAULT_E2E_CONFIG } from "./types.js";

/**
 * E2E testing configuration with production-ready defaults
 */
export class E2EConfig {
  private config: E2ETestingConfig;

  constructor(customConfig: Partial<E2ETestingConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_E2E_CONFIG, customConfig);
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): E2ETestingConfig {
    return { ...this.config };
  }

  /**
   * Get scenarios for a specific category
   */
  public getScenariosForCategory(category: E2ECategory): E2EScenarioConfig[] {
    return this.config.scenarios.filter(
      (scenario) => scenario.category === category && scenario.enabled,
    );
  }

  /**
   * Get all enabled scenarios
   */
  public getEnabledScenarios(): E2EScenarioConfig[] {
    return this.config.scenarios.filter((scenario) => scenario.enabled);
  }

  /**
   * Add a new scenario
   */
  public addScenario(scenario: E2EScenarioConfig): void {
    this.config.scenarios.push(scenario);
  }

  /**
   * Update an existing scenario
   */
  public updateScenario(
    name: string,
    updates: Partial<E2EScenarioConfig>,
  ): boolean {
    const index = this.config.scenarios.findIndex((s) => s.name === name);
    if (index !== -1) {
      const currentScenario = this.config.scenarios[index];
      if (currentScenario) {
        this.config.scenarios[index] = {
          ...currentScenario,
          ...updates,
          // Ensure required fields are preserved
          name: updates.name ?? currentScenario.name,
          description: updates.description ?? currentScenario.description,
          category: updates.category ?? currentScenario.category,
          enabled: updates.enabled ?? currentScenario.enabled,
          timeout: updates.timeout ?? currentScenario.timeout,
          retries: updates.retries ?? currentScenario.retries,
          prerequisites: updates.prerequisites ?? currentScenario.prerequisites,
          cleanup: updates.cleanup ?? currentScenario.cleanup,
          parallel: updates.parallel ?? currentScenario.parallel,
          environment: updates.environment ?? currentScenario.environment,
        };
        return true;
      }
    }
    return false;
  }

  /**
   * Remove a scenario
   */
  public removeScenario(name: string): boolean {
    const index = this.config.scenarios.findIndex((s) => s.name === name);
    if (index !== -1) {
      this.config.scenarios.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable/disable a scenario
   */
  public setScenarioEnabled(name: string, enabled: boolean): boolean {
    return this.updateScenario(name, { enabled });
  }

  /**
   * Get resource configuration
   */
  public getResourceConfig() {
    return { ...this.config.resources };
  }

  /**
   * Update resource limits
   */
  public updateResourceConfig(
    updates: Partial<E2ETestingConfig["resources"]>,
  ): void {
    this.config.resources = { ...this.config.resources, ...updates };
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig() {
    return { ...this.config.monitoring };
  }

  /**
   * Update monitoring configuration
   */
  public updateMonitoringConfig(
    updates: Partial<E2ETestingConfig["monitoring"]>,
  ): void {
    this.config.monitoring = { ...this.config.monitoring, ...updates };
  }

  /**
   * Get simulation configuration
   */
  public getSimulationConfig() {
    return { ...this.config.simulation };
  }

  /**
   * Update simulation configuration
   */
  public updateSimulationConfig(
    updates: Partial<E2ETestingConfig["simulation"]>,
  ): void {
    this.config.simulation = { ...this.config.simulation, ...updates };
  }

  /**
   * Validate the configuration
   */
  public validateConfig(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate scenarios
    if (this.config.scenarios.length === 0) {
      warnings.push("No test scenarios configured");
    }

    this.config.scenarios.forEach((scenario, index) => {
      if (!scenario.name) {
        errors.push(`Scenario at index ${index} has no name`);
      }
      if (scenario.timeout <= 0) {
        errors.push(`Scenario '${scenario.name}' has invalid timeout`);
      }
      if (scenario.retries < 0) {
        errors.push(`Scenario '${scenario.name}' has negative retries`);
      }
    });

    // Validate resources
    if (this.config.resources.maxMemoryMB <= 0) {
      errors.push("Max memory must be positive");
    }
    if (
      this.config.resources.maxCpuPercent <= 0 ||
      this.config.resources.maxCpuPercent > 100
    ) {
      errors.push("Max CPU percent must be between 1 and 100");
    }

    // Validate simulation
    if (this.config.simulation.realWorldCodebases.length === 0) {
      warnings.push("No real-world codebases configured for testing");
    }
    if (this.config.simulation.userProfiles.length === 0) {
      warnings.push("No user profiles configured for simulation");
    }

    // Validate monitoring
    if (
      this.config.monitoring.enabled &&
      this.config.monitoring.alerting.enabled
    ) {
      if (this.config.monitoring.alerting.thresholds.length === 0) {
        warnings.push(
          "Monitoring alerting is enabled but no thresholds configured",
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get configuration summary
   */
  public getConfigSummary(): Record<string, unknown> {
    return {
      enabled: this.config.enabled,
      totalScenarios: this.config.scenarios.length,
      enabledScenarios: this.config.scenarios.filter((s) => s.enabled).length,
      categories: [...new Set(this.config.scenarios.map((s) => s.category))],
      resources: {
        maxMemoryMB: this.config.resources.maxMemoryMB,
        maxCpuPercent: this.config.resources.maxCpuPercent,
        maxConcurrentUsers: this.config.resources.maxConcurrentUsers,
      },
      simulation: {
        codebases: this.config.simulation.realWorldCodebases.length,
        userProfiles: this.config.simulation.userProfiles.length,
        networkConditions: this.config.simulation.networkConditions.length,
      },
      monitoring: {
        enabled: this.config.monitoring.enabled,
        alerting: this.config.monitoring.alerting.enabled,
        thresholds: this.config.monitoring.alerting.thresholds.length,
      },
      reporting: {
        enabled: this.config.reporting.enabled,
        formats: this.config.reporting.format,
        detailLevel: this.config.reporting.detailLevel,
      },
    };
  }

  /**
   * Deep merge configurations
   */
  private mergeConfig(
    base: E2ETestingConfig,
    custom: Partial<E2ETestingConfig>,
  ): E2ETestingConfig {
    const merged = { ...base };

    if (custom.enabled !== undefined) {
      merged.enabled = custom.enabled;
    }

    if (custom.scenarios) {
      merged.scenarios = [...custom.scenarios];
    }

    if (custom.resources) {
      merged.resources = { ...base.resources, ...custom.resources };
    }

    if (custom.simulation) {
      merged.simulation = { ...base.simulation, ...custom.simulation };

      if (custom.simulation.realWorldCodebases) {
        merged.simulation.realWorldCodebases = [
          ...custom.simulation.realWorldCodebases,
        ];
      }
      if (custom.simulation.userProfiles) {
        merged.simulation.userProfiles = [...custom.simulation.userProfiles];
      }
      if (custom.simulation.networkConditions) {
        merged.simulation.networkConditions = [
          ...custom.simulation.networkConditions,
        ];
      }
      if (custom.simulation.failureScenarios) {
        merged.simulation.failureScenarios = [
          ...custom.simulation.failureScenarios,
        ];
      }
    }

    if (custom.monitoring) {
      merged.monitoring = { ...base.monitoring, ...custom.monitoring };

      if (custom.monitoring.alerting) {
        merged.monitoring.alerting = {
          ...base.monitoring.alerting,
          ...custom.monitoring.alerting,
        };

        if (custom.monitoring.alerting.thresholds) {
          merged.monitoring.alerting.thresholds = [
            ...custom.monitoring.alerting.thresholds,
          ];
        }
      }
    }

    if (custom.reporting) {
      merged.reporting = { ...base.reporting, ...custom.reporting };
    }

    return merged;
  }

  /**
   * Export configuration to JSON
   */
  public toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Create configuration from JSON
   */
  public static fromJSON(json: string): E2EConfig {
    try {
      const config = JSON.parse(json) as Partial<E2ETestingConfig>;
      return new E2EConfig(config);
    } catch (error) {
      throw new Error(
        `Invalid E2E configuration JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Create E2E configurations with common presets
 */
export class E2EConfigPresets {
  /**
   * Comprehensive testing configuration for production validation
   */
  static comprehensive(): E2EConfig {
    return new E2EConfig({
      scenarios: [
        {
          name: "large-codebase-analysis",
          description: "Analyze enterprise-scale codebase with 10,000+ files",
          enabled: true,
          category: "codebase-analysis",
          timeout: 900000, // 15 minutes
          retries: 2,
          prerequisites: ["cli", "mcp-server"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server"],
        },
        {
          name: "high-concurrency-collaboration",
          description: "Test with 10+ simultaneous users",
          enabled: true,
          category: "collaboration",
          timeout: 1200000, // 20 minutes
          retries: 1,
          prerequisites: ["mcp-server", "vscode-extension"],
          cleanup: true,
          parallel: true,
          environment: ["mcp-server", "vscode-extension"],
        },
        {
          name: "continuous-file-watching",
          description: "Long-running file watching with frequent changes",
          enabled: true,
          category: "incremental-updates",
          timeout: 600000, // 10 minutes
          retries: 2,
          prerequisites: ["cli", "mcp-server"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server"],
        },
        {
          name: "network-failure-recovery",
          description: "Test resilience under network failures",
          enabled: true,
          category: "error-recovery",
          timeout: 480000, // 8 minutes
          retries: 3,
          prerequisites: ["cli", "mcp-server", "vscode-extension"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server", "vscode-extension"],
        },
        {
          name: "memory-leak-detection",
          description: "Long-running test to detect memory leaks",
          enabled: true,
          category: "resource-management",
          timeout: 1800000, // 30 minutes
          retries: 1,
          prerequisites: ["cli", "mcp-server"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server"],
        },
        {
          name: "full-stack-integration",
          description: "Test complete workflow across all components",
          enabled: true,
          category: "cross-component",
          timeout: 720000, // 12 minutes
          retries: 2,
          prerequisites: ["cli", "mcp-server", "vscode-extension"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server", "vscode-extension"],
        },
        {
          name: "production-deployment-simulation",
          description: "Simulate production deployment scenarios",
          enabled: true,
          category: "production-simulation",
          timeout: 600000, // 10 minutes
          retries: 2,
          prerequisites: ["cli", "mcp-server", "vscode-extension"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server", "vscode-extension"],
        },
      ],
      resources: {
        maxMemoryMB: 2048,
        maxCpuPercent: 90,
        maxDiskSpaceMB: 5120,
        maxNetworkBandwidthMB: 200,
        maxConcurrentUsers: 15,
        testDataSizeMB: 1024,
      },
      simulation: {
        realWorldCodebases: [
          {
            name: "enterprise-typescript-monorepo",
            type: "typescript",
            size: "enterprise",
            languages: ["typescript", "javascript", "json"],
            files: 10000,
            complexity: "highly-complex",
            generatedData: true,
          },
          {
            name: "large-python-project",
            type: "python",
            size: "large",
            languages: ["python"],
            files: 5000,
            complexity: "complex",
            generatedData: true,
          },
        ],
        userProfiles: [
          {
            name: "heavy-user",
            type: "developer",
            concurrency: 3,
            actions: ["query", "analyze", "navigate", "modify"],
            thinkTime: 1000,
            sessionDuration: 60,
          },
          {
            name: "architect-user",
            type: "architect",
            concurrency: 2,
            actions: ["analyze", "navigate"],
            thinkTime: 3000,
            sessionDuration: 45,
          },
        ],
        networkConditions: [
          {
            name: "slow-connection",
            bandwidth: 10,
            latency: 100,
            packetLoss: 1,
            jitter: 20,
          },
        ],
        systemLoad: {
          cpuLoad: 50,
          memoryUsage: 70,
          diskIo: 20,
          networkIo: 15,
          backgroundProcesses: 50,
        },
        failureScenarios: [
          {
            name: "intermittent-network",
            type: "network",
            probability: 0.2,
            duration: 10000,
            recovery: "retry",
            impact: "high",
          },
          {
            name: "resource-exhaustion",
            type: "resource",
            probability: 0.1,
            duration: 30000,
            recovery: "graceful-degradation",
            impact: "critical",
          },
        ],
      },
    });
  }

  /**
   * Quick smoke testing configuration
   */
  static smoke(): E2EConfig {
    return new E2EConfig({
      scenarios: [
        {
          name: "basic-functionality-check",
          description: "Quick verification of core functionality",
          enabled: true,
          category: "codebase-analysis",
          timeout: 60000, // 1 minute
          retries: 1,
          prerequisites: ["cli"],
          cleanup: true,
          parallel: false,
          environment: ["cli"],
        },
        {
          name: "component-health-check",
          description: "Verify all components are responsive",
          enabled: true,
          category: "cross-component",
          timeout: 120000, // 2 minutes
          retries: 1,
          prerequisites: ["cli", "mcp-server"],
          cleanup: true,
          parallel: false,
          environment: ["cli", "mcp-server"],
        },
      ],
      resources: {
        maxMemoryMB: 512,
        maxCpuPercent: 50,
        maxDiskSpaceMB: 1024,
        maxNetworkBandwidthMB: 50,
        maxConcurrentUsers: 2,
        testDataSizeMB: 100,
      },
    });
  }

  /**
   * Performance testing configuration
   */
  static performance(): E2EConfig {
    return new E2EConfig({
      scenarios: [
        {
          name: "high-load-stress-test",
          description: "Test system under high load conditions",
          enabled: true,
          category: "resource-management",
          timeout: 600000, // 10 minutes
          retries: 1,
          prerequisites: ["cli", "mcp-server", "vscode-extension"],
          cleanup: true,
          parallel: true,
          environment: ["cli", "mcp-server", "vscode-extension"],
        },
        {
          name: "scalability-limit-test",
          description: "Find system scalability limits",
          enabled: true,
          category: "collaboration",
          timeout: 900000, // 15 minutes
          retries: 1,
          prerequisites: ["mcp-server", "vscode-extension"],
          cleanup: true,
          parallel: true,
          environment: ["mcp-server", "vscode-extension"],
        },
      ],
      resources: {
        maxMemoryMB: 4096,
        maxCpuPercent: 95,
        maxDiskSpaceMB: 8192,
        maxNetworkBandwidthMB: 500,
        maxConcurrentUsers: 50,
        testDataSizeMB: 2048,
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
              value: 3500,
              duration: 60000,
              severity: "warning",
            },
            {
              metric: "response_time_ms",
              operator: "gt",
              value: 2000,
              duration: 30000,
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
    });
  }
}
