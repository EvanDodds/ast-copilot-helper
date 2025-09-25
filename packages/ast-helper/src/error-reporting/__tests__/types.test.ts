/**
 * Tests for Error Reporting Types
 */

import { describe, test, expect } from "vitest";
import type {
  ErrorReport,
  SuggestionResult,
  DiagnosticData,
  ErrorReportingConfig,
} from "../types.js";

describe("Error Reporting Types", () => {
  test("should define ErrorReport interface correctly", () => {
    const errorReport: ErrorReport = {
      id: "test-id",
      timestamp: new Date(),
      type: "error",
      severity: "medium",
      category: "test-category",
      operation: "test-operation",
      message: "Test message",
      context: {
        operation: "test-operation",
        component: "test-component",
        sessionId: "test-session",
        timestamp: new Date(),
        platform: "test-platform",
        architecture: "test-arch",
        nodeVersion: "v18.0.0",
        processId: 1234,
        memoryUsage: {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
          arrayBuffers: 0,
        },
        uptime: 0,
      },
      environment: {
        platform: "test-platform",
        arch: "test-arch",
        nodeVersion: "v18.0.0",
        osVersion: "test-os",
        cpuModel: "test-cpu",
        cpuCores: 4,
        totalMemory: 8000000000,
        freeMemory: 4000000000,
        workingDirectory: "/test",
        homeDirectory: "/home/test",
        tempDirectory: "/tmp",
        pathSeparator: "/",
        environmentVars: {},
        processArgs: ["node", "test.js"],
        processEnv: "test",
      },
      diagnostics: {} as DiagnosticData,
      userProvided: false,
      reportedToServer: false,
      suggestions: [],
    };

    expect(errorReport.id).toBe("test-id");
    expect(errorReport.type).toBe("error");
    expect(errorReport.severity).toBe("medium");
    expect(errorReport.category).toBe("test-category");
    expect(errorReport.message).toBe("Test message");
    expect(errorReport.userProvided).toBe(false);
    expect(errorReport.reportedToServer).toBe(false);
    expect(Array.isArray(errorReport.suggestions)).toBe(true);
  });

  test("should define SuggestionResult interface correctly", () => {
    const suggestion: SuggestionResult = {
      id: "suggestion-1",
      title: "Test Suggestion",
      description: "This is a test suggestion",
      severity: "medium",
      category: "fix",
      confidence: 0.8,
      commands: ["npm install", "npm test"],
      links: ["https://example.com/docs"],
      estimatedTime: "5 minutes",
      prerequisites: ["Node.js installed"],
      steps: ["Step 1", "Step 2"],
    };

    expect(suggestion.id).toBe("suggestion-1");
    expect(suggestion.title).toBe("Test Suggestion");
    expect(suggestion.description).toBe("This is a test suggestion");
    expect(suggestion.severity).toBe("medium");
    expect(suggestion.category).toBe("fix");
    expect(suggestion.confidence).toBe(0.8);
    expect(Array.isArray(suggestion.commands)).toBe(true);
    expect(Array.isArray(suggestion.links)).toBe(true);
    expect(suggestion.estimatedTime).toBe("5 minutes");
    expect(Array.isArray(suggestion.prerequisites)).toBe(true);
    expect(Array.isArray(suggestion.steps)).toBe(true);
  });

  test("should define ErrorReportingConfig interface correctly", () => {
    const config: ErrorReportingConfig = {
      enabled: true,
      endpoint: "https://api.example.com/errors",
      apiKey: "test-api-key",
      enableCrashReporting: true,
      enableAutomaticReporting: false,
      collectSystemInfo: true,
      collectCodebaseInfo: true,
      maxReportSize: 1048576,
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

    expect(config.enabled).toBe(true);
    expect(config.endpoint).toBe("https://api.example.com/errors");
    expect(config.apiKey).toBe("test-api-key");
    expect(config.enableCrashReporting).toBe(true);
    expect(config.enableAutomaticReporting).toBe(false);
    expect(config.collectSystemInfo).toBe(true);
    expect(config.collectCodebaseInfo).toBe(true);
    expect(config.maxReportSize).toBe(1048576);
    expect(config.maxHistoryEntries).toBe(100);
    expect(config.privacyMode).toBe(false);
    expect(config.userReportingEnabled).toBe(true);
    expect(typeof config.diagnosticDataCollection).toBe("object");
    expect(config.diagnosticDataCollection.system).toBe(true);
    expect(config.diagnosticDataCollection.maxCollectionTimeMs).toBe(10000);
  });

  test("should support error severity levels", () => {
    const severityLevels: Array<"low" | "medium" | "high" | "critical"> = [
      "low",
      "medium",
      "high",
      "critical",
    ];

    severityLevels.forEach((severity) => {
      const errorReport: Partial<ErrorReport> = {
        severity,
      };

      expect(["low", "medium", "high", "critical"]).toContain(
        errorReport.severity,
      );
    });
  });

  test("should support error types", () => {
    const errorTypes: Array<"error" | "crash" | "warning" | "performance"> = [
      "error",
      "crash",
      "warning",
      "performance",
    ];

    errorTypes.forEach((type) => {
      const errorReport: Partial<ErrorReport> = {
        type,
      };

      expect(["error", "crash", "warning", "performance"]).toContain(
        errorReport.type,
      );
    });
  });

  test("should support suggestion categories", () => {
    const suggestionCategories: Array<"fix" | "workaround" | "information"> = [
      "fix",
      "workaround",
      "information",
    ];

    suggestionCategories.forEach((category) => {
      const suggestion: Partial<SuggestionResult> = {
        category,
      };

      expect(["fix", "workaround", "information"]).toContain(
        suggestion.category,
      );
    });
  });
});
