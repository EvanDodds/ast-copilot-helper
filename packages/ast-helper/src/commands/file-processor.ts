/**
 * File Processing Layer for Parse Command
 * Coordinates AST parsing, output management, and database integration
 */

import { createHash } from 'crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, relative, resolve } from 'node:path';
import { ASTDatabaseManager } from '../database/manager.js';
import { ValidationErrors } from '../errors/index.js';
import { createLogger } from '../logging/index.js';
import type {
    BatchProcessingResult
} from '../parser/batch-processor.js';
import type { ParseResult } from '../parser/types.js';
import type { Config } from '../types.js';
import type { ParseBatchProgress } from './parse-batch-orchestrator.js';
import { ParseBatchOrchestrator } from './parse-batch-orchestrator.js';
import type { ParseOptions } from './parse.js';
import { ParseProgressUpdate, ProgressDisplayOptions, ProgressReporter } from './progress-reporter.js';

/**
 * File metadata with processing information
 */
export interface ProcessingFileMetadata {
    path: string;
    size: number;
    mtime: Date;
    hash: string;
    language: string;
    extension: string;
    relativePath: string;
}

/**
 * Processing result for individual files
 */
export interface FileProcessingResult {
    filePath: string;
    success: boolean;
    parseResult?: ParseResult;
    outputPath?: string;
    error?: string;
    processingTime: number;
    nodeCount: number;
}

/**
 * Aggregated processing results
 */
export interface ProcessingResults {
    totalFiles: number;
    successful: number;
    failed: number;
    skipped: number;
    totalTimeMs: number;
    totalNodes: number;
    totalLines: number;
    results: FileProcessingResult[];
    errors: string[];
    memoryStats: {
        peakUsageMB: number;
        avgUsageMB: number;
        gcRuns: number;
    };
}

/**
 * Processing progress callback interface
 */
export interface ProcessingProgressCallback {
    (progress: {
        completed: number;
        total: number;
        currentFile: string;
        rate: number;
        estimatedTimeRemaining: number;
        memoryUsageMB: number;
    }): void;
}

/**
 * File processor that coordinates AST parsing and output management
 */
export class FileProcessor {
    private logger = createLogger();
    private batchOrchestrator: ParseBatchOrchestrator;
    private outputManager: ASTOutputManager;

    private constructor(batchOrchestrator: ParseBatchOrchestrator, outputManager: ASTOutputManager) {
        this.batchOrchestrator = batchOrchestrator;
        this.outputManager = outputManager;
    }

    /**
     * Create a new FileProcessor instance
     */
    static async create(config: Config): Promise<FileProcessor> {
        // Create orchestrator and output manager
        const batchOrchestrator = await ParseBatchOrchestrator.create();
        const outputManager = new ASTOutputManager(config);

        return new FileProcessor(batchOrchestrator, outputManager);
    }

