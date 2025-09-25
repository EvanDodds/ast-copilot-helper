/**
 * Git integration module
 * Exports git utilities and types for repository operations and change detection
 */

export { GitManager } from "./manager.js";
export type {
  GitUtils,
  ChangedFilesOptions,
  GitStatus,
  GitCommandResult,
} from "./types.js";
