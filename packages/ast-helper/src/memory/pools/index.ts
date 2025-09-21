/**
 * Resource Pool System Index
 * Exports all resource pool implementations and utilities
 */

export { BaseResourcePool } from './base-pool.js';
export type { BasePoolConfig } from './base-pool.js';
export { DatabaseConnectionPool } from './database-pool.js';
export type { DatabaseConnectionPoolConfig } from './database-pool.js';
export { FileHandlePool } from './file-handle-pool.js';
export type { FileHandlePoolConfig } from './file-handle-pool.js';
export { WorkerThreadPool } from './worker-thread-pool.js';
export type { WorkerThreadPoolConfig } from './worker-thread-pool.js';

// Re-export commonly used types from the main types file
export type {
  ResourcePool,
  PoolConfig,
  PoolStats,
  ResourceFactory,
  DatabaseConnection,
  DatabaseConnectionFactory,
  FileHandle,
  FileHandleFactory,
  WorkerThread,
  WorkerThreadFactory,
  WorkerType,
  PoolError,
  PoolErrorType,
  PoolState,
  ErrorSeverity,
  PooledResource,
  ResourceLease,
  PoolPerformanceMetrics,
  PoolHealthCheck,
  PoolManager
} from '../types.js';