    /**
     * Process a list of files and generate AST outputs
     */
    async processFiles(
        filePaths: string[],
        options: ParseOptions,
        config: Config,
        onProgress?: ProcessingProgressCallback,
        progressReporterOptions?: Partial<ProgressDisplayOptions>
    ): Promise<ProcessingResults> {
        const startTime = Date.now();
        let progressReporter: ProgressReporter | undefined;

        try {
            this.logger.info('Starting file processing', {
                totalFiles: filePaths.length,
                batchSize: options.batchSize,
                outputDir: config.outputDir
            });

            // Step 1: Setup progress reporting (if enabled)
            if (progressReporterOptions) {
                progressReporter = new ProgressReporter(this.logger, progressReporterOptions);
                progressReporter.start(filePaths.length);
            }

            // Step 2: Prepare file metadata
            const fileMetadata = await this.prepareFileMetadata(filePaths, config);

            // Step 3: Initialize output directory
            await this.outputManager.initializeOutputDirectory();

            // Step 4: Create enhanced progress callback
            let finalProgressCallback: ProcessingProgressCallback | undefined = onProgress;

            if (progressReporter) {
                // Create a callback that handles both reporter and original callback
                finalProgressCallback = (progress) => {
                    // Convert ProcessingProgressCallback to ParseProgressUpdate format
                    const progressUpdate: ParseProgressUpdate = {
                        completed: progress.completed,
                        total: progress.total,
                        currentFile: progress.currentFile,
                        rate: progress.rate,
                        estimatedTimeRemaining: progress.estimatedTimeRemaining,
                        memoryUsageMB: progress.memoryUsageMB,
                        phase: 'parsing', // Default phase for basic progress
                        errorCount: 0 // Will be updated by detailed progress
                    };
                    progressReporter!.update(progressUpdate);

                    // Also call the original callback if provided
                    if (onProgress) {
                        onProgress(progress);
                    }
                };
            }

            // Step 5: Process files in batches
            const results = await this.processBatches(
                fileMetadata,
                null, // No separate batch options needed
                finalProgressCallback,
                options,
                config
            );

            // Step 6: Complete progress reporting
            progressReporter?.complete();

            // Step 7: Generate final statistics
            const processingResults = this.createProcessingResults(
                results,
                startTime,
                fileMetadata.length
            );

            this.logger.info('File processing completed', {
                totalFiles: processingResults.totalFiles,
                successful: processingResults.successful,
                failed: processingResults.failed,
                totalTimeMs: processingResults.totalTimeMs,
                totalNodes: processingResults.totalNodes
            });

            return processingResults;

        } catch (error) {
            const totalTime = Date.now() - startTime;

            // Cleanup progress reporter if it was created
            progressReporter?.dispose();

            this.logger.error('File processing failed', {
                error: (error as Error).message,
                totalTime,
                totalFiles: filePaths.length
            });
            throw error;
        } finally {
            // Ensure progress reporter is properly disposed
            if (progressReporter) {
                progressReporter.dispose();
            }
        }
    }

    /**
     * Prepare metadata for files to be processed
     */
    private async prepareFileMetadata(
        filePaths: string[],
        config: Config
    ): Promise<ProcessingFileMetadata[]> {
        const metadata: ProcessingFileMetadata[] = [];

        await Promise.all(filePaths.map(async (filePath) => {
            try {
                const stats = await stat(filePath);
                const content = await readFile(filePath, 'utf8');
                const hash = createHash('sha256').update(content).digest('hex');
                const extension = extname(filePath);
                const relativePath = relative(config.outputDir || process.cwd(), filePath);

                // Detect language from extension (simplified)
                const language = this.detectLanguageFromExtension(extension);

                metadata.push({
                    path: filePath,
                    size: stats.size,
                    mtime: stats.mtime,
                    hash,
                    language,
                    extension,
                    relativePath
                });

                this.logger.debug('File metadata prepared', {
                    filePath: relativePath,
                    size: stats.size,
                    language,
                    hash: hash.substring(0, 8)
                });

            } catch (error) {
                this.logger.warn('Failed to prepare metadata for file', {
                    filePath,
                    error: (error as Error).message
                });
            }
        }));

        return metadata;
    }

    /**
     * Detect programming language from file extension
     */
    private detectLanguageFromExtension(extension: string): string {
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'tsx',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
            '.py': 'python',
            '.pyi': 'python',
            '.java': 'java',
            '.c': 'c',
            '.h': 'c',
            '.cpp': 'cpp',
            '.cc': 'cpp',
            '.cxx': 'cpp',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.kts': 'kotlin',
            '.scala': 'scala'
        };

