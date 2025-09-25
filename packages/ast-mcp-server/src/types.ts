/**
 * Shared types for ast-mcp-server package
 * AST-specific types and database integration interfaces
 */

// AST Node Types
export interface ASTNode {
  nodeId: string;
  filePath: string;
  signature: string;
  summary: string;
  nodeType: string;
  startLine: number;
  endLine: number;
  sourceSnippet: string;
  parentId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ASTNodeMatch extends ASTNode {
  score: number;
  matchReason?: string;
}

// Database Query Options
export interface QueryOptions {
  maxResults?: number;
  minScore?: number;
  includeContext?: boolean;
  filePattern?: string;
  since?: Date | string;
}

export interface SearchResult {
  matches: ASTNodeMatch[];
  totalCount: number;
  queryTimeMs: number;
}

// Database Reader Interface
export interface DatabaseReader {
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Core query methods
  queryByIntent(
    intent: string,
    options?: QueryOptions,
  ): Promise<ASTNodeMatch[]>;
  getNodeById(nodeId: string): Promise<ASTNode | null>;
  getChildNodes(nodeId: string): Promise<ASTNode[]>;
  getFileNodes(filePath: string): Promise<ASTNode[]>;
  searchNodes(query: string, options?: QueryOptions): Promise<ASTNodeMatch[]>;

  // Change tracking
  getRecentChanges(
    since: Date | string,
    options?: QueryOptions,
  ): Promise<ASTNode[]>;

  // Index management
  isIndexReady(): Promise<boolean>;
  getIndexStats(): Promise<{
    nodeCount: number;
    fileCount: number;
    lastUpdated: Date;
  }>;
}

// MCP Server Configuration
export interface McpServerConfig {
  // Server settings
  serverName: string;
  serverVersion: string;
  protocolVersion: string;

  // Database settings
  databasePath: string;
  hotReload: boolean;

  // Transport settings
  transport: "stdio" | "tcp";
  tcpPort?: number;
  tcpHost?: string;

  // Performance settings
  maxQueryResults: number;
  queryTimeoutMs: number;

  // Logging settings
  logLevel: "debug" | "info" | "warn" | "error";
  enableRequestLogging: boolean;

  initialized: boolean;
}

// Transport Configuration
export interface TransportConfig {
  type: "stdio" | "tcp";
  tcpPort?: number;
  tcpHost?: string;
  messageTimeout?: number;
}

// Server Statistics
export interface ServerStats {
  uptime: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  activeConnections: number;
  lastRequestAt?: Date;
}
