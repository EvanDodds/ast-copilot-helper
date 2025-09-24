/**
 * Cross-platform file locking utilities
 * Provides file locking functionality that works on Windows, macOS, and Linux
 */

import { readFile, writeFile, mkdir, unlink, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Lock } from './types.js';

/**
 * Generate a unique lock ID
 */
export function generateLockId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Create lock file content with metadata
 */
export function createLockContent(lock: Omit<Lock, 'id'>): string {
  return JSON.stringify({
    id: generateLockId(),
    type: lock.type,
    operation: lock.operation,
    acquiredAt: lock.acquiredAt.toISOString(),
    timeoutMs: lock.timeoutMs,
    pid: lock.pid
  }, null, 2);
}

/**
 * Parse lock file content
 */
export function parseLockContent(content: string): Lock {
  try {
    const data = JSON.parse(content);
    return {
      id: data.id,
      type: data.type,
      filePath: '', // Will be set by caller
      operation: data.operation,
      acquiredAt: new Date(data.acquiredAt),
      timeoutMs: data.timeoutMs,
      pid: data.pid
    };
  } catch (error) {
    throw new Error(`Invalid lock file content: ${(error as Error).message}`);
  }
}

/**
 * Check if a process is still running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // In test environment, check if the process object exists and has the right PID
    if (typeof process !== 'undefined' && process.pid === pid) {
      return true;
    }
    
    // Sending signal 0 checks if process exists without actually sending a signal
    if (typeof process !== 'undefined' && process.kill) {
      process.kill(pid, 0);
      return true;
    }
    
    return false;
  } catch (error) {
    // Process doesn't exist or we don't have permission
    return false;
  }
}

/**
 * Check if a lock has expired
 */
export function isLockExpired(lock: Lock): boolean {
  const now = new Date();
  const expiredAt = new Date(lock.acquiredAt.getTime() + lock.timeoutMs);
  return now > expiredAt;
}

/**
 * Ensure directory exists for lock file
 */
export async function ensureLockDirectory(lockFilePath: string): Promise<void> {
  const dir = dirname(lockFilePath);
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw new Error(`Failed to create lock directory ${dir}: ${(error as Error).message}`);
    }
  }
}

/**
 * Try to read existing lock file
 */
export async function readLockFile(lockFilePath: string): Promise<Lock | null> {
  try {
    const content = await readFile(lockFilePath, 'utf-8');
    const lock = parseLockContent(content);
    lock.filePath = lockFilePath;
    return lock;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw new Error(`Failed to read lock file ${lockFilePath}: ${(error as Error).message}`);
  }
}

/**
 * Write lock file atomically
 */
export async function writeLockFile(lockFilePath: string, lock: Omit<Lock, 'id' | 'filePath'>): Promise<Lock> {
  await ensureLockDirectory(lockFilePath);
  
  const lockWithPath = { ...lock, filePath: lockFilePath };
  const lockContent = createLockContent(lockWithPath);
  const lockData = parseLockContent(lockContent);
  lockData.filePath = lockFilePath;
  
  // Write to temporary file first, then rename for atomicity
  const tempPath = `${lockFilePath}.tmp.${process.pid}`;
  
  try {
    await writeFile(tempPath, lockContent, 'utf-8');
    
    // Try to rename temp file to lock file
    // This is atomic on most filesystems
    try {
      await rename(tempPath, lockFilePath);
    } catch (renameError) {
      // Clean up temp file if rename failed
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw renameError;
    }
    
    return lockData;
  } catch (error) {
    throw new Error(`Failed to write lock file ${lockFilePath}: ${(error as Error).message}`);
  }
}

/**
 * Remove lock file
 */
export async function removeLockFile(lockFilePath: string): Promise<void> {
  try {
    await unlink(lockFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Failed to remove lock file ${lockFilePath}: ${(error as Error).message}`);
    }
  }
}

/**
 * Clean up stale locks (expired or from dead processes)
 */
export async function cleanupStaleLocks(lockFilePath: string): Promise<void> {
  const existingLock = await readLockFile(lockFilePath);
  
  if (!existingLock) {
    return; // No lock file exists
  }
  
  // Check if lock is expired or process is dead
  const isExpired = isLockExpired(existingLock);
  const isProcessDead = !isProcessRunning(existingLock.pid);
  
  if (isExpired || isProcessDead) {
    await removeLockFile(lockFilePath);
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
