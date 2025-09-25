/**
 * @fileoverview Privacy and Security Controls Tests (Simplified)
 * @module @ast-copilot-helper/ast-helper/test/error-reporting/privacy
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PrivacyManager,
  ConsentLevel,
} from "../../error-reporting/privacy/privacy-manager.js";
import { ComplianceChecker } from "../../error-reporting/privacy/compliance-checker.js";
import { SecureTransmissionManager } from "../../error-reporting/privacy/secure-transmission.js";
import type {
  ConsentData,
  SecurityConfig,
} from "../../error-reporting/types.js";

describe("Privacy and Security Controls", () => {
  let privacyManager: PrivacyManager;
  let complianceChecker: ComplianceChecker;
  let transmissionManager: SecureTransmissionManager;

  beforeEach(() => {
    privacyManager = new PrivacyManager({
      requireConsent: true,
      retentionDays: 30,
      anonymizationLevel: "basic",
      enablePiiScrubbing: true,
      allowedCategories: ["error", "warning"],
      enableEncryption: true,
      enableAuditLog: true,
      gdprCompliance: true,
      ccpaCompliance: true,
      customFilters: [],
    });

    const privacySettings = privacyManager.getPrivacySettings();
    complianceChecker = new ComplianceChecker(privacySettings);

    const securityConfig: SecurityConfig = {
      enableEncryption: true,
      encryptionAlgorithm: "AES-256-GCM",
      keyRotationInterval: 30,
      enableTransmissionSecurity: true,
      allowedOrigins: ["https://api.example.com"],
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 10,
        blacklistDuration: 5,
      },
      authentication: {
        required: true,
        method: "apiKey",
      },
    };

    transmissionManager = new SecureTransmissionManager(securityConfig);
  });

  describe("Privacy Manager", () => {
    it("should initialize with correct settings", () => {
      const settings = privacyManager.getPrivacySettings();

      expect(settings.requireConsent).toBe(true);
      expect(settings.retentionDays).toBe(30);
      expect(settings.anonymizationLevel).toBe("basic");
      expect(settings.enablePiiScrubbing).toBe(true);
      expect(settings.gdprCompliance).toBe(true);
      expect(settings.ccpaCompliance).toBe(true);
    });

    it("should set and retrieve user consent", async () => {
      const userId = "test-user-123";
      const consentData: ConsentData = {
        level: ConsentLevel.ANALYTICS,
        categories: ["error", "warning"],
        timestamp: new Date(),
        version: "1.0",
      };

      await privacyManager.setUserConsent(userId, consentData);
      const retrievedConsent = privacyManager.getUserConsent(userId);

      expect(retrievedConsent).toBeDefined();
      expect(retrievedConsent!.level).toBe(ConsentLevel.ANALYTICS);
      expect(retrievedConsent!.categories).toEqual(["error", "warning"]);
    });

    it("should check consent correctly", async () => {
      const userId = "test-user-456";
      const consentData: ConsentData = {
        level: ConsentLevel.BASIC,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      };

      await privacyManager.setUserConsent(userId, consentData);

      // Should have consent for error category at basic level
      expect(
        privacyManager.hasConsent(userId, "error", ConsentLevel.BASIC),
      ).toBe(true);

      // Should not have consent for analytics level
      expect(
        privacyManager.hasConsent(userId, "error", ConsentLevel.ANALYTICS),
      ).toBe(false);

      // Should not have consent for uncategorized data
      expect(
        privacyManager.hasConsent(userId, "performance", ConsentLevel.BASIC),
      ).toBe(false);
    });

    it("should filter simple error data with PII scrubbing", async () => {
      const mockError = {
        id: "test-error-1",
        timestamp: new Date(),
        type: "error",
        severity: "medium",
        category: "error",
        message:
          "Test error with email test@example.com and phone 555-123-4567",
        operation: "test",
        suggestions: [],
        userProvided: false,
        reportedToServer: false,
      } as any;

      const filteredReport = await privacyManager.filterErrorReport(mockError);

      expect(filteredReport.message).toContain("[EMAIL_REDACTED]");
      expect(filteredReport.message).toContain("[PHONE_REDACTED]");
      expect(filteredReport.message).not.toContain("test@example.com");
      expect(filteredReport.message).not.toContain("555-123-4567");
    });

    it("should revoke user consent", async () => {
      const userId = "test-user-789";
      const consentData: ConsentData = {
        level: ConsentLevel.FULL,
        categories: ["error", "warning"],
        timestamp: new Date(),
        version: "1.0",
      };

      await privacyManager.setUserConsent(userId, consentData);
      expect(privacyManager.getUserConsent(userId)).toBeDefined();

      await privacyManager.revokeUserConsent(userId);
      expect(privacyManager.getUserConsent(userId)).toBeNull();
    });

    it("should clean up expired data", async () => {
      const cleanedCount = await privacyManager.cleanupExpiredData();
      expect(typeof cleanedCount).toBe("number");
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it("should generate privacy compliance report", async () => {
      const report = await privacyManager.generatePrivacyReport();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.totalUsers).toBe("number");
      expect(typeof report.dataRetentionDays).toBe("number");
      expect(typeof report.piiScrubbing).toBe("boolean");
      expect(typeof report.gdprCompliance).toBe("boolean");
      expect(typeof report.ccpaCompliance).toBe("boolean");
    });

    it("should export user data for GDPR compliance", async () => {
      const userId = "export-user";
      const consentData: ConsentData = {
        level: ConsentLevel.ANALYTICS,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      };

      await privacyManager.setUserConsent(userId, consentData);
      const exportData = await privacyManager.exportUserData(userId);

      expect(exportData).toBeDefined();
      expect(exportData).not.toBeNull();

      if (exportData) {
        expect(exportData.userId).toBe(userId);
        expect(exportData.consent).toBeDefined();
        expect(exportData.exportTimestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe("Compliance Checker", () => {
    it("should perform basic compliance check", async () => {
      const mockErrorReports = [
        {
          id: "compliance-test-1",
          timestamp: new Date(),
          type: "error",
          severity: "medium",
          category: "error",
          message: "Test compliance error",
          operation: "test",
        },
      ] as any[];

      const consentRecords = new Map<string, ConsentData>();
      const result = await complianceChecker.performComplianceCheck(
        mockErrorReports,
        consentRecords,
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.violations).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.lastChecked).toBeInstanceOf(Date);
      expect(typeof result.compliant).toBe("boolean");
    });

    it("should generate compliance report", () => {
      const report = complianceChecker.generateComplianceReport();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.totalViolations).toBeGreaterThanOrEqual(0);
      expect(typeof report.gdprCompliant).toBe("boolean");
      expect(typeof report.ccpaCompliant).toBe("boolean");
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe("Secure Transmission Manager", () => {
    it("should initialize with security config", () => {
      expect(transmissionManager).toBeDefined();

      const stats = transmissionManager.getTransmissionStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalTransmissions).toBe("number");
      expect(typeof stats.successfulTransmissions).toBe("number");
      expect(typeof stats.failedTransmissions).toBe("number");
      expect(typeof stats.encryptionUsage).toBe("number");
    });

    it("should test connection to endpoint", async () => {
      const result = await transmissionManager.testConnection(
        "https://api.example.com/errors",
      );
      expect(typeof result).toBe("boolean");
    });

    it("should handle secure error report transmission", async () => {
      const mockErrorReport = {
        id: "transmission-test-1",
        timestamp: new Date(),
        type: "error",
        severity: "low",
        category: "error",
        message: "Transmission test error",
        operation: "test",
      } as any;

      const result = await transmissionManager.sendErrorReport(
        mockErrorReport,
        "https://api.example.com/errors",
      );

      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.retryCount).toBe("number");
      expect(typeof result.encryptionUsed).toBe("boolean");

      if (result.success) {
        expect(result.messageId).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it("should respect rate limiting", async () => {
      const mockError = {
        id: "rate-limit-test",
        type: "error",
        severity: "low",
        category: "test",
      } as any;

      // Send multiple requests quickly to trigger rate limiting
      const promises = Array(15)
        .fill(null)
        .map(() =>
          transmissionManager.sendErrorReport(
            mockError,
            "https://api.example.com/errors",
          ),
        );

      const results = await Promise.all(promises);

      // Should have some rate limit failures
      const rateLimitedResults = results.filter(
        (r) => !r.success && r.error?.includes("Rate limit"),
      );

      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });
  });

  describe("Privacy System Integration", () => {
    it("should work together for complete privacy protection", async () => {
      // Set up user with consent
      const userId = "integration-test-user";
      const consentData: ConsentData = {
        level: ConsentLevel.ANALYTICS,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      };

      await privacyManager.setUserConsent(userId, consentData);

      // Create simple test error
      const mockError = {
        id: "integration-test-1",
        timestamp: new Date(),
        type: "error",
        severity: "medium",
        category: "error",
        message: "Integration test with PII: user@example.com",
        operation: "test",
        context: { userId },
      } as any;

      // Filter through privacy manager
      const filteredReport = await privacyManager.filterErrorReport(
        mockError,
        userId,
      );

      // Check PII was scrubbed
      expect(filteredReport.message).toContain("[EMAIL_REDACTED]");
      expect(filteredReport.message).not.toContain("user@example.com");

      // Test secure transmission
      const transmissionResult = await transmissionManager.sendErrorReport(
        filteredReport,
        "https://api.example.com/errors",
        { encrypt: true, compress: true },
      );

      expect(transmissionResult.encryptionUsed).toBe(true);

      // Run compliance check
      const complianceResult = await complianceChecker.performComplianceCheck(
        [filteredReport],
        new Map([[userId, consentData]]),
      );

      expect(complianceResult.score).toBeGreaterThan(0);
      expect(complianceResult.violations).toBeInstanceOf(Array);
    });

    it("should handle privacy settings correctly", () => {
      const settings = privacyManager.getPrivacySettings();

      expect(settings.requireConsent).toBe(true);
      expect(settings.enablePiiScrubbing).toBe(true);
      expect(settings.gdprCompliance).toBe(true);
      expect(settings.ccpaCompliance).toBe(true);
      expect(settings.allowedCategories).toContain("error");
      expect(settings.allowedCategories).toContain("warning");
    });
  });
});
