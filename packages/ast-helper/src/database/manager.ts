/**
 * AST Database Manager
 * Manages the .astdb directory structure creation and validation
 */

import { join, resolve } from 'node:path';
import { DatabaseErrors } from '../errors/index.js';
import { FileSystemManager } from '../filesystem/manager.js';
import { createLogger } from '../logging/index.js';
import type {
    DatabaseSize,
    DatabaseStructure,
    InitOptions,
    ValidationResult
} from './types.js';

/**
 * AST Database Manager class
 * Handles creation, validation, and management of .astdb directory structure
 */
export class ASTDatabaseManager {
    private fs: FileSystemManager;
    private logger = createLogger();
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = resolve(workspacePath);
        this.fs = new FileSystemManager();
    }

    /**
     * Get the path to the .astdb directory
     */
    get astdbPath(): string {
        return join(this.workspacePath, '.astdb');
    }

    /**
     * Get the complete database directory structure paths
     */
    getDatabaseStructure(): DatabaseStructure {
        const root = this.astdbPath;

        return {
            root,
            asts: join(root, 'asts'),
            annots: join(root, 'annots'),
            grammars: join(root, 'grammars'),
            models: join(root, 'models'),
            native: join(root, 'native'),
            indexBin: join(root, 'index.bin'),
            indexMeta: join(root, 'index.meta.json'),
            config: join(root, 'config.json'),
            version: join(root, 'version.json'),
            lock: join(root, '.lock')
        };
    }

    /**
     * Check if the database is already initialized
     */
    async isInitialized(): Promise<boolean> {
        const structure = this.getDatabaseStructure();

        try {
            // Check if root directory exists
            const rootExists = await this.fs.exists(structure.root);
            if (!rootExists) return false;

            // Check if essential files exist
            const configExists = await this.fs.exists(structure.config);
            const versionExists = await this.fs.exists(structure.version);

            return configExists && versionExists;
        } catch (error) {
            this.logger.debug('Error checking database initialization status', {
                error: (error as Error).message,
                workspace: this.workspacePath
            });
            return false;
        }
    }

    /**
     * Create the complete database directory structure
     */
    async createDirectoryStructure(options: InitOptions = {}): Promise<void> {
        const { verbose = false, dryRun = false } = options;
        const structure = this.getDatabaseStructure();

        if (verbose) {
            console.log(`Creating AST database structure in: ${structure.root}`);
        }

        // Validate disk space availability
        await this.validateDiskSpace(structure.root);

        // Create directories in order
        const directories = [
            { path: structure.root, name: '.astdb' },
            { path: structure.asts, name: 'asts' },
            { path: structure.annots, name: 'annots' },
            { path: structure.grammars, name: 'grammars' },
            { path: structure.models, name: 'models' },
            { path: structure.native, name: 'native' }
        ];

        for (const dir of directories) {
            if (verbose) {
                console.log(`  Creating directory: ${dir.name}`);
            }

            if (!dryRun) {
                try {
                    // Create directory with appropriate permissions (755 on Unix)
                    await this.fs.ensureDirectory(dir.path, 0o755);

                    // Set permissions explicitly on Unix systems
                    if (process.platform !== 'win32') {
                        await this.fs.setFilePermissions(dir.path, 0o755);
                    }

                    this.logger.debug('Created directory', {
                        path: dir.path,
                        name: dir.name
                    });
                } catch (error) {
                    const message = `Failed to create directory ${dir.name}`;
                    this.logger.error(message, {
                        path: dir.path,
                        error: (error as Error).message
                    });
                    throw DatabaseErrors.directoryCreationFailed(dir.path, error as Error);
                }
            }
        }

        if (verbose) {
            console.log('✅ Directory structure created successfully');
        }
    }

    /**
     * Validate database structure integrity
     */
    async validateDatabaseStructure(): Promise<ValidationResult> {
        const structure = this.getDatabaseStructure();
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            missingDirectories: [],
            missingFiles: []
        };

        // Check required directories
        const requiredDirs = [
            { path: structure.root, name: '.astdb' },
            { path: structure.asts, name: 'asts' },
            { path: structure.annots, name: 'annots' },
            { path: structure.grammars, name: 'grammars' },
            { path: structure.models, name: 'models' },
            { path: structure.native, name: 'native' }
        ];

        for (const dir of requiredDirs) {
            const exists = await this.fs.exists(dir.path);
            if (!exists) {
                result.isValid = false;
                result.missingDirectories.push(dir.path);
                result.errors.push(`Missing required directory: ${dir.name}`);
            }
        }

        // Check essential configuration files
        const requiredFiles = [
            { path: structure.config, name: 'config.json' },
            { path: structure.version, name: 'version.json' }
        ];

        for (const file of requiredFiles) {
            const exists = await this.fs.exists(file.path);
            if (!exists) {
                result.isValid = false;
                result.missingFiles.push(file.path);
                result.errors.push(`Missing required file: ${file.name}`);
            }
        }

        // Check directory permissions on Unix systems
        if (process.platform !== 'win32') {
            try {
                const rootStats = await this.fs.getFileStats(structure.root);
                const expectedMode = 0o755;
                const actualMode = rootStats.mode & parseInt('777', 8); // Extract permission bits

                if (actualMode !== expectedMode) {
                    result.warnings.push(`Directory permissions may be incorrect. Expected: ${expectedMode.toString(8)}, Got: ${actualMode.toString(8)}`);
                }
            } catch (error) {
                result.warnings.push('Could not verify directory permissions');
            }
        }

        return result;
    }

    /**
     * Calculate total database size
     */
    async getDatabaseSize(): Promise<DatabaseSize> {
        const structure = this.getDatabaseStructure();
        const size: DatabaseSize = {
            totalBytes: 0,
            breakdown: {
                asts: 0,
                annots: 0,
                grammars: 0,
                models: 0,
                native: 0,
                index: 0,
                other: 0
            },
            fileCount: 0
        };

        if (!await this.fs.exists(structure.root)) {
            return size;
        }

        // Calculate size for each directory
        const directories = [
            { path: structure.asts, key: 'asts' as keyof typeof size.breakdown },
            { path: structure.annots, key: 'annots' as keyof typeof size.breakdown },
            { path: structure.grammars, key: 'grammars' as keyof typeof size.breakdown },
            { path: structure.models, key: 'models' as keyof typeof size.breakdown },
            { path: structure.native, key: 'native' as keyof typeof size.breakdown }
        ];

        for (const dir of directories) {
            if (await this.fs.exists(dir.path)) {
                const dirSize = await this.calculateDirectorySize(dir.path);
                size.breakdown[dir.key] = dirSize.bytes;
                size.fileCount += dirSize.fileCount;
                size.totalBytes += dirSize.bytes;
            }
        }

        // Calculate index files size
        const indexFiles = [structure.indexBin, structure.indexMeta];
        for (const file of indexFiles) {
            if (await this.fs.exists(file)) {
                const stats = await this.fs.getFileStats(file);
                size.breakdown.index += stats.size;
                size.fileCount++;
                size.totalBytes += stats.size;
            }
        }

        // Calculate other files (config, version, lock)
        const otherFiles = [structure.config, structure.version, structure.lock];
        for (const file of otherFiles) {
            if (await this.fs.exists(file)) {
                const stats = await this.fs.getFileStats(file);
                size.breakdown.other += stats.size;
                size.fileCount++;
                size.totalBytes += stats.size;
            }
        }

        return size;
    }

    /**
     * Clean up temporary files and optimize database
     */
    async cleanupTemporaryFiles(): Promise<void> {
        const structure = this.getDatabaseStructure();

        // Find and remove temporary files
        const tempPatterns = ['.tmp', '.temp', '.bak', '.swp'];

        for (const pattern of tempPatterns) {
            try {
                const files = await this.fs.listFiles(structure.root, {
                    recursive: true,
                    filter: (path) => path.endsWith(pattern)
                });

                for (const file of files) {
                    const fullPath = join(structure.root, file);
                    await this.fs.removeDirectory(fullPath);
                    this.logger.debug('Removed temporary file', { path: fullPath });
                }
            } catch (error) {
                this.logger.warn('Error cleaning temporary files', {
                    pattern,
                    error: (error as Error).message
                });
            }
        }
    }

    /**
     * Backup database to specified path
     */
    async backupDatabase(backupPath: string): Promise<void> {
        const structure = this.getDatabaseStructure();

        if (!await this.fs.exists(structure.root)) {
            throw DatabaseErrors.notInitialized(this.workspacePath);
        }

        // Ensure backup directory exists
        await this.fs.ensureDirectory(backupPath);

        // Copy all database files
        const files = await this.fs.listFiles(structure.root, { recursive: true });

        for (const file of files) {
            const sourcePath = join(structure.root, file);
            const destPath = join(backupPath, file);

            await this.fs.ensureDirectory(resolve(destPath, '..'));
            await this.fs.copyFile(sourcePath, destPath, { overwrite: true });
        }

        this.logger.info('Database backup completed', {
            source: structure.root,
            destination: backupPath
        });
    }

    /**
     * Ensure a specific subdirectory exists within the database
     */
    async ensureDirectoryExists(subPath: string): Promise<string> {
        const fullPath = join(this.astdbPath, subPath);
        await this.fs.ensureDirectory(fullPath);
        return fullPath;
    }

    /**
     * Validate available disk space before operations
     */
    private async validateDiskSpace(targetPath: string): Promise<void> {
        // Note: Node.js doesn't have built-in disk space checking
        // This is a placeholder for validation logic that could be implemented
        // using platform-specific tools or third-party libraries

        try {
            // Try to write a small test file to check write permissions
            const testPath = join(targetPath, '..', '.astdb-init-test');
            await this.fs.atomicWriteFile(testPath, 'test', { ensureDir: false });
            await this.fs.removeDirectory(testPath);
        } catch (error) {
            throw DatabaseErrors.insufficientSpace(targetPath, 'Unable to write to target directory');
        }
    }

    /**
     * Calculate size of a directory recursively
     */
    private async calculateDirectorySize(dirPath: string): Promise<{ bytes: number; fileCount: number }> {
        let totalBytes = 0;
        let fileCount = 0;

        try {
            const files = await this.fs.listFiles(dirPath, { recursive: true });

            for (const file of files) {
                try {
                    const stats = await this.fs.getFileStats(join(dirPath, file));
                    if (stats.isFile) {
                        totalBytes += stats.size;
                        fileCount++;
                    }
                } catch (error) {
                    // Skip files we can't access
                    this.logger.debug('Could not get stats for file', {
                        file: join(dirPath, file),
                        error: (error as Error).message
                    });
                }
            }
        } catch (error) {
            this.logger.warn('Error calculating directory size', {
                dir: dirPath,
                error: (error as Error).message
            });
        }

        return { bytes: totalBytes, fileCount };
    }
}