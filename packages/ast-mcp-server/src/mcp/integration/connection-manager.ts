import { EventEmitter } from "events";
import type {
  Transport,
  ConnectionInfo,
  TransportMessage,
} from "../transport/base.js";
import type { ASTMCPServer } from "../server-core.js";
import type {
  MCPRequest,
  MCPResponse,
  MCPNotification,
} from "../protocol/types.js";
import { logger } from "../../logging/logger.js";

export interface ConnectionManagerConfig {
  maxConnections?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
  cleanupInterval?: number;
}

export interface ClientConnection {
  id: string;
  transport: Transport;
  connectionInfo: ConnectionInfo;
  lastActivity: Date;
  messageCount: number;
  isActive: boolean;
}

/**
 * Connection manager handles multiple client connections across different transports
 */
export class MCPConnectionManager extends EventEmitter {
  private connections = new Map<string, ClientConnection>();
  private server: ASTMCPServer;
  private config: ConnectionManagerConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(server: ASTMCPServer, config: ConnectionManagerConfig = {}) {
    super();
    this.server = server;
    this.config = {
      maxConnections: 100,
      connectionTimeout: 300000, // 5 minutes
      heartbeatInterval: 30000, // 30 seconds
      cleanupInterval: 60000, // 1 minute
      ...config,
    };

    this.setupEventHandlers();
    this.startCleanupTimer();

    logger.info("Connection manager initialized", {
      maxConnections: this.config.maxConnections,
      connectionTimeout: this.config.connectionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
    });
  }

  /**
   * Add a new transport and set up connection handling
   */
  async addTransport(transport: Transport): Promise<void> {
    // Set up transport event handlers
    transport.on("connection", (connectionInfo: ConnectionInfo) => {
      this.handleNewConnection(transport, connectionInfo);
    });

    transport.on("message", (connectionId: string, message: any) => {
      this.handleMessage(connectionId, message);
    });

    transport.on("disconnection", (connectionId: string) => {
      this.handleDisconnection(connectionId);
    });

    transport.on("error", (connectionId: string, error: Error) => {
      this.handleConnectionError(connectionId, error);
    });

    // Start the transport
    await transport.start();

    logger.info("Transport added to connection manager", {
      transportType: transport.getTransportType(),
    });
  }

  /**
   * Remove and stop a transport
   */
  async removeTransport(transport: Transport): Promise<void> {
    // Remove all connections for this transport
    for (const [connectionId, connection] of this.connections) {
      if (connection.transport === transport) {
        await this.removeConnection(connectionId);
      }
    }

    // Stop the transport
    await transport.stop();

    logger.info("Transport removed from connection manager", {
      transportType: transport.getTransportType(),
    });
  }

