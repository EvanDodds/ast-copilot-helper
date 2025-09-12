/**
 * Tests for file locking system
 * Covers lock acquisition, release, conflict detection, and timeout handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, rmdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { LockManager } from '../src/locking/manager.js';
import { LockTimeoutError, LockConflictError } from '../src/locking/types.js';
import {
  generateLockId,
  createLockContent,
  parseLockContent,
  isProcessRunning,
  isLockExpired,
  readLockFile,
  writeLockFile,
  removeLockFile,
  cleanupStaleLocks
} from '../src/locking/utils.js';
import type { Lock } from '../src/locking/types.js';

describe('File Locking System', () => {
  let testWorkspace: string;
  let lockManager: LockManager;

  beforeEach(async () => {
    // Create unique test workspace
    testWorkspace = join(tmpdir(), `ast-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await mkdir(testWorkspace, { recursive: true });
    
    lockManager = new LockManager(testWorkspace, { 
      timeoutMs: 5000, 
      maxRetries: 3,
      retryDelayMs: 50
    });
  });

  afterEach(async () => {
    try {
      await lockManager.cleanup();
      
      // Clean up test workspace
      await rmdir(testWorkspace, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Lock Utilities', () => {
    it('should generate unique lock IDs', () => {
      const id1 = generateLockId();
      const id2 = generateLockId();
      
      expect(id1).toMatch(/^[a-f0-9]{16}$/);
      expect(id2).toMatch(/^[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('should create and parse lock content', () => {
      const lock = {
        type: 'exclusive' as const,
        filePath: '/test/.astdb/.lock',
        operation: 'test-operation',
        acquiredAt: new Date(),
        timeoutMs: 30000,
        pid: process.pid
      };

      const content = createLockContent(lock);
      const jsonParsed = JSON.parse(content);
      expect(jsonParsed.type).toBe('exclusive');
      expect(jsonParsed.operation).toBe('test-operation');

      const parsed = parseLockContent(content);
      expect(parsed.type).toBe('exclusive');
      expect(parsed.operation).toBe('test-operation');
      expect(parsed.pid).toBe(process.pid);
    });

    it('should check if current process is running', () => {
      const isRunning = isProcessRunning(process.pid);
      expect(isRunning).toBe(true);
    });

    it('should detect non-existent process', () => {
      // Use a PID that's very unlikely to exist
      const isRunning = isProcessRunning(999999);
      expect(isRunning).toBe(false);
    });

    it('should detect expired locks', () => {
      const expiredLock: Lock = {
        id: 'test-lock',
        type: 'exclusive',
        filePath: '/test/.astdb/.lock',
        operation: 'test',
        acquiredAt: new Date(Date.now() - 60000), // 1 minute ago
        timeoutMs: 30000, // 30 seconds timeout
        pid: process.pid
      };

      expect(isLockExpired(expiredLock)).toBe(true);
    });

    it('should detect non-expired locks', () => {
      const activeLock: Lock = {
        id: 'test-lock',
        type: 'exclusive',
        filePath: '/test/.astdb/.lock',
        operation: 'test',
        acquiredAt: new Date(), // Just acquired
        timeoutMs: 30000, // 30 seconds timeout
        pid: process.pid
      };

      expect(isLockExpired(activeLock)).toBe(false);
    });
  });

  describe('Lock File Operations', () => {
    it('should write and read lock files', async () => {
      const lockFilePath = join(testWorkspace, '.astdb', '.lock');
      const lockData = {
        type: 'exclusive' as const,
        operation: 'test-write',
        acquiredAt: new Date(),
        timeoutMs: 30000,
        pid: process.pid
      };

      const writtenLock = await writeLockFile(lockFilePath, lockData);
      expect(writtenLock.id).toBeDefined();
      expect(writtenLock.type).toBe('exclusive');
      expect(writtenLock.operation).toBe('test-write');

      const readLock = await readLockFile(lockFilePath);
      expect(readLock).not.toBeNull();
      expect(readLock!.id).toBe(writtenLock.id);
      expect(readLock!.operation).toBe('test-write');
    });

    it('should return null when reading non-existent lock file', async () => {
      const lockFilePath = join(testWorkspace, '.astdb', '.lock');
      const lock = await readLockFile(lockFilePath);
      expect(lock).toBeNull();
    });

    it('should remove lock files', async () => {
      const lockFilePath = join(testWorkspace, '.astdb', '.lock');
      const lockData = {
        type: 'exclusive' as const,
        operation: 'test-remove',
        acquiredAt: new Date(),
        timeoutMs: 30000,
        pid: process.pid
      };

      await writeLockFile(lockFilePath, lockData);
      await removeLockFile(lockFilePath);
      
      const lock = await readLockFile(lockFilePath);
      expect(lock).toBeNull();
    });
  });

  describe('LockManager - Exclusive Locks', () => {
    it('should acquire exclusive lock successfully', async () => {
      const lock = await lockManager.acquireExclusiveLock('test-operation');
      
      expect(lock).toBeDefined();
      expect(lock.type).toBe('exclusive');
      expect(lock.operation).toBe('test-operation');
      expect(typeof lock.pid).toBe('number');
      expect(lock.pid).toBeGreaterThan(0);
      
      const activeLocks = lockManager.getActiveLocks();
      expect(activeLocks).toHaveLength(1);
      expect(activeLocks[0].id).toBe(lock.id);
    });

    it('should release exclusive lock successfully', async () => {
      const lock = await lockManager.acquireExclusiveLock('test-operation');
      await lockManager.releaseLock(lock);
      
      const activeLocks = lockManager.getActiveLocks();
      expect(activeLocks).toHaveLength(0);
      
      // Should be able to acquire again
      const lock2 = await lockManager.acquireExclusiveLock('test-operation-2');
      expect(lock2).toBeDefined();
    });

    it('should prevent multiple exclusive locks', async () => {
      const lock1 = await lockManager.acquireExclusiveLock('test-operation-1');
      expect(lock1).toBeDefined();
      
      // Create another lock manager to simulate different process
      const lockManager2 = new LockManager(testWorkspace, { timeoutMs: 1000, maxRetries: 2 });
      
      await expect(lockManager2.acquireExclusiveLock('test-operation-2'))
        .rejects.toThrow(LockTimeoutError);
    });
  });

  describe('LockManager - Shared Locks', () => {
    it('should acquire shared lock successfully', async () => {
      const lock = await lockManager.acquireSharedLock('test-read-operation');
      
      expect(lock).toBeDefined();
      expect(lock.type).toBe('shared');
      expect(lock.operation).toBe('test-read-operation');
      expect(typeof lock.pid).toBe('number');
      expect(lock.pid).toBeGreaterThan(0);
    });

    it('should allow multiple shared locks', async () => {
      const lock1 = await lockManager.acquireSharedLock('test-read-1');
      expect(lock1).toBeDefined();
      
      // This should work because both are shared locks
      const lockManager2 = new LockManager(testWorkspace);
      const lock2 = await lockManager2.acquireSharedLock('test-read-2');
      expect(lock2).toBeDefined();
    });

    it('should prevent shared lock when exclusive lock exists', async () => {
      const exclusiveLock = await lockManager.acquireExclusiveLock('test-write');
      expect(exclusiveLock).toBeDefined();
      
      const lockManager2 = new LockManager(testWorkspace, { timeoutMs: 1000, maxRetries: 2 });
      
      await expect(lockManager2.acquireSharedLock('test-read'))
        .rejects.toThrow(LockTimeoutError);
    });
  });

  describe('Lock Cleanup and Error Handling', () => {
    it('should clean up stale locks from dead processes', async () => {
      const lockFilePath = join(testWorkspace, '.astdb', '.lock');
      
      // Create a lock with a fake PID (very unlikely to exist)
      const staleLock = {
        type: 'exclusive' as const,
        operation: 'stale-operation',
        acquiredAt: new Date(),
        timeoutMs: 30000,
        pid: 999999 // Fake PID
      };
      
      await writeLockFile(lockFilePath, staleLock);
      
      // Should be able to acquire lock after cleanup
      const newLock = await lockManager.acquireExclusiveLock('new-operation');
      expect(newLock).toBeDefined();
    });

    it('should clean up expired locks', async () => {
      const lockFilePath = join(testWorkspace, '.astdb', '.lock');
      
      // Create an expired lock
      const expiredLock = {
        type: 'exclusive' as const,
        operation: 'expired-operation',
        acquiredAt: new Date(Date.now() - 60000), // 1 minute ago
        timeoutMs: 30000, // 30 seconds timeout (expired)
        pid: process.pid
      };
      
      await writeLockFile(lockFilePath, expiredLock);
      
      // Should be able to acquire lock after cleanup
      const newLock = await lockManager.acquireExclusiveLock('new-operation');
      expect(newLock).toBeDefined();
    });

    it('should handle lock file directory creation', async () => {
      // Use a workspace path that doesn't exist
      const newWorkspace = join(testWorkspace, 'deep', 'nested', 'path');
      const newLockManager = new LockManager(newWorkspace);
      
      const lock = await newLockManager.acquireExclusiveLock('test-deep-path');
      expect(lock).toBeDefined();
      
      // Verify the directory was created
      const lockDir = join(newWorkspace, '.astdb');
      await expect(stat(lockDir)).resolves.toBeDefined();
    });

    it('should cleanup all locks on manager cleanup', async () => {
      const lock1 = await lockManager.acquireExclusiveLock('test-1');
      await lockManager.releaseLock(lock1);
      
      const lock2 = await lockManager.acquireSharedLock('test-2');
      
      expect(lockManager.getActiveLocks()).toHaveLength(1);
      
      await lockManager.cleanup();
      
      expect(lockManager.getActiveLocks()).toHaveLength(0);
    });
  });
});
