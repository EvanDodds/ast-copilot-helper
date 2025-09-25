import { EventEmitter } from "events";
import { logger } from "../../logging/logger";

/**
 * Transport connection state
 */
export type TransportState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

/**
 * Transport configuration options
 */
export interface TransportConfig {
  /** Maximum number of concurrent connections */
  maxConnections?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
}

/**
 * Transport connection information
 */
export interface ConnectionInfo {
  /** Unique connection identifier */
  id: string;
  /** Connection state */
  state: TransportState;
  /** When connection was established */
  connectedAt?: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Client information if available */
  clientInfo?: {
    name: string;
    version: string;
    userAgent?: string;
  };
  /** Connection statistics */
  stats: {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    errors: number;
  };
}

/**
 * Message structure for transport layer
 */
export interface TransportMessage {
  /** Message ID for correlation */
  id?: string;
  /** Message type */
  type: "request" | "response" | "notification" | "error";
  /** Message method/operation */
  method?: string;
  /** Message payload */
  payload: any;
  /** Message timestamp */
  timestamp: Date;
}

/**
 * Transport error types
 */
export type TransportErrorType =
  | "connection-failed"
  | "connection-lost"
  | "timeout"
  | "protocol-error"
  | "authentication-failed"
  | "rate-limit-exceeded"
  | "message-too-large"
  | "invalid-message";

/**
 * Transport error
 */
export class TransportError extends Error {
  constructor(
    public readonly type: TransportErrorType,
    message: string,
    public readonly connectionId?: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = "TransportError";
  }
}

/**
 * Abstract base transport class
 */
export abstract class Transport extends EventEmitter {
  protected config: Required<TransportConfig>;
  protected connections = new Map<string, ConnectionInfo>();
  protected state: TransportState = "disconnected";
  protected heartbeatTimer?: NodeJS.Timeout;
  protected reconnectTimer?: NodeJS.Timeout;
  protected reconnectAttempts = 0;

  constructor(config: TransportConfig = {}) {
    super();

    this.config = {
      maxConnections: config.maxConnections ?? 100,
      connectionTimeout: config.connectionTimeout ?? 30000,
      requestTimeout: config.requestTimeout ?? 60000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 5000,
      ...config,
    };

    logger.info("Transport initialized", {
      transportType: this.getTransportType(),
      config: this.config,
    });
  }

  /**
   * Get transport type identifier
   */
  abstract getTransportType(): string;

  /**
   * Start the transport
   */
  abstract start(): Promise<void>;

  /**
   * Stop the transport gracefully
   */
  abstract stop(): Promise<void>;

  /**
   * Send a message through the transport
   */
  abstract sendMessage(
    connectionId: string,
    message: TransportMessage,
  ): Promise<void>;

