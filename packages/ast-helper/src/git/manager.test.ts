/**
 * Tests for git utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitManager } from './manager.js';
import type { ChangedFilesOptions } from './types.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

describe('GitManager', () => {
  let tempDir: string;
  let gitManager: GitManager;
  
  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'git-test-'));
    gitManager = new GitManager(tempDir);
    
    // Initialize git repository
    await execCommand('git', ['init'], tempDir);
    await execCommand('git', ['config', 'user.name', 'Test User'], tempDir);
    await execCommand('git', ['config', 'user.email', 'test@example.com'], tempDir);
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('isGitRepository', () => {
    it('should return true for git repository', async () => {
      const result = await gitManager.isGitRepository(tempDir);
      expect(result).toBe(true);
    });
    
    it('should return false for non-git directory', async () => {
      const nonGitDir = await mkdtemp(join(tmpdir(), 'non-git-'));
      
      try {
        const result = await gitManager.isGitRepository(nonGitDir);
        expect(result).toBe(false);
      } finally {
        await rm(nonGitDir, { recursive: true, force: true });
      }
    });
  });
  
  describe('getRepositoryRoot', () => {
    it('should return repository root', async () => {
      const root = await gitManager.getRepositoryRoot(tempDir);
      expect(root).toBe(tempDir);
    });
    
    it('should return repository root from subdirectory', async () => {
      const subDir = join(tempDir, 'subdir');
      await mkdir(subDir);
      
      const root = await gitManager.getRepositoryRoot(subDir);
      expect(root).toBe(tempDir);
    });
  });
  
  describe('validateGitReference', () => {
    it('should validate HEAD reference', async () => {
      // Create initial commit
      await writeFile(join(tempDir, 'test.txt'), 'initial');
      await execCommand('git', ['add', 'test.txt'], tempDir);
      await execCommand('git', ['commit', '-m', 'initial commit'], tempDir);
      
      const result = await gitManager.validateGitReference('HEAD', tempDir);
      expect(result).toBe(true);
    });
    
    it('should reject invalid reference', async () => {
      const result = await gitManager.validateGitReference('invalid-ref', tempDir);
      expect(result).toBe(false);
    });
  });
  
  describe('getStagedFiles', () => {
    it('should return empty array when no staged files', async () => {
      const files = await gitManager.getStagedFiles(tempDir);
      expect(files).toEqual([]);
    });
    
    it('should return staged files', async () => {
      await writeFile(join(tempDir, 'staged.txt'), 'content');
      await execCommand('git', ['add', 'staged.txt'], tempDir);
      
      const files = await gitManager.getStagedFiles(tempDir);
      expect(files).toContain('staged.txt');
    });
  });
  
  describe('getChangedFiles', () => {
    beforeEach(async () => {
      // Create initial commit
      await writeFile(join(tempDir, 'initial.txt'), 'initial content');
      await execCommand('git', ['add', 'initial.txt'], tempDir);
      await execCommand('git', ['commit', '-m', 'initial commit'], tempDir);
    });
    
    it('should return changed files vs HEAD', async () => {
      await writeFile(join(tempDir, 'modified.txt'), 'modified content');
      await writeFile(join(tempDir, 'new.txt'), 'new content');
      await execCommand('git', ['add', 'modified.txt', 'new.txt'], tempDir);
      await execCommand('git', ['commit', '-m', 'second commit'], tempDir);
      
      // Modify a file
      await writeFile(join(tempDir, 'modified.txt'), 'changed content');
      
      const options: ChangedFilesOptions = { cwd: tempDir };
      const files = await gitManager.getChangedFiles(options);
      expect(files).toContain('modified.txt');
    });
    
    it('should include staged files when requested', async () => {
      await writeFile(join(tempDir, 'staged.txt'), 'staged content');
      await execCommand('git', ['add', 'staged.txt'], tempDir);
      
      const options: ChangedFilesOptions = { staged: true, cwd: tempDir };
      const files = await gitManager.getChangedFiles(options);
      expect(files).toContain('staged.txt');
    });
    
    it('should include untracked files when requested', async () => {
      await writeFile(join(tempDir, 'untracked.txt'), 'untracked content');
      
      const options: ChangedFilesOptions = { includeUntracked: true, cwd: tempDir };
      const files = await gitManager.getChangedFiles(options);
      expect(files).toContain('untracked.txt');
    });
  });
  
  describe('getStatus', () => {
    it('should return repository status', async () => {
      // Create initial commit
      await writeFile(join(tempDir, 'initial.txt'), 'initial');
      await execCommand('git', ['add', 'initial.txt'], tempDir);
      await execCommand('git', ['commit', '-m', 'initial commit'], tempDir);
      
      const status = await gitManager.getStatus(tempDir);
      expect(status.repositoryRoot).toBe(tempDir);
      expect(['main', 'master']).toContain(status.currentBranch); // Git may use master or main as default
      expect(status.isDirty).toBe(false);
    });
    
    it('should detect dirty repository', async () => {
      // Create initial commit
      await writeFile(join(tempDir, 'initial.txt'), 'initial');
      await execCommand('git', ['add', 'initial.txt'], tempDir);
      await execCommand('git', ['commit', '-m', 'initial commit'], tempDir);
      
      // Make repository dirty
      await writeFile(join(tempDir, 'modified.txt'), 'content');
      await execCommand('git', ['add', 'modified.txt'], tempDir);
      
      const status = await gitManager.getStatus(tempDir);
      expect(status.isDirty).toBe(true);
      expect(status.stagedFiles).toBeGreaterThan(0);
    });
  });
});

/**
 * Helper function to execute commands
 */
async function execCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'ignore' });
    
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      }
    });
    
    child.on('error', reject);
  });
}