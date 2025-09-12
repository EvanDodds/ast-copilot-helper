/**
 * File system operations manager
 * Provides cross-platform file system utilities with atomic operations
 */

import { 
  access,
  chmod,
  copyFile as fsCopyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
  constants
} from 'node:fs/promises';
import { Stats } from 'node:fs';
import { 
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  resolve
} from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type {
  FileSystemUtils,
  ListOptions,
  FileStats,
  AtomicWriteOptions,
  CopyOptions
} from './types.js';

/**
 * File system manager implementation with cross-platform support
 */
export class FileSystemManager implements FileSystemUtils {
  /**
   * Normalize path separators for current platform
   */
  normalizePath(path: string): string {
    return normalize(path);
  }
  
  /**
   * Resolve path relative to base directory
   */
  resolvePath(path: string, base: string = process.cwd()): string {
    if (isAbsolute(path)) {
      return normalize(path);
    }
    return resolve(base, path);
  }
  
  /**
   * Check if path is absolute
   */
  isAbsolutePath(path: string): boolean {
    return isAbsolute(path);
  }
  
  /**
   * Write file content atomically using temporary file
   */
  async atomicWriteFile(
    filePath: string, 
    content: string | Buffer, 
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    const {
      encoding = 'utf8',
      mode = 0o644,
      ensureDir = true,
      tmpSuffix = '.tmp'
    } = options;
    
    const resolvedPath = this.resolvePath(filePath);
    const dir = dirname(resolvedPath);
    
    // Ensure parent directory exists
    if (ensureDir) {
      await this.ensureDirectory(dir);
    }
    
    // Create unique temporary file path
    const tempPath = await this.createTempFilePath(
      basename(resolvedPath, extname(resolvedPath)) + tmpSuffix,
      extname(resolvedPath),
      dir
    );
    
    try {
      // Write to temporary file
      const writeOptions: any = { mode };
      if (typeof content === 'string') {
        writeOptions.encoding = encoding;
      }
      
      await writeFile(tempPath, content, writeOptions);
      
      // Atomically rename temporary file to target
      await rename(tempPath, resolvedPath);
    } catch (error) {
      // Clean up temporary file on error
      try {
        await rm(tempPath, { force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
  
  /**
   * Ensure directory exists, creating parent directories as needed
   */
  async ensureDirectory(dirPath: string, mode: number = 0o755): Promise<void> {
    try {
      await mkdir(this.resolvePath(dirPath), { recursive: true, mode });
    } catch (error: any) {
      // Check if directory already exists
      if (error.code === 'EEXIST') {
        const stats = await stat(dirPath).catch(() => null);
        if (stats?.isDirectory()) {
          return; // Directory exists, that's fine
        }
      }
      throw error;
    }
  }
  
  /**
   * Copy file from source to destination
   */
  async copyFile(
    source: string, 
    destination: string, 
    options: CopyOptions = {}
  ): Promise<void> {
    const {
      overwrite = false,
      preserveTimestamps = true,
      dereference = false,
      filter
    } = options;
    
    const srcPath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);
    
    // Apply filter if provided
    if (filter && !filter(srcPath, destPath)) {
      return;
    }
    
    // Check if destination exists and overwrite is not allowed
    if (!overwrite) {
      const destExists = await this.exists(destPath);
      if (destExists) {
        throw new Error(`Destination file already exists: ${destPath}`);
      }
    }
    
    // Ensure destination directory exists
    await this.ensureDirectory(dirname(destPath));
    
    // Determine copy flags
    let flags = 0;
    if (!overwrite) {
      flags |= constants.COPYFILE_EXCL;
    }
    if (!dereference) {
      // Note: COPYFILE_FICLONE_FORCE is not available in all Node.js versions
      // We'll use basic copy for cross-platform compatibility
    }
    
    try {
      await fsCopyFile(srcPath, destPath, flags);
      
      // Preserve timestamps if requested
      if (preserveTimestamps) {
        const srcStats = await stat(srcPath);
        await import('node:fs/promises').then(fs => 
          fs.utimes(destPath, srcStats.atime, srcStats.mtime)
        );
      }
    } catch (error: any) {
      if (error.code === 'EEXIST' && overwrite) {
        // Retry with overwrite
        await fsCopyFile(srcPath, destPath);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * List files in directory with optional filtering
   */
  async listFiles(dirPath: string, options: ListOptions = {}): Promise<string[]> {
    const {
      recursive = false,
      includeDirectories = false,
      followSymlinks = false,
      maxDepth = Infinity,
      filter
    } = options;
    
    const results: string[] = [];
    const resolvedPath = this.resolvePath(dirPath);
    
    await this.walkDirectory(
      resolvedPath,
      resolvedPath,
      0,
      maxDepth,
      recursive,
      includeDirectories,
      followSymlinks,
      filter,
      results
    );
    
    return results;
  }
  
  /**
   * Recursive directory walking helper
   */
  private async walkDirectory(
    currentPath: string,
    basePath: string,
    depth: number,
    maxDepth: number,
    recursive: boolean,
    includeDirectories: boolean,
    followSymlinks: boolean,
    filter: ((path: string, stats: Stats) => boolean) | undefined,
    results: string[]
  ): Promise<void> {
    if (depth > maxDepth) return;
    
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = fullPath.substring(basePath.length + 1);
        
        // Handle symbolic links
        let stats: Stats;
        if (entry.isSymbolicLink()) {
          if (!followSymlinks) continue;
          try {
            stats = await stat(fullPath); // Follow symlink
          } catch {
            continue; // Broken symlink
          }
        } else {
          // Get full stats for accurate information
          try {
            stats = await stat(fullPath);
          } catch {
            continue; // Cannot access file
          }
        }
        
        // Apply filter
        if (filter && stats.isFile() && !filter(relativePath, stats)) {
          continue;
        }
        
        // Add to results based on type
        if (stats.isFile()) {
          results.push(relativePath);
        } else if (stats.isDirectory()) {
          if (includeDirectories) {
            // Apply filter for directories too
            if (!filter || filter(relativePath, stats)) {
              results.push(relativePath);
            }
          }
          
          // Recurse into directory (always recurse, filter is applied to individual files)
          if (recursive) {
            await this.walkDirectory(
              fullPath,
              basePath,
              depth + 1,
              maxDepth,
              recursive,
              includeDirectories,
              followSymlinks,
              filter,
              results
            );
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        // Skip directories we don't have permission to read
        return;
      }
      throw error;
    }
  }
  
  /**
   * Remove directory and optionally its contents
   */
  async removeDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    const resolvedPath = this.resolvePath(dirPath);
    
    try {
      await rm(resolvedPath, { 
        recursive, 
        force: true,
        maxRetries: 3,
        retryDelay: 100
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, that's fine
        return;
      }
      throw error;
    }
  }
  
  /**
   * Set file permissions
   */
  async setFilePermissions(filePath: string, mode: number): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      await chmod(resolvedPath, mode);
    } catch (error: any) {
      // On Windows, chmod might not work as expected
      if (process.platform === 'win32' && error.code === 'EPERM') {
        // Windows doesn't support Unix-style permissions
        // Just ignore the error for cross-platform compatibility
        return;
      }
      throw error;
    }
  }
  
  /**
   * Get file statistics
   */
  async getFileStats(filePath: string): Promise<FileStats> {
    const resolvedPath = this.resolvePath(filePath);
    const stats = await stat(resolvedPath);
    
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: stats.isSymbolicLink(),
      modifiedTime: stats.mtime,
      createdTime: stats.birthtime || stats.ctime,
      mode: stats.mode,
      uid: stats.uid,
      gid: stats.gid
    };
  }
  
  /**
   * Check if file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await access(this.resolvePath(path));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get temporary directory path
   */
  getTempDir(): string {
    return tmpdir();
  }
  
  /**
   * Create unique temporary file path
   */
  async createTempFilePath(
    prefix: string = 'tmp',
    suffix: string = '',
    dir: string = this.getTempDir()
  ): Promise<string> {
    const randomSuffix = randomBytes(6).toString('hex');
    const fileName = `${prefix}-${randomSuffix}${suffix}`;
    return join(dir, fileName);
  }
}