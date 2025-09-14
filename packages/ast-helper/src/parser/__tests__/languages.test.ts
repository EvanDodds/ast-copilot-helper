import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import {
  SUPPORTED_LANGUAGES,
  LanguageDetector,
  detectLanguage,
  isLanguageSupported,
  getLanguageConfig,
  isFileSupported,
  getAllSupportedLanguages,
} from '../languages.js';
import { LanguageConfig } from '../types.js';

describe('Language Support Configuration', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should contain expected languages', () => {
      const languageNames = SUPPORTED_LANGUAGES.map(lang => lang.name);
      expect(languageNames).toContain('typescript');
      expect(languageNames).toContain('javascript');
      expect(languageNames).toContain('python');
    });

    it('should have valid configurations', () => {
      for (const config of SUPPORTED_LANGUAGES) {
        expect(config.name).toBeTruthy();
        expect(config.extensions).toBeInstanceOf(Array);
        expect(config.extensions.length).toBeGreaterThan(0);
        expect(config.grammarUrl || config.parserModule).toBeTruthy();
        if (config.grammarUrl) {
          // Grammar hash can be empty for runtime generation
          expect(typeof config.grammarHash).toBe('string');
          expect(config.wasmPath).toBeTruthy();
        }
      }
    });

    it('should have unique language names', () => {
      const names = SUPPORTED_LANGUAGES.map(lang => lang.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('should have unique extensions across languages', () => {
      const extensionsMap = new Map<string, string>();
      
      for (const config of SUPPORTED_LANGUAGES) {
        for (const ext of config.extensions) {
          if (extensionsMap.has(ext)) {
            throw new Error(`Duplicate extension ${ext} found in ${config.name} and ${extensionsMap.get(ext)}`);
          }
          extensionsMap.set(ext, config.name);
        }
      }
    });
  });

  describe('LanguageDetector', () => {
    describe('detectLanguage', () => {
      it('should detect TypeScript files', () => {
        expect(LanguageDetector.detectLanguage('test.ts')).toBe('typescript');
        expect(LanguageDetector.detectLanguage('component.tsx')).toBe('typescript');
        expect(LanguageDetector.detectLanguage('/path/to/file.ts')).toBe('typescript');
      });

      it('should detect JavaScript files', () => {
        expect(LanguageDetector.detectLanguage('test.js')).toBe('javascript');
        expect(LanguageDetector.detectLanguage('component.jsx')).toBe('javascript');
        expect(LanguageDetector.detectLanguage('module.mjs')).toBe('javascript');
        expect(LanguageDetector.detectLanguage('common.cjs')).toBe('javascript');
      });

      it('should detect Python files', () => {
        expect(LanguageDetector.detectLanguage('test.py')).toBe('python');
        expect(LanguageDetector.detectLanguage('types.pyi')).toBe('python');
        expect(LanguageDetector.detectLanguage('script.pyw')).toBe('python');
      });

      it('should return null for unsupported files', () => {
        expect(LanguageDetector.detectLanguage('test.txt')).toBe(null);
        expect(LanguageDetector.detectLanguage('README.md')).toBe(null);
        expect(LanguageDetector.detectLanguage('config.json')).toBe(null);
      });

      it('should be case-insensitive', () => {
        expect(LanguageDetector.detectLanguage('Test.TS')).toBe('typescript');
        expect(LanguageDetector.detectLanguage('Script.PY')).toBe('python');
      });
    });

    describe('getLanguageConfig', () => {
      it('should return config for supported languages', () => {
        const tsConfig = LanguageDetector.getLanguageConfig('typescript');
        expect(tsConfig).toBeTruthy();
        expect(tsConfig?.name).toBe('typescript');
        expect(tsConfig?.extensions).toContain('.ts');
      });

      it('should return null for unsupported languages', () => {
        expect(LanguageDetector.getLanguageConfig('ruby')).toBe(null);
        expect(LanguageDetector.getLanguageConfig('go')).toBe(null);
      });

      it('should be case-insensitive', () => {
        expect(LanguageDetector.getLanguageConfig('TypeScript')).toBeTruthy();
        expect(LanguageDetector.getLanguageConfig('PYTHON')).toBeTruthy();
      });
    });

    describe('getLanguageByExtension', () => {
      it('should return config for supported extensions', () => {
        const tsConfig = LanguageDetector.getLanguageByExtension('test.ts');
        expect(tsConfig?.name).toBe('typescript');

        const pyConfig = LanguageDetector.getLanguageByExtension('script.py');
        expect(pyConfig?.name).toBe('python');
      });

      it('should return null for unsupported extensions', () => {
        expect(LanguageDetector.getLanguageByExtension('test.txt')).toBe(null);
        expect(LanguageDetector.getLanguageByExtension('config.yaml')).toBe(null);
      });
    });

    describe('isLanguageSupported', () => {
      it('should return true for supported languages', () => {
        expect(LanguageDetector.isLanguageSupported('typescript')).toBe(true);
        expect(LanguageDetector.isLanguageSupported('javascript')).toBe(true);
        expect(LanguageDetector.isLanguageSupported('python')).toBe(true);
      });

      it('should return false for unsupported languages', () => {
        expect(LanguageDetector.isLanguageSupported('ruby')).toBe(false);
        expect(LanguageDetector.isLanguageSupported('go')).toBe(false);
      });

      it('should be case-insensitive', () => {
        expect(LanguageDetector.isLanguageSupported('TypeScript')).toBe(true);
        expect(LanguageDetector.isLanguageSupported('PYTHON')).toBe(true);
      });
    });

    describe('isExtensionSupported', () => {
      it('should return true for supported extensions', () => {
        expect(LanguageDetector.isExtensionSupported('test.ts')).toBe(true);
        expect(LanguageDetector.isExtensionSupported('script.py')).toBe(true);
        expect(LanguageDetector.isExtensionSupported('app.js')).toBe(true);
      });

      it('should return false for unsupported extensions', () => {
        expect(LanguageDetector.isExtensionSupported('test.txt')).toBe(false);
        expect(LanguageDetector.isExtensionSupported('config.yaml')).toBe(false);
      });
    });

    describe('getAllSupportedLanguages', () => {
      it('should return all language configurations', () => {
        const languages = LanguageDetector.getAllSupportedLanguages();
        expect(languages.length).toBe(SUPPORTED_LANGUAGES.length);
        
        const names = languages.map(lang => lang.name);
        expect(names).toContain('typescript');
        expect(names).toContain('javascript');
        expect(names).toContain('python');
      });

      it('should return a copy of the array', () => {
        const languages1 = LanguageDetector.getAllSupportedLanguages();
        const languages2 = LanguageDetector.getAllSupportedLanguages();
        expect(languages1).not.toBe(languages2);
        expect(languages1).toEqual(languages2);
      });
    });

    describe('getAllSupportedExtensions', () => {
      it('should return all supported extensions', () => {
        const extensions = LanguageDetector.getAllSupportedExtensions();
        expect(extensions).toContain('.ts');
        expect(extensions).toContain('.js');
        expect(extensions).toContain('.py');
        expect(extensions).toContain('.tsx');
      });

      it('should return sorted extensions', () => {
        const extensions = LanguageDetector.getAllSupportedExtensions();
        const sorted = [...extensions].sort();
        expect(extensions).toEqual(sorted);
      });
    });

    describe('addLanguage', () => {
      let originalLanguages: LanguageConfig[];

      beforeEach(() => {
        // Save original configurations
        originalLanguages = [...SUPPORTED_LANGUAGES.map(lang => ({ ...lang }))];
      });

      afterEach(() => {
        // Restore original languages
        SUPPORTED_LANGUAGES.length = 0; // Clear array
        SUPPORTED_LANGUAGES.push(...originalLanguages); // Restore original configurations
        // Rebuild maps to ensure clean state
        (LanguageDetector as any).buildMaps();
      });

      it('should add new language configuration', () => {
        const rustConfig: LanguageConfig = {
          name: 'rust',
          extensions: ['.rs'],
          grammarUrl: 'https://example.com/rust.wasm',
          grammarHash: 'mock-hash',
          wasmPath: 'rust.wasm',
        };

        LanguageDetector.addLanguage(rustConfig);
        
        expect(LanguageDetector.isLanguageSupported('rust')).toBe(true);
        expect(LanguageDetector.detectLanguage('test.rs')).toBe('rust');
      });

      it('should replace existing language configuration', () => {
        const originalTsConfig = LanguageDetector.getLanguageConfig('typescript');
        expect(originalTsConfig?.extensions).toContain('.ts');

        const newTsConfig: LanguageConfig = {
          name: 'typescript',
          extensions: ['.ts', '.tsx', '.d.ts'], // Added .d.ts
          grammarUrl: 'https://example.com/typescript-new.wasm',
          grammarHash: 'new-hash',
          wasmPath: 'typescript-new.wasm',
          parserModule: 'tree-sitter-typescript-new', // Keep parserModule
        };

        LanguageDetector.addLanguage(newTsConfig);
        
        const updatedConfig = LanguageDetector.getLanguageConfig('typescript');
        expect(updatedConfig?.extensions).toContain('.d.ts');
        expect(updatedConfig?.grammarHash).toBe('new-hash');
        expect(updatedConfig?.parserModule).toBe('tree-sitter-typescript-new');
      });

      it('should throw error for invalid configuration', () => {
        expect(() => {
          LanguageDetector.addLanguage({} as LanguageConfig);
        }).toThrow('Invalid language configuration');

        expect(() => {
          LanguageDetector.addLanguage({
            name: 'test',
            extensions: [],
            grammarUrl: '',
            grammarHash: '',
            wasmPath: '',
          } as LanguageConfig);
        }).toThrow('Invalid language configuration');
      });
    });

    describe('detectLanguageFromContent', () => {
      it('should detect TypeScript from content', () => {
        const tsContent = `
          interface User {
            name: string;
            age: number;
          }
          
          export const user: User = { name: 'test', age: 25 };
        `;
        
        expect(LanguageDetector.detectLanguageFromContent('unknown.txt', tsContent)).toBe('typescript');
      });

      it('should detect JavaScript from content', () => {
        const jsContent = `
          const fs = require('fs');
          
          module.exports = {
            readFile: (path) => fs.readFileSync(path, 'utf8')
          };
        `;
        
        expect(LanguageDetector.detectLanguageFromContent('unknown.txt', jsContent)).toBe('javascript');
      });

      it('should detect Python from content', () => {
        const pyContent = `
          from typing import List
          import os
          
          def process_files(files: List[str]) -> None:
              for file in files:
                  print(f"Processing {file}")
          
          if __name__ == "__main__":
              process_files(["test.py"])
        `;
        
        expect(LanguageDetector.detectLanguageFromContent('unknown.txt', pyContent)).toBe('python');
      });

      it('should prefer extension-based detection', () => {
        const jsContent = 'const x = 1;';
        expect(LanguageDetector.detectLanguageFromContent('test.ts', jsContent)).toBe('typescript');
      });

      it('should return null for unrecognizable content', () => {
        const textContent = 'This is just plain text with no code patterns.';
        expect(LanguageDetector.detectLanguageFromContent('unknown.txt', textContent)).toBe(null);
      });
    });

    describe('getLanguageStats', () => {
      it('should return statistics for all languages', () => {
        const stats = LanguageDetector.getLanguageStats();
        
        expect(stats.typescript).toBeDefined();
        expect(stats.typescript.extensions).toBeGreaterThan(0);
        expect(stats.typescript.hasNative).toBe(true);
        expect(stats.typescript.hasWasm).toBe(true);
        
        expect(stats.python).toBeDefined();
        expect(stats.javascript).toBeDefined();
      });
    });

    describe('removeLanguage', () => {
      let originalLanguages: LanguageConfig[];

      beforeEach(() => {
        // Save original configurations
        originalLanguages = [...SUPPORTED_LANGUAGES.map(lang => ({ ...lang }))];
      });

      afterEach(() => {
        // Restore original languages
        SUPPORTED_LANGUAGES.length = 0; // Clear array
        SUPPORTED_LANGUAGES.push(...originalLanguages); // Restore original configurations
        // Rebuild maps
        (LanguageDetector as any).buildMaps();
      });

      it('should remove existing language', () => {
        // Add a test language first
        const testConfig: LanguageConfig = {
          name: 'test-lang',
          extensions: ['.test'],
          grammarUrl: 'https://example.com/test.wasm',
          grammarHash: 'test-hash',
          wasmPath: 'test.wasm',
        };
        
        LanguageDetector.addLanguage(testConfig);
        expect(LanguageDetector.isLanguageSupported('test-lang')).toBe(true);
        
        const removed = LanguageDetector.removeLanguage('test-lang');
        expect(removed).toBe(true);
        expect(LanguageDetector.isLanguageSupported('test-lang')).toBe(false);
      });

      it('should return false for non-existent language', () => {
        const removed = LanguageDetector.removeLanguage('non-existent');
        expect(removed).toBe(false);
      });
    });
  });

  describe('Convenience Functions', () => {
    it('should provide detectLanguage function', () => {
      expect(detectLanguage('test.ts')).toBe('typescript');
      expect(detectLanguage('script.py')).toBe('python');
    });

    it('should provide isLanguageSupported function', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('ruby')).toBe(false);
    });

    it('should provide getLanguageConfig function', () => {
      const config = getLanguageConfig('python');
      expect(config?.name).toBe('python');
    });

    it('should provide isFileSupported function', () => {
      expect(isFileSupported('test.ts')).toBe(true);
      expect(isFileSupported('test.txt')).toBe(false);
    });

    it('should provide getAllSupportedLanguages function', () => {
      const languages = getAllSupportedLanguages();
      expect(languages.length).toBeGreaterThan(0);
    });
  });
});