/**
 * Tests for file system utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemManager } from './manager.js';
import type { ListOptions } from './types.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';

describe('FileSystemManager', () => {
  let tempDir: string;
  let fsManager: FileSystemManager;
  
  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'fs-test-'));
    fsManager = new FileSystemManager();
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('path operations', () => {
    it('should normalize paths', () => {
      expect(fsManager.normalizePath('path/to/../file.txt')).toBe('path\\file.txt');
      expect(fsManager.normalizePath('path//double//slash')).toBe('path\\double\\slash');
    });
    
    it('should resolve paths', () => {
      const result = fsManager.resolvePath('relative/path', tempDir);
      expect(result).toBe(join(tempDir, 'relative/path'));
    });
    
    it('should detect absolute paths', () => {
      expect(fsManager.isAbsolutePath('/absolute/path')).toBe(true);
      expect(fsManager.isAbsolutePath('C:\\absolute\\path')).toBe(true);
      expect(fsManager.isAbsolutePath('relative/path')).toBe(false);
    });
  });
  
  describe('directory operations', () => {
    it('should ensure directory exists', async () => {
      const dirPath = join(tempDir, 'nested', 'directory', 'structure');
      
      await fsManager.ensureDirectory(dirPath);
      
      const exists = await fsManager.exists(dirPath);
      expect(exists).toBe(true);
      
      const stats = await fsManager.getFileStats(dirPath);
      expect(stats.isDirectory).toBe(true);
    });
    
    it('should handle existing directory', async () => {
      const dirPath = join(tempDir, 'existing');
      await mkdir(dirPath);
      
      // Should not throw error
      await fsManager.ensureDirectory(dirPath);
      
      const exists = await fsManager.exists(dirPath);
      expect(exists).toBe(true);
    });
    
    it('should remove directory', async () => {
      const dirPath = join(tempDir, 'to-remove');
      await mkdir(dirPath);
      await writeFile(join(dirPath, 'file.txt'), 'content');
      
      await fsManager.removeDirectory(dirPath, true);
      
      const exists = await fsManager.exists(dirPath);
      expect(exists).toBe(false);
    });
    
    it('should remove non-existent directory without error', async () => {
      const dirPath = join(tempDir, 'non-existent');
      
      // Should not throw error
      await fsManager.removeDirectory(dirPath, true);
    });
  });
  
  describe('file operations', () => {
    it('should write file atomically', async () => {
      const filePath = join(tempDir, 'atomic-test.txt');
      const content = 'test content for atomic write';
      
      await fsManager.atomicWriteFile(filePath, content);
      
      const exists = await fsManager.exists(filePath);
      expect(exists).toBe(true);
      
      const readContent = await readFile(filePath, 'utf8');
      expect(readContent).toBe(content);
    });
    
    it('should write binary file atomically', async () => {
      const filePath = join(tempDir, 'binary-test.bin');
      const content = Buffer.from([1, 2, 3, 4, 5]);
      
      await fsManager.atomicWriteFile(filePath, content);
      
      const readContent = await readFile(filePath);
      expect(Buffer.compare(readContent, content)).toBe(0);
    });
    
    it('should create parent directories for atomic write', async () => {
      const filePath = join(tempDir, 'nested', 'deep', 'file.txt');
      const content = 'test content';
      
      await fsManager.atomicWriteFile(filePath, content, { ensureDir: true });
      
      const exists = await fsManager.exists(filePath);
      expect(exists).toBe(true);
      
      const parentExists = await fsManager.exists(join(tempDir, 'nested', 'deep'));
      expect(parentExists).toBe(true);
    });
    
    it('should copy file', async () => {
      const sourcePath = join(tempDir, 'source.txt');
      const destPath = join(tempDir, 'destination.txt');
      const content = 'file content to copy';
      
      await writeFile(sourcePath, content);
      await fsManager.copyFile(sourcePath, destPath);
      
      const destExists = await fsManager.exists(destPath);
      expect(destExists).toBe(true);
      
      const copiedContent = await readFile(destPath, 'utf8');
      expect(copiedContent).toBe(content);
    });
    
    it('should not overwrite existing file by default', async () => {
      const sourcePath = join(tempDir, 'source.txt');
      const destPath = join(tempDir, 'existing.txt');
      
      await writeFile(sourcePath, 'source content');
      await writeFile(destPath, 'existing content');
      
      await expect(fsManager.copyFile(sourcePath, destPath))
        .rejects.toThrow('Destination file already exists');
    });
    
    it('should overwrite when explicitly allowed', async () => {
      const sourcePath = join(tempDir, 'source.txt');
      const destPath = join(tempDir, 'existing.txt');
      
      await writeFile(sourcePath, 'new content');
      await writeFile(destPath, 'old content');
      
      await fsManager.copyFile(sourcePath, destPath, { overwrite: true });
      
      const content = await readFile(destPath, 'utf8');
      expect(content).toBe('new content');
    });
    
    it('should get file stats', async () => {
      const filePath = join(tempDir, 'stats-test.txt');
      const content = 'test content for stats';
      
      await writeFile(filePath, content);
      
      const stats = await fsManager.getFileStats(filePath);
      expect(stats.isFile).toBe(true);
      expect(stats.isDirectory).toBe(false);
      expect(stats.size).toBe(Buffer.byteLength(content, 'utf8'));
      expect(stats.modifiedTime).toBeInstanceOf(Date);
    });
  });
  
  describe('file listing', () => {
    beforeEach(async () => {
      // Create test directory structure
      await mkdir(join(tempDir, 'subdir1'));
      await mkdir(join(tempDir, 'subdir2'));
      await mkdir(join(tempDir, 'subdir1', 'nested'));
      
      await writeFile(join(tempDir, 'file1.txt'), 'content');
      await writeFile(join(tempDir, 'file2.js'), 'content');
      await writeFile(join(tempDir, 'subdir1', 'file3.txt'), 'content');
      await writeFile(join(tempDir, 'subdir1', 'nested', 'file4.py'), 'content');
    });
    
    it('should list files in directory (non-recursive)', async () => {
      const files = await fsManager.listFiles(tempDir);
      
      expect(files).toHaveLength(2);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.js');
      expect(files).not.toContain('subdir1\\file3.txt');
    });
    
    it('should list files recursively', async () => {
      const options: ListOptions = { recursive: true };
      const files = await fsManager.listFiles(tempDir, options);
      
      expect(files.length).toBeGreaterThan(2);
      expect(files).toContain('file1.txt');
      expect(files).toContain('subdir1\\file3.txt');
      expect(files).toContain('subdir1\\nested\\file4.py');
    });
    
    it('should include directories when requested', async () => {
      const options: ListOptions = { includeDirectories: true };
      const files = await fsManager.listFiles(tempDir, options);
      
      expect(files).toContain('subdir1');
      expect(files).toContain('subdir2');
    });
    
    it('should apply custom filter', async () => {
      const options: ListOptions = {
        recursive: true,
        filter: (path) => path.endsWith('.txt')
      };
      const files = await fsManager.listFiles(tempDir, options);
      
      expect(files).toContain('file1.txt');
      // Note: The path separator might vary based on platform
      const expectedPath = files.find(f => f.includes('subdir1') && f.endsWith('file3.txt'));
      expect(expectedPath).toBeDefined();
      expect(files).not.toContain('file2.js');
    });
    
    it('should respect maxDepth', async () => {
      const options: ListOptions = {
        recursive: true,
        maxDepth: 1
      };
      const files = await fsManager.listFiles(tempDir, options);
      
      expect(files).toContain('file1.txt');
      expect(files).toContain('subdir1\\file3.txt');
      expect(files).not.toContain('subdir1\\nested\\file4.py'); // Too deep
    });
  });
  
  describe('utility methods', () => {
    it('should check if file exists', async () => {
      const filePath = join(tempDir, 'exists-test.txt');
      
      expect(await fsManager.exists(filePath)).toBe(false);
      
      await writeFile(filePath, 'content');
      
      expect(await fsManager.exists(filePath)).toBe(true);
    });
    
    it('should get temp directory', () => {
      const tempPath = fsManager.getTempDir();
      expect(tempPath).toBe(tmpdir());
    });
    
    it('should create unique temp file paths', async () => {
      const path1 = await fsManager.createTempFilePath('test', '.txt', tempDir);
      const path2 = await fsManager.createTempFilePath('test', '.txt', tempDir);
      
      expect(path1).not.toBe(path2);
      expect(path1.startsWith(tempDir)).toBe(true);
      expect(path1.includes('test')).toBe(true);
      expect(path1.endsWith('.txt')).toBe(true);
    });
    
    it('should set file permissions (where supported)', async () => {
      const filePath = join(tempDir, 'permissions-test.txt');
      await writeFile(filePath, 'content');
      
      // On Windows, this might be a no-op, but should not throw
      await expect(fsManager.setFilePermissions(filePath, 0o755))
        .resolves.not.toThrow();
    });
  });
});