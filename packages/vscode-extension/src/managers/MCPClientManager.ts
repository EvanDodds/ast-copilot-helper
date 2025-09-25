import type * as vscode from "vscode";
import { EventEmitter } from "events";
import type { ServerProcessManager } from "./ServerProcessManager";

// Mock MCP Client interfaces until full SDK is available

interface MCPCapabilities {
  experimental?: Record<string, unknown>;
  logging?: { level?: "error" | "warn" | "info" | "debug" };
  prompts?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  tools?: { listChanged?: boolean };
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface MCPClient {
  connect(transport: MCPTransport): Promise<void>;
  initialize(): Promise<{ capabilities: MCPCapabilities }>;
  close(): Promise<void>;
  ping(): Promise<void>;
  listTools(): Promise<{ tools: MCPTool[] }>;
  callTool(request: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
  listResources(): Promise<{ resources: MCPResource[] }>;
  readResource(request: { uri: string }): Promise<unknown>;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onNotification?: (method: string, params: unknown) => void;
}

interface MCPTransport {
  send(data: unknown): Promise<void>;
  close(): Promise<void>;
  onMessage?: (data: unknown) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onNotification?: (method: string, params: unknown) => void;
}

// Mock implementations
class MockClient implements MCPClient {
  onError?: (error: Error) => void;
  onClose?: () => void;
  onNotification?: (method: string, params: unknown) => void;

  async connect(_transport: MCPTransport): Promise<void> {
    // Mock connection
  }

  async initialize(): Promise<{ capabilities: MCPCapabilities }> {
    return { capabilities: {} };
  }

  async close(): Promise<void> {
    // Mock close
  }

  async ping(): Promise<void> {
    // Mock ping
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return { tools: [] };
  }

  async callTool(_request: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown> {
    return {};
  }

  async listResources(): Promise<{ resources: MCPResource[] }> {
    return { resources: [] };
  }

  async readResource(_request: { uri: string }): Promise<unknown> {
    return {};
  }
}

class MockTransport implements MCPTransport {
  async send(_data: unknown): Promise<void> {
    // Mock send
  }
  async close(): Promise<void> {
    // Mock close
  }
}

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
  private client: MCPClient | null = null;
  private transport: MCPTransport | null = null;
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

      // For now, use mock implementations until MCP SDK is properly integrated
      this.transport = new MockTransport();
      this.client = new MockClient();

      // Set up client event handlers
      this.setupClientHandlers();

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.state === "connecting") {
          this.handleConnectionTimeout();
        }
      }, this.config.connectionTimeout);

      // Connect to transport
      await this.client.connect(this.transport);

      // Initialize the connection
      const initResult = await this.client.initialize();

      this.connectTime = new Date();
      this.setState("connected");
      this.reconnectAttempts = 0;

      this.outputChannel.appendLine(`MCP client connected successfully`);
      this.outputChannel.appendLine(
        `Server capabilities: ${JSON.stringify(initResult.capabilities, null, 2)}`,
      );

      // Start heartbeat monitoring
      this.startHeartbeat();

      const connectionInfo = this.getConnectionInfo();
      this.emit("connected", connectionInfo);
      this.emit("serverCapabilities", initResult.capabilities);
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
  public getClient(): MCPClient | null {
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
      this.outputChannel.appendLine(
        `Calling tool: ${name} with args: ${JSON.stringify(arguments_)}`,
      );
      const result = await this.client.callTool({
        name,
        arguments: arguments_,
      });
      this.outputChannel.appendLine(
        `Tool result: ${JSON.stringify(result, null, 2)}`,
      );
      return result;
    } catch (error) {
      this.outputChannel.appendLine(`Failed to call tool ${name}: ${error}`);
      throw error;
    }
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
   * Set up client event handlers
   */
  private setupClientHandlers(): void {
    if (!this.client) {
      return;
    }

    // Handle client errors
    this.client.onError = (error: Error) => {
      this.handleClientError(error);
    };

    // Handle client close
    this.client.onClose = () => {
      this.handleClientClose();
    };

    // Handle notifications from server
    this.client.onNotification = (method: string, params: unknown) => {
      this.outputChannel.appendLine(`Received notification: ${method}`);
      this.emit("notification", method, params);
    };
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
