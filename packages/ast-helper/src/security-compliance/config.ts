/**
 * @fileoverview Security and compliance validation configuration
 */

import type { SecurityValidationConfig, SecurityCategory } from "./types.js";
import { DEFAULT_SECURITY_CONFIG } from "./types.js";

/**
 * Security validation configuration with production-ready defaults
 */
export class SecurityConfig {
  private config: SecurityValidationConfig;

  constructor(customConfig: Partial<SecurityValidationConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_SECURITY_CONFIG, customConfig);
  }

  /**
   * Get the complete configuration
   */
  public getConfig(): SecurityValidationConfig {
    return { ...this.config };
  }

  /**
   * Get configuration for a specific security category
   */
  public getCategoryConfig(category: SecurityCategory): unknown {
    switch (category) {
      case "vulnerability-scanning":
        return this.config.vulnerabilityScanning;
      case "input-validation":
        return this.config.inputValidation;
      case "authentication":
        return this.config.authentication;
      case "data-privacy":
        return this.config.dataPrivacy;
      case "network-security":
        return this.config.networkSecurity;
      case "compliance":
        return this.config.compliance;
      case "code-security":
        // Code security uses general config for now
        return { enabled: this.config.enabled };
      default:
        throw new Error(`Unknown security category: ${category}`);
    }
  }

  /**
   * Update configuration for a specific category
   */
  public updateCategoryConfig(
    category: SecurityCategory,
    updates: Record<string, unknown>,
  ): void {
    const currentConfig = this.getCategoryConfig(category);
    const updatedConfig = {
      ...(typeof currentConfig === "object" && currentConfig !== null
        ? currentConfig
        : {}),
      ...updates,
    };

    switch (category) {
      case "vulnerability-scanning":
        this.config.vulnerabilityScanning =
          updatedConfig as SecurityValidationConfig["vulnerabilityScanning"];
        break;
      case "input-validation":
        this.config.inputValidation =
          updatedConfig as SecurityValidationConfig["inputValidation"];
        break;
      case "authentication":
        this.config.authentication =
          updatedConfig as SecurityValidationConfig["authentication"];
        break;
      case "data-privacy":
        this.config.dataPrivacy =
          updatedConfig as SecurityValidationConfig["dataPrivacy"];
        break;
      case "network-security":
        this.config.networkSecurity =
          updatedConfig as SecurityValidationConfig["networkSecurity"];
        break;
      case "compliance":
        this.config.compliance =
          updatedConfig as SecurityValidationConfig["compliance"];
        break;
      case "code-security":
        // Handle code security updates
        if (typeof updatedConfig.enabled === "boolean") {
          this.config.enabled = updatedConfig.enabled;
        }
        break;
    }
  }

  /**
   * Check if a security category is enabled
   */
  public isCategoryEnabled(category: SecurityCategory): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const categoryConfig = this.getCategoryConfig(category);
    if (
      typeof categoryConfig === "object" &&
      categoryConfig !== null &&
      "enabled" in categoryConfig
    ) {
      return Boolean(categoryConfig.enabled);
    }

    return this.config.enabled;
  }

  /**
   * Get all enabled categories
   */
  public getEnabledCategories(): SecurityCategory[] {
    const allCategories: SecurityCategory[] = [
      "vulnerability-scanning",
      "input-validation",
      "authentication",
      "data-privacy",
      "network-security",
      "code-security",
      "compliance",
    ];

    return allCategories.filter((category) => this.isCategoryEnabled(category));
  }

  /**
   * Validate the current configuration
   */
  public validateConfig(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate vulnerability scanning config
    if (this.config.vulnerabilityScanning.enabled) {
      if (!this.config.vulnerabilityScanning.sources.length) {
        errors.push(
          "Vulnerability scanning is enabled but no sources configured",
        );
      }
      if (!this.config.vulnerabilityScanning.severity.length) {
        warnings.push(
          "No severity levels configured for vulnerability scanning",
        );
      }
    }

    // Validate authentication config
    if (this.config.authentication.enabled) {
      if (!this.config.authentication.methods.length) {
        errors.push("Authentication is enabled but no methods configured");
      }
      if (this.config.authentication.tokenExpiry < 300000) {
        // 5 minutes
        warnings.push(
          "Token expiry is set to less than 5 minutes, which may cause usability issues",
        );
      }
    }

    // Validate data privacy config
    if (this.config.dataPrivacy.enabled) {
      if (
        this.config.dataPrivacy.dataRetention.enabled &&
        this.config.dataPrivacy.dataRetention.defaultRetention < 1
      ) {
        errors.push(
          "Data retention is enabled but default retention is less than 1 day",
        );
      }
    }

    // Validate network security config
    if (this.config.networkSecurity.enabled) {
      if (!this.config.networkSecurity.protocols.length) {
        warnings.push(
          "Network security is enabled but no secure protocols configured",
        );
      }
      if (this.config.networkSecurity.encryption.keySize < 128) {
        errors.push(
          "Encryption key size is less than 128 bits, which is not secure",
        );
      }
    }

    // Validate compliance config
    if (this.config.compliance.enabled) {
      if (!this.config.compliance.standards.length) {
        warnings.push("Compliance is enabled but no standards configured");
      }
      if (this.config.compliance.auditing.retention < 365) {
        warnings.push(
          "Audit log retention is less than 1 year, which may not meet compliance requirements",
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
   * Get configuration summary for reporting
   */
  public getConfigSummary(): Record<string, unknown> {
    return {
      enabled: this.config.enabled,
      enabledCategories: this.getEnabledCategories(),
      vulnerabilityScanning: {
        enabled: this.config.vulnerabilityScanning.enabled,
        sources: this.config.vulnerabilityScanning.sources.length,
        autoFix: this.config.vulnerabilityScanning.autoFix,
      },
      authentication: {
        enabled: this.config.authentication.enabled,
        methods: this.config.authentication.methods,
        tokenExpiry: this.config.authentication.tokenExpiry,
      },
      dataPrivacy: {
        enabled: this.config.dataPrivacy.enabled,
        gdprCompliant: this.config.dataPrivacy.gdprCompliant,
        retention: this.config.dataPrivacy.dataRetention.enabled,
      },
      networkSecurity: {
        enabled: this.config.networkSecurity.enabled,
        encryption: this.config.networkSecurity.encryption.enabled,
        protocols: this.config.networkSecurity.protocols,
      },
      compliance: {
        enabled: this.config.compliance.enabled,
        standards: this.config.compliance.standards,
        auditing: this.config.compliance.auditing.enabled,
      },
    };
  }

  /**
   * Deep merge configurations
   */
  private mergeConfig(
    base: SecurityValidationConfig,
    custom: Partial<SecurityValidationConfig>,
  ): SecurityValidationConfig {
    const merged = { ...base };

    if (custom.enabled !== undefined) {
      merged.enabled = custom.enabled;
    }

    if (custom.vulnerabilityScanning) {
      merged.vulnerabilityScanning = {
        ...base.vulnerabilityScanning,
        ...custom.vulnerabilityScanning,
      };
    }

    if (custom.inputValidation) {
      merged.inputValidation = {
        ...base.inputValidation,
        ...custom.inputValidation,
      };
      if (custom.inputValidation.sanitization) {
        merged.inputValidation.sanitization = {
          ...base.inputValidation.sanitization,
          ...custom.inputValidation.sanitization,
        };
      }
      if (custom.inputValidation.validation) {
        merged.inputValidation.validation = {
          ...base.inputValidation.validation,
          ...custom.inputValidation.validation,
        };
      }
    }

    if (custom.authentication) {
      merged.authentication = {
        ...base.authentication,
        ...custom.authentication,
      };
    }

    if (custom.dataPrivacy) {
      merged.dataPrivacy = { ...base.dataPrivacy, ...custom.dataPrivacy };
      if (custom.dataPrivacy.dataRetention) {
        merged.dataPrivacy.dataRetention = {
          ...base.dataPrivacy.dataRetention,
          ...custom.dataPrivacy.dataRetention,
        };
      }
      if (custom.dataPrivacy.anonymization) {
        merged.dataPrivacy.anonymization = {
          ...base.dataPrivacy.anonymization,
          ...custom.dataPrivacy.anonymization,
        };
      }
    }

    if (custom.networkSecurity) {
      merged.networkSecurity = {
        ...base.networkSecurity,
        ...custom.networkSecurity,
      };
      if (custom.networkSecurity.encryption) {
        merged.networkSecurity.encryption = {
          ...base.networkSecurity.encryption,
          ...custom.networkSecurity.encryption,
        };
      }
      if (custom.networkSecurity.certificates) {
        merged.networkSecurity.certificates = {
          ...base.networkSecurity.certificates,
          ...custom.networkSecurity.certificates,
        };
      }
    }

    if (custom.compliance) {
      merged.compliance = { ...base.compliance, ...custom.compliance };
      if (custom.compliance.auditing) {
        merged.compliance.auditing = {
          ...base.compliance.auditing,
          ...custom.compliance.auditing,
        };
      }
      if (custom.compliance.reporting) {
        merged.compliance.reporting = {
          ...base.compliance.reporting,
          ...custom.compliance.reporting,
        };
      }
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
  public static fromJSON(json: string): SecurityConfig {
    try {
      const config = JSON.parse(json) as Partial<SecurityValidationConfig>;
      return new SecurityConfig(config);
    } catch (error) {
      throw new Error(
        `Invalid security configuration JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Create a security configuration with common presets
 */
export class SecurityConfigPresets {
  /**
   * High security configuration for production environments
   */
  static production(): SecurityConfig {
    return new SecurityConfig({
      vulnerabilityScanning: {
        enabled: true,
        sources: ["npm-audit", "snyk", "owasp"],
        severity: ["high", "critical"],
        autoFix: false,
        allowList: [],
      },
      authentication: {
        enabled: true,
        methods: ["token"],
        tokenExpiry: 3600000, // 1 hour
        requirements: [
          {
            type: "password-strength",
            config: { minLength: 12, requireSpecialChars: true },
          },
          {
            type: "mfa",
            config: { required: true },
          },
        ],
      },
      networkSecurity: {
        enabled: true,
        encryption: {
          enabled: true,
          algorithm: "AES-256-GCM",
          keySize: 256,
          transport: true,
          atRest: true,
        },
        protocols: ["https", "tls"],
        certificates: {
          enabled: true,
          validation: true,
          expiration: true,
          selfSigned: false,
        },
      },
      compliance: {
        enabled: true,
        standards: ["gdpr", "iso27001"],
        auditing: {
          enabled: true,
          events: ["login", "data-access", "permission-change", "system-error"],
          retention: 2555, // 7 years
          encryption: true,
        },
        reporting: {
          enabled: true,
          frequency: "weekly",
          recipients: [],
          format: ["json", "html", "pdf"],
        },
      },
    });
  }

  /**
   * Development environment configuration with relaxed security
   */
  static development(): SecurityConfig {
    return new SecurityConfig({
      vulnerabilityScanning: {
        enabled: true,
        sources: ["npm-audit"],
        severity: ["critical"],
        autoFix: false,
        allowList: [],
      },
      authentication: {
        enabled: false,
        methods: ["token"],
        tokenExpiry: 86400000, // 24 hours
        requirements: [],
      },
      networkSecurity: {
        enabled: false,
        encryption: {
          enabled: false,
          algorithm: "AES-256-GCM",
          keySize: 256,
          transport: false,
          atRest: false,
        },
        protocols: ["https"],
        certificates: {
          enabled: false,
          validation: false,
          expiration: false,
          selfSigned: true,
        },
      },
      compliance: {
        enabled: false,
        standards: [],
        auditing: {
          enabled: false,
          events: [],
          retention: 30,
          encryption: false,
        },
        reporting: {
          enabled: false,
          frequency: "monthly",
          recipients: [],
          format: ["json"],
        },
      },
    });
  }

  /**
   * CI/CD pipeline configuration for automated testing
   */
  static cicd(): SecurityConfig {
    return new SecurityConfig({
      vulnerabilityScanning: {
        enabled: true,
        sources: ["npm-audit", "snyk"],
        severity: ["medium", "high", "critical"],
        autoFix: false,
        allowList: [],
      },
      inputValidation: {
        enabled: true,
        strictMode: true,
        sanitization: {
          enabled: true,
          methods: ["html-escape", "sql-escape", "xss-filter"],
          customRules: [],
        },
        validation: {
          enabled: true,
          rules: [],
          customValidators: [],
        },
      },
      authentication: {
        enabled: true,
        methods: ["api-key"],
        tokenExpiry: 3600000,
        requirements: [],
      },
      compliance: {
        enabled: true,
        standards: ["gdpr"],
        auditing: {
          enabled: true,
          events: ["data-access"],
          retention: 90,
          encryption: true,
        },
        reporting: {
          enabled: true,
          frequency: "weekly",
          recipients: [],
          format: ["json"],
        },
      },
    });
  }
}
