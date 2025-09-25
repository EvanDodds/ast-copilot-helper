/**
 * Language support configuration for Tree-sitter parsers
 * Defines supported languages with their grammars and detection rules
 */

import * as path from "path";
import type { LanguageConfig } from "./types.js";

/**
 * Supported languages configuration
 * Each language includes file extensions, grammar URLs, and hashes for verification
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    name: "typescript",
    extensions: [".ts", ".tsx"],
    grammarUrl:
      "https://unpkg.com/tree-sitter-typescript@0.20.4/tree-sitter-typescript.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-typescript",
    wasmPath: "tree-sitter-typescript.wasm",
  },
  {
    name: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    grammarUrl:
      "https://unpkg.com/tree-sitter-javascript@0.21.4/tree-sitter-javascript.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-javascript",
    wasmPath: "tree-sitter-javascript.wasm",
  },
  {
    name: "python",
    extensions: [".py", ".pyi", ".pyw"],
    grammarUrl:
      "https://unpkg.com/tree-sitter-python@0.20.4/tree-sitter-python.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-python",
    wasmPath: "tree-sitter-python.wasm",
  },

  // Tier 1 Enterprise Languages
  {
    name: "java",
    extensions: [".java"],
    grammarUrl:
      "https://unpkg.com/tree-sitter-java@0.20.2/tree-sitter-java.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-java",
    wasmPath: "tree-sitter-java.wasm",
  },
  {
    name: "csharp",
    extensions: [".cs", ".csx"],
    grammarUrl:
      "https://unpkg.com/tree-sitter-c-sharp@0.20.0/tree-sitter-c-sharp.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-c-sharp",
    wasmPath: "tree-sitter-c-sharp.wasm",
  },
  {
    name: "go",
    extensions: [".go"],
    grammarUrl: "https://unpkg.com/tree-sitter-go@0.20.0/tree-sitter-go.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-go",
    wasmPath: "tree-sitter-go.wasm",
  },
];

/**
 * Language detection and configuration utilities
 */
export class LanguageDetector {
  private static languageMap: Map<string, LanguageConfig> = new Map();
  private static extensionMap: Map<string, LanguageConfig> = new Map();

  static {
    // Initialize maps for fast lookups
    this.buildMaps();
  }

