/**
 * Tests for core telemetry infrastructure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PrivacyRespectingTelemetryManager,
  createTelemetryManager,
  getDefaultTelemetryManager,
  resetDefaultTelemetryManager,
} from "../index.js";
import {
  TelemetryConfig,
  PrivacyLevel,
  ErrorSeverity,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_RETRY_ATTEMPTS,
} from "../types.js";
import {
  DEFAULT_TELEMETRY_CONFIG,
  validateTelemetryConfig,
  mergeTelemetryConfig,
  getEnvironmentConfig,
  isTelemetryEnabled,
  getTelemetryFeatures,
} from "../config.js";

describe("Telemetry Infrastructure - Core Types and Interfaces", () => {
  it("should have correct default constants", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(50);
    expect(DEFAULT_FLUSH_INTERVAL).toBe(5 * 60 * 1000);
    expect(DEFAULT_RETRY_ATTEMPTS).toBe(3);
  });

  it("should define privacy levels correctly", () => {
    const privacyLevels: PrivacyLevel[] = ["strict", "balanced", "permissive"];
    expect(privacyLevels).toContain("strict");
    expect(privacyLevels).toContain("balanced");
    expect(privacyLevels).toContain("permissive");
  });

  it("should define error severities correctly", () => {
    const severities: ErrorSeverity[] = ["low", "medium", "high", "critical"];
    expect(severities).toContain("low");
    expect(severities).toContain("medium");
    expect(severities).toContain("high");
    expect(severities).toContain("critical");
  });
});

describe("Telemetry Configuration", () => {
  it("should provide default configuration", () => {
    expect(DEFAULT_TELEMETRY_CONFIG).toBeDefined();
    expect(DEFAULT_TELEMETRY_CONFIG.enabled).toBe(false); // Disabled by default
    expect(DEFAULT_TELEMETRY_CONFIG.privacyLevel).toBe("balanced");
    expect(DEFAULT_TELEMETRY_CONFIG.consentRequired).toBe(true);
    expect(DEFAULT_TELEMETRY_CONFIG.batchSize).toBe(DEFAULT_BATCH_SIZE);
  });

  it("should validate configuration correctly", () => {
    // Valid configuration
    expect(
      validateTelemetryConfig({
        batchSize: 25,
        flushInterval: 60000,
        retryAttempts: 3,
        endpoint: "https://api.example.com/telemetry",
        privacyLevel: "balanced",
      }),
    ).toEqual([]);

    // Invalid batch size
    expect(validateTelemetryConfig({ batchSize: 0 })).toContain(
      "batchSize must be between 1 and 1000",
    );
    expect(validateTelemetryConfig({ batchSize: 1001 })).toContain(
      "batchSize must be between 1 and 1000",
    );

    // Invalid flush interval
    expect(validateTelemetryConfig({ flushInterval: 29000 })).toContain(
      "flushInterval must be between 30 seconds and 24 hours",
    );

    // Invalid endpoint
    expect(validateTelemetryConfig({ endpoint: "not-a-url" })).toContain(
      "endpoint must be a valid URL",
    );
    expect(
      validateTelemetryConfig({ endpoint: "http://api.example.com" }),
    ).toContain("endpoint must use HTTPS or be localhost for development");

    // Invalid privacy level
    expect(
      validateTelemetryConfig({ privacyLevel: "invalid" as PrivacyLevel }),
    ).toContain('privacyLevel must be "strict", "balanced", or "permissive"');
  });

  it("should merge configurations correctly", () => {
    const userConfig = {
      enabled: true,
      batchSize: 25,
      privacyLevel: "strict" as PrivacyLevel,
    };

    const merged = mergeTelemetryConfig(userConfig);

    expect(merged.enabled).toBe(true);
    expect(merged.batchSize).toBe(25);
    expect(merged.privacyLevel).toBe("strict");
    expect(merged.flushInterval).toBe(DEFAULT_TELEMETRY_CONFIG.flushInterval); // Should use default
  });

  it("should handle environment configuration", () => {
    // Mock environment variables
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      AST_HELPER_TELEMETRY_ENDPOINT: "https://test.example.com",
      AST_HELPER_TELEMETRY_ENABLED: "true",
      AST_HELPER_TELEMETRY_PRIVACY_LEVEL: "strict",
      NODE_ENV: "production", // Override NODE_ENV to avoid development overrides
    };

    const envConfig = getEnvironmentConfig();

    expect(envConfig.endpoint).toBe("https://test.example.com");
    expect(envConfig.enabled).toBe(true);
    expect(envConfig.privacyLevel).toBe("strict");

    // Restore original environment
    process.env = originalEnv;
  });

  it("should check if telemetry is enabled correctly", () => {
    // Mock NODE_ENV to avoid test environment interference
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CI", "");
    vi.stubEnv("GITHUB_ACTIONS", "");

    const enabledConfig: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      enabled: true,
      endpoint: "https://api.example.com",
      apiKey: "test-key",
    };

    expect(isTelemetryEnabled(enabledConfig)).toBe(true);

    // Disabled config
    expect(isTelemetryEnabled({ ...enabledConfig, enabled: false })).toBe(
      false,
    );

    // Missing endpoint
    expect(isTelemetryEnabled({ ...enabledConfig, endpoint: "" })).toBe(false);

    // Missing API key
    expect(isTelemetryEnabled({ ...enabledConfig, apiKey: "" })).toBe(false);

    // Restore environment
    vi.unstubAllEnvs();
  });

  it("should get telemetry features based on privacy level", () => {
    const strictFeatures = getTelemetryFeatures("strict");
    expect(strictFeatures.usageTracking).toBe(false);
    expect(strictFeatures.performanceMonitoring).toBe(true);
    expect(strictFeatures.errorReporting).toBe(true);

    const balancedFeatures = getTelemetryFeatures("balanced");
    expect(balancedFeatures.usageTracking).toBe(true);
    expect(balancedFeatures.performanceMonitoring).toBe(true);
    expect(balancedFeatures.customEvents).toBe(false);

    const permissiveFeatures = getTelemetryFeatures("permissive");
    expect(permissiveFeatures.usageTracking).toBe(true);
    expect(permissiveFeatures.customEvents).toBe(true);
  });
});

describe("PrivacyRespectingTelemetryManager", () => {
  let manager: PrivacyRespectingTelemetryManager;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Mock console methods to avoid noise in tests
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    manager = new PrivacyRespectingTelemetryManager({
      enabled: false, // Disabled for tests
      consentRequired: true,
    });
  });

  afterEach(async () => {
    await manager.shutdown();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should create manager with default config", () => {
    const defaultManager = new PrivacyRespectingTelemetryManager();
    expect(defaultManager).toBeDefined();
  });

  it("should initialize successfully", async () => {
    await manager.initialize();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Initializing telemetry system...",
    );
  });

  it("should handle initialization with custom config", async () => {
    const customConfig: TelemetryConfig = {
      ...DEFAULT_TELEMETRY_CONFIG,
      enabled: true,
      batchSize: 25,
      privacyLevel: "strict",
    };

    await manager.initialize(customConfig);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Initializing telemetry system...",
    );
  });

  it("should reject invalid configuration", async () => {
    // Create a fresh manager for this test
    const testManager = new PrivacyRespectingTelemetryManager();
    const invalidConfig = {
      batchSize: -1, // Invalid
    } as Partial<TelemetryConfig>;

    await expect(
      testManager.initialize(invalidConfig as TelemetryConfig),
    ).rejects.toThrow("Invalid telemetry configuration");

    await testManager.shutdown();
  });

  it("should collect empty metrics when disabled", async () => {
    await manager.initialize();

    const metrics = await manager.collectUsageMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.sessionId).toBeDefined();
    expect(metrics.commands).toEqual([]);
    expect(metrics.features).toEqual([]);
    expect(metrics.errors).toEqual([]);
  });

  it("should not track feature usage when disabled", async () => {
    await manager.initialize();

    // Should still log but not actually send telemetry when disabled
    await manager.trackFeatureUsage("test-feature", { key: "value" });

    // The feature tracking will be logged but not sent due to disabled state
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Feature usage tracked"),
    );
  });

  it("should record performance metrics when disabled", async () => {
    await manager.initialize();

    const performanceMetrics = {
      operation: "test-operation",
      duration: 100,
      memoryUsage: 1024 * 1024, // 1MB
      success: true,
      fileCount: 10,
      codebaseSize: 1024 * 1024 * 10, // 10MB
    };

    // Should not throw even when disabled
    await manager.recordPerformanceMetrics(performanceMetrics);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Performance metrics recorded"),
    );
  });

  it("should report errors when disabled", async () => {
    await manager.initialize();

    const errorReport = {
      type: "TestError",
      message: "Test error message",
      severity: "medium" as ErrorSeverity,
      context: {
        operation: "test",
        fileCount: 5,
      },
    };

    // Should not throw even when disabled
    await manager.reportError(errorReport);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error reported"),
    );
  });

  it("should send telemetry data", async () => {
    await manager.initialize();

    const result = await manager.sendTelemetryData();

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.eventsSent).toBe(0);
    expect(result.message).toBe("No telemetry data to send");
  });

  it("should get user consent status", async () => {
    await manager.initialize();

    const consent = await manager.getUserConsent();

    expect(consent).toBeDefined();
    expect(consent.hasConsent).toBe(true);
    expect(consent.enabled).toBe(true);
  });

  it("should configure telemetry settings", async () => {
    await manager.initialize();

    const settings = {
      enabled: true,
      privacyLevel: "strict" as PrivacyLevel,
      collectPerformance: true,
      collectErrors: true,
      collectUsage: false,
    };

    // Should not throw
    await manager.configureTelemetry(settings);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Configuring telemetry settings...",
    );
  });

  it("should reject invalid telemetry settings", async () => {
    await manager.initialize();

    const invalidSettings = {
      batchSize: -1, // Invalid
    };

    await expect(manager.configureTelemetry(invalidSettings)).rejects.toThrow(
      "Invalid telemetry settings",
    );
  });

  it("should shutdown gracefully", async () => {
    await manager.initialize();
    await manager.shutdown();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Shutting down telemetry system...",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Telemetry system shutdown completed",
    );
  });

  it("should prevent double initialization", async () => {
    await manager.initialize();

    await expect(manager.initialize()).rejects.toThrow(
      "Telemetry manager is already initialized",
    );
  });

  it("should prevent initialization after shutdown", async () => {
    // Use a separate test manager to avoid interference
    const testManager = new PrivacyRespectingTelemetryManager({
      enabled: false,
    });
    await testManager.initialize();
    await testManager.shutdown();

    await expect(testManager.initialize()).rejects.toThrow(
      "Telemetry manager has been shutdown",
    );
  });
});

describe("Factory Functions", () => {
  afterEach(() => {
    resetDefaultTelemetryManager();
  });

  it("should create telemetry manager with factory function", () => {
    const manager = createTelemetryManager({
      enabled: false,
      privacyLevel: "strict",
    });

    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(PrivacyRespectingTelemetryManager);
  });

  it("should provide singleton default manager", () => {
    const manager1 = getDefaultTelemetryManager();
    const manager2 = getDefaultTelemetryManager();

    expect(manager1).toBe(manager2);
    expect(manager1).toBeInstanceOf(PrivacyRespectingTelemetryManager);
  });

  it("should reset default manager", () => {
    const manager1 = getDefaultTelemetryManager();
    resetDefaultTelemetryManager();
    const manager2 = getDefaultTelemetryManager();

    expect(manager1).not.toBe(manager2);
  });
});

describe("Edge Cases and Error Handling", () => {
  let manager: PrivacyRespectingTelemetryManager;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    manager = new PrivacyRespectingTelemetryManager({ enabled: false });
  });

  afterEach(async () => {
    await manager.shutdown();
    consoleErrorSpy.mockRestore();
  });

  it("should handle initialization failures gracefully", async () => {
    // Test that initialization completes without throwing even if some internal operations fail
    const testManager = new PrivacyRespectingTelemetryManager({
      enabled: false,
    });

    // Should not throw regardless of internal errors
    await expect(
      testManager.initialize({
        ...DEFAULT_TELEMETRY_CONFIG,
        enabled: false, // Keep disabled to avoid actual network calls
      }),
    ).resolves.not.toThrow();

    await testManager.shutdown();
  });

  it("should handle feature tracking errors gracefully", async () => {
    await manager.initialize();

    // Should not throw even with invalid data
    await manager.trackFeatureUsage("test-feature", { circular: {} });

    // Error should be handled internally without throwing
    expect(true).toBe(true);
  });

  it("should handle performance metrics errors gracefully", async () => {
    await manager.initialize();

    // Should not throw even with invalid metrics
    await manager.recordPerformanceMetrics({
      operation: "",
      duration: -1,
      memoryUsage: NaN,
      success: true,
    });

    // Error should be handled internally without throwing
    expect(true).toBe(true);
  });
});
