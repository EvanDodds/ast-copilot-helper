import type * as vscode from "vscode";
import { EventEmitter } from "events";
import type { ServerProcessManager } from "./ServerProcessManager";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  ServerCapabilities,
  Tool,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";
import { ManagedProcessTransport } from "../mcp/ManagedProcessTransport.js";

// Type aliases for compatibility with existing code
type MCPCapabilities = ServerCapabilities;
type MCPTool = Tool;
type MCPResource = Resource;

/**
 * MCP client connection states
 */
export type ClientState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnecting";

/**
 * MCP client connection information
 */
export interface ClientConnectionInfo {
  state: ClientState;
  connectTime?: Date;
  lastError?: string;
  reconnectAttempts: number;
  serverCapabilities?: MCPCapabilities;
  clientInfo?: { name: string; version: string };
}

/**
 * MCP client configuration options
 */
export interface ClientConfig {
  autoConnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  enableLogging: boolean;
}

/**
 * Events emitted by MCPClientManager
 */
export interface MCPClientEvents {
  stateChanged: (state: ClientState, previousState: ClientState) => void;
  connected: (info: ClientConnectionInfo) => void;
  disconnected: (info: ClientConnectionInfo) => void;
  error: (error: Error, info: ClientConnectionInfo) => void;
  reconnecting: (attempt: number, maxAttempts: number) => void;
  serverCapabilities: (capabilities: MCPCapabilities) => void;
  notification: (method: string, params: unknown) => void;
}

/**
 * Manages MCP client connection to the AST server
 */
export class MCPClientManager extends EventEmitter {
  private client: Client | null = null;
  private transport: ManagedProcessTransport | null = null;
  private config: ClientConfig;
  private state: ClientState = "disconnected";
  private connectTime: Date | null = null;
  private lastError: string | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private outputChannel: vscode.OutputChannel;
  private serverProcessManager: ServerProcessManager;
  private isDisposed = false;

  constructor(
    serverProcessManager: ServerProcessManager,
    config: Partial<ClientConfig>,
    outputChannel: vscode.OutputChannel,
  ) {
    super();

    this.serverProcessManager = serverProcessManager;
    this.outputChannel = outputChannel;
    this.config = this.normalizeConfig(config);

    this.outputChannel.appendLine("MCP Client Manager initialized");

    // Set up server process manager event handlers
    this.setupServerProcessHandlers();
  }

