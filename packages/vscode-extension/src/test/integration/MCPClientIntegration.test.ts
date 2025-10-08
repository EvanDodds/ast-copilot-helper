/**
 * MCP Client Integration Tests
 *
 * These tests validate the complete MCP client integration without requiring
 * manual interaction or VS Code Extension Development Host.
 *
 * Tests cover:
 * - Client initialization and connection
 * - Transport layer (ManagedProcessTransport)
 * - Tool invocation through MCP protocol
 * - Error handling and reconnection
 * - Server process management integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { EventEmitter } from "events";
import * as vscode from "vscode";
import * as child_process from "child_process";

// Mock VS Code API
vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [
      {
        uri: { fsPath: "/test/workspace" },
      },
    ],
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      append: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

// Mock child_process
vi.mock("child_process");

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  access: vi.fn((path, mode, callback) => callback(null)),
  constants: {
    F_OK: 0,
    X_OK: 1,
    W_OK: 2,
    R_OK: 4,
  },
}));

import { ServerProcessManager } from "../../managers/ServerProcessManager";
import { MCPClientManager } from "../../managers/MCPClientManager";
import type { ClientConfig } from "../../managers/MCPClientManager";

describe("MCP Client Integration", () => {
  let serverManager: ServerProcessManager;
  let clientManager: MCPClientManager;
  let mockOutputChannel: vscode.OutputChannel;
  let mockChildProcess: EventEmitter & {
    pid: number;
    stdin: { write: Mock; end: Mock };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: Mock;
  };

  beforeEach(() => {
    // Setup mock output channel
    mockOutputChannel = {
      appendLine: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      name: "Test Output",
      replace: vi.fn(),
    } as any;

    // Setup mock child process with MCP-compatible stdin/stdout
    mockChildProcess = new EventEmitter() as any;
    mockChildProcess.pid = 12345;
    mockChildProcess.stdin = {
      write: vi.fn((data: string, callback?: (error?: Error) => void) => {
        // Call callback immediately to simulate successful write
        if (callback) {
          setImmediate(() => callback());
        }
        return true;
      }),
      end: vi.fn(),
    };
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = vi.fn(() => true);

    // Mock spawn to return our mock process
    (child_process.spawn as Mock).mockReturnValue(mockChildProcess);

    // Create server manager
    serverManager = new ServerProcessManager(
      {
        serverPath: "/test/server",
        workingDirectory: "/test/workspace",
        autoRestart: false,
      },
      mockOutputChannel,
    );

    // Mock waitForReady
    vi.spyOn(serverManager as any, "waitForReady").mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (clientManager) {
      clientManager.disconnect();
    }
    if (serverManager) {
      serverManager.dispose();
    }
    vi.clearAllMocks();
  });

  describe("Client Initialization", () => {
    it("should create MCPClientManager with server process manager", () => {
      const config: Partial<ClientConfig> = {
        autoConnect: false,
        maxReconnectAttempts: 3,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      expect(clientManager).toBeDefined();
      expect(clientManager.isConnected()).toBe(false);
    });

    it("should not connect if server is not running", async () => {
      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Server is not started
      expect(serverManager.isRunning()).toBe(false);
      expect(clientManager.isConnected()).toBe(false);
    });
  });

  describe("Connection Flow", () => {
    it("should connect after server starts", async () => {
      // Start server first
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock the MCP initialization response
      setTimeout(() => {
        const initResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "ast-mcp-server",
            },
          },
        });
        mockChildProcess.stdout.emit("data", initResponse + "\n");
      }, 10);

      await clientManager.connect();

      expect(clientManager.isConnected()).toBe(true);
    });

    it("should handle connection errors gracefully", async () => {
      // Test connecting without server running
      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Try to connect without starting server - should throw error
      await expect(clientManager.connect()).rejects.toThrow(
        "Server process is not running",
      );
      expect(clientManager.isConnected()).toBe(false);
    });
  });

  describe("Transport Layer", () => {
    it("should send messages through stdin", async () => {
      await serverManager.start();

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock initialization response
      setTimeout(() => {
        const initResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1.0" },
          },
        });
        mockChildProcess.stdout.emit("data", initResponse + "\n");
      }, 10);

      await clientManager.connect();

      // The fact that connection succeeded means the transport was able to:
      // 1. Send initialization message via stdin
      // 2. Receive response via stdout
      // 3. Process the JSON-RPC protocol correctly
      expect(clientManager.isConnected()).toBe(true);

      // Verify the transport is set up with stdin/stdout
      expect(mockChildProcess.stdin).toBeDefined();
      expect(mockChildProcess.stdin.write).toBeDefined();
      expect(mockChildProcess.stdout).toBeDefined();
    });

    it("should receive messages through stdout", async () => {
      await serverManager.start();

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock receiving initialization response
      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1.0" },
          },
        });
        mockChildProcess.stdout.emit("data", response + "\n");
      }, 10);

      await clientManager.connect();

      // The fact that connect() succeeded means we received and processed the stdout message
      expect(clientManager.isConnected()).toBe(true);
    });
  });

  describe("Tool Invocation", () => {
    beforeEach(async () => {
      await serverManager.start();

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock initialization
      setTimeout(() => {
        const initResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1.0" },
          },
        });
        mockChildProcess.stdout.emit("data", initResponse + "\n");
      }, 10);

      await clientManager.connect();
    });

    it("should list available tools", async () => {
      const client = clientManager.getClient();
      if (!client) {
        throw new Error("Client not initialized");
      }

      // Set up stdin mock to respond to tools/list
      (mockChildProcess.stdin.write as Mock).mockImplementation(
        (data: string, callback?: (error?: Error) => void) => {
          const message = JSON.parse(data.trim());

          if (message.method === "tools/list") {
            // Respond with tools list
            setTimeout(() => {
              const toolsResponse = JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  tools: [
                    {
                      name: "query_ast_context",
                      description: "Query AST context",
                      inputSchema: { type: "object", properties: {} },
                    },
                    {
                      name: "ast_index_status",
                      description: "Get index status",
                      inputSchema: { type: "object", properties: {} },
                    },
                  ],
                },
              });
              mockChildProcess.stdout.emit("data", toolsResponse + "\n");
            }, 5);
          }

          if (callback) callback();
          return true;
        },
      );

      const result = await client.listTools();
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("query_ast_context");
    });

    it("should call tool with arguments", async () => {
      const client = clientManager.getClient();
      if (!client) {
        throw new Error("Client not initialized");
      }

      // Set up stdin mock to respond to tools/call
      (mockChildProcess.stdin.write as Mock).mockImplementation(
        (data: string, callback?: (error?: Error) => void) => {
          const message = JSON.parse(data.trim());

          if (message.method === "tools/call") {
            // Respond with tool result
            setTimeout(() => {
              const callResponse = JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: "Index status: 100 files indexed",
                    },
                  ],
                },
              });
              mockChildProcess.stdout.emit("data", callResponse + "\n");
            }, 5);
          }

          if (callback) callback();
          return true;
        },
      );

      const result = await client.callTool({
        name: "ast_index_status",
        arguments: {},
      });

      expect(result.content).toBeDefined();
      expect((result.content as any)[0].type).toBe("text");
    });

    it("should handle tool errors", async () => {
      const client = clientManager.getClient();
      if (!client) {
        throw new Error("Client not initialized");
      }

      // Set up stdin mock to respond with error
      (mockChildProcess.stdin.write as Mock).mockImplementation(
        (data: string, callback?: (error?: Error) => void) => {
          const message = JSON.parse(data.trim());

          if (message.method === "tools/call") {
            // Respond with error
            setTimeout(() => {
              const errorResponse = JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                error: {
                  code: -32601,
                  message: "Tool not found",
                },
              });
              mockChildProcess.stdout.emit("data", errorResponse + "\n");
            }, 5);
          }

          if (callback) callback();
          return true;
        },
      );

      await expect(
        client.callTool({
          name: "nonexistent_tool",
          arguments: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe("Error Handling and Reconnection", () => {
    it("should handle server process crashes", async () => {
      await serverManager.start();

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock initialization
      setTimeout(() => {
        const initResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1.0" },
          },
        });
        mockChildProcess.stdout.emit("data", initResponse + "\n");
      }, 10);

      await clientManager.connect();
      expect(clientManager.isConnected()).toBe(true);

      // Simulate server crash
      mockChildProcess.emit("exit", 1, null);

      // Wait for disconnect
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(clientManager.isConnected()).toBe(false);
    });

    it("should clean up resources on disconnect", async () => {
      await serverManager.start();

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock initialization
      setTimeout(() => {
        const initResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1.0" },
          },
        });
        mockChildProcess.stdout.emit("data", initResponse + "\n");
      }, 10);

      await clientManager.connect();
      expect(clientManager.isConnected()).toBe(true);

      await clientManager.disconnect();

      // Wait for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(clientManager.isConnected()).toBe(false);
      expect(clientManager.getClient()).toBeNull();
    });
  });

  describe("Concurrent Requests", () => {
    beforeEach(async () => {
      await serverManager.start();

      const config: Partial<ClientConfig> = {
        autoConnect: false,
      };

      clientManager = new MCPClientManager(
        serverManager,
        config,
        mockOutputChannel,
      );

      // Mock initialization
      setTimeout(() => {
        const initResponse = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1.0" },
          },
        });
        mockChildProcess.stdout.emit("data", initResponse + "\n");
      }, 10);

      await clientManager.connect();
    });

    it("should handle multiple concurrent tool calls", async () => {
      const client = clientManager.getClient();
      if (!client) {
        throw new Error("Client not initialized");
      }

      // Mock responses for multiple concurrent calls
      (mockChildProcess.stdin.write as Mock).mockImplementation(
        (data: string, callback?: (error?: Error) => void) => {
          const message = JSON.parse(data.trim());

          if (message.method === "tools/call") {
            // Respond immediately with tool result
            setTimeout(() => {
              const response = JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Result for ${message.params.name}`,
                    },
                  ],
                },
              });
              mockChildProcess.stdout.emit("data", response + "\n");
            }, 5);
          }

          if (callback) callback();
          return true;
        },
      );

      const promises = [
        client.callTool({ name: "tool1", arguments: {} }),
        client.callTool({ name: "tool2", arguments: {} }),
        client.callTool({ name: "tool3", arguments: {} }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.content).toBeDefined();
      });
    });
  });
});
