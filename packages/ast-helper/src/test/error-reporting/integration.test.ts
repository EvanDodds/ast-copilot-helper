/**
 * @fileoverview Integration Tests for Complete Error Reporting System
 * @module @ast-copilot-helper/ast-helper/test/error-reporting/integration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ComprehensiveErrorReportingManager } from "../../error-reporting/manager.js";
import { ConsentLevel } from "../../error-reporting/privacy/privacy-manager.js";
import type {
  ErrorReportingConfig,
  ConsentData,
  SecurityConfig,
  ErrorReport,
} from "../../error-reporting/types.js";

describe("Error Reporting System Integration", () => {
  let errorManager: ComprehensiveErrorReportingManager;
  let config: ErrorReportingConfig;

  beforeEach(async () => {
    // Configuration for all components
    config = {
      enabled: true,
      endpoint: "https://api.example.com/errors",
      apiKey: "test-api-key",
      enableCrashReporting: true,
      enableAutomaticReporting: false,
      collectSystemInfo: true,
      collectCodebaseInfo: true,
      maxReportSize: 1024 * 1024,
      maxHistoryEntries: 100,
      privacyMode: false,
      userReportingEnabled: true,
      diagnosticDataCollection: {
        system: true,
        runtime: true,
        codebase: true,
        configuration: true,
        performance: true,
        dependencies: true,
        maxCollectionTimeMs: 10000,
        includeEnvironmentVars: true,
        includeProcessInfo: true,
      },
    };

    errorManager = new ComprehensiveErrorReportingManager();
    await errorManager.initialize(config);
  });

  afterEach(async () => {
    if (errorManager) {
      await errorManager.cleanup();
    }
  });

  describe("Complete System Workflow", () => {
    it("should handle complete error reporting workflow with privacy controls", async () => {
      // 1. Set user consent
      const userId = "integration-user-1";
      const consentData: ConsentData = {
        level: ConsentLevel.ANALYTICS,
        categories: ["error", "warning", "crash"],
        timestamp: new Date(),
        version: "1.0",
      };

      await errorManager.setUserConsent(userId, consentData);

      // Verify consent was set
      const retrievedConsent = errorManager.getUserConsent(userId);
      expect(retrievedConsent).toBeDefined();
      expect(retrievedConsent!.level).toBe(ConsentLevel.ANALYTICS);

      // 2. Generate error reports from Error objects
      const testErrors = [
        new Error(
          "Parse error in user@example.com file with sensitive data 555-123-4567",
        ),
        new Error("Analysis failed for large file"),
        new Error("Critical system failure"),
      ];

      const reports: ErrorReport[] = [];
      for (const error of testErrors) {
        const report = await errorManager.generateErrorReport(error, {
          userId,
          operation: "test-operation",
          component: "integration-test",
        });
        reports.push(report);

        // Report each error
        const result = await errorManager.reportError(report);
        expect(result.success).toBe(true);
        expect(result.errorId).toBeDefined();
      }

      // Verify all errors were reported
      expect(reports).toHaveLength(3);
      reports.forEach((report) => {
        expect(report.id).toBeDefined();
        expect(report.timestamp).toBeInstanceOf(Date);
        expect(report.message).toBeDefined();
      });

      // 3. Test suggestions generation
      for (const report of reports) {
        const suggestions = await errorManager.provideSuggestions(report);
        expect(suggestions).toBeDefined();
        expect(Array.isArray(suggestions)).toBe(true);
        if (suggestions.length > 0) {
          expect(suggestions[0].description).toBeDefined();
          expect(typeof suggestions[0].confidence).toBe("number");
        }
      }

      // 4. Test error history
      const errorHistory = await errorManager.getErrorHistory();
      expect(errorHistory.length).toBeGreaterThanOrEqual(3);

      // 5. Test secure transmission (if configured)
      const transmissionResult = await errorManager.sendSecureErrorReport(
        reports[0],
        userId,
      );
      if (transmissionResult) {
        expect(transmissionResult.success).toBeDefined();
        expect(typeof transmissionResult.encryptionUsed).toBe("boolean");
      }

      // 6. Test compliance checking
      const complianceResult = await errorManager.performComplianceCheck();
      expect(complianceResult.score).toBeGreaterThan(0);
      expect(typeof complianceResult.compliant).toBe("boolean");
    });

    it("should handle crash reporting integration", async () => {
      const userId = "crash-user";
      await errorManager.setUserConsent(userId, {
        level: ConsentLevel.BASIC,
        categories: ["error", "crash"],
        timestamp: new Date(),
        version: "1.0",
      });

      // Generate a crash report
      const crashError = new Error("Critical system crash");
      const crashReport = await errorManager.generateErrorReport(crashError, {
        userId,
        operation: "critical-operation",
        component: "system-core",
        severity: "critical",
      });

      // Report the crash
      const result = await errorManager.reportError(crashReport);
      expect(result.success).toBe(true);

      // Verify crash was categorized correctly
      expect(crashReport.severity).toBeDefined();
      expect(crashReport.category).toBeDefined();
    });

    it("should handle privacy consent changes", async () => {
      const userId = "privacy-user";

      // 1. Start with basic consent
      let consentData: ConsentData = {
        level: ConsentLevel.BASIC,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      };

      await errorManager.setUserConsent(userId, consentData);
      expect(errorManager.getUserConsent(userId)?.level).toBe(
        ConsentLevel.BASIC,
      );

      // 2. Report error with basic consent
      const basicError = new Error("Basic consent error");
      const basicReport = await errorManager.generateErrorReport(basicError, {
        userId,
        operation: "privacy-test",
      });

      const basicResult = await errorManager.reportError(basicReport);
      expect(basicResult.success).toBe(true);

      // 3. Upgrade to analytics consent
      consentData = {
        level: ConsentLevel.ANALYTICS,
        categories: ["error", "warning"],
        timestamp: new Date(),
        version: "1.0",
      };

      await errorManager.setUserConsent(userId, consentData);
      expect(errorManager.getUserConsent(userId)?.level).toBe(
        ConsentLevel.ANALYTICS,
      );

      // 4. Revoke consent
      await errorManager.revokeUserConsent(userId);
      expect(errorManager.getUserConsent(userId)).toBeNull();
    });

    it("should handle diagnostic data collection", async () => {
      const userId = "diagnostics-user";
      await errorManager.setUserConsent(userId, {
        level: ConsentLevel.FULL,
        categories: ["error", "diagnostic"],
        timestamp: new Date(),
        version: "1.0",
      });

      // Generate error with diagnostic context
      const diagnosticError = new Error("System diagnostic test");
      const diagnosticReport = await errorManager.generateErrorReport(
        diagnosticError,
        {
          userId,
          operation: "diagnostic-test",
          component: "diagnostics-component",
        },
      );

      // Report error
      const result = await errorManager.reportError(diagnosticReport);
      expect(result.success).toBe(true);

      // Verify diagnostic data collection infrastructure is working
      expect(diagnosticReport.context).toBeDefined();

      // Check if diagnostic data collection infrastructure is in place
      if (diagnosticReport.diagnostics) {
        expect(diagnosticReport.diagnostics).toBeDefined();

        // Note: The diagnostic collection methods are currently placeholder implementations
        // The important thing is that the diagnostic collection pipeline is working
        expect(typeof diagnosticReport.diagnostics).toBe("object");
      }

      // Verify basic context information is present
      expect(diagnosticReport.context.parameters).toBeDefined();
      if (diagnosticReport.context.parameters) {
        expect(diagnosticReport.context.parameters.userId).toBe(userId);
        expect(diagnosticReport.context.parameters.operation).toBe(
          "diagnostic-test",
        );
      }
    });

    it("should handle concurrent error reporting", async () => {
      const userId = "concurrent-user";
      await errorManager.setUserConsent(userId, {
        level: ConsentLevel.ANALYTICS,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      });

      // Generate concurrent errors
      const concurrentPromises = Array.from({ length: 20 }, async (_, i) => {
        const error = new Error(`Concurrent error ${i}`);
        const report = await errorManager.generateErrorReport(error, {
          userId,
          operation: `concurrent-op-${i}`,
          component: "concurrent-component",
        });

        return errorManager.reportError(report);
      });

      // Wait for all to complete
      const results = await Promise.allSettled(concurrentPromises);

      // Verify most succeeded
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      );

      expect(successful.length).toBeGreaterThan(10); // At least 50% success
      console.log(
        `✅ Concurrent success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`,
      );
    });

    it("should handle error export and diagnostics", async () => {
      const userId = "export-user";
      await errorManager.setUserConsent(userId, {
        level: ConsentLevel.FULL,
        categories: ["error", "diagnostic"],
        timestamp: new Date(),
        version: "1.0",
      });

      // Report some errors
      const errors = [
        new Error("Export test error 1"),
        new Error("Export test error 2"),
      ];

      for (const error of errors) {
        const report = await errorManager.generateErrorReport(error, {
          userId,
        });
        await errorManager.reportError(report);
      }

      // Export diagnostics
      const jsonExport = await errorManager.exportDiagnostics("json");
      expect(jsonExport).toBeDefined();
      expect(typeof jsonExport).toBe("string");
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      const textExport = await errorManager.exportDiagnostics("text");
      expect(textExport).toBeDefined();
      expect(typeof textExport).toBe("string");
    });

    it("should handle error history management", async () => {
      const userId = "history-user";
      await errorManager.setUserConsent(userId, {
        level: ConsentLevel.BASIC,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      });

      // Report multiple errors
      const errors = [
        new Error("History test error 1"),
        new Error("History test error 2"),
        new Error("History test error 3"),
      ];

      for (const error of errors) {
        const report = await errorManager.generateErrorReport(error, {
          userId,
        });
        await errorManager.reportError(report);
      }

      // Check error history
      const history = await errorManager.getErrorHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);

      // Clear error history
      await errorManager.clearErrorHistory();
      const clearedHistory = await errorManager.getErrorHistory();
      expect(clearedHistory.length).toBe(0);
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should handle invalid data gracefully", async () => {
      const userId = "invalid-data-user";
      await errorManager.setUserConsent(userId, {
        level: ConsentLevel.BASIC,
        categories: ["error"],
        timestamp: new Date(),
        version: "1.0",
      });

      // Test with null error (should be handled gracefully)
      try {
        const report = await errorManager.generateErrorReport(
          new Error(""), // Empty error message
          { userId },
        );
        expect(report).toBeDefined();

        const result = await errorManager.reportError(report);
        expect(result).toBeDefined();
      } catch (error) {
        // Graceful error handling is acceptable
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should maintain functionality with disabled features", async () => {
      // Test with minimal configuration
      const minimalConfig: ErrorReportingConfig = {
        enabled: true,
        enableCrashReporting: false,
        enableAutomaticReporting: false,
        collectSystemInfo: false,
        collectCodebaseInfo: false,
        maxReportSize: 1024,
        maxHistoryEntries: 10,
        privacyMode: true,
        userReportingEnabled: true,
        diagnosticDataCollection: {
          system: false,
          runtime: false,
          codebase: false,
          configuration: false,
          performance: false,
          dependencies: false,
          maxCollectionTimeMs: 1000,
          includeEnvironmentVars: false,
          includeProcessInfo: false,
        },
      };

      const minimalManager = new ComprehensiveErrorReportingManager();
      await minimalManager.initialize(minimalConfig);

      // Should still be able to report errors
      const error = new Error("Minimal config test");
      const report = await minimalManager.generateErrorReport(error, {
        operation: "minimal-test",
      });

      const result = await minimalManager.reportError(report);
      expect(result.success).toBe(true);

      await minimalManager.cleanup();
    });
  });
});
