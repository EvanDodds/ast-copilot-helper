import type { TransportConfig, TransportMessage, ConnectionInfo } from "./base";
import { Transport, TransportError } from "./base";
import { logger } from "../../logging/logger";

/**
 * WebSocket transport configuration
 */
export interface WebSocketTransportConfig extends TransportConfig {
  /** Server port (for server mode) */
  port?: number;
  /** Server host (for server mode) */
  host?: string;
  /** Client URL (for client mode) */
  url?: string;
  /** Maximum connections (server mode only) */
  maxConnections?: number;
  /** WebSocket ping interval (milliseconds) */
  pingInterval?: number;
  /** WebSocket pong timeout (milliseconds) */
  pongTimeout?: number;
  /** Message size limit (bytes) */
  maxMessageSize?: number;
}

/**
 * WebSocket connection context
 */
interface WebSocketConnection extends ConnectionInfo {
  /** Connection type */
  type: "client" | "server";
  /** Remote address */
  remoteAddress?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * WebSocket transport for MCP server communication
 * Supports both server and client modes
 *
 * NOTE: This is a basic implementation. For production use,
 * consider using the 'ws' library for full WebSocket support.
 */
export class WebSocketTransport extends Transport {
  private readonly mode: "server" | "client";
  private readonly port: number;
  private readonly host: string;
  private readonly url?: string;
  private readonly maxConnections: number;
  private readonly pingInterval: number;
  private readonly pongTimeout: number;
  private readonly maxMessageSize: number;

  private isRunning = false;
  protected override connections = new Map<string, WebSocketConnection>();

  constructor(config: WebSocketTransportConfig = {}) {
    super(config);

    this.mode = config.url ? "client" : "server";
    this.port = config.port ?? 8080;
    this.host = config.host ?? "localhost";
    this.url = config.url;
    this.maxConnections = config.maxConnections ?? 100;
    this.pingInterval = config.pingInterval ?? 30000; // 30 seconds
    this.pongTimeout = config.pongTimeout ?? 5000; // 5 seconds
    this.maxMessageSize = config.maxMessageSize ?? 10 * 1024 * 1024; // 10MB

    logger.info("WebSocket Transport initialized", {
      mode: this.mode,
      port: this.port,
      host: this.host,
      url: this.url,
      maxConnections: this.maxConnections,
      pingInterval: this.pingInterval,
      pongTimeout: this.pongTimeout,
      maxMessageSize: this.maxMessageSize,
    });
  }

  getTransportType(): string {
    return "websocket";
  }

  async start(): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") {
      throw new TransportError(
        "connection-failed",
        "WebSocket transport already started",
      );
    }

    this.state = "connecting";

