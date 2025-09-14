"use strict";
/**
 * Default Configuration for MCP Server
 * Provides sensible defaults for all configuration options
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_CONFIG = exports.PRODUCTION_CONFIG = exports.DEVELOPMENT_CONFIG = exports.DEFAULT_MCP_SERVER_CONFIG = exports.DEFAULT_ENVIRONMENT_CONFIG = exports.DEFAULT_FEATURE_CONFIG = exports.DEFAULT_SECURITY_CONFIG = exports.DEFAULT_LOGGING_CONFIG = exports.DEFAULT_PERFORMANCE_CONFIG = exports.DEFAULT_TRANSPORT_CONFIG = void 0;
exports.getEnvironmentConfig = getEnvironmentConfig;
/**
 * Default transport configuration
 */
exports.DEFAULT_TRANSPORT_CONFIG = {
    type: 'stdio',
    host: 'localhost',
    port: 3000,
    maxConnections: 100,
    connectionTimeout: 30000,
    requestTimeout: 60000,
    heartbeatInterval: 30000,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 5000,
    pingInterval: 30000,
    pongTimeout: 5000,
    maxMessageSize: 10 * 1024 * 1024, // 10MB
    lineBuffering: true,
    maxLineLength: 1024 * 1024, // 1MB
};
/**
 * Default performance configuration
 */
exports.DEFAULT_PERFORMANCE_CONFIG = {
    maxConcurrentRequests: 100,
    requestQueueSize: 1000,
    requestTimeout: 30000,
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    gcThreshold: 0.8,
    enableGcMetrics: false,
    maxQueryResults: 1000,
    queryTimeout: 30000,
    cacheEnabled: true,
    cacheSize: 1000,
    cacheTtl: 300000, // 5 minutes
    dbPoolSize: 10,
    dbTimeout: 15000,
    enableQueryOptimization: true,
};
/**
 * Default logging configuration
 */
exports.DEFAULT_LOGGING_CONFIG = {
    level: 'info',
    enableConsole: true,
    enableFile: false,
    maxFileSize: '10MB',
    maxFiles: 5,
    enableRequestLogging: false,
    enableResponseLogging: false,
    enableErrorLogging: true,
    logRequestBody: false,
    logResponseBody: false,
    enablePerformanceLogging: false,
    slowQueryThreshold: 1000,
    enableMetrics: false,
    metricsInterval: 60000,
};
/**
 * Default security configuration
 */
exports.DEFAULT_SECURITY_CONFIG = {
    enableAuthentication: true,
    enableRateLimit: false,
    rateLimitRequests: 100,
    rateLimitWindow: 900000, // 15 minutes
    enableCors: true,
    corsOrigins: ['*'],
    enableStrictValidation: true,
    maxRequestSize: 1024 * 1024, // 1MB
    sanitizeInput: true,
    enableTls: false,
    tlsConfig: {
        rejectUnauthorized: true,
    },
};
/**
 * Default feature configuration
 */
exports.DEFAULT_FEATURE_CONFIG = {
    enableTools: true,
    enableResources: true,
    enablePrompts: false,
    enableLogging: true,
    enableHotReload: false,
    enableWebInterface: false,
    enableHealthCheck: true,
    enableMetricsEndpoint: false,
    enableTestEndpoints: false,
    experimental: {
        enableStreaming: false,
        enableBatching: false,
        enableCompression: false,
        enableCaching: true,
    },
};
/**
 * Default environment configuration
 */
exports.DEFAULT_ENVIRONMENT_CONFIG = {
    nodeEnv: 'production',
    development: {
        enableDebug: true,
        enableHotReload: true,
        mockDatabase: false,
        enableTestEndpoints: false,
    },
    production: {
        enableCompression: true,
        enableClustering: false,
        healthCheckInterval: 30000,
        gracefulShutdownTimeout: 10000,
    },
    test: {
        enableMocking: true,
        testTimeout: 5000,
        mockDelay: 100,
    },
};
/**
 * Complete default configuration
 */
