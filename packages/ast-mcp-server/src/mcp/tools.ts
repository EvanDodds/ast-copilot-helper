/**
 * MCP Tool Handlers for AST Querying and Node Operations
 * 
 * Implements MCP tool handlers that provide comprehensive AST querying
 * capabilities including intent-based search, node operations, and 
 * code analysis functionality.
 */

import { BaseHandler } from './handlers.js';
import { 
  JSONRPCRequest, 
  JSONRPCResponse, 
  MCPErrorCode,
  MCPToolResult,
  MCPToolDefinition
} from './protocol.js';

import type { 
  DatabaseReader,
  QueryOptions
} from '../types.js';

/**
 * Intent-based AST query handler
 * Performs semantic search across the AST database
 */
export class IntentQueryHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['intent']);
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

      // Apply parameter defaults
      const processedParams = this.applyDefaults(params, {
        maxResults: 10,
        includeChildren: false,
        sortBy: 'relevance'
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        intent: 'string',
        maxResults: 'number',
        includeChildren: 'boolean',
        sortBy: 'string'
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

      // Validate numeric ranges
      const rangeError = this.validateNumericRanges(processedParams, {
        maxResults: { min: 1, max: 100 }
      });
      if (rangeError) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: rangeError
          }
        };
      }

      // Execute intent-based query
      const queryOptions: QueryOptions = {
        maxResults: processedParams.maxResults,
        includeContext: processedParams.includeChildren
      };

      const matches = await this.db.queryByIntent(processedParams.intent, queryOptions);

      // Format results for MCP
      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            intent: processedParams.intent,
            matchCount: matches.length,
            matches: matches.map(match => ({
              nodeId: match.nodeId,
              type: match.nodeType,
              signature: match.signature,
              summary: match.summary,
              filePath: match.filePath,
              startLine: match.startLine,
              endLine: match.endLine,
              relevanceScore: match.score,
              matchReason: match.matchReason,
              snippet: match.sourceSnippet?.substring(0, 200) + (match.sourceSnippet && match.sourceSnippet.length > 200 ? '...' : '')
            }))
          }, null, 2)
        }]
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `Intent query failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "query_ast_context",
      description: "Search for relevant AST nodes by intent/query text",
      inputSchema: {
        type: "object",
        properties: {
          intent: { 
            type: "string", 
            description: "Query describing desired functionality" 
          },
          maxResults: { 
            type: "number", 
            default: 5, 
            maximum: 100 
          },
          minScore: { 
            type: "number", 
            default: 0.0, 
            minimum: 0.0, 
            maximum: 1.0 
          },
          includeContext: { 
            type: "boolean", 
            default: true 
          }
        },
        required: ["intent"]
      }
    };
  }
}

/**
 * Node lookup handler
 * Retrieves specific AST nodes by ID
 */
export class NodeLookupHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['nodeId']);
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

      // Apply defaults
      const processedParams = this.applyDefaults(params, {
        includeChildren: false,
        includeParent: false,
        includeText: true
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        nodeId: 'string',
        includeChildren: 'boolean',
        includeParent: 'boolean',
        includeText: 'boolean'
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

      // Retrieve the node
      const node = await this.db.getNodeById(processedParams.nodeId);
      if (!node) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.RESOURCE_NOT_FOUND,
            message: `Node not found: ${processedParams.nodeId}`
          }
        };
      }

      // Build response data
      const responseData: any = {
        node: {
          nodeId: node.nodeId,
          type: node.nodeType,
          signature: node.signature,
          summary: node.summary,
          filePath: node.filePath,
          startLine: node.startLine,
          endLine: node.endLine,
          sourceSnippet: processedParams.includeText ? node.sourceSnippet : undefined,
          metadata: node.metadata
        }
      };

      // Include children if requested
      if (processedParams.includeChildren) {
        const children = await this.db.getChildNodes(processedParams.nodeId);
        responseData.children = children.map(child => ({
          nodeId: child.nodeId,
          type: child.nodeType,
          signature: child.signature,
          summary: child.summary,
          startLine: child.startLine,
          endLine: child.endLine
        }));
      }

      // Include parent if requested
      if (processedParams.includeParent && node.parentId) {
        const parent = await this.db.getNodeById(node.parentId);
        if (parent) {
          responseData.parent = {
            nodeId: parent.nodeId,
            type: parent.nodeType,
            signature: parent.signature,
            summary: parent.summary,
            startLine: parent.startLine,
            endLine: parent.endLine
          };
        }
      }

      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify(responseData, null, 2)
        }]
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `Node lookup failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "get_node_details",
      description: "Get detailed information about a specific AST node",
      inputSchema: {
        type: "object",
        properties: {
          nodeId: { 
            type: "string", 
            description: "AST node identifier" 
          },
          includeChildren: { 
            type: "boolean", 
            default: false 
          },
          includeSource: { 
            type: "boolean", 
            default: true 
          }
        },
        required: ["nodeId"]
      }
    };
  }
}