  /**
   * Get current transport state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Get all active connections
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get specific connection info
   */
  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    totalMessages: number;
    totalBytes: number;
    totalErrors: number;
  } {
    const connections = Array.from(this.connections.values());

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter((c) => c.state === "connected")
        .length,
      totalMessages: connections.reduce(
        (sum, c) => sum + c.stats.messagesReceived + c.stats.messagesSent,
        0,
      ),
      totalBytes: connections.reduce(
        (sum, c) => sum + c.stats.bytesReceived + c.stats.bytesSent,
        0,
      ),
      totalErrors: connections.reduce((sum, c) => sum + c.stats.errors, 0),
    };
  }

  /**
   * Broadcast message to all active connections
   */
  async broadcastMessage(message: TransportMessage): Promise<void> {
    const activeConnections = Array.from(this.connections.values()).filter(
      (conn) => conn.state === "connected",
    );

    const promises = activeConnections.map((conn) =>
      this.sendMessage(conn.id, message).catch((error) => {
        logger.error("Broadcast message failed", {
          connectionId: conn.id,
          error: error.message,
        });
      }),
    );

    await Promise.allSettled(promises);

    logger.debug("Message broadcasted", {
      connectionCount: activeConnections.length,
      messageType: message.type,
      method: message.method,
    });
  }

  /**
   * Close specific connection
   */
  abstract closeConnection(connectionId: string): Promise<void>;

  /**
   * Protected method to register a new connection
   */
  protected registerConnection(
    connectionId: string,
    clientInfo?: ConnectionInfo["clientInfo"],
  ): ConnectionInfo {
    if (this.connections.size >= this.config.maxConnections) {
      throw new TransportError(
        "rate-limit-exceeded",
        `Maximum connections limit (${this.config.maxConnections}) reached`,
        connectionId,
      );
    }

    const connection: ConnectionInfo = {
      id: connectionId,
      state: "connecting",
      connectedAt: new Date(),
      lastActivity: new Date(),
      clientInfo,
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0,
      },
    };

    this.connections.set(connectionId, connection);

    this.emit("connection-registered", connectionId, connection);

    logger.info("Connection registered", {
      connectionId,
      clientInfo,
      totalConnections: this.connections.size,
    });

    return connection;
  }

  /**
   * Protected method to update connection state
   */
  protected updateConnectionState(
    connectionId: string,
    state: TransportState,
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const previousState = connection.state;
    connection.state = state;
    connection.lastActivity = new Date();

    if (state === "connected" && previousState !== "connected") {
      connection.connectedAt = new Date();
    }

    this.emit("connection-state-changed", connectionId, state, previousState);

    logger.debug("Connection state changed", {
      connectionId,
      previousState,
      newState: state,
    });
  }

  /**
   * Protected method to handle incoming messages
   */
  protected handleMessage(connectionId: string, rawMessage: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn("Message received for unknown connection", { connectionId });
      return;
    }

    try {
      // Parse and validate message
      const message = this.parseMessage(rawMessage);

      // Update connection statistics
      connection.stats.messagesReceived++;
      connection.stats.bytesReceived += this.getMessageSize(rawMessage);
      connection.lastActivity = new Date();

      this.emit("message-received", connectionId, message);

      logger.debug("Message received", {
        connectionId,
        messageType: message.type,
        method: message.method,
        messageId: message.id,
      });
    } catch (error) {
      connection.stats.errors++;

      const transportError = new TransportError(
        "protocol-error",
        `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
        connectionId,
        error instanceof Error ? error : undefined,
      );

      this.emit("transport-error", transportError);

      logger.error("Message parsing failed", {
        connectionId,
        error: transportError.message,
        rawMessage:
          typeof rawMessage === "string"
            ? rawMessage.substring(0, 200)
            : "non-string",
      });
    }
  }

  /**
   * Protected method to handle connection errors
   */
  protected handleConnectionError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.stats.errors++;
      this.updateConnectionState(connectionId, "error");
    }

    const transportError = new TransportError(
      "connection-failed",
      error.message,
      connectionId,
      error,
    );

    this.emit("transport-error", transportError);

    logger.error("Connection error", {
      connectionId,
      error: error.message,
      stack: error.stack,
    });

    // Attempt reconnection if configured
    if (
      this.config.autoReconnect &&
      this.reconnectAttempts < this.config.maxReconnectAttempts
    ) {
      this.scheduleReconnect(connectionId);
    }
  }

  /**
   * Protected method to unregister a connection
   */
  protected unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.connections.delete(connectionId);

    this.emit("connection-unregistered", connectionId, connection);

    logger.info("Connection unregistered", {
      connectionId,
      totalConnections: this.connections.size,
      stats: connection.stats,
    });
  }

  /**
   * Parse raw message into TransportMessage
   */
  protected parseMessage(rawMessage: any): TransportMessage {
    if (typeof rawMessage === "string") {
      try {
        rawMessage = JSON.parse(rawMessage);
      } catch (error) {
        throw new Error("Invalid JSON message");
      }
    }

    if (!rawMessage || typeof rawMessage !== "object") {
      throw new Error("Message must be an object");
    }

    // Validate required fields
    if (
      !rawMessage.type ||
      !["request", "response", "notification", "error"].includes(
        rawMessage.type,
      )
    ) {
      throw new Error("Invalid message type");
    }

    return {
      id: rawMessage.id,
      type: rawMessage.type,
      method: rawMessage.method,
      payload: rawMessage.payload || rawMessage,
      timestamp: new Date(),
    };
  }

  /**
   * Get approximate message size in bytes
   */
  protected getMessageSize(message: any): number {
    try {
      return JSON.stringify(message).length;
    } catch {
      return 0;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  protected scheduleReconnect(connectionId: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;

      logger.info("Attempting reconnection", {
        connectionId,
        attempt: this.reconnectAttempts,
        maxAttempts: this.config.maxReconnectAttempts,
      });

      this.attemptReconnect(connectionId).catch((error) => {
        logger.error("Reconnection failed", {
          connectionId,
          attempt: this.reconnectAttempts,
          error: error.message,
        });

        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
          this.emit("reconnect-failed", connectionId, this.reconnectAttempts);
        }
      });
    }, this.config.reconnectDelay);
  }

  /**
   * Attempt to reconnect - to be implemented by subclasses
   */
  protected async attemptReconnect(_connectionId: string): Promise<void> {
    // Default implementation - subclasses should override
    throw new Error("Reconnection not implemented for this transport");
  }

  /**
   * Start heartbeat monitoring
   */
  protected startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);

    logger.debug("Heartbeat monitoring started", {
      interval: this.config.heartbeatInterval,
    });
  }

  /**
   * Stop heartbeat monitoring
   */
  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    logger.debug("Heartbeat monitoring stopped");
  }

  /**
   * Perform heartbeat check
   */
  protected async performHeartbeat(): Promise<void> {
    const now = new Date();
    const timeout = this.config.heartbeatInterval * 2; // Allow 2 intervals for response

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.state === "connected") {
        const timeSinceActivity =
          now.getTime() - connection.lastActivity.getTime();

        if (timeSinceActivity > timeout) {
          logger.warn("Connection heartbeat timeout", {
            connectionId,
            timeSinceActivity,
            timeout,
          });

          this.handleConnectionError(
            connectionId,
            new Error("Heartbeat timeout"),
          );
        } else {
          // Send ping message
          try {
            await this.sendMessage(connectionId, {
              type: "notification",
              method: "ping",
              payload: { timestamp: now.toISOString() },
              timestamp: now,
            });
          } catch (error) {
            logger.debug("Heartbeat ping failed", {
              connectionId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  protected cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.connections.clear();
    this.removeAllListeners();

    logger.info("Transport cleanup completed", {
      transportType: this.getTransportType(),
    });
  }
}
