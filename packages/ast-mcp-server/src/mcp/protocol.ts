/**
 * MCP (Model Context Protocol) core protocol types and interfaces
 * Implementation of JSON-RPC 2.0 with MCP-specific extensions
 */

// JSON-RPC 2.0 Base Types
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export type MCPMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// MCP Error Codes (JSON-RPC 2.0 + MCP extensions)
export enum MCPErrorCode {
  // JSON-RPC 2.0 standard errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // MCP-specific errors
  INITIALIZATION_FAILED = -32000,
  RESOURCE_NOT_FOUND = -32001,
  TOOL_EXECUTION_ERROR = -32002,
  TRANSPORT_ERROR = -32003,
  DATABASE_ERROR = -32004,
  CAPABILITY_NOT_SUPPORTED = -32005,
}

export interface MCPError {
  code: MCPErrorCode;
  message: string;
  data?: any;
}

// MCP Server Capabilities
export interface MCPServerCapabilities {
  tools: {
    listChanged: boolean;      // Can list available tools
  };
  resources: {
    subscribe: boolean;        // Can subscribe to resource changes
    listChanged: boolean;      // Can list available resources
  };
  prompts: {
    listChanged: boolean;      // Can list available prompts
  };
  logging: {
    level: string;            // Supported logging level
  };
}

// MCP Tool Definitions
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// MCP Resource Definitions
export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

// MCP Request/Response Message Types
export interface InitializeRequest extends JSONRPCRequest {
  method: "initialize";
  params: {
    protocolVersion: string;
    capabilities: {
      roots?: {
        listChanged?: boolean;
      };
      sampling?: object;
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface InitializeResponse extends JSONRPCResponse {
  result: {
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

export interface ToolsListRequest extends JSONRPCRequest {
  method: "tools/list";
}

export interface ToolsListResponse extends JSONRPCResponse {
  result: {
    tools: MCPToolDefinition[];
  };
}

export interface ToolsCallRequest extends JSONRPCRequest {
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface ToolsCallResponse extends JSONRPCResponse {
  result: MCPToolResult;
}

export interface ResourcesListRequest extends JSONRPCRequest {
  method: "resources/list";
}

export interface ResourcesListResponse extends JSONRPCResponse {
  result: {
    resources: MCPResourceDefinition[];
  };
}

export interface ResourcesReadRequest extends JSONRPCRequest {
  method: "resources/read";
  params: {
    uri: string;
  };
}

export interface ResourcesReadResponse extends JSONRPCResponse {
  result: {
    contents: MCPResourceContent[];
  };
}

export interface PingRequest extends JSONRPCRequest {
  method: "ping";
}

export interface PingResponse extends JSONRPCResponse {
  result: object;
}

// MCP Handler Interface
export interface MCPHandler {
  handle(request: JSONRPCRequest): Promise<JSONRPCResponse>;
}

// Utility Functions for Protocol Validation
export function isValidMCPRequest(obj: any): obj is JSONRPCRequest {
  return !!(
    obj &&
    obj.jsonrpc === "2.0" &&
    (typeof obj.id === "string" || typeof obj.id === "number") &&
    typeof obj.method === "string"
  );
}

export function isValidMCPResponse(obj: any): obj is JSONRPCResponse {
  return !!(
    obj &&
    obj.jsonrpc === "2.0" &&
    (typeof obj.id === "string" || typeof obj.id === "number") &&
    (obj.result !== undefined || obj.error !== undefined)
  );
}

export function isValidMCPNotification(obj: any): obj is JSONRPCNotification {
  return !!(
    obj &&
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    obj.id === undefined
  );
}

export function createMCPError(code: MCPErrorCode, message: string, data?: any): MCPError {
  return { code, message, data };
}

export function createErrorResponse(id: string | number, error: MCPError): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    error
  };
}

export function createSuccessResponse(id: string | number, result: any): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}