/**
 * AST Copilot Helper - Main Entry Point
 * Exports the primary parser classes and interfaces
 */

// Main parser exports
export { NativeTreeSitterParser } from "./parser/parsers/native-parser.js";
export { WASMTreeSitterParser } from "./parser/parsers/wasm-parser.js";
export { BaseParser } from "./parser/parsers/base-parser.js";

// Grammar manager and runtime detection
export { TreeSitterGrammarManager } from "./parser/grammar-manager.js";
export { RuntimeDetector } from "./parser/runtime-detector.js";

// Types and interfaces
export * from "./parser/types.js";
export * from "./parser/languages.js";

// Import classes for internal use
import { NativeTreeSitterParser } from "./parser/parsers/native-parser.js";
import { TreeSitterGrammarManager } from "./parser/grammar-manager.js";
import type { ParserRuntime } from "./parser/types.js";

// Main convenience class
export class ASTHelper {
  private parser: NativeTreeSitterParser;
  private grammarManager: TreeSitterGrammarManager;

  constructor() {
    // Initialize grammar manager
    this.grammarManager = new TreeSitterGrammarManager();

    // Create a simple runtime object
    const runtime: ParserRuntime = {
      type: "native",
      available: true,
      initialize: async () => {
        // Runtime initialization placeholder
      },
      createParser: async () => ({}),
    };

    // Use native parser for comprehensive language testing
    this.parser = new NativeTreeSitterParser(runtime, this.grammarManager);
  }

  /**
   * Parse code for specified language
   */
  async parseCode(code: string, language: string, filePath?: string) {
    return await this.parser.parseCode(code, language, filePath);
  }

  /**
   * Parse file from disk
   */
  async parseFile(filePath: string) {
    return await this.parser.parseFile(filePath);
  }

  /**
   * Get runtime information
   */
  getRuntime() {
    return this.parser.getRuntime();
  }

  /**
   * Dispose resources
   */
  async dispose() {
    await this.parser.dispose();
  }
}

// Re-export for backwards compatibility
export { ASTHelper as default };
