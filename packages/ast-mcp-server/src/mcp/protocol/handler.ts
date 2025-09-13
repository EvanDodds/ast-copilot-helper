/**
 * MCP Protocol Handler
 * Handles JSON-RPC 2.0 protocol parsing, validation, and error formatting
 */

import { 
  MCPRequest, 
  MCPResponse, 
  MCPError, 
  MCPNotification,
  MCPErrorCode 
} from './types';

export class MCPProtocolHandler {
  private static readonly JSONRPC_VERSION = '2.0';
  private static readonly SUPPORTED_PROTOCOL_VERSION = '2024-11-05';

  /**
   * Parse and validate an incoming JSON-RPC 2.0 message
   */
  static parseRequest(data: string): MCPRequest | MCPNotification | MCPError {
    let parsed: any;
    
    try {
      parsed = JSON.parse(data);
    } catch (error) {
      return {
        code: MCPErrorCode.PARSE_ERROR,
        message: 'Parse error',
        data: error instanceof Error ? error.message : 'Invalid JSON'
      };
    }

    // Validate JSON-RPC 2.0 structure
    if (!parsed || typeof parsed !== 'object') {
      return {
        code: MCPErrorCode.INVALID_REQUEST,
        message: 'Invalid Request',
        data: 'Request must be an object'
      };
    }

    if (parsed.jsonrpc !== this.JSONRPC_VERSION) {
      return {
        code: MCPErrorCode.INVALID_REQUEST,
        message: 'Invalid Request',
        data: `jsonrpc must be "${this.JSONRPC_VERSION}"`
      };
    }

    if (typeof parsed.method !== 'string') {
      return {
        code: MCPErrorCode.INVALID_REQUEST,
        message: 'Invalid Request',
        data: 'method must be a string'
      };
    }

    // Check if this is a notification (no id field)
    if (!('id' in parsed)) {
      return {
        jsonrpc: this.JSONRPC_VERSION,
        method: parsed.method,
        params: parsed.params
      } as MCPNotification;
    }

    // This is a request
    return {
      jsonrpc: this.JSONRPC_VERSION,
      id: parsed.id,
      method: parsed.method,
      params: parsed.params
    } as MCPRequest;
  }

  /**
   * Create a successful response
   */
  static createSuccessResponse(id: string | number | null, result: any): MCPResponse {
    return {
      jsonrpc: this.JSONRPC_VERSION,
      id,
      result
    };
  }

  /**
   * Create an error response
   */
  static createErrorResponse(id: string | number | null, error: MCPError): MCPResponse {
    return {
      jsonrpc: this.JSONRPC_VERSION,
      id,
      error
    };
  }

  /**
   * Create a notification
   */
  static createNotification(method: string, params?: any): MCPNotification {
    return {
      jsonrpc: this.JSONRPC_VERSION,
      method,
      params
    };
  }

  /**
   * Validate method name
   */
  static isValidMethod(method: string): boolean {
    // MCP method names should not start with 'rpc.' (reserved)
    if (method.startsWith('rpc.')) {
      return false;
    }
    
    // Should contain only alphanumeric, dash, underscore, and slash
    return /^[a-zA-Z0-9_\-\/]+$/.test(method);
  }

  /**
   * Get supported protocol version
   */
  static getSupportedProtocolVersion(): string {
    return this.SUPPORTED_PROTOCOL_VERSION;
  }

  /**
   * Validate protocol version compatibility
   */
  static isCompatibleProtocolVersion(version: string): boolean {
    // For now, we only support the specific version
    // In the future, this could implement semantic version compatibility
    return version === this.SUPPORTED_PROTOCOL_VERSION;
  }

  /**
   * Serialize response to JSON string
   */
  static serializeResponse(response: MCPResponse | MCPNotification): string {
    return JSON.stringify(response);
  }

  /**
   * Create common error responses
   */
  static createParseError(): MCPError {
    return {
      code: MCPErrorCode.PARSE_ERROR,
      message: 'Parse error'
    };
  }

  static createInvalidRequest(details?: string): MCPError {
    return {
      code: MCPErrorCode.INVALID_REQUEST,
      message: 'Invalid Request',
      data: details
    };
  }

  static createMethodNotFound(method: string): MCPError {
    return {
      code: MCPErrorCode.METHOD_NOT_FOUND,
      message: `Method not found: ${method}`
    };
  }

  static createInvalidParams(details?: string): MCPError {
    return {
      code: MCPErrorCode.INVALID_PARAMS,
      message: 'Invalid params',
      data: details
    };
  }

  static createInternalError(details?: string): MCPError {
    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message: details || 'Internal error'
    };
  }

  static createResourceNotFound(uri: string): MCPError {
    return {
      code: MCPErrorCode.RESOURCE_NOT_FOUND,
      message: 'Resource not found',
      data: `Resource "${uri}" not found`
    };
  }

  static createResourceUnavailable(uri: string, reason?: string): MCPError {
    return {
      code: MCPErrorCode.RESOURCE_UNAVAILABLE,
      message: 'Resource unavailable',
      data: reason ? `Resource "${uri}" unavailable: ${reason}` : `Resource "${uri}" unavailable`
    };
  }

  static createToolExecutionError(toolName: string, error: string): MCPError {
    return {
      code: MCPErrorCode.TOOL_EXECUTION_ERROR,
      message: 'Tool execution error',
      data: `Tool "${toolName}" failed: ${error}`
    };
  }

  static createCapabilityNotSupported(capability: string): MCPError {
    return {
      code: MCPErrorCode.CAPABILITY_NOT_SUPPORTED,
      message: 'Capability not supported',
      data: `Capability "${capability}" is not supported by this server`
    };
  }
}