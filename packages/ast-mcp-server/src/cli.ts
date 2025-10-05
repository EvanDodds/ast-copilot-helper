#!/usr/bin/env node

/**
 * CLI entry point for ast-mcp-server
 * Provides complete server lifecycle management with start/stop/status commands
 */

import { promises as fs } from "fs";
import path from "path";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import type { ServerConfig } from "./server.js";
import { ASTMCPServer } from "./server.js";
import { StdioTransport } from "./mcp/stdio-transport.js";
import { TCPTransport } from "./mcp/tcp-transport.js";
import type { MCPTransport } from "./mcp/transport.js";
import { ASTDatabaseReader } from "./database/reader.js";

/**
 * CLI Configuration interface
 */
interface CLIConfig {
  transport: "stdio" | "tcp";
  tcpPort?: number;
  tcpHost?: string;
  pidFile: string;
  logLevel: "error" | "warn" | "info" | "debug";
  databasePath: string;
  serverName: string;
  serverVersion: string;
  protocolVersion: string;
}

/**
 * Default CLI configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
  transport: "stdio",
  tcpPort: 3000,
  tcpHost: "localhost",
  pidFile: path.join(process.cwd(), ".astdb", "mcp-server.pid"),
  logLevel: "info",
  databasePath: path.join(process.cwd(), ".astdb"),
  serverName: "ast-mcp-server",
  serverVersion: "0.1.0",
  protocolVersion: "2024-11-05",
};

/**
 * Process management utilities
 */
class ProcessManager {
  private config: CLIConfig;

  constructor(config: CLIConfig) {
    this.config = config;
  }

