/**
 * MCP Resource Handlers for AST Data Access
 * 
 * Implements MCP resource handlers that provide access to AST data
 * via URI-based resource requests as specified in MCP 1.0 protocol.
 */

import { BaseHandler } from './handlers.js';
import type { 
  JSONRPCRequest, 
  JSONRPCResponse,
  MCPResourceDefinition
} from './protocol.js';
import { 
  MCPErrorCode
} from './protocol.js';

import type { DatabaseReader } from '../types.js';

/**
 * MCP Resources provided by the AST server
 */
export const MCP_RESOURCES: MCPResourceDefinition[] = [
  {
    uri: "ast://nodes/{nodeId}",
    name: "AST Node",
    description: "Individual AST node data with annotations",
    mimeType: "application/json"
  },
  {
    uri: "ast://files/{filePath}",
    name: "File AST Nodes", 
    description: "All AST nodes for a specific file",
    mimeType: "application/json"
  },
  {
    uri: "ast://search/{query}",
    name: "Search Results",
    description: "AST nodes matching semantic search query", 
    mimeType: "application/json"
  },
  {
    uri: "ast://stats/server",
    name: "Server Statistics",
    description: "Server performance metrics and runtime statistics",
    mimeType: "application/json"
  },
  {
    uri: "ast://stats/index", 
    name: "Index Statistics",
    description: "Database index status and statistics",
    mimeType: "application/json"
  }
];

/**
 * Parsed resource URI components
 */
interface ParsedResourceURI {
  type: 'nodes' | 'files' | 'search' | 'stats';
  identifier: string;
}

/**
 * Resources list handler
 * Returns the list of available MCP resources
 */
export class ResourcesListHandler extends BaseHandler {
  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          resources: MCP_RESOURCES
        }
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }
}

/**
 * Resources read handler
 * Reads specific resource content based on URI
 */
export class ResourcesReadHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['uri']);
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

      const { uri } = params;
      const parsed = this.parseResourceURI(uri);
      let content: any;
      
      switch (parsed.type) {
        case 'nodes':
          content = await this.handleNodesResource(parsed.identifier);
          break;
        case 'files':
          content = await this.handleFilesResource(parsed.identifier);
          break;
        case 'search':
          content = await this.handleSearchResource(parsed.identifier);
          break;
        case 'stats':
          content = await this.handleStatsResource(parsed.identifier);
          break;
        default:
          throw new Error(`Unsupported resource type: ${parsed.type}`);
      }
      
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(content, null, 2)
          }]
        }
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: `Failed to read resource: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }

  /**
   * Parse resource URI into components
   */
  private parseResourceURI(uri: string): ParsedResourceURI {
    const match = uri.match(/^ast:\/\/(\w+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI format: ${uri}`);
    }
    
    const [, type, identifier] = match;
    
    if (!type || !identifier) {
      throw new Error(`Malformed resource URI: ${uri}`);
    }
    
    if (!['nodes', 'files', 'search', 'stats'].includes(type)) {
      throw new Error(`Unknown resource type: ${type}`);
    }
    
    return {
      type: type as 'nodes' | 'files' | 'search' | 'stats',
      identifier: decodeURIComponent(identifier)
    };
  }

  /**
   * Handle ast://nodes/{nodeId} resource requests
   */
  private async handleNodesResource(nodeId: string): Promise<any> {
    const node = await this.db.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    return node;
  }

  /**
   * Handle ast://files/{filePath} resource requests
   */
  private async handleFilesResource(filePath: string): Promise<any> {
    const nodes = await this.db.getFileNodes(filePath);
    return {
      filePath,
      nodes,
      totalCount: nodes.length
    };
  }

  /**
   * Handle ast://search/{query} resource requests
   */
  private async handleSearchResource(query: string): Promise<any> {
    const results = await this.db.searchNodes(query, {});
    return {
      query,
      matches: results,
      totalCount: results.length
    };
  }

  /**
   * Handle ast://stats/{type} resource requests
   */
  private async handleStatsResource(statsType: string): Promise<any> {
    switch (statsType) {
      case 'server': {
        return {
          type: 'server',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          processInfo: {
            pid: process.pid,
            version: process.version,
            arch: process.arch,
            platform: process.platform
          },
          timestamp: new Date().toISOString()
        };
      }

      case 'index': {
        const indexStats = await this.db.getIndexStats();
        const isReady = await this.db.isIndexReady();
        return {
          type: 'index',
          ready: isReady,
          nodeCount: indexStats.nodeCount,
          fileCount: indexStats.fileCount,
          lastUpdated: indexStats.lastUpdated.toISOString(),
          timestamp: new Date().toISOString()
        };
      }

      default: {
        throw new Error(`Unknown stats type: ${statsType}`);
      }
    }
  }
}

/**
 * Resource handler factory
 */
export class ResourceHandlerFactory {
  createResourcesListHandler(): ResourcesListHandler {
    return new ResourcesListHandler();
  }

  createResourcesReadHandler(db: DatabaseReader): ResourcesReadHandler {
    return new ResourcesReadHandler(db);
  }
}