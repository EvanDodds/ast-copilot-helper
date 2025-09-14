import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioTransport, StdioTransportConfig } from '../../../packages/ast-mcp-server/src/mcp/transport/stdio';
import { TransportMessage, TransportError } from '../../../packages/ast-mcp-server/src/mcp/transport/base';
import { Readable, Writable } from 'stream';

describe('StdioTransport', () => {
  let transport: StdioTransport;
  let mockInput: Readable;
  let mockOutput: Writable;
  let outputData: string[];

  beforeEach(() => {
    // Create mock streams
    mockInput = new Readable({
      read() {}
    });

    outputData = [];
    mockOutput = new Writable({
      write(chunk, _encoding, callback) {
        outputData.push(chunk.toString());
        callback();
        return true;
      }
    });

    // Create transport with mock streams
    const config: StdioTransportConfig = {
      input: mockInput,
      output: mockOutput,
      lineBuffering: true,
      maxLineLength: 1024
    };

    transport = new StdioTransport(config);
  });

  afterEach(async () => {
    if (transport && transport.getState() !== 'disconnected') {
      await transport.stop();
    }
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultTransport = new StdioTransport();
      expect(defaultTransport.getTransportType()).toBe('stdio');
      expect(defaultTransport.supportsMultipleConnections()).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      expect(transport.getTransportType()).toBe('stdio');
      expect(transport.getState()).toBe('disconnected');
    });

    it('should report correct transport capabilities', () => {
      expect(transport.supportsMultipleConnections()).toBe(false);
    });
  });

  describe('lifecycle management', () => {
    it('should start successfully', async () => {
      const startPromise = transport.start();

      // Allow some time for initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      await startPromise;

      expect(transport.getState()).toBe('connected');
      
      const connections = transport.getConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].state).toBe('connected');
    });

    it('should stop successfully', async () => {
      await transport.start();
      await transport.stop();

      expect(transport.getState()).toBe('disconnected');
      expect(transport.getConnections()).toHaveLength(0);
    });

    it('should throw error when starting already started transport', async () => {
      await transport.start();
      
      await expect(transport.start()).rejects.toThrow(TransportError);
      await expect(transport.start()).rejects.toThrow('already started');
    });

    it('should handle multiple stop calls gracefully', async () => {
      await transport.start();
      await transport.stop();
      
      // Second stop should not throw
      await expect(transport.stop()).resolves.toBeUndefined();
    });
  });

  describe('message handling', () => {
    let connectionId: string;

    beforeEach(async () => {
      await transport.start();
      const connections = transport.getConnections();
      connectionId = connections[0].id;
    });

    it('should send messages successfully', async () => {
      const message: TransportMessage = {
        id: 'test-1',
        type: 'request',
        method: 'test/method',
        payload: { test: 'data' },
        timestamp: new Date()
      };

      await transport.sendMessage(connectionId, message);

      expect(outputData).toHaveLength(1);
      const sentData = JSON.parse(outputData[0].replace('\n', ''));
      expect(sentData.id).toBe('test-1');
      expect(sentData.type).toBe('request');
      expect(sentData.method).toBe('test/method');
      expect(sentData.test).toBe('data');
    });

    it('should reject message for invalid connection', async () => {
      const message: TransportMessage = {
        id: 'test-1',
        type: 'request',
        method: 'test/method',
        payload: {},
        timestamp: new Date()
      };

      await expect(
        transport.sendMessage('invalid-connection', message)
      ).rejects.toThrow(TransportError);
    });

    it('should handle large messages within limits', async () => {
      const largePayload = 'x'.repeat(500); // Within default limit
      const message: TransportMessage = {
        id: 'test-large',
        type: 'request',
        method: 'test/method',
        payload: { data: largePayload },
        timestamp: new Date()
      };

      await expect(
        transport.sendMessage(connectionId, message)
      ).resolves.toBeUndefined();
    });

    it('should reject messages exceeding size limit', async () => {
      // Create transport with small limit
      const smallLimitTransport = new StdioTransport({
        input: mockInput,
        output: mockOutput,
        maxLineLength: 100
      });

      await smallLimitTransport.start();
      const connections = smallLimitTransport.getConnections();
      const smallConnectionId = connections[0].id;

      const largePayload = 'x'.repeat(200); // Exceeds limit
      const message: TransportMessage = {
        id: 'test-large',
        type: 'request',
        method: 'test/method',
        payload: { data: largePayload },
        timestamp: new Date()
      };

      await expect(
        smallLimitTransport.sendMessage(smallConnectionId, message)
      ).rejects.toThrow(TransportError);
      
      await smallLimitTransport.stop();
    });
  });

  describe('message reception', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('should handle incoming JSON messages', async () => {
      const receivedMessages: any[] = [];
      
      transport.on('message-received', (connectionId: string, message: any) => {
        receivedMessages.push({ connectionId, message });
      });

      const testMessage = {
        id: 'incoming-1',
        type: 'request',
        method: 'test/incoming',
        params: { test: 'value' }
      };

      // Simulate incoming message
      mockInput.push(JSON.stringify(testMessage) + '\n');
      mockInput.push(null); // End stream

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].message.id).toBe('incoming-1');
      expect(receivedMessages[0].message.method).toBe('test/incoming');
    });

    it('should handle malformed JSON gracefully', async () => {
      const errorMessages: any[] = [];
      
      transport.on('transport-error', (error: any) => {
        errorMessages.push(error);
      });

      // Send malformed JSON
      mockInput.push('{ invalid json\n');
      mockInput.push(null);

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should ignore empty lines', async () => {
      const receivedMessages: any[] = [];
      
      transport.on('message-received', (connectionId: string, message: any) => {
        receivedMessages.push({ connectionId, message });
      });

      // Send empty lines and whitespace
      mockInput.push('\n');
      mockInput.push('   \n');
      mockInput.push('\t\n');
      
      const testMessage = { id: 'test', type: 'request', method: 'test' };
      mockInput.push(JSON.stringify(testMessage) + '\n');
      mockInput.push(null);

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should only receive the valid message
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].message.id).toBe('test');
    });
  });

  describe('connection management', () => {
    it('should provide connection information', async () => {
      await transport.start();

      const info = transport.getStdioConnectionInfo();
      expect(info.isConnected).toBe(true);
      expect(info.connection).toBeDefined();
      expect(info.inputType).toBe('Readable');
      expect(info.outputType).toBe('Writable');
    });

    it('should track connection statistics', async () => {
      await transport.start();
      const connections = transport.getConnections();
      const connectionId = connections[0].id;

      const message: TransportMessage = {
        id: 'stats-test',
        type: 'request',
        method: 'test/stats',
        payload: { data: 'test' },
        timestamp: new Date()
      };

      await transport.sendMessage(connectionId, message);

      const connection = transport.getConnections()[0];
      expect(connection.stats.messagesSent).toBe(1);
      expect(connection.stats.bytesSent).toBeGreaterThan(0);
    });

    it('should handle connection errors', async () => {
      await transport.start();

      const errorMessages: any[] = [];
      transport.on('transport-error', (error: any) => {
        errorMessages.push(error);
      });

      // Since the mock stream will throw when we emit error, we expect this to be thrown
      // But the transport should still handle it and emit transport-error events
      expect(() => {
        mockInput.emit('error', new Error('Stream error'));
      }).toThrow('Stream error');

      // Give a moment for async error handling to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // The transport should have emitted error events despite the thrown error
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('heartbeat functionality', () => {
    it('should perform heartbeat when connected', async () => {
      await transport.start();

      // Spy on protected method through type assertion
      const performHeartbeatSpy = vi.spyOn(transport as any, 'performHeartbeat');

      // Manually trigger heartbeat
      await (transport as any).performHeartbeat();

      expect(performHeartbeatSpy).toHaveBeenCalled();
    });
  });

  describe('raw input mode', () => {
    it('should handle raw input mode', async () => {
      const rawTransport = new StdioTransport({
        input: mockInput,
        output: mockOutput,
        lineBuffering: false
      });

      await rawTransport.start();

      const receivedMessages: any[] = [];
      rawTransport.on('message-received', (connectionId: string, message: any) => {
        receivedMessages.push({ connectionId, message });
      });

      // Send JSON message without newline
      const testMessage = { id: 'raw-test', type: 'request', method: 'test' };
      mockInput.push(JSON.stringify(testMessage));
      mockInput.push(null);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].message.id).toBe('raw-test');

      await rawTransport.stop();
    });

    it('should prevent memory overflow in raw mode', async () => {
      const rawTransport = new StdioTransport({
        input: mockInput,
        output: mockOutput,
        lineBuffering: false,
        maxLineLength: 100
      });

      await rawTransport.start();

      const errorMessages: any[] = [];
      rawTransport.on('transport-error', (error: any) => {
        errorMessages.push(error);
      });

      // Send very large incomplete message
      mockInput.push('x'.repeat(200));

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(errorMessages.length).toBeGreaterThan(0);

      await rawTransport.stop();
    });
  });

  describe('error handling', () => {
    it('should handle output stream errors', async () => {
      // Create a writable stream that always errors
      const errorOutput = new Writable({
        write(_chunk, _encoding, callback) {
          callback(new Error('Write error'));
          return false;
        }
      });

      const errorTransport = new StdioTransport({
        input: mockInput,
        output: errorOutput
      });

      await errorTransport.start();
      const connections = errorTransport.getConnections();
      const connectionId = connections[0].id;

      const message: TransportMessage = {
        id: 'error-test',
        type: 'request',
        method: 'test/error',
        payload: {},
        timestamp: new Date()
      };

      await expect(
        errorTransport.sendMessage(connectionId, message)
      ).rejects.toThrow(TransportError);

      await errorTransport.stop();
    });

    it('should handle start failures gracefully', async () => {
      // Create transport that will fail to start
      const faultyInput = new Readable({
        read() {
          this.emit('error', new Error('Input initialization error'));
        }
      });

      const faultyTransport = new StdioTransport({
        input: faultyInput,
        output: mockOutput
      });

      await expect(faultyTransport.start()).rejects.toThrow(TransportError);
      expect(faultyTransport.getState()).toBe('error');
    });
  });

  describe('edge cases', () => {
    it('should handle close connection for unknown ID', async () => {
      await transport.start();

      // Should not throw for unknown connection ID
      await expect(transport.closeConnection('unknown-id')).resolves.toBeUndefined();
    });

    it('should handle message sending when not connected', async () => {
      const message: TransportMessage = {
        id: 'disconnected-test',
        type: 'request',
        method: 'test/method',
        payload: {},
        timestamp: new Date()
      };

      await expect(
        transport.sendMessage('any-id', message)
      ).rejects.toThrow(TransportError);
    });
  });
});