exports.DEFAULT_MCP_SERVER_CONFIG = {
    name: 'AST MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol Server for AST Analysis',
    protocolVersion: '2024-11-05',
    transport: exports.DEFAULT_TRANSPORT_CONFIG,
    performance: exports.DEFAULT_PERFORMANCE_CONFIG,
    logging: exports.DEFAULT_LOGGING_CONFIG,
    security: exports.DEFAULT_SECURITY_CONFIG,
    features: exports.DEFAULT_FEATURE_CONFIG,
    environment: exports.DEFAULT_ENVIRONMENT_CONFIG,
    database: {
        path: './.astdb',
        hotReload: false,
        backupEnabled: false,
        backupInterval: 3600000, // 1 hour
    },
    plugins: {
        enabled: [],
        disabled: [],
        config: {},
    },
    custom: {},
};
/**
 * Environment-specific configurations
 */
exports.DEVELOPMENT_CONFIG = {
    logging: {
        ...exports.DEFAULT_LOGGING_CONFIG,
        level: 'debug',
        enableRequestLogging: true,
        enablePerformanceLogging: true,
        enableMetrics: true,
    },
    features: {
        ...exports.DEFAULT_FEATURE_CONFIG,
        enableHotReload: true,
        enableWebInterface: true,
        enableTestEndpoints: true,
        enableMetricsEndpoint: true,
    },
    security: {
        ...exports.DEFAULT_SECURITY_CONFIG,
        enableCors: true,
    },
    environment: {
        ...exports.DEFAULT_ENVIRONMENT_CONFIG,
        nodeEnv: 'development',
    },
};
exports.PRODUCTION_CONFIG = {
    logging: {
        ...exports.DEFAULT_LOGGING_CONFIG,
        level: 'warn',
        enableFile: true,
        filePath: './logs/mcp-server.log',
        enableMetrics: true,
        metricsInterval: 300000, // 5 minutes
    },
    performance: {
        ...exports.DEFAULT_PERFORMANCE_CONFIG,
        enableGcMetrics: true,
        cacheSize: 5000,
        maxConcurrentRequests: 200,
    },
    features: {
        ...exports.DEFAULT_FEATURE_CONFIG,
        enableTestEndpoints: false,
        enableMetricsEndpoint: false,
    },
    security: {
        ...exports.DEFAULT_SECURITY_CONFIG,
        enableRateLimit: true,
        enableStrictValidation: true,
        corsOrigins: [], // Restrict CORS in production
        enableTls: true,
    },
    environment: {
        ...exports.DEFAULT_ENVIRONMENT_CONFIG,
        nodeEnv: 'production',
    },
};
exports.TEST_CONFIG = {
    logging: {
        ...exports.DEFAULT_LOGGING_CONFIG,
        level: 'error',
        enableConsole: false,
    },
    performance: {
        ...exports.DEFAULT_PERFORMANCE_CONFIG,
        requestTimeout: 5000,
        queryTimeout: 5000,
        cacheEnabled: false,
    },
    environment: {
        ...exports.DEFAULT_ENVIRONMENT_CONFIG,
        nodeEnv: 'test',
    },
    database: {
        path: './test/.astdb',
        hotReload: false,
        backupEnabled: false,
    },
};
/**
 * Get configuration for specific environment
 */
function getEnvironmentConfig(environment) {
    if (!environment) {
        return exports.PRODUCTION_CONFIG;
    }
    switch (environment.toLowerCase()) {
        case 'development':
        case 'dev':
            return exports.DEVELOPMENT_CONFIG;
        case 'production':
        case 'prod':
            return exports.PRODUCTION_CONFIG;
        case 'test':
        case 'testing':
            return exports.TEST_CONFIG;
        default:
            return exports.PRODUCTION_CONFIG;
    }
}
//# sourceMappingURL=defaults.js.map