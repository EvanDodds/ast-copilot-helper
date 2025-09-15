/**
 * Test file watching configuration integration
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, validateConfig } from '../../../packages/ast-helper/src/config/defaults.js';
import type { PartialConfig, Config } from '../../../packages/ast-helper/src/types.js';
import type { FileWatchConfig } from '../../../packages/ast-helper/src/filesystem/types.js';

describe('File Watching Configuration', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should include default file watching configuration', () => {
      expect(DEFAULT_CONFIG.fileWatching).toBeDefined();
      expect(DEFAULT_CONFIG.fileWatching).toMatchObject({
        watchPaths: expect.arrayContaining(['src', 'lib']),
        includePatterns: expect.arrayContaining(['**/*.ts', '**/*.js', '**/*.py']),
        excludePatterns: expect.arrayContaining(['**/node_modules/**', '**/.git/**']),
        debounceMs: 100,
        batchSize: 50,
        enableRecursive: true,
        followSymlinks: false
      });
    });

    it('should have valid default watch paths', () => {
      const watchConfig = DEFAULT_CONFIG.fileWatching!;
      expect(watchConfig.watchPaths).toHaveLength(2);
      expect(watchConfig.watchPaths).toEqual(['src', 'lib']);
    });

    it('should have sensible default patterns', () => {
      const watchConfig = DEFAULT_CONFIG.fileWatching!;
      
      // Should include common code file extensions
      expect(watchConfig.includePatterns).toContain('**/*.ts');
      expect(watchConfig.includePatterns).toContain('**/*.js');
      expect(watchConfig.includePatterns).toContain('**/*.py');
      
      // Should exclude common non-code directories
      expect(watchConfig.excludePatterns).toContain('**/node_modules/**');
      expect(watchConfig.excludePatterns).toContain('**/.git/**');
      expect(watchConfig.excludePatterns).toContain('**/dist/**');
      expect(watchConfig.excludePatterns).toContain('**/.astdb/**');
    });

    it('should have reasonable performance defaults', () => {
      const watchConfig = DEFAULT_CONFIG.fileWatching!;
      expect(watchConfig.debounceMs).toBe(100);
      expect(watchConfig.batchSize).toBe(50);
      expect(watchConfig.enableRecursive).toBe(true);
      expect(watchConfig.followSymlinks).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should validate and merge file watching configuration', () => {
      const partialConfig: PartialConfig = {
        fileWatching: {
          watchPaths: ['custom/path'],
          includePatterns: ['**/*.custom'],
          excludePatterns: ['**/temp/**'],
          debounceMs: 200,
          batchSize: 100,
          enableRecursive: false,
          followSymlinks: true
        }
      };

      const result = validateConfig(partialConfig);

      expect(result.fileWatching).toMatchObject({
        watchPaths: ['custom/path'],
        includePatterns: ['**/*.custom'],
        excludePatterns: ['**/temp/**'],
        debounceMs: 200,
        batchSize: 100,
        enableRecursive: false,
        followSymlinks: true
      });
    });

    it('should preserve defaults for missing file watching properties', () => {
      const partialConfig: PartialConfig = {
        fileWatching: {
          watchPaths: ['custom/path']
        }
      };

      const result = validateConfig(partialConfig);

      expect(result.fileWatching!.watchPaths).toEqual(['custom/path']);
      expect(result.fileWatching!.includePatterns).toEqual(DEFAULT_CONFIG.fileWatching!.includePatterns);
      expect(result.fileWatching!.excludePatterns).toEqual(DEFAULT_CONFIG.fileWatching!.excludePatterns);
      expect(result.fileWatching!.debounceMs).toBe(DEFAULT_CONFIG.fileWatching!.debounceMs);
    });

    describe('watchPaths validation', () => {
      it('should reject non-array watchPaths', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: 'not-an-array' as any
          }
        };

        expect(() => validateConfig(config)).toThrow(
          /fileWatching\.watchPaths must be an array/
        );
      });

      it('should reject empty watchPaths array', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: []
          }
        };

        expect(() => validateConfig(config)).toThrow(
          /fileWatching\.watchPaths must contain at least \d+ valid/
        );
      });

      it('should filter out invalid watchPaths', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['valid/path', '', '   ', 123 as any, null as any, 'another/valid']
          }
        };

        const result = validateConfig(config);
        expect(result.fileWatching!.watchPaths).toEqual(['valid/path', 'another/valid']);
      });
    });

    describe('patterns validation', () => {
      it('should reject non-array includePatterns', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            includePatterns: 'not-an-array' as any
          }
        };

        expect(() => validateConfig(config)).toThrow(
          /fileWatching\.includePatterns must be an array/
        );
      });

      it('should reject non-array excludePatterns', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            excludePatterns: 'not-an-array' as any
          }
        };

        expect(() => validateConfig(config)).toThrow(
          /fileWatching\.excludePatterns must be an array/
        );
      });

      it('should filter out invalid patterns', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            includePatterns: ['**/*.ts', '', '   ', 123 as any, '**/*.js'],
            excludePatterns: ['**/node_modules/**', null as any, '', '**/dist/**']
          }
        };

        const result = validateConfig(config);
        expect(result.fileWatching!.includePatterns).toEqual(['**/*.ts', '**/*.js']);
        expect(result.fileWatching!.excludePatterns).toEqual(['**/node_modules/**', '**/dist/**']);
      });
    });

    describe('numeric validation', () => {
      it('should validate debounceMs range', () => {
        const invalidConfigs = [
          { debounceMs: -1 },
          { debounceMs: 10001 },
          { debounceMs: 'invalid' as any }
        ];

        for (const invalidConfig of invalidConfigs) {
          const config: PartialConfig = {
            fileWatching: {
              watchPaths: ['src'],
              ...invalidConfig
            }
          };

          expect(() => validateConfig(config)).toThrow(
            /fileWatching\.debounceMs must be.*(?:between 0 and 10000|valid number)/
          );
        }
      });

      it('should validate batchSize range', () => {
        const invalidConfigs = [
          { batchSize: 0 },
          { batchSize: 1001 },
          { batchSize: 'invalid' as any }
        ];

        for (const invalidConfig of invalidConfigs) {
          const config: PartialConfig = {
            fileWatching: {
              watchPaths: ['src'],
              ...invalidConfig
            }
          };

          expect(() => validateConfig(config)).toThrow(
            /fileWatching\.batchSize must be.*(?:between 1 and 1000|valid number)/
          );
        }
      });

      it('should accept valid numeric values', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            debounceMs: 0,
            batchSize: 1
          }
        };

        const result = validateConfig(config);
        expect(result.fileWatching!.debounceMs).toBe(0);
        expect(result.fileWatching!.batchSize).toBe(1);
      });

      it('should accept maximum valid numeric values', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            debounceMs: 10000,
            batchSize: 1000
          }
        };

        const result = validateConfig(config);
        expect(result.fileWatching!.debounceMs).toBe(10000);
        expect(result.fileWatching!.batchSize).toBe(1000);
      });
    });

    describe('boolean validation', () => {
      it('should convert truthy values to true', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            enableRecursive: 1 as any,
            followSymlinks: 'true' as any
          }
        };

        const result = validateConfig(config);
        expect(result.fileWatching!.enableRecursive).toBe(true);
        expect(result.fileWatching!.followSymlinks).toBe(true);
      });

      it('should convert falsy values to false', () => {
        const config: PartialConfig = {
          fileWatching: {
            watchPaths: ['src'],
            enableRecursive: 0 as any,
            followSymlinks: 'false' as any
          }
        };

        const result = validateConfig(config);
        expect(result.fileWatching!.enableRecursive).toBe(false);
        expect(result.fileWatching!.followSymlinks).toBe(false);
      });
    });
  });

  describe('integration with existing config', () => {
    it('should work alongside existing configuration options', () => {
      const config: PartialConfig = {
        parseGlob: ['**/*.custom'],
        watchGlob: ['custom/**/*'],
        topK: 10,
        fileWatching: {
          watchPaths: ['custom'],
          debounceMs: 500
        }
      };

      const result = validateConfig(config);

      // Check that existing config is preserved
      expect(result.parseGlob).toEqual(['**/*.custom']);
      expect(result.watchGlob).toEqual(['custom/**/*']);
      expect(result.topK).toBe(10);

      // Check that file watching config is applied
      expect(result.fileWatching!.watchPaths).toEqual(['custom']);
      expect(result.fileWatching!.debounceMs).toBe(500);

      // Check that defaults are preserved for unspecified values
      expect(result.outputDir).toBe(DEFAULT_CONFIG.outputDir);
      expect(result.fileWatching!.batchSize).toBe(DEFAULT_CONFIG.fileWatching!.batchSize);
    });

    it('should not affect config when fileWatching is not provided', () => {
      const config: PartialConfig = {
        topK: 15
      };

      const result = validateConfig(config);

      expect(result.topK).toBe(15);
      expect(result.fileWatching).toEqual(DEFAULT_CONFIG.fileWatching);
    });
  });
});