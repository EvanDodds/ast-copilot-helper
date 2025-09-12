/**
 * Lock Manager for coordinating concurrent access to .astdb directory
 * Provides exclusive locks for write operations and shared locks for read operations
 */

import { join } from 'node:path';
import type { Lock, LockOptions } from './types.js';
import { LockError, LockTimeoutError, LockConflictError } from './types.js';
import {
  readLockFile,
  writeLockFile,
  removeLockFile,
  cleanupStaleLocks,
  sleep,
  isLockExpired,
  isProcessRunning
} from './utils.js';

export class LockManager {
  private readonly lockFilePath: string;
  private readonly defaultOptions: Required<LockOptions>;
  private activeLocks = new Map<string, Lock>();

  constructor(workspacePath: string, options: LockOptions = {}) {
    this.lockFilePath = join(workspacePath, '.astdb', '.lock');
    this.defaultOptions = {
      timeoutMs: options.timeoutMs ?? 30000,
      maxRetries: options.maxRetries ?? 10,
      retryDelayMs: options.retryDelayMs ?? 100
    };
  }

  /**
   * Acquire an exclusive lock for write operations
   * Only one exclusive lock can be held at a time
   */
  async acquireExclusiveLock(operation: string, options: LockOptions = {}): Promise<Lock> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    for (let attempt = 0; attempt < mergedOptions.maxRetries; attempt++) {
      try {
        // Clean up stale locks first
        await cleanupStaleLocks(this.lockFilePath);
        
        // Check for existing locks
        const existingLock = await readLockFile(this.lockFilePath);
        
        if (existingLock) {
          // Check if lock is expired or from dead process
          if (isLockExpired(existingLock) || !isProcessRunning(existingLock.pid)) {
            await removeLockFile(this.lockFilePath);
          } else {
            // Active lock exists - cannot acquire exclusive lock
            throw new LockConflictError(operation, existingLock);
          }
        }
        
        // Try to acquire the lock
        const lock = await writeLockFile(this.lockFilePath, {
          type: 'exclusive',
          operation,
          acquiredAt: new Date(),
          timeoutMs: mergedOptions.timeoutMs,
          pid: process.pid
        });
        
        this.activeLocks.set(lock.id, lock);
        return lock;
        
      } catch (error) {
        if (error instanceof LockConflictError && attempt < mergedOptions.maxRetries - 1) {
          // Wait and retry
          await sleep(mergedOptions.retryDelayMs);
          continue;
        }
        
        // If we've exhausted retries, throw timeout error
        if (attempt === mergedOptions.maxRetries - 1) {
          throw new LockTimeoutError(operation, mergedOptions.timeoutMs);
        }
        
        throw error;
      }
    }
    
    throw new LockTimeoutError(operation, mergedOptions.timeoutMs);
  }

  /**
   * Acquire a shared lock for read operations
   * Multiple shared locks can be held simultaneously
   * Shared locks cannot coexist with exclusive locks
   */
  async acquireSharedLock(operation: string, options: LockOptions = {}): Promise<Lock> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    for (let attempt = 0; attempt < mergedOptions.maxRetries; attempt++) {
      try {
        // Clean up stale locks first
        await cleanupStaleLocks(this.lockFilePath);
        
        // Check for existing locks
        const existingLock = await readLockFile(this.lockFilePath);
        
        if (existingLock) {
          // Check if lock is expired or from dead process
          if (isLockExpired(existingLock) || !isProcessRunning(existingLock.pid)) {
            await removeLockFile(this.lockFilePath);
          } else if (existingLock.type === 'exclusive') {
            // Exclusive lock exists - cannot acquire shared lock
            throw new LockConflictError(operation, existingLock);
          }
          // If existing lock is shared, we can proceed to acquire another shared lock
        }
        
        // For shared locks, we use a different approach:
        // We create a lock file with shared type, but we accept that multiple
        // processes might have shared locks. The key is preventing exclusive locks.
        const lock = await writeLockFile(this.lockFilePath, {
          type: 'shared',
          operation,
          acquiredAt: new Date(),
          timeoutMs: mergedOptions.timeoutMs,
          pid: process.pid
        });
        
        this.activeLocks.set(lock.id, lock);
        return lock;
        
      } catch (error) {
        if (error instanceof LockConflictError && attempt < mergedOptions.maxRetries - 1) {
          // Wait and retry
          await sleep(mergedOptions.retryDelayMs);
          continue;
        }
        
        // If we've exhausted retries, throw timeout error
        if (attempt === mergedOptions.maxRetries - 1) {
          throw new LockTimeoutError(operation, mergedOptions.timeoutMs);
        }
        
        throw error;
      }
    }
    
    throw new LockTimeoutError(operation, mergedOptions.timeoutMs);
  }

  /**
   * Release a lock
   */
  async releaseLock(lock: Lock): Promise<void> {
    try {
      // Verify the lock belongs to this process
      if (lock.pid !== process.pid) {
        throw new LockError(`Cannot release lock owned by different process (PID: ${lock.pid})`, 'INVALID_OWNER');
      }
      
      // Check if we have this lock active
      if (!this.activeLocks.has(lock.id)) {
        throw new LockError(`Lock ${lock.id} is not active in this manager`, 'LOCK_NOT_ACTIVE');
      }
      
      // Read current lock file to verify it's still ours
      const currentLock = await readLockFile(this.lockFilePath);
      
      if (currentLock && currentLock.id === lock.id) {
        await removeLockFile(this.lockFilePath);
      }
      
      // Remove from active locks
      this.activeLocks.delete(lock.id);
      
    } catch (error) {
      throw new LockError(`Failed to release lock: ${(error as Error).message}`, 'RELEASE_FAILED');
    }
  }

  /**
   * Check if a lock has timed out
   */
  private checkLockTimeout(lock: Lock): boolean {
    return isLockExpired(lock);
  }

  /**
   * Get all active locks managed by this instance
   */
  getActiveLocks(): Lock[] {
    return Array.from(this.activeLocks.values());
  }

  /**
   * Clean up all active locks on process exit
   */
  async cleanup(): Promise<void> {
    const locks = Array.from(this.activeLocks.values());
    
    for (const lock of locks) {
      try {
        await this.releaseLock(lock);
      } catch (error) {
        // Log error but continue cleanup
        console.error(`Failed to release lock ${lock.id}: ${(error as Error).message}`);
      }
    }
  }
}
