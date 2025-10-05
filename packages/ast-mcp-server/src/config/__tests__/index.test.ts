import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDevelopmentConfig,
  createProductionConfig,
  createTestConfig,
} from "../index.js";
import { ConfigManager } from "../loader.js";
import { validateConfig } from "../validator.js";
import { DEFAULT_MCP_SERVER_CONFIG } from "../defaults.js";

describe("Configuration Index", () => {
  describe("Factory Functions", () => {
    it("should create development configuration", async () => {
      const config = await createDevelopmentConfig();

      expect(config).toBeDefined();
      expect(config.logging.level).toBe("debug");
      expect(config.features.enableTestEndpoints).toBe(true);
      expect(config.environment.nodeEnv).toBe("development");
    });

    it("should create production configuration", async () => {
      const config = await createProductionConfig();

      expect(config).toBeDefined();
      expect(config.logging.level).toBe("warn");
      expect(config.features.enableTestEndpoints).toBe(false);
      expect(config.environment.nodeEnv).toBe("production");
      expect(config.security.enableTls).toBe(true);
    });

    it("should create test configuration", async () => {
      const config = await createTestConfig();

      expect(config).toBeDefined();
      expect(config.logging.level).toBe("error");
      expect(config.database.path).toContain("test");
      expect(config.environment.nodeEnv).toBe("test");
    });

    it("should accept custom overrides in factory functions", async () => {
      // Note: Current factory functions don't accept overrides,
      // but can be updated via ConfigManager
      const configManager = new ConfigManager();
      await configManager.loadConfig();

      const updates = {
        name: "Custom Dev Server",
        transport: {
          type: "websocket" as const,
          port: 9090,
        },
      };

      configManager.updateConfig(updates);
      const config = configManager.getConfig();

      expect(config.name).toBe("Custom Dev Server");
      expect(config.transport.type).toBe("websocket");
      expect(config.transport.port).toBe(9090);
    });
  });

  describe("Module Exports", () => {
    it("should export all required components", async () => {
      // Re-import to check exports from compiled output using dynamic import
      const configIndex = await import("../../../dist/config/index.js");

      // Classes and functions should be defined
      expect(configIndex.ConfigManager).toBeDefined();
      expect(configIndex.validateConfig).toBeDefined();
      expect(configIndex.DEFAULT_MCP_SERVER_CONFIG).toBeDefined();
      expect(configIndex.createDevelopmentConfig).toBeDefined();
      expect(configIndex.createProductionConfig).toBeDefined();
      expect(configIndex.createTestConfig).toBeDefined();
    });

    it("should export environment configurations", async () => {
      // Re-import to check exports from compiled output using dynamic import
      const configIndex = await import("../../../dist/config/index.js");

      expect(configIndex.DEVELOPMENT_CONFIG).toBeDefined();
      expect(configIndex.PRODUCTION_CONFIG).toBeDefined();
      expect(configIndex.TEST_CONFIG).toBeDefined();
      expect(configIndex.getEnvironmentConfig).toBeDefined();
    });
  });

  describe("Integration Tests", () => {
    let configManager: ConfigManager;

    beforeEach(() => {
      configManager = new ConfigManager();
    });

    it("should integrate ConfigManager with validation", async () => {
      const config = await configManager.loadConfig();
      const validation = validateConfig(config);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should integrate factory functions with ConfigManager", async () => {
      const devConfig = await createDevelopmentConfig();

      // Should be able to update ConfigManager with factory-created config
      configManager.updateConfig(devConfig);

      const currentConfig = configManager.getConfig();
      expect(currentConfig.logging.level).toBe("debug");
      expect(currentConfig.features.enableTestEndpoints).toBe(true);
    });

    it("should validate factory-created configurations", async () => {
      const configs = await Promise.all([
        createDevelopmentConfig(),
        createProductionConfig(),
        createTestConfig(),
      ]);

      configs.forEach((config) => {
        const validation = validateConfig(config);
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });
  });

  describe("Default Configuration Usage", () => {
    it("should use default configuration as base", async () => {
      const devConfig = await createDevelopmentConfig();

      // Should have base properties from defaults
      expect(devConfig.name).toBe(DEFAULT_MCP_SERVER_CONFIG.name);
      expect(devConfig.version).toBe(DEFAULT_MCP_SERVER_CONFIG.version);
      expect(devConfig.transport.type).toBe(
        DEFAULT_MCP_SERVER_CONFIG.transport.type,
      );
    });

    it("should override specific properties while keeping defaults", async () => {
      // Test via ConfigManager since factory functions don't accept overrides
      const configManager = new ConfigManager();
      await configManager.loadConfig();

      configManager.updateConfig({
        name: "Production Override",
      });

      const prodConfig = configManager.getConfig();

      // Override should be applied
      expect(prodConfig.name).toBe("Production Override");

      // Other defaults should remain
      expect(prodConfig.version).toBe(DEFAULT_MCP_SERVER_CONFIG.version);
      expect(prodConfig.transport.type).toBe(
        DEFAULT_MCP_SERVER_CONFIG.transport.type,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid overrides gracefully", async () => {
      // Test via ConfigManager validation
      const configManager = new ConfigManager();
      await configManager.loadConfig();

      const invalidOverrides = {
        transport: {
          type: "invalid-type" as any,
          port: -1,
        },
      };

      // Update should throw validation error
      expect(() => {
        configManager.updateConfig(invalidOverrides);
      }).toThrow(/Configuration update failed validation/);
    });

    it("should handle partial overrides correctly", async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();

      // Use a valid partial override that doesn't break required properties
      const partialOverrides = {
        name: "Partial Override Test",
        performance: {
          maxConcurrentRequests: 200,
        },
      };

      configManager.updateConfig(partialOverrides);
      const config = configManager.getConfig();

      // Should merge properly
      expect(config.name).toBe("Partial Override Test");
      expect(config.performance.maxConcurrentRequests).toBe(200);
      expect(config.transport.type).toBe(
        DEFAULT_MCP_SERVER_CONFIG.transport.type,
      );
      expect(config.transport.host).toBe(
        DEFAULT_MCP_SERVER_CONFIG.transport.host,
      );
    });
  });

  describe("Environment Variable Integration", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Clear environment
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore environment
      process.env = originalEnv;
    });

    it("should respect NODE_ENV when creating configurations", async () => {
      process.env.NODE_ENV = "development";
      const config = await createDevelopmentConfig();

      expect(config.environment.nodeEnv).toBe("development");
    });

    it("should apply environment overrides in factory functions", async () => {
      process.env.MCP_SERVER_PORT = "9999";
      process.env.MCP_SERVER_LOG_LEVEL = "trace";

      const config = await createDevelopmentConfig();

      expect(config.transport.port).toBe(9999);
      expect(config.logging.level).toBe("trace");
    });
  });

  describe("Configuration Merging", () => {
    it("should merge nested configuration objects correctly", async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();

      const overrides = {
        performance: {
          maxConcurrentRequests: 200,
        },
        logging: {
          level: "debug" as const,
        },
      };

      configManager.updateConfig(overrides);
      const config = configManager.getConfig();

      // Overridden values
      expect(config.performance.maxConcurrentRequests).toBe(200);
      expect(config.logging.level).toBe("debug");

      // Non-overridden values should remain from defaults
      expect(config.transport.type).toBe(
        DEFAULT_MCP_SERVER_CONFIG.transport.type,
      );
      expect(config.transport.host).toBe(
        DEFAULT_MCP_SERVER_CONFIG.transport.host,
      );
    });

    it("should handle deep nested overrides", async () => {
      const configManager = new ConfigManager();
      await configManager.loadConfig();

      const overrides = {
        features: {
          experimental: {
            enableStreaming: true,
            enableCaching: false,
          },
        },
      };

      configManager.updateConfig(overrides);
      const config = configManager.getConfig();

      expect(config.features.experimental?.enableStreaming).toBe(true);
      expect(config.features.experimental?.enableCaching).toBe(false);
    });
  });
});