        return languageMap[extension.toLowerCase()] || 'unknown';
    }

    /**
     * Process files in batches using the batch orchestrator
     */
    private async processBatches(
        fileMetadata: ProcessingFileMetadata[],
        _batchOptions: any, // Removed since orchestrator creates its own options
        onProgress?: ProcessingProgressCallback,
        options?: ParseOptions,
        config?: Config
    ): Promise<Map<string, FileProcessingResult>> {
        const results = new Map<string, FileProcessingResult>();
        const filePaths = fileMetadata.map(f => f.path);

        // Create progress callback adapter for orchestrator
        const orchestratorCallback = onProgress ? (progress: ParseBatchProgress) => {
            onProgress({
                completed: progress.completed,
                total: progress.total,
                currentFile: progress.currentFile,
                rate: progress.rate,
                estimatedTimeRemaining: progress.estimatedTimeRemaining,
                memoryUsageMB: progress.memoryUsageMB
            });
        } : undefined;

        try {
            // Use the ParseBatchOrchestrator for enhanced processing
            const batchResult: BatchProcessingResult = await this.batchOrchestrator.processFiles(
                filePaths,
                options || {} as ParseOptions,
                config || {} as Config,
                orchestratorCallback
            );

            // Transform batch results to our format
            for (const [filePath, parseResult] of Array.from(batchResult.results.entries())) {
                const metadata = fileMetadata.find(f => f.path === filePath);
                const processingResult: FileProcessingResult = {
                    filePath,
                    success: parseResult.errors.length === 0, // Success if no errors
                    parseResult,
                    processingTime: parseResult.parseTime || 0,
                    nodeCount: parseResult.nodes.length,
                    error: parseResult.errors.length > 0 && parseResult.errors[0] ? parseResult.errors[0].message : undefined
                };

                // Generate output file if successful
                if (processingResult.success && parseResult && metadata) {
                    try {
                        const outputPath = await this.outputManager.writeASTOutput(
                            parseResult,
                            metadata
                        );
                        processingResult.outputPath = outputPath;

                        this.logger.debug('AST output written', {
                            filePath: metadata.relativePath,
                            outputPath: relative(process.cwd(), outputPath),
                            nodeCount: processingResult.nodeCount
                        });
                    } catch (error) {
                        processingResult.error = `Output write failed: ${(error as Error).message}`;
                        processingResult.success = false;
                    }
                }

                results.set(filePath, processingResult);
            }

            return results;

        } catch (error) {
            this.logger.error('Enhanced batch processing failed', {
                error: (error as Error).message,
                totalFiles: filePaths.length
            });
            throw error;
        }
    }

    /**
     * Create final processing results summary
     */
    private createProcessingResults(
        results: Map<string, FileProcessingResult>,
        startTime: number,
        totalFiles: number
    ): ProcessingResults {
        const resultsArray = Array.from(results.values());
        const successful = resultsArray.filter(r => r.success).length;
        const failed = resultsArray.filter(r => !r.success).length;
        const totalNodes = resultsArray.reduce((sum, r) => sum + r.nodeCount, 0);
        const totalTimeMs = Date.now() - startTime;

        // Extract errors
        const errors = resultsArray
            .filter(r => r.error)
            .map(r => `${relative(process.cwd(), r.filePath)}: ${r.error}`);

        // Calculate memory stats (simplified)
        const memoryUsage = process.memoryUsage();
        const memoryStats = {
            peakUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            avgUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            gcRuns: 0 // Would need gc-stats module for actual GC tracking
        };

        return {
            totalFiles,
            successful,
            failed,
            skipped: totalFiles - resultsArray.length,
            totalTimeMs,
            totalNodes,
            totalLines: 0, // Could be calculated from parse results
            results: resultsArray,
            errors,
            memoryStats
        };
    }

    /**
     * Clean up resources
     */
    async dispose(): Promise<void> {
        await this.batchOrchestrator.dispose();
        this.logger.debug('File processor disposed');
    }
}

/**
 * AST Output Manager handles writing parsed AST data to files
 */
export class ASTOutputManager {
    private logger = createLogger();
    private dbManager: ASTDatabaseManager;
    private outputDir: string;

    constructor(config: Config) {
        this.outputDir = config.outputDir || process.cwd();
        this.dbManager = new ASTDatabaseManager(this.outputDir);
    }