  /**
   * Get all active connections
   */
  getConnections(): ClientConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.isActive,
    );
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const connections = Array.from(this.connections.values());
    return {
      totalConnections: connections.length,
      activeConnections: connections.filter((c) => c.isActive).length,
      totalMessages: connections.reduce((sum, c) => sum + c.messageCount, 0),
      connectionsByTransport: connections.reduce(
        (acc, c) => {
          const type = c.transport.getTransportType();
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Send message to specific connection
   */
  async sendMessage(
    connectionId: string,
    message: MCPResponse | MCPNotification,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isActive) {
      throw new Error(`Connection not found or inactive: ${connectionId}`);
    }

    try {
      // Convert MCP message to TransportMessage format
      const transportMessage = this.convertToTransportMessage(message);
      await connection.transport.sendMessage(connectionId, transportMessage);
      connection.lastActivity = new Date();

      logger.debug("Message sent to connection", {
        connectionId,
        messageType: "result" in message ? "response" : "notification",
        method: "method" in message ? message.method : undefined,
      });
    } catch (error) {
      logger.error("Failed to send message to connection", {
        connectionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Broadcast message to all active connections
   */
  async broadcastMessage(message: MCPNotification): Promise<void> {
    const activeConnections = this.getConnections();
    const promises = activeConnections.map((connection) =>
      this.sendMessage(connection.id, message).catch((error) => {
        logger.warn("Failed to broadcast to connection", {
          connectionId: connection.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }),
    );

    await Promise.allSettled(promises);

    logger.info("Message broadcast to connections", {
      method: "method" in message ? message.method : undefined,
      connectionCount: activeConnections.length,
    });
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down connection manager", {
      activeConnections: this.getConnections().length,
    });

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Broadcast shutdown notification
    const shutdownNotification: MCPNotification = {
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { reason: "Server shutdown" },
    };

    await this.broadcastMessage(shutdownNotification);

    // Close all connections
    const connectionIds = Array.from(this.connections.keys());
    await Promise.allSettled(
      connectionIds.map((id) => this.removeConnection(id)),
    );

    logger.info("Connection manager shutdown complete");
  }

  /**
   * Private event handlers
   */
  private async handleNewConnection(
    transport: Transport,
    connectionInfo: ConnectionInfo,
  ): Promise<void> {
    // Check connection limits
    if (this.connections.size >= this.config.maxConnections!) {
      logger.warn("Connection limit reached, rejecting new connection", {
        connectionId: connectionInfo.id,
        currentConnections: this.connections.size,
        maxConnections: this.config.maxConnections,
      });

      try {
        await transport.closeConnection(connectionInfo.id);
      } catch (error) {
        logger.error("Failed to close rejected connection", { error });
      }
      return;
    }

    const connection: ClientConnection = {
      id: connectionInfo.id,
      transport,
      connectionInfo,
      lastActivity: new Date(),
      messageCount: 0,
      isActive: true,
    };

    this.connections.set(connectionInfo.id, connection);

    logger.info("New client connection established", {
      connectionId: connectionInfo.id,
      clientInfo: connectionInfo.clientInfo,
      transportType: transport.getTransportType(),
      totalConnections: this.connections.size,
    });

    this.emit("connection", connection);
  }

  private async handleMessage(
    connectionId: string,
    message: any,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn("Received message from unknown connection", { connectionId });
      return;
    }

    // Update connection activity
    connection.lastActivity = new Date();
    connection.messageCount++;

    try {
      // Parse and validate message
      const parsedMessage = this.parseMessage(message);

      if (this.isRequest(parsedMessage)) {
        // Handle request - expects response
        const response = await this.server.handleRequest(parsedMessage);
        await this.sendMessage(connectionId, response);
      } else if (this.isNotification(parsedMessage)) {
        // Handle notification - no response expected
        await this.server.handleNotification(parsedMessage);
      } else {
        logger.warn("Received invalid message format", {
          connectionId,
          message,
        });
      }
    } catch (error) {
      logger.error("Error processing message", {
        connectionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // If it's a request, send error response
      if (this.isRequest(message) && message.id !== undefined) {
        const errorResponse: MCPResponse = {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603, // Internal error
            message: "Internal server error",
          },
        };

        try {
          await this.sendMessage(connectionId, errorResponse);
        } catch (sendError) {
          logger.error("Failed to send error response", {
            connectionId,
            sendError:
              sendError instanceof Error ? sendError.message : "Unknown error",
          });
        }
      }
    }
  }

  private async handleDisconnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;

      logger.info("Client connection closed", {
        connectionId,
        messageCount: connection.messageCount,
        duration: Date.now() - connection.lastActivity.getTime(),
      });

      this.emit("disconnection", connection);

      // Remove connection after a brief delay to allow for cleanup
      setTimeout(() => {
        this.connections.delete(connectionId);
      }, 5000);
    }
  }

  private async handleConnectionError(
    connectionId: string,
    error: Error,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.error("Connection error", {
        connectionId,
        error: error.message,
      });

      this.emit("connectionError", { connection, error });

      // Mark connection as inactive
      connection.isActive = false;
    }
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        if (connection.isActive) {
          await connection.transport.closeConnection(connectionId);
        }
      } catch (error) {
        logger.warn("Error closing connection", {
          connectionId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        this.connections.delete(connectionId);
      }
    }
  }

  /**
   * Message conversion utilities
   */
  private convertToTransportMessage(
    message: MCPResponse | MCPNotification,
  ): TransportMessage {
    if ("result" in message || "error" in message) {
      // It's a response
      return {
        id: message.id?.toString(),
        type: "error" in message ? "error" : "response",
        payload: message,
        timestamp: new Date(),
      };
    } else {
      // It's a notification
      const notification = message as MCPNotification;
      return {
        type: "notification",
        method: notification.method,
        payload: message,
        timestamp: new Date(),
      };
    }
  }

  private parseMessage(message: any): MCPRequest | MCPNotification {
    // Basic validation
    if (!message || typeof message !== "object") {
      throw new Error("Invalid message format");
    }

    if (message.jsonrpc !== "2.0") {
      throw new Error("Invalid JSON-RPC version");
    }

    if (!message.method || typeof message.method !== "string") {
      throw new Error("Missing or invalid method");
    }

    return message;
  }

  private isRequest(message: any): message is MCPRequest {
    return message && typeof message.id !== "undefined";
  }

  private isNotification(message: any): message is MCPNotification {
    return message && typeof message.id === "undefined";
  }

  private setupEventHandlers(): void {
    // Server event handlers
    this.server.on("initialized", () => {
      logger.info("MCP Server initialized, connection manager ready");
    });

    this.server.on("shutdown", () => {
      logger.info("MCP Server shutdown, cleaning up connections");
      this.shutdown();
    });
  }

  private startCleanupTimer(): void {
    if (this.config.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupInactiveConnections();
      }, this.config.cleanupInterval);
    }
  }

  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const timeout = this.config.connectionTimeout!;

    for (const [connectionId, connection] of this.connections) {
      if (
        connection.isActive &&
        now - connection.lastActivity.getTime() > timeout
      ) {
        logger.info("Cleaning up inactive connection", {
          connectionId,
          lastActivity: connection.lastActivity,
          inactiveFor: now - connection.lastActivity.getTime(),
        });

        this.removeConnection(connectionId);
      }
    }
  }
}
