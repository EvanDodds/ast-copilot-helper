/**
 * MCP Tool Handlers for Issue #17 Requirements
 * 
 * Implements the specific MCP tools required by Issue #17:
 * - search-similar: Search for code annotations similar to provided text using semantic similarity
 * - search-signature: Search for code annotations by exact or partial function/method signature
 * - get-annotation: Get detailed information about a specific code annotation by ID
 * - list-files: List all files that have been parsed and indexed
 * - get-file-stats: Get statistics about parsed files and annotations
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
 * Search Similar Handler
 * Searches for code annotations similar to provided text using semantic similarity
 */
export class SearchSimilarHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['text']);
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
        minScore: 0.3
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        text: 'string',
        maxResults: 'number',
        minScore: 'number'
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
        maxResults: { min: 1, max: 100 },
        minScore: { min: 0.0, max: 1.0 }
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

      // Execute semantic similarity search using intent-based query
      const queryOptions: QueryOptions = {
        maxResults: processedParams.maxResults,
        minScore: processedParams.minScore
      };

      const matches = await this.db.queryByIntent(processedParams.text, queryOptions);

      // Format results for MCP
      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            searchText: processedParams.text,
            totalMatches: matches.length,
            annotations: matches.map(match => ({
              id: match.nodeId,
              signature: match.signature,
              summary: match.summary,
              filePath: match.filePath,
              startLine: match.startLine,
              endLine: match.endLine,
              nodeType: match.nodeType,
              similarityScore: match.score,
              matchReason: match.matchReason,
              sourceSnippet: match.sourceSnippet?.substring(0, 200) + 
                           (match.sourceSnippet && match.sourceSnippet.length > 200 ? '...' : '')
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
          message: `Similar annotation search failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "search-similar",
      description: "Search for code annotations similar to provided text using semantic similarity",
      inputSchema: {
        type: "object",
        properties: {
          text: { 
            type: "string", 
            description: "Text to find similar annotations for" 
          },
          maxResults: { 
            type: "number", 
            description: "Maximum number of results to return (default: 10, max: 100)",
            default: 10, 
            minimum: 1,
            maximum: 100 
          },
          minScore: { 
            type: "number", 
            description: "Minimum similarity score threshold (default: 0.3, range: 0.0-1.0)",
            default: 0.3, 
            minimum: 0.0, 
            maximum: 1.0 
          }
        },
        required: ["text"]
      }
    };
  }
}

/**
 * Search Signature Handler
 * Searches for code annotations by exact or partial function/method signature
 */
export class SearchSignatureHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['signature']);
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
        exact: false,
        maxResults: 20
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        signature: 'string',
        exact: 'boolean',
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

      // Execute signature search using text search
      const queryOptions: QueryOptions = {
        maxResults: processedParams.maxResults
      };

      const matches = await this.db.searchNodes(processedParams.signature, queryOptions);

      // Filter by signature matching logic
      const signatureMatches = matches.filter(match => {
        if (processedParams.exact) {
          return match.signature === processedParams.signature;
        } else {
          return match.signature.toLowerCase().includes(processedParams.signature.toLowerCase());
        }
      });

      // Format results for MCP
      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            searchSignature: processedParams.signature,
            exactMatch: processedParams.exact,
            totalMatches: signatureMatches.length,
            annotations: signatureMatches.map(match => ({
              id: match.nodeId,
              signature: match.signature,
              summary: match.summary,
              filePath: match.filePath,
              startLine: match.startLine,
              endLine: match.endLine,
              nodeType: match.nodeType,
              matchScore: match.score,
              sourceSnippet: match.sourceSnippet?.substring(0, 200) + 
                           (match.sourceSnippet && match.sourceSnippet.length > 200 ? '...' : '')
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
          message: `Signature search failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "search-signature",
      description: "Search for code annotations by exact or partial function/method signature",
      inputSchema: {
        type: "object",
        properties: {
          signature: { 
            type: "string", 
            description: "Function or method signature to search for" 
          },
          exact: { 
            type: "boolean", 
            description: "Whether to perform exact signature matching (default: false)",
            default: false 
          },
          maxResults: { 
            type: "number", 
            description: "Maximum number of results to return (default: 20, max: 100)",
            default: 20, 
            minimum: 1,
            maximum: 100 
          }
        },
        required: ["signature"]
      }
    };
  }
}

/**
 * Get Annotation Handler
 * Gets detailed information about a specific code annotation by ID
 */
