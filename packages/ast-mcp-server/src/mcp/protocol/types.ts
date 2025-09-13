/**
 * Core MCP Protocol Types and Interfaces
 * Implements JSON-RPC 2.0 specification for MCP server communication
 */

export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Standard JSON-RPC 2.0 Error Codes
export enum MCPErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // MCP-specific error codes
  RESOURCE_NOT_FOUND = -32001,
  RESOURCE_UNAVAILABLE = -32002,
  TOOL_EXECUTION_ERROR = -32003,
  CAPABILITY_NOT_SUPPORTED = -32004,
}

// Server Capabilities
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
  experimental?: {
    [key: string]: any;
  };
}

// Client Capabilities (received during initialization)
export interface ClientCapabilities {
  experimental?: {
    [key: string]: any;
  };
  [key: string]: any;
}

// Initialization Request/Response
export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

// Configuration Types
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  capabilities: ServerCapabilities;
  transport: 'stdio' | 'websocket' | 'http';
  port?: number;
  maxConnections?: number;
  requestTimeout?: number;
  enableLogging?: boolean;
}

// Tool and Resource Base Types
// Basic JSON Schema interface
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: any[];
  const?: any;
  description?: string;
  default?: any;
}

// Tool and Resource types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: JSONSchema;
  handler: (params: Record<string, any>, context?: ToolExecutionContext) => Promise<CallToolResult>;
  capabilities?: ToolCapabilities[];
}

// Tool request/response types
export interface CallToolRequest extends MCPRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface CallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

export interface MCPToolResult extends CallToolResult {
  errorMessage?: string;
}export interface ToolExecutionContext {
  requestId?: string;
  timestamp: Date;
  clientInfo?: {
    name: string;
    version: string;
  };
  environment?: Record<string, any>;
}

export interface ToolValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  tags: string[];
  capabilities: ToolCapabilities[];
  registeredAt: Date;
  lastModified: Date;
  version: string;
  author: string;
  config: Record<string, any>;
}

export type ToolCapabilities = 
  | 'read-only'
  | 'write'
  | 'system-access'
  | 'network-access'
  | 'file-access'
  | 'database-access';

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface ToolCallParams {
  name: string;
  arguments?: any;
}

export interface ResourceReadParams {
  uri: string;
}

export interface ListToolsResult {
  tools: MCPTool[];
}

export interface ListResourcesResult {
  resources: MCPResource[];
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string; // base64 encoded
}

/**
 * Resource validation result
 */
export interface ResourceValidationResult {
  /** Whether the resource is valid */
  isValid: boolean;
  /** Validation errors if any */
  errors: string[];
}

/**
 * Resource metadata for registry management
 */
export interface ResourceMetadata {
  /** Unique resource identifier (URI) */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Resource description */
  description: string;
  /** MIME type of the resource */
  mimeType?: string;
  /** Resource category for organization */
  category: string;
  /** Tags for resource discovery */
  tags: string[];
  /** When the resource was registered */
  registeredAt: Date;
  /** Last modification timestamp */
  lastModified: Date;
  /** Resource version */
  version: string;
  /** Resource author/creator */
  author: string;
  /** Additional configuration */
  config: Record<string, any>;
  /** Whether resource supports caching */
  cacheable: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
}