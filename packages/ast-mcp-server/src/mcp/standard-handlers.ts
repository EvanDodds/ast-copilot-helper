/**
 * MCP Standard Method Handlers
 * 
 * Implements core MCP protocol handlers for initialize, ping, 
 * tools/list, tools/call, and other standard methods
 */

import { BaseHandler } from './handlers.js';
import type { 
  JSONRPCRequest, 
  JSONRPCResponse,
  MCPServerCapabilities,
  MCPToolDefinition
} from './protocol.js';
import { 
  MCPErrorCode
} from './protocol.js';

import { Issue17ToolRegistry } from './issue17-tools.js';
import { ResourceHandlerFactory } from './resources.js';
import type { DatabaseReader } from '../types.js';

/**
 * Common interface for tool registries
 */
interface IToolRegistry {
  getHandler(toolName: string): BaseHandler | null;
  getAllToolDefinitions(): MCPToolDefinition[];
  getToolNames(): string[];
}

/**
 * MCP Initialize handler
 */
export class InitializeHandler extends BaseHandler {
  constructor(
    private config: { serverName: string; serverVersion: string; protocolVersion: string },
    private capabilities: MCPServerCapabilities
  ) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate initialization parameters
      if (!params?.protocolVersion) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: "Missing protocolVersion in initialization"
          }
        };
      }

      // Check protocol version compatibility
      const clientVersion = params.protocolVersion;
      if (clientVersion !== this.config.protocolVersion) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INITIALIZATION_FAILED,
            message: `Protocol version mismatch. Server: ${this.config.protocolVersion}, Client: ${clientVersion}`
          }
        };
      }

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: this.config.protocolVersion,
          capabilities: this.capabilities,
          serverInfo: {
            name: this.config.serverName,
            version: this.config.serverVersion
          }
        }
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.INITIALIZATION_FAILED,
          message: `Initialization failed: ${(error as Error).message}`
        }
      };
    }
  }
}

/**
 * MCP Ping handler
 */
export class PingHandler extends BaseHandler {
  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {}
    };
  }
}

/**
 * MCP Tools List handler
 */
export class ToolsListHandler extends BaseHandler {
  constructor(private toolRegistry: IToolRegistry) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const toolDefinitions = this.toolRegistry.getAllToolDefinitions();

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: toolDefinitions
        }
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: `Failed to list tools: ${(error as Error).message}`
        }
      };
    }
  }
}

/**
 * MCP Tools Call handler
 */
export class ToolsCallHandler extends BaseHandler {
  constructor(private toolRegistry: IToolRegistry) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['name', 'arguments']);
      if (validationError) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: validationError
          }
        };
      }

      // Validate parameter types
      const typeError = this.validateParamTypes(params, {
        name: 'string',
        arguments: 'object'
      });
      if (typeError) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: typeError
          }
        };
      }

      // Get the tool handler
      const toolHandler = this.toolRegistry.getHandler(params.name);
      if (!toolHandler) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.METHOD_NOT_FOUND,
            message: `Tool not found: ${params.name}`
          }
        };
      }

      // Create a request for the tool handler
      const toolRequest: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: request.id,
        method: params.name,
        params: params.arguments
      };

      // Execute the tool
      const toolResponse = await toolHandler.handle(toolRequest);
      
      // Return the tool result or error
      return toolResponse;

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `Tool execution failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }
}

/**
 * Handler factory for creating and managing standard MCP handlers
 */
export class StandardHandlerFactory {
  private toolRegistry: IToolRegistry;
  private resourceFactory: ResourceHandlerFactory;

  constructor(database: DatabaseReader) {
    this.toolRegistry = new Issue17ToolRegistry(database);
    this.resourceFactory = new ResourceHandlerFactory();
  }

  createInitializeHandler(
    config: { serverName: string; serverVersion: string; protocolVersion: string },
    capabilities: MCPServerCapabilities
  ): InitializeHandler {
    return new InitializeHandler(config, capabilities);
  }

  createPingHandler(): PingHandler {
    return new PingHandler();
  }

  createToolsListHandler(): ToolsListHandler {
    return new ToolsListHandler(this.toolRegistry);
  }

  createToolsCallHandler(): ToolsCallHandler {
    return new ToolsCallHandler(this.toolRegistry);
  }

  createResourcesListHandler(): BaseHandler {
    return this.resourceFactory.createResourcesListHandler();
  }

  createResourcesReadHandler(database: DatabaseReader): BaseHandler {
    return this.resourceFactory.createResourcesReadHandler(database);
  }

  getToolRegistry(): IToolRegistry {
    return this.toolRegistry;
  }

  getAllToolDefinitions(): MCPToolDefinition[] {
    return this.toolRegistry.getAllToolDefinitions();
  }
}