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
    extensions: [".ts"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-typescript.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-typescript/typescript",
    wasmPath: "tree-sitter-typescript.wasm",
  },
  {
    name: "tsx",
    extensions: [".tsx"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-tsx.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-typescript/tsx",
    wasmPath: "tree-sitter-tsx.wasm",
  },
  {
    name: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.21.4/tree-sitter-javascript.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-javascript",
    wasmPath: "tree-sitter-javascript.wasm",
  },
  {
    name: "python",
    extensions: [".py", ".pyi", ".pyw"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.21.0/tree-sitter-python.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-python",
    wasmPath: "tree-sitter-python.wasm",
  },

  // Tier 1 Enterprise Languages
  {
    name: "java",
    extensions: [".java"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-java/releases/download/v0.23.2/tree-sitter-java.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-java",
    wasmPath: "tree-sitter-java.wasm",
  },
  {
    name: "csharp",
    extensions: [".cs", ".csx"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-c-sharp/releases/download/v0.21.4/tree-sitter-c-sharp.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-c-sharp",
    wasmPath: "tree-sitter-c-sharp.wasm",
  },
  {
    name: "go",
    extensions: [".go"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-go/releases/download/v0.23.1/tree-sitter-go.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-go",
    wasmPath: "tree-sitter-go.wasm",
  },

  // Tier 2 Developer Priority Languages
  {
    name: "rust",
    extensions: [".rs"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-rust/releases/download/v0.23.0/tree-sitter-rust.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-rust",
    wasmPath: "tree-sitter-rust.wasm",
  },
  {
    name: "c",
    extensions: [".c", ".h"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-c/releases/download/v0.23.1/tree-sitter-c.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-c",
    wasmPath: "tree-sitter-c.wasm",
  },
  {
    name: "cpp",
    extensions: [".cpp", ".cxx", ".cc", ".c++", ".hpp", ".hxx", ".hh", ".h++"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-cpp/releases/download/v0.23.1/tree-sitter-cpp.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-cpp",
    wasmPath: "tree-sitter-cpp.wasm",
  },
  {
    name: "php",
    extensions: [".php", ".phtml", ".php3", ".php4", ".php5", ".phps"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-php/releases/download/v0.23.4/tree-sitter-php.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-php",
    wasmPath: "tree-sitter-php.wasm",
  },
  {
    name: "ruby",
    extensions: [".rb", ".rbw", ".rake", ".gemspec"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-ruby/releases/download/v0.22.0/tree-sitter-ruby.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-ruby",
    wasmPath: "tree-sitter-ruby.wasm",
  },
  {
    name: "kotlin",
    extensions: [".kt", ".kts"],
    grammarUrl:
      "https://github.com/fwcd/tree-sitter-kotlin/releases/download/0.3.8/tree-sitter-kotlin.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-kotlin",
    wasmPath: "tree-sitter-kotlin.wasm",
  },

  // Tier 3 Languages (Specialized Priority)
  {
    name: "swift",
    extensions: [".swift"],
    grammarUrl:
      "https://github.com/alex-pinkus/tree-sitter-swift/releases/download/v0.7.1/tree-sitter-swift.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-swift",
    wasmPath: "tree-sitter-swift.wasm",
  },
  {
    name: "dart",
    extensions: [".dart"],
    grammarUrl:
      "https://github.com/UserNobody14/tree-sitter-dart/releases/download/v1.0.0/tree-sitter-dart.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-dart",
    wasmPath: "tree-sitter-dart.wasm",
  },
  {
    name: "scala",
    extensions: [".scala", ".sc"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-scala/releases/download/v0.24.0/tree-sitter-scala.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-scala",
    wasmPath: "tree-sitter-scala.wasm",
  },
  {
    name: "lua",
    extensions: [".lua"],
    grammarUrl:
      "https://github.com/tree-sitter-grammars/tree-sitter-lua/releases/download/v2.1.3/tree-sitter-lua.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-lua",
    wasmPath: "tree-sitter-lua.wasm",
  },
  {
    name: "bash",
    extensions: [".sh", ".bash", ".zsh", ".fish"],
    grammarUrl:
      "https://github.com/tree-sitter/tree-sitter-bash/releases/download/v0.25.0/tree-sitter-bash.wasm",
    grammarHash: "", // Will be computed at runtime for production safety
    parserModule: "tree-sitter-bash",
    wasmPath: "tree-sitter-bash.wasm",
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

      // Rust-specific patterns
      { pattern: /^use\s+[\w:]+\s*;/m, language: "rust" },
      { pattern: /^mod\s+\w+\s*;?/m, language: "rust" },
      { pattern: /fn\s+\w+\s*\([^)]*\)/, language: "rust" },
      { pattern: /struct\s+\w+\s*{/, language: "rust" },
      { pattern: /impl\s+.*\s+for\s+/, language: "rust" },
      { pattern: /let\s+mut\s+\w+/, language: "rust" },
      { pattern: /#\[derive\(.*\)\]/, language: "rust" },

      // C-specific patterns
      { pattern: /^#include\s*<[^>]+>/m, language: "c" },
      { pattern: /^#define\s+\w+/m, language: "c" },
      { pattern: /int\s+main\s*\([^)]*\)/, language: "c" },
      { pattern: /typedef\s+struct\s*{/, language: "c" },
      { pattern: /printf\s*\(/, language: "c" },

      // C++-specific patterns
      { pattern: /^#include\s*<iostream>/m, language: "cpp" },
      { pattern: /std::\w+/, language: "cpp" },
      { pattern: /class\s+\w+\s*{/, language: "cpp" },
      { pattern: /namespace\s+\w+\s*{/, language: "cpp" },
      { pattern: /template\s*<[^>]*>/, language: "cpp" },
      { pattern: /std::cout|std::endl/, language: "cpp" },

      // PHP-specific patterns
      { pattern: /^<\?php/m, language: "php" },
      { pattern: /\$\w+\s*=/, language: "php" },
      { pattern: /function\s+\w+\s*\([^)]*\)/, language: "php" },
      { pattern: /class\s+\w+\s*{/, language: "php" },
      { pattern: /echo\s+/, language: "php" },
      { pattern: /require_once|include_once/, language: "php" },

      // Ruby-specific patterns
      { pattern: /^require\s+['"].*['"]/m, language: "ruby" },
      { pattern: /def\s+\w+\s*\(?[^)]*\)?/, language: "ruby" },
      { pattern: /class\s+\w+(\s*<\s*\w+)?/, language: "ruby" },
      { pattern: /module\s+\w+/, language: "ruby" },
      { pattern: /puts\s+/, language: "ruby" },
      { pattern: /attr_accessor|attr_reader|attr_writer/, language: "ruby" },

      // Kotlin-specific patterns
      { pattern: /^package\s+[\w.]+/m, language: "kotlin" },
      { pattern: /^import\s+[\w.]+/m, language: "kotlin" },
      { pattern: /fun\s+\w+\s*\([^)]*\)/, language: "kotlin" },
      { pattern: /class\s+\w+(\s*:\s*\w+)?/, language: "kotlin" },
      { pattern: /val\s+\w+\s*=|var\s+\w+\s*=/, language: "kotlin" },
      { pattern: /println\s*\(/, language: "kotlin" },

      // Swift-specific patterns
      { pattern: /^import\s+\w+/m, language: "swift" },
      { pattern: /func\s+\w+\s*\([^)]*\)/, language: "swift" },
      { pattern: /class\s+\w+(\s*:\s*\w+)?/, language: "swift" },
      { pattern: /struct\s+\w+(\s*:\s*\w+)?/, language: "swift" },
      { pattern: /var\s+\w+\s*:\s*\w+|let\s+\w+\s*:\s*\w+/, language: "swift" },
      { pattern: /protocol\s+\w+/, language: "swift" },
      { pattern: /@\w+\s*$/, language: "swift" },

      // Dart-specific patterns
      { pattern: /^import\s+['"]dart:.*['"];?/m, language: "dart" },
      { pattern: /^library\s+[\w.]+\s*;?/m, language: "dart" },
      { pattern: /class\s+\w+(\s+extends\s+\w+)?/, language: "dart" },
      { pattern: /void\s+main\s*\(\s*\)/, language: "dart" },
      { pattern: /var\s+\w+\s*=|final\s+\w+\s*=/, language: "dart" },
      { pattern: /print\s*\(/, language: "dart" },
      { pattern: /Future<.*>|Stream<.*>/, language: "dart" },

      // Scala-specific patterns
      { pattern: /^package\s+[\w.]+/m, language: "scala" },
      { pattern: /^import\s+[\w.]+/m, language: "scala" },
      { pattern: /object\s+\w+(\s+extends\s+\w+)?/, language: "scala" },
      {
        pattern: /class\s+\w+(\s*\([^)]*\))?(\s+extends\s+\w+)?/,
        language: "scala",
      },
      { pattern: /def\s+\w+\s*\([^)]*\)\s*:\s*\w+/, language: "scala" },
      { pattern: /val\s+\w+\s*:\s*\w+|var\s+\w+\s*:\s*\w+/, language: "scala" },
      { pattern: /trait\s+\w+/, language: "scala" },

      // Lua-specific patterns
      { pattern: /^require\s*\(?['"].*['"]\)?/m, language: "lua" },
      { pattern: /function\s+\w+\s*\([^)]*\)/, language: "lua" },
      { pattern: /local\s+function\s+\w+/, language: "lua" },
      { pattern: /local\s+\w+\s*=/, language: "lua" },
      { pattern: /print\s*\(/, language: "lua" },
      { pattern: /--\[\[.*\]\]/, language: "lua" },
      { pattern: /end\s*$/, language: "lua" },

      // Bash-specific patterns
      { pattern: /^#!\/bin\/(bash|sh)/m, language: "bash" },
      { pattern: /^#!.*\/(bash|sh|zsh|fish)/m, language: "bash" },
      { pattern: /function\s+\w+\s*\(\s*\)/, language: "bash" },
      { pattern: /\w+\s*\(\s*\)\s*{/, language: "bash" },
      { pattern: /if\s+\[.*\]\s*;\s*then/, language: "bash" },
      { pattern: /echo\s+/, language: "bash" },
      { pattern: /\$\{\w+\}|\$\w+/, language: "bash" },
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
