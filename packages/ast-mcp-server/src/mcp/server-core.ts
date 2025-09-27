/**
 * MCP Server Core Implementation
 * Handles server lifecycle, capability negotiation, and request routing
 */

/* eslint-disable no-console -- Server logging is intentional */

import { EventEmitter } from "events";
import type {
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPServerConfig,
  ServerCapabilities,
  InitializeParams,
  InitializeResult,
  ToolCallParams,
  ResourceReadParams,
  ListToolsResult,
  ListResourcesResult,
} from "./protocol/types";
import { MCPProtocolHandler } from "./protocol/handler";

export interface MCPServer {
  initialize(config: MCPServerConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  handleRequest(request: MCPRequest): Promise<MCPResponse>;
  handleNotification(notification: MCPNotification): Promise<void>;
  advertiseCapabilities(): ServerCapabilities;
}

export class ASTMCPServer extends EventEmitter implements MCPServer {
  private config?: MCPServerConfig;
  public isInitialized = false;
  public isRunning = false;
  private requestCount = 0;

  // Plugin registries - will be injected via dependency injection
  private toolRegistry?: any; // Will be MCPToolRegistry
  private resourceRegistry?: any; // Will be MCPResourceRegistry

  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * Initialize the MCP server with configuration
   */
  async initialize(config: MCPServerConfig): Promise<void> {
    if (this.isInitialized) {
      throw new Error("Server already initialized");
    }

    this.config = config;

    console.log(`Initializing MCP Server: ${config.name} v${config.version}`);

    // Validate configuration
    this.validateConfig(config);

    // Set up default capabilities if not provided
    if (!config.capabilities) {
      config.capabilities = this.getDefaultCapabilities();
    }

    this.isInitialized = true;
    this.emit("initialized", config);

    console.log("MCP Server initialized successfully");
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Server must be initialized before starting");
    }

    if (this.isRunning) {
      console.log("MCP Server already running");
      return;
    }

    console.log(`Starting MCP Server on ${this.config!.transport}`);

    // Transport-specific startup will be handled by transport layers
    this.isRunning = true;
    this.emit("started");

    console.log("MCP Server started successfully");
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log("Stopping MCP Server...");

    // Graceful shutdown - notify clients
    const shutdownNotification = MCPProtocolHandler.createNotification(
      "notifications/cancelled",
      { reason: "Server shutdown" },
    );

    this.emit("shutdown", shutdownNotification);

    this.isRunning = false;
    this.emit("stopped");

    console.log("MCP Server stopped");
  }

  /**
   * Handle incoming MCP requests
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    this.requestCount++;
    const startTime = Date.now();

    try {
      console.log(`MCP Request #${this.requestCount}: ${request.method}`);

      // Validate request
      if (!MCPProtocolHandler.isValidMethod(request.method)) {
        return MCPProtocolHandler.createErrorResponse(
          request.id ?? null,
          MCPProtocolHandler.createInvalidRequest(
            `Invalid method name: ${request.method}`,
          ),
        );
      }

      let result: any;

      // Route request to appropriate handler
      switch (request.method) {
        case "initialize":
          result = await this.handleInitialize(
            request.params as unknown as InitializeParams,
          );
          break;

        case "initialized":
          // This is typically a notification, but handle as request for completeness
          result = null;
          break;

        case "tools/list":
          result = await this.handleListTools();
          break;

        case "tools/call":
          result = await this.handleCallTool(
            request.params as unknown as ToolCallParams,
          );
          break;

        case "resources/list":
          result = await this.handleListResources();
          break;

        case "resources/read":
          result = await this.handleReadResource(
            request.params as unknown as ResourceReadParams,
          );
          break;

        case "ping":
          result = { acknowledged: true, timestamp: Date.now() };
          break;

        default:
          return MCPProtocolHandler.createErrorResponse(
            request.id ?? null,
            MCPProtocolHandler.createMethodNotFound(request.method),
          );
      }

      const duration = Date.now() - startTime;
      console.log(`MCP Request completed in ${duration}ms`);

      return MCPProtocolHandler.createSuccessResponse(
        request.id ?? null,
        result,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`MCP Request failed after ${duration}ms:`, error);

      return MCPProtocolHandler.createErrorResponse(
        request.id ?? null,
        MCPProtocolHandler.createInternalError(
          error instanceof Error ? error.message : "Unknown error",
        ),
      );
    }
  }

  /**
   * Handle incoming MCP notifications
   */
  async handleNotification(notification: MCPNotification): Promise<void> {
    try {
      console.log(`MCP Notification: ${notification.method}`);

      switch (notification.method) {
        case "initialized":
          // Client has completed initialization
          this.emit("client-initialized");
          break;

        case "notifications/cancelled":
          // Client is cancelling a request
          this.emit("request-cancelled", notification.params);
          break;

        default:
          console.warn(`Unknown notification method: ${notification.method}`);
      }
    } catch (error) {
      console.error("Error handling notification:", error);
      // Notifications don't have responses, so we just log the error
    }
  }

