/**
 * Database module index
 * Exports all database-related functionality
 */

export { DatabaseConfigurationManager } from './config.js';
export { ASTDatabaseManager } from './manager.js';
export { CURRENT_SCHEMA_VERSION, DatabaseVersionManager, MIN_TOOL_VERSION } from './version.js';
export { WorkspaceDetector, type WorkspaceDetectorOptions, type WorkspaceInfo } from './workspace.js';
// TODO: Add other database modules as they are implemented
export * from './types.js';
