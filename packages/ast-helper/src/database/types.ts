/**
 * Database-specific types and interfaces
 * Type definitions for AST database operations
 */

/**
 * Configuration interface for AST database initialization
 * Extends base configuration with database-specific options
 */
export interface ASTDBConfig {
    // Parse configuration
    parseGlob: string[];           // File patterns to parse
    excludeGlob: string[];         // File patterns to exclude

    // Watch configuration  
    watchGlob: string[];           // File patterns to watch
    watchDebounce: number;         // Debounce delay in milliseconds

    // Query configuration
    topK: number;                  // Default number of results
    snippetLines: number;          // Lines of code context

    // Index configuration
    indexParams: {
        efConstruction: number;      // HNSW build quality (16-800)
        M: number;                  // HNSW connectivity (4-64)
        ef: number;                 // HNSW query quality (16-512)
    };

    // Model configuration
    modelName: string;             // Embedding model name
    modelHost: string;             // Model download host
    batchSize: number;             // Embedding batch size

    // Performance configuration
    concurrency: number;           // Parallel processing threads
    maxMemory: number;            // Memory limit in MB

    // Feature flags
    enableTelemetry: boolean;     // Usage analytics
    enableNative: boolean;        // Use native binaries when available

    // Metadata
    version: string;              // Config schema version
    created: string;              // ISO timestamp of creation
    lastUpdated: string;          // ISO timestamp of last update
}

/**
 * Version information for database schema and tool compatibility
 */
export interface VersionInfo {
    schemaVersion: string;        // Database schema version (semver)
    toolVersion: string;         // ast-helper version that created DB
    created: string;             // ISO timestamp
    lastMigrated?: string;       // Last migration timestamp
    compatibility: {             // Compatibility information
        minToolVersion: string;    // Minimum tool version required
        migrations: string[];      // Applied migrations
    };
}

/**
 * Database directory structure definition
 */
export interface DatabaseStructure {
    /** Root .astdb directory path */
    root: string;

    /** AST storage directory */
    asts: string;

    /** Annotations directory */
    annots: string;

    /** Tree-sitter grammars directory */
    grammars: string;

    /** Embedding models directory */
    models: string;

    /** Native binaries directory */
    native: string;

    /** HNSW index file path */
    indexBin: string;

    /** Index metadata file path */
    indexMeta: string;

    /** Configuration file path */
    config: string;

    /** Version file path */
    version: string;

    /** Lock file path */
    lock: string;
}

/**
 * Options for database initialization
 */
export interface InitOptions {
    /** Workspace directory path */
    workspace?: string;

    /** Force overwrite existing database */
    force?: boolean;

    /** Dry run mode - show what would be created */
    dryRun?: boolean;

    /** Verbose mode - detailed progress information */
    verbose?: boolean;
}

/**
 * Workspace type enumeration
 */
export type WorkspaceType = 'npm' | 'git' | 'generic';

/**
 * Workspace detection result
 */
export interface WorkspaceInfo {
    /** Detected workspace root path */
    root: string;

    /** Type of workspace detected */
    type: WorkspaceType;

    /** Whether workspace has .git directory */
    hasGit: boolean;

    /** Whether workspace has package.json */
    hasPackageJson: boolean;

    /** Existing .astdb directory if found */
    existingAstdb?: string;
}

/**
 * Database validation result
 */
export interface ValidationResult {
    /** Whether database structure is valid */
    isValid: boolean;

    /** List of validation errors */
    errors: string[];

    /** List of warnings */
    warnings: string[];

    /** Missing directories */
    missingDirectories: string[];

    /** Missing files */
    missingFiles: string[];
}

/**
 * Database size information
 */
export interface DatabaseSize {
    /** Total size in bytes */
    totalBytes: number;

    /** Size breakdown by directory */
    breakdown: {
        asts: number;
        annots: number;
        grammars: number;
        models: number;
        native: number;
        index: number;
        other: number;
    };

    /** Number of files */
    fileCount: number;
}