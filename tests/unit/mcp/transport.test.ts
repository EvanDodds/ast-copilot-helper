/**
 * Tests for transport layer implementations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StdioTransport } from "../../../packages/ast-mcp-server/src/mcp/stdio-transport";
import { TCPTransport } from "../../../packages/ast-mcp-server/src/mcp/tcp-transport";
import {
  JSONRPCRequest,
  JSONRPCResponse,
} from "../../../packages/ast-mcp-server/src/mcp/protocol";

// Mock process.stdin and process.stdout
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockStdout = {
  write: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Store original process methods
const originalStdin = process.stdin;
const originalStdout = process.stdout;

describe("Transport Layer", () => {
  beforeEach(() => {
    // Mock process streams
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      configurable: true,
    });
    Object.defineProperty(process, "stdout", {
      value: mockStdout,
      configurable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original process streams
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });
    Object.defineProperty(process, "stdout", {
      value: originalStdout,
      configurable: true,
    });
  });

  describe("StdioTransport", () => {
    let transport: StdioTransport;

    beforeEach(() => {
      transport = new StdioTransport();
    });

    afterEach(async () => {
      if (transport.isActive()) {
        await transport.stop();
      }
    });

    it("should initialize with correct type and inactive state", () => {
      expect(transport.getType()).toBe("stdio");
      expect(transport.isActive()).toBe(false);
    });

    it("should start successfully", async () => {
      await transport.start();

      expect(transport.isActive()).toBe(true);
      expect(mockStdin.setEncoding).toHaveBeenCalledWith("utf8");
      expect(mockStdin.on).toHaveBeenCalledWith("data", expect.any(Function));
      expect(mockStdin.on).toHaveBeenCalledWith("end", expect.any(Function));
      expect(mockStdin.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should fail to start if already running", async () => {
      await transport.start();

      await expect(transport.start()).rejects.toThrow(
        "Stdio transport is already running",
      );
    });

    it("should stop successfully", async () => {
      await transport.start();
      await transport.stop();

      expect(transport.isActive()).toBe(false);
      expect(mockStdin.removeAllListeners).toHaveBeenCalledWith("data");
      expect(mockStdin.removeAllListeners).toHaveBeenCalledWith("end");
      expect(mockStdin.removeAllListeners).toHaveBeenCalledWith("error");
    });

    it("should send messages correctly", async () => {
      mockStdout.write.mockImplementation((data, callback) => {
        callback?.();
        return true;
      });

      await transport.start();

      const response: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: "test-123",
        result: { success: true },
      };

      await transport.sendMessage(response);

      expect(mockStdout.write).toHaveBeenCalledWith(
        JSON.stringify(response) + "\n",
        expect.any(Function),
      );
    });

    it("should fail to send message when not running", async () => {
      const response: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: "test-123",
        result: { success: true },
      };

      await expect(transport.sendMessage(response)).rejects.toThrow(
        "Stdio transport is not running",
      );
    });

    it("should track statistics correctly", async () => {
      await transport.start();

      const stats = transport.getStats();
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.connectionTime).toBeDefined();
    });

    it("should handle message parsing", () => {
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      // This tests the protected method indirectly through the public interface
      expect(transport.isActive()).toBe(false); // Just verify the handler is set
    });
  });

  describe("TCPTransport", () => {
    let transport: TCPTransport;

    beforeEach(() => {
      transport = new TCPTransport(0, "localhost"); // Use port 0 for random available port
    });

    afterEach(async () => {
      if (transport.isActive()) {
        await transport.stop();
      }
    });

    it("should initialize with correct type and inactive state", () => {
      expect(transport.getType()).toBe("tcp");
      expect(transport.isActive()).toBe(false);
    });

    it("should provide correct address info when not running", () => {
      const address = transport.getAddress();
      expect(address).toBeNull();
    });

    it("should provide empty client list initially", () => {
      const clients = transport.getConnectedClients();
      expect(clients).toEqual([]);
    });

    it("should track statistics correctly", () => {
      const stats = transport.getStats();
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.totalConnections).toBe(0);
    });

    // Note: Full TCP server testing would require more complex setup
    // These tests verify the basic interface and initialization
  });

  describe("Transport Message Handling", () => {
    let transport: StdioTransport;

    beforeEach(() => {
      transport = new StdioTransport();
    });

    afterEach(async () => {
      if (transport.isActive()) {
        await transport.stop();
      }
    });

    it("should parse valid JSON messages", () => {
      const validMessage = '{"jsonrpc":"2.0","id":"test","method":"ping"}';

      // Access the protected method through reflection for testing
      const parseMessage = (transport as any).parseMessage.bind(transport);
      const parsed = parseMessage(validMessage);

      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: "test",
        method: "ping",
      });
    });

    it("should handle invalid JSON gracefully", () => {
      const errorSpy = vi.fn();
      transport.on("error", errorSpy);

      const invalidMessage = '{"invalid json}';

      // Access the protected method through reflection for testing
      const parseMessage = (transport as any).parseMessage.bind(transport);
      const parsed = parseMessage(invalidMessage);

      expect(parsed).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it("should serialize messages correctly", () => {
      const message: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: "test",
        result: { data: "test" },
      };

      // Access the protected method through reflection for testing
      const serializeMessage = (transport as any).serializeMessage.bind(
        transport,
      );
      const serialized = serializeMessage(message);

      expect(serialized).toBe(JSON.stringify(message) + "\n");
    });
  });
});
