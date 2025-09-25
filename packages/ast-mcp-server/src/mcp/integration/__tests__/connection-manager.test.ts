import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import {
  MCPConnectionManager,
  type ClientConnection,
} from "../connection-manager.js";
import { ASTMCPServer } from "../../server-core.js";
import { Transport, type ConnectionInfo } from "../../transport/base.js";
import {
  MCPRequest,
  MCPResponse,
  MCPNotification,
} from "../../protocol/types.js";

// Mock dependencies
vi.mock("../../../logging/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock transport implementation
class MockTransport extends Transport {
  constructor() {
    super();
  }

  getTransportType(): "stdio" | "websocket" {
    return "stdio";
  }

  async start(): Promise<void> {
    // Mock implementation
  }

  async stop(): Promise<void> {
    // Mock implementation
  }

  async sendMessage(connectionId: string, message: any): Promise<void> {
    // Mock implementation - emit sent event for testing
    this.emit("messageSent", { connectionId, message });
  }

  async closeConnection(connectionId: string): Promise<void> {
    // Mock implementation
    this.emit("disconnection", connectionId);
  }
}

// Mock server implementation
class MockASTMCPServer extends EventEmitter {
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    return {
      jsonrpc: "2.0",
      id: request.id || "default-id",
      result: { success: true },
    };
  }

  async handleNotification(notification: MCPNotification): Promise<void> {
    // Mock implementation
  }
}

// Helper to create valid ConnectionInfo
function createConnectionInfo(id: string, clientName: string): ConnectionInfo {
  return {
    id,
    state: "connected" as any,
    lastActivity: new Date(),
    clientInfo: { name: clientName, version: "1.0.0" },
    stats: {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
    },
  };
}

