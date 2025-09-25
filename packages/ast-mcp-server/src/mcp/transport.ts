/**
 * MCP Transport Layer Interface and Base Types
 * Defines the contract for MCP message transport mechanisms
 */

import { EventEmitter } from "events";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  MCPMessage,
} from "./protocol";

/**
 * Message handler function type
 */
export type MessageHandler = (message: JSONRPCRequest) => Promise<void>;

/**
 * Transport event types
 */
export interface TransportEvents {
  message: [JSONRPCRequest];
  notification: [JSONRPCNotification];
  error: [Error];
  close: [];
  connect: [];
}

/**
 * Abstract transport interface for MCP communication
 */
export abstract class MCPTransport extends EventEmitter {
  protected isRunning = false;
  protected messageHandler?: MessageHandler;

  /**
   * Start the transport layer
   */
  abstract start(): Promise<void>;

  /**
   * Stop the transport layer
   */
  abstract stop(): Promise<void>;

  /**
   * Send a message (response or notification)
   */
  abstract sendMessage(
    message: JSONRPCResponse | JSONRPCNotification,
  ): Promise<void>;

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Check if transport is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get transport type identifier
   */
  abstract getType(): string;

  /**
   * Get transport statistics
   */
  abstract getStats(): TransportStats;

  /**
   * Parse incoming message from raw data
   */
  protected parseMessage(data: string): MCPMessage | null {
    try {
      const parsed = JSON.parse(data.trim());
      return parsed;
    } catch (error) {
      this.emit(
        "error",
        new Error(
          `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      return null;
    }
  }

  /**
   * Serialize message for sending
   */
  protected serializeMessage(
    message: JSONRPCResponse | JSONRPCNotification,
  ): string {
    return JSON.stringify(message) + "\n";
  }

  /**
   * Handle incoming parsed message
   */
  protected async handleParsedMessage(message: MCPMessage): Promise<void> {
    if ("id" in message && message.id !== undefined) {
      // This is a request
      if (this.messageHandler) {
        await this.messageHandler(message as JSONRPCRequest);
      }
    } else {
      // This is a notification
      this.emit("notification", message as JSONRPCNotification);
    }
  }
}

/**
 * Transport statistics interface
 */
export interface TransportStats {
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  connectionTime?: Date;
  lastMessageTime?: Date;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  type: "stdio" | "tcp";
  messageTimeout?: number;
  maxMessageSize?: number;
  // TCP-specific options
  tcpPort?: number;
  tcpHost?: string;
}

/**
 * Base transport statistics implementation
 */
export abstract class BaseTransportStats implements TransportStats {
  public messagesReceived = 0;
  public messagesSent = 0;
  public errors = 0;
  public connectionTime?: Date;
  public lastMessageTime?: Date;

  protected recordMessageReceived(): void {
    this.messagesReceived++;
    this.lastMessageTime = new Date();
  }

  protected recordMessageSent(): void {
    this.messagesSent++;
    this.lastMessageTime = new Date();
  }

  protected recordError(): void {
    this.errors++;
  }

  protected recordConnection(): void {
    this.connectionTime = new Date();
  }

  public reset(): void {
    this.messagesReceived = 0;
    this.messagesSent = 0;
    this.errors = 0;
    this.connectionTime = undefined;
    this.lastMessageTime = undefined;
  }
}
