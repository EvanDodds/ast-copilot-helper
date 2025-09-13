/**
 * Glob pattern matching module
 * Exports glob utilities and types for advanced pattern matching
 */

export { GlobManager } from './manager.js';
export type { 
  GlobMatcher, 
  GlobOptions, 
  GlobResult,
  CompiledPattern,
  GlobStats
} from './types.js';