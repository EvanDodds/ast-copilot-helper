/**
 * Main MCP Server Implementation
 * Core server class with lifecycle management and request routing
 */

import { EventEmitter } from 'events';
import {
  JSONRPCRequest,
  JSONRPCResponse,
  MCPHandler,
  MCPServerCapabilities,
  MCPErrorCode,
  createErrorResponse,
  createSuccessResponse,
  isValidMCPRequest
} from './mcp/protocol';
import { MCPTransport } from './mcp/transport';
import { DatabaseReader, ServerStats } from './types';

/**
 * Server events interface
 */
export interface ServerEvents {
  'started': [];
  'stopped': [];
  'error': [Error];
  'request': [JSONRPCRequest];
  'response': [JSONRPCResponse];
}

/**
 * Server configuration interface
 */
export interface ServerConfig {
  serverName: string;
  serverVersion: string;
  protocolVersion: string;
  requestTimeout: number;
  maxConcurrentRequests: number;
  enableRequestLogging: boolean;
}

/**
 * Main MCP Server class
 * Manages server lifecycle, request routing, and handler coordination
 */
export class ASTMCPServer extends EventEmitter {
  private transport: MCPTransport;
  private database: DatabaseReader;
  private config: ServerConfig;
  private requestHandlers: Map<string, MCPHandler> = new Map();
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private stats: ServerStats;
  private activeRequests: Map<string | number, Promise<JSONRPCResponse>> = new Map();

  constructor(
    transport: MCPTransport,
    database: DatabaseReader,
    config: ServerConfig
  ) {
    super();
    this.transport = transport;
    this.database = database;
    this.config = config;
    this.stats = this.initializeStats();
    
    this.setupTransportHandlers();
    this.registerDefaultHandlers();
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('MCP Server is already running');
    }

    try {
      // Initialize database
      await this.database.initialize();
      
      // Start transport
      await this.transport.start();
      
      this.isRunning = true;
      this.stats.lastRequestAt = new Date();
      
      this.emit('started');
      
      if (this.config.enableRequestLogging) {
        console.log(`MCP Server started: ${this.config.serverName} v${this.config.serverVersion}`);
      }
    } catch (error) {
      this.stats.errorCount++;
      const serverError = new Error(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
      this.emit('error', serverError);
      throw serverError;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Wait for active requests to complete (with timeout)
      await this.waitForActiveRequests(5000);
      
      // Stop transport
      await this.transport.stop();
      
      // Close database
      await this.database.close();
      
      this.isRunning = false;
      this.isInitialized = false;
      this.activeRequests.clear();
      
      this.emit('stopped');
      
      if (this.config.enableRequestLogging) {
        console.log('MCP Server stopped');
      }
    } catch (error) {
      this.stats.errorCount++;
      const serverError = new Error(`Failed to stop MCP server: ${error instanceof Error ? error.message : String(error)}`);
      this.emit('error', serverError);
      throw serverError;
    }
  }

  /**
   * Check if server is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Check if server is initialized (has completed handshake)
   */
  isReady(): boolean {
    return this.isRunning && this.isInitialized;
  }

  /**
   * Get server statistics
   */
  getStats(): ServerStats {
    return {
      ...this.stats,
      uptime: this.isRunning ? Date.now() - (this.stats.lastRequestAt?.getTime() || Date.now()) : 0,
      activeConnections: this.transport.isActive() ? 1 : 0
    };
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): MCPServerCapabilities {
    return {
      tools: {
        listChanged: true
      },
      resources: {
        subscribe: false, // Not implemented in this version
        listChanged: true
      },
      prompts: {
        listChanged: false // Not used for AST server
      },
      logging: {
        level: 'info'
      }
    };
  }

  /**
   * Register a request handler
   */
  registerHandler(method: string, handler: MCPHandler): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Unregister a request handler
   */
  unregisterHandler(method: string): void {
    this.requestHandlers.delete(method);
  }

  /**
   * Setup transport event handlers
   */
  private setupTransportHandlers(): void {
    this.transport.onMessage(this.handleRequest.bind(this));
    this.transport.on('error', (error: Error) => {
      this.stats.errorCount++;
      this.emit('error', error);
    });
    this.transport.on('close', () => {
      if (this.isRunning) {
        this.stop().catch(error => {
          this.emit('error', error);
        });
      }
    });
  }

  /**
   * Register default MCP handlers
   */
  private registerDefaultHandlers(): void {
    // Initialize handler
    this.registerHandler('initialize', new InitializeHandler(this.config, this.getCapabilities()));
    
    // Ping handler
    this.registerHandler('ping', new PingHandler());
    
    // Note: Tool and resource handlers will be registered by subsequent subtasks
  }

