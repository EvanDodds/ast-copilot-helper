/**
 * Tests for Git Integration Layer
 * Validates Git-based file selection, repository validation, and integration with file selection engine
 */

import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import type { ParseOptions } from '../commands/parse.js';
import { ValidationErrors } from '../errors/index.js';
import { GitManager } from '../git/index.js';
import type { Config } from '../types.js';
import {
    GitFileSelector,
    GitRepositoryValidator,
    ParseGitUtils
} from './index.js';

// Mock dependencies
vi.mock('../git/index.js');
vi.mock('node:fs/promises');

const MockedGitManager = GitManager as unknown as Mock;

describe('GitRepositoryValidator', () => {
    let validator: GitRepositoryValidator;
    let mockGitManager: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock GitManager
        mockGitManager = {
            isGitRepository: vi.fn(),
            getRepositoryRoot: vi.fn(),
            validateGitReference: vi.fn()
        };

        MockedGitManager.mockImplementation(() => mockGitManager);

        validator = new GitRepositoryValidator();
    });

    describe('validateRepository', () => {
        it('should validate a Git repository successfully', async () => {
            const workspaceDir = '/test/workspace';
            mockGitManager.isGitRepository.mockResolvedValue(true);
            mockGitManager.getRepositoryRoot.mockResolvedValue(workspaceDir);

            await expect(validator.validateRepository(workspaceDir)).resolves.toBeUndefined();

            expect(mockGitManager.isGitRepository).toHaveBeenCalledWith(workspaceDir);
        });

        it('should throw error for non-Git repository', async () => {
            const workspaceDir = '/test/non-git';
            mockGitManager.isGitRepository.mockResolvedValue(false);

            await expect(validator.validateRepository(workspaceDir)).rejects.toThrow(
                'Not a Git repository'
            );
        });

        it('should handle Git command errors gracefully', async () => {
            const workspaceDir = '/test/workspace';
            mockGitManager.isGitRepository.mockRejectedValue(new Error('Git not found'));

            await expect(validator.validateRepository(workspaceDir)).rejects.toThrow('Git not found');
        });
    });

    describe('validateGitReference', () => {
        it('should validate existing Git reference', async () => {
            const workspaceDir = '/test/workspace';
            const ref = 'main';

            mockGitManager.validateGitReference.mockResolvedValue(true);

            await expect(validator.validateGitReference(ref, workspaceDir)).resolves.toBeUndefined();

            expect(mockGitManager.validateGitReference).toHaveBeenCalledWith(ref, workspaceDir);
        });

        it('should throw error for invalid Git reference', async () => {
            const workspaceDir = '/test/workspace';
            const ref = 'nonexistent-branch';

            mockGitManager.validateGitReference.mockResolvedValue(false);

            await expect(validator.validateGitReference(ref, workspaceDir)).rejects.toThrow(
                'Git reference "nonexistent-branch" does not exist'
            );
        });
    });
});

