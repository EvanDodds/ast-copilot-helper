/**
 * Grammar Management System for Tree-sitter
 * Native-only implementation - no WASM fallback
 */

import type { LanguageConfig, GrammarManager } from "./types.js";
import { getLanguageConfig } from "./languages.js";
import { ParserLoadError, NativeModuleError } from "./errors.js";

export class TreeSitterGrammarManager implements GrammarManager {
  private readonly maxRetries = 3;

  constructor(_baseDir = ".astdb") {
    // No longer need base directory for native-only approach
  }

  /**
   * Load a parser for the specified language
   * Uses native tree-sitter only
   */
  async loadParser(language: string): Promise<unknown> {
    try {
      return await this.loadNativeParser(language);
    } catch (error) {
      const nativeError =
        error instanceof Error ? error : new Error(String(error));

      // Check if it's an unsupported language (no config found)
      if (nativeError.message.includes("Language configuration not found")) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const optimizedError = new ParserLoadError(
        language,
        nativeError,
        undefined,
        {
          context: {
            retryAttempts: this.maxRetries,
          },
        },
      );

      throw optimizedError;
    }
  }

  /**
   * Load native Tree-sitter parser
   */
  private async loadNativeParser(language: string): Promise<unknown> {
    try {
      // Dynamic import of native tree-sitter
      const TreeSitter = (await import("tree-sitter")).default;
      const parser = new TreeSitter();

      let languageModule: unknown;

      // Load the appropriate language module dynamically
      const config = this.getLanguageConfig(language);
      const moduleName = config.parserModule;

      if (!moduleName) {
        throw new Error(
          `No parser module configured for language: ${language}`,
        );
      }

      try {
        // Special handling for TypeScript/TSX
        if (language === "typescript") {
          const tsModule = await import("tree-sitter-typescript");
          languageModule =
            tsModule.default?.typescript ||
            tsModule.typescript ||
            tsModule.default;
        } else if (language === "tsx") {
          const tsModule = await import("tree-sitter-typescript");
          languageModule =
            tsModule.default?.tsx || tsModule.tsx || tsModule.default;
        } else {
          // Generic module loading for all other languages using CommonJS
          // Tree-sitter language packages use native bindings that work better with CommonJS
          const { createRequire } = await import("module");
          const require = createRequire(import.meta.url);

          try {
            // Use CommonJS require for better native module compatibility
            const nativeModule = require(moduleName);
            languageModule = nativeModule;
          } catch (_requireError) {
            // Fallback to ES modules import if CommonJS fails
            const module = await import(moduleName);
            // Try different export patterns: default export, named export, or module.exports
            languageModule =
              module.default ||
              module[language] ||
              module["module.exports"] ||
              module;
          }
        }

        if (!languageModule) {
          throw new Error(
            `Language module not found or has no default export: ${moduleName}`,
          );
        }
      } catch (_importError) {
        // Try cache clearing and retry once
        if (typeof require !== "undefined" && require.cache) {
          try {
            delete require.cache[require.resolve(moduleName)];
          } catch {
            // Ignore cache clearing errors
          }
        }

        try {
          // Retry import after cache clear
          if (language === "typescript") {
            const tsModule = await import("tree-sitter-typescript");
            languageModule =
              tsModule.default?.typescript ||
              tsModule.typescript ||
              tsModule.default;
          } else if (language === "tsx") {
            const tsModule = await import("tree-sitter-typescript");
            languageModule =
              tsModule.default?.tsx || tsModule.tsx || tsModule.default;
          } else {
            // Retry with CommonJS approach
            const { createRequire } = await import("module");
            const require = createRequire(import.meta.url);

            try {
              // Use CommonJS require for better native module compatibility
              const nativeModule = require(moduleName);
              languageModule = this.extractLanguageObject(
                nativeModule,
                language,
              );
            } catch (_retryRequireError) {
              // Final fallback to ES modules import
              const module = await import(moduleName);
              languageModule = this.extractLanguageObject(
                module.default ||
                  module[language] ||
                  module["module.exports"] ||
                  module,
                language,
              );
            }
          }
        } catch (retryError) {
          throw new Error(
            `Failed to load native parser module '${moduleName}' for language '${language}': ${(retryError as Error).message}. ` +
              `Make sure the package is installed: yarn add ${moduleName}`,
          );
        }
      }

      // Set the language - the module should be a language function/object
      parser.setLanguage(
        languageModule as Parameters<typeof parser.setLanguage>[0],
      );
      return parser;
    } catch (error) {
      const nativeError = new NativeModuleError(
        language,
        `tree-sitter-${language}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          context: {
            attemptedImport: true,
            moduleLoadingStrategy: "dynamic import with cache clearing",
          },
        },
      );
      throw nativeError;
    }
  }

  /**
   * Extract language object from various module export patterns
   */
  private extractLanguageObject(
    moduleExport: unknown,
    language: string,
  ): unknown {
    if (!moduleExport) {
      throw new Error(`Module export is null or undefined for ${language}`);
    }

    // Check for function export (common pattern)
    if (typeof moduleExport === "function") {
      return moduleExport;
    }

    // Check for object with language property
    if (
      typeof moduleExport === "object" &&
      moduleExport !== null &&
      "language" in moduleExport
    ) {
      return (moduleExport as { language: unknown }).language;
    }

    // Return the module itself if it looks like a language object
    return moduleExport;
  }

  /**
   * Get language configuration
   */
  private getLanguageConfig(language: string): LanguageConfig {
    const config = getLanguageConfig(language);
    if (!config) {
      throw new Error(`Language configuration not found for: ${language}`);
    }
    return config;
  }

  /**
   * Clean up cached grammars (no-op for native-only)
   */
  async cleanCache(): Promise<void> {
    // No cache to clean in native-only mode
    return Promise.resolve();
  }

  // ===== Backward Compatibility Methods (WASM-era stubs) =====
  // These methods provide compatibility with existing tests while maintaining native-only operation

  /**
   * Download grammar - stub for native-only (returns native module path)
   * @deprecated Use native-only architecture, no downloads needed
   */
  async downloadGrammar(language: string): Promise<string> {
    // For native-only, just validate the language is supported and return mock path
    const config = this.getLanguageConfig(language);
    return `native:${config.parserModule}`;
  }

  /**
   * Get cached grammar path - stub for native-only
   * @deprecated Use native-only architecture, no file paths needed
   */
  async getCachedGrammarPath(language: string): Promise<string> {
    // For native-only, just validate the language is supported and return mock path
    const config = this.getLanguageConfig(language);
    return `native:${config.parserModule}`;
  }

  /**
   * Verify grammar integrity - stub for native-only
   * @deprecated Native modules are verified at load time
   */
  async verifyGrammarIntegrity(language: string): Promise<boolean> {
    try {
      // Try to get config as verification
      this.getLanguageConfig(language);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache information - stub for native-only
   * @deprecated No cache management in native-only mode
   */
  getCacheInfo(): { size: number; languages: string[] } {
    // Return mock cache info showing supported languages
    const supportedLanguages = [
      "typescript",
      "javascript",
      "python",
      "c",
      "cpp",
      "java",
    ];
    return {
      size: 0, // No file cache in native-only mode
      languages: supportedLanguages,
    };
  }

  /**
   * Clear cache - alias for cleanCache
   * @deprecated No cache management in native-only mode
   */
  async clearCache(): Promise<void> {
    return this.cleanCache();
  }
}

// Export alias for compatibility
export { TreeSitterGrammarManager as GrammarManager };