  /**
   * Handle incoming MCP request
   */
  private async handleRequest(request: JSONRPCRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate request
      if (!isValidMCPRequest(request)) {
        const errorResponse = createErrorResponse(
          'unknown',
          {
            code: MCPErrorCode.INVALID_REQUEST,
            message: 'Invalid MCP request format'
          }
        );
        await this.sendResponse(errorResponse);
        return;
      }

      // Check if server is initialized (except for initialize method)
      if (!this.isInitialized && request.method !== 'initialize') {
        const errorResponse = createErrorResponse(
          request.id,
          {
            code: MCPErrorCode.INITIALIZATION_FAILED,
            message: 'Server not initialized. Send initialize request first.'
          }
        );
        await this.sendResponse(errorResponse);
        return;
      }

      // Check concurrent request limit
      if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
        const errorResponse = createErrorResponse(
          request.id,
          {
            code: MCPErrorCode.INTERNAL_ERROR,
            message: 'Server busy. Maximum concurrent requests exceeded.'
          }
        );
        await this.sendResponse(errorResponse);
        return;
      }

      this.emit('request', request);
      this.stats.requestCount++;

      // Process request with timeout
      const responsePromise = this.processRequest(request);
      this.activeRequests.set(request.id, responsePromise);

      const response = await this.withTimeout(responsePromise, this.config.requestTimeout);
      
      await this.sendResponse(response);
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateAverageResponseTime(processingTime);
      
    } catch (error) {
      this.stats.errorCount++;
      
      // Send error response if possible
      try {
        const errorResponse = createErrorResponse(
          request.id || 'unknown',
          {
            code: MCPErrorCode.INTERNAL_ERROR,
            message: error instanceof Error ? error.message : String(error)
          }
        );
        await this.sendResponse(errorResponse);
      } catch (sendError) {
        this.emit('error', sendError instanceof Error ? sendError : new Error(String(sendError)));
      }
      
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeRequests.delete(request.id);
      this.stats.lastRequestAt = new Date();
    }
  }

  /**
   * Process a request using appropriate handler
   */
  private async processRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const handler = this.requestHandlers.get(request.method);
    
    if (!handler) {
      return createErrorResponse(
        request.id,
        {
          code: MCPErrorCode.METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`
        }
      );
    }

    try {
      return await handler.handle(request);
    } catch (error) {
      return createErrorResponse(
        request.id,
        {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: `Handler error: ${error instanceof Error ? error.message : String(error)}`
        }
      );
    }
  }

  /**
   * Send response via transport
   */
  private async sendResponse(response: JSONRPCResponse): Promise<void> {
    await this.transport.sendMessage(response);
    this.emit('response', response);
  }

  /**
   * Execute promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      })
    ]);
  }

  /**
   * Wait for active requests to complete
   */
  private async waitForActiveRequests(timeoutMs: number): Promise<void> {
    if (this.activeRequests.size === 0) {
      return;
    }

    try {
      await this.withTimeout(
        Promise.all(Array.from(this.activeRequests.values())),
        timeoutMs
      );
    } catch (error) {
      // Log timeout but don't throw - we still want to shut down
      console.warn('Some requests did not complete during shutdown');
    }
  }

  /**
   * Initialize server statistics
   */
  private initializeStats(): ServerStats {
    return {
      uptime: 0,
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      activeConnections: 0
    };
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newTime: number): void {
    const { requestCount, averageResponseTime } = this.stats;
    this.stats.averageResponseTime = 
      (averageResponseTime * (requestCount - 1) + newTime) / requestCount;
  }

  /**
   * Mark server as initialized after successful handshake
   */
  markInitialized(): void {
    this.isInitialized = true;
  }
}

/**
 * Initialize request handler
 */
class InitializeHandler implements MCPHandler {
  constructor(
    private config: ServerConfig,
    private capabilities: MCPServerCapabilities
  ) {}

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { protocolVersion, clientInfo } = request.params || {};

    if (!protocolVersion || !clientInfo?.name) {
      return createErrorResponse(
        request.id,
        {
          code: MCPErrorCode.INVALID_PARAMS,
          message: 'Missing required parameters: protocolVersion and clientInfo.name'
        }
      );
    }

    if (protocolVersion !== this.config.protocolVersion) {
      return createErrorResponse(
        request.id,
        {
          code: MCPErrorCode.INITIALIZATION_FAILED,
          message: `Unsupported protocol version: ${protocolVersion}. Expected: ${this.config.protocolVersion}`
        }
      );
    }

    return createSuccessResponse(request.id, {
      protocolVersion: this.config.protocolVersion,
      capabilities: this.capabilities,
      serverInfo: {
        name: this.config.serverName,
        version: this.config.serverVersion
      }
    });
  }
}

/**
 * Ping request handler
 */
class PingHandler implements MCPHandler {
  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return createSuccessResponse(request.id, {});
  }
}