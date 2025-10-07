/**
 * AST Copilot Helper - Main Entry Point
 * Exports the Rust-based parser classes and interfaces
 */

// Main parser exports (Rust-based architecture)
export { BaseParser } from "./parser/parsers/base-parser.js";

// Export everything from the parser module
export * from "./parser/index.js";

// Types and interfaces
export * from "./parser/types.js";
export * from "./parser/languages.js";

// Import classes for internal use
import {
  createRustParserAdapter,
  type RustParserAdapter,
} from "./parser/rust-parser-adapter.js";

// Main convenience class using Rust parser
export class ASTHelper {
  private parser: RustParserAdapter | null = null;

  constructor() {
    // Parser will be initialized on first use
  }

  /**
   * Initialize the Rust parser (lazy initialization)
   */
  private async ensureParser(): Promise<RustParserAdapter> {
    if (!this.parser) {
      this.parser = await createRustParserAdapter();
    }
    return this.parser;
  }

  /**
   * Parse code for specified language
   */
  async parseCode(code: string, language: string, filePath?: string) {
    const parser = await this.ensureParser();
    return await parser.parseCode(code, language, filePath);
  }

  /**
   * Parse file from disk
   */
  async parseFile(filePath: string) {
    const parser = await this.ensureParser();
    return await parser.parseFile(filePath);
  }

  /**
   * Get runtime information
   */
  getRuntime() {
    return {
      type: "rust" as const,
      available: true,
    };
  }

  /**
   * Dispose resources
   */
  async dispose() {
    if (this.parser) {
      await this.parser.dispose();
      this.parser = null;
    }
  }
}

// Re-export for backwards compatibility
export { ASTHelper as default };
