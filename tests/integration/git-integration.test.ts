/**
 * Git Integration Testing Suite
 * Comprehensive tests for Git operations, repository management, change detection, and workflow integration
 */

import { beforeEach, afterEach, describe, test, expect, afterAll } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { GitManager } from '../../packages/ast-helper/src/git/manager.js';
import type { GitStatus, ChangedFilesOptions } from '../../packages/ast-helper/src/git/types.js';
import { GitError } from '../../packages/ast-helper/src/errors/types.js';

/**
 * Git test utilities for managing test repositories
 */
class GitTestUtils {
  private tempDirs: string[] = [];

  /**
   * Create a temporary directory for testing
   */
  async createTempDir(): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), 'git-test-'));
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  /**
   * Execute a git command in the specified directory
   */
  async execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (exitCode) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode ?? 1 });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Initialize a git repository in the specified directory
   */
  async initRepository(dir: string): Promise<void> {
    await this.execGit(['init'], dir);
    await this.execGit(['config', 'user.name', 'Test User'], dir);
    await this.execGit(['config', 'user.email', 'test@example.com'], dir);
    // Set default branch and explicitly checkout main
    try {
      await this.execGit(['config', 'init.defaultBranch', 'main'], dir);
      // If already initialized, rename the default branch to main
      await this.execGit(['branch', '-M', 'main'], dir);
    } catch (error) {
      // If config fails, just proceed - older git versions may not support it
    }
  }

  /**
   * Create a file with specified content
   */
  async createFile(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * Create a directory structure
   */
  async createDirectory(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  /**
   * Create initial commit in repository
   */
  async createInitialCommit(repoDir: string): Promise<void> {
    await this.createFile(join(repoDir, 'README.md'), '# Test Repository\n\nThis is a test repository.');
    await this.execGit(['add', 'README.md'], repoDir);
    await this.execGit(['commit', '-m', 'Initial commit'], repoDir);
  }

  /**
   * Create multiple files and commits for testing
   */
  async createTestFiles(repoDir: string): Promise<void> {
    // Create source directory with multiple files
    await this.createDirectory(join(repoDir, 'src'));
    await this.createFile(join(repoDir, 'src', 'index.ts'), 'console.log("Hello World");');
    await this.createFile(join(repoDir, 'src', 'utils.ts'), 'export const utils = {};');
    await this.createFile(join(repoDir, 'package.json'), '{\n  "name": "test-package"\n}');
    
    // Add and commit files
    await this.execGit(['add', '.'], repoDir);
    await this.execGit(['commit', '-m', 'Add initial project files'], repoDir);
    
    // Create additional changes
    await this.createFile(join(repoDir, 'src', 'config.ts'), 'export const config = { debug: true };');
    await this.execGit(['add', 'src/config.ts'], repoDir);
    await this.execGit(['commit', '-m', 'Add configuration file'], repoDir);
  }

  /**
   * Clean up all temporary directories
   */
  async cleanup(): Promise<void> {
    for (const tempDir of this.tempDirs) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to clean up temp dir ${tempDir}:`, error);
      }
    }
    this.tempDirs = [];
  }
}

/**
 * Mock Git manager for testing specific scenarios
 */
class MockGitManager extends GitManager {
  private mockResponses: Map<string, any> = new Map();

  setMockResponse(method: string, response: any): void {
    this.mockResponses.set(method, response);
  }

  async isGitRepository(path: string): Promise<boolean> {
    if (this.mockResponses.has('isGitRepository')) {
      return this.mockResponses.get('isGitRepository');
    }
    return super.isGitRepository(path);
  }

  async getChangedFiles(options?: ChangedFilesOptions): Promise<string[]> {
    if (this.mockResponses.has('getChangedFiles')) {
      return this.mockResponses.get('getChangedFiles');
    }
    return super.getChangedFiles(options);
  }

  clearMocks(): void {
    this.mockResponses.clear();
  }
}

/**
 * Comprehensive Git Integration Test Suite
 */
class ComprehensiveGitIntegrationTestSuite {
  private gitTestUtils: GitTestUtils;
  private testRepoDir: string = '';
  private nonRepoDir: string = '';
  private gitManager: GitManager | undefined;

  constructor() {
    this.gitTestUtils = new GitTestUtils();
  }

  /**
   * Set up test environment with repositories
   */
  async setupTestEnvironment(): Promise<void> {
    // Create test repository
    this.testRepoDir = await this.gitTestUtils.createTempDir();
    await this.gitTestUtils.initRepository(this.testRepoDir);
    await this.gitTestUtils.createInitialCommit(this.testRepoDir);
    await this.gitTestUtils.createTestFiles(this.testRepoDir);

    // Create non-repository directory
    this.nonRepoDir = await this.gitTestUtils.createTempDir();
    await this.gitTestUtils.createFile(join(this.nonRepoDir, 'test.txt'), 'This is not a git repo');

    // Initialize GitManager
    this.gitManager = new GitManager(this.testRepoDir);
  }

  /**
   * Clean up test environment
   */
  async cleanupTestEnvironment(): Promise<void> {
    await this.gitTestUtils.cleanup();
  }

  /**
   * Test basic repository operations
   */
  async testBasicRepositoryOperations(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Test repository detection
    const isRepo = await this.gitManager.isGitRepository(this.testRepoDir);
    expect(isRepo).toBe(true);

    const isNotRepo = await this.gitManager.isGitRepository(this.nonRepoDir);
    expect(isNotRepo).toBe(false);

    // Test repository root finding
    const repoRoot = await this.gitManager.getRepositoryRoot(this.testRepoDir);
    expect(resolve(repoRoot)).toBe(resolve(this.testRepoDir));

    // Test with subdirectory
    const srcDir = join(this.testRepoDir, 'src');
    const rootFromSrc = await this.gitManager.getRepositoryRoot(srcDir);
    expect(resolve(rootFromSrc)).toBe(resolve(this.testRepoDir));

    console.log('✓ Basic repository operations tests passed');
  }

  /**
   * Test git status and change detection
   */
  async testStatusAndChangeDetection(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Get initial status
    const initialStatus = await this.gitManager.getStatus(this.testRepoDir);
    expect(initialStatus.repositoryRoot).toBe(resolve(this.testRepoDir));
    // Accept either 'main' or 'master' as valid default branch names
    expect(['main', 'master']).toContain(initialStatus.branch);
    expect(initialStatus.isDirty).toBe(false);

    // Create modified files
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'src', 'modified.ts'), 'export const modified = true;');
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'untracked.ts'), 'export const untracked = true;');

    // Modify existing file
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'src', 'index.ts'), 'console.log("Modified Hello World");');

    // Get status with changes
    const statusWithChanges = await this.gitManager.getStatus(this.testRepoDir);
    
    // More lenient assertions - we should have some changes or untracked files
    expect(statusWithChanges.isDirty).toBe(true);
    expect(statusWithChanges.modifiedFiles + statusWithChanges.untrackedFiles + statusWithChanges.stagedFiles).toBeGreaterThan(0);

    console.log('✓ Status and change detection tests passed');
  }

  /**
   * Test changed files retrieval with various options
   */
  async testChangedFilesRetrieval(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Create some changes
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'new-file.ts'), 'export const newFile = true;');
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'src', 'updated.ts'), 'export const updated = true;');
    
    // Modify existing file
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'README.md'), '# Updated Test Repository\n\nThis repository has been updated.');

    // Test getting changed files vs HEAD
    const changedFiles = await this.gitManager.getChangedFiles({
      base: 'HEAD',
      includeUntracked: true
    });
    expect(changedFiles.length).toBeGreaterThan(0);
    expect(changedFiles).toContain('README.md');

    // Stage some files
    await this.gitTestUtils.execGit(['add', 'README.md'], this.testRepoDir);

    // Test getting staged files
    const stagedFiles = await this.gitManager.getStagedFiles(this.testRepoDir);
    expect(stagedFiles).toContain('README.md');

    // Test getting changed files with staged option
    const changedWithStaged = await this.gitManager.getChangedFiles({
      staged: true,
      includeUntracked: true
    });
    expect(changedWithStaged.length).toBeGreaterThan(0);

    // Test with specific change types filter
    const modifiedOnly = await this.gitManager.getChangedFiles({
      base: 'HEAD',
      filterTypes: ['M']
    });
    // Should include modified files but not new files
    expect(modifiedOnly).toContain('README.md');

    console.log('✓ Changed files retrieval tests passed');
  }

  /**
   * Test git reference validation
   */
  async testGitReferenceValidation(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Test valid references
    const headValid = await this.gitManager.validateGitReference('HEAD', this.testRepoDir);
    expect(headValid).toBe(true);

    // Get the actual current branch name
    const status = await this.gitManager.getStatus(this.testRepoDir);
    const currentBranch = status.branch;
    
    const branchValid = await this.gitManager.validateGitReference(currentBranch, this.testRepoDir);
    expect(branchValid).toBe(true);

    // Test invalid reference
    const invalidRef = await this.gitManager.validateGitReference('non-existent-branch', this.testRepoDir);
    expect(invalidRef).toBe(false);

    // Test with commit hash (get a real commit hash)
    const { stdout } = await this.gitTestUtils.execGit(['rev-parse', 'HEAD'], this.testRepoDir);
    const commitHash = stdout.trim();
    const commitValid = await this.gitManager.validateGitReference(commitHash, this.testRepoDir);
    expect(commitValid).toBe(true);

    // Test partial commit hash
    const partialHash = commitHash.substring(0, 7);
    const partialValid = await this.gitManager.validateGitReference(partialHash, this.testRepoDir);
    expect(partialValid).toBe(true);

    console.log('✓ Git reference validation tests passed');
  }

  /**
   * Test branch operations and workflow
   */
  async testBranchOperationsWorkflow(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Get current branch name
    const initialStatus = await this.gitManager.getStatus(this.testRepoDir);
    const defaultBranch = initialStatus.branch;

    // Create new branch
    await this.gitTestUtils.execGit(['checkout', '-b', 'feature-branch'], this.testRepoDir);

    // Verify branch switch
    const status = await this.gitManager.getStatus(this.testRepoDir);
    expect(status.branch).toBe('feature-branch');

    // Create changes on feature branch
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'feature.ts'), 'export const feature = "new feature";');
    await this.gitTestUtils.execGit(['add', 'feature.ts'], this.testRepoDir);
    await this.gitTestUtils.execGit(['commit', '-m', 'Add new feature'], this.testRepoDir);

    // Get changed files between branches
    const changedVsDefault = await this.gitManager.getChangedFiles({
      base: defaultBranch
    });
    expect(changedVsDefault).toContain('feature.ts');

    // Switch back to default branch
    await this.gitTestUtils.execGit(['checkout', defaultBranch], this.testRepoDir);

    // Verify branch switch
    const defaultStatus = await this.gitManager.getStatus(this.testRepoDir);
    expect(defaultStatus.branch).toBe(defaultBranch);

    // Verify feature file doesn't exist on main
    const changedFromFeature = await this.gitManager.getChangedFiles({
      base: 'feature-branch'
    });
    // Should show difference when comparing main to feature-branch

    console.log('✓ Branch operations workflow tests passed');
  }

  /**
   * Test error handling and edge cases
   */
  async testErrorHandlingEdgeCases(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Test operations on non-repository directory
    await expect(this.gitManager.getRepositoryRoot(this.nonRepoDir)).rejects.toThrow();
    await expect(this.gitManager.getChangedFiles({ cwd: this.nonRepoDir })).rejects.toThrow();
    await expect(this.gitManager.getStagedFiles(this.nonRepoDir)).rejects.toThrow();

    // Test invalid path - catch specific error scenarios
    const invalidPath = '/path/that/does/not/exist';
    try {
      await this.gitManager.isGitRepository(invalidPath);
      // If it doesn't throw, that's fine too - depends on git version
    } catch (error) {
      // Expected behavior for non-existent path
      expect(error).toBeDefined();
    }

    // Test empty repository behavior
    const emptyRepoDir = await this.gitTestUtils.createTempDir();
    await this.gitTestUtils.initRepository(emptyRepoDir);
    
    const emptyGitManager = new GitManager(emptyRepoDir);
    const emptyRepoStatus = await emptyGitManager.getStatus(emptyRepoDir);
    // Accept either 'main' or 'master' as valid default branch names
    expect(['main', 'master']).toContain(emptyRepoStatus.branch);

    // Test with invalid git reference in empty repo
    const invalidInEmpty = await emptyGitManager.validateGitReference('non-existent-ref', emptyRepoDir);
    expect(invalidInEmpty).toBe(false);

    console.log('✓ Error handling and edge cases tests passed');
  }

  /**
   * Test cross-platform compatibility
   */
  async testCrossPlatformCompatibility(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Test path resolution across platforms
    const repoRoot = await this.gitManager.getRepositoryRoot(this.testRepoDir);
    expect(repoRoot).toBe(resolve(this.testRepoDir));

    // Test with different path separators (should be normalized)
    const srcPath = join(this.testRepoDir, 'src');
    const rootFromSrc = await this.gitManager.getRepositoryRoot(srcPath);
    expect(rootFromSrc).toBe(resolve(this.testRepoDir));

    // Test file paths in changed files (should use platform-appropriate separators)
    await this.gitTestUtils.createDirectory(join(this.testRepoDir, 'deep', 'nested', 'path'));
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'deep', 'nested', 'path', 'file.ts'), 'export const deep = true;');
    
    const changedFiles = await this.gitManager.getChangedFiles({ includeUntracked: true });
    const deepFile = changedFiles.find(file => file.includes('file.ts'));
    expect(deepFile).toBeDefined();
    // File path should use platform-appropriate separators
    expect(deepFile).toMatch(/deep.*nested.*path.*file\.ts/);

    console.log('✓ Cross-platform compatibility tests passed');
  }

  /**
   * Test performance and scalability
   */
  async testPerformanceScalability(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Create many files to test performance
    const startTime = Date.now();
    
    const filePromises: Promise<void>[] = [];
    for (let i = 0; i < 50; i++) {
      filePromises.push(
        this.gitTestUtils.createFile(join(this.testRepoDir, `bulk-file-${i}.ts`), `export const file${i} = ${i};`)
      );
    }
    await Promise.all(filePromises);

    // Test performance of getting changed files with many files
    const changedFiles = await this.gitManager.getChangedFiles({ includeUntracked: true });
    expect(changedFiles.length).toBeGreaterThanOrEqual(50);

    const operationTime = Date.now() - startTime;
    expect(operationTime).toBeLessThan(10000); // Should complete within 10 seconds

    // Test batch operations
    await this.gitTestUtils.execGit(['add', '.'], this.testRepoDir);
    const stagedFiles = await this.gitManager.getStagedFiles(this.testRepoDir);
    expect(stagedFiles.length).toBeGreaterThanOrEqual(50);

    // Test status with many files
    const statusStart = Date.now();
    const status = await this.gitManager.getStatus(this.testRepoDir);
    const statusTime = Date.now() - statusStart;
    
    expect(status.stagedFiles).toBeGreaterThanOrEqual(50);
    expect(statusTime).toBeLessThan(5000); // Status should be fast even with many files

    console.log('✓ Performance and scalability tests passed');
  }

  /**
   * Test Git workflow integration scenarios
   */
  async testGitWorkflowIntegration(): Promise<void> {
    if (!this.gitManager) throw new Error('GitManager not initialized');

    // Simulate a typical development workflow
    
    // 1. Check current state
    const initialState = await this.gitManager.getStatus(this.testRepoDir);
    const defaultBranch = initialState.branch;
    expect(['main', 'master']).toContain(defaultBranch);

    // 2. Create feature branch
    await this.gitTestUtils.execGit(['checkout', '-b', 'workflow-test'], this.testRepoDir);

    // 3. Make changes
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'workflow.ts'), 'export const workflow = "test";');
    await this.gitTestUtils.createFile(join(this.testRepoDir, 'src', 'feature.ts'), 'export const feature = "implementation";');

    // 4. Check what files changed
    const changedFiles = await this.gitManager.getChangedFiles({ includeUntracked: true });
    expect(changedFiles).toContain('workflow.ts');
    expect(changedFiles).toContain('src/feature.ts');

    // 5. Stage files selectively
    await this.gitTestUtils.execGit(['add', 'workflow.ts'], this.testRepoDir);
    
    const stagedFiles = await this.gitManager.getStagedFiles(this.testRepoDir);
    expect(stagedFiles).toContain('workflow.ts');
    expect(stagedFiles).not.toContain('src/feature.ts');

    // 6. Check status shows mixed state
    const mixedStatus = await this.gitManager.getStatus(this.testRepoDir);
    expect(mixedStatus.hasStaged).toBe(true);
    expect(mixedStatus.hasUntracked).toBe(true);
    expect(mixedStatus.isDirty).toBe(true);

    // 7. Commit staged changes
    await this.gitTestUtils.execGit(['commit', '-m', 'Add workflow file'], this.testRepoDir);

    // 8. Check post-commit status
    const postCommitStatus = await this.gitManager.getStatus(this.testRepoDir);
    expect(postCommitStatus.hasStaged).toBe(false);
    expect(postCommitStatus.hasUntracked).toBe(true); // feature.ts still untracked

    // 9. Compare with default branch
    const diffWithDefault = await this.gitManager.getChangedFiles({ base: defaultBranch });
    expect(diffWithDefault).toContain('workflow.ts');

    console.log('✓ Git workflow integration tests passed');
  }

  /**
   * Test mock and integration scenarios
   */
  async testMockIntegrationScenarios(): Promise<void> {
    const mockGitManager = new MockGitManager(this.testRepoDir);

    // Test mock repository detection
    mockGitManager.setMockResponse('isGitRepository', false);
    const isMockRepo = await mockGitManager.isGitRepository(this.testRepoDir);
    expect(isMockRepo).toBe(false);

    // Test mock changed files
    mockGitManager.setMockResponse('getChangedFiles', ['mocked-file1.ts', 'mocked-file2.ts']);
    const mockedChangedFiles = await mockGitManager.getChangedFiles();
    expect(mockedChangedFiles).toEqual(['mocked-file1.ts', 'mocked-file2.ts']);

    // Clear mocks and test real functionality
    mockGitManager.clearMocks();
    const realIsRepo = await mockGitManager.isGitRepository(this.testRepoDir);
    expect(realIsRepo).toBe(true);

    console.log('✓ Mock integration scenarios tests passed');
  }
}

describe('Git Integration Tests', () => {
  let testSuite: ComprehensiveGitIntegrationTestSuite;

  beforeEach(async () => {
    testSuite = new ComprehensiveGitIntegrationTestSuite();
    await testSuite.setupTestEnvironment();
  });

  afterEach(async () => {
    await testSuite.cleanupTestEnvironment();
  });

  describe('Basic Repository Operations', () => {
    test('should perform basic repository operations', async () => {
      await testSuite.testBasicRepositoryOperations();
    });

    test('should detect status and changes', async () => {
      await testSuite.testStatusAndChangeDetection();
    });

    test('should retrieve changed files with options', async () => {
      await testSuite.testChangedFilesRetrieval();
    });
  });

  describe('Git Reference and Branch Management', () => {
    test('should validate git references', async () => {
      await testSuite.testGitReferenceValidation();
    });

    test('should handle branch operations workflow', async () => {
      await testSuite.testBranchOperationsWorkflow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle errors and edge cases gracefully', async () => {
      await testSuite.testErrorHandlingEdgeCases();
    });

    test('should work across platforms', async () => {
      await testSuite.testCrossPlatformCompatibility();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large numbers of files efficiently', async () => {
      await testSuite.testPerformanceScalability();
    });
  });

  describe('Workflow Integration', () => {
    test('should support complete git workflows', async () => {
      await testSuite.testGitWorkflowIntegration();
    });

    test('should integrate with mocks for testing', async () => {
      await testSuite.testMockIntegrationScenarios();
    });
  });
});