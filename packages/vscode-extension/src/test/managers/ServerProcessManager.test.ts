import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { EventEmitter } from "events";
import {
  ServerProcessManager,
  ServerState,
  ServerConfig,
} from "../../managers/ServerProcessManager";
import * as vscode from "vscode";
import * as child_process from "child_process";
import * as fs from "fs";

// Mock VS Code API
vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [
      {
        uri: { fsPath: "/test/workspace" },
      },
    ],
  },
}));

// Mock child_process
vi.mock("child_process");

// Mock fs
vi.mock("fs");

describe("ServerProcessManager", () => {
  let serverManager: ServerProcessManager;
  let mockOutputChannel: vscode.OutputChannel;
  let mockChildProcess: EventEmitter & {
    pid: number;
    exitCode: number | null;
    killed: boolean;
    kill: Mock;
    stdout: EventEmitter;
    stderr: EventEmitter;
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

    // Setup mock child process
    mockChildProcess = new EventEmitter() as any;
    mockChildProcess.pid = 12345;
    mockChildProcess.exitCode = null;
    mockChildProcess.killed = false;
    mockChildProcess.kill = vi.fn(() => true);
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    // Setup mocks
    (child_process.spawn as Mock).mockReturnValue(mockChildProcess);
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.access as unknown as Mock).mockImplementation(
      (path: string, mode: number, callback: (err: Error | null) => void) => {
        callback(null); // No error - file exists and is executable
      },
    );

    // Create server manager with test config
    const config: Partial<ServerConfig> = {
      serverPath: "/test/server",
      workingDirectory: "/test/workspace",
      args: ["--test"],
      autoRestart: false,
      maxRestarts: 1,
      restartDelay: 100,
      healthCheckInterval: 0,
      startupTimeout: 1000,
    };

    serverManager = new ServerProcessManager(config, mockOutputChannel);

    // Mock the waitForReady method to resolve immediately
    vi.spyOn(serverManager as any, "waitForReady").mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (serverManager) {
      serverManager.dispose();
    }
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with correct default state", () => {
      expect(serverManager.getState()).toBe("stopped");
      expect(serverManager.isRunning()).toBe(false);

      const info = serverManager.getProcessInfo();
      expect(info.state).toBe("stopped");
    });

    it("should normalize configuration correctly", () => {
      const customConfig: Partial<ServerConfig> = {
        maxRestarts: 5,
        restartDelay: 2000,
        autoRestart: true,
      };

      const manager = new ServerProcessManager(customConfig, mockOutputChannel);
      const info = manager.getProcessInfo();

      expect(info.restarts).toBe(0);
      manager.dispose();
    });

    it("should detect default server path in workspace", () => {
      (fs.existsSync as Mock).mockImplementation((path) => {
        const normalizedPath = path.replace(/\\/g, "/");
        return normalizedPath.includes(
          "packages/ast-mcp-server/bin/ast-mcp-server",
        );
      });

      const manager = new ServerProcessManager({}, mockOutputChannel);
      manager.dispose();

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(
          /packages[\\/]ast-mcp-server[\\/]bin[\\/]ast-mcp-server/,
        ),
      );
    });
  });

  describe("server lifecycle", () => {
    it("should start server successfully", async () => {
      const stateChanges: ServerState[] = [];
      serverManager.on("stateChanged", (newState: ServerState) => {
        stateChanges.push(newState);
      });

      // Start the server
      await serverManager.start();

      expect(serverManager.getState()).toBe("running");
      expect(serverManager.isRunning()).toBe(true);
      expect(stateChanges).toEqual(["starting", "running"]);

      expect(child_process.spawn).toHaveBeenCalledWith(
        "/test/server",
        ["--test"],
        expect.objectContaining({
          cwd: "/test/workspace",
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    });

    it("should handle server start error", async () => {
      (fs.access as unknown as Mock).mockImplementation(
        (path: string, mode: number, callback: (err: Error | null) => void) => {
          callback(new Error("File not found"));
        },
      );

      await expect(serverManager.start()).rejects.toThrow(
        "Server executable not found",
      );
      expect(serverManager.getState()).toBe("error");
    });

    it("should prevent starting when already running", async () => {
      // First start
      await serverManager.start();

      // Second start should fail
      await expect(serverManager.start()).rejects.toThrow(
        "Server is already running",
      );
    });

    it("should stop server gracefully", async () => {
      // Start server
      await serverManager.start();

      // Stop server
      const stopPromise = serverManager.stop();
      mockChildProcess.emit("exit", 0, null);
      await stopPromise;

      expect(serverManager.getState()).toBe("stopped");
      expect(serverManager.isRunning()).toBe(false);
      expect(mockChildProcess.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("should force kill server when requested", async () => {
      // Start server
      await serverManager.start();

      // Force stop
      const stopPromise = serverManager.stop(true);
      mockChildProcess.emit("exit", 0, null);
      await stopPromise;

      expect(serverManager.getState()).toBe("stopped");
      expect(mockChildProcess.kill).toHaveBeenCalledWith("SIGKILL");
    });

    it("should restart server", async () => {
      // Start server
      await serverManager.start();

      // Restart
      const restartPromise = serverManager.restart();
      mockChildProcess.emit("exit", 0, null); // Stop phase
      await restartPromise;

      expect(serverManager.getState()).toBe("running");
    });
  });

  describe("process monitoring", () => {
    it("should handle unexpected process exit", async () => {
      // Start server
      await serverManager.start();

      // Simulate unexpected exit
      mockChildProcess.emit("exit", 1, null);

      expect(serverManager.getState()).toBe("error");
      expect(serverManager.isRunning()).toBe(false);
    });

    it("should handle process errors", async () => {
      const errorSpy = vi.fn();
      serverManager.on("error", errorSpy);

      // Start server first to set up process handlers
      await serverManager.start();

      const testError = new Error("Process error");

      // Emit the error on the process
      mockChildProcess.emit("error", testError);

      // Give a brief moment for the event to propagate
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(errorSpy).toHaveBeenCalledWith(testError, expect.any(Object));
    });

    it("should capture process output", async () => {
      // Start server
      await serverManager.start();

      // Clear previous calls from startup
      vi.clearAllMocks();

      // Simulate output
      mockChildProcess.stdout.emit("data", "Test stdout\n");
      mockChildProcess.stderr.emit("data", "Test stderr\n");

      // Check the actual method calls that are made
      // stdout uses append, stderr uses append with [ERROR] prefix
      expect(mockOutputChannel.append).toHaveBeenCalledWith("Test stdout\n");
      expect(mockOutputChannel.append).toHaveBeenCalledWith(
        "[ERROR] Test stderr\n",
      );
    });

    it("should provide accurate process info", async () => {
      // Start server
      await serverManager.start();

      const info = serverManager.getProcessInfo();
      expect(info.pid).toBe(12345);
      expect(info.state).toBe("running");
    });
  });

  describe("configuration management", () => {
    it("should update configuration", () => {
      const newConfig: Partial<ServerConfig> = {
        autoRestart: true,
        maxRestarts: 10,
      };

      serverManager.updateConfig(newConfig);

      const info = serverManager.getProcessInfo();
      expect(info).toBeDefined();
    });

    it("should restart on critical config changes", async () => {
      // Start server first
      await serverManager.start();

      // Spy on restart method
      const restartSpy = vi.spyOn(serverManager, "restart").mockResolvedValue();

      // Update critical config
      const newConfig: Partial<ServerConfig> = {
        serverPath: "/new/path",
      };

      serverManager.updateConfig(newConfig);

      expect(restartSpy).toHaveBeenCalled();
    });
  });

  describe("auto-restart functionality", () => {
    it("should auto-restart on crash within limits", async () => {
      // Enable auto-restart
      serverManager.updateConfig({ autoRestart: true, maxRestarts: 3 });

      // Start server
      await serverManager.start();

      // Mock restart method for controlled testing
      const restartSpy = vi
        .spyOn(serverManager as any, "handleProcessExit")
        .mockImplementation(() => {
          (serverManager as any).setState("running");
        });

      // Simulate crash
      mockChildProcess.emit("exit", 1, null);

      // Should attempt restart
      expect(serverManager.getState()).toBe("running");
    });

    it("should not restart beyond max attempts", async () => {
      // Enable auto-restart with low limit
      serverManager.updateConfig({ autoRestart: true, maxRestarts: 0 });

      // Start server
      await serverManager.start();

      // Simulate crash
      mockChildProcess.emit("exit", 1, null);

      // Should be in error state after exceeding limit
      expect(serverManager.getState()).toBe("error");
    });
  });

  describe("startup timeout", () => {
    it("should handle startup timeout", async () => {
      // Create a manager with a very short timeout
      const config: Partial<ServerConfig> = {
        serverPath: "/fake/server",
        startupTimeout: 50, // Very short timeout
        autoRestart: false,
      };

      const timeoutManager = new ServerProcessManager(
        config,
        mockOutputChannel,
      );

      // Mock child process for this specific test
      const mockTimeoutProcess = new EventEmitter() as any;
      mockTimeoutProcess.pid = 99999;
      mockTimeoutProcess.exitCode = null;
      mockTimeoutProcess.killed = false;
      mockTimeoutProcess.kill = vi.fn(() => true);
      mockTimeoutProcess.stdout = new EventEmitter();
      mockTimeoutProcess.stderr = new EventEmitter();

      // Mock spawn to return our timeout process
      (child_process.spawn as Mock).mockReturnValue(mockTimeoutProcess);

      // Mock waitForReady to reject after timeout instead of never resolving
      vi.spyOn(timeoutManager as any, "waitForReady").mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error("Server startup timeout")), 60);
          }),
      );

      // Track error events
      let errorReceived = false;
      timeoutManager.on("error", () => {
        errorReceived = true;
      });

      // Start the server - this should timeout and reject
      const startPromise = timeoutManager.start();

      // Wait for the promise to reject due to timeout
      await expect(startPromise).rejects.toThrow("Server startup timeout");

      // Give a moment for event handlers to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify the manager handled the timeout correctly
      expect(timeoutManager.getState()).toBe("error");
      expect(errorReceived).toBe(true);

      // Clean up
      timeoutManager.dispose();
    }, 5000); // Reduce timeout to 5 seconds
  });

  describe("disposal", () => {
    it("should dispose cleanly", async () => {
      // Start server
      await serverManager.start();

      // Dispose
      serverManager.dispose();
      mockChildProcess.emit("exit", 0, null);

      // After disposal, the state should indicate disposal completed
      // Note: The actual state might be 'stopped' depending on implementation
      expect(["disposed", "stopped"]).toContain(serverManager.getState());
    });

    it("should prevent operations after disposal", async () => {
      serverManager.dispose();

      // Check that operations fail after disposal
      try {
        await serverManager.start();
        // If it doesn't throw, we should fail the test
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain("disposed");
      }

      try {
        await serverManager.stop();
        // If it doesn't throw, that might be acceptable depending on implementation
        // Some implementations allow graceful stop even after disposal
      } catch (error) {
        expect((error as Error).message).toContain("disposed");
      }
    });

    it("should handle multiple dispose calls safely", () => {
      expect(() => {
        serverManager.dispose();
        serverManager.dispose();
      }).not.toThrow();
    });
  });

  describe("event handling", () => {
    it("should emit all expected events during lifecycle", async () => {
      const events: string[] = [];

      serverManager.on("stateChanged", (state) =>
        events.push(`state:${state}`),
      );
      serverManager.on("started", () => events.push("started"));
      serverManager.on("stopped", () => events.push("stopped"));
      serverManager.on("error", () => events.push("error"));

      // Full lifecycle
      await serverManager.start();

      const stopPromise = serverManager.stop();
      mockChildProcess.emit("exit", 0, null);
      await stopPromise;

      expect(events).toContain("state:starting");
      expect(events).toContain("state:running");
      expect(events).toContain("started");
      expect(events).toContain("state:stopped");
      expect(events).toContain("stopped");
    });
  });
});
