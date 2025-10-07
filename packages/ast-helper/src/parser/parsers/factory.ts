/**
 * Parser Factory - Creates Rust-based parser instances
 */

import { createRustParserAdapter } from "../rust-parser-adapter.js";
import type { RustParserAdapter } from "../rust-parser-adapter.js";
import type { ASTParser } from "../types.js";

/**
 * Factory class for creating Rust-based parser instances
 */
export class ParserFactory {
  /**
   * Create a parser instance (uses Rust-based parser)
   */
  static async createParser(): Promise<ASTParser> {
    try {
      return await createRustParserAdapter();
    } catch (error) {
      throw new Error(
        `Failed to create parser: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create a Rust parser (alias for createParser for compatibility)
   */
  static async createRustParser(): Promise<RustParserAdapter> {
    return await createRustParserAdapter();
  }

  /**
   * Get information about parser availability
   */
  static async getRuntimeInfo(): Promise<{
    rust: { available: boolean; error?: string };
    recommended: "rust";
  }> {
    try {
      // Test if Rust parser can be created
      await createRustParserAdapter();

      return {
        rust: {
          available: true,
        },
        recommended: "rust",
      };
    } catch (error) {
      return {
        rust: {
          available: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        recommended: "rust",
      };
    }
  }
}

/**
 * Convenience function to create a parser
 */
export async function createParser(): Promise<ASTParser> {
  return ParserFactory.createParser();
}
