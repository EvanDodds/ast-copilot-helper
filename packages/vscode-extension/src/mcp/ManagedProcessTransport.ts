/**
 * Custom MCP Transport for Managed Process
 *
 * This Transport implementation wraps an existing ChildProcess that is managed
 * by ServerProcessManager. Unlike StdioClientTransport, this does NOT spawn
 * or manage the process lifecycle - it only handles communication.
 *
 * Architecture:
 * - ServerProcessManager spawns and manages the MCP server process
 * - ManagedProcessTransport connects to the existing process's stdio streams
 * - MCPClientManager uses this Transport with the real MCP SDK Client
 */

import type { ChildProcess } from "child_process";
import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  JSONRPCMessage,
  MessageExtraInfo,
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";

/**
 * Configuration for ManagedProcessTransport
 */
export interface ManagedProcessTransportConfig {
  /** The managed process to communicate with */
  process: ChildProcess;

  /** Optional session ID for this connection */
  sessionId?: string;
}

/**
 * MCP Transport implementation that uses an existing managed process
 *
 * This Transport wraps a ChildProcess that is already spawned and managed
 * externally (by ServerProcessManager). It handles JSON-RPC message
 * communication over the process's stdin/stdout streams.
 */
export class ManagedProcessTransport extends EventEmitter implements Transport {
  private process: ChildProcess;
  private isStarted = false;
  private isClosed = false;
  private buffer = "";
  public sessionId?: string;

  // Transport callbacks
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (
    message: JSONRPCMessage,
    extra?: MessageExtraInfo,
  ) => void;

  constructor(config: ManagedProcessTransportConfig) {
    super();
    this.process = config.process;
    this.sessionId = config.sessionId;
  }

  /**
   * Start processing messages from the process
   *
   * Sets up listeners for stdout data, stderr data, process exit, and errors.
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error(
        "Process must have stdin and stdout available for MCP communication",
      );
    }

    // Set up stdout listener for incoming messages
    this.process.stdout.on("data", this.handleStdoutData.bind(this));

    // Set up stderr listener for debugging (optional)
    this.process.stderr?.on("data", this.handleStderrData.bind(this));

    // Set up process exit handler
    this.process.on("exit", this.handleProcessExit.bind(this));

    // Set up process error handler
    this.process.on("error", this.handleProcessError.bind(this));

    this.isStarted = true;
  }

  /**
   * Send a JSON-RPC message to the process
   *
   * Serializes the message to JSON and writes it to the process's stdin,
   * followed by a newline delimiter.
   */
  async send(
    message: JSONRPCMessage,
    _options?: TransportSendOptions,
  ): Promise<void> {
    if (this.isClosed) {
      throw new Error("Cannot send message: transport is closed");
    }

    if (!this.process.stdin) {
      throw new Error("Process stdin is not available");
    }

    if (!this.isStarted) {
      throw new Error("Transport not started. Call start() first.");
    }

    // Serialize message to JSON with newline delimiter
    const messageStr = JSON.stringify(message) + "\n";

    // Write to process stdin
    return new Promise<void>((resolve, reject) => {
      const stdin = this.process.stdin;
      if (!stdin) {
        reject(new Error("Process stdin is not available"));
        return;
      }

      stdin.write(messageStr, (error) => {
        if (error) {
          reject(
            new Error(`Failed to write message to process: ${error.message}`),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Close the transport
   *
   * Note: This does NOT kill the process, as the process is managed externally.
   * It only stops listening to the process streams.
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    // Remove all listeners
    if (this.process.stdout) {
      this.process.stdout.removeAllListeners("data");
    }
    if (this.process.stderr) {
      this.process.stderr.removeAllListeners("data");
    }
    this.process.removeAllListeners("exit");
    this.process.removeAllListeners("error");

    // Invoke close callback
    if (this.onclose) {
      this.onclose();
    }
  }

  /**
   * Set the protocol version (optional callback)
   */
  setProtocolVersion?(version: string): void {
    // Store protocol version if needed for future use
    this.emit("protocolVersion", version);
  }

  /**
   * Handle data from process stdout
   *
   * Buffers incoming data and parses complete JSON-RPC messages (newline-delimited).
   */
  private handleStdoutData(data: Buffer): void {
    this.buffer += data.toString();

    // Process complete messages (newline-delimited)
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.substring(0, newlineIndex).trim();
      this.buffer = this.buffer.substring(newlineIndex + 1);

      if (line) {
        try {
          const message = JSON.parse(line) as JSONRPCMessage;
          if (this.onmessage) {
            this.onmessage(message);
          }
        } catch (error) {
          if (this.onerror) {
            this.onerror(
              new Error(
                `Failed to parse JSON-RPC message: ${(error as Error).message}`,
              ),
            );
          }
        }
      }
    }
  }

  /**
   * Handle data from process stderr (for debugging/logging)
   */
  private handleStderrData(data: Buffer): void {
    const message = data.toString();
    // Emit as non-fatal error for logging purposes
    if (this.onerror) {
      this.onerror(new Error(`Server stderr: ${message}`));
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    if (!this.isClosed) {
      this.isClosed = true;
      if (this.onclose) {
        this.onclose();
      }
      if (this.onerror) {
        this.onerror(
          new Error(`Process exited with code ${code}, signal ${signal}`),
        );
      }
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(error: Error): void {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}