  /**
   * Detect language from file path based on extension
   */
  static detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const config = this.extensionMap.get(ext);
    return config?.name ?? null;
  }

  /**
   * Get language configuration by name
   */
  static getLanguageConfig(language: string): LanguageConfig | null {
    return this.languageMap.get(language.toLowerCase()) ?? null;
  }

  /**
   * Get language configuration by file extension
   */
  static getLanguageByExtension(filePath: string): LanguageConfig | null {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap.get(ext) ?? null;
  }

  /**
   * Check if a language is supported
   */
  static isLanguageSupported(language: string): boolean {
    return this.languageMap.has(language.toLowerCase());
  }

  /**
   * Check if a file extension is supported
   */
  static isExtensionSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap.has(ext);
  }

  /**
   * Get all supported languages
   */
  static getAllSupportedLanguages(): LanguageConfig[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * Get all supported file extensions
   */
  static getAllSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys()).sort();
  }

  /**
   * Add a new language configuration (for extensibility)
   */
  static addLanguage(config: LanguageConfig): void {
    // Validate configuration
    if (!config.name || !config.extensions || config.extensions.length === 0) {
      throw new Error(
        "Invalid language configuration: name and extensions are required",
      );
    }

    if (!config.grammarUrl && !config.parserModule) {
      throw new Error(
        "Invalid language configuration: either grammarUrl or parserModule is required",
      );
    }

    // Add to internal arrays and rebuild maps
    const existingIndex = SUPPORTED_LANGUAGES.findIndex(
      (lang) => lang.name === config.name,
    );
    if (existingIndex >= 0) {
      SUPPORTED_LANGUAGES[existingIndex] = config;
    } else {
      SUPPORTED_LANGUAGES.push(config);
    }

    this.buildMaps();
  }

  /**
   * Remove a language configuration
   */
  static removeLanguage(languageName: string): boolean {
    const index = SUPPORTED_LANGUAGES.findIndex(
      (lang) => lang.name === languageName,
    );
    if (index >= 0) {
      SUPPORTED_LANGUAGES.splice(index, 1);
      this.buildMaps();
      return true;
    }
    return false;
  }

  /**
   * Detect language from file content (advanced detection)
   * This could be extended to analyze file content for better detection
   */
  static detectLanguageFromContent(
    filePath: string,
    content: string,
  ): string | null {
    // First try extension-based detection
    const extLang = this.detectLanguage(filePath);
    if (extLang) {
      return extLang;
    }

    // Content-based detection patterns
    const contentPatterns: Array<{ pattern: RegExp; language: string }> = [
      // TypeScript-specific patterns
      {
        pattern: /^import\s+.*\s+from\s+['"].*['"];?\s*$/m,
        language: "typescript",
      },
      { pattern: /interface\s+\w+\s*\{/, language: "typescript" },
      { pattern: /type\s+\w+\s*=/, language: "typescript" },
      {
        pattern: /:\s*(string|number|boolean|any)\s*[;,}]/,
        language: "typescript",
      },

      // JavaScript-specific patterns
      { pattern: /require\s*\(['"].*['"]\)/, language: "javascript" },
      { pattern: /module\.exports\s*=/, language: "javascript" },
      { pattern: /exports\.\w+\s*=/, language: "javascript" },

      // Python-specific patterns
      { pattern: /^from\s+\w+\s+import\s+/m, language: "python" },
      { pattern: /^import\s+\w+/m, language: "python" },
      { pattern: /def\s+\w+\s*\([^)]*\)\s*:/, language: "python" },
      { pattern: /class\s+\w+\s*(\([^)]*\))?\s*:/, language: "python" },
      { pattern: /if\s+__name__\s*==\s*['"]__main__['"]/, language: "python" },

      // Java-specific patterns
      { pattern: /^package\s+[\w.]+\s*;/m, language: "java" },
      { pattern: /^import\s+[\w.]+\s*;/m, language: "java" },
      { pattern: /public\s+class\s+\w+/, language: "java" },
      { pattern: /public\s+static\s+void\s+main\s*\(/, language: "java" },
      { pattern: /@Override|@Deprecated|@SuppressWarnings/, language: "java" },

      // C#-specific patterns
      { pattern: /^using\s+[\w.]+\s*;/m, language: "csharp" },
      { pattern: /^namespace\s+[\w.]+\s*{?/m, language: "csharp" },
      { pattern: /public\s+class\s+\w+/, language: "csharp" },
      { pattern: /static\s+void\s+Main\s*\(/, language: "csharp" },
      { pattern: /\[.*\]\s*$/, language: "csharp" },

      // Go-specific patterns
      { pattern: /^package\s+\w+$/m, language: "go" },
      { pattern: /^import\s+\(/, language: "go" },
      { pattern: /func\s+\w+\s*\([^)]*\)/, language: "go" },
      { pattern: /type\s+\w+\s+struct\s*{/, language: "go" },
      { pattern: /func\s+main\s*\(\s*\)/, language: "go" },
    ];

    // Check content against patterns
    for (const { pattern, language } of contentPatterns) {
      if (pattern.test(content)) {
        if (this.isLanguageSupported(language)) {
          return language;
        }
      }
    }

    return null;
  }

  /**
   * Get language statistics
   */
  static getLanguageStats(): Record<
    string,
    { extensions: number; hasNative: boolean; hasWasm: boolean }
  > {
    const stats: Record<
      string,
      { extensions: number; hasNative: boolean; hasWasm: boolean }
    > = {};

    for (const config of SUPPORTED_LANGUAGES) {
      stats[config.name] = {
        extensions: config.extensions.length,
        hasNative: !!config.parserModule,
        hasWasm: !!config.grammarUrl,
      };
    }

    return stats;
  }

  /**
   * Build internal lookup maps for performance
   */
  private static buildMaps(): void {
    this.languageMap.clear();
    this.extensionMap.clear();

    for (const config of SUPPORTED_LANGUAGES) {
      // Map by language name
      this.languageMap.set(config.name.toLowerCase(), config);

      // Map by extensions
      for (const ext of config.extensions) {
        this.extensionMap.set(ext.toLowerCase(), config);
      }
    }
  }
}

/**
 * Convenience functions for common operations
 */

/**
 * Quick language detection from file path
 */
export function detectLanguage(filePath: string): string | null {
  return LanguageDetector.detectLanguage(filePath);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return LanguageDetector.isLanguageSupported(language);
}

/**
 * Get language configuration by name
 */
export function getLanguageConfig(language: string): LanguageConfig | null {
  return LanguageDetector.getLanguageConfig(language);
}

/**
 * Check if a file is supported based on its extension
 */
export function isFileSupported(filePath: string): boolean {
  return LanguageDetector.isExtensionSupported(filePath);
}

/**
 * Get all supported languages
 */
export function getAllSupportedLanguages(): LanguageConfig[] {
  return LanguageDetector.getAllSupportedLanguages();
}
