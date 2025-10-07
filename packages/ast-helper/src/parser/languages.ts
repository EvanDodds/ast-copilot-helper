/**
 * Tree-sitter Language Configuration
 * Native-only implementation - no WASM support
 */

import * as path from "path";
import type { LanguageConfig } from "./types.js";

/**
 * Supported languages configuration
 * Each language includes file extensions and parser module name for native loading
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    name: "typescript",
    extensions: [".ts", ".tsx"],
    parserModule: "tree-sitter-typescript/typescript",
  },
  {
    name: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    parserModule: "tree-sitter-javascript",
  },
  {
    name: "python",
    extensions: [".py", ".pyi", ".pyw"],
    parserModule: "tree-sitter-python",
  },
  {
    name: "rust",
    extensions: [".rs"],
    parserModule: "tree-sitter-rust",
  },
  {
    name: "go",
    extensions: [".go"],
    parserModule: "tree-sitter-go",
  },
  {
    name: "c",
    extensions: [".c"],
    parserModule: "tree-sitter-c",
  },
  {
    name: "cpp",
    extensions: [".cpp", ".cc", ".cxx"],
    parserModule: "tree-sitter-cpp",
  },
  {
    name: "java",
    extensions: [".java"],
    parserModule: "tree-sitter-java",
  },
  {
    name: "kotlin",
    extensions: [".kt"],
    parserModule: "tree-sitter-kotlin",
  },
  {
    name: "swift",
    extensions: [".swift"],
    parserModule: "tree-sitter-swift",
  },
  {
    name: "dart",
    extensions: [".dart"],
    parserModule: "tree-sitter-dart",
  },
  {
    name: "ruby",
    extensions: [".rb"],
    parserModule: "tree-sitter-ruby",
  },
  {
    name: "php",
    extensions: [".php"],
    parserModule: "tree-sitter-php",
  },
  {
    name: "scala",
    extensions: [".scala"],
    parserModule: "tree-sitter-scala",
  },
  {
    name: "bash",
    extensions: [".sh", ".bash"],
    parserModule: "tree-sitter-bash",
  },
  {
    name: "lua",
    extensions: [".lua"],
    parserModule: "tree-sitter-lua",
  },
  {
    name: "c_sharp",
    extensions: [".cs"],
    parserModule: "tree-sitter-c-sharp",
  },
];

/**
 * Get supported file extensions for all configured languages
 */
export function getSupportedExtensions(): string[] {
  const extensions = new Set<string>();
  for (const config of SUPPORTED_LANGUAGES) {
    for (const ext of config.extensions) {
      extensions.add(ext);
    }
  }
  return Array.from(extensions).sort();
}

/**
 * Get language configuration by language name
 * Returns null if language is not supported
 */
export function getLanguageConfig(language: string): LanguageConfig | null {
  const config = SUPPORTED_LANGUAGES.find((lang) => lang.name === language);

  if (!config) {
    return null;
  }

  // Validate configuration
  if (!config.parserModule) {
    throw new Error(
      `Invalid language configuration: parserModule is required for ${language}`,
    );
  }

  return config;
}

/**
 * Get language name from file extension
 * Returns null if extension is not supported
 */
export function getLanguageFromExtension(extension: string): string | null {
  // Normalize extension (ensure it starts with .) and make case-insensitive
  const normalizedExt = (
    extension.startsWith(".") ? extension : `.${extension}`
  ).toLowerCase();

  for (const config of SUPPORTED_LANGUAGES) {
    if (
      config.extensions.map((ext) => ext.toLowerCase()).includes(normalizedExt)
    ) {
      return config.name;
    }
  }

  return null;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  return SUPPORTED_LANGUAGES.map((config) => config.name);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.some(
    (config) => config.name.toLowerCase() === language.toLowerCase(),
  );
}

/**
 * Check if a file extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  return getLanguageFromExtension(extension) !== null;
}

// ===== Backward Compatibility Exports =====

/**
 * Detect language from filename
 * @deprecated Use getLanguageFromExtension instead
 */
export function detectLanguage(filename: string): string | null {
  const ext = path.extname(filename);
  return getLanguageFromExtension(ext);
}

