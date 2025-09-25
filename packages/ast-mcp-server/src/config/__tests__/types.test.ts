import { describe, it, expect } from "vitest";
import { MCPServerConfig } from "../types.js";

describe("Configuration Types", () => {
  describe("MCPServerConfig Interface", () => {
    it("should accept a complete configuration object", () => {
      const config: MCPServerConfig = {
        name: "Test Server",
        version: "1.0.0",
        transport: {
          type: "stdio",
          host: "localhost",
          port: 8080,
          maxConnections: 100,
          requestTimeout: 30000,
        },
        database: {
          path: "./test.db",
          hotReload: false,
          backupEnabled: true,
          backupInterval: 3600,
        },
        performance: {
          maxConcurrentRequests: 50,
          requestQueueSize: 1000,
          requestTimeout: 30000,
          maxMemoryUsage: 512,
          gcThreshold: 0.8,
          enableGcMetrics: false,
          maxQueryResults: 1000,
          queryTimeout: 15000,
          cacheEnabled: true,
          cacheSize: 100,
          cacheTtl: 300,
          dbPoolSize: 5,
          dbTimeout: 10000,
        },
        logging: {
          level: "info",
          enableConsole: true,
          enableFile: false,
          filePath: "./logs/server.log",
          maxFileSize: "10MB",
          maxFiles: 5,
          logRequestBody: false,
          logResponseBody: false,
        },
        security: {
          enableAuthentication: true,
          enableCors: true,
          corsOrigins: ["http://localhost:3000"],
          rateLimitRequests: 1000,
          rateLimitWindow: 900,
          enableTls: false,
          tlsConfig: {
            certFile: "./certs/server.crt",
            keyFile: "./certs/server.key",
            caFile: "./certs/ca.crt",
          },
        },
        features: {
          enableTools: true,
          enableResources: true,
          enablePrompts: true,
          enableLogging: true,
          enableHotReload: false,
          enableWebInterface: false,
          enableHealthCheck: true,
          enableMetricsEndpoint: false,
          enableTestEndpoints: false,
          experimental: {
            enableStreaming: true,
            enableBatching: false,
            enableCompression: false,
            enableCaching: true,
          },
        },
        environment: {
          nodeEnv: "production",
          production: {
            enableCompression: true,
            enableClustering: false,
          },
        },
      };

      // Should compile without errors
      expect(config.name).toBe("Test Server");
      expect(config.version).toBe("1.0.0");
      expect(config.transport.type).toBe("stdio");
      expect(config.database.path).toBe("./test.db");
    });

    it("should accept partial configuration objects", () => {
      const partialConfig: Partial<MCPServerConfig> = {
        name: "Partial Server",
        transport: {
          type: "websocket",
          port: 9000,
        },
        logging: {
          level: "debug",
        },
      };

      expect(partialConfig.name).toBe("Partial Server");
      expect(partialConfig.transport?.type).toBe("websocket");
      expect(partialConfig.transport?.port).toBe(9000);
      expect(partialConfig.logging?.level).toBe("debug");
    });
  });

  describe("Transport Types", () => {
    it("should accept valid transport types", () => {
      const stdioTransport: MCPServerConfig["transport"] = {
        type: "stdio",
      };

      const websocketTransport: MCPServerConfig["transport"] = {
        type: "websocket",
        port: 8080,
      };

      const httpTransport: MCPServerConfig["transport"] = {
        type: "http",
        port: 3000,
        host: "0.0.0.0",
      };

      expect(stdioTransport.type).toBe("stdio");
      expect(websocketTransport.type).toBe("websocket");
      expect(httpTransport.type).toBe("http");
    });
  });

  describe("Log Level Types", () => {
    it("should accept valid log levels", () => {
      const levels: Array<MCPServerConfig["logging"]["level"]> = [
        "error",
        "warn",
        "info",
        "debug",
        "trace",
      ];

      levels.forEach((level) => {
        const config: Partial<MCPServerConfig> = {
          logging: { level },
        };
        expect(config.logging?.level).toBe(level);
      });
    });
  });

  describe("Configuration Load Options", () => {
    it("should accept valid load options", () => {
      const options: import("../types.js").ConfigLoadOptions = {
        configFile: "./config.json",
        validateConfig: true,
        strictMode: false,
        allowEnvironmentOverrides: true,
      };

      expect(options.configFile).toBe("./config.json");
      expect(options.validateConfig).toBe(true);
      expect(options.strictMode).toBe(false);
      expect(options.allowEnvironmentOverrides).toBe(true);
    });

    it("should allow empty options object", () => {
      const options: import("../types.js").ConfigLoadOptions = {};

      expect(options).toEqual({});
    });
  });

  describe("Configuration Sources", () => {
    it("should accept valid configuration sources", () => {
      const sources: Array<import("../types.js").ConfigSource> = [
        { type: "default", priority: 0 },
        { type: "file", path: "./config.json", priority: 1 },
        { type: "environment", priority: 2 },
        { type: "programmatic", priority: 3 },
      ];

      sources.forEach((source, index) => {
        expect(source.priority).toBe(index);
        expect(["default", "file", "environment", "programmatic"]).toContain(
          source.type,
        );
      });
    });
  });

  describe("Validation Results", () => {
    it("should accept valid validation results", () => {
      const validResult: import("../types.js").ConfigValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      const invalidResult: import("../types.js").ConfigValidationResult = {
        isValid: false,
        errors: ["Invalid port number", "Missing database path"],
        warnings: ["High concurrency setting may impact performance"],
      };

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validResult.warnings).toHaveLength(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
      expect(invalidResult.warnings).toHaveLength(1);
    });
  });

  describe("Optional Properties", () => {
    it("should allow optional properties to be undefined", () => {
      const minimalConfig: MCPServerConfig = {
        name: "Minimal Server",
        version: "1.0.0",
        transport: {
          type: "stdio",
        },
        database: {
          path: "./test.db",
        },
        performance: {},
        logging: {
          level: "info",
        },
        security: {},
        features: {},
        environment: {
          nodeEnv: "production",
        },
      };

      // Should compile and work with minimal required properties
      expect(minimalConfig.name).toBe("Minimal Server");
      expect(minimalConfig.transport.port).toBeUndefined();
      expect(minimalConfig.performance.maxConcurrentRequests).toBeUndefined();
      expect(minimalConfig.security.enableAuthentication).toBeUndefined();
    });
  });

  describe("Nested Configuration Objects", () => {
    it("should support deep nested configurations", () => {
      const config: MCPServerConfig = {
        name: "Nested Test",
        version: "1.0.0",
        transport: { type: "stdio" },
        database: { path: "./test.db" },
        performance: {},
        logging: { level: "info" },
        security: {
          tlsConfig: {
            certFile: "./cert.pem",
            keyFile: "./key.pem",
            caFile: "./ca.pem",
          },
        },
        features: {
          experimental: {
            enableStreaming: true,
            enableBatching: false,
            enableCaching: true,
          },
        },
        environment: {
          nodeEnv: "development",
        },
      };

      expect(config.security.tlsConfig?.certFile).toBe("./cert.pem");
      expect(config.features.experimental?.enableStreaming).toBe(true);
      expect(config.features.experimental?.enableBatching).toBe(false);
    });
  });
});
