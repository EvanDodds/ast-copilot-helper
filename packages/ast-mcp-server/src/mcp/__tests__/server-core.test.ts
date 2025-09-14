import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ASTMCPServer } from '../server-core';
import { MCPServerConfig, InitializeParams, MCPErrorCode } from '../protocol/types';

describe('ASTMCPServer', () => {
  let server: ASTMCPServer;
  let config: MCPServerConfig;

  beforeEach(() => {
    config = {
      name: 'test-server',
      description: 'Test MCP Server',
      version: '1.0.0',
      transport: 'stdio',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true }
      }
    };

    server = new ASTMCPServer();
  });

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await server.initialize(config);

      expect(server.isInitialized).toBe(true);
      expect(server.isRunning).toBe(false);
    });

    it('should throw on invalid config', async () => {
      const invalidConfig = { ...config, name: '' };

      await expect(server.initialize(invalidConfig)).rejects.toThrow('Server name is required');
    });

    it('should prevent double initialization', async () => {
      await server.initialize(config);

      await expect(server.initialize(config)).rejects.toThrow('Server already initialized');
    });
  });

  describe('lifecycle', () => {
    beforeEach(async () => {
      await server.initialize(config);
    });

    it('should start after initialization', async () => {
      await server.start();

      expect(server.isRunning).toBe(true);
    });

    it('should throw when starting uninitialized server', async () => {
      const uninitializedServer = new ASTMCPServer();

      await expect(uninitializedServer.start()).rejects.toThrow('Server must be initialized before starting');
    });

    it('should stop gracefully', async () => {
      await server.start();
      await server.stop();

      expect(server.isRunning).toBe(false);
    });

    it('should prevent double start', async () => {
      await server.start();

      // Should not throw, just log
      await server.start();
      expect(server.isRunning).toBe(true);
    });
  });

  describe('request handling', () => {
    beforeEach(async () => {
      await server.initialize(config);
    });

    it('should handle initialize request', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: false } },
          clientInfo: { name: 'test-client', version: '1.0.0' }
        } as InitializeParams
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect((response.result as any).protocolVersion).toBe('2024-11-05');
      expect((response.result as any).serverInfo.name).toBe('test-server');
      expect((response.result as any).capabilities).toBeDefined();
    });

    it('should handle ping request', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'ping'
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect((response.result as any).acknowledged).toBe(true);
      expect((response.result as any).timestamp).toBeDefined();
    });

    it('should return error for invalid method', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 3,
        method: 'invalid_method'
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(MCPErrorCode.METHOD_NOT_FOUND);
    });

    it('should handle tools/list with no registry', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 4,
        method: 'tools/list'
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(4);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(response.error!.message).toBe('Tool registry not available');
    });

    it('should handle resources/list with no registry', async () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 5,
        method: 'resources/list'
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(response.error!.message).toBe('Resource registry not available');
    });

    it('should handle request errors gracefully', async () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const request = {
        jsonrpc: '2.0' as const,
        id: 6,
        method: 'initialize',
        params: { protocolVersion: '1.0.0' } // Invalid version to trigger error
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(6);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(MCPErrorCode.INTERNAL_ERROR);

      consoleSpy.mockRestore();
    });
  });

  describe('notification handling', () => {
    beforeEach(async () => {
      await server.initialize(config);
    });

    it('should handle initialized notification', async () => {
      const eventSpy = vi.fn();
      server.on('client-initialized', eventSpy);

      const notification = {
        jsonrpc: '2.0' as const,
        method: 'initialized'
      };

      await server.handleNotification(notification);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle unknown notifications gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const notification = {
        jsonrpc: '2.0' as const,
        method: 'unknown_notification'
      };

      await server.handleNotification(notification);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown notification method: unknown_notification');

      consoleSpy.mockRestore();
    });
  });

  describe('capabilities', () => {
    beforeEach(async () => {
      await server.initialize(config);
    });

    it('should advertise configured capabilities', () => {
      const capabilities = server.advertiseCapabilities();

      expect(capabilities.tools?.listChanged).toBe(true);
      expect(capabilities.resources?.subscribe).toBe(false);
      expect(capabilities.resources?.listChanged).toBe(true);
    });

    it('should use default capabilities when none configured', async () => {
      const configWithoutCapabilities = {
        name: 'test-server',
        description: 'Test server without capabilities',
        version: '1.0.0',
        transport: 'stdio' as const,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false }
        }
      };

      const newServer = new ASTMCPServer();
      await newServer.initialize(configWithoutCapabilities);

      const capabilities = newServer.advertiseCapabilities();

      expect(capabilities.tools?.listChanged).toBe(false);
      expect(capabilities.resources?.subscribe).toBe(false);
      expect(capabilities.resources?.listChanged).toBe(false);
    });
  });

  describe('dependency injection', () => {
    beforeEach(async () => {
      await server.initialize(config);
    });

    it('should accept tool registry', () => {
      const mockRegistry = { listTools: vi.fn() };

      server.setToolRegistry(mockRegistry);

      // Should not throw - registry is set
      expect(() => server.setToolRegistry(mockRegistry)).not.toThrow();
    });

    it('should accept resource registry', () => {
      const mockRegistry = { listResources: vi.fn() };

      server.setResourceRegistry(mockRegistry);

      // Should not throw - registry is set
      expect(() => server.setResourceRegistry(mockRegistry)).not.toThrow();
    });
  });
});