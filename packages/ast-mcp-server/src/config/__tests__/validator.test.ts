import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateConfig, validateConfigConstraints } from '../validator.js';
import { MCPServerConfig } from '../types.js';
import { DEFAULT_MCP_SERVER_CONFIG } from '../defaults.js';

describe('Configuration Validator', () => {
  let validConfig: MCPServerConfig;

  beforeEach(() => {
    validConfig = JSON.parse(JSON.stringify(DEFAULT_MCP_SERVER_CONFIG));
  });

  describe('Basic Validation', () => {
    it('should validate a complete valid configuration', () => {
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require server name', () => {
      validConfig.name = '';
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Server name is required and cannot be empty');
    });

    it('should require server version', () => {
      validConfig.version = '';
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Server version is required and cannot be empty');
    });

    it('should require database path', () => {
      // @ts-ignore - intentionally invalid for testing
      validConfig.database = {};
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Database path is required');
    });
  });

  describe('Transport Validation', () => {
    it('should validate valid transport types', () => {
      const transportTypes = ['stdio', 'websocket', 'http'];
      
      for (const type of transportTypes) {
        validConfig.transport.type = type as any;
        const result = validateConfig(validConfig);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid transport types', () => {
      validConfig.transport.type = 'invalid' as any;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid transport type: invalid. Must be stdio, websocket, or http');
    });

    it('should require port for non-stdio transports', () => {
      validConfig.transport.type = 'websocket';
      validConfig.transport.port = undefined;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Port is required for websocket transport');
    });

    it('should validate port ranges', () => {
      validConfig.transport.type = 'websocket';
      validConfig.transport.port = 0;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Port must be between 1 and 65535, got: 0');
    });

    it('should warn about high connection limits', () => {
      validConfig.transport.maxConnections = 50000;
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('maxConnections is very high, consider performance implications');
    });

    it('should warn about unused settings for stdio', () => {
      validConfig.transport.type = 'stdio';
      validConfig.transport.port = 8080;
      validConfig.transport.host = 'localhost';
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('Port setting ignored for stdio transport');
      expect(result.warnings).toContain('Host setting ignored for stdio transport');
    });
  });

  describe('Performance Validation', () => {
    it('should validate concurrent request limits', () => {
      validConfig.performance.maxConcurrentRequests = 0;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('maxConcurrentRequests must be at least 1');
    });

    it('should warn about high query result limits', () => {
      validConfig.performance.maxQueryResults = 50000;
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('maxQueryResults is very high, may impact performance');
    });

    it('should validate cache configuration', () => {
      validConfig.performance.cacheSize = -1;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('cacheSize cannot be negative');
    });

    it('should validate gc threshold range', () => {
      validConfig.performance.gcThreshold = 1.5;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('gcThreshold must be between 0 and 1');
    });
  });

  describe('Logging Validation', () => {
    it('should validate log levels', () => {
      const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
      
      for (const level of validLevels) {
        validConfig.logging.level = level as any;
        const result = validateConfig(validConfig);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid log levels', () => {
      validConfig.logging.level = 'invalid' as any;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid log level: invalid. Must be one of: error, warn, info, debug, trace');
    });

    it('should require file path when file logging enabled', () => {
      validConfig.logging.enableFile = true;
      validConfig.logging.filePath = undefined;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('filePath is required when file logging is enabled');
    });

    it('should warn about performance impact of verbose logging', () => {
      validConfig.logging.level = 'debug';
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain("Log level 'debug' may impact performance in production");
    });

    it('should warn about body logging security risks', () => {
      validConfig.logging.logRequestBody = true;
      validConfig.logging.logResponseBody = true;
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('Request/response body logging may impact performance and security');
    });
  });

  describe('Security Validation', () => {
    it('should validate rate limiting configuration', () => {
      validConfig.security.rateLimitRequests = 0;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('rateLimitRequests must be at least 1');
    });

    it('should validate TLS configuration', () => {
      validConfig.security.enableTls = true;
      validConfig.security.tlsConfig = {
        certFile: 'cert.pem',
        // Missing keyFile
      };
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('TLS keyFile is required when certFile is specified');
    });

    it('should warn about CORS wildcards', () => {
      validConfig.security.corsOrigins = ['*'];
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('CORS origin wildcard (*) should be avoided in production');
    });

    it('should warn about disabled authentication', () => {
      validConfig.security.enableAuthentication = false;
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('Authentication is disabled, consider enabling for production use');
    });
  });

  describe('Environment-Specific Validation', () => {
    it('should warn about debug logging in production', () => {
      validConfig.environment.nodeEnv = 'production';
      validConfig.logging.level = 'debug';
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('Debug logging enabled in production environment');
    });

    it('should warn about test endpoints in production', () => {
      validConfig.environment.nodeEnv = 'production';
      validConfig.features.enableTestEndpoints = true;
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('Test endpoints enabled in production environment');
    });

    it('should warn about verbose logging in test environment', () => {
      validConfig.environment.nodeEnv = 'test';
      validConfig.logging.level = 'info';
      
      const result = validateConfig(validConfig);
      
      expect(result.warnings).toContain('Verbose logging in test environment may slow down tests');
    });
  });

  describe('Configuration Constraints', () => {
    it('should validate timeout relationships', () => {
      validConfig.performance.requestTimeout = 60000;
      validConfig.transport.requestTimeout = 30000;
      
      const errors = validateConfigConstraints(validConfig);
      
      expect(errors).toContain('Performance requestTimeout cannot exceed transport requestTimeout');
    });

    it('should validate connection vs request ratios', () => {
      validConfig.transport.maxConnections = 10;
      validConfig.performance.maxConcurrentRequests = 1000;
      
      const errors = validateConfigConstraints(validConfig);
      
      expect(errors).toContain('maxConcurrentRequests seems too high relative to maxConnections');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing configuration sections gracefully', () => {
      // @ts-ignore - intentionally invalid for testing
      const partialConfig = {
        name: 'Test Server',
        version: '1.0.0',
        transport: { type: 'stdio' },
      };
      
      const result = validateConfig(partialConfig as MCPServerConfig);
      
      // Should still validate required fields
      expect(result.errors).toContain('Database path is required');
    });

    it('should handle undefined optional values', () => {
      validConfig.transport.maxConnections = undefined;
      validConfig.performance.cacheEnabled = undefined;
      
      const result = validateConfig(validConfig);
      
      expect(result.isValid).toBe(true);
    });
  });
});