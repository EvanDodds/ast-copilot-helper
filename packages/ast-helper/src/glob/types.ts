/**
 * Glob pattern matching types and interfaces
 * Provides type definitions for advanced glob pattern operations
 */

/**
 * Options for glob pattern matching
 */
export interface GlobOptions {
  /** Whether patterns are case sensitive (defaults to platform default) */
  caseSensitive?: boolean;

  /** Whether to follow symbolic links */
  followSymlinks?: boolean;

  /** Additional patterns to ignore (like .gitignore) */
  ignorePatterns?: string[];

  /** Base directory for relative pattern resolution */
  baseDirectory?: string;

  /** Maximum depth for directory traversal */
  maxDepth?: number;

  /** Whether to include directories in results */
  includeDirs?: boolean;

  /** Whether to include hidden files (starting with .) */
  includeHidden?: boolean;

  /** Custom file system implementation */
  fs?: {
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
  };
}

/**
 * Result of pattern expansion
 */
export interface GlobResult {
  /** Matched file paths */
  files: string[];

  /** Patterns that matched at least one file */
  matchedPatterns: string[];

  /** Patterns that didn't match any files */
  unmatchedPatterns: string[];

  /** Total time taken for expansion (ms) */
  duration: number;

  /** Number of directories scanned */
  directoriesScanned: number;

  /** Number of files examined */
  filesExamined: number;
}

/**
 * Pattern compilation result
 */
export interface CompiledPattern {
  /** Original pattern */
  pattern: string;

  /** Whether this is an exclude pattern (starts with !) */
  isNegated: boolean;

  /** Normalized pattern without negation */
  normalizedPattern: string;

  /** Whether pattern contains directory wildcards (**) */
  isGlobStar: boolean;

  /** Base directory extracted from pattern */
  baseDir: string;

  /** Pattern parts for optimization */
  parts: string[];
}

/**
 * Glob matcher interface
 * Provides advanced glob pattern matching with performance optimization
 */
export interface GlobMatcher {
  /**
   * Test if file path matches any of the given patterns
   * @param patterns - Array of glob patterns (can include negation with !)
   * @param filePath - File path to test
   * @returns True if path matches any positive pattern and no negative patterns
   */
  match(patterns: string[], filePath: string): boolean;

  /**
   * Expand glob patterns to actual file paths
   * @param patterns - Array of glob patterns
   * @param basePath - Base directory for pattern expansion
   * @returns Promise resolving to glob expansion result
   */
  expandPatterns(patterns: string[], basePath?: string): Promise<GlobResult>;

  /**
   * Check if a pattern is syntactically valid
   * @param pattern - Glob pattern to validate
   * @returns True if pattern is valid
   */
  isValidPattern(pattern: string): boolean;

  /**
   * Compile pattern for optimized matching
   * @param pattern - Glob pattern to compile
   * @returns Compiled pattern information
   */
  compilePattern(pattern: string): CompiledPattern;

  /**
   * Test if path matches a single compiled pattern
   * @param compiledPattern - Pre-compiled pattern
   * @param filePath - File path to test
   * @returns True if path matches pattern
   */
  matchPattern(compiledPattern: CompiledPattern, filePath: string): boolean;

  /**
   * Get options used by this matcher
   * @returns Current glob options
   */
  getOptions(): GlobOptions;

  /**
   * Create a new matcher with different options
   * @param options - New options to use
   * @returns New GlobMatcher instance
   */
  withOptions(options: Partial<GlobOptions>): GlobMatcher;
}

/**
 * Performance statistics for glob operations
 */
export interface GlobStats {
  /** Total patterns processed */
  patternsProcessed: number;

  /** Total files matched */
  filesMatched: number;

  /** Total directories scanned */
  directoriesScanned: number;

  /** Total time taken (ms) */
  totalDuration: number;

  /** Average time per pattern (ms) */
  avgTimePerPattern: number;

  /** Cache hit ratio (0-1) */
  cacheHitRatio: number;
}