/**
 * File-based AST query handler
 * Retrieves AST nodes for specific files
 */
export class FileQueryHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['filePath']);
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

      // Apply defaults
      const processedParams = this.applyDefaults(params, {
        nodeTypes: [],
        maxDepth: -1,
        includeText: false
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        filePath: 'string',
        maxDepth: 'number',
        includeText: 'boolean'
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

      // Retrieve file nodes
      const nodes = await this.db.getFileNodes(processedParams.filePath);

      // Filter by node types if specified
      let filteredNodes = nodes;
      if (processedParams.nodeTypes && processedParams.nodeTypes.length > 0) {
        filteredNodes = nodes.filter(node => processedParams.nodeTypes.includes(node.nodeType));
      }

      // Apply depth filtering if specified (Note: depth not available in current schema)
      // This filtering is left as a placeholder for future enhancement

      // Format results
      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            filePath: processedParams.filePath,
            totalNodes: nodes.length,
            filteredNodes: filteredNodes.length,
            nodes: filteredNodes.map(node => ({
              nodeId: node.nodeId,
              type: node.nodeType,
              signature: node.signature,
              summary: node.summary,
              startLine: node.startLine,
              endLine: node.endLine,
              parentId: node.parentId,
              sourceSnippet: processedParams.includeText ? node.sourceSnippet : undefined
            }))
          }, null, 2)
        }]
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `File query failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "ast_file_query",
      description: "Retrieve all AST nodes for a specific file, with optional filtering by node type and depth.",
      inputSchema: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Path to the source file (relative to workspace root)"
          },
          nodeTypes: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of node types to filter by (e.g., ['FunctionDeclaration', 'ClassDeclaration'])",
            default: []
          },
          maxDepth: {
            type: "number",
            description: "Maximum depth level of nodes to include (-1 for no limit, default: -1)",
            minimum: -1,
            default: -1
          },
          includeText: {
            type: "boolean",
            description: "Include the full text content of nodes (default: false)",
            default: false
          }
        },
        required: ["filePath"]
      }
    };
  }
}

/**
 * Text-based search handler
 * Performs text search across AST nodes
 */
export class TextSearchHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['query']);
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

      // Apply defaults
      const processedParams = this.applyDefaults(params, {
        maxResults: 20,
        caseSensitive: false,
        includeContext: true,
        filePattern: null
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        query: 'string',
        maxResults: 'number',
        caseSensitive: 'boolean',
        includeContext: 'boolean'
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

      // Validate numeric ranges
      const rangeError = this.validateNumericRanges(processedParams, {
        maxResults: { min: 1, max: 100 }
      });
      if (rangeError) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: rangeError
          }
        };
      }

      // Execute text search
      const queryOptions: QueryOptions = {
        maxResults: processedParams.maxResults,
        filePattern: processedParams.filePattern
      };

      const matches = await this.db.searchNodes(processedParams.query, queryOptions);

      // Format results
      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            query: processedParams.query,
            matchCount: matches.length,
            matches: matches.map(match => ({
              nodeId: match.nodeId,
              type: match.nodeType,
              signature: match.signature,
              summary: match.summary,
              filePath: match.filePath,
              startLine: match.startLine,
              endLine: match.endLine,
              score: match.score,
              matchReason: match.matchReason,
              matchedText: match.sourceSnippet?.substring(0, 300) + (match.sourceSnippet && match.sourceSnippet.length > 300 ? '...' : '')
            }))
          }, null, 2)
        }]
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `Text search failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "ast_text_search",
      description: "Search for text patterns across all AST nodes, with support for case sensitivity and file filtering.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text pattern to search for in AST node content"
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (1-100, default: 20)",
            minimum: 1,
            maximum: 100,
            default: 20
          },
          caseSensitive: {
            type: "boolean",
            description: "Whether the search should be case sensitive (default: false)",
            default: false
          },
          includeContext: {
            type: "boolean",
            description: "Include surrounding context in results (default: true)",
            default: true
          },
          filePattern: {
            type: "string",
            description: "Optional glob pattern to filter files (e.g., '**/*.ts', 'src/**')",
            default: null
          }
        },
        required: ["query"]
      }
    };
  }
}

