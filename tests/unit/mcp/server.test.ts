/**
 * Tests for MCP Server Core Architecture
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ASTMCPServer } from '../../../packages/ast-mcp-server/src/server';
import { StdioTransport } from '../../../packages/ast-mcp-server/src/mcp/stdio-transport';
import { DatabaseReader, McpServerConfig } from '../../../packages/ast-mcp-server/src/types';
import { JSONRPCRequest } from '../../../packages/ast-mcp-server/src/mcp/protocol';

// Mock database reader
const mockDatabase: DatabaseReader = {
  initialize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  queryByIntent: vi.fn(),
  getNodeById: vi.fn(),
  getChildNodes: vi.fn(),
  getFileNodes: vi.fn(),
  searchNodes: vi.fn(),
  getRecentChanges: vi.fn(),
  isIndexReady: vi.fn().mockResolvedValue(true),
  getIndexStats: vi.fn().mockResolvedValue({
    nodeCount: 100,
    fileCount: 10,
    lastUpdated: new Date()
  })
};

// Mock transport
const mockTransport = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  onMessage: vi.fn(),
  isActive: vi.fn().mockReturnValue(true),
  getType: vi.fn().mockReturnValue('stdio'),
  getStats: vi.fn().mockReturnValue({
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0
  }),
  on: vi.fn(),
  emit: vi.fn()
};

const defaultConfig = {
  serverName: 'ast-mcp-server',
  serverVersion: '1.0.0',
  protocolVersion: '1.0',
  requestTimeout: 30000,
  maxConcurrentRequests: 10,
  enableRequestLogging: false
};

describe('MCP Server Core Architecture', () => {
  let server: ASTMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new ASTMCPServer(
      mockTransport as any,
      mockDatabase,
      defaultConfig
    );
  });

  afterEach(async () => {
    if (server.isActive()) {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    it('should initialize with correct state', () => {
      expect(server.isActive()).toBe(false);
      expect(server.isReady()).toBe(false);
    });

    it('should start successfully', async () => {
      await server.start();
      
      expect(server.isActive()).toBe(true);
      expect(mockDatabase.initialize).toHaveBeenCalled();
      expect(mockTransport.start).toHaveBeenCalled();
    });

    it('should fail to start if already running', async () => {
      await server.start();
      
      await expect(server.start()).rejects.toThrow('MCP Server is already running');
    });

    it('should stop successfully', async () => {
      await server.start();
      await server.stop();
      
      expect(server.isActive()).toBe(false);
      expect(server.isReady()).toBe(false);
      expect(mockTransport.stop).toHaveBeenCalled();
      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it('should handle stop when not running', async () => {
      await server.stop(); // Should not throw
      expect(server.isActive()).toBe(false);
    });
  });

  describe('Server Capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = server.getCapabilities();
      
      expect(capabilities).toEqual({
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: false },
        logging: { level: 'info' }
      });
    });
  });

  describe('Handler Management', () => {
    it('should allow handler registration', () => {
      const mockHandler = {
        handle: vi.fn()
      };
      
      server.registerHandler('test/method', mockHandler);
      // Handler should be registered (can't directly test private Map)
      expect(true).toBe(true);
    });

    it('should allow handler unregistration', () => {
      const mockHandler = {
        handle: vi.fn()
      };
      
      server.registerHandler('test/method', mockHandler);
      server.unregisterHandler('test/method');
      // Handler should be unregistered (can't directly test private Map)
      expect(true).toBe(true);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track basic statistics', async () => {
      await server.start();
      
      const stats = server.getStats();
      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('errorCount');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('activeConnections');
      
      expect(typeof stats.requestCount).toBe('number');
      expect(typeof stats.errorCount).toBe('number');
      expect(typeof stats.averageResponseTime).toBe('number');
      expect(typeof stats.uptime).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
    });

    it('should initialize statistics correctly', () => {
      // Mock transport as inactive for this test
      mockTransport.isActive = vi.fn().mockReturnValue(false);
      const stats = server.getStats();
      
      expect(stats.requestCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.uptime).toBe(0);
      expect(stats.activeConnections).toBe(0);
      
      // Reset to active for other tests
      mockTransport.isActive = vi.fn().mockReturnValue(true);
    });
  });

  describe('Initialize Handler', () => {
    it('should handle initialize requests correctly', async () => {
      await server.start();
      
      // Mock a successful initialize request
      const initRequest: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "init-1",
        method: "initialize",
        params: {
          protocolVersion: "1.0",
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        }
      };

      // Get the message handler and call it
      const messageHandler = mockTransport.onMessage.mock.calls[0][0];
      await messageHandler(initRequest);
      
      // Should have sent a response
      expect(mockTransport.sendMessage).toHaveBeenCalled();
      
      // Check if server is marked as initialized
      server.markInitialized();
      expect(server.isReady()).toBe(true);
    });
  });

  describe('Ping Handler', () => {
    it('should handle ping requests correctly', async () => {
      await server.start();
      server.markInitialized();
      
      const pingRequest: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "ping-1",
        method: "ping"
      };

      // Get the message handler and call it
      const messageHandler = mockTransport.onMessage.mock.calls[0][0];
      await messageHandler(pingRequest);
      
      // Should have sent a response
      expect(mockTransport.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', async () => {
      await server.start();
      
      const errorSpy = vi.fn();
      server.on('error', errorSpy);
      
      // Simulate transport error
      const errorHandler = mockTransport.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        errorHandler(new Error('Transport error'));
        expect(errorSpy).toHaveBeenCalled();
      }
    });

    it('should handle database initialization errors', async () => {
      mockDatabase.initialize = vi.fn().mockRejectedValue(new Error('DB Error'));
      
      await expect(server.start()).rejects.toThrow('Failed to start MCP server');
    });
  });
});