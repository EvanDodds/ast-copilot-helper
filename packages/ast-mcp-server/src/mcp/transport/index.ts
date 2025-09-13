/**
 * Transport layer implementations for MCP server
 */

// Base transport classes and types
export { Transport, TransportError } from './base';
export type { TransportConfig, TransportMessage, ConnectionInfo } from './base';

// STDIO transport for VS Code integration
export { StdioTransport } from './stdio';
export type { StdioTransportConfig } from './stdio';

// WebSocket transport for network communication
export { WebSocketTransport } from './websocket';
export type { WebSocketTransportConfig } from './websocket';

// Import all needed classes for factory
import { Transport, TransportConfig } from './base';
import { StdioTransport, StdioTransportConfig } from './stdio';
import { WebSocketTransport, WebSocketTransportConfig } from './websocket';

/**
 * Transport factory for creating appropriate transport instances
 */
export class TransportFactory {
  /**
   * Create a STDIO transport for command-line or VS Code integration
   */
  static createStdio(config?: StdioTransportConfig): StdioTransport {
    return new StdioTransport(config);
  }

  /**
   * Create a WebSocket transport for network communication
   */
  static createWebSocket(config?: WebSocketTransportConfig): WebSocketTransport {
    return new WebSocketTransport(config);
  }

  /**
   * Automatically create transport based on detected environment/config
   */
  static createAuto(config?: TransportConfig): Transport {
    // Auto-detect based on configuration
    if ('url' in (config || {}) || 'port' in (config || {})) {
      return new WebSocketTransport(config as WebSocketTransportConfig);
    }
    
    // Default to STDIO for command-line/VS Code integration
    return new StdioTransport(config as StdioTransportConfig);
  }
}

/**
 * Transport utilities
 */
export class TransportUtils {
  /**
   * Validate transport configuration
   */
  static validateConfig(config: TransportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.heartbeatInterval !== undefined) {
      if (config.heartbeatInterval < 1000) {
        errors.push('Heartbeat interval must be at least 1000ms');
      }
      if (config.heartbeatInterval > 300000) {
        errors.push('Heartbeat interval must be at most 300000ms (5 minutes)');
      }
    }

    if (config.connectionTimeout !== undefined) {
      if (config.connectionTimeout < 1000) {
        errors.push('Connection timeout must be at least 1000ms');
      }
      if (config.connectionTimeout > 60000) {
        errors.push('Connection timeout must be at most 60000ms (1 minute)');
      }
    }

    if (config.maxReconnectAttempts !== undefined) {
      if (config.maxReconnectAttempts < 0) {
        errors.push('Max reconnect attempts cannot be negative');
      }
      if (config.maxReconnectAttempts > 100) {
        errors.push('Max reconnect attempts should not exceed 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get transport type from configuration
   */
  static getTransportType(config: any): 'stdio' | 'websocket' | 'unknown' {
    if (config && typeof config === 'object') {
      // Check for WebSocket-specific properties
      if ('port' in config || 'url' in config || 'host' in config) {
        return 'websocket';
      }
      
      // Check for STDIO-specific properties
      if ('input' in config || 'output' in config || 'lineBuffering' in config) {
        return 'stdio';
      }
    }
    
    return 'unknown';
  }

  /**
   * Create transport statistics summary
   */
  static createStatsSummary(transport: Transport): {
    transportType: string;
    state: string;
    connectionCount: number;
    totalConnections: number;
    totalMessages: {
      sent: number;
      received: number;
    };
    totalBytes: {
      sent: number;
      received: number;
    };
    totalErrors: number;
    uptime?: number;
  } {
    const connections = Array.from(transport.getConnections());
    const stats = {
      transportType: transport.getTransportType(),
      state: transport.getState(),
      connectionCount: connections.length,
      totalConnections: connections.length,
      totalMessages: {
        sent: 0,
        received: 0
      },
      totalBytes: {
        sent: 0,
        received: 0
      },
      totalErrors: 0,
      uptime: undefined as number | undefined
    };

    // Aggregate statistics from all connections
    for (const connection of connections) {
      stats.totalMessages.sent += connection.stats.messagesSent;
      stats.totalMessages.received += connection.stats.messagesReceived;
      stats.totalBytes.sent += connection.stats.bytesSent;
      stats.totalBytes.received += connection.stats.bytesReceived;
      stats.totalErrors += connection.stats.errors;
    }

    // Calculate uptime if we have connection information
    const oldestConnection = connections
      .filter((c: any) => c.connectedAt)
      .sort((a: any, b: any) => a.connectedAt!.getTime() - b.connectedAt!.getTime())[0];

    if (oldestConnection?.connectedAt) {
      stats.uptime = Date.now() - oldestConnection.connectedAt.getTime();
    }

    return stats;
  }
}