  /**
   * Normalize and validate client configuration
   */
  private normalizeConfig(config: Partial<ClientConfig>): ClientConfig {
    return {
      autoConnect: config.autoConnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
      reconnectDelay: config.reconnectDelay ?? 2000,
      connectionTimeout: config.connectionTimeout ?? 10000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Set up event handlers for server process manager
   */
  private setupServerProcessHandlers(): void {
    this.serverProcessManager.on("started", () => {
      if (this.config.autoConnect) {
        this.outputChannel.appendLine(
          "Server started, attempting to connect MCP client...",
        );
        this.connect().catch((error) => {
          this.outputChannel.appendLine(
            `Failed to auto-connect MCP client: ${error.message}`,
          );
        });
      }
    });

    this.serverProcessManager.on("stopped", () => {
      if (this.isConnected()) {
        this.outputChannel.appendLine(
          "Server stopped, disconnecting MCP client...",
        );
        this.disconnect().catch((error) => {
          this.outputChannel.appendLine(
            `Error disconnecting MCP client: ${error.message}`,
          );
        });
      }
    });

    this.serverProcessManager.on("crashed", () => {
      if (this.isConnected()) {
        this.outputChannel.appendLine(
          "Server crashed, handling MCP client disconnection...",
        );
        this.handleServerCrash();
      }
    });
  }

  /**
   * Connect to the MCP server
   */
  public async connect(): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") {
      throw new Error(`Client is already ${this.state}`);
    }

    if (this.isDisposed) {
      throw new Error("MCPClientManager has been disposed");
    }

    if (!this.serverProcessManager.isRunning()) {
      throw new Error("Server process is not running");
    }

    this.outputChannel.appendLine("Connecting to MCP server...");
    this.setState("connecting");

    try {
      // Clear any previous error state
      this.lastError = null;

      // Get the managed server process
      const serverProcess = this.serverProcessManager.getProcess();
      if (!serverProcess) {
        throw new Error("Server process not available");
      }

      // Create transport wrapping the existing process
      this.transport = new ManagedProcessTransport({
        process: serverProcess,
        sessionId: `vscode-${Date.now()}`,
      });

      // Create MCP SDK client
      this.client = new Client(
        {
          name: "ast-copilot-helper-vscode",
          version: "1.5.0",
        },
        {
          capabilities: {},
        },
      );

      // Set up transport event handlers
      this.setupTransportHandlers();

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.state === "connecting") {
          this.handleConnectionTimeout();
        }
      }, this.config.connectionTimeout);

      // Connect to transport (this starts the transport and initializes the connection)
      await this.client.connect(this.transport);

      this.connectTime = new Date();
      this.setState("connected");
      this.reconnectAttempts = 0;

      const serverCapabilities = this.client.getServerCapabilities();
      const serverVersion = this.client.getServerVersion();

      this.outputChannel.appendLine(`MCP client connected successfully`);
      this.outputChannel.appendLine(
        `Server version: ${serverVersion?.name} ${serverVersion?.version}`,
      );
      this.outputChannel.appendLine(
        `Server capabilities: ${JSON.stringify(serverCapabilities, null, 2)}`,
      );

      // Start heartbeat monitoring
      this.startHeartbeat();

      const connectionInfo = this.getConnectionInfo();
      this.emit("connected", connectionInfo);
      if (serverCapabilities) {
        this.emit("serverCapabilities", serverCapabilities);
      }
    } catch (error) {
      this.handleConnectionError(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    } finally {
      this.clearConnectionTimeout();
    }
  }

  /**
   * Disconnect from the MCP server
   */
  public async disconnect(): Promise<void> {
    if (this.state === "disconnected") {
      return;
    }

    this.outputChannel.appendLine("Disconnecting from MCP server...");
    this.setState("disconnected");

    // Clear timers
    this.clearTimers();

    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
    } catch (error) {
      this.outputChannel.appendLine(`Error during disconnection: ${error}`);
    }

    this.connectTime = null;
    this.outputChannel.appendLine("MCP client disconnected");

    this.emit("disconnected", this.getConnectionInfo());
  }

  /**
   * Reconnect to the MCP server
   */
  public async reconnect(): Promise<void> {
    this.outputChannel.appendLine("Reconnecting to MCP server...");

    if (this.state !== "disconnected") {
      await this.disconnect();
    }

    // Add a small delay before reconnect
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.connect();
  }

  /**
   * Get current connection state
   */
  public getState(): ClientState {
    return this.state;
  }

  /**
   * Check if client is connected
   */
  public isConnected(): boolean {
    return this.state === "connected";
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(): ClientConnectionInfo {
    return {
      state: this.state,
      connectTime: this.connectTime || undefined,
      lastError: this.lastError || undefined,
      reconnectAttempts: this.reconnectAttempts,
      serverCapabilities: this.client ? {} : undefined, // Will be populated with actual capabilities
      clientInfo: {
        name: "ast-copilot-helper-vscode",
        version: "0.1.0",
      },
    };
  }

  /**
   * Get the MCP client instance
   */
  public getClient(): Client | null {
    return this.client;
  }

  /**
   * List available tools from the server
   */
  public async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.isConnected()) {
      throw new Error("MCP client is not connected");
    }

    try {
      const result = await this.client.listTools();
      return result.tools || [];
    } catch (error) {
      this.outputChannel.appendLine(`Failed to list tools: ${error}`);
      throw error;
    }
  }

  /**
   * Call a tool on the server
   */
  public async callTool(
    name: string,
    arguments_: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (!this.client || !this.isConnected()) {
      throw new Error("MCP client is not connected");
    }

    try {
      const startTime = Date.now();
      this.outputChannel.appendLine(
        `📤 Calling tool: ${name} with args: ${JSON.stringify(arguments_)}`,
      );

      const result = await this.client.callTool({
        name,
        arguments: arguments_,
      });

      const duration = Date.now() - startTime;

      // Extract and display cache information if present
      this.logCacheInfo(result, name, duration);

      this.outputChannel.appendLine(
        `✅ Tool ${name} completed in ${duration}ms`,
      );

      return result;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to call tool ${name}: ${error}`);
      throw error;
    }
  }

  /**
   * Log cache information from tool response
   */
  private logCacheInfo(
    result: unknown,
    _toolName: string,
    duration: number,
  ): void {
    try {
      // Check if result contains cache metadata
      const resultObj = result as Record<string, unknown>;
      const queryMetadata = resultObj?.queryMetadata as
        | Record<string, unknown>
        | undefined;

      if (queryMetadata?.cacheInfo) {
        const cacheInfo = queryMetadata.cacheInfo as Record<string, unknown>;
        const { cacheHit, cacheLevel, cacheAge } = cacheInfo;

        if (cacheHit) {
          this.outputChannel.appendLine(
            `💾 Cache HIT (${cacheLevel}) - Age: ${cacheAge}ms - Saved ${duration}ms`,
          );
        } else {
          this.outputChannel.appendLine(
            `🔍 Cache MISS - Result cached for future queries`,
          );
        }
      }

      // Display performance metrics if available
      if (queryMetadata?.performanceMetrics) {
        const metrics = queryMetadata.performanceMetrics as Record<
          string,
          unknown
        >;
        this.outputChannel.appendLine(
          `⚡ Performance: Total=${metrics.totalTime}ms, ` +
            `Vector=${metrics.vectorSearchTime}ms, ` +
            `Ranking=${metrics.rankingTime}ms`,
        );
      }
    } catch (_error) {
      // Silently ignore if result doesn't have expected structure
    }
  }

  /**
   * Get cache statistics from server
   */
  public async getCacheStats(detailed = false): Promise<unknown> {
    return this.callTool("cache_stats", { detailed });
  }

  /**
   * Warm cache with common queries
   */
  public async warmCache(queries?: string[]): Promise<unknown> {
    this.outputChannel.appendLine("🔥 Warming cache...");
    return this.callTool("cache_warm", { queries });
  }

  /**
   * Prune cache entries
   */
  public async pruneCache(
    strategy: "lru" | "age" | "size" = "lru",
    limit?: number,
  ): Promise<unknown> {
    this.outputChannel.appendLine(
      `🧹 Pruning cache (strategy: ${strategy})...`,
    );
    return this.callTool("cache_prune", { strategy, limit });
  }

  /**
   * List available resources from the server
   */
  public async listResources(): Promise<MCPResource[]> {
    if (!this.client || !this.isConnected()) {
      throw new Error("MCP client is not connected");
    }

    try {
      const result = await this.client.listResources();
      return result.resources || [];
    } catch (error) {
      this.outputChannel.appendLine(`Failed to list resources: ${error}`);
      throw error;
    }
  }

  /**
   * Read a resource from the server
   */
  public async readResource(uri: string): Promise<unknown> {
    if (!this.client || !this.isConnected()) {
      throw new Error("MCP client is not connected");
    }

    try {
      this.outputChannel.appendLine(`Reading resource: ${uri}`);
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      this.outputChannel.appendLine(`Failed to read resource ${uri}: ${error}`);
      throw error;
    }
  }

  /**
   * Update client configuration
   */
  public updateConfig(newConfig: Partial<ClientConfig>): void {
    const oldConfig = { ...this.config };
    this.config = this.normalizeConfig({ ...this.config, ...newConfig });

    this.outputChannel.appendLine("MCP client configuration updated");

    // If critical settings changed and client is connected, reconnect
    const criticalSettings = ["connectionTimeout", "heartbeatInterval"];
    const criticalChanged = criticalSettings.some(
      (key) =>
        oldConfig[key as keyof ClientConfig] !==
        this.config[key as keyof ClientConfig],
    );

    if (criticalChanged && this.isConnected()) {
      this.outputChannel.appendLine(
        "Critical settings changed, reconnecting client...",
      );
      this.reconnect().catch((error) => {
        this.outputChannel.appendLine(
          `Failed to reconnect after config change: ${error}`,
        );
      });
    }
  }

  /**
   * Dispose the MCP client manager
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.outputChannel.appendLine("Disposing MCPClientManager...");

    // Disconnect if connected
    if (this.state !== "disconnected") {
      this.disconnect().catch((error) => {
        console.error("Error disconnecting during disposal:", error);
      });
    }

    // Clear all timers
    this.clearTimers();

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Set client state and emit change event
   */
  private setState(newState: ClientState): void {
    const previousState = this.state;
    this.state = newState;

    if (previousState !== newState) {
      this.outputChannel.appendLine(
        `MCP client state changed: ${previousState} → ${newState}`,
      );
      this.emit("stateChanged", newState, previousState);
    }
  }

  /**
   * Set up transport event handlers
   */
  private setupTransportHandlers(): void {
    if (!this.transport) {
      return;
    }

    // Handle transport errors
    this.transport.onerror = (error: Error) => {
      this.outputChannel.appendLine(`Transport error: ${error.message}`);
      this.handleClientError(error);
    };

    // Handle transport close
    this.transport.onclose = () => {
      this.outputChannel.appendLine("Transport closed");
      this.handleClientClose();
    };

    // Note: The Client class itself handles notifications through the Protocol layer
    // We can listen to client events if needed via client.on() once connected
  }

  /**
   * Handle connection timeout
   */
  private handleConnectionTimeout(): void {
    this.outputChannel.appendLine("MCP client connection timeout");
    this.setState("error");
    this.lastError = "Connection timeout";

    this.cleanup();

    this.emit(
      "error",
      new Error("Connection timeout"),
      this.getConnectionInfo(),
    );
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    this.outputChannel.appendLine(
      `MCP client connection error: ${error.message}`,
    );
    this.setState("error");
    this.lastError = error.message;

    this.cleanup();

    this.emit("error", error, this.getConnectionInfo());
  }

  /**
   * Handle client error
   */
  private handleClientError(error: Error): void {
    this.outputChannel.appendLine(`MCP client error: ${error.message}`);
    this.setState("error");
    this.lastError = error.message;

    this.emit("error", error, this.getConnectionInfo());

    // Attempt reconnect if auto-reconnect is enabled
    this.scheduleReconnect();
  }

  /**
   * Handle client close
   */
  private handleClientClose(): void {
    if (this.state === "disconnected") {
      return; // Expected close
    }

    this.outputChannel.appendLine("MCP client connection closed unexpectedly");
    this.setState("disconnected");

    this.cleanup();

    this.emit("disconnected", this.getConnectionInfo());

    // Attempt reconnect if auto-reconnect is enabled
    this.scheduleReconnect();
  }

  /**
   * Handle server crash
   */
  private handleServerCrash(): void {
    this.outputChannel.appendLine(
      "Handling server crash, cleaning up MCP client...",
    );
    this.setState("disconnected");

    this.cleanup();

    this.emit("disconnected", this.getConnectionInfo());
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.outputChannel.appendLine("Maximum reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    this.outputChannel.appendLine(
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}...`,
    );

    this.setState("reconnecting");
    this.emit(
      "reconnecting",
      this.reconnectAttempts,
      this.config.maxReconnectAttempts,
    );

    this.reconnectTimer = setTimeout(() => {
      if (!this.serverProcessManager.isRunning()) {
        this.outputChannel.appendLine(
          "Server not running, skipping reconnect attempt",
        );
        return;
      }

      this.connect().catch((error) => {
        this.outputChannel.appendLine(
          `Reconnect attempt failed: ${error.message}`,
        );
      });
    }, this.config.reconnectDelay);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) {
      return;
    }

    this.heartbeatTimer = setInterval(async () => {
      if (!this.isConnected() || !this.client) {
        return;
      }

      try {
        // Simple ping to check if connection is alive
        await this.client.ping();
      } catch (error) {
        this.outputChannel.appendLine(
          "Heartbeat failed, connection may be lost",
        );
        this.handleClientError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Cleanup client resources
   */
  private cleanup(): void {
    this.clearTimers();

    if (this.client) {
      try {
        this.client.close();
      } catch (_error) {
        // Ignore cleanup errors
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        this.transport.close();
      } catch (_error) {
        // Ignore cleanup errors
      }
      this.transport = null;
    }

    this.connectTime = null;
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.clearConnectionTimeout();
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
}

/**
 * MCP client manager events interface (for TypeScript typing)
 */
export declare interface MCPClientManagerEvents {
  on<K extends keyof MCPClientEvents>(
    event: K,
    listener: MCPClientEvents[K],
  ): this;
  emit<K extends keyof MCPClientEvents>(
    event: K,
    ...args: Parameters<MCPClientEvents[K]>
  ): boolean;
}
