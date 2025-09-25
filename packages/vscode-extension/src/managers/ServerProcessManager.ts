import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Server process states
 */
export type ServerState =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error"
  | "crashed";

/**
 * Server process information
 */
export interface ServerProcessInfo {
  pid?: number;
  state: ServerState;
  startTime?: Date;
  restarts: number;
  lastError?: string;
  uptime?: number;
}

/**
 * Server configuration options
 */
export interface ServerConfig {
  serverPath: string;
  workingDirectory: string;
  args: string[];
  env: Record<string, string>;
  autoRestart: boolean;
  maxRestarts: number;
  restartDelay: number;
  healthCheckInterval: number;
  startupTimeout: number;
}

/**
 * Events emitted by ServerProcessManager
 */
export interface ServerProcessEvents {
  stateChanged: (state: ServerState, previousState: ServerState) => void;
  started: (info: ServerProcessInfo) => void;
  stopped: (info: ServerProcessInfo) => void;
  error: (error: Error, info: ServerProcessInfo) => void;
  crashed: (
    exitCode: number | null,
    signal: string | null,
    info: ServerProcessInfo,
  ) => void;
  restarting: (attempt: number, maxAttempts: number) => void;
  output: (data: string, isError: boolean) => void;
}

/**
 * Manages the lifecycle of the AST MCP server process
 */
