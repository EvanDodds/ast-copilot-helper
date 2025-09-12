/**
 * Tests for Database Version Manager
 * Validates version tracking, compatibility checking, and migration planning
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { join } from 'node:path';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { DatabaseVersionManager, CURRENT_SCHEMA_VERSION, MIN_TOOL_VERSION } from './version.js';
import type { VersionInfo } from './types.js';

// Mock Node.js modules
vi.mock('node:fs/promises');
vi.mock('node:fs');

// Mock internal modules
vi.mock('../filesystem/manager.js');
vi.mock('../logging/index.js');

const mockReadFile = readFile as MockedFunction<typeof readFile>;
const mockWriteFile = writeFile as MockedFunction<typeof writeFile>;
const mockFs = vi.mocked(require('fs'));

describe('DatabaseVersionManager', () => {
  let versionManager: DatabaseVersionManager;
  const testAstdbPath = '/test/workspace/.astdb';
  const testVersionPath = join(testAstdbPath, 'version.json');

  beforeEach(() => {
    versionManager = new DatabaseVersionManager();
    vi.clearAllMocks();
    
    // Mock fs.existsSync and fs.readFileSync for getToolVersion
    mockFs.existsSync = vi.fn().mockReturnValue(false);
    mockFs.readFileSync = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getToolVersion', () => {
    it('should return version from package.json when available', () => {
      const mockPackageJson = { version: '1.2.3' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockPackageJson));
      
      const version = versionManager.getToolVersion();
      
      expect(version).toBe('1.2.3');
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        'utf8'
      );
    });
    
    it('should fallback to default version when package.json not found', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const version = versionManager.getToolVersion();
      
      expect(version).toBe('0.1.0');
    });
    
    it('should handle invalid JSON gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });
      
      const version = versionManager.getToolVersion();
      
      expect(version).toBe('0.1.0');
    });
  });

  describe('createDefaultVersionInfo', () => {
    it('should create valid version info with current schema and tool versions', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"version": "1.5.0"}');
      
      const versionInfo = versionManager.createDefaultVersionInfo();
      
      expect(versionInfo).toMatchObject({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        toolVersion: '1.5.0',
        compatibility: {
          minToolVersion: MIN_TOOL_VERSION,
          migrations: []
        }
      });
      
      expect(versionInfo.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
    
    it('should use fallback version when tool version unavailable', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const versionInfo = versionManager.createDefaultVersionInfo();
      
      expect(versionInfo.toolVersion).toBe('0.1.0');
    });
  });

  describe('createVersionFile', () => {
    beforeEach(() => {
      // Mock FileSystemManager
      const mockFileSystemManager = {
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
    });

    it('should create version file with default info', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      await versionManager.createVersionFile(testAstdbPath);
      
      // Should call atomicWriteFile through FileSystemManager
      const mockFileSystemManager = new (await import('../filesystem/manager.js')).FileSystemManager();
      expect(mockFileSystemManager.atomicWriteFile).toHaveBeenCalledWith(
        testVersionPath,
        expect.stringContaining(CURRENT_SCHEMA_VERSION),
        { encoding: 'utf8', mode: 0o644 }
      );
    });
    
    it('should respect dry run option', async () => {
      await versionManager.createVersionFile(testAstdbPath, { dryRun: true });
      
      const mockFileSystemManager = new (await import('../filesystem/manager.js')).FileSystemManager();
      expect(mockFileSystemManager.atomicWriteFile).not.toHaveBeenCalled();
    });
    
    it('should log verbose output when requested', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"version": "2.0.0"}');
      
      // Capture console output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await versionManager.createVersionFile(testAstdbPath, { verbose: true });
      
      expect(consoleSpy).toHaveBeenCalledWith('  Creating version file: version.json');
      expect(consoleSpy).toHaveBeenCalledWith('    Schema version: 1.0.0');
      expect(consoleSpy).toHaveBeenCalledWith('    Tool version: 2.0.0');
      expect(consoleSpy).toHaveBeenCalledWith('    ✅ Version file created successfully');
      
      consoleSpy.mockRestore();
    });
  });

  describe('loadVersionInfo', () => {
    it('should load and validate version information', async () => {
      const validVersionInfo: VersionInfo = {
        schemaVersion: '1.0.0',
        toolVersion: '1.5.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: ['migration-1']
        }
      };
      
      // Mock FileSystemManager
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
      
      mockReadFile.mockResolvedValue(JSON.stringify(validVersionInfo));
      
      const result = await versionManager.loadVersionInfo(testAstdbPath);
      
      expect(result).toEqual(validVersionInfo);
      expect(mockReadFile).toHaveBeenCalledWith(testVersionPath, 'utf8');
    });
    
    it('should throw error when version file does not exist', async () => {
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(false)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
      
      await expect(versionManager.loadVersionInfo(testAstdbPath))
        .rejects
        .toThrow('Version file does not exist');
    });
    
    it('should throw error for invalid JSON', async () => {
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
      
      mockReadFile.mockResolvedValue('invalid json');
      
      await expect(versionManager.loadVersionInfo(testAstdbPath))
        .rejects
        .toThrow('Invalid JSON in version file');
    });
  });

  describe('saveVersionInfo', () => {
    it('should save valid version information', async () => {
      const versionInfo: VersionInfo = {
        schemaVersion: '1.0.0',
        toolVersion: '1.5.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      const mockFileSystemManager = {
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
      
      await versionManager.saveVersionInfo(testAstdbPath, versionInfo);
      
      expect(mockFileSystemManager.atomicWriteFile).toHaveBeenCalledWith(
        testVersionPath,
        JSON.stringify(versionInfo, null, 2),
        { encoding: 'utf8', mode: 0o644 }
      );
    });
    
    it('should validate version info before saving', async () => {
      const invalidVersionInfo = {
        schemaVersion: '', // Invalid: empty string
        toolVersion: '1.5.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      } as VersionInfo;
      
      await expect(versionManager.saveVersionInfo(testAstdbPath, invalidVersionInfo))
        .rejects
        .toThrow("Field 'schemaVersion' must be a non-empty string");
    });
  });

  describe('validateVersionCompatibility', () => {
    beforeEach(() => {
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
    });

    it('should pass for compatible versions', async () => {
      const compatibleVersionInfo: VersionInfo = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        toolVersion: '1.0.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(compatibleVersionInfo));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"version": "1.0.0"}');
      
      await expect(versionManager.validateVersionCompatibility(testAstdbPath))
        .resolves
        .toBeUndefined();
    });
    
    it('should throw error for incompatible tool version', async () => {
      const incompatibleVersionInfo: VersionInfo = {
        schemaVersion: '1.0.0',
        toolVersion: '1.0.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '2.0.0', // Higher than current tool version
          migrations: []
        }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(incompatibleVersionInfo));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"version": "1.0.0"}');
      
      await expect(versionManager.validateVersionCompatibility(testAstdbPath))
        .rejects
        .toThrow('Database version mismatch');
    });
    
    it('should throw error for newer database schema', async () => {
      const newerVersionInfo: VersionInfo = {
        schemaVersion: '2.0.0', // Higher than current schema version
        toolVersion: '1.0.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(newerVersionInfo));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"version": "1.0.0"}');
      
      await expect(versionManager.validateVersionCompatibility(testAstdbPath))
        .rejects
        .toThrow('Database version mismatch');
    });
  });

  describe('updateVersionInfo', () => {
    it('should update version info with new tool version', async () => {
      const originalVersionInfo: VersionInfo = {
        schemaVersion: '1.0.0',
        toolVersion: '1.0.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true),
        atomicWriteFile: vi.fn().mockResolvedValue(undefined)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
      
      mockReadFile.mockResolvedValue(JSON.stringify(originalVersionInfo));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"version": "1.5.0"}');
      
      await versionManager.updateVersionInfo(testAstdbPath, 'migration-123');
      
      const savedData = mockFileSystemManager.atomicWriteFile.mock.calls[0][1] as string;
      const updatedVersionInfo = JSON.parse(savedData);
      
      expect(updatedVersionInfo.toolVersion).toBe('1.5.0');
      expect(updatedVersionInfo.lastMigrated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(updatedVersionInfo.compatibility.migrations).toContain('migration-123');
    });
  });

  describe('planMigration', () => {
    beforeEach(() => {
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
    });

    it('should return empty plan for current version', async () => {
      const currentVersionInfo: VersionInfo = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        toolVersion: '1.0.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(currentVersionInfo));
      
      const plan = await versionManager.planMigration(testAstdbPath);
      
      expect(plan).toEqual([]);
    });
    
    it('should return upgrade plan for older version', async () => {
      const olderVersionInfo: VersionInfo = {
        schemaVersion: '0.9.0',
        toolVersion: '1.0.0',
        created: '2024-01-01T00:00:00.000Z',
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      mockReadFile.mockResolvedValue(JSON.stringify(olderVersionInfo));
      
      const plan = await versionManager.planMigration(testAstdbPath);
      
      expect(plan).toContain('upgrade-from-0.9.0-to-1.0.0');
    });
  });

  describe('getDatabaseAge', () => {
    it('should calculate database age correctly', async () => {
      const creationDate = new Date('2024-01-01T00:00:00.000Z');
      const migrationDate = new Date('2024-01-15T00:00:00.000Z');
      
      const versionInfo: VersionInfo = {
        schemaVersion: '1.0.0',
        toolVersion: '1.0.0',
        created: creationDate.toISOString(),
        lastMigrated: migrationDate.toISOString(),
        compatibility: {
          minToolVersion: '0.1.0',
          migrations: []
        }
      };
      
      const mockFileSystemManager = {
        exists: vi.fn().mockResolvedValue(true)
      };
      vi.doMock('../filesystem/manager.js', () => ({
        FileSystemManager: vi.fn(() => mockFileSystemManager)
      }));
      
      mockReadFile.mockResolvedValue(JSON.stringify(versionInfo));
      
      // Mock current date to make test deterministic
      const mockNow = new Date('2024-01-31T00:00:00.000Z');
      vi.setSystemTime(mockNow);
      
      const age = await versionManager.getDatabaseAge(testAstdbPath);
      
      expect(age.ageInDays).toBe(30);
      expect(age.created).toEqual(creationDate);
      expect(age.lastMigrated).toEqual(migrationDate);
    });
  });

  describe('validation methods', () => {
    it('should validate valid semver versions', () => {
      const validVersions = ['1.0.0', '1.2.3', '10.0.0-alpha.1', '2.0.0+build.123'];
      
      for (const version of validVersions) {
        expect(() => {
          (versionManager as any).validateVersionInfo({
            schemaVersion: version,
            toolVersion: '1.0.0',
            created: '2024-01-01T00:00:00.000Z',
            compatibility: {
              minToolVersion: '0.1.0',
              migrations: []
            }
          });
        }).not.toThrow();
      }
    });
    
    it('should reject invalid version formats', () => {
      const invalidVersions = ['1', '1.0', 'v1.0.0', 'invalid'];
      
      for (const version of invalidVersions) {
        expect(() => {
          (versionManager as any).validateVersionInfo({
            schemaVersion: version,
            toolVersion: '1.0.0',
            created: '2024-01-01T00:00:00.000Z',
            compatibility: {
              minToolVersion: '0.1.0',
              migrations: []
            }
          });
        }).toThrow('must be in semver format');
      }
    });
    
    it('should compare versions correctly', () => {
      const compareVersions = (versionManager as any).compareVersions.bind(versionManager);
      
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
    });
  });
});