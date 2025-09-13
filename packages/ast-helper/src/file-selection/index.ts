/**
 * File Selection Engine
 * Implements file selection strategies for glob patterns and configuration-based selection
 */

import { resolve, relative, extname } from 'node:path';
import { stat } from 'node:fs/promises';
import type { Config } from '../types.js';
import { GlobManager } from '../glob/index.js';
import { createLogger } from '../logging/index.js';
import { ValidationErrors } from '../errors/index.js';
import type { FileSelectionResult, ParseOptions } from '../commands/parse.js';

// Import Git integration
import { GitFileSelector } from '../git-integration/index.js';

/**
 * Supported file extensions and MIME types
 */
const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx',           // TypeScript
  '.js', '.jsx',           // JavaScript  
  '.mjs', '.cjs',          // ES modules / CommonJS
  '.py', '.pyi',           // Python
  '.java',                 // Java
  '.c', '.h',              // C
  '.cpp', '.cc', '.cxx', '.hpp', // C++
  '.cs',                   // C#
  '.go',                   // Go
  '.rs',                   // Rust
  '.rb',                   // Ruby
  '.php',                  // PHP
  '.swift',                // Swift
  '.kt', '.kts',           // Kotlin
  '.scala',                // Scala
]);

/**
 * File patterns to ignore by default
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.git/**',
  '.astdb/**',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/*.d.ts',            // TypeScript declaration files (usually generated)
  '**/vendor/**',         // Common vendor directory
  '**/lib/**',            // Common compiled library directory
  '**/deps/**',           // Common dependencies directory
  '**/__pycache__/**',    // Python bytecode
  '**/*.pyc',
  '**/*.pyo',
  '**/target/**',         // Rust/Java build output
  '**/bin/**',            // Binary directories
  '**/obj/**',            // Object files
];

/**
 * File filtering and selection options
 */
export interface FileFilterOptions {
  includeHidden: boolean;
  followSymlinks: boolean;
  maxFileSize: number;           // in bytes
  maxDepth: number;
  customIgnorePatterns: string[];
  customSupportedExtensions: string[];
}

/**
 * File metadata for selection decisions
 */
export interface FileMetadata {
  path: string;
  size: number;
  mtime: Date;
  extension: string;
  isSymbolicLink: boolean;
  relativePath: string;
}

/**
 * File selection strategy interface
 */
export interface FileSelector {
  selectFiles(options: ParseOptions, config: Config): Promise<FileSelectionResult>;
  getName(): string;
}

/**
 * Glob pattern-based file selector
 */
export class GlobFileSelector implements FileSelector {
  private globManager: GlobManager;
  private logger = createLogger();

  constructor(filterOptions?: Partial<FileFilterOptions>) {
    this.globManager = new GlobManager({
      caseSensitive: process.platform !== 'win32',
      followSymlinks: filterOptions?.followSymlinks ?? false,
      includeHidden: filterOptions?.includeHidden ?? false,
      maxDepth: filterOptions?.maxDepth ?? 50
    });
  }

  getName(): string {
    return 'glob';
  }

