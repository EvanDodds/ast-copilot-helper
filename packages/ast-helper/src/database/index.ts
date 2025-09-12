/**
 * Database module index
 * Exports all database-related functionality
 */

export { ASTDatabaseManager } from './manager.js';
export { DatabaseConfigurationManager } from './config.js';
export { DatabaseVersionManager, CURRENT_SCHEMA_VERSION, MIN_TOOL_VERSION } from './version.js';
export { WorkspaceDetector, type WorkspaceInfo, type WorkspaceDetectorOptions } from './workspace.js';
// TODO: Add other database modules as they are implemented
export * from './types.js';