/**
 * Git Integration Layer for Parse Command
 * Implements Git-based file selection with support for --changed, --staged, and --base options
 */

import { stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import type { FileSelectionResult, ParseOptions } from '../commands/parse.js';
import { ValidationErrors } from '../errors/index.js';
import { GitManager } from '../git/index.js';
import type { ChangedFilesOptions } from '../git/types.js';
import { createLogger } from '../logging/index.js';
import type { Config } from '../types.js';

/**
 * Supported file extensions for parsing (same as file-selection engine)
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
 * Git file metadata for selection decisions
 */
export interface GitFileMetadata {
    path: string;
    size: number;
    mtime: Date;
    extension: string;
    relativePath: string;
    gitStatus: 'modified' | 'added' | 'renamed' | 'copied' | 'type-changed' | 'staged';
}

/**
 * Git repository validator
 */
export class GitRepositoryValidator {
    private gitManager: GitManager;
    private logger = createLogger();

    constructor(workspaceDir?: string) {
        this.gitManager = new GitManager(workspaceDir);
    }

    /**
     * Validate that we're in a git repository and can perform git operations
     */
    async validateRepository(workspaceDir: string): Promise<void> {
        try {
            const isRepo = await this.gitManager.isGitRepository(workspaceDir);

            if (!isRepo) {
                throw ValidationErrors.invalidValue(
                    'workspace',
                    workspaceDir,
                    'Not a Git repository. Initialize git with "git init" or run from within a Git repository to use --changed/--staged flags.'
                );
            }

            this.logger.debug('Git repository validated', {
                workspace: workspaceDir,
                repositoryRoot: await this.gitManager.getRepositoryRoot(workspaceDir)
            });

        } catch (error) {
            this.logger.error('Git repository validation failed', {
                workspace: workspaceDir,
                error: (error as Error).message
            });
            throw error;
        }
    }

    /**
     * Validate git reference exists and is accessible
     */
    async validateGitReference(ref: string, workspaceDir: string): Promise<void> {
        try {
            const isValid = await this.gitManager.validateGitReference(ref, workspaceDir);

            if (!isValid) {
                throw ValidationErrors.invalidValue(
                    '--base',
                    ref,
                    `Git reference "${ref}" does not exist. Use a valid branch name, tag, or commit SHA. Examples: HEAD, main, origin/main, abc123, v1.0.0`
                );
            }

            this.logger.debug('Git reference validated', {
                reference: ref,
                workspace: workspaceDir
            });

        } catch (error) {
            this.logger.error('Git reference validation failed', {
                reference: ref,
                workspace: workspaceDir,
                error: (error as Error).message
            });
            throw error;
        }
    }

    /**
     * Get git manager for further operations
     */
    getGitManager(): GitManager {
        return this.gitManager;
    }
}

/**
 * Git-based file selector implementing the FileSelector interface
 */
export class GitFileSelector {
    private gitValidator: GitRepositoryValidator;
    private logger = createLogger();

    constructor() {
        this.gitValidator = new GitRepositoryValidator();
    }

    getName(): string {
        return 'git';
    }

    /**
     * Select files based on Git changes (--changed, --staged, --base options)
     */
    async selectFiles(options: ParseOptions, config: Config): Promise<FileSelectionResult> {
        const startTime = Date.now();

        try {
            const workspaceDir = resolve(options.workspace || process.cwd());

            this.logger.debug('Starting Git-based file selection', {
                workspace: workspaceDir,
                changed: options.changed,
                staged: options.staged,
                base: options.base
            });

            // Step 1: Validate Git repository and reference
            await this.gitValidator.validateRepository(workspaceDir);

            if (options.base && options.base !== 'HEAD') {
                await this.gitValidator.validateGitReference(options.base, workspaceDir);
            }

            // Step 2: Get changed files from Git
            const gitFiles = await this.getGitChangedFiles(options, workspaceDir);

            // Step 3: Convert to full paths and get metadata
            const repositoryRoot = await this.gitValidator.getGitManager().getRepositoryRoot(workspaceDir);
            const candidateFiles = gitFiles.map(file => resolve(repositoryRoot, file));

            const filesWithMetadata = await this.getFileMetadata(candidateFiles, repositoryRoot);

            // Step 4: Apply filtering
            const { files, skipped, errors } = await this.filterFiles(filesWithMetadata, config);

            const totalSize = files.reduce((sum, file) => sum + file.size, 0);

            const result: FileSelectionResult = {
                files: files.map(f => f.path),
                skipped: skipped.map(f => f.path),
                errors,
                totalSize,
                strategy: 'changed'
            };

            this.logger.info('Git-based file selection completed', {
                duration: Date.now() - startTime,
                totalFiles: result.files.length,
                skippedFiles: result.skipped.length,
                errors: result.errors.length,
                gitFiles: gitFiles.length,
                repository: repositoryRoot
            });

            return result;

        } catch (error) {
            this.logger.error('Git-based file selection failed', {
                error: (error as Error).message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Get changed files from Git based on parse options
     */
    private async getGitChangedFiles(options: ParseOptions, workspaceDir: string): Promise<string[]> {
        const gitManager = this.gitValidator.getGitManager();

        const gitOptions: ChangedFilesOptions = {
            cwd: workspaceDir,
            base: options.base || 'HEAD',
            staged: options.staged || false,
            includeUntracked: true, // Include new files that might not be staged yet
            filterTypes: ['A', 'C', 'M', 'R', 'T'] // All change types
        };

        if (options.staged && !options.changed) {
            // Only get staged files
            return await gitManager.getStagedFiles(workspaceDir);
        } else {
            // Get changed files with options
            return await gitManager.getChangedFiles(gitOptions);
        }
    }

    /**
     * Get metadata for Git files including git status information
     */
    private async getFileMetadata(filePaths: string[], repositoryRoot: string): Promise<GitFileMetadata[]> {
        const metadata: GitFileMetadata[] = [];

        await Promise.all(filePaths.map(async (filePath) => {
            try {
                const stats = await stat(filePath);

                if (stats.isFile()) {
                    // Determine git status (simplified for now)
                    const gitStatus = await this.determineGitStatus(filePath, repositoryRoot);

                    const relativePath = relative(repositoryRoot, filePath);

                    this.logger.debug('Processing file metadata', {
                        filePath,
                        relativePath,
                        extension: extname(filePath),
                        size: stats.size
                    });

                    metadata.push({
                        path: filePath,
                        size: stats.size,
                        mtime: stats.mtime,
                        extension: extname(filePath),
                        relativePath: relativePath.replace(/\\/g, '/'), // Normalize path separators
                        gitStatus
                    });
                }
            } catch (error) {
                // File doesn't exist or can't be accessed - will be handled in filtering
                this.logger.debug('Could not get metadata for file', {
                    filePath,
                    error: (error as Error).message
                });
            }
        }));

        return metadata;
    }

    /**
     * Determine Git status for a file (simplified implementation)
     */
    private async determineGitStatus(_filePath: string, repositoryRoot: string): Promise<GitFileMetadata['gitStatus']> {
        try {
            const gitManager = this.gitValidator.getGitManager();
            const status = await gitManager.getStatus(repositoryRoot);

            // For now, return a default status - this could be enhanced to check actual file status
            return status.hasStaged ? 'staged' : 'modified';
        } catch (error) {
            return 'modified'; // Default fallback
        }
    }

    /**
     * Filter Git files based on support and configuration criteria
     */
    private async filterFiles(
        filesMetadata: GitFileMetadata[],
        config: Config
    ): Promise<{
        files: GitFileMetadata[];
        skipped: GitFileMetadata[];
        errors: string[];
    }> {
        const files: GitFileMetadata[] = [];
        const skipped: GitFileMetadata[] = [];
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

                // Apply any config-based filtering
                if (config.parseGlob && config.parseGlob.length > 0) {
                    // Check if file matches any of the configured patterns
                    const matchesConfig = this.matchesConfigPatterns(fileMetadata.relativePath, config.parseGlob);
                    if (!matchesConfig) {
                        skipped.push(fileMetadata);
                        continue;
                    }
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
     * Check if file matches any of the configuration patterns (simplified)
     */
    private matchesConfigPatterns(relativePath: string, patterns: string[]): boolean {
        // Simple pattern matching - in production, would use the GlobManager
        for (const pattern of patterns) {
            if (pattern.includes('**')) {
                // Handle globstar patterns like **/*.ts
                const regexPattern = pattern
                    .replace(/\*\*/g, '.*')
                    .replace(/\*/g, '[^/]*')
                    .replace(/\./g, '\\.');

                if (new RegExp(`^${regexPattern}$`).test(relativePath)) {
                    return true;
                }
            } else if (pattern.includes('*')) {
                // Handle simple glob patterns like src/*.ts
                const regexPattern = pattern
                    .replace(/\*/g, '[^/]*')
                    .replace(/\./g, '\\.');

                if (new RegExp(`^${regexPattern}$`).test(relativePath)) {
                    return true;
                }
            } else {
                // Exact match
                if (relativePath === pattern) {
                    return true;
                }
            }
        }

        return false;
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
 * Enhanced Git utilities for parse command
 */
export class ParseGitUtils {
    private gitValidator: GitRepositoryValidator;
    private gitFileSelector: GitFileSelector;
    private logger = createLogger();

    constructor(workspaceDir?: string) {
        this.gitValidator = new GitRepositoryValidator(workspaceDir);
        this.gitFileSelector = new GitFileSelector();
    }

    /**
     * Validate git preconditions for parse command
     */
    async validateGitPreconditions(options: ParseOptions): Promise<void> {
        const workspaceDir = resolve(options.workspace || process.cwd());

        // Validate repository
        await this.gitValidator.validateRepository(workspaceDir);

        // Validate base reference if specified
        if (options.base && options.base !== 'HEAD') {
            await this.gitValidator.validateGitReference(options.base, workspaceDir);
        }

        // Validate option combinations
        if (options.staged && !options.changed) {
            throw ValidationErrors.invalidValue(
                '--staged',
                'used without --changed',
                'The --staged option can only be used with --changed to process staged Git changes.'
            );
        }

        this.logger.debug('Git preconditions validated', {
            workspace: workspaceDir,
            changed: options.changed,
            staged: options.staged,
            base: options.base
        });
    }

    /**
     * Get git-based file selection
     */
    async selectFiles(options: ParseOptions, config: Config): Promise<FileSelectionResult> {
        return await this.gitFileSelector.selectFiles(options, config);
    }

    /**
     * Get git repository information for diagnostics
     */
    async getRepositoryInfo(workspaceDir: string): Promise<{
        repositoryRoot: string;
        isRepository: boolean;
        status?: any;
    }> {
        try {
            const gitManager = this.gitValidator.getGitManager();

            const isRepository = await gitManager.isGitRepository(workspaceDir);

            if (!isRepository) {
                return {
                    repositoryRoot: workspaceDir,
                    isRepository: false
                };
            }

            const repositoryRoot = await gitManager.getRepositoryRoot(workspaceDir);
            const status = await gitManager.getStatus(workspaceDir);

            return {
                repositoryRoot,
                isRepository: true,
                status
            };

        } catch (error) {
            this.logger.warn('Could not get repository info', {
                workspace: workspaceDir,
                error: (error as Error).message
            });

            return {
                repositoryRoot: workspaceDir,
                isRepository: false
            };
        }
    }
}