    try {
      // For this basic implementation, we'll simulate the transport
      // In a real implementation, you would set up the WebSocket server/client here

      if (this.mode === "server") {
        logger.info(
          `WebSocket server would start on ${this.host}:${this.port}`,
        );
        // NOTE: WebSocket transport is optional per Issue #17 acceptance criteria
        // Future enhancement: Implement WebSocket server using 'ws' library
      } else {
        logger.info(`WebSocket client would connect to ${this.url}`);
        // NOTE: WebSocket transport is optional per Issue #17 acceptance criteria
        // Future enhancement: Implement WebSocket client using 'ws' library
      }

      // Simulate successful startup
      this.isRunning = true;
      this.state = "connected";

      // Start heartbeat monitoring
      this.startHeartbeat();

      this.emit("transport-started");

      logger.info("WebSocket transport started successfully", {
        mode: this.mode,
        note: "Basic implementation - consider using ws library for production",
      });
    } catch (error) {
      this.state = "error";

      const transportError = new TransportError(
        "connection-failed",
        `Failed to start WebSocket transport: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined,
      );

      this.emit("transport-error", transportError);
      throw transportError;
    }
  }

  async stop(): Promise<void> {
    if (this.state === "disconnected" || this.state === "disconnecting") {
      return;
    }

    this.state = "disconnecting";

    try {
      // Stop heartbeat monitoring
      this.stopHeartbeat();

      // Close all connections
      for (const [connectionId] of this.connections) {
        await this.closeConnection(connectionId);
      }
      this.connections.clear();

      this.isRunning = false;
      this.state = "disconnected";

      this.emit("transport-stopped");

      logger.info("WebSocket transport stopped gracefully");
    } catch (error) {
      logger.error("Error stopping WebSocket transport", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.cleanup();
    }
  }

  async sendMessage(
    connectionId: string,
    message: TransportMessage,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new TransportError(
        "connection-failed",
        `Connection not found: ${connectionId}`,
        connectionId,
      );
    }

    if (!this.isRunning) {
      throw new TransportError(
        "connection-failed",
        "WebSocket transport not running",
        connectionId,
      );
    }

    try {
      // Prepare message for output
      const messageData = {
        id: message.id,
        type: message.type,
        method: message.method,
        ...message.payload,
      };

      const serialized = JSON.stringify(messageData);

      // Check message size
      if (serialized.length > this.maxMessageSize) {
        throw new TransportError(
          "message-too-large",
          `Message exceeds maximum size of ${this.maxMessageSize} bytes`,
          connectionId,
        );
      }

      // In a real implementation, you would send the message via WebSocket here
      logger.debug("WebSocket message would be sent", {
        connectionId,
        messageType: message.type,
        method: message.method,
        messageId: message.id,
        size: serialized.length,
      });

      // Update connection statistics
      connection.stats.messagesSent++;
      connection.stats.bytesSent += serialized.length;
      connection.lastActivity = new Date();

      this.emit("message-sent", connectionId, message);
    } catch (error) {
      connection.stats.errors++;

      const transportError = new TransportError(
        "protocol-error",
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        connectionId,
        error instanceof Error ? error : undefined,
      );

      this.emit("transport-error", transportError);
      throw transportError;
    }
  }

  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn("Attempt to close unknown connection", { connectionId });
      return;
    }

    try {
      // In a real implementation, you would close the WebSocket connection here
      logger.debug("WebSocket connection would be closed", {
        connectionId,
        remoteAddress: connection.remoteAddress,
      });

      // Update state and cleanup
      this.updateConnectionState(connectionId, "disconnected");
      this.connections.delete(connectionId);
      this.unregisterConnection(connectionId);
    } catch (error) {
      logger.error("Error closing WebSocket connection", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Simulate a new connection (for testing purposes)
   */
  simulateConnection(
    remoteAddress = "simulated",
    userAgent = "test-client",
  ): string {
    const connectionId = `ws-sim-${Date.now()}`;

    const connection = this.registerConnection(connectionId, {
      name: `websocket-${connectionId}`,
      version: "1.0.0",
      userAgent,
    }) as WebSocketConnection;

    connection.type = "server";
    connection.remoteAddress = remoteAddress;
    connection.userAgent = userAgent;

    this.connections.set(connectionId, connection);
    this.updateConnectionState(connectionId, "connected");

    logger.info("Simulated WebSocket connection created", {
      connectionId,
      remoteAddress,
      userAgent,
    });

    return connectionId;
  }

  /**
   * Get WebSocket-specific information
   */
  getWebSocketInfo(): {
    mode: "server" | "client";
    isRunning: boolean;
    connectionCount: number;
    connections: Array<{
      id: string;
      remoteAddress?: string;
      userAgent?: string;
      state: string;
      lastActivity?: Date;
      stats: ConnectionInfo["stats"];
    }>;
    serverInfo?: {
      port: number;
      host: string;
      maxConnections: number;
    };
    clientInfo?: {
      url: string;
    };
  } {
    const connections = Array.from(this.connections.values()).map((conn) => ({
      id: conn.id,
      remoteAddress: conn.remoteAddress,
      userAgent: conn.userAgent,
      state: conn.state,
      lastActivity: conn.lastActivity,
      stats: conn.stats,
    }));

    const result: any = {
      mode: this.mode,
      isRunning: this.isRunning,
      connectionCount: this.connections.size,
      connections,
    };

    if (this.mode === "server") {
      result.serverInfo = {
        port: this.port,
        host: this.host,
        maxConnections: this.maxConnections,
      };
    } else {
      result.clientInfo = {
        url: this.url!,
      };
    }

    return result;
  }

  /**
   * Check if transport can handle multiple connections
   */
  supportsMultipleConnections(): boolean {
    return this.mode === "server";
  }

  /**
   * Override heartbeat for WebSocket
   */
  protected override async performHeartbeat(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // In a real WebSocket implementation, you would send ping frames here
    logger.debug("WebSocket heartbeat performed", {
      mode: this.mode,
      connectionCount: this.connections.size,
    });

    // For simulation, just log the heartbeat
    for (const connection of this.connections.values()) {
      if (connection.state === "connected") {
        connection.lastActivity = new Date();
      }
    }
  }
}
