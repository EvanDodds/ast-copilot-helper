import { createInterface } from "readline";
import type { TransportConfig, TransportMessage, ConnectionInfo } from "./base";
import { Transport, TransportError } from "./base";
import { logger } from "../../logging/logger";

/**
 * STDIO transport configuration
 */
export interface StdioTransportConfig extends TransportConfig {
  /** Input stream (defaults to process.stdin) */
  input?: NodeJS.ReadableStream;
  /** Output stream (defaults to process.stdout) */
  output?: NodeJS.WritableStream;
  /** Enable line buffering */
  lineBuffering?: boolean;
  /** Maximum line length */
  maxLineLength?: number;
}

/**
 * STDIO transport for MCP server communication
 * Ideal for VS Code MCP integration and command-line clients
 */
export class StdioTransport extends Transport {
  private readonly input: NodeJS.ReadableStream;
  private readonly output: NodeJS.WritableStream;
  private readonly lineBuffering: boolean;
  private readonly maxLineLength: number;
  private readline?: ReturnType<typeof createInterface>;
  private connection?: ConnectionInfo;
  private readonly connectionId = "stdio-main";

  constructor(config: StdioTransportConfig = {}) {
    // Disable auto-reconnection for STDIO transport by default since 
    // STDIO connections are typically one-time and reconnection doesn't make sense
    const stdioConfig = {
      autoReconnect: false,
      ...config,
    };
    
    super(stdioConfig);

    this.input = config.input || process.stdin;
    this.output = config.output || process.stdout;
    this.lineBuffering = config.lineBuffering ?? true;
    this.maxLineLength = config.maxLineLength ?? 1024 * 1024; // 1MB max line

    logger.info("STDIO Transport initialized", {
      lineBuffering: this.lineBuffering,
      maxLineLength: this.maxLineLength,
      hasCustomStreams: !!(config.input || config.output),
    });
  }

  getTransportType(): string {
    return "stdio";
  }