describe("MCPConnectionManager", () => {
  let connectionManager: MCPConnectionManager;
  let mockServer: MockASTMCPServer;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockServer = new MockASTMCPServer();
    connectionManager = new MCPConnectionManager(mockServer as any, {
      maxConnections: 5,
      connectionTimeout: 5000,
      cleanupInterval: 1000,
    });
    mockTransport = new MockTransport();
  });

  afterEach(async () => {
    await connectionManager.shutdown();
  });

  describe("Transport Management", () => {
    it("should add transport successfully", async () => {
      await connectionManager.addTransport(mockTransport);

      // Verify transport was added by checking if it responds to events
      const connectionInfo = createConnectionInfo(
        "test-connection-1",
        "test-client",
      );

      mockTransport.emit("connection", connectionInfo);

      const connection = connectionManager.getConnection("test-connection-1");
      expect(connection).toBeDefined();
      expect(connection?.id).toBe("test-connection-1");
    });

    it("should remove transport and cleanup connections", async () => {
      await connectionManager.addTransport(mockTransport);

      // Add a connection
      const connectionInfo = createConnectionInfo(
        "test-connection-1",
        "test-client",
      );
      mockTransport.emit("connection", connectionInfo);

      expect(
        connectionManager.getConnection("test-connection-1"),
      ).toBeDefined();

      await connectionManager.removeTransport(mockTransport);

      // Connection should be removed
      expect(
        connectionManager.getConnection("test-connection-1"),
      ).toBeUndefined();
    });

    it("should handle multiple transports", async () => {
      const transport2 = new MockTransport();

      await connectionManager.addTransport(mockTransport);
      await connectionManager.addTransport(transport2);

      // Add connections from different transports
      mockTransport.emit(
        "connection",
        createConnectionInfo("conn-1", "client-1"),
      );
      transport2.emit("connection", createConnectionInfo("conn-2", "client-2"));

      expect(connectionManager.getConnections()).toHaveLength(2);
      expect(connectionManager.getConnection("conn-1")).toBeDefined();
      expect(connectionManager.getConnection("conn-2")).toBeDefined();
    });
  });

  describe("Connection Management", () => {
    beforeEach(async () => {
      await connectionManager.addTransport(mockTransport);
    });

    it("should handle new connections", () => {
      const connectionInfo = createConnectionInfo(
        "test-connection-1",
        "test-client",
      );

      mockTransport.emit("connection", connectionInfo);

      const connection = connectionManager.getConnection("test-connection-1");
      expect(connection).toBeDefined();
      expect(connection?.isActive).toBe(true);
      expect(connection?.messageCount).toBe(0);
    });

    it("should reject connections when limit reached", async () => {
      // Fill up to the limit
      for (let i = 0; i < 5; i++) {
        mockTransport.emit(
          "connection",
          createConnectionInfo(`conn-${i}`, `client-${i}`),
        );
      }

      expect(connectionManager.getConnections()).toHaveLength(5);

      // This should be rejected
      mockTransport.emit(
        "connection",
        createConnectionInfo("conn-overflow", "overflow-client"),
      );

      expect(connectionManager.getConnection("conn-overflow")).toBeUndefined();
    });

    it("should handle disconnections", () => {
      const connectionInfo = createConnectionInfo(
        "test-connection-1",
        "test-client",
      );

      mockTransport.emit("connection", connectionInfo);
      expect(
        connectionManager.getConnection("test-connection-1"),
      ).toBeDefined();

      mockTransport.emit("disconnection", "test-connection-1");

      const connection = connectionManager.getConnection("test-connection-1");
      expect(connection?.isActive).toBe(false);
    });

    it("should handle connection errors", () => {
      const connectionInfo = createConnectionInfo(
        "test-connection-1",
        "test-client",
      );

      mockTransport.emit("connection", connectionInfo);

      const error = new Error("Connection error");
      mockTransport.emit("error", "test-connection-1", error);

      const connection = connectionManager.getConnection("test-connection-1");
      expect(connection?.isActive).toBe(false);
    });
  });

  describe("Message Handling", () => {
    beforeEach(async () => {
      await connectionManager.addTransport(mockTransport);

      // Add a test connection
      mockTransport.emit(
        "connection",
        createConnectionInfo("test-connection-1", "test-client"),
      );
    });

    it("should handle request messages", async () => {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "req-1",
        method: "test/method",
        params: { test: true },
      };

      // Mock server response
      vi.spyOn(mockServer, "handleRequest").mockResolvedValue({
        jsonrpc: "2.0",
        id: "req-1",
        result: { success: true },
      });

      mockTransport.emit("message", "test-connection-1", request);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.handleRequest).toHaveBeenCalledWith(request);
    });

    it("should handle notification messages", async () => {
      const notification: MCPNotification = {
        jsonrpc: "2.0",
        method: "test/notification",
        params: { test: true },
      };

      vi.spyOn(mockServer, "handleNotification").mockResolvedValue();

      mockTransport.emit("message", "test-connection-1", notification);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.handleNotification).toHaveBeenCalledWith(notification);
    });

    it("should send messages to connections", async () => {
      const response: MCPResponse = {
        jsonrpc: "2.0",
        id: "req-1",
        result: { success: true },
      };

      vi.spyOn(mockTransport, "sendMessage").mockResolvedValue();

      await connectionManager.sendMessage("test-connection-1", response);

      expect(mockTransport.sendMessage).toHaveBeenCalledWith(
        "test-connection-1",
        expect.objectContaining({
          type: "response",
          payload: response,
        }),
      );
    });

    it("should broadcast messages to all connections", async () => {
      // Add another connection
      mockTransport.emit(
        "connection",
        createConnectionInfo("test-connection-2", "test-client-2"),
      );

      const notification: MCPNotification = {
        jsonrpc: "2.0",
        method: "test/broadcast",
        params: { message: "broadcast test" },
      };

      vi.spyOn(mockTransport, "sendMessage").mockResolvedValue();

      await connectionManager.broadcastMessage(notification);

      expect(mockTransport.sendMessage).toHaveBeenCalledTimes(2);
    });

    it("should handle invalid messages", async () => {
      const invalidMessage = { invalid: true };

      // Spy on server methods to ensure they aren't called
      const handleRequestSpy = vi.spyOn(mockServer, "handleRequest");
      const handleNotificationSpy = vi.spyOn(mockServer, "handleNotification");

      mockTransport.emit("message", "test-connection-1", invalidMessage);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not call server handlers for invalid messages
      expect(handleRequestSpy).not.toHaveBeenCalled();
      expect(handleNotificationSpy).not.toHaveBeenCalled();
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await connectionManager.addTransport(mockTransport);
    });

    it("should provide connection statistics", () => {
      // Add connections
      for (let i = 0; i < 3; i++) {
        mockTransport.emit(
          "connection",
          createConnectionInfo(`conn-${i}`, `client-${i}`),
        );
      }

      const stats = connectionManager.getStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.activeConnections).toBe(3);
      expect(stats.connectionsByTransport.stdio).toBe(3);
    });

    it("should track message counts", async () => {
      // Add connection
      mockTransport.emit(
        "connection",
        createConnectionInfo("test-connection-1", "test-client"),
      );

      // Send some messages
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: "req-1",
        method: "test/method",
        params: {},
      };

      vi.spyOn(mockServer, "handleRequest").mockResolvedValue({
        jsonrpc: "2.0",
        id: "req-1",
        result: {},
      });

      for (let i = 0; i < 5; i++) {
        mockTransport.emit("message", "test-connection-1", request);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const connection = connectionManager.getConnection("test-connection-1");
      expect(connection?.messageCount).toBe(5);
    });
  });

  describe("Shutdown", () => {
    it("should shutdown gracefully", async () => {
      await connectionManager.addTransport(mockTransport);

      // Add connections
      mockTransport.emit(
        "connection",
        createConnectionInfo("test-connection-1", "test-client"),
      );

      vi.spyOn(mockTransport, "sendMessage").mockResolvedValue();

      await connectionManager.shutdown();

      expect(mockTransport.sendMessage).toHaveBeenCalledWith(
        "test-connection-1",
        expect.objectContaining({
          type: "notification",
          method: "notifications/cancelled",
        }),
      );

      expect(connectionManager.getConnections()).toHaveLength(0);
    });
  });
});
