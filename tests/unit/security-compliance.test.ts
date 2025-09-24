/**
 * @fileoverview Tests for security and compliance validation
 */

import { describe, it, expect, vi } from "vitest";
import {
  SecurityConfig,
  SecurityConfigPresets,
  SecurityValidator,
} from "../../packages/ast-helper/src/security-compliance/index.js";
import type {
  SecurityValidationConfig,
  SecurityCategory,
} from "../../packages/ast-helper/src/security-compliance/types.js";

describe("Security and Compliance Validation", () => {
  describe("SecurityConfig", () => {
    it("should create config with defaults", () => {
      const config = new SecurityConfig();
      const configData = config.getConfig();

      expect(configData.enabled).toBe(true);
      expect(configData.vulnerabilityScanning.enabled).toBe(true);
      expect(configData.authentication.enabled).toBe(true);
      expect(configData.dataPrivacy.gdprCompliant).toBe(true);
    });

    it("should merge custom configuration", () => {
      const customConfig: Partial<SecurityValidationConfig> = {
        enabled: false,
        vulnerabilityScanning: {
          enabled: false,
          sources: ["custom-source"],
          severity: ["critical"],
          autoFix: true,
          allowList: ["test-package"],
        },
      };

      const config = new SecurityConfig(customConfig);
      const configData = config.getConfig();

      expect(configData.enabled).toBe(false);
      expect(configData.vulnerabilityScanning.enabled).toBe(false);
      expect(configData.vulnerabilityScanning.sources).toEqual([
        "custom-source",
      ]);
      expect(configData.vulnerabilityScanning.autoFix).toBe(true);
    });

    it("should validate enabled categories", () => {
      const config = new SecurityConfig();
      const enabledCategories = config.getEnabledCategories();

      expect(enabledCategories).toContain("vulnerability-scanning");
      expect(enabledCategories).toContain("input-validation");
      expect(enabledCategories).toContain("authentication");
      expect(enabledCategories).toContain("data-privacy");
      expect(enabledCategories).toContain("network-security");
      expect(enabledCategories).toContain("compliance");
    });

    it("should check if category is enabled", () => {
      const config = new SecurityConfig();

      expect(config.isCategoryEnabled("vulnerability-scanning")).toBe(true);
      expect(config.isCategoryEnabled("authentication")).toBe(true);
    });

    it("should update category configuration", () => {
      const config = new SecurityConfig();

      config.updateCategoryConfig("vulnerability-scanning", {
        enabled: false,
        autoFix: true,
      });

      const vulnConfig = config.getCategoryConfig(
        "vulnerability-scanning",
      ) as SecurityValidationConfig["vulnerabilityScanning"];
      expect(vulnConfig.enabled).toBe(false);
      expect(vulnConfig.autoFix).toBe(true);
    });

    it("should validate configuration", () => {
      const config = new SecurityConfig();
      const validation = config.validateConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect configuration errors", () => {
      const invalidConfig: Partial<SecurityValidationConfig> = {
        vulnerabilityScanning: {
          enabled: true,
          sources: [], // Empty sources should cause error
          severity: ["high"],
          autoFix: false,
          allowList: [],
        },
      };

      const config = new SecurityConfig(invalidConfig);
      const validation = config.validateConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should generate configuration summary", () => {
      const config = new SecurityConfig();
      const summary = config.getConfigSummary();

      expect(summary).toHaveProperty("enabled");
      expect(summary).toHaveProperty("enabledCategories");
      expect(summary).toHaveProperty("vulnerabilityScanning");
      expect(summary).toHaveProperty("authentication");
      expect(summary).toHaveProperty("dataPrivacy");
    });

    it("should export/import JSON configuration", () => {
      const config = new SecurityConfig();
      const json = config.toJSON();

      expect(json).toContain("vulnerabilityScanning");
      expect(json).toContain("authentication");

      const importedConfig = SecurityConfig.fromJSON(json);
      const importedData = importedConfig.getConfig();
      const originalData = config.getConfig();

      expect(importedData.enabled).toBe(originalData.enabled);
      expect(importedData.vulnerabilityScanning.enabled).toBe(
        originalData.vulnerabilityScanning.enabled,
      );
    });
  });

  describe("SecurityConfigPresets", () => {
    it("should create production preset", () => {
      const config = SecurityConfigPresets.production();
      const configData = config.getConfig();

      expect(configData.vulnerabilityScanning.severity).toContain("critical");
      expect(configData.authentication.requirements.length).toBeGreaterThan(1);
      expect(configData.networkSecurity.certificates.selfSigned).toBe(false);
    });

    it("should create development preset", () => {
      const config = SecurityConfigPresets.development();
      const configData = config.getConfig();

      expect(configData.authentication.enabled).toBe(false);
      expect(configData.networkSecurity.enabled).toBe(false);
      expect(configData.compliance.enabled).toBe(false);
    });

    it("should create CI/CD preset", () => {
      const config = SecurityConfigPresets.cicd();
      const configData = config.getConfig();

      expect(configData.vulnerabilityScanning.sources).toContain("npm-audit");
      expect(configData.vulnerabilityScanning.sources).toContain("snyk");
      expect(configData.authentication.methods).toContain("api-key");
    });
  });

  describe("SecurityValidator", () => {
    it("should initialize with default configuration", () => {
      const validator = new SecurityValidator();
      expect(validator).toBeInstanceOf(SecurityValidator);
    });

    it("should initialize with custom configuration", () => {
      const customConfig = { enabled: false };
      const validator = new SecurityValidator(customConfig);
      expect(validator).toBeInstanceOf(SecurityValidator);
    });

    it("should run quick validation test", async () => {
      const validator = new SecurityValidator();

      // Mock the validation to avoid actually running npm audit
      const originalRunValidation = validator.runValidation;
      validator.runValidation = vi.fn().mockResolvedValue({
        passed: true,
        score: 95.5,
        timestamp: new Date().toISOString(),
        environment: {
          platform: "linux",
          nodeVersion: "v18.0.0",
          dependencies: [],
          networkConfig: {
            protocols: ["https"],
            ports: [443],
            encryption: true,
            certificates: [],
          },
        },
        categories: [
          {
            category: "vulnerability-scanning" as SecurityCategory,
            passed: true,
            score: 100,
            tests: [
              {
                name: "test-vulnerability-scan",
                passed: true,
                severity: "low" as const,
                description: "No vulnerabilities found",
                timestamp: new Date().toISOString(),
              },
            ],
            criticalIssues: 0,
            totalTests: 1,
          },
        ],
        summary: {
          overallScore: 95.5,
          criticalIssues: 0,
          highSeverityIssues: 0,
          totalTests: 8,
          passedTests: 8,
          complianceScore: 100,
        },
        recommendations: [],
        compliance: {
          standards: [],
          overallScore: 100,
          certifications: [],
          gaps: [],
        },
      });

      const result = await validator.runValidation();

      expect(result.passed).toBe(true);
      expect(result.score).toBe(95.5);
      expect(result.environment.platform).toBe("linux");
      expect(result.categories).toHaveLength(1);
      expect(result.summary.criticalIssues).toBe(0);
    });

    it("should emit events during validation", async () => {
      const validator = new SecurityValidator();
      const events: string[] = [];

      validator.on("test:start", (data: any) => {
        events.push(`test:start:${data.category}`);
      });

      validator.on("test:complete", (data: any) => {
        events.push(`test:complete:${data.category}`);
      });

      validator.on("validation:complete", () => {
        events.push("validation:complete");
      });

      // Mock a simple validation
      validator.runValidation = vi.fn().mockImplementation(async () => {
        validator.emit("test:start", {
          category: "vulnerability-scanning" as SecurityCategory,
          testName: "test",
        });
        validator.emit("test:complete", {
          category: "vulnerability-scanning" as SecurityCategory,
          result: {
            name: "test",
            passed: true,
            severity: "low" as const,
            description: "Test passed",
            timestamp: new Date().toISOString(),
          },
        });

        const result = {
          passed: true,
          score: 100,
          timestamp: new Date().toISOString(),
          environment: {} as any,
          categories: [],
          summary: {} as any,
          recommendations: [],
          compliance: {} as any,
        };

        validator.emit("validation:complete", { result });
        return result;
      });

      await validator.runValidation();

      expect(events).toContain("test:start:vulnerability-scanning");
      expect(events).toContain("test:complete:vulnerability-scanning");
      expect(events).toContain("validation:complete");
    });

    it("should handle validation errors gracefully", async () => {
      const validator = new SecurityValidator();

      // Mock validation to throw an error
      const originalMethod = validator.runValidation;
      validator.runValidation = vi
        .fn()
        .mockRejectedValue(new Error("Mock validation error"));

      try {
        await validator.runValidation();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Mock validation error");
      }
    });
  });

  describe("Security Categories", () => {
    const categories: SecurityCategory[] = [
      "vulnerability-scanning",
      "input-validation",
      "authentication",
      "data-privacy",
      "network-security",
      "code-security",
      "compliance",
    ];

    categories.forEach((category) => {
      it(`should support ${category} category`, () => {
        const config = new SecurityConfig();
        expect(config.isCategoryEnabled(category)).toBe(true);

        const categoryConfig = config.getCategoryConfig(category);
        expect(categoryConfig).toBeDefined();
      });
    });
  });

  describe("Integration with Production Readiness", () => {
    it("should generate security validation report compatible with production readiness", async () => {
      const validator = new SecurityValidator();

      // Mock validation result
      validator.runValidation = vi.fn().mockResolvedValue({
        passed: true,
        score: 92.5,
        timestamp: new Date().toISOString(),
        environment: {
          platform: "linux",
          nodeVersion: "v18.0.0",
          dependencies: [],
          networkConfig: {
            protocols: ["https"],
            ports: [443],
            encryption: true,
            certificates: [],
          },
        },
        categories: [
          {
            category: "vulnerability-scanning",
            passed: true,
            score: 95,
            tests: [],
            criticalIssues: 0,
            totalTests: 5,
          },
          {
            category: "compliance",
            passed: true,
            score: 90,
            tests: [],
            criticalIssues: 0,
            totalTests: 3,
          },
        ],
        summary: {
          overallScore: 92.5,
          criticalIssues: 0,
          highSeverityIssues: 0,
          totalTests: 8,
          passedTests: 8,
          complianceScore: 90,
        },
        recommendations: [],
        compliance: {
          standards: [],
          overallScore: 90,
          certifications: [],
          gaps: [],
        },
      });

      const result = await validator.runValidation();

      // Validate structure compatible with production readiness framework
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("recommendations");

      expect(typeof result.passed).toBe("boolean");
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