export class GetAnnotationHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Validate required parameters
      const validationError = this.validateParams(params, ['id']);
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
        includeChildren: false,
        includeParent: false,
        includeSource: true
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        id: 'string',
        includeChildren: 'boolean',
        includeParent: 'boolean',
        includeSource: 'boolean'
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

      // Retrieve the annotation (node) by ID
      const node = await this.db.getNodeById(processedParams.id);
      if (!node) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.RESOURCE_NOT_FOUND,
            message: `Annotation not found: ${processedParams.id}`
          }
        };
      }

      // Build response data
      const annotation: any = {
        id: node.nodeId,
        signature: node.signature,
        summary: node.summary,
        filePath: node.filePath,
        startLine: node.startLine,
        endLine: node.endLine,
        nodeType: node.nodeType,
        metadata: node.metadata,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString()
      };

      // Include source code if requested
      if (processedParams.includeSource) {
        annotation.sourceCode = node.sourceSnippet;
      }

      // Include children if requested
      if (processedParams.includeChildren) {
        const children = await this.db.getChildNodes(processedParams.id);
        annotation.children = children.map(child => ({
          id: child.nodeId,
          signature: child.signature,
          summary: child.summary,
          nodeType: child.nodeType,
          startLine: child.startLine,
          endLine: child.endLine
        }));
      }

      // Include parent if requested
      if (processedParams.includeParent && node.parentId) {
        const parent = await this.db.getNodeById(node.parentId);
        if (parent) {
          annotation.parent = {
            id: parent.nodeId,
            signature: parent.signature,
            summary: parent.summary,
            nodeType: parent.nodeType,
            startLine: parent.startLine,
            endLine: parent.endLine
          };
        }
      }

      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            annotation
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
          message: `Annotation retrieval failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "get-annotation",
      description: "Get detailed information about a specific code annotation by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { 
            type: "string", 
            description: "Unique identifier of the code annotation" 
          },
          includeChildren: { 
            type: "boolean", 
            description: "Include child annotations (default: false)",
            default: false 
          },
          includeParent: { 
            type: "boolean", 
            description: "Include parent annotation information (default: false)",
            default: false 
          },
          includeSource: { 
            type: "boolean", 
            description: "Include full source code (default: true)",
            default: true 
          }
        },
        required: ["id"]
      }
    };
  }
}

/**
 * List Files Handler
 * Lists all files that have been parsed and indexed
 */
export class ListFilesHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Apply parameter defaults
      const processedParams = this.applyDefaults(params || {}, {
        pattern: null,
        includeStats: true
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        includeStats: 'boolean'
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

      // Get index statistics to determine available files
      const indexStats = await this.db.getIndexStats();
      
      // Since we don't have a direct "list files" method in the DatabaseReader interface,
      // we need to work with what's available. We can use a broad query to get nodes
      // and then extract unique file paths from them.
      const queryOptions: QueryOptions = {
        maxResults: 10000 // Large number to get comprehensive file list
      };

      // Use a broad query (empty string or wildcard) to get nodes from all files
      const allMatches = await this.db.searchNodes('', queryOptions);
      
      // Extract unique file paths
      const fileMap = new Map<string, any>();
      
      allMatches.forEach(match => {
        if (!fileMap.has(match.filePath)) {
          fileMap.set(match.filePath, {
            filePath: match.filePath,
            nodeCount: 0,
            firstSeen: match.createdAt,
            lastModified: match.updatedAt
          });
        }
        
        const fileInfo = fileMap.get(match.filePath)!;
        fileInfo.nodeCount++;
        
        // Update timestamps
        if (match.createdAt < fileInfo.firstSeen) {
          fileInfo.firstSeen = match.createdAt;
        }
        if (match.updatedAt > fileInfo.lastModified) {
          fileInfo.lastModified = match.updatedAt;
        }
      });

      // Convert to array and optionally filter by pattern
      let files = Array.from(fileMap.values());
      
      if (processedParams.pattern) {
        // Simple pattern matching (could be enhanced with glob patterns)
        const pattern = processedParams.pattern.toLowerCase();
        files = files.filter(file => 
          file.filePath.toLowerCase().includes(pattern)
        );
      }

      // Sort by file path
      files.sort((a, b) => a.filePath.localeCompare(b.filePath));

      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalFiles: files.length,
            indexStats: processedParams.includeStats ? {
              totalNodes: indexStats.nodeCount,
              totalFiles: indexStats.fileCount,
              lastUpdated: indexStats.lastUpdated.toISOString()
            } : undefined,
            files: files.map(file => ({
              filePath: file.filePath,
              nodeCount: file.nodeCount,
              firstSeen: file.firstSeen.toISOString(),
              lastModified: file.lastModified.toISOString()
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
          message: `File listing failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "list-files",
      description: "List all files that have been parsed and indexed",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { 
            type: "string", 
            description: "Optional pattern to filter files (substring match)" 
          },
          includeStats: { 
            type: "boolean", 
            description: "Include overall index statistics (default: true)",
            default: true 
          }
        },
        required: []
      }
    };
  }
}

/**
 * Get File Stats Handler
 * Gets statistics about parsed files and annotations
 */
