/**
 * Tests for Workspace Detector
 * Validates workspace root detection and Git integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { WorkspaceDetector, type WorkspaceInfo } from './workspace.js';

// Mock Node.js modules
vi.mock('node:fs/promises');
vi.mock('node:fs');

// Mock internal modules
vi.mock('../filesystem/manager.js');
vi.mock('../git/manager.js');
vi.mock('../logging/index.js');

const mockStat = stat as MockedFunction<typeof stat>;

describe('WorkspaceDetector', () => {
  let workspaceDetector: WorkspaceDetector;
  const testDir = '/test/workspace';

  beforeEach(() => {
    workspaceDetector = new WorkspaceDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectWorkspace', () => {
    beforeEach(() => {
      // Mock directory stats
      mockStat.mockImplementation(async (path) => ({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtime: new Date(),
        ctime: new Date(),
        atime: new Date(),
        mode: 0o755
      } as any));
    });

    it('should detect workspace by Git repository', async () => {
      // Mock successful Git detection
      const mockGitManager = {
        getRepositoryRoot: vi.fn().mockResolvedValue('/test/workspace')
      };
      vi.doMock('../git/manager.js', () => ({
        GitManager: vi.fn(() => mockGitManager)
      }));
      
      // Mock file system operations
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true),
        getFileStats: vi.fn().mockResolvedValue({ size: 1000 }),
        ensureDirectory: vi.fn().mockResolvedValue(undefined),
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));

      // Mock dynamic import for readdir
      const mockReaddir = vi.fn().mockResolvedValue(['package.json', '.git']);
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      const result = await workspaceDetector.detectWorkspace({ 
        startDir: testDir 
      });

      expect(result).toMatchObject({
        root: '/test/workspace',
        isGitRepository: true,
        detectionMethod: 'git'
      });
    });

    it('should detect workspace by package.json', async () => {
      // Mock Git repository not found
      const mockGitManager = {
        getRepositoryRoot: vi.fn().mockRejectedValue(new Error('No git repo'))
      };
      vi.doMock('../git/manager.js', () => ({
        GitManager: vi.fn(() => mockGitManager)
      }));
      
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true),
        getFileStats: vi.fn().mockResolvedValue({ size: 1000 }),
        ensureDirectory: vi.fn().mockResolvedValue(undefined),
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));

      // Mock readdir to return package.json
      const mockReaddir = vi.fn().mockResolvedValue(['package.json', 'src']);
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      const result = await workspaceDetector.detectWorkspace({ 
        startDir: testDir 
      });

      expect(result.detectionMethod).toBe('package-json');
      expect(result.isGitRepository).toBe(false);
    });

    it('should fall back to current directory when allowed', async () => {
      // Mock no Git repository and no project indicators
      const mockGitManager = {
        getRepositoryRoot: vi.fn().mockRejectedValue(new Error('No git repo'))
      };
      vi.doMock('../git/manager.js', () => ({
        GitManager: vi.fn(() => mockGitManager)
      }));
      
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true),
        getFileStats: vi.fn().mockResolvedValue({ size: 1000 }),
        ensureDirectory: vi.fn().mockResolvedValue(undefined),
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));

      // Mock readdir to return empty directory
      const mockReaddir = vi.fn().mockResolvedValue([]);
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      const result = await workspaceDetector.detectWorkspace({ 
        startDir: testDir,
        allowExisting: true
      });

      expect(result.detectionMethod).toBe('current-dir');
      expect(result.root).toBe(testDir);
    });

    it('should throw error when no workspace found and not allowing existing', async () => {
      const mockGitManager = {
        getRepositoryRoot: vi.fn().mockRejectedValue(new Error('No git repo'))
      };
      vi.doMock('../git/manager.js', () => ({
        GitManager: vi.fn(() => mockGitManager)
      }));
      
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(false)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));

      const mockReaddir = vi.fn().mockResolvedValue([]);
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      await expect(workspaceDetector.detectWorkspace({ 
        startDir: testDir,
        allowExisting: false
      })).rejects.toThrow();
    });
  });

  describe('getDefaultDatabasePath', () => {
    it('should return .astdb in workspace root', () => {
      const workspaceRoot = '/test/workspace';
      const result = workspaceDetector.getDefaultDatabasePath(workspaceRoot);
      
      expect(result).toBe('/test/workspace/.astdb');
    });
  });

  describe('validateWorkspaceForDatabase', () => {
    beforeEach(() => {
      const mockFileSystemManager = {
        exists: vi.fn(),
        ensureDirectory: vi.fn(),
        atomicWriteFile: vi.fn(),
        getFileStats: vi.fn()
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
    });

    it('should validate workspace successfully', async () => {
      const workspaceInfo: WorkspaceInfo = {
        root: '/test/workspace',
        isGitRepository: false,
        detectionMethod: 'current-dir',
        relativePath: '',
        isNested: false,
        indicators: []
      };
      
      const mockFileSystemManager = new (await import('../filesystem/manager.js')).FileSystemManager();
      mockFileSystemManager.exists = vi.fn().mockResolvedValue(false);
      mockFileSystemManager.ensureDirectory = vi.fn().mockResolvedValue(undefined);
      mockFileSystemManager.atomicWriteFile = vi.fn().mockResolvedValue(undefined);
      mockFileSystemManager.getFileStats = vi.fn().mockResolvedValue({ size: 1000 });

      // Mock dynamic import for unlink
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        unlink: vi.fn().mockResolvedValue(undefined)
      }));

      await expect(workspaceDetector.validateWorkspaceForDatabase(workspaceInfo))
        .resolves
        .toBeUndefined();
    });

    it('should throw error when database already exists without force', async () => {
      const workspaceInfo: WorkspaceInfo = {
        root: '/test/workspace',
        isGitRepository: false,
        detectionMethod: 'current-dir',
        relativePath: '',
        isNested: false,
        indicators: []
      };
      
      const mockFileSystemManager = new (await import('../filesystem/manager.js')).FileSystemManager();
      mockFileSystemManager.exists = vi.fn().mockResolvedValue(true); // Database exists

      await expect(workspaceDetector.validateWorkspaceForDatabase(workspaceInfo))
        .rejects
        .toThrow('Database already exists');
    });

    it('should allow overwrite with force option', async () => {
      const workspaceInfo: WorkspaceInfo = {
        root: '/test/workspace',
        isGitRepository: false,
        detectionMethod: 'current-dir',
        relativePath: '',
        isNested: false,
        indicators: []
      };
      
      const mockFileSystemManager = new (await import('../filesystem/manager.js')).FileSystemManager();
      mockFileSystemManager.exists = vi.fn().mockResolvedValue(true);
      mockFileSystemManager.ensureDirectory = vi.fn().mockResolvedValue(undefined);
      mockFileSystemManager.atomicWriteFile = vi.fn().mockResolvedValue(undefined);
      mockFileSystemManager.getFileStats = vi.fn().mockResolvedValue({ size: 1000 });

      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        unlink: vi.fn().mockResolvedValue(undefined)
      }));

      await expect(workspaceDetector.validateWorkspaceForDatabase(workspaceInfo, { force: true }))
        .resolves
        .toBeUndefined();
    });
  });

  describe('getWorkspaceSummary', () => {
    it('should return formatted workspace summary', async () => {
      const workspaceInfo: WorkspaceInfo = {
        root: '/test/workspace',
        gitRoot: '/test/workspace',
        isGitRepository: true,
        detectionMethod: 'git',
        relativePath: '',
        isNested: false,
        indicators: ['package.json', '.git', 'README.md']
      };

      const summary = await workspaceDetector.getWorkspaceSummary(workspaceInfo);

      expect(summary).toEqual({
        root: '/test/workspace',
        type: 'git',
        hasGit: true,
        indicators: 'package.json, .git, README.md',
        nested: false
      });
    });
  });

  describe('suggestWorkspaceRoots', () => {
    beforeEach(() => {
      mockStat.mockImplementation(async (path) => ({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtime: new Date(),
        ctime: new Date(),
        atime: new Date(),
        mode: 0o755
      } as any));
    });

    it('should suggest workspace roots based on indicators', async () => {
      const mockReaddir = vi.fn()
        .mockResolvedValueOnce(['src', 'tests']) // Current dir - no indicators
        .mockResolvedValueOnce(['package.json', 'src']) // Parent dir - has indicators
        .mockResolvedValueOnce(['README.md']); // Grandparent dir - has indicators

      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      const suggestions = await workspaceDetector.suggestWorkspaceRoots('/test/workspace/src');

      expect(suggestions).toHaveLength(1); // Current dir is always included
      expect(suggestions[0]).toBe('/test/workspace/src');
    });
  });

  describe('error handling', () => {
    it('should handle invalid starting directory', async () => {
      mockStat.mockRejectedValue({ code: 'ENOENT' });

      await expect(workspaceDetector.detectWorkspace({ 
        startDir: '/nonexistent/path'
      })).rejects.toThrow();
    });

    it('should handle permission denied errors', async () => {
      mockStat.mockRejectedValue({ code: 'EACCES' });

      await expect(workspaceDetector.detectWorkspace({ 
        startDir: '/restricted/path'
      })).rejects.toThrow();
    });

    it('should handle non-directory paths', async () => {
      mockStat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      await expect(workspaceDetector.detectWorkspace({ 
        startDir: '/path/to/file.txt'
      })).rejects.toThrow();
    });
  });

  describe('Git integration', () => {
    it('should handle Git repository root detection', async () => {
      const mockGitManager = {
        getRepositoryRoot: vi.fn().mockResolvedValue('/test/repo')
      };
      vi.doMock('../git/manager.js', () => ({
        GitManager: vi.fn(() => mockGitManager)
      }));

      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true),
        getFileStats: vi.fn().mockResolvedValue({ size: 1000 }),
        ensureDirectory: vi.fn().mockResolvedValue(undefined),
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));

      mockStat.mockResolvedValue({
        isDirectory: () => true
      } as any);

      const mockReaddir = vi.fn().mockResolvedValue(['.git', 'package.json']);
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      const result = await workspaceDetector.detectWorkspace({ 
        startDir: '/test/repo/src'
      });

      expect(result.isGitRepository).toBe(true);
      expect(result.gitRoot).toBe('/test/repo');
      expect(mockGitManager.getRepositoryRoot).toHaveBeenCalledWith('/test/repo/src');
    });

    it('should require Git repository when specified', async () => {
      const mockGitManager = {
        getRepositoryRoot: vi.fn().mockRejectedValue(new Error('No git repo'))
      };
      vi.doMock('../git/manager.js', () => ({
        GitManager: vi.fn(() => mockGitManager)
      }));

      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(false)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));

      mockStat.mockResolvedValue({
        isDirectory: () => true
      } as any);

      const mockReaddir = vi.fn().mockResolvedValue([]);
      vi.doMock('node:fs/promises', async () => ({
        ...(await vi.importActual('node:fs/promises')),
        readdir: mockReaddir
      }));

      await expect(workspaceDetector.detectWorkspace({ 
        startDir: testDir,
        requireGit: true
      })).rejects.toThrow();
    });
  });
});