  /**
   * Write PID to file
   */
  async writePidFile(pid: number): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.config.pidFile), { recursive: true });
      await fs.writeFile(this.config.pidFile, pid.toString());
    } catch (error) {
      throw new Error(
        `Failed to write PID file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Read PID from file
   */
  async readPidFile(): Promise<number | null> {
    try {
      const pidStr = await fs.readFile(this.config.pidFile, "utf8");
      const pid = parseInt(pidStr.trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch (_error) {
      // Return null for any filesystem error (file not found, invalid path, etc.)
      // This allows the status command to gracefully report "not running"
      return null;
    }
  }

  /**
   * Remove PID file
   */
  async removePidFile(): Promise<void> {
    try {
      await fs.unlink(this.config.pidFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(
          `Failed to remove PID file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Check if process is running
   */
  isProcessRunning(pid: number): boolean {
    try {
      // Signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send signal to process
   */
  sendSignal(pid: number, signal: NodeJS.Signals = "SIGTERM"): boolean {
    try {
      process.kill(pid, signal);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for process to stop
   */
  async waitForProcessStop(pid: number, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (!this.isProcessRunning(pid)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }
}

/**
 * Server lifecycle manager
 */
class ServerManager {
  private config: CLIConfig;
  private processManager: ProcessManager;
  private server?: ASTMCPServer;

  constructor(config: CLIConfig) {
    this.config = config;
    this.processManager = new ProcessManager(config);
  }

  /**
   * Create transport based on configuration
   */
  private createTransport(): MCPTransport {
    switch (this.config.transport) {
      case "stdio":
        return new StdioTransport();
      case "tcp":
        return new TCPTransport(this.config.tcpPort, this.config.tcpHost);
      default:
        throw new Error(`Unsupported transport type: ${this.config.transport}`);
    }
  }

  /**
   * Create server configuration
   */
  private createServerConfig(): ServerConfig {
    return {
      serverName: this.config.serverName,
      serverVersion: this.config.serverVersion,
      protocolVersion: this.config.protocolVersion,
      requestTimeout: 30000,
      maxConcurrentRequests: 10,
      enableRequestLogging: this.config.logLevel === "debug",
    };
  }

  /**
   * Start server in current process
   */
  async startServer(): Promise<void> {
    try {
      // Create database reader
      const database = new ASTDatabaseReader(this.config.databasePath);
      await database.initialize();

      // Create transport and server
      const transport = this.createTransport();
      const serverConfig = this.createServerConfig();

      this.server = new ASTMCPServer(transport, database, serverConfig);

      // Set up signal handlers for graceful shutdown
      const gracefulShutdown = async (signal: string) => {
        this.log(`Received ${signal}, shutting down gracefully...`);
        try {
          if (this.server) {
            await this.server.stop();
          }
          await this.processManager.removePidFile();
          process.exit(0);
        } catch (error) {
          this.logError(
            `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      };

      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
      process.on("SIGINT", () => gracefulShutdown("SIGINT"));

      // Start the server
      await this.server.start();

      // Write PID file
      await this.processManager.writePidFile(process.pid);

      this.log(`Server started successfully (PID: ${process.pid})`);

      if (this.config.transport === "tcp") {
        this.log(
          `TCP server listening on ${this.config.tcpHost}:${this.config.tcpPort}`,
        );
      } else {
        this.log("STDIO transport ready for MCP communication");
      }

      // Keep process alive for TCP mode
      if (this.config.transport === "tcp") {
        // Server will keep the event loop alive via TCP server
        await new Promise(() => {}); // Keep running indefinitely
      }
    } catch (error) {
      this.logError(
        `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  /**
   * Start server as daemon process
   */
  async startDaemon(): Promise<void> {
    const existingPid = await this.processManager.readPidFile();

    if (existingPid && this.processManager.isProcessRunning(existingPid)) {
      throw new Error(`Server is already running (PID: ${existingPid})`);
    }

    // Clean up stale PID file
    if (existingPid) {
      await this.processManager.removePidFile();
    }

    const child: ChildProcess = spawn(process.execPath, [__filename, "run"], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
    });

    child.unref();

    // Wait a moment to ensure the process started
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newPid = await this.processManager.readPidFile();
    if (!newPid || !this.processManager.isProcessRunning(newPid)) {
      throw new Error("Failed to start daemon process");
    }

    this.log(`Server started as daemon (PID: ${newPid})`);
  }

  /**
   * Stop server
   */
  async stopServer(): Promise<void> {
    const pid = await this.processManager.readPidFile();

    if (!pid) {
      throw new Error("No PID file found - server may not be running");
    }

    if (!this.processManager.isProcessRunning(pid)) {
      await this.processManager.removePidFile();
      throw new Error("Server process is not running");
    }

    // Send SIGTERM for graceful shutdown
    this.log(`Sending SIGTERM to process ${pid}...`);
    if (!this.processManager.sendSignal(pid, "SIGTERM")) {
      throw new Error(`Failed to send SIGTERM to process ${pid}`);
    }

    // Wait for graceful shutdown
    const stopped = await this.processManager.waitForProcessStop(pid, 10000);

    if (!stopped) {
      this.log(`Process ${pid} did not stop gracefully, sending SIGKILL...`);
      if (!this.processManager.sendSignal(pid, "SIGKILL")) {
        throw new Error(`Failed to kill process ${pid}`);
      }

      // Wait for force kill
      const forceKilled = await this.processManager.waitForProcessStop(
        pid,
        5000,
      );
      if (!forceKilled) {
        throw new Error(`Failed to kill process ${pid}`);
      }
    }

    await this.processManager.removePidFile();
    this.log(`Server stopped successfully`);
  }

  /**
   * Get server status
   */
  async getStatus(): Promise<{
    running: boolean;
    pid?: number;
    uptime?: number;
  }> {
    const pid = await this.processManager.readPidFile();

    if (!pid) {
      return { running: false };
    }

    const running = this.processManager.isProcessRunning(pid);

    if (!running) {
      // Clean up stale PID file
      await this.processManager.removePidFile();
      return { running: false };
    }

    // Try to determine uptime (basic approach using PID file timestamp)
    let uptime: number | undefined;
    try {
      const pidFileStats = await fs.stat(this.config.pidFile);
      uptime = Math.floor((Date.now() - pidFileStats.mtime.getTime()) / 1000);
    } catch (error) {
      // Uptime unavailable
    }

    return { running: true, pid, uptime };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const status = await this.getStatus();

      if (!status.running) {
        return { healthy: false, message: "Server is not running" };
      }

      // Check database accessibility
      try {
        const database = new ASTDatabaseReader(this.config.databasePath);
        await database.initialize();
        await database.close();
      } catch (error) {
        return {
          healthy: false,
          message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      return { healthy: true, message: "Server is running and healthy" };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private log(message: string): void {
    if (this.config.logLevel === "debug" || this.config.logLevel === "info") {
      console.log(`[INFO] ${message}`);
    }
  }

  private logError(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}

/**
 * CLI command handlers
 */
class CLI {
  private config: CLIConfig;
  private serverManager: ServerManager;

  constructor() {
    this.config = this.loadConfiguration();
    this.serverManager = new ServerManager(this.config);
  }

  /**
   * Load configuration from environment and defaults
   */
  private loadConfiguration(): CLIConfig {
    const config = { ...DEFAULT_CONFIG };

    // Override with environment variables
    if (process.env.AST_MCP_TRANSPORT) {
      const transport = process.env.AST_MCP_TRANSPORT.toLowerCase();
      if (transport === "stdio" || transport === "tcp") {
        config.transport = transport;
      }
    }

    if (process.env.AST_MCP_TCP_PORT) {
      const port = parseInt(process.env.AST_MCP_TCP_PORT, 10);
      if (!isNaN(port) && port > 0 && port < 65536) {
        config.tcpPort = port;
      }
    }

    if (process.env.AST_MCP_TCP_HOST) {
      config.tcpHost = process.env.AST_MCP_TCP_HOST;
    }

    if (process.env.AST_MCP_LOG_LEVEL) {
      const level = process.env.AST_MCP_LOG_LEVEL.toLowerCase();
      if (["error", "warn", "info", "debug"].includes(level)) {
        config.logLevel = level as CLIConfig["logLevel"];
      }
    }

    if (process.env.AST_MCP_DATABASE_PATH) {
      config.databasePath = process.env.AST_MCP_DATABASE_PATH;
    }

    if (process.env.AST_MCP_PID_FILE) {
      config.pidFile = process.env.AST_MCP_PID_FILE;
    }

    return config;
  }

  /**
   * Show usage information
   */
  private showUsage(): void {
    console.log(`
Usage: ast-mcp-server <command> [options]

Commands:
  start     Start the MCP server as a daemon
  stop      Stop the running MCP server
  restart   Restart the MCP server
  status    Show server status
  health    Perform health check
  run       Run server in foreground (used internally)
  help      Show this help message

Environment Variables:
  AST_MCP_TRANSPORT       Transport type (stdio|tcp) [default: stdio]
  AST_MCP_TCP_PORT        TCP port for server [default: 3000]
  AST_MCP_TCP_HOST        TCP host for server [default: localhost]
  AST_MCP_LOG_LEVEL       Log level (error|warn|info|debug) [default: info]
  AST_MCP_DATABASE_PATH   Path to AST database [default: ./.astdb]
  AST_MCP_PID_FILE        Path to PID file [default: ./.astdb/mcp-server.pid]

Examples:
  ast-mcp-server start                    # Start with stdio transport
  AST_MCP_TRANSPORT=tcp ast-mcp-server start    # Start with TCP transport
  AST_MCP_TCP_PORT=8080 ast-mcp-server start    # Start TCP on port 8080
  ast-mcp-server status                   # Check server status
  ast-mcp-server stop                     # Stop the server
`);
  }

  /**
   * Execute CLI command
   */
  async execute(args: string[]): Promise<void> {
    const command = args[0];

    try {
      switch (command) {
        case "start":
          if (this.config.transport === "tcp") {
            await this.serverManager.startDaemon();
            process.exit(0);
          } else {
            // For STDIO, we need to run in foreground
            console.log("Starting STDIO server in foreground...");
            await this.serverManager.startServer();
            // STDIO server runs indefinitely, so no exit here
          }
          break;

        case "stop":
          await this.serverManager.stopServer();
          process.exit(0);
          break;

        case "restart":
          try {
            await this.serverManager.stopServer();
          } catch (error) {
            console.log("Server was not running, starting fresh...");
          }

          if (this.config.transport === "tcp") {
            await this.serverManager.startDaemon();
            process.exit(0);
          } else {
            await this.serverManager.startServer();
            // STDIO server runs indefinitely, so no exit here
          }
          break;

        case "status": {
          const status = await this.serverManager.getStatus();
          if (status.running) {
            console.log(`Server is running (PID: ${status.pid})`);
            if (status.uptime !== undefined) {
              console.log(`Uptime: ${status.uptime} seconds`);
            }
            if (this.config.transport === "tcp") {
              console.log(
                `TCP server on ${this.config.tcpHost}:${this.config.tcpPort}`,
              );
            } else {
              console.log("Using STDIO transport");
            }
          } else {
            console.log("Server is not running");
          }
          process.exit(0);
          break;
        }

        case "health": {
          const health = await this.serverManager.healthCheck();
          console.log(
            `Health status: ${health.healthy ? "HEALTHY" : "UNHEALTHY"}`,
          );
          console.log(`Message: ${health.message}`);
          process.exit(health.healthy ? 0 : 1);
          break;
        }

        case "run":
          // Internal command for daemon mode
          await this.serverManager.startServer();
          break;

        case "help":
        case "--help":
        case "-h":
          this.showUsage();
          process.exit(0);
          break;

        default:
          if (command) {
            console.error(`Unknown command: ${command}`);
          }
          this.showUsage();
          process.exit(1);
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const cli = new CLI();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    args.push("help");
  }

  await cli.execute(args);
}

// Only execute if this file is run directly

const isMainModule = require.main === module;
if (isMainModule) {
  main().catch((error) => {
    console.error(
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
