import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import compiled modules
import { GitManager } from '../../../dist/git/manager.js';
import { FileSystemManager } from '../../../dist/filesystem/manager.js';
import { GlobManager } from '../../../dist/glob/manager.js';
import { ConfigurationError } from '../../../dist/errors/types.js';
import { withRetry } from '../../../dist/errors/utils.js';

// Mock process.cwd for tests
vi.stubGlobal('process', {
  ...process,
  cwd: vi.fn().mockReturnValue('/test/dir')
});

describe('Integration Tests', () => {
  let testDir: string;
  let gitManager: GitManager;
  let fsManager: FileSystemManager;
  let globManager: GlobManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `ast-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    mkdirSync(testDir, { recursive: true });
    
    gitManager = new GitManager(testDir);
    fsManager = new FileSystemManager(testDir);
    globManager = new GlobManager({ baseDirectory: testDir });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Manager Integration', () => {
    it('should create all manager instances', () => {
      expect(gitManager).toBeInstanceOf(GitManager);
      expect(fsManager).toBeInstanceOf(FileSystemManager);
      expect(globManager).toBeInstanceOf(GlobManager);
    });

    it('should handle basic file operations', async () => {
      const testFile = 'test.txt';
      const testContent = 'Hello, World!';

      await fsManager.atomicWriteFile(testFile, testContent);
      const exists = await fsManager.exists(testFile);
      expect(exists).toBe(true);

      const stats = await fsManager.getFileStats(testFile);
      expect(stats.isFile).toBe(true);
    });

    it('should handle glob operations', async () => {
      // Create some test files
      await fsManager.atomicWriteFile('file1.ts', 'content1');
      await fsManager.atomicWriteFile('file2.js', 'content2');
      await fsManager.atomicWriteFile('file3.txt', 'content3');

      const tsFiles = await globManager.expandPatterns(['*.ts']);
      expect(tsFiles.files.length).toBeGreaterThan(0);
      expect(tsFiles.files.some(f => f.endsWith('file1.ts'))).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should create and handle custom errors', () => {
      const configError = new ConfigurationError('Invalid config', { key: 'test' });
      expect(configError.name).toBe('ConfigurationError');
      expect(configError.code).toBe('CONFIGURATION_ERROR');
      expect(configError.context.key).toBe('test');
    });

    it('should use retry utility', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('timeout occurred');
        }
        return 'success';
      });

      const result = await withRetry(operation, { 
        maxRetries: 3, 
        initialDelay: 10 
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('Git Operations', () => {
    it('should handle non-git directory gracefully', async () => {
      const isGitRepo = await gitManager.isGitRepository();
      expect(isGitRepo).toBe(false);
    });

    it('should handle git operations with proper error handling', async () => {
      try {
        await gitManager.getRepositoryRoot();
        expect.fail('Should have thrown an error for non-git directory');
      } catch (error) {
        // Should throw some kind of error for non-git directory
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});