/**
 * Index status handler
 * Provides information about the AST database index status
 */
export class IndexStatusHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      // Get index statistics
      const stats = await this.db.getIndexStats();
      const isReady = await this.db.isIndexReady();

      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            ready: isReady,
            statistics: {
              nodeCount: stats.nodeCount,
              fileCount: stats.fileCount,
              lastUpdated: stats.lastUpdated.toISOString()
            },
            status: isReady ? 'ready' : 'not_ready'
          }, null, 2)
        }]
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `Index status check failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "ast_index_status",
      description: "Get information about the AST database index status, including node count, file count, and last update time.",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    };
  }
}

/**
 * Recent changes handler
 * Retrieves recently modified AST nodes
 */
export class RecentChangesHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Apply defaults
      const processedParams = this.applyDefaults(params || {}, {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        maxResults: 50
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        since: 'string',
        maxResults: 'number'
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

      // Validate numeric ranges
      const rangeError = this.validateNumericRanges(processedParams, {
        maxResults: { min: 1, max: 200 }
      });
      if (rangeError) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: rangeError
          }
        };
      }

      // Execute query for recent changes
      const queryOptions: QueryOptions = {
        maxResults: processedParams.maxResults
      };

      const recentNodes = await this.db.getRecentChanges(processedParams.since, queryOptions);

      // Format results
      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            since: processedParams.since,
            changeCount: recentNodes.length,
            changes: recentNodes.map(node => ({
              nodeId: node.nodeId,
              type: node.nodeType,
              signature: node.signature,
              summary: node.summary,
              filePath: node.filePath,
              startLine: node.startLine,
              endLine: node.endLine,
              lastModified: node.updatedAt?.toISOString(),
              changeType: node.metadata?.changeType || 'modified'
            }))
          }, null, 2)
        }]
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.TOOL_EXECUTION_ERROR,
          message: `Recent changes query failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "list_recent_changes",
      description: "Get recently modified AST nodes",
      inputSchema: {
        type: "object",
        properties: {
          since: { 
            type: "string", 
            description: "ISO timestamp or relative time (1h, 1d)" 
          },
          maxResults: { 
            type: "number", 
            default: 20, 
            maximum: 100 
          },
          filePattern: { 
            type: "string", 
            description: "Optional file pattern filter" 
          }
        },
        required: []
      }
    };
  }
}

/**
 * Tool handler registry and factory
 */
export class ToolHandlerRegistry {
  private handlers: Map<string, BaseHandler> = new Map();
  
  constructor(db: DatabaseReader) {
    // Register all tool handlers with correct MCP-compliant names
    this.handlers.set('query_ast_context', new IntentQueryHandler(db));
    this.handlers.set('get_node_details', new NodeLookupHandler(db));
    this.handlers.set('ast_file_query', new FileQueryHandler(db));
    this.handlers.set('ast_text_search', new TextSearchHandler(db));
    this.handlers.set('ast_index_status', new IndexStatusHandler(db));
    this.handlers.set('list_recent_changes', new RecentChangesHandler(db));
  }

  getHandler(toolName: string): BaseHandler | null {
    return this.handlers.get(toolName) || null;
  }

  getAllToolDefinitions(): MCPToolDefinition[] {
    return [
      IntentQueryHandler.getDefinition(),
      NodeLookupHandler.getDefinition(),
      FileQueryHandler.getDefinition(),
      TextSearchHandler.getDefinition(),
      IndexStatusHandler.getDefinition(),
      RecentChangesHandler.getDefinition()
    ];
  }

  getToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}