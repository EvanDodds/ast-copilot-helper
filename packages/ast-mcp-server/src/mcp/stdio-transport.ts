/**
 * Stdio Transport Implementation
 * Handles MCP communication via standard input/output streams
 */

import { JSONRPCResponse, JSONRPCNotification } from './protocol';
import { MCPTransport, BaseTransportStats } from './transport';

/**
 * Statistics for stdio transport
 */
class StdioTransportStats extends BaseTransportStats {
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
  }
}

/**
 * Stdio transport implementation for MCP communication
 * Handles message exchange via process stdin/stdout
 */
export class StdioTransport extends MCPTransport {
  private stats: StdioTransportStats;
  private inputBuffer: string = '';

  constructor() {
    super();
    this.stats = new StdioTransportStats();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stdio transport is already running');
    }

    try {
      // Set up stdin handling
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', this.handleInput.bind(this));
      process.stdin.on('end', this.handleEnd.bind(this));
      process.stdin.on('error', this.handleError.bind(this));

      // Set up stdout error handling
      process.stdout.on('error', this.handleError.bind(this));

      this.isRunning = true;
      this.stats.recordConnectionEvent();
      this.emit('connect');
    } catch (error) {
      this.stats.recordErrorEvent();
      throw new Error(`Failed to start stdio transport: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Remove all listeners
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('end');
      process.stdin.removeAllListeners('error');
      process.stdout.removeAllListeners('error');

      this.isRunning = false;
      this.inputBuffer = '';
      this.emit('close');
    } catch (error) {
      this.stats.recordErrorEvent();
      throw new Error(`Failed to stop stdio transport: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendMessage(message: JSONRPCResponse | JSONRPCNotification): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Stdio transport is not running');
    }

    try {
      const serialized = this.serializeMessage(message);
      await this.writeToStdout(serialized);
      this.stats.recordMessageSentEvent();
    } catch (error) {
      this.stats.recordErrorEvent();
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getType(): string {
    return 'stdio';
  }

  getStats(): BaseTransportStats {
    return this.stats;
  }

  /**
   * Handle incoming data from stdin
   */
  private async handleInput(data: string): Promise<void> {
    try {
      this.inputBuffer += data;
      
      // Process complete lines (messages end with \n)
      const lines = this.inputBuffer.split('\n');
      this.inputBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          await this.processLine(line);
        }
      }
    } catch (error) {
      this.stats.recordErrorEvent();
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
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
      this.emit('error', error instanceof Error ? error : new Error(`Failed to process line: ${String(error)}`));
    }
  }

  /**
   * Handle stdin end event
   */
  private handleEnd(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.emit('close');
    }
  }

  /**
   * Handle transport-level errors
   */
  private handleError(error: Error): void {
    this.stats.recordErrorEvent();
    this.emit('error', error);
  }

  /**
   * Write message to stdout
   */
  private async writeToStdout(data: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      process.stdout.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}