export class ServerProcessManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: ServerConfig;
  private state: ServerState = "stopped";
  private startTime: Date | null = null;
  private restarts = 0;
  private lastError: string | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private outputChannel: vscode.OutputChannel;
  private isDisposed = false;

  constructor(
    config: Partial<ServerConfig>,
    outputChannel: vscode.OutputChannel,
  ) {
    super();

    this.outputChannel = outputChannel;
    this.config = this.normalizeConfig(config);

    this.outputChannel.appendLine(`Server Process Manager initialized`);
    this.outputChannel.appendLine(`Server path: ${this.config.serverPath}`);
    this.outputChannel.appendLine(
      `Working directory: ${this.config.workingDirectory}`,
    );
  }

  /**
   * Normalize and validate server configuration
   */
  private normalizeConfig(config: Partial<ServerConfig>): ServerConfig {
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    // Filter out undefined values from environment
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        cleanEnv[key] = value;
      }
    }

    return {
      serverPath: config.serverPath || this.getDefaultServerPath(),
      workingDirectory: config.workingDirectory || workspaceRoot,
      args: config.args || [],
      env: { ...cleanEnv, ...config.env },
      autoRestart: config.autoRestart ?? true,
      maxRestarts: config.maxRestarts ?? 3,
      restartDelay: config.restartDelay ?? 2000,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      startupTimeout: config.startupTimeout ?? 10000,
    };
  }

  /**
   * Get default server path based on platform and workspace
   */
  private getDefaultServerPath(): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      // Look for server binary in workspace
      const localServerPath = path.join(
        workspaceRoot,
        "packages",
        "ast-mcp-server",
        "bin",
        "ast-mcp-server",
      );
      if (fs.existsSync(localServerPath)) {
        return localServerPath;
      }
    }

    // Fall back to global installation
    return "ast-mcp-server";
  }

  /**
   * Start the MCP server process
   */
  public async start(): Promise<void> {
    if (this.state === "running" || this.state === "starting") {
      throw new Error(`Server is already ${this.state}`);
    }

    if (this.isDisposed) {
      throw new Error("ServerProcessManager has been disposed");
    }

    this.outputChannel.appendLine("Starting MCP server...");
    this.setState("starting");

    try {
      // Validate server executable exists
      await this.validateServerPath();

      // Clear any previous error state
      this.lastError = null;

      // Spawn the server process
      this.process = spawn(this.config.serverPath, this.config.args, {
        cwd: this.config.workingDirectory,
        env: this.config.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Set up process event handlers
      this.setupProcessHandlers();

      // Start startup timeout
      this.startupTimer = setTimeout(() => {
        if (this.state === "starting") {
          this.handleStartupTimeout();
        }
      }, this.config.startupTimeout);

      // Wait for process to be ready
      await this.waitForReady();

      this.startTime = new Date();
      this.setState("running");
      this.outputChannel.appendLine(
        `MCP server started successfully (PID: ${this.process.pid})`,
      );

      // Start health monitoring
      this.startHealthCheck();

      this.emit("started", this.getProcessInfo());
    } catch (error) {
      this.handleStartError(error);
      throw error;
    }
  }

  /**
   * Stop the MCP server process
   */
  public async stop(force = false): Promise<void> {
    if (this.state === "stopped" || this.state === "stopping") {
      return;
    }

    this.outputChannel.appendLine("Stopping MCP server...");
    this.setState("stopping");

    // Clear timers
    this.clearTimers();

    if (this.process) {
      try {
        if (force) {
          this.process.kill("SIGKILL");
        } else {
          this.process.kill("SIGTERM");

          // Wait for graceful shutdown, then force kill if needed
          setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.outputChannel.appendLine(
                "Forcefully terminating server process...",
              );
              this.process.kill("SIGKILL");
            }
          }, 5000);
        }

        // Wait for process to exit
        await new Promise<void>((resolve) => {
          if (!this.process) {
            resolve();
            return;
          }

          const onExit = () => {
            this.process = null;
            resolve();
          };

          if (this.process.exitCode !== null) {
            onExit();
          } else {
            this.process.once("exit", onExit);
          }
        });
      } catch (error) {
        this.outputChannel.appendLine(`Error stopping server: ${error}`);
      }
    }

    this.process = null;
    this.startTime = null;
    this.setState("stopped");
    this.outputChannel.appendLine("MCP server stopped");

    this.emit("stopped", this.getProcessInfo());
  }

  /**
   * Restart the MCP server process
   */
  public async restart(): Promise<void> {
    this.outputChannel.appendLine("Restarting MCP server...");

    if (this.state !== "stopped") {
      await this.stop();
    }

    // Add a small delay before restart
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.start();
  }

  /**
   * Get current server state
   */
  public getState(): ServerState {
    return this.state;
  }

  /**
   * Get server process information
   */
  public getProcessInfo(): ServerProcessInfo {
    return {
      pid: this.process?.pid,
      state: this.state,
      startTime: this.startTime || undefined,
      restarts: this.restarts,
      lastError: this.lastError || undefined,
      uptime: this.startTime
        ? Date.now() - this.startTime.getTime()
        : undefined,
    };
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.state === "running";
  }

  /**
   * Update server configuration
   */
  public updateConfig(newConfig: Partial<ServerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = this.normalizeConfig({ ...this.config, ...newConfig });

    this.outputChannel.appendLine("Server configuration updated");

    // If critical settings changed and server is running, restart
    const criticalSettings = ["serverPath", "args", "workingDirectory"];
    const criticalChanged = criticalSettings.some(
      (key) =>
        oldConfig[key as keyof ServerConfig] !==
        this.config[key as keyof ServerConfig],
    );

    if (criticalChanged && this.isRunning()) {
      this.outputChannel.appendLine(
        "Critical settings changed, restarting server...",
      );
      this.restart().catch((error) => {
        this.outputChannel.appendLine(
          `Failed to restart after config change: ${error}`,
        );
      });
    }
  }

  /**
   * Dispose the server process manager
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.outputChannel.appendLine("Disposing ServerProcessManager...");

    // Stop the process if running
    if (this.state !== "stopped") {
      this.stop(true).catch((error) => {
        console.error("Error stopping server during disposal:", error);
      });
    }

    // Clear all timers
    this.clearTimers();

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Set server state and emit change event
   */
  private setState(newState: ServerState): void {
    const previousState = this.state;
    this.state = newState;

    if (previousState !== newState) {
      this.outputChannel.appendLine(
        `Server state changed: ${previousState} → ${newState}`,
      );
      this.emit("stateChanged", newState, previousState);
    }
  }

  /**
   * Validate that server executable exists and is accessible
   */
  private async validateServerPath(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.access(
        this.config.serverPath,
        fs.constants.F_OK | fs.constants.X_OK,
        (error) => {
          if (error) {
            reject(
              new Error(
                `Server executable not found or not executable: ${this.config.serverPath}`,
              ),
            );
          } else {
            resolve();
          }
        },
      );
    });
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) {
      return;
    }

    this.process.on("exit", (code, signal) => {
      this.handleProcessExit(code, signal);
    });

    this.process.on("error", (error) => {
      this.handleProcessError(error);
    });

    // Capture stdout and stderr
    this.process.stdout?.on("data", (data) => {
      const output = data.toString();
      this.outputChannel.append(output);
      this.emit("output", output, false);
    });

    this.process.stderr?.on("data", (data) => {
      const output = data.toString();
      this.outputChannel.append(`[ERROR] ${output}`);
      this.emit("output", output, true);
    });
  }

  /**
   * Wait for server to be ready (basic implementation)
   */
  private async waitForReady(): Promise<void> {
    // For now, just wait a short time for the process to initialize
    // In a full implementation, this would check for specific output or health endpoint
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify process is still alive
    if (!this.process || this.process.exitCode !== null) {
      throw new Error("Server process exited during startup");
    }
  }

  /**
   * Handle startup timeout
   */
  private handleStartupTimeout(): void {
    if (this.state !== "starting") {
      return; // Already handled or not in startup phase
    }

    this.outputChannel.appendLine("Server startup timeout reached");
    this.setState("error");
    this.lastError = "Startup timeout";

    if (this.process) {
      this.process.kill("SIGKILL");
    }

    this.emit(
      "error",
      new Error("Server startup timeout"),
      this.getProcessInfo(),
    );
  }

  /**
   * Handle start error
   */
  private handleStartError(error: any): void {
    this.outputChannel.appendLine(`Failed to start server: ${error.message}`);
    this.setState("error");
    this.lastError = error.message;
    this.clearTimers();

    if (this.process) {
      this.process.kill("SIGKILL");
      this.process = null;
    }

    this.emit("error", error, this.getProcessInfo());
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    const wasRunning = this.state === "running";

    this.clearTimers();
    this.process = null;
    this.startTime = null;

    if (this.state === "stopping") {
      // Expected shutdown
      this.setState("stopped");
      return;
    }

    // Unexpected exit
    this.outputChannel.appendLine(
      `Server process exited unexpectedly (code: ${code}, signal: ${signal})`,
    );
    this.setState("crashed");

    this.emit("crashed", code, signal, this.getProcessInfo());

    // Auto-restart if enabled and not too many restarts
    if (
      wasRunning &&
      this.config.autoRestart &&
      this.restarts < this.config.maxRestarts
    ) {
      this.scheduleRestart();
    } else {
      this.setState("error");
      this.lastError = `Process exited with code ${code}`;
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(error: Error): void {
    this.outputChannel.appendLine(`Server process error: ${error.message}`);
    this.setState("error");
    this.lastError = error.message;

    this.emit("error", error, this.getProcessInfo());
  }

  /**
   * Schedule auto-restart
   */
  private scheduleRestart(): void {
    this.restarts++;
    this.outputChannel.appendLine(
      `Scheduling restart (attempt ${this.restarts}/${this.config.maxRestarts})...`,
    );

    this.emit("restarting", this.restarts, this.config.maxRestarts);

    this.restartTimer = setTimeout(() => {
      this.start().catch((error) => {
        this.outputChannel.appendLine(`Auto-restart failed: ${error.message}`);
        this.setState("error");
        this.lastError = error.message;
      });
    }, this.config.restartDelay);
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    if (this.config.healthCheckInterval <= 0) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      if (this.process && this.state === "running") {
        // Simple health check - verify process is still alive
        if (this.process.exitCode !== null) {
          this.outputChannel.appendLine(
            "Health check failed: process not running",
          );
          this.handleProcessExit(this.process.exitCode, null);
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}

/**
 * Server process manager events interface (for TypeScript typing)
 */
export declare interface ServerProcessManagerEvents {
  on<K extends keyof ServerProcessEvents>(
    event: K,
    listener: ServerProcessEvents[K],
  ): this;
  emit<K extends keyof ServerProcessEvents>(
    event: K,
    ...args: Parameters<ServerProcessEvents[K]>
  ): boolean;
}
