/**
 * Database module index
 * Exports all database-related functionality
 */

export { DatabaseConfigurationManager } from "./config.js";
export { ASTDatabaseManager } from "./manager.js";
export { EmbeddingDatabaseManager } from "./embedding-manager.js";
export {
  CURRENT_SCHEMA_VERSION,
  DatabaseVersionManager,
  MIN_TOOL_VERSION,
} from "./version.js";
export {
  WorkspaceDetector,
  type WorkspaceDetectorOptions,
  type WorkspaceInfo,
} from "./workspace.js";
export { IntegrityValidator, type IntegrityReport } from "./integrity.js";
export * from "./types.js";

// Vector database exports
export * from "./vector/index.js";
