/**
 * TCP Transport Implementation
 * Handles MCP communication via TCP sockets for remote connections
 */

import type { Server, Socket } from "net";
import { createServer } from "net";
import type { JSONRPCResponse, JSONRPCNotification } from "./protocol";
import { MCPTransport, BaseTransportStats } from "./transport.js";

/**
 * Statistics for TCP transport
 */
class TCPTransportStats extends BaseTransportStats {
  public activeConnections = 0;
  public totalConnections = 0;

  constructor() {
    super();
  }

  // Public methods to access protected functionality
  public recordMessageReceivedEvent(): void {
    this.recordMessageReceived();
  }

  public recordMessageSentEvent(): void {
    this.recordMessageSent();
  }

  public recordErrorEvent(): void {
    this.recordError();
  }

  public recordConnectionEvent(): void {
    this.recordConnection();
    this.totalConnections++;
    this.activeConnections++;
  }

  public recordDisconnectionEvent(): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
    }
  }
}

/**
 * TCP transport implementation for MCP communication
 * Handles message exchange via TCP sockets for remote connections
 */
export class TCPTransport extends MCPTransport {
  private server?: Server;
  private clients: Map<string, Socket> = new Map();
  private stats: TCPTransportStats;
  private port: number;
  private host: string;
  private clientBuffers: Map<string, string> = new Map();

  constructor(port = 3000, host = "localhost") {
    super();
    this.port = port;
    this.host = host;
    this.stats = new TCPTransportStats();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("TCP transport is already running");
    }

    try {
      await this.startServer();
      this.isRunning = true;
      this.emit("connect");
    } catch (error) {
      this.stats.recordErrorEvent();
      throw new Error(
        `Failed to start TCP transport: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close all client connections
      for (const [clientId, socket] of this.clients) {
        socket.destroy();
        this.clients.delete(clientId);
        this.clientBuffers.delete(clientId);
      }

      // Close server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      this.isRunning = false;
      this.stats.activeConnections = 0;
      this.emit("close");
    } catch (error) {
      this.stats.recordErrorEvent();
      throw new Error(
        `Failed to stop TCP transport: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendMessage(
    message: JSONRPCResponse | JSONRPCNotification,
  ): Promise<void> {
    if (!this.isRunning) {
      throw new Error("TCP transport is not running");
    }

    if (this.clients.size === 0) {
      throw new Error("No active TCP connections");
    }

    try {
      const serialized = this.serializeMessage(message);

      // Send to all connected clients
      const sendPromises: Promise<void>[] = [];
      for (const socket of this.clients.values()) {
        sendPromises.push(this.sendToSocket(socket, serialized));
      }

      await Promise.all(sendPromises);
      this.stats.recordMessageSentEvent();
    } catch (error) {
      this.stats.recordErrorEvent();
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getType(): string {
    return "tcp";
  }

  getStats(): TCPTransportStats {
    return this.stats;
  }

  /**
   * Get server address info
   */
  getAddress(): { host: string; port: number } | null {
    if (!this.server || !this.isRunning) {
      return null;
    }
    return { host: this.host, port: this.port };
  }

  /**
   * Get list of connected client IDs
   */
  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Start the TCP server
   */
  private async startServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server = createServer();

      this.server.on("connection", this.handleConnection.bind(this));
      this.server.on("error", this.handleServerError.bind(this));

      this.server.listen(this.port, this.host, () => {
        resolve();
      });

      // Set timeout for server startup
      setTimeout(() => {
        if (!this.server?.listening) {
          reject(new Error(`TCP server failed to start within timeout`));
        }
      }, 5000);
    });
  }

  /**
   * Handle new TCP connection
   */
  private handleConnection(socket: Socket): void {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

    this.clients.set(clientId, socket);
    this.clientBuffers.set(clientId, "");
    this.stats.recordConnectionEvent();

    socket.setEncoding("utf8");
    socket.on("data", (data: string) => this.handleClientData(clientId, data));
    socket.on("close", () => this.handleClientDisconnect(clientId));
    socket.on("error", (error) => this.handleClientError(clientId, error));
  }

  /**
   * Handle data from TCP client
   */
  private async handleClientData(
    clientId: string,
    data: string,
  ): Promise<void> {
    try {
      let buffer = this.clientBuffers.get(clientId) || "";
      buffer += data;

      // Process complete lines (messages end with \n)
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      this.clientBuffers.set(clientId, buffer);

      for (const line of lines) {
        if (line.trim()) {
          await this.processLine(line);
        }
      }
    } catch (error) {
      this.stats.recordErrorEvent();
      this.emit(
        "error",
        error instanceof Error
          ? error
          : new Error(`Failed to handle client data: ${String(error)}`),
      );
    }
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    this.clientBuffers.delete(clientId);
    this.stats.recordDisconnectionEvent();
  }

  /**
   * Handle client error
   */
  private handleClientError(clientId: string, error: Error): void {
    this.stats.recordErrorEvent();
    this.emit("error", new Error(`Client ${clientId} error: ${error.message}`));

    // Clean up client
    const socket = this.clients.get(clientId);
    if (socket) {
      socket.destroy();
    }
    this.handleClientDisconnect(clientId);
  }

  /**
   * Handle server-level errors
   */
  private handleServerError(error: Error): void {
    this.stats.recordErrorEvent();
    this.emit("error", error);
  }

  /**
   * Process a complete message line
   */
  private async processLine(line: string): Promise<void> {
    try {
      const message = this.parseMessage(line);
      if (message) {
        this.stats.recordMessageReceivedEvent();
        await this.handleParsedMessage(message);
      }
    } catch (error) {
      this.stats.recordErrorEvent();
      this.emit(
        "error",
        error instanceof Error
          ? error
          : new Error(`Failed to process line: ${String(error)}`),
      );
    }
  }

  /**
   * Send data to a specific socket
   */
  private async sendToSocket(socket: Socket, data: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      socket.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
