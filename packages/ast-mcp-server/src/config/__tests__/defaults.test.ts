import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_MCP_SERVER_CONFIG,
  DEVELOPMENT_CONFIG,
  PRODUCTION_CONFIG,
  TEST_CONFIG,
  getEnvironmentConfig,
} from "../defaults.js";
import { MCPServerConfig } from "../types.js";

describe("Configuration Defaults", () => {
  describe("Default Configuration", () => {
    it("should provide complete default configuration", () => {
      expect(DEFAULT_MCP_SERVER_CONFIG).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.name).toBeTruthy();
      expect(DEFAULT_MCP_SERVER_CONFIG.version).toBeTruthy();
      expect(DEFAULT_MCP_SERVER_CONFIG.transport).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.database).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.performance).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.logging).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.security).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.features).toBeDefined();
      expect(DEFAULT_MCP_SERVER_CONFIG.environment).toBeDefined();
    });

    it("should have safe default values", () => {
      const config = DEFAULT_MCP_SERVER_CONFIG;

      // Safe defaults
      expect(config.transport.type).toBe("stdio");
      expect(config.logging.level).toBe("info");
      expect(config.security.enableAuthentication).toBe(true);
      expect(config.security.enableCors).toBe(true);
      expect(config.features.enableTestEndpoints).toBe(false);
    });

    it("should have reasonable performance defaults", () => {
      const config = DEFAULT_MCP_SERVER_CONFIG;

      expect(config.performance.maxConcurrentRequests).toBeGreaterThan(0);
      expect(config.performance.maxQueryResults).toBeGreaterThan(0);
      expect(config.performance.cacheSize).toBeGreaterThanOrEqual(0);
      expect(config.performance.gcThreshold).toBeGreaterThan(0);
      expect(config.performance.gcThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe("Environment-Specific Configurations", () => {
    it("should provide development configuration", () => {
      expect(DEVELOPMENT_CONFIG).toBeDefined();

      // Development should enable debug features
      expect(DEVELOPMENT_CONFIG.logging?.level).toBe("debug");
      expect(DEVELOPMENT_CONFIG.features?.enableTestEndpoints).toBe(true);
      expect(DEVELOPMENT_CONFIG.features?.enableMetricsEndpoint).toBe(true);
      expect(DEVELOPMENT_CONFIG.security?.enableCors).toBe(true);
    });

    it("should provide production configuration", () => {
      expect(PRODUCTION_CONFIG).toBeDefined();

      // Production should be secure and performant
      expect(PRODUCTION_CONFIG.logging?.level).toBe("warn");
      expect(PRODUCTION_CONFIG.features?.enableTestEndpoints).toBe(false);
      expect(PRODUCTION_CONFIG.features?.enableMetricsEndpoint).toBe(false);
      expect(PRODUCTION_CONFIG.security?.enableTls).toBe(true);
    });

    it("should provide test configuration", () => {
      expect(TEST_CONFIG).toBeDefined();

      // Test should be fast and quiet
      expect(TEST_CONFIG.logging?.level).toBe("error");
      expect(TEST_CONFIG.performance?.cacheEnabled).toBe(false);
      expect(TEST_CONFIG.database?.path).toContain("test");
    });

    it("should have different configurations for different environments", () => {
      const devLogging = DEVELOPMENT_CONFIG.logging?.level;
      const prodLogging = PRODUCTION_CONFIG.logging?.level;
      const testLogging = TEST_CONFIG.logging?.level;

      expect(devLogging).not.toBe(prodLogging);
      expect(prodLogging).not.toBe(testLogging);

      const devTestEndpoints = DEVELOPMENT_CONFIG.features?.enableTestEndpoints;
      const prodTestEndpoints = PRODUCTION_CONFIG.features?.enableTestEndpoints;

      expect(devTestEndpoints).not.toBe(prodTestEndpoints);
    });
  });

  describe("Environment Configuration Selection", () => {
    it("should return development config for development environment", () => {
      const config = getEnvironmentConfig("development");

      expect(config).toEqual(DEVELOPMENT_CONFIG);
    });

    it("should return production config for production environment", () => {
      const config = getEnvironmentConfig("production");

      expect(config).toEqual(PRODUCTION_CONFIG);
    });

    it("should return test config for test environment", () => {
      const config = getEnvironmentConfig("test");

      expect(config).toEqual(TEST_CONFIG);
    });

    it("should return production config for unknown environments", () => {
      const config = getEnvironmentConfig("staging");

      expect(config).toEqual(PRODUCTION_CONFIG);
    });

    it("should handle empty/undefined environment", () => {
      const config1 = getEnvironmentConfig("");
      const config2 = getEnvironmentConfig(undefined as any);

      expect(config1).toEqual(PRODUCTION_CONFIG);
      expect(config2).toEqual(PRODUCTION_CONFIG);
    });
  });

  describe("Configuration Structure Validation", () => {
    it("should have all required sections in default config", () => {
      const requiredSections = [
        "name",
        "version",
        "transport",
        "database",
        "performance",
        "logging",
        "security",
        "features",
        "environment",
      ];

      for (const section of requiredSections) {
        expect(DEFAULT_MCP_SERVER_CONFIG).toHaveProperty(section);
      }
    });

    it("should have all transport configuration properties", () => {
      const transport = DEFAULT_MCP_SERVER_CONFIG.transport;

      expect(transport).toHaveProperty("type");
      expect(transport).toHaveProperty("host");
      expect(transport).toHaveProperty("port");
      expect(transport).toHaveProperty("maxConnections");
      expect(transport).toHaveProperty("requestTimeout");
    });

    it("should have all performance configuration properties", () => {
      const perf = DEFAULT_MCP_SERVER_CONFIG.performance;

      expect(perf).toHaveProperty("maxConcurrentRequests");
      expect(perf).toHaveProperty("maxQueryResults");
      expect(perf).toHaveProperty("cacheEnabled");
      expect(perf).toHaveProperty("cacheSize");
      expect(perf).toHaveProperty("gcThreshold");
    });

    it("should have all logging configuration properties", () => {
      const logging = DEFAULT_MCP_SERVER_CONFIG.logging;

      expect(logging).toHaveProperty("level");
      expect(logging).toHaveProperty("enableConsole");
      expect(logging).toHaveProperty("enableFile");
      expect(logging).toHaveProperty("logRequestBody");
      expect(logging).toHaveProperty("logResponseBody");
    });

    it("should have all security configuration properties", () => {
      const security = DEFAULT_MCP_SERVER_CONFIG.security;

      expect(security).toHaveProperty("enableAuthentication");
      expect(security).toHaveProperty("enableCors");
      expect(security).toHaveProperty("corsOrigins");
      expect(security).toHaveProperty("rateLimitRequests");
      expect(security).toHaveProperty("enableTls");
    });

    it("should have all feature configuration properties", () => {
      const features = DEFAULT_MCP_SERVER_CONFIG.features;

      expect(features).toHaveProperty("enableTestEndpoints");
      expect(features).toHaveProperty("enableMetricsEndpoint");
      expect(features).toHaveProperty("enableHealthCheck");
      expect(features).toHaveProperty("enableWebInterface");
    });
  });

  describe("Configuration Merging Compatibility", () => {
    it("should be compatible with partial configurations", () => {
      const partialConfig: Partial<MCPServerConfig> = {
        name: "Test Server",
        transport: {
          type: "websocket",
          port: 8080,
        },
      };

      // Should be able to merge with defaults
      const merged = { ...DEFAULT_MCP_SERVER_CONFIG, ...partialConfig };

      expect(merged.name).toBe("Test Server");
      expect(merged.transport.type).toBe("websocket");
      expect(merged.transport.port).toBe(8080);
      // Note: host is not preserved in shallow merge since transport is replaced
      expect(merged.transport.host).toBeUndefined();
      expect(merged.version).toBe(DEFAULT_MCP_SERVER_CONFIG.version);
    });
  });
});
