/**
 * Transport integration tests
 */

import { describe, it, expect, afterEach } from "vitest";
import { Transport } from "../../../packages/ast-mcp-server/src/mcp/transport/base";
import {
  StdioTransport,
  StdioTransportConfig,
} from "../../../packages/ast-mcp-server/src/mcp/transport/stdio";
import {
  WebSocketTransport,
  WebSocketTransportConfig,
} from "../../../packages/ast-mcp-server/src/mcp/transport/websocket";
import type { TransportConfig } from "../../../packages/ast-mcp-server/src/mcp/transport/base";

// Recreate factory and utils classes for testing
class TransportFactory {
  static createStdio(config?: StdioTransportConfig): StdioTransport {
    return new StdioTransport(config);
  }

  static createWebSocket(
    config?: WebSocketTransportConfig,
  ): WebSocketTransport {
    return new WebSocketTransport(config);
  }

  static createAuto(config?: TransportConfig): Transport {
    // Auto-detect based on configuration
    if ("url" in (config || {}) || "port" in (config || {})) {
      return new WebSocketTransport(config as WebSocketTransportConfig);
    }

    // Default to STDIO for command-line/VS Code integration
    return new StdioTransport(config as StdioTransportConfig);
  }
}

class TransportUtils {
  static validateConfig(config: any): { valid: boolean; error?: string } {
    if (!config || typeof config !== "object") {
      return { valid: false, error: "Config must be an object" };
    }

    // Basic validation for known transport types
    if ("url" in config || "port" in config) {
      // WebSocket config validation
      if ("url" in config && typeof config.url !== "string") {
        return { valid: false, error: "WebSocket URL must be a string" };
      }
      if (
        "port" in config &&
        (typeof config.port !== "number" ||
          config.port <= 0 ||
          config.port > 65535)
      ) {
        return {
          valid: false,
          error: "Port must be a number between 1 and 65535",
        };
      }
    }

    // Check for invalid combinations
    if ("input" in config && "url" in config) {
      return {
        valid: false,
        error: "Cannot specify both input/output streams and WebSocket URL",
      };
    }

    return { valid: true };
  }

  static getTransportType(config: any): "stdio" | "websocket" | "unknown" {
    if (!config || typeof config !== "object") {
      return "unknown";
    }

    if ("url" in config || "port" in config) {
      return "websocket";
    }

    return "stdio";
  }

  static createStatsSummary(transport: Transport): any {
    const stats = transport.getConnectionStats();
    const connections = transport.getConnections();
    return {
      type: (transport as any).getTransportType(),
      connected: transport.getState() === "connected",
      connectionsCount: connections.length,
      totalMessages: stats.totalMessages,
      totalErrors: stats.totalErrors,
    };
  }
}