/**
 * Check if a file is supported based on its extension
 * @deprecated Use isExtensionSupported instead
 */
export function isFileSupported(filename: string): boolean {
  const ext = path.extname(filename);
  return isExtensionSupported(ext);
}

/**
 * Get all supported languages (alias for compatibility)
 */
export function getAllSupportedLanguages(): LanguageConfig[] {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Language Detection and Management Class
 * Static class providing language detection and configuration methods
 */
export class LanguageDetector {
  private static extensionMap = new Map<string, string>();
  private static languageMap = new Map<string, LanguageConfig>();

  static {
    // Build maps for fast lookup
    this.buildMaps();
  }

  private static buildMaps(): void {
    this.extensionMap.clear();
    this.languageMap.clear();

    for (const config of SUPPORTED_LANGUAGES) {
      // Map language name to config
      this.languageMap.set(config.name.toLowerCase(), config);

      // Map extensions to language name
      for (const ext of config.extensions) {
        this.extensionMap.set(ext.toLowerCase(), config.name);
      }
    }
  }

  static detectLanguage(filename: string): string | null {
    return detectLanguage(filename);
  }

  static getLanguageConfig(language: string): LanguageConfig | null {
    return this.languageMap.get(language.toLowerCase()) || null;
  }

  static getLanguageByExtension(filename: string): LanguageConfig | null {
    const language = this.detectLanguage(filename);
    return language ? this.getLanguageConfig(language) : null;
  }

  static isLanguageSupported(language: string): boolean {
    return isLanguageSupported(language);
  }

  static isExtensionSupported(filename: string): boolean {
    return isFileSupported(filename);
  }

  static getAllSupportedLanguages(): LanguageConfig[] {
    return getAllSupportedLanguages();
  }

  static getAllSupportedExtensions(): string[] {
    const extensions = new Set<string>();
    for (const config of SUPPORTED_LANGUAGES) {
      for (const ext of config.extensions) {
        extensions.add(ext);
      }
    }
    return Array.from(extensions).sort();
  }

  static addLanguage(config: LanguageConfig): void {
    if (!config.name || !config.extensions || !config.parserModule) {
      throw new Error(
        "Invalid language configuration: name, extensions, and parserModule are required",
      );
    }

    // Add to the SUPPORTED_LANGUAGES array
    const existingIndex = SUPPORTED_LANGUAGES.findIndex(
      (lang) => lang.name === config.name,
    );
    if (existingIndex >= 0) {
      SUPPORTED_LANGUAGES[existingIndex] = config;
    } else {
      SUPPORTED_LANGUAGES.push(config);
    }

    // Rebuild maps
    this.buildMaps();
  }

  static removeLanguage(language: string): boolean {
    const index = SUPPORTED_LANGUAGES.findIndex(
      (lang) => lang.name === language,
    );

    if (index >= 0) {
      SUPPORTED_LANGUAGES.splice(index, 1);
      this.buildMaps();
      return true;
    }

    return false;
  }

  static detectLanguageFromContent(
    filename: string,
    content: string,
  ): string | null {
    // First try extension-based detection
    const extBasedLanguage = this.detectLanguage(filename);
    if (extBasedLanguage) {
      return extBasedLanguage;
    }

    // Simple content-based heuristics
    if (
      content.includes("interface ") ||
      content.includes("type ") ||
      content.includes(": string")
    ) {
      return "typescript";
    }

    if (
      content.includes("def ") ||
      content.includes("import ") ||
      content.includes("from ")
    ) {
      return "python";
    }

    if (
      content.includes("const ") ||
      content.includes("let ") ||
      content.includes("function ")
    ) {
      return "javascript";
    }

    return null;
  }

  static getLanguageStats(): Record<
    string,
    { extensions: string[]; supported: boolean }
  > {
    const stats: Record<string, { extensions: string[]; supported: boolean }> =
      {};

    for (const config of SUPPORTED_LANGUAGES) {
      stats[config.name] = {
        extensions: [...config.extensions],
        supported: true,
      };
    }

    return stats;
  }
}