    /**
     * Initialize output directory structure
     */
    async initializeOutputDirectory(): Promise<void> {
        try {
            // Check if database is already initialized
            const isInitialized = await this.dbManager.isInitialized();

            if (!isInitialized) {
                this.logger.info('Initializing AST database structure', {
                    outputDir: this.outputDir
                });

                // Create directory structure
                await this.dbManager.createDirectoryStructure({
                    verbose: false,
                    dryRun: false
                });
            }

            // Validate structure
            const validation = await this.dbManager.validateDatabaseStructure();
            if (!validation.isValid) {
                this.logger.warn('Database structure validation failed', {
                    errors: validation.errors,
                    warnings: validation.warnings
                });
            }

            const structure = this.dbManager.getDatabaseStructure();
            this.logger.debug('Output directory initialized', {
                astdbPath: structure.root,
                astsPath: structure.asts
            });

        } catch (error) {
            this.logger.error('Failed to initialize output directory', {
                outputDir: this.outputDir,
                error: (error as Error).message
            });
            throw ValidationErrors.invalidValue(
                'outputDir',
                this.outputDir,
                `Failed to initialize output directory: ${(error as Error).message}`
            );
        }
    }

    /**
     * Write AST output to file with hash-based naming
     */
    async writeASTOutput(
        parseResult: ParseResult,
        metadata: ProcessingFileMetadata
    ): Promise<string> {
        try {
            const structure = this.dbManager.getDatabaseStructure();

            // Generate hash-based filename
            const contentHash = metadata.hash.substring(0, 12);
            const fileName = `${basename(metadata.path, metadata.extension)}_${contentHash}.json`;
            const outputPath = resolve(structure.asts, fileName);

            // Create AST output data
            const astOutput = {
                metadata: {
                    filePath: metadata.path,
                    relativePath: metadata.relativePath,
                    language: metadata.language,
                    size: metadata.size,
                    mtime: metadata.mtime.toISOString(),
                    hash: metadata.hash,
                    processedAt: new Date().toISOString()
                },
                parseResult: {
                    nodes: parseResult.nodes,
                    errors: parseResult.errors,
                    language: parseResult.language,
                    parseTime: parseResult.parseTime
                },
                statistics: {
                    nodeCount: parseResult.nodes.length,
                    errorCount: parseResult.errors.length,
                    hasErrors: parseResult.errors.length > 0
                }
            };

            // Write to file atomically
            await this.atomicWriteJSON(outputPath, astOutput);

            this.logger.debug('AST output written successfully', {
                inputFile: metadata.relativePath,
                outputFile: relative(this.outputDir, outputPath),
                nodeCount: parseResult.nodes.length,
                fileSize: metadata.size
            });

            return outputPath;

        } catch (error) {
            this.logger.error('Failed to write AST output', {
                filePath: metadata.path,
                error: (error as Error).message
            });
            throw error;
        }
    }

    /**
     * Perform atomic write of JSON data
     */
    private async atomicWriteJSON(filePath: string, data: any): Promise<void> {
        const { writeFile } = await import('node:fs/promises');
        const tempPath = `${filePath}.tmp`;

        try {
            // Write to temporary file first
            await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');

            // Atomic rename to final location
            const { rename } = await import('node:fs/promises');
            await rename(tempPath, filePath);

        } catch (error) {
            // Clean up temporary file on error
            try {
                const { unlink } = await import('node:fs/promises');
                await unlink(tempPath);
            } catch {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    /**
     * Get output statistics
     */
    async getOutputStatistics(): Promise<{
        totalFiles: number;
        totalSize: number;
        oldestFile: Date;
        newestFile: Date;
    }> {
        try {
            const structure = this.dbManager.getDatabaseStructure();
            const { readdir, stat } = await import('node:fs/promises');

            const files = await readdir(structure.asts);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            let totalSize = 0;
            let oldestFile = new Date();
            let newestFile = new Date(0);

            await Promise.all(jsonFiles.map(async (file) => {
                const filePath = resolve(structure.asts, file);
                const stats = await stat(filePath);

                totalSize += stats.size;
                if (stats.mtime < oldestFile) oldestFile = stats.mtime;
                if (stats.mtime > newestFile) newestFile = stats.mtime;
            }));

            return {
                totalFiles: jsonFiles.length,
                totalSize,
                oldestFile,
                newestFile
            };

        } catch (error) {
            this.logger.warn('Failed to get output statistics', {
                error: (error as Error).message
            });

            return {
                totalFiles: 0,
                totalSize: 0,
                oldestFile: new Date(),
                newestFile: new Date()
            };
        }
    }
}