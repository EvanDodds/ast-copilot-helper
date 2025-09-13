/**
 * File locking module index
 * Exports all locking-related functionality
 */

export { LockManager } from './manager.js';
export type { Lock, LockOptions } from './types.js';
export { LockError, LockTimeoutError, LockConflictError } from './types.js';
export {
  generateLockId,
  createLockContent,
  parseLockContent,
  isProcessRunning,
  isLockExpired,
  readLockFile,
  writeLockFile,
  removeLockFile,
  cleanupStaleLocks
} from './utils.js';
