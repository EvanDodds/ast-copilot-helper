/**
 * @file Storage Module Index
 * @description Main export file for telemetry storage and queuing system
 */

// Types
export * from "./types.js";

// Database implementation
export { SqliteTelemetryStorage, StorageFactory } from "./database.js";

// Queue implementation
export { SqliteEventQueue, QueueFactory } from "./queue.js";

// Storage manager for coordinating storage and queue operations
export { StorageManager, StorageManagerFactory } from "./manager";

// Import for internal function implementations
import type { StorageManager } from "./manager";
import { StorageManagerFactory } from "./manager";

/**
 * Create a development storage manager
 *
 * @returns Configured storage system for development
 */
export function createDevelopmentStorage(): StorageManager {
  return StorageManagerFactory.createDevelopment();
}

/**
 * Create a production storage manager
 *
 * @param databasePath - Path to database file
 * @returns Configured storage system for production
 */
export function createProductionStorage(
  databasePath = "./telemetry",
): StorageManager {
  return StorageManagerFactory.createProduction(databasePath);
}

/**
 * Create a custom storage manager
 *
 * @param config - Partial storage configuration
 * @returns Configured storage system
 */
export function createCustomStorage(config?: any): StorageManager {
  return StorageManagerFactory.createCustom(config || {});
}