  async start(): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") {
      throw new TransportError(
        "connection-failed",
        "STDIO transport already started",
      );
    }

    this.state = "connecting";

    try {
      // Register the main STDIO connection
      this.connection = this.registerConnection(this.connectionId, {
        name: "stdio-client",
        version: "1.0.0",
        userAgent: "stdio",
      });

      // Set up error handlers first to catch initialization errors
      this.setupErrorHandlers();

      // Test stream availability and catch immediate errors
      await new Promise<void>((resolve, reject) => {
        const errorTimeout = setTimeout(() => {
          reject(new Error("Stream initialization timeout"));
        }, 1000);

        const cleanup = () => {
          clearTimeout(errorTimeout);
          this.input.off("error", handleError);
          this.output.off("error", handleError);
        };

        const handleError = (error: Error) => {
          cleanup();
          reject(error);
        };

        // Listen for immediate errors during initialization
        this.input.once("error", handleError);
        this.output.once("error", handleError);

        // Try to access the streams - this may trigger errors in faulty streams
        process.nextTick(() => {
          try {
            // For readable streams that might error on read attempt
            if (typeof (this.input as any)._read === "function") {
              // Force a read attempt to trigger potential errors
              (this.input as any)._read(0);
            }
            cleanup();
            resolve();
          } catch (error) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      });

      // Set up input stream handling
      if (this.lineBuffering) {
        this.setupLineBufferedInput();
      } else {
        this.setupRawInput();
      }

      this.updateConnectionState(this.connectionId, "connected");
      this.state = "connected";

      // Start heartbeat monitoring
      this.startHeartbeat();

      this.emit("transport-started");

      logger.info("STDIO transport started successfully", {
        connectionId: this.connectionId,
      });
    } catch (error) {
      this.state = "error";

      const transportError = new TransportError(
        "connection-failed",
        `Failed to start STDIO transport: ${error instanceof Error ? error.message : String(error)}`,
        this.connectionId,
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
      // Clean up readline interface
      if (this.readline) {
        this.readline.close();
        this.readline = undefined;
      }

      // Stop heartbeat monitoring
      this.stopHeartbeat();

      // Update connection state
      if (this.connection) {
        this.updateConnectionState(this.connectionId, "disconnected");
        this.unregisterConnection(this.connectionId);
        this.connection = undefined;
      }

      this.state = "disconnected";

      this.emit("transport-stopped");

      logger.info("STDIO transport stopped gracefully");
    } catch (error) {
      logger.error("Error stopping STDIO transport", {
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
    if (connectionId !== this.connectionId) {
      throw new TransportError(
        "connection-failed",
        `Invalid connection ID: ${connectionId}`,
        connectionId,
      );
    }

    if (this.state !== "connected" || !this.connection) {
      throw new TransportError(
        "connection-failed",
        "STDIO transport not connected",
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
      if (serialized.length > this.maxLineLength) {
        throw new TransportError(
          "message-too-large",
          `Message exceeds maximum length of ${this.maxLineLength} bytes`,
          connectionId,
        );
      }

      // Write to output stream
      await new Promise<void>((resolve, reject) => {
        const writeCallback = (error?: Error | null) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        if (this.lineBuffering) {
          this.output.write(serialized + "\n", writeCallback);
        } else {
          this.output.write(serialized, writeCallback);
        }
      });

      // Update connection statistics
      this.connection.stats.messagesSent++;
      this.connection.stats.bytesSent += serialized.length;
      this.connection.lastActivity = new Date();

      this.emit("message-sent", connectionId, message);

      logger.debug("Message sent via STDIO", {
        connectionId,
        messageType: message.type,
        method: message.method,
        messageId: message.id,
        size: serialized.length,
      });
    } catch (error) {
      if (this.connection) {
        this.connection.stats.errors++;
      }

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
    if (connectionId !== this.connectionId) {
      logger.warn("Attempt to close unknown connection", { connectionId });
      return;
    }

    await this.stop();
  }

  /**
   * Set up line-buffered input processing
   */
  private setupLineBufferedInput(): void {
    this.readline = createInterface({
      input: this.input,
      output: undefined, // Don't echo
      crlfDelay: Infinity,
    });

    this.readline.on("line", (line: string) => {
      if (line.trim()) {
        this.handleIncomingMessage(line);
      }
    });

    this.readline.on("close", () => {
      logger.debug("STDIO readline interface closed");
      this.handleConnectionError(
        this.connectionId,
        new Error("Input stream closed"),
      );
    });

    logger.debug("Line-buffered input setup completed");
  }

  /**
   * Set up raw input processing
   */
  private setupRawInput(): void {
    let currentMessage = "";

    this.input.on("data", (chunk: Buffer) => {
      const data = chunk.toString("utf8");
      currentMessage += data;

      // Try to parse complete JSON messages
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      let messageStart = 0;

      for (let i = 0; i < currentMessage.length; i++) {
        const char = currentMessage[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\" && inString) {
          escaped = true;
          continue;
        }

        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;

            if (braceCount === 0) {
              // Complete message found
              const messageJson = currentMessage.substring(messageStart, i + 1);
              this.handleIncomingMessage(messageJson);
              messageStart = i + 1;
            }
          }
        }
      }

      // Keep remaining incomplete message
      if (messageStart < currentMessage.length) {
        currentMessage = currentMessage.substring(messageStart);
      } else {
        currentMessage = "";
      }

      // Prevent memory issues with very long incomplete messages
      if (currentMessage.length > this.maxLineLength) {
        this.handleConnectionError(
          this.connectionId,
          new Error("Message buffer overflow"),
        );
        currentMessage = "";
      }
    });

    this.input.on("end", () => {
      logger.debug("STDIO input stream ended");
      this.handleConnectionError(
        this.connectionId,
        new Error("Input stream ended"),
      );
    });

    logger.debug("Raw input setup completed");
  }

  /**
   * Set up error handlers for streams
   */
  private setupErrorHandlers(): void {
    this.input.on("error", (error) => {
      logger.error("STDIO input stream error", { error: error.message });
      this.handleConnectionError(this.connectionId, error);
    });

    this.output.on("error", (error) => {
      logger.error("STDIO output stream error", { error: error.message });
      this.handleConnectionError(this.connectionId, error);
    });

    // Handle process signals for graceful shutdown
    const handleShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down STDIO transport`);
      this.stop().catch((error) => {
        logger.error("Error during shutdown", { error: error.message });
      });
    };

    process.once("SIGINT", () => handleShutdown("SIGINT"));
    process.once("SIGTERM", () => handleShutdown("SIGTERM"));
  }

  /**
   * Handle incoming message from input stream
   */
  private handleIncomingMessage(rawMessage: string): void {
    try {
      this.handleMessage(this.connectionId, rawMessage);
    } catch (error) {
      logger.error("Failed to handle incoming message", {
        error: error instanceof Error ? error.message : String(error),
        messagePreview: rawMessage.substring(0, 200),
      });
    }
  }

  /**
   * Get STDIO-specific connection information
   */
  getStdioConnectionInfo(): {
    isConnected: boolean;
    connection?: ConnectionInfo;
    inputType: string;
    outputType: string;
  } {
    return {
      isConnected: this.state === "connected",
      connection: this.connection,
      inputType: this.input.constructor.name,
      outputType: this.output.constructor.name,
    };
  }

  /**
   * Check if transport can handle multiple connections
   */
  supportsMultipleConnections(): boolean {
    return false; // STDIO is inherently single-connection
  }

  /**
   * Override heartbeat for STDIO - use ping/pong pattern
   */
  protected override async performHeartbeat(): Promise<void> {
    if (!this.connection || this.connection.state !== "connected") {
      return;
    }

    try {
      await this.sendMessage(this.connectionId, {
        type: "notification",
        method: "ping",
        payload: { timestamp: new Date().toISOString() },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.debug("STDIO heartbeat failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Override attemptReconnect for STDIO transport
   * STDIO connections cannot be reconnected, so this is a no-op
   */
  protected override async attemptReconnect(connectionId: string): Promise<void> {
    logger.warn("STDIO transport does not support reconnection", { connectionId });
    // STDIO connections are typically one-time and cannot be reconnected
    // If reconnection is needed, the entire transport should be restarted
    throw new Error("STDIO transport does not support reconnection");
  }
}
