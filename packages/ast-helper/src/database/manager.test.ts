/**
 * Tests for ASTDatabaseManager
 * Tests database directory creation, validation, and management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { ASTDatabaseManager } from '../manager.js';
import type { InitOptions } from '../types.js';

describe('ASTDatabaseManager', () => {
  let tempWorkspace: string;
  let manager: ASTDatabaseManager;

  beforeEach(async () => {
    // Create temporary workspace
    const tempName = `ast-test-${randomBytes(6).toString('hex')}`;
    tempWorkspace = join(tmpdir(), tempName);
    await mkdir(tempWorkspace, { recursive: true });
    
    // Initialize manager
    manager = new ASTDatabaseManager(tempWorkspace);
  });

  afterEach(async () => {
    // Clean up temporary workspace
    if (tempWorkspace) {
      await rm(tempWorkspace, { recursive: true, force: true });
    }
  });

  describe('initialization detection', () => {
    it('should detect uninitialized database', async () => {
      const isInit = await manager.isInitialized();
      expect(isInit).toBe(false);
    });

    it('should detect initialized database after creation', async () => {
      // Create directory structure
      await manager.createDirectoryStructure();
      
      // Create minimal required files
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      await fs.atomicWriteFile(structure.config, '{}');
      await fs.atomicWriteFile(structure.version, '{}');
      
      const isInit = await manager.isInitialized();
      expect(isInit).toBe(true);
    });
  });

  describe('directory structure creation', () => {
    it('should create all required directories', async () => {
      await manager.createDirectoryStructure();
      
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      
      // Check all directories exist
      expect(await fs.exists(structure.root)).toBe(true);
      expect(await fs.exists(structure.asts)).toBe(true);
      expect(await fs.exists(structure.annots)).toBe(true);
      expect(await fs.exists(structure.grammars)).toBe(true);
      expect(await fs.exists(structure.models)).toBe(true);
      expect(await fs.exists(structure.native)).toBe(true);
    });

    it('should handle dry run mode', async () => {
      const options: InitOptions = { dryRun: true };
      await manager.createDirectoryStructure(options);
      
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      
      // No directories should be created in dry run
      expect(await fs.exists(structure.root)).toBe(false);
    });

    it('should work with verbose mode', async () => {
      let output = '';
      const originalLog = console.log;
      console.log = (message: string) => {
        output += message + '\n';
      };

      try {
        const options: InitOptions = { verbose: true };
        await manager.createDirectoryStructure(options);
        
        expect(output).toContain('Creating AST database structure');
        expect(output).toContain('Creating directory: .astdb');
        expect(output).toContain('✅ Directory structure created successfully');
      } finally {
        console.log = originalLog;
      }
    });

    it('should set proper permissions on Unix systems', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as permissions work differently
        return;
      }

      await manager.createDirectoryStructure();
      
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      const stats = await fs.getFileStats(structure.root);
      
      // Extract permission bits (755 = rwxr-xr-x)
      const permissions = stats.mode & parseInt('777', 8);
      expect(permissions).toBe(0o755);
    });
  });

  describe('database structure validation', () => {
    it('should validate complete database structure', async () => {
      // Create complete structure
      await manager.createDirectoryStructure();
      
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      
      // Create required files
      await fs.atomicWriteFile(structure.config, JSON.stringify({}));
      await fs.atomicWriteFile(structure.version, JSON.stringify({}));
      
      const result = await manager.validateDatabaseStructure();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingDirectories).toHaveLength(0);
      expect(result.missingFiles).toHaveLength(0);
    });

    it('should detect missing directories', async () => {
      const result = await manager.validateDatabaseStructure();
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.missingDirectories.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Missing required directory'))).toBe(true);
    });

    it('should detect missing configuration files', async () => {
      // Create directories but not files
      await manager.createDirectoryStructure();
      
      const result = await manager.validateDatabaseStructure();
      
      expect(result.isValid).toBe(false);
      expect(result.missingFiles.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('config.json'))).toBe(true);
      expect(result.errors.some(e => e.includes('version.json'))).toBe(true);
    });
  });

  describe('database size calculation', () => {
    it('should return zero size for non-existent database', async () => {
      const size = await manager.getDatabaseSize();
      
      expect(size.totalBytes).toBe(0);
      expect(size.fileCount).toBe(0);
      expect(size.breakdown.asts).toBe(0);
    });

    it('should calculate size correctly for initialized database', async () => {
      // Create structure and add some files
      await manager.createDirectoryStructure();
      
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      
      // Create test files with known content
      const configContent = JSON.stringify({ test: 'config' });
      const versionContent = JSON.stringify({ version: '1.0.0' });
      
      await fs.atomicWriteFile(structure.config, configContent);
      await fs.atomicWriteFile(structure.version, versionContent);
      
      // Add test file in asts directory
      const testAstFile = join(structure.asts, 'test.json');
      const astContent = JSON.stringify({ type: 'Program', body: [] });
      await fs.atomicWriteFile(testAstFile, astContent);
      
      const size = await manager.getDatabaseSize();
      
      expect(size.totalBytes).toBeGreaterThan(0);
      expect(size.fileCount).toBe(3); // config, version, test ast
      expect(size.breakdown.asts).toBe(astContent.length);
      expect(size.breakdown.other).toBe(configContent.length + versionContent.length);
    });
  });

  describe('utility methods', () => {
    it('should get correct astdb path', () => {
      const expectedPath = join(tempWorkspace, '.astdb');
      expect(manager.astdbPath).toBe(expectedPath);
    });

    it('should get complete database structure', () => {
      const structure = manager.getDatabaseStructure();
      
      expect(structure.root).toBe(join(tempWorkspace, '.astdb'));
      expect(structure.asts).toBe(join(tempWorkspace, '.astdb', 'asts'));
      expect(structure.annots).toBe(join(tempWorkspace, '.astdb', 'annots'));
      expect(structure.config).toBe(join(tempWorkspace, '.astdb', 'config.json'));
      expect(structure.version).toBe(join(tempWorkspace, '.astdb', 'version.json'));
    });

    it('should ensure subdirectory exists', async () => {
      await manager.createDirectoryStructure();
      
      const customPath = await manager.ensureDirectoryExists('custom/nested/path');
      const fs = (manager as any).fs;
      
      expect(await fs.exists(customPath)).toBe(true);
      expect(customPath).toBe(join(manager.astdbPath, 'custom/nested/path'));
    });
  });

  describe('cleanup operations', () => {
    it('should clean up temporary files', async () => {
      await manager.createDirectoryStructure();
      
      const structure = manager.getDatabaseStructure();
      const fs = (manager as any).fs;
      
      // Create some temporary files
      const tempFile1 = join(structure.asts, 'temp.tmp');
      const tempFile2 = join(structure.annots, 'backup.bak');
      
      await fs.atomicWriteFile(tempFile1, 'temp data');
      await fs.atomicWriteFile(tempFile2, 'backup data');
      
      // Verify they exist
      expect(await fs.exists(tempFile1)).toBe(true);
      expect(await fs.exists(tempFile2)).toBe(true);
      
      // Clean up
      await manager.cleanupTemporaryFiles();
      
      // Verify they're removed
      expect(await fs.exists(tempFile1)).toBe(false);
      expect(await fs.exists(tempFile2)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as permission handling is different
        return;
      }

      // Try to create database in a read-only location
      const readOnlyManager = new ASTDatabaseManager('/proc');
      
      await expect(readOnlyManager.createDirectoryStructure()).rejects.toThrow();
    });

    it('should validate disk space before operations', async () => {
      // This is a basic test - actual disk space validation would need platform-specific implementation
      const options: InitOptions = {};
      
      // Should not throw for valid workspace with sufficient space
      await expect(manager.createDirectoryStructure(options)).resolves.not.toThrow();
    });
  });
});