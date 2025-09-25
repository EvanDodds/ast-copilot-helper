/**
 * Configuration Types for MCP Server
 * Comprehensive configuration management with validation and environment support
 */

/**
 * Transport configuration options
 */
export interface TransportConfig {
  type: "stdio" | "websocket" | "http";

  // WebSocket/HTTP specific settings
  port?: number;
  host?: string;

  // Connection management
  maxConnections?: number;
  connectionTimeout?: number;
  requestTimeout?: number;
  heartbeatInterval?: number;

  // Auto-reconnection for clients
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;

  // WebSocket specific
  pingInterval?: number;
  pongTimeout?: number;
  maxMessageSize?: number;

  // STDIO specific
  lineBuffering?: boolean;
  maxLineLength?: number;
}

/**
 * Server performance and resource configuration
 */
export interface PerformanceConfig {
  // Request handling
  maxConcurrentRequests?: number;
  requestQueueSize?: number;
  requestTimeout?: number;

  // Memory management
  maxMemoryUsage?: number;
  gcThreshold?: number;
  enableGcMetrics?: boolean;

  // Query performance
  maxQueryResults?: number;
  queryTimeout?: number;
  cacheEnabled?: boolean;
  cacheSize?: number;
  cacheTtl?: number;

  // Database settings
  dbPoolSize?: number;
  dbTimeout?: number;
  enableQueryOptimization?: boolean;
}

/**
 * Logging and monitoring configuration
 */
export interface LoggingConfig {
  level: "error" | "warn" | "info" | "debug" | "trace";
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxFileSize?: string;
  maxFiles?: number;

  // Request/Response logging
  enableRequestLogging?: boolean;
  enableResponseLogging?: boolean;
  enableErrorLogging?: boolean;
  logRequestBody?: boolean;
  logResponseBody?: boolean;

  // Performance logging
  enablePerformanceLogging?: boolean;
  slowQueryThreshold?: number;
  enableMetrics?: boolean;
  metricsInterval?: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  // Authentication
  enableAuthentication?: boolean;
  authMethod?: "basic" | "bearer" | "apikey" | "custom";
  authConfig?: Record<string, any>;

  // Rate limiting
  enableRateLimit?: boolean;
  rateLimitRequests?: number;
  rateLimitWindow?: number;

  // CORS (for HTTP transport)
  enableCors?: boolean;
  corsOrigins?: string[];

  // Input validation
  enableStrictValidation?: boolean;
  maxRequestSize?: number;
  sanitizeInput?: boolean;

  // TLS/SSL (for secure transports)
  enableTls?: boolean;
  tlsConfig?: {
    certFile?: string;
    keyFile?: string;
    caFile?: string;
    rejectUnauthorized?: boolean;
  };
}

/**
 * Feature flags and capabilities
 */
export interface FeatureConfig {
  // MCP capabilities
  enableTools?: boolean;
  enableResources?: boolean;
  enablePrompts?: boolean;
  enableLogging?: boolean;

  // Advanced features
  enableHotReload?: boolean;
  enableWebInterface?: boolean;
  enableHealthCheck?: boolean;
  enableMetricsEndpoint?: boolean;
  enableTestEndpoints?: boolean;

  // Experimental features
  experimental?: {
    enableStreaming?: boolean;
    enableBatching?: boolean;
    enableCompression?: boolean;
    enableCaching?: boolean;
  };
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  nodeEnv?: "development" | "production" | "test";

  // Development settings
  development?: {
    enableDebug?: boolean;
    enableHotReload?: boolean;
    mockDatabase?: boolean;
    enableTestEndpoints?: boolean;
  };

  // Production settings
  production?: {
    enableCompression?: boolean;
    enableClustering?: boolean;
    healthCheckInterval?: number;
    gracefulShutdownTimeout?: number;
  };

  // Test settings
  test?: {
    enableMocking?: boolean;
    testTimeout?: number;
    mockDelay?: number;
  };
}

/**
 * Complete MCP server configuration
 */
export interface MCPServerConfig {
  // Server identity
  name: string;
  version: string;
  description?: string;
  protocolVersion?: string;

  // Core settings
  transport: TransportConfig;
  performance: PerformanceConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  features: FeatureConfig;
  environment: EnvironmentConfig;

  // Database settings
  database: {
    path: string;
    hotReload?: boolean;
    backupEnabled?: boolean;
    backupInterval?: number;
  };

  // Plugin/Extension settings
  plugins?: {
    enabled?: string[];
    disabled?: string[];
    config?: Record<string, any>;
  };

  // Custom configuration extensions
  custom?: Record<string, any>;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration source information
 */
export interface ConfigSource {
  type: "file" | "environment" | "programmatic" | "default";
  path?: string;
  priority: number;
}

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  configFile?: string;
  validateConfig?: boolean;
  allowEnvironmentOverrides?: boolean;
  strictMode?: boolean;
  enableDefaults?: boolean;
}

/**
 * Configuration manager events
 */
export interface ConfigEvents {
  "config:loaded": (config: MCPServerConfig) => void;
  "config:validated": (result: ConfigValidationResult) => void;
  "config:changed": (config: MCPServerConfig, source: ConfigSource) => void;
  "config:error": (error: Error) => void;
}
