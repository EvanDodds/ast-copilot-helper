/**
 * File locking types and interfaces
 * Defines the contract for cross-platform file locking
 */

export interface Lock {
  /** Unique identifier for this lock */
  id: string;
  
  /** Type of lock: exclusive for writes, shared for reads */
  type: 'exclusive' | 'shared';
  
  /** Path to the lock file */
  filePath: string;
  
  /** Operation that acquired this lock */
  operation: string;
  
  /** When the lock was acquired */
  acquiredAt: Date;
  
  /** Timeout in milliseconds */
  timeoutMs: number;
  
  /** Process ID that owns this lock */
  pid: number;
}

export interface LockOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  
  /** Maximum number of retry attempts (default: 10) */
  maxRetries?: number;
  
  /** Delay between retries in milliseconds (default: 100) */
  retryDelayMs?: number;
}

export class LockError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'LockError';
  }
}

export class LockTimeoutError extends LockError {
  constructor(operation: string, timeoutMs: number) {
    super(`Lock timeout after ${timeoutMs}ms for operation: ${operation}`, 'LOCK_TIMEOUT');
  }
}

export class LockConflictError extends LockError {
  constructor(operation: string, existingLock: Lock) {
    super(
      `Lock conflict for operation '${operation}'. ` +
      `Existing ${existingLock.type} lock held by PID ${existingLock.pid} ` +
      `for operation '${existingLock.operation}' since ${existingLock.acquiredAt.toISOString()}`,
      'LOCK_CONFLICT'
    );
  }
}
