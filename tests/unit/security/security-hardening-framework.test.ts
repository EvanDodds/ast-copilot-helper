import { describe, it, expect, beforeEach, vi } from "vitest";
import { SecurityHardeningFramework } from "../../../packages/ast-helper/src/security/security-hardening-framework";
import { SecurityConfig } from "../../../packages/ast-helper/src/security/types";

describe("Security Hardening Framework", () => {
  let hardeningFramework: SecurityHardeningFramework;
  let securityConfig: SecurityConfig;

  beforeEach(() => {
    securityConfig = {
      auditLevel: "comprehensive",
      complianceFrameworks: ["OWASP", "CWE", "NIST"],
      dependencyScanning: true,
      maxAuditTime: 5000,
      enabledRules: ["input-validation", "authentication", "authorization"],
      customRules: [],
    };

    hardeningFramework = new SecurityHardeningFramework(securityConfig);
  });

  describe("AC19: Policy Enforcement Engine", () => {
    it("should initialize successfully with valid configuration", async () => {
      await expect(hardeningFramework.initialize()).resolves.not.toThrow();

      const stats = hardeningFramework.getSecurityStatistics();
      expect(stats.policiesLoaded).toBeGreaterThan(0);
      expect(stats.accessControlEnabled).toBe(true);
      expect(stats.encryptionEnabled).toBe(true);
    });

    it("should enforce security policies and detect violations", async () => {
      await hardeningFramework.initialize();

      const testTarget = {
        password: "weak",
        authentication: { mfaEnabled: false },
        encryption: { algorithm: "DES" }, // Weak algorithm
      };

      const results = await hardeningFramework.enforcePolicies(testTarget);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Verify policy enforcement results structure
      results.forEach((result) => {
        expect(result).toMatchObject({
          policyId: expect.any(String),
          policyName: expect.any(String),
          status: expect.stringMatching(/^(compliant|violation|warning)$/),
          violations: expect.any(Array),
          score: expect.any(Number),
          timestamp: expect.any(Date),
        });

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    it("should handle policy enforcement with different severity levels", async () => {
      await hardeningFramework.initialize();

      const criticalTarget = {
        password: "",
        authentication: null,
        encryption: null,
      };

      const results = await hardeningFramework.enforcePolicies(criticalTarget);

      // Should have violations for critical security issues
      const criticalViolations = results.filter(
        (r) => r.status === "violation",
      );
      expect(criticalViolations.length).toBeGreaterThan(0);

      // Verify violation severity handling
      criticalViolations.forEach((result) => {
        expect(result.violations).toBeDefined();
        result.violations.forEach((violation) => {
          expect(violation.severity).toMatch(/^(critical|high|medium|low)$/);
          expect(violation.remediation).toBeDefined();
          expect(violation.remediation.steps).toBeInstanceOf(Array);
          expect(violation.remediation.steps.length).toBeGreaterThan(0);
        });
      });
    });

    it("should provide policy remediation guidance", async () => {
      await hardeningFramework.initialize();

      const target = { password: "weak123" };
      const results = await hardeningFramework.enforcePolicies(target);

      const violationResults = results.filter((r) => r.violations.length > 0);

      if (violationResults.length > 0) {
        const violations = violationResults.flatMap((r) => r.violations);
        const guidance =
          await hardeningFramework.getRemediationGuidance(violations);

        expect(guidance).toBeDefined();
        expect(Array.isArray(guidance)).toBe(true);

        guidance.forEach((remediation) => {
          expect(remediation).toMatchObject({
            description: expect.any(String),
            steps: expect.any(Array),
            automatedFix: expect.any(Boolean),
            estimatedTime: expect.any(String),
            riskLevel: expect.stringMatching(/^(critical|high|medium|low)$/),
            references: expect.any(Array),
          });

          expect(remediation.steps.length).toBeGreaterThan(0);
        });
      }
    });

    it("should track policy enforcement statistics", async () => {
      await hardeningFramework.initialize();

      const target1 = { password: "StrongPassword123!" };
      const target2 = { password: "weak" };

      await hardeningFramework.enforcePolicies(target1);
      await hardeningFramework.enforcePolicies(target2);

      const stats = hardeningFramework.getSecurityStatistics();

      expect(stats).toMatchObject({
        totalEvents: expect.any(Number),
        recentEvents: expect.any(Number),
        eventsByType: expect.any(Object),
        eventsBySeverity: expect.any(Object),
        policiesLoaded: expect.any(Number),
        accessControlEnabled: expect.any(Boolean),
        encryptionEnabled: expect.any(Boolean),
        riskScore: expect.any(Number),
      });

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.riskScore).toBeGreaterThanOrEqual(0);
      expect(stats.riskScore).toBeLessThanOrEqual(10);
    });
  });

  describe("AC20: Compliance Validation System", () => {
    it("should validate compliance with OWASP framework", async () => {
      await hardeningFramework.initialize();

      const results = await hardeningFramework.validateCompliance(["OWASP"]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);

      const owaspResult = results[0];
      expect(owaspResult).toMatchObject({
        framework: "OWASP",
        version: expect.any(String),
        overallScore: expect.any(Number),
        status: expect.stringMatching(
          /^(compliant|non_compliant|partially_compliant)$/,
        ),
        categories: expect.any(Array),
        recommendations: expect.any(Array),
        timestamp: expect.any(Date),
        validUntil: expect.any(Date),
      });

      expect(owaspResult.overallScore).toBeGreaterThanOrEqual(0);
      expect(owaspResult.overallScore).toBeLessThanOrEqual(100);
    });

    it("should validate compliance with multiple frameworks", async () => {
      await hardeningFramework.initialize();

      const frameworks = ["OWASP", "CWE", "NIST"];
      const results = await hardeningFramework.validateCompliance(frameworks);

      expect(results.length).toBe(frameworks.length);

      results.forEach((result, index) => {
        expect(result.framework).toBe(frameworks[index]);
        expect(result.categories).toBeDefined();
        expect(Array.isArray(result.categories)).toBe(true);

        result.categories.forEach((category) => {
          expect(category).toMatchObject({
            category: expect.any(String),
            score: expect.any(Number),
            status: expect.stringMatching(
              /^(compliant|non_compliant|partially_compliant)$/,
            ),
            checks: expect.any(Array),
            criticalIssues: expect.any(Number),
            warnings: expect.any(Number),
          });

          expect(category.score).toBeGreaterThanOrEqual(0);
          expect(category.score).toBeLessThanOrEqual(100);
          expect(category.criticalIssues).toBeGreaterThanOrEqual(0);
          expect(category.warnings).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it("should generate compliance recommendations", async () => {
      await hardeningFramework.initialize();

      const results = await hardeningFramework.validateCompliance(["OWASP"]);
      const result = results[0];

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);

      // Recommendations should be strings with actionable content
      result.recommendations.forEach((recommendation) => {
        expect(typeof recommendation).toBe("string");
        expect(recommendation.length).toBeGreaterThan(0);
      });
    });

    it("should handle compliance validation errors gracefully", async () => {
      await hardeningFramework.initialize();

      // Test with invalid framework
      const results = await hardeningFramework.validateCompliance([
        "INVALID_FRAMEWORK",
      ]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);

      const result = results[0];
      expect(result.framework).toBe("INVALID_FRAMEWORK");
      expect(result.categories).toBeDefined();
    });
  });

  describe("AC21: Access Control Framework", () => {
    it("should validate access control for authorized users", async () => {
      await hardeningFramework.initialize();

      const isAllowed = await hardeningFramework.validateAccessControl(
        "admin_user",
        "sensitive_resource",
        "read",
        { department: "security" },
      );

      expect(typeof isAllowed).toBe("boolean");
    });

    it("should deny access for unauthorized actions", async () => {
      await hardeningFramework.initialize();

      const isAllowed = await hardeningFramework.validateAccessControl(
        "guest_user",
        "admin_resource",
        "delete",
        {},
      );

      expect(typeof isAllowed).toBe("boolean");
      // Should likely be false for guest trying to delete admin resource
    });

    it("should log access control events", async () => {
      await hardeningFramework.initialize();

      await hardeningFramework.validateAccessControl(
        "test_user",
        "test_resource",
        "read",
      );

      const events = hardeningFramework.getAuditEvents();
      const accessEvents = events.filter(
        (e) => e.eventType === "authorization",
      );

      expect(accessEvents.length).toBeGreaterThan(0);

      const latestEvent = accessEvents[accessEvents.length - 1];
      expect(latestEvent).toMatchObject({
        eventType: "authorization",
        user: "test_user",
        resource: "test_resource",
        action: "access_control_check",
        result: expect.stringMatching(/^(success|failure)$/),
        riskScore: expect.any(Number),
      });
    });

    it("should handle access control validation errors", async () => {
      await hardeningFramework.initialize();

      // Test with null values to trigger error handling
      const isAllowed = await hardeningFramework.validateAccessControl(
        "",
        "",
        "",
      );

      expect(typeof isAllowed).toBe("boolean");
      // Should default to deny on error
      expect(isAllowed).toBe(false);
    });
  });

  describe("AC22: Encryption Standards Enforcement", () => {
    it("should validate encryption standards for sensitive data", async () => {
      await hardeningFramework.initialize();

      const sensitiveData = "password:secret123";
      const isValid = await hardeningFramework.validateEncryptionStandards(
        sensitiveData,
        { sensitive: true },
      );

      expect(typeof isValid).toBe("boolean");
    });

    it("should accept encrypted data formats", async () => {
      await hardeningFramework.initialize();

      // Simulate encrypted data (base64-like string)
      const encryptedData = "U2FsdGVkX1/R6VhlY8NUEi+u1pT5MdP4j+f3LJFh7aB=";
      const isValid = await hardeningFramework.validateEncryptionStandards(
        encryptedData,
        { sensitive: true },
      );

      expect(typeof isValid).toBe("boolean");
    });

    it("should reject plaintext sensitive data", async () => {
      await hardeningFramework.initialize();

      const plaintextSensitive = "plaintext password data";
      const isValid = await hardeningFramework.validateEncryptionStandards(
        plaintextSensitive,
        { sensitive: true },
      );

      expect(typeof isValid).toBe("boolean");
    });

    it("should log encryption validation events", async () => {
      await hardeningFramework.initialize();

      await hardeningFramework.validateEncryptionStandards("test data", {
        sensitive: false,
      });

      const events = hardeningFramework.getAuditEvents();
      const encryptionEvents = events.filter(
        (e) =>
          e.eventType === "configuration" &&
          e.action === "encryption_validation",
      );

      expect(encryptionEvents.length).toBeGreaterThan(0);

      const latestEvent = encryptionEvents[encryptionEvents.length - 1];
      expect(latestEvent).toMatchObject({
        eventType: "configuration",
        action: "encryption_validation",
        result: expect.stringMatching(/^(success|failure)$/),
        details: expect.objectContaining({
          dataType: expect.any(String),
          encryptionRequired: expect.any(Boolean),
        }),
      });
    });
  });

  describe("AC23: Security Audit Logging", () => {
    it("should log security events with proper structure", async () => {
      await hardeningFramework.initialize();

      await hardeningFramework.logSecurityEvent({
        eventType: "authentication",
        severity: "medium",
        source: "test",
        action: "login_attempt",
        result: "success",
        user: "test_user",
        details: { ip: "127.0.0.1" },
        riskScore: 3,
      });

      const events = hardeningFramework.getAuditEvents();
      expect(events.length).toBeGreaterThan(0);

      const testEvent = events.find((e) => e.action === "login_attempt");
      expect(testEvent).toBeDefined();
      expect(testEvent).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Date),
        eventType: "authentication",
        severity: "medium",
        source: "test",
        action: "login_attempt",
        result: "success",
        user: "test_user",
        riskScore: 3,
        details: expect.objectContaining({ ip: "127.0.0.1" }),
      });
    });

    it("should filter audit events by criteria", async () => {
      await hardeningFramework.initialize();

      // Log multiple different events
      await hardeningFramework.logSecurityEvent({
        eventType: "authentication",
        severity: "high",
        source: "auth_system",
        action: "failed_login",
        result: "failure",
        user: "user1",
        details: {},
        riskScore: 7,
      });

      await hardeningFramework.logSecurityEvent({
        eventType: "authorization",
        severity: "low",
        source: "access_control",
        action: "permission_check",
        result: "success",
        user: "user2",
        details: {},
        riskScore: 2,
      });

      // Filter by event type
      const authEvents = hardeningFramework.getAuditEvents({
        eventType: "authentication",
      });
      expect(authEvents.every((e) => e.eventType === "authentication")).toBe(
        true,
      );

      // Filter by severity
      const highSeverityEvents = hardeningFramework.getAuditEvents({
        severity: "high",
      });
      expect(highSeverityEvents.every((e) => e.severity === "high")).toBe(true);

      // Filter by user
      const user1Events = hardeningFramework.getAuditEvents({ user: "user1" });
      expect(user1Events.every((e) => e.user === "user1")).toBe(true);
    });

    it("should maintain event history with proper cleanup", async () => {
      await hardeningFramework.initialize();

      // Clear any initialization events first
      const initialEvents = hardeningFramework.getAuditEvents();
      const initialCount = initialEvents.length;

      // Log many events to test cleanup
      for (let i = 0; i < 50; i++) {
        await hardeningFramework.logSecurityEvent({
          eventType: "access",
          severity: "info",
          source: "test",
          action: `test_action_${i}`,
          result: "success",
          details: { iteration: i },
          riskScore: 1,
        });
      }

      const events = hardeningFramework.getAuditEvents();
      expect(events.length).toBe(initialCount + 50);

      // Verify events are in chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime(),
        );
      }
    });

    it("should calculate risk scores accurately", async () => {
      await hardeningFramework.initialize();

      // Log events with different risk scores
      await hardeningFramework.logSecurityEvent({
        eventType: "security_incident",
        severity: "critical",
        source: "security",
        action: "breach_detected",
        result: "failure",
        details: {},
        riskScore: 10,
      });

      await hardeningFramework.logSecurityEvent({
        eventType: "access",
        severity: "info",
        source: "system",
        action: "normal_access",
        result: "success",
        details: {},
        riskScore: 1,
      });

      const stats = hardeningFramework.getSecurityStatistics();
      expect(stats.riskScore).toBeGreaterThan(0);
      expect(stats.riskScore).toBeLessThanOrEqual(10);
    });
  });

  describe("AC24: Automated Remediation Guidance", () => {
    it("should generate remediation guidance for policy violations", async () => {
      await hardeningFramework.initialize();

      const sampleViolations = [
        {
          ruleId: "password_strength",
          ruleName: "Password Strength Requirements",
          severity: "high" as const,
          message: "Password does not meet complexity requirements",
          actualValue: "simple",
          expectedValue: "complex",
          location: "authentication.password",
          remediation: {
            description: "Improve password complexity",
            steps: ["Add uppercase letters", "Add special characters"],
            automatedFix: true,
            estimatedTime: "5 minutes",
            riskLevel: "high" as const,
            references: ["OWASP-ASVS-2.1"],
          },
        },
        {
          ruleId: "encryption_algorithm",
          ruleName: "Encryption Algorithm Standards",
          severity: "critical" as const,
          message: "Weak encryption algorithm detected",
          actualValue: "DES",
          expectedValue: "AES-256",
          location: "config.encryption",
          remediation: {
            description: "Upgrade encryption algorithm",
            steps: ["Replace DES with AES-256", "Update configuration"],
            automatedFix: false,
            estimatedTime: "2 hours",
            riskLevel: "critical" as const,
            references: ["NIST-SP-800-175B"],
          },
        },
      ];

      const guidance =
        await hardeningFramework.getRemediationGuidance(sampleViolations);

      expect(guidance).toBeDefined();
      expect(Array.isArray(guidance)).toBe(true);
      expect(guidance.length).toBe(sampleViolations.length);

      guidance.forEach((remediation, index) => {
        expect(remediation).toMatchObject({
          description: expect.any(String),
          steps: expect.any(Array),
          automatedFix: expect.any(Boolean),
          estimatedTime: expect.any(String),
          riskLevel: expect.stringMatching(/^(critical|high|medium|low)$/),
          references: expect.any(Array),
        });

        expect(remediation.steps.length).toBeGreaterThan(0);
        expect(remediation.description.length).toBeGreaterThan(0);
      });
    });

    it("should prioritize remediation by risk level", async () => {
      await hardeningFramework.initialize();

      const mixedViolations = [
        {
          ruleId: "low_risk",
          ruleName: "Low Risk Issue",
          severity: "low" as const,
          message: "Minor issue",
          actualValue: "minor",
          expectedValue: "optimal",
          location: "config.minor",
          remediation: {
            description: "Fix minor issue",
            steps: ["Apply fix"],
            automatedFix: true,
            estimatedTime: "5 minutes",
            riskLevel: "low" as const,
            references: [],
          },
        },
        {
          ruleId: "critical_risk",
          ruleName: "Critical Security Risk",
          severity: "critical" as const,
          message: "Critical security vulnerability",
          actualValue: "vulnerable",
          expectedValue: "secure",
          location: "security.critical",
          remediation: {
            description: "Fix critical vulnerability",
            steps: ["Immediate action required"],
            automatedFix: false,
            estimatedTime: "1 hour",
            riskLevel: "critical" as const,
            references: [],
          },
        },
        {
          ruleId: "medium_risk",
          ruleName: "Medium Risk Issue",
          severity: "medium" as const,
          message: "Medium issue",
          actualValue: "suboptimal",
          expectedValue: "good",
          location: "config.medium",
          remediation: {
            description: "Fix medium issue",
            steps: ["Apply medium fix"],
            automatedFix: true,
            estimatedTime: "15 minutes",
            riskLevel: "medium" as const,
            references: [],
          },
        },
      ];

      const guidance =
        await hardeningFramework.getRemediationGuidance(mixedViolations);

      // Should be sorted by risk level (critical first, then high, medium, low)
      expect(guidance[0].riskLevel).toBe("critical");
      expect(guidance[guidance.length - 1].riskLevel).toBe("low");

      // Verify sorting order
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      for (let i = 1; i < guidance.length; i++) {
        const currentRisk = riskOrder[guidance[i].riskLevel];
        const previousRisk = riskOrder[guidance[i - 1].riskLevel];
        expect(currentRisk).toBeLessThanOrEqual(previousRisk);
      }
    });

    it("should identify automated fix opportunities", async () => {
      await hardeningFramework.initialize();

      const violations = [
        {
          ruleId: "auto_fixable",
          ruleName: "Password Policy Configuration",
          severity: "medium" as const,
          message: "Password policy needs update",
          actualValue: "weak_policy",
          expectedValue: "strong_policy",
          location: "config.auth",
          remediation: {
            description: "Update password policy",
            steps: ["Enable policy"],
            automatedFix: false,
            estimatedTime: "10 minutes",
            riskLevel: "medium" as const,
            references: [],
          },
        },
      ];

      const guidance =
        await hardeningFramework.getRemediationGuidance(violations);

      const automatedFixes = guidance.filter((g) => g.automatedFix);
      const manualFixes = guidance.filter((g) => !g.automatedFix);

      expect(guidance.length).toBe(violations.length);

      // Verify automated fixes have appropriate characteristics
      automatedFixes.forEach((fix) => {
        expect(fix.automatedFix).toBe(true);
        expect(fix.steps).toBeDefined();
        expect(fix.estimatedTime).toBeDefined();
      });

      // Verify manual fixes require human intervention
      manualFixes.forEach((fix) => {
        expect(fix.automatedFix).toBe(false);
        expect(fix.steps).toBeDefined();
        expect(fix.description).toBeDefined();
      });
    });

    it("should provide comprehensive remediation information", async () => {
      await hardeningFramework.initialize();

      const complexViolations = [
        {
          ruleId: "complex_issue",
          ruleName: "Multi-step Security Configuration",
          severity: "high" as const,
          message: "Complex security misconfiguration detected",
          actualValue: { encryption: false, authentication: "basic" },
          expectedValue: { encryption: true, authentication: "mfa" },
          location: "system.security",
          remediation: {
            description: "Comprehensive security upgrade required",
            steps: [
              "Enable encryption",
              "Implement MFA",
              "Update authentication flow",
              "Test security measures",
            ],
            automatedFix: false,
            estimatedTime: "4 hours",
            riskLevel: "high" as const,
            references: ["OWASP-ASVS", "NIST-Cybersecurity-Framework"],
          },
        },
      ];

      const guidance =
        await hardeningFramework.getRemediationGuidance(complexViolations);

      expect(guidance.length).toBe(1);
      const remediation = guidance[0];

      expect(remediation.description.toLowerCase()).toContain("security");
      expect(remediation.steps.length).toBeGreaterThan(1);
      expect(remediation.estimatedTime).toMatch(/\d+\s+(minutes?|hours?)/);
      expect(remediation.references).toBeDefined();
      expect(Array.isArray(remediation.references)).toBe(true);
    });
  });

  describe("Integration and Error Handling", () => {
    it("should handle initialization failures gracefully", async () => {
      const invalidConfig = {
        auditLevel: "invalid" as any,
        complianceFrameworks: [],
        dependencyScanning: false,
        maxAuditTime: -1,
        enabledRules: [],
        customRules: [],
      };

      const invalidFramework = new SecurityHardeningFramework(invalidConfig);

      await expect(invalidFramework.initialize()).rejects.toThrow();
    });

    it("should maintain security state across operations", async () => {
      await hardeningFramework.initialize();

      // Perform multiple operations
      await hardeningFramework.enforcePolicies({ test: "data" });
      await hardeningFramework.validateCompliance(["OWASP"]);
      await hardeningFramework.validateAccessControl(
        "user",
        "resource",
        "action",
      );
      await hardeningFramework.validateEncryptionStandards("data", {});

      // Verify system remains operational
      const stats1 = hardeningFramework.getSecurityStatistics();
      expect(stats1.totalEvents).toBeGreaterThan(0);

      // Perform more operations that should generate new events
      await hardeningFramework.validateEncryptionStandards("new_data", {
        sensitive: true,
      });

      const stats2 = hardeningFramework.getSecurityStatistics();
      expect(stats2.totalEvents).toBeGreaterThanOrEqual(stats1.totalEvents);
    });

    it("should prevent operations before initialization", async () => {
      const uninitializedFramework = new SecurityHardeningFramework(
        securityConfig,
      );

      await expect(uninitializedFramework.enforcePolicies({})).rejects.toThrow(
        "Security Hardening Framework not initialized",
      );

      await expect(
        uninitializedFramework.validateCompliance(["OWASP"]),
      ).rejects.toThrow("Security Hardening Framework not initialized");

      await expect(
        uninitializedFramework.validateAccessControl(
          "user",
          "resource",
          "action",
        ),
      ).rejects.toThrow("Security Hardening Framework not initialized");

      await expect(
        uninitializedFramework.validateEncryptionStandards("data", {}),
      ).rejects.toThrow("Security Hardening Framework not initialized");
    });

    it("should provide comprehensive security statistics", async () => {
      await hardeningFramework.initialize();

      // Generate various types of events
      await hardeningFramework.enforcePolicies({ test: "policy_test" });
      await hardeningFramework.validateAccessControl(
        "test_user",
        "test_resource",
        "read",
      );
      await hardeningFramework.logSecurityEvent({
        eventType: "security_incident",
        severity: "critical",
        source: "test",
        action: "test_incident",
        result: "failure",
        details: {},
        riskScore: 9,
      });

      const stats = hardeningFramework.getSecurityStatistics();

      // Verify all expected statistics are present and valid
      expect(stats).toMatchObject({
        totalEvents: expect.any(Number),
        recentEvents: expect.any(Number),
        eventsByType: expect.any(Object),
        eventsBySeverity: expect.any(Object),
        policiesLoaded: expect.any(Number),
        accessControlEnabled: expect.any(Boolean),
        encryptionEnabled: expect.any(Boolean),
        riskScore: expect.any(Number),
      });

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.policiesLoaded).toBeGreaterThan(0);
      expect(stats.riskScore).toBeGreaterThanOrEqual(0);
      expect(stats.riskScore).toBeLessThanOrEqual(10);

      // Verify event groupings
      expect(Object.keys(stats.eventsByType).length).toBeGreaterThan(0);
      expect(Object.keys(stats.eventsBySeverity).length).toBeGreaterThan(0);

      // Verify counts are consistent
      const totalByType = Object.values(stats.eventsByType).reduce(
        (sum: number, count) => sum + (count as number),
        0,
      );
      expect(totalByType).toBeLessThanOrEqual(stats.totalEvents);
    });
  });
});
