/**
 * Configuration Validation
 * Provides comprehensive validation for MCP server configuration
 */

import { MCPServerConfig, ConfigValidationResult, TransportConfig, PerformanceConfig, LoggingConfig, SecurityConfig } from './types.js';

/**
 * Validate complete MCP server configuration
 */
export function validateConfig(config: MCPServerConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  validateRequiredFields(config, errors);
  
  // Validate transport configuration
  validateTransportConfig(config.transport, errors, warnings);
  
  // Validate performance configuration
  validatePerformanceConfig(config.performance, errors, warnings);
  
  // Validate logging configuration
  validateLoggingConfig(config.logging, errors, warnings);
  
  // Validate security configuration
  validateSecurityConfig(config.security, errors, warnings);
  
  // Validate database configuration
  validateDatabaseConfig(config.database, errors, warnings);
  
  // Environment-specific validation
  validateEnvironmentSpecific(config, errors, warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate required configuration fields
 */
function validateRequiredFields(config: MCPServerConfig, errors: string[]): void {
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Server name is required and cannot be empty');
  }
  
  if (!config.version || config.version.trim().length === 0) {
    errors.push('Server version is required and cannot be empty');
  }
  
  if (!config.transport) {
    errors.push('Transport configuration is required');
  }
  
  if (!config.database?.path) {
    errors.push('Database path is required');
  }
}

/**
 * Validate transport configuration
 */
function validateTransportConfig(transport: TransportConfig | undefined, errors: string[], warnings: string[]): void {
  if (!transport) return;
  
  if (!transport.type) {
    errors.push('Transport type is required');
    return;
  }
  
  if (!['stdio', 'websocket', 'http'].includes(transport.type)) {
    errors.push(`Invalid transport type: ${transport.type}. Must be stdio, websocket, or http`);
  }
  
  // WebSocket/HTTP specific validation
  if (transport.type !== 'stdio') {
    if (transport.port === undefined || transport.port === null) {
      errors.push(`Port is required for ${transport.type} transport`);
    } else if (transport.port < 1 || transport.port > 65535) {
      errors.push(`Port must be between 1 and 65535, got: ${transport.port}`);
    }
    
    if (transport.host && transport.host.trim().length === 0) {
      errors.push('Host cannot be empty when specified');
    }
  }
  
  // Connection limits validation
  if (transport.maxConnections !== undefined) {
    if (transport.maxConnections < 1) {
      errors.push('maxConnections must be at least 1');
    } else if (transport.maxConnections > 10000) {
      warnings.push('maxConnections is very high, consider performance implications');
    }
  }
  
  // Timeout validation
  if (transport.connectionTimeout !== undefined && transport.connectionTimeout < 1000) {
    warnings.push('connectionTimeout is very low, may cause connection issues');
  }
  
  if (transport.requestTimeout !== undefined && transport.requestTimeout < 1000) {
    warnings.push('requestTimeout is very low, may cause request failures');
  }
  
  // WebSocket specific validation
  if (transport.type === 'websocket') {
    if (transport.maxMessageSize !== undefined && transport.maxMessageSize < 1024) {
      warnings.push('maxMessageSize is very small for WebSocket transport');
    }
  }
  
  // STDIO specific validation
  if (transport.type === 'stdio') {
    if (transport.port !== undefined) {
      warnings.push('Port setting ignored for stdio transport');
    }
    if (transport.host !== undefined) {
      warnings.push('Host setting ignored for stdio transport');
    }
  }
}

/**
 * Validate performance configuration
 */
function validatePerformanceConfig(performance: PerformanceConfig | undefined, errors: string[], warnings: string[]): void {
  if (!performance) return;
  
  if (performance.maxConcurrentRequests !== undefined) {
    if (performance.maxConcurrentRequests < 1) {
      errors.push('maxConcurrentRequests must be at least 1');
    } else if (performance.maxConcurrentRequests > 1000) {
      warnings.push('maxConcurrentRequests is very high, monitor memory usage');
    }
  }
  
  if (performance.requestQueueSize !== undefined && performance.requestQueueSize < 1) {
    errors.push('requestQueueSize must be at least 1');
  }
  
  if (performance.maxQueryResults !== undefined) {
    if (performance.maxQueryResults < 1) {
      errors.push('maxQueryResults must be at least 1');
    } else if (performance.maxQueryResults > 10000) {
      warnings.push('maxQueryResults is very high, may impact performance');
    }
  }
  
  if (performance.cacheSize !== undefined && performance.cacheSize < 0) {
    errors.push('cacheSize cannot be negative');
  }
  
  if (performance.cacheTtl !== undefined && performance.cacheTtl < 1000) {
    warnings.push('cacheTtl is very low, may cause excessive cache churn');
  }
  
  // Memory validation
  if (performance.maxMemoryUsage !== undefined && performance.maxMemoryUsage < 64 * 1024 * 1024) {
    warnings.push('maxMemoryUsage is very low, may cause out of memory errors');
  }
  
  if (performance.gcThreshold !== undefined) {
    if (performance.gcThreshold < 0 || performance.gcThreshold > 1) {
      errors.push('gcThreshold must be between 0 and 1');
    }
  }
}

/**
 * Validate logging configuration
 */
function validateLoggingConfig(logging: LoggingConfig | undefined, errors: string[], warnings: string[]): void {
  if (!logging) return;
  
  const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
  if (logging.level && !validLevels.includes(logging.level)) {
    errors.push(`Invalid log level: ${logging.level}. Must be one of: ${validLevels.join(', ')}`);
  }
  
  if (logging.enableFile && !logging.filePath) {
    errors.push('filePath is required when file logging is enabled');
  }
  
  if (logging.maxFiles !== undefined && logging.maxFiles < 1) {
    errors.push('maxFiles must be at least 1');
  }
  
  if (logging.slowQueryThreshold !== undefined && logging.slowQueryThreshold < 0) {
    errors.push('slowQueryThreshold cannot be negative');
  }
  
  if (logging.metricsInterval !== undefined && logging.metricsInterval < 1000) {
    warnings.push('metricsInterval is very low, may impact performance');
  }
  
  // Performance warnings
  if (logging.logRequestBody || logging.logResponseBody) {
    warnings.push('Request/response body logging may impact performance and security');
  }
  
  if (logging.level === 'trace' || logging.level === 'debug') {
    warnings.push(`Log level '${logging.level}' may impact performance in production`);
  }
}

/**
 * Validate security configuration
 */
function validateSecurityConfig(security: SecurityConfig | undefined, errors: string[], warnings: string[]): void {
  if (!security) return;
  
  if (security.rateLimitRequests !== undefined && security.rateLimitRequests < 1) {
    errors.push('rateLimitRequests must be at least 1');
  }
  
  if (security.rateLimitWindow !== undefined && security.rateLimitWindow < 1000) {
    errors.push('rateLimitWindow must be at least 1000ms');
  }
  
  if (security.maxRequestSize !== undefined && security.maxRequestSize < 1024) {
    warnings.push('maxRequestSize is very small, may reject valid requests');
  }
  
  // TLS validation
  if (security.enableTls && security.tlsConfig) {
    if (security.tlsConfig.certFile && !security.tlsConfig.keyFile) {
      errors.push('TLS keyFile is required when certFile is specified');
    }
    if (security.tlsConfig.keyFile && !security.tlsConfig.certFile) {
      errors.push('TLS certFile is required when keyFile is specified');
    }
  }
  
  // CORS validation
  if (security.corsOrigins && security.corsOrigins.includes('*')) {
    warnings.push('CORS origin wildcard (*) should be avoided in production');
  }
  
  // Authentication warnings
  if (!security.enableAuthentication) {
    warnings.push('Authentication is disabled, consider enabling for production use');
  }
}

/**
 * Validate database configuration
 */
function validateDatabaseConfig(database: any, errors: string[], warnings: string[]): void {
  if (!database || !database.path || database.path.trim().length === 0) {
    errors.push('Database path cannot be empty');
  }
  
  if (database && database.backupInterval !== undefined && database.backupInterval < 60000) {
    warnings.push('backupInterval is very frequent, may impact performance');
  }
}

/**
 * Environment-specific validation
 */
function validateEnvironmentSpecific(config: MCPServerConfig, _errors: string[], warnings: string[]): void {
  const nodeEnv = config.environment?.nodeEnv || 'production';
  
  // Production environment checks
  if (nodeEnv === 'production') {
    if (config.logging?.level === 'debug' || config.logging?.level === 'trace') {
      warnings.push('Debug logging enabled in production environment');
    }
    
    if (config.features?.enableTestEndpoints) {
      warnings.push('Test endpoints enabled in production environment');
    }
    
    if (!config.security?.enableRateLimit) {
      warnings.push('Rate limiting disabled in production environment');
    }
    
            if (config.security?.corsOrigins?.includes('*')) {
      warnings.push('Open CORS policy in production environment');
    }
  }
  
  // Development environment checks
  if (nodeEnv === 'development') {
    if (!config.features.enableHotReload) {
      warnings.push('Hot reload disabled in development environment');
    }
  }
  
  // Test environment checks
  if (nodeEnv === 'test') {
    if (config.logging.level !== 'error') {
      warnings.push('Verbose logging in test environment may slow down tests');
    }
  }
}

/**
 * Validate configuration value types
 */
export function validateConfigTypes(_config: any): string[] {
  const errors: string[] = [];
  
  // This would implement runtime type validation
  // For now, TypeScript provides compile-time type checking
  
  return errors;
}

/**
 * Validate configuration constraints
 */
export function validateConfigConstraints(config: MCPServerConfig): string[] {
  const errors: string[] = [];
  
  // Cross-field validation
  if (config.performance.requestTimeout && config.transport.requestTimeout) {
    if (config.performance.requestTimeout > config.transport.requestTimeout) {
      errors.push('Performance requestTimeout cannot exceed transport requestTimeout');
    }
  }
  
  if (config.performance.maxConcurrentRequests && config.transport.maxConnections) {
    if (config.performance.maxConcurrentRequests > config.transport.maxConnections * 10) {
      errors.push('maxConcurrentRequests seems too high relative to maxConnections');
    }
  }
  
  return errors;
}