  /**
   * Get server capabilities
   */
  advertiseCapabilities(): ServerCapabilities {
    return this.config?.capabilities || this.getDefaultCapabilities();
  }

  /**
   * Set tool registry (dependency injection)
   */
  setToolRegistry(registry: any): void {
    this.toolRegistry = registry;
  }

  /**
   * Set resource registry (dependency injection)
   */
  setResourceRegistry(registry: any): void {
    this.resourceRegistry = registry;
  }

  /**
   * Private Methods
   */

  private async handleInitialize(
    params: InitializeParams,
  ): Promise<InitializeResult> {
    console.log("Handling initialization request");

    // Validate protocol version
    if (
      !MCPProtocolHandler.isCompatibleProtocolVersion(params.protocolVersion)
    ) {
      throw new Error(
        `Unsupported protocol version: ${params.protocolVersion}`,
      );
    }

    // Store client capabilities for feature negotiation (will be used later)
    console.log("Client capabilities:", params.capabilities);

    console.log("Client info:", params.clientInfo);
    console.log("Client capabilities:", params.capabilities);

    // Return server info and capabilities
    return {
      protocolVersion: MCPProtocolHandler.getSupportedProtocolVersion(),
      capabilities: this.advertiseCapabilities(),
      serverInfo: {
        name: this.config!.name,
        version: this.config!.version,
      },
    };
  }

  private async handleListTools(): Promise<ListToolsResult> {
    if (!this.toolRegistry) {
      throw new Error("Tool registry not available");
    }

    // This will be implemented when tool registry is available
    return { tools: [] };
  }

  private async handleCallTool(_params: ToolCallParams): Promise<any> {
    if (!this.toolRegistry) {
      throw new Error("Tool registry not available");
    }

    // This will be implemented when tool registry is available
    throw new Error("Tool execution not yet implemented");
  }

  private async handleListResources(): Promise<ListResourcesResult> {
    if (!this.resourceRegistry) {
      throw new Error("Resource registry not available");
    }

    // This will be implemented when resource registry is available
    return { resources: [] };
  }

  private async handleReadResource(_params: ResourceReadParams): Promise<any> {
    if (!this.resourceRegistry) {
      throw new Error("Resource registry not available");
    }

    // This will be implemented when resource registry is available
    throw new Error("Resource reading not yet implemented");
  }

  private validateConfig(config: MCPServerConfig): void {
    if (!config.name) {
      throw new Error("Server name is required");
    }

    if (!config.version) {
      throw new Error("Server version is required");
    }

    if (!["stdio", "websocket", "http"].includes(config.transport)) {
      throw new Error(`Invalid transport: ${config.transport}`);
    }

    if (config.transport !== "stdio" && !config.port) {
      throw new Error(`Port is required for ${config.transport} transport`);
    }
  }

  private getDefaultCapabilities(): ServerCapabilities {
    return {
      tools: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
        listChanged: false,
      },
      logging: {},
    };
  }

  private setupErrorHandling(): void {
    this.on("error", (error) => {
      console.error("MCP Server error:", error);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
  }
}