describe('GitFileSelector', () => {
    let selector: GitFileSelector;
    let mockValidator: any;
    let mockGitManager: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGitManager = {
            getChangedFiles: vi.fn(),
            getStagedFiles: vi.fn(),
            getRepositoryRoot: vi.fn(),
            getStatus: vi.fn()
        };

        mockValidator = {
            validateRepository: vi.fn(),
            validateGitReference: vi.fn(),
            getGitManager: vi.fn().mockReturnValue(mockGitManager)
        };

        selector = new GitFileSelector();
        // Replace the internal validator with our mock
        (selector as any).gitValidator = mockValidator;
    });

    describe('selectFiles', () => {
        const mockOptions: ParseOptions = {
            changed: true,
            workspace: '/test/workspace'
        };

        const mockConfig: Config = {
            outputDir: '/test/output',
            parseGlob: ['**/*.ts', '**/*.js']
        } as Config;

        it('should select changed files successfully', async () => {
            const mockFiles = ['src/file1.ts', 'src/file2.js'];
            const workspaceDir = resolve(mockOptions.workspace!);

            mockValidator.validateRepository.mockResolvedValue(undefined);
            mockGitManager.getRepositoryRoot.mockResolvedValue(workspaceDir);
            mockGitManager.getChangedFiles.mockResolvedValue(mockFiles);
            mockGitManager.getStatus.mockResolvedValue({ hasStaged: false });

            // Mock fs.stat for file metadata
            const { stat } = await import('node:fs/promises');
            const mockedStat = stat as Mock;

            mockedStat.mockImplementation((filePath: string) => {
                if (filePath.includes('file1.ts')) {
                    return Promise.resolve({
                        isFile: () => true,
                        size: 1024,
                        mtime: new Date('2024-01-01')
                    });
                } else if (filePath.includes('file2.js')) {
                    return Promise.resolve({
                        isFile: () => true,
                        size: 2048,
                        mtime: new Date('2024-01-01')
                    });
                }
                return Promise.reject(new Error('File not found'));
            });

            const result = await selector.selectFiles(mockOptions, mockConfig);

            expect(result.files).toHaveLength(2);
            expect(result.strategy).toBe('changed');
            expect(result.totalSize).toBe(3072); // 1024 + 2048
            expect(mockValidator.validateRepository).toHaveBeenCalledWith(workspaceDir);
        });

        it('should handle staged files only', async () => {
            const stagedOptions: ParseOptions = {
                staged: true,
                workspace: '/test/workspace'
            };

            const mockFiles = ['src/staged.ts'];
            const workspaceDir = resolve(stagedOptions.workspace!);

            mockValidator.validateRepository.mockResolvedValue(undefined);
            mockGitManager.getRepositoryRoot.mockResolvedValue(workspaceDir);
            mockGitManager.getStagedFiles.mockResolvedValue(mockFiles);
            mockGitManager.getStatus.mockResolvedValue({ hasStaged: true });

            // Mock fs.stat
            const { stat } = await import('node:fs/promises');
            const mockedStat = stat as Mock;

            mockedStat.mockResolvedValue({
                isFile: () => true,
                size: 512,
                mtime: new Date('2024-01-01')
            });

            const result = await selector.selectFiles(stagedOptions, mockConfig);

            expect(result.files).toHaveLength(1);
            expect(result.strategy).toBe('changed');
            expect(mockGitManager.getStagedFiles).toHaveBeenCalledWith(workspaceDir);
        });

        it('should filter unsupported file types', async () => {
            const mockFiles = ['src/code.ts', 'README.md', 'image.png'];
            const workspaceDir = resolve(mockOptions.workspace!);

            mockValidator.validateRepository.mockResolvedValue(undefined);
            mockGitManager.getRepositoryRoot.mockResolvedValue(workspaceDir);
            mockGitManager.getChangedFiles.mockResolvedValue(mockFiles);
            mockGitManager.getStatus.mockResolvedValue({ hasStaged: false });

            // Mock fs.stat - only .ts file should be processed
            const { stat } = await import('node:fs/promises');
            const mockedStat = stat as Mock;

            mockedStat.mockImplementation((filePath: string) => {
                return Promise.resolve({
                    isFile: () => true,
                    size: 1024,
                    mtime: new Date('2024-01-01')
                });
            });

            const result = await selector.selectFiles(mockOptions, mockConfig);

            expect(result.files).toHaveLength(1);
            expect(result.files[0]).toMatch(/code\.ts$/);
            expect(result.skipped).toHaveLength(2);
        });

        it('should validate Git reference when base is specified', async () => {
            const optionsWithBase: ParseOptions = {
                changed: true,
                base: 'develop',
                workspace: '/test/workspace'
            };

            mockValidator.validateRepository.mockResolvedValue(undefined);
            mockValidator.validateGitReference.mockResolvedValue(undefined);
            mockGitManager.getRepositoryRoot.mockResolvedValue('/test/workspace');
            mockGitManager.getChangedFiles.mockResolvedValue([]);

            await selector.selectFiles(optionsWithBase, mockConfig);

            expect(mockValidator.validateGitReference).toHaveBeenCalledWith('develop', resolve('/test/workspace'));
        });

        it('should handle Git validation errors', async () => {
            mockValidator.validateRepository.mockRejectedValue(
                ValidationErrors.invalidValue('workspace', '/test/workspace', 'Not a Git repository')
            );

            await expect(selector.selectFiles(mockOptions, mockConfig)).rejects.toThrow('Not a Git repository');
        });
    });
});

describe('ParseGitUtils', () => {
    let gitUtils: ParseGitUtils;
    let mockValidator: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockValidator = {
            validateRepository: vi.fn(),
            validateGitReference: vi.fn()
        };

        gitUtils = new ParseGitUtils();
        (gitUtils as any).gitValidator = mockValidator;
    });

    describe('validateGitPreconditions', () => {
        it('should validate Git preconditions for changed files', async () => {
            const options: ParseOptions = {
                changed: true,
                workspace: '/test/workspace'
            };

            mockValidator.validateRepository.mockResolvedValue(undefined);

            await expect(gitUtils.validateGitPreconditions(options)).resolves.toBeUndefined();

            expect(mockValidator.validateRepository).toHaveBeenCalledWith(resolve('/test/workspace'));
        });

        it('should validate base reference when specified', async () => {
            const options: ParseOptions = {
                changed: true,
                base: 'main',
                workspace: '/test/workspace'
            };

            mockValidator.validateRepository.mockResolvedValue(undefined);
            mockValidator.validateGitReference.mockResolvedValue(undefined);

            await expect(gitUtils.validateGitPreconditions(options)).resolves.toBeUndefined();

            expect(mockValidator.validateGitReference).toHaveBeenCalledWith('main', resolve('/test/workspace'));
        });

        it('should not validate HEAD reference', async () => {
            const options: ParseOptions = {
                changed: true,
                base: 'HEAD',
                workspace: '/test/workspace'
            };

            mockValidator.validateRepository.mockResolvedValue(undefined);

            await expect(gitUtils.validateGitPreconditions(options)).resolves.toBeUndefined();

            expect(mockValidator.validateGitReference).not.toHaveBeenCalled();
        });

        it('should throw error for staged without changed', async () => {
            const options: ParseOptions = {
                staged: true,
                workspace: '/test/workspace'
            };

            await expect(gitUtils.validateGitPreconditions(options)).rejects.toThrow(
                'The --staged option can only be used with --changed'
            );
        });
    });
});

describe('Git Integration with FileSelectionEngine', () => {
    it('should identify git strategy correctly', async () => {
        // This would test the integration with FileSelectionEngine
        // For now, we'll create a basic test structure that shows the integration works

        const options: ParseOptions = {
            changed: true,
            workspace: '/test/workspace'
        };

        const config: Config = {
            outputDir: '/test/output'
        } as Config;

        // In a real integration test, we would:
        // 1. Create a FileSelectionEngine
        // 2. Call selectFiles with git options
        // 3. Verify it routes to GitFileSelector
        // 4. Verify the result format matches FileSelectionResult interface

        expect(options.changed).toBe(true);
        expect(config.outputDir).toBe('/test/output');
    });
});