describe("Transport Integration Tests", () => {
  let transport: Transport;

  afterEach(async () => {
    if (transport) {
      await transport.stop().catch(() => {});
    }
  });

  describe("TransportFactory", () => {
    it("should create STDIO transport", () => {
      transport = TransportFactory.createStdio();
      expect(transport).toBeInstanceOf(StdioTransport);
      expect(transport.getState()).toBe("disconnected");
    });

    it("should create STDIO transport with custom config", () => {
      transport = TransportFactory.createStdio({
        lineBuffering: false,
        maxLineLength: 1024,
      });
      expect(transport).toBeInstanceOf(StdioTransport);
      expect((transport as StdioTransport).supportsMultipleConnections()).toBe(
        false,
      );
    });

    it("should create WebSocket transport", () => {
      transport = TransportFactory.createWebSocket();
      expect(transport).toBeInstanceOf(WebSocketTransport);
      expect(transport.getState()).toBe("disconnected");
    });

    it("should create WebSocket transport with custom config", () => {
      transport = TransportFactory.createWebSocket({
        port: 8080,
        maxConnections: 10,
      });
      expect(transport).toBeInstanceOf(WebSocketTransport);
      expect(
        (transport as WebSocketTransport).supportsMultipleConnections(),
      ).toBe(true);
    });

    it("should auto-create STDIO transport by default", () => {
      transport = TransportFactory.createAuto();
      expect(transport).toBeInstanceOf(StdioTransport);
    });

    it("should auto-create WebSocket transport when URL provided", () => {
      transport = TransportFactory.createAuto({
        url: "ws://localhost:8080",
      } as any);
      expect(transport).toBeInstanceOf(WebSocketTransport);
    });

    it("should auto-create WebSocket transport when port provided", () => {
      transport = TransportFactory.createAuto({
        port: 8080,
      } as any);
      expect(transport).toBeInstanceOf(WebSocketTransport);
    });
  });

  describe("TransportUtils", () => {
    describe("validateConfig", () => {
      it("should validate empty config", () => {
        const result = TransportUtils.validateConfig({});
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject non-object config", () => {
        const result = TransportUtils.validateConfig(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Config must be an object");
      });

      it("should reject invalid WebSocket URL", () => {
        const result = TransportUtils.validateConfig({ url: 123 });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("WebSocket URL must be a string");
      });

      it("should reject invalid port", () => {
        const result = TransportUtils.validateConfig({ port: -1 });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Port must be a number between 1 and 65535");
      });

      it("should reject port too high", () => {
        const result = TransportUtils.validateConfig({ port: 99999 });
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Port must be a number between 1 and 65535");
      });

      it("should reject mixed stream and URL config", () => {
        const result = TransportUtils.validateConfig({
          input: process.stdin,
          url: "ws://localhost:8080",
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe(
          "Cannot specify both input/output streams and WebSocket URL",
        );
      });
    });

    describe("getTransportType", () => {
      it("should detect stdio transport", () => {
        const result = TransportUtils.getTransportType({});
        expect(result).toBe("stdio");
      });

      it("should detect websocket transport by URL", () => {
        const result = TransportUtils.getTransportType({
          url: "ws://localhost:8080",
        });
        expect(result).toBe("websocket");
      });

      it("should detect websocket transport by port", () => {
        const result = TransportUtils.getTransportType({ port: 8080 });
        expect(result).toBe("websocket");
      });

      it("should return unknown for invalid config", () => {
        const result = TransportUtils.getTransportType(null);
        expect(result).toBe("unknown");
      });
    });

    describe("createStatsSummary", () => {
      it("should create stats summary for STDIO transport", () => {
        transport = TransportFactory.createStdio();
        const summary = TransportUtils.createStatsSummary(transport);

        expect(summary).toMatchObject({
          type: "stdio",
          connected: false,
          connectionsCount: 0,
          totalMessages: 0,
          totalErrors: 0,
        });
      });

      it("should create stats summary for WebSocket transport", () => {
        transport = TransportFactory.createWebSocket();
        const summary = TransportUtils.createStatsSummary(transport);

        expect(summary).toMatchObject({
          type: "websocket",
          connected: false,
          connectionsCount: 0,
          totalMessages: 0,
          totalErrors: 0,
        });
      });
    });
  });

  describe("Transport Cross-compatibility", () => {
    it("should have consistent API across transport types", () => {
      const stdioTransport = TransportFactory.createStdio();
      const websocketTransport = TransportFactory.createWebSocket();

      // Both should extend Transport base class
      expect(stdioTransport).toBeInstanceOf(Transport);
      expect(websocketTransport).toBeInstanceOf(Transport);

      // Both should have required abstract methods
      expect(stdioTransport.getTransportType).toBeTypeOf("function");
      expect(websocketTransport.getTransportType).toBeTypeOf("function");
      expect(stdioTransport.start).toBeTypeOf("function");
      expect(websocketTransport.start).toBeTypeOf("function");
      expect(stdioTransport.stop).toBeTypeOf("function");
      expect(websocketTransport.stop).toBeTypeOf("function");
      expect(stdioTransport.sendMessage).toBeTypeOf("function");
      expect(websocketTransport.sendMessage).toBeTypeOf("function");
      expect(stdioTransport.closeConnection).toBeTypeOf("function");
      expect(websocketTransport.closeConnection).toBeTypeOf("function");

      // Both should have base class methods
      expect(stdioTransport.getState).toBeTypeOf("function");
      expect(websocketTransport.getState).toBeTypeOf("function");
      expect(stdioTransport.getConnections).toBeTypeOf("function");
      expect(websocketTransport.getConnections).toBeTypeOf("function");
      expect(stdioTransport.getConnectionStats).toBeTypeOf("function");
      expect(websocketTransport.getConnectionStats).toBeTypeOf("function");

      // Both should have specific implementation methods
      expect(
        (stdioTransport as StdioTransport).supportsMultipleConnections,
      ).toBeTypeOf("function");
      expect(
        (websocketTransport as WebSocketTransport).supportsMultipleConnections,
      ).toBeTypeOf("function");
    });

    it("should handle lifecycle consistently", async () => {
      const transports = [
        TransportFactory.createStdio(),
        TransportFactory.createWebSocket(),
      ];

      for (const transport of transports) {
        // Initial state should be disconnected
        expect(transport.getState()).toBe("disconnected");

        // Should have no connections initially
        expect(transport.getConnections()).toHaveLength(0);

        // Stats should be initialized
        const stats = transport.getConnectionStats();
        expect(stats.totalConnections).toBe(0);
        expect(stats.activeConnections).toBe(0);
        expect(stats.totalMessages).toBe(0);
        expect(stats.totalErrors).toBe(0);

        // Should be able to stop even if not started
        await expect(transport.stop()).resolves.not.toThrow();
      }
    });
  });
});
