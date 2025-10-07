/**
 * Extended Language Manager - Native-Only Architecture
 *
 * NOTE: This component has been migrated to native-only tree-sitter parsing.
 * WASM support has been removed as part of the architecture simplification.
 *
 * For extended language support, use the core TreeSitterGrammarManager
 * with native tree-sitter language modules.
 */

import { EventEmitter } from "events";
import type {
  ExtendedLanguageConfig,
  ExtendedLanguage,
  LanguagePlugin,
  ExtendedParseResult,
  LanguageDetectionResult,
} from "./types";

/**
 * Extended Language Manager Class - Native-Only Placeholder
 *
 * @deprecated This class is deprecated in favor of native-only tree-sitter parsing.
 * Use TreeSitterGrammarManager from the core parser module instead.
 */
export class ExtendedLanguageManager extends EventEmitter {
  constructor(_config: ExtendedLanguageConfig) {
    super();
    // eslint-disable-next-line no-console
    console.warn(
      "ExtendedLanguageManager is deprecated. " +
        "Use TreeSitterGrammarManager for native-only parsing.",
    );
  }

  /**
   * @deprecated Use TreeSitterGrammarManager.initialize() instead
   */
  async initialize(): Promise<void> {
    throw new Error(
      "ExtendedLanguageManager has been deprecated. " +
        "Use TreeSitterGrammarManager from the core parser module for native-only parsing.",
    );
  }

  /**
   * @deprecated Use TreeSitterGrammarManager.loadParser() instead
   */
  async registerPlugin(_plugin: LanguagePlugin): Promise<void> {
    throw new Error(
      "ExtendedLanguageManager has been deprecated. " +
        "Use TreeSitterGrammarManager from the core parser module for native-only parsing.",
    );
  }

  /**
   * @deprecated Use native tree-sitter parsing instead
   */
  async parseCode(
    _code: string,
    _language: ExtendedLanguage,
    _filePath?: string,
  ): Promise<ExtendedParseResult> {
    throw new Error(
      "ExtendedLanguageManager has been deprecated. " +
        "Use TreeSitterGrammarManager from the core parser module for native-only parsing.",
    );
  }

  /**
   * @deprecated Use native tree-sitter parsing instead
   */
  async detectLanguage(
    _code: string,
    _filename?: string,
  ): Promise<LanguageDetectionResult> {
    throw new Error(
      "ExtendedLanguageManager has been deprecated. " +
        "Use TreeSitterGrammarManager from the core parser module for native-only parsing.",
    );
  }

  /**
   * @deprecated Use native tree-sitter parsing instead
   */
  getSupportedLanguages(): ExtendedLanguage[] {
    return [];
  }

  /**
   * @deprecated Use native tree-sitter parsing instead
   */
  async dispose(): Promise<void> {
    // No-op for compatibility
  }
}