export class GetFileStatsHandler extends BaseHandler {
  constructor(private db: DatabaseReader) {
    super();
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const { params } = request;
      
      // Apply parameter defaults
      const processedParams = this.applyDefaults(params || {}, {
        filePath: null,
        includeNodeTypes: true,
        includeTimestamps: true
      });

      // Validate parameter types
      const typeError = this.validateParamTypes(processedParams, {
        includeNodeTypes: 'boolean',
        includeTimestamps: 'boolean'
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

      let stats: any = {};

      if (processedParams.filePath) {
        // Get statistics for a specific file
        const fileNodes = await this.db.getFileNodes(processedParams.filePath);
        
        if (fileNodes.length === 0) {
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: MCPErrorCode.RESOURCE_NOT_FOUND,
              message: `No annotations found for file: ${processedParams.filePath}`
            }
          };
        }

        stats = {
          filePath: processedParams.filePath,
          totalAnnotations: fileNodes.length,
          annotationsByType: {},
          firstSeen: fileNodes[0]?.createdAt || new Date(),
          lastModified: fileNodes[0]?.updatedAt || new Date()
        };

        // Calculate statistics
        fileNodes.forEach(node => {
          // Count by node type
          if (processedParams.includeNodeTypes) {
            stats.annotationsByType[node.nodeType] = 
              (stats.annotationsByType[node.nodeType] || 0) + 1;
          }

          // Update timestamps
          if (processedParams.includeTimestamps) {
            if (node.createdAt < stats.firstSeen) {
              stats.firstSeen = node.createdAt;
            }
            if (node.updatedAt > stats.lastModified) {
              stats.lastModified = node.updatedAt;
            }
          }
        });

        // Format timestamps
        if (processedParams.includeTimestamps) {
          stats.firstSeen = stats.firstSeen.toISOString();
          stats.lastModified = stats.lastModified.toISOString();
        }

      } else {
        // Get overall statistics
        const indexStats = await this.db.getIndexStats();
        
        stats = {
          overall: true,
          totalFiles: indexStats.fileCount,
          totalAnnotations: indexStats.nodeCount,
          lastUpdated: indexStats.lastUpdated.toISOString()
        };

        // Get detailed breakdown by getting a sample of all nodes
        if (processedParams.includeNodeTypes) {
          const queryOptions: QueryOptions = {
            maxResults: 10000 // Large sample
          };
          
          const allMatches = await this.db.searchNodes('', queryOptions);
          
          stats.annotationsByType = {};
          stats.fileBreakdown = {};
          
          allMatches.forEach(match => {
            // Count by node type
            stats.annotationsByType[match.nodeType] = 
              (stats.annotationsByType[match.nodeType] || 0) + 1;
              
            // Count by file
            stats.fileBreakdown[match.filePath] = 
              (stats.fileBreakdown[match.filePath] || 0) + 1;
          });
        }
      }

      const result: MCPToolResult = {
        content: [{
          type: "text",
          text: JSON.stringify(stats, null, 2)
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
          message: `File statistics retrieval failed: ${(error as Error).message}`,
          data: { error: error instanceof Error ? error.stack : String(error) }
        }
      };
    }
  }

  static getDefinition(): MCPToolDefinition {
    return {
      name: "get-file-stats",
      description: "Get statistics about parsed files and annotations",
      inputSchema: {
        type: "object",
        properties: {
          filePath: { 
            type: "string", 
            description: "Optional specific file path to get statistics for (if omitted, returns overall stats)" 
          },
          includeNodeTypes: { 
            type: "boolean", 
            description: "Include breakdown by annotation/node types (default: true)",
            default: true 
          },
          includeTimestamps: { 
            type: "boolean", 
            description: "Include creation and modification timestamps (default: true)",
            default: true 
          }
        },
        required: []
      }
    };
  }
}

/**
 * Tool handler registry for Issue #17 required tools
 */
export class Issue17ToolRegistry {
  private handlers: Map<string, BaseHandler> = new Map();
  
  constructor(db: DatabaseReader) {
    // Register the 5 specific tools required by Issue #17
    this.handlers.set('search-similar', new SearchSimilarHandler(db));
    this.handlers.set('search-signature', new SearchSignatureHandler(db));
    this.handlers.set('get-annotation', new GetAnnotationHandler(db));
    this.handlers.set('list-files', new ListFilesHandler(db));
    this.handlers.set('get-file-stats', new GetFileStatsHandler(db));
  }

  getHandler(toolName: string): BaseHandler | null {
    return this.handlers.get(toolName) || null;
  }

  getAllToolDefinitions(): MCPToolDefinition[] {
    return [
      SearchSimilarHandler.getDefinition(),
      SearchSignatureHandler.getDefinition(),
      GetAnnotationHandler.getDefinition(),
      ListFilesHandler.getDefinition(),
      GetFileStatsHandler.getDefinition()
    ];
  }

  getToolNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}