  async selectFiles(options: ParseOptions, _config: Config): Promise<FileSelectionResult> {
    const startTime = Date.now();
    
    try {
      if (!options.glob) {
        throw ValidationErrors.invalidValue('glob pattern', 'undefined', 'Glob pattern is required for glob-based file selection');
      }

      const workspacePath = resolve(options.workspace || process.cwd());
      const patterns = this.buildGlobPatterns(options.glob);
      
      this.logger.debug('Starting glob file selection', {
        patterns,
        workspacePath,
        strategy: 'glob'
      });

      // Expand glob patterns to find matching files
      const globResult = await this.globManager.expandPatterns(patterns, workspacePath);
      
      // Convert to full paths and get metadata
      const candidateFiles = globResult.files.map(file => resolve(workspacePath, file));
      const filesWithMetadata = await this.getFileMetadata(candidateFiles);
      
      // Apply filtering
      const { files, skipped, errors } = await this.filterFiles(filesWithMetadata);
      
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      const result: FileSelectionResult = {
        files: files.map(f => f.path),
        skipped: skipped.map(f => f.path),
        errors,
        totalSize,
        strategy: 'glob'
      };

      this.logger.info('Glob file selection completed', {
        duration: Date.now() - startTime,
        totalFiles: result.files.length,
        skippedFiles: result.skipped.length,
        errors: result.errors.length,
        patterns,
        directoriesScanned: globResult.directoriesScanned
      });

      return result;

    } catch (error) {
      this.logger.error('Glob file selection failed', {
        error: (error as Error).message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Build complete glob patterns including ignore patterns
   */
  private buildGlobPatterns(globPattern: string): string[] {
    const patterns = [globPattern];
    
    // Add ignore patterns as negations
    const ignorePatterns = DEFAULT_IGNORE_PATTERNS.map(pattern => `!${pattern}`);
    patterns.push(...ignorePatterns);
    
    return patterns;
  }

  /**
   * Get metadata for all candidate files
   */
  private async getFileMetadata(filePaths: string[]): Promise<FileMetadata[]> {
    const metadata: FileMetadata[] = [];
    
    await Promise.all(filePaths.map(async (filePath) => {
      try {
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          metadata.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime,
            extension: extname(filePath),
            isSymbolicLink: stats.isSymbolicLink(),
            relativePath: relative(process.cwd(), filePath)
          });
        }
      } catch (error) {
        // File doesn't exist or can't be accessed - will be handled in filtering
      }
    }));
    
    return metadata;
  }

  /**
   * Filter files based on support and size criteria
   */
  private async filterFiles(filesMetadata: FileMetadata[]): Promise<{
    files: FileMetadata[];
    skipped: FileMetadata[];
    errors: string[];
  }> {
    const files: FileMetadata[] = [];
    const skipped: FileMetadata[] = [];
    const errors: string[] = [];
    
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    
    for (const fileMetadata of filesMetadata) {
      try {
        // Check if file extension is supported
        if (!SUPPORTED_EXTENSIONS.has(fileMetadata.extension)) {
          skipped.push(fileMetadata);
          continue;
        }
        
        // Check file size limits
        if (fileMetadata.size > maxFileSize) {
          errors.push(`${fileMetadata.relativePath}: File too large (${this.formatBytes(fileMetadata.size)} > 10MB)`);
          continue;
        }
        
        // File passes all filters
        files.push(fileMetadata);
        
      } catch (error) {
        errors.push(`${fileMetadata.relativePath}: ${(error as Error).message}`);
      }
    }
    
    return { files, skipped, errors };
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * Configuration-based file selector
 */
export class ConfigFileSelector implements FileSelector {
  private globManager: GlobManager;
  private logger = createLogger();

  constructor(filterOptions?: Partial<FileFilterOptions>) {
    this.globManager = new GlobManager({
      caseSensitive: process.platform !== 'win32', 
      followSymlinks: filterOptions?.followSymlinks ?? false,
      includeHidden: filterOptions?.includeHidden ?? false,
      maxDepth: filterOptions?.maxDepth ?? 50
    });
  }

  getName(): string {
    return 'config';
  }

  async selectFiles(options: ParseOptions, config: Config): Promise<FileSelectionResult> {
    const startTime = Date.now();
    
    try {
      const workspacePath = resolve(options.workspace || process.cwd());
      const patterns = this.buildConfigPatterns(config);
      
      if (patterns.length === 0) {
        throw ValidationErrors.invalidValue(
          'parseGlob', 
          'empty array', 
          'No parseGlob patterns configured. Add patterns to your config file or use --glob option.'
        );
      }

      this.logger.debug('Starting config-based file selection', {
        patterns,
        workspacePath,
        strategy: 'config'
      });

      // Use glob manager to find files based on configured patterns
      const allPatterns = this.combinePatterns(patterns);
      const globResult = await this.globManager.expandPatterns(allPatterns, workspacePath);
      
      // Convert to full paths and get metadata
      const candidateFiles = globResult.files.map(file => resolve(workspacePath, file));
      const filesWithMetadata = await this.getFileMetadata(candidateFiles);
      
      // Apply filtering
      const { files, skipped, errors } = await this.filterFiles(filesWithMetadata);
      
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      const result: FileSelectionResult = {
        files: files.map(f => f.path),
        skipped: skipped.map(f => f.path),
        errors,
        totalSize,
        strategy: 'config'
      };

      this.logger.info('Config-based file selection completed', {
        duration: Date.now() - startTime,
        totalFiles: result.files.length,
        skippedFiles: result.skipped.length,
        errors: result.errors.length,
        configPatterns: patterns,
        directoriesScanned: globResult.directoriesScanned
      });

      return result;

    } catch (error) {
      this.logger.error('Config-based file selection failed', {
        error: (error as Error).message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Build patterns from configuration
   */
  private buildConfigPatterns(config: Config): string[] {
    return config.parseGlob || [];
  }

  /**
   * Combine positive patterns with ignore patterns
   */
  private combinePatterns(configPatterns: string[]): string[] {
    const patterns = [...configPatterns];
    
    // Add ignore patterns as negations
    const ignorePatterns = DEFAULT_IGNORE_PATTERNS.map(pattern => `!${pattern}`);
    patterns.push(...ignorePatterns);
    
    return patterns;
  }

  /**
   * Get metadata for all candidate files (shared implementation)
   */
  private async getFileMetadata(filePaths: string[]): Promise<FileMetadata[]> {
    const metadata: FileMetadata[] = [];
    
    await Promise.all(filePaths.map(async (filePath) => {
      try {
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          metadata.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime,
            extension: extname(filePath),
            isSymbolicLink: stats.isSymbolicLink(),
            relativePath: relative(process.cwd(), filePath)
          });
        }
      } catch (error) {
        // File doesn't exist or can't be accessed - will be handled in filtering
      }
    }));
    
    return metadata;
  }

  /**
   * Filter files based on support and size criteria (shared implementation)
   */
  private async filterFiles(filesMetadata: FileMetadata[]): Promise<{
    files: FileMetadata[];
    skipped: FileMetadata[];
    errors: string[];
  }> {
    const files: FileMetadata[] = [];
    const skipped: FileMetadata[] = [];
    const errors: string[] = [];
    
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    
    for (const fileMetadata of filesMetadata) {
      try {
        // Check if file extension is supported
        if (!SUPPORTED_EXTENSIONS.has(fileMetadata.extension)) {
          skipped.push(fileMetadata);
          continue;
        }
        
        // Check file size limits
        if (fileMetadata.size > maxFileSize) {
          errors.push(`${fileMetadata.relativePath}: File too large (${this.formatBytes(fileMetadata.size)} > 10MB)`);
          continue;
        }
        
        // File passes all filters
        files.push(fileMetadata);
        
      } catch (error) {
        errors.push(`${fileMetadata.relativePath}: ${(error as Error).message}`);
      }
    }
    
    return { files, skipped, errors };
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * Main file selection engine that coordinates different selection strategies
 */
export class FileSelectionEngine {
  private logger = createLogger();
  private selectors: Map<string, FileSelector> = new Map();

  constructor() {
    // Register available file selectors
    this.selectors.set('glob', new GlobFileSelector());
    this.selectors.set('config', new ConfigFileSelector());
    this.selectors.set('git', new GitFileSelector());
  }

  /**
   * Select files based on the appropriate strategy from options
   */
  async selectFiles(options: ParseOptions, config: Config): Promise<FileSelectionResult> {
    const strategy = this.determineStrategy(options);
    const selector = this.selectors.get(strategy);
    
    if (!selector) {
      throw ValidationErrors.invalidValue('file selection strategy', strategy, 'Unknown file selection strategy');
    }

    this.logger.debug('Starting file selection', {
      strategy,
      selectorName: selector.getName()
    });

    try {
      const result = await selector.selectFiles(options, config);
      
      this.logger.info('File selection completed', {
        strategy: result.strategy,
        totalFiles: result.files.length,
        skippedFiles: result.skipped.length,
        errors: result.errors.length,
        totalSize: result.totalSize
      });

      return result;
    } catch (error) {
      this.logger.error('File selection failed', {
        strategy,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Determine which selection strategy to use based on options
   */
  private determineStrategy(options: ParseOptions): string {
    // Git-based selection takes priority
    if (options.changed || options.staged) {
      return 'git';
    } else if (options.glob) {
      return 'glob';
    } else {
      return 'config';  // Default to configuration-based selection
    }
  }

  /**
   * Get available selection strategies
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.selectors.keys());
  }

  /**
   * Register a custom file selector
   */
  registerSelector(name: string, selector: FileSelector): void {
    this.selectors.set(name, selector);
    this.logger.debug('Registered custom file selector', { name });
  }
}