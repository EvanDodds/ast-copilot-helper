import { describe, expect, it } from 'vitest';
import { FileSystemManager } from '../../../packages/ast-helper/src/filesystem/index.js';
import { GitManager } from '../../../packages/ast-helper/src/git/index.js';

describe('Utility Functions', () => {
  it('should handle file system operations', () => {
    const fsManager = new FileSystemManager();
    expect(fsManager).toBeDefined();
    expect(typeof fsManager.normalizePath).toBe('function');
    expect(typeof fsManager.resolvePath).toBe('function');
    expect(typeof fsManager.isAbsolutePath).toBe('function');
  });

  it('should handle git operations', () => {
    const gitManager = new GitManager();
    expect(gitManager).toBeDefined();
    expect(typeof gitManager.isGitRepository).toBe('function');
    expect(typeof gitManager.getChangedFiles).toBe('function');
    expect(typeof gitManager.getStagedFiles).toBe('function');
  });

  it('should handle path resolution', () => {
    const fsManager = new FileSystemManager();
    
    // Test path normalization
    const normalized = fsManager.normalizePath('test/path/../file.txt');
    expect(normalized).toBeDefined();
    expect(typeof normalized).toBe('string');
    
    // Test absolute path detection
    expect(fsManager.isAbsolutePath('/absolute/path')).toBe(true);
    expect(fsManager.isAbsolutePath('relative/path')).toBe(false);
  });
});