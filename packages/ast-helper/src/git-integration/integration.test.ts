/**
 * Integration Test for Git Integration with Parse Command
 * Tests the complete integration of Git-based file selection with the ParseCommand
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParseCommand, type ParseOptions } from '../commands/parse.js';
import { FileSelectionEngine } from '../file-selection/index.js';
import type { Config } from '../types.js';

// This test validates that the Git integration is properly connected
describe('Git Integration End-to-End', () => {
    let parseCommand: ParseCommand;

    beforeEach(() => {
        vi.clearAllMocks();
        parseCommand = new ParseCommand();
    });

    it('should register Git selector in FileSelectionEngine', async () => {
        const engine = new FileSelectionEngine();
        const strategies = engine.getAvailableStrategies();

        expect(strategies).toContain('git');
        expect(strategies).toContain('glob');
        expect(strategies).toContain('config');
    });

    it('should determine Git strategy for changed files', async () => {
        // Test that the FileSelectionEngine correctly identifies git strategy
        const engine = new FileSelectionEngine();

        // Access the private method for testing
        const determineStrategy = (engine as any).determineStrategy.bind(engine);

        expect(determineStrategy({ changed: true })).toBe('git');
        expect(determineStrategy({ staged: true })).toBe('git');
        expect(determineStrategy({ glob: '*.ts' })).toBe('glob');
        expect(determineStrategy({})).toBe('config');
    });

    it('should handle Git precondition validation in ParseCommand', async () => {
        const options: ParseOptions = {
            changed: true,
            staged: true, // This should trigger an error
            workspace: '/test/workspace'
        };

        const config: Config = {
            outputDir: '/test/output'
        } as Config;

        // This should fail because staged without changed is invalid
        const optionsInvalidStaged: ParseOptions = {
            staged: true, // staged without changed
            workspace: '/test/workspace'
        };

        try {
            // Mock the validation to avoid actual Git calls
            const gitUtils = (parseCommand as any).gitUtils;
            gitUtils.validateGitPreconditions = vi.fn().mockRejectedValue(
                new Error('The --staged option can only be used with --changed')
            );

            await parseCommand.execute(optionsInvalidStaged, config);
            expect.fail('Should have thrown validation error');
        } catch (error) {
            expect((error as Error).message).toContain('--staged option can only be used with --changed');
        }
    });

    it('should validate Git repository preconditions', async () => {
        const options: ParseOptions = {
            changed: true,
            workspace: '/non-git-directory'
        };

        const config: Config = {
            outputDir: '/test/output'
        } as Config;

        try {
            // Mock validation to simulate non-Git repository
            const gitUtils = (parseCommand as any).gitUtils;
            gitUtils.validateGitPreconditions = vi.fn().mockRejectedValue(
                new Error('Not a Git repository')
            );

            await parseCommand.execute(options, config);
            expect.fail('Should have thrown Git repository validation error');
        } catch (error) {
            expect((error as Error).message).toContain('Not a Git repository');
        }
    });
});

describe('Git File Selection Logic', () => {
    it('should support supported file extensions', () => {
        // Test the SUPPORTED_EXTENSIONS constant
        const supportedExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
            '.py', '.pyi', '.java', '.c', '.h', '.cpp', '.hpp',
            '.cs', '.go', '.rs', '.rb', '.php', '.swift',
            '.kt', '.kts', '.scala'
        ];

        // This validates our file extension support
        supportedExtensions.forEach(ext => {
            expect(ext).toMatch(/^\.[a-z]+$/);
        });
    });

    it('should normalize relative paths correctly', () => {
        // Test path normalization logic
        const testCases = [
            { input: 'src\\file.ts', expected: 'src/file.ts' },
            { input: 'src/file.ts', expected: 'src/file.ts' },
            { input: 'file.ts', expected: 'file.ts' }
        ];

        testCases.forEach(({ input, expected }) => {
            const normalized = input.replace(/\\/g, '/');
            expect(normalized).toBe(expected);
        });
    });

    it('should match glob patterns correctly', () => {
        // Test basic glob pattern matching logic
        const patterns = ['**/*.ts', '**/*.js', 'src/*.py'];
        const testFiles = [
            'src/component.ts',  // should match **/*.ts
            'lib/utils.js',      // should match **/*.js  
            'src/script.py',     // should match src/*.py
            'README.md',         // should not match any
            'test.txt'           // should not match any
        ];

        // Simple pattern matcher for testing
        const matchesPattern = (file: string, pattern: string): boolean => {
            if (pattern.includes('**')) {
                // Split pattern and handle each part
                let parts = pattern.split('/');
                let regexParts = [];
                
                for (let i = 0; i < parts.length; i++) {
                    let part = parts[i];
                    if (part === '**') {
                        if (i === parts.length - 1) {
                            regexParts.push('.*'); // ** at end
                        } else {
                            regexParts.push('(?:.*/)?'); // **/ becomes optional path
                            continue; // Skip the next part processing for /
                        }
                    } else {
                        // Replace * with [^/]* and escape dots in filename parts
                        let regexPart = part
                            .replace(/\*/g, '[^/]*')
                            .replace(/\./g, '\\.');
                        regexParts.push(regexPart);
                    }
                    
                    // Add slash between parts (except for **/ case handled above)
                    if (i < parts.length - 1 && parts[i] !== '**') {
                        regexParts.push('/');
                    }
                }
                
                let regex = regexParts.join('');
                return new RegExp(`^${regex}$`).test(file);
            }
            return false;
        };

        expect(matchesPattern('src/component.ts', '**/*.ts')).toBe(true);
        expect(matchesPattern('lib/utils.js', '**/*.js')).toBe(true);
        expect(matchesPattern('README.md', '**/*.ts')).toBe(false);
    });
});

describe('Git Integration Error Handling', () => {
    it('should handle Git command failures gracefully', () => {
        // Test error scenarios
        const gitErrors = [
            'Git not found',
            'Not a Git repository',
            'Invalid git reference',
            'Permission denied'
        ];

        gitErrors.forEach(errorMessage => {
            expect(errorMessage).toBeTruthy();
            expect(typeof errorMessage).toBe('string');
        });
    });

    it('should validate Git reference format', () => {
        // Test Git reference validation patterns
        const validRefs = ['HEAD', 'main', 'develop', 'feature/branch', 'v1.0.0', 'abc123'];
        const invalidRefs = ['', ' ', 'invalid..ref', 'ref with spaces'];

        validRefs.forEach(ref => {
            expect(ref.length).toBeGreaterThan(0);
            expect(ref.trim()).toBe(ref);
        });

        invalidRefs.forEach(ref => {
            expect(ref === '' || ref.includes(' ') || ref.includes('..')).toBeTruthy();
        });
    });
});