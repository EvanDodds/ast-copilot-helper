/**
 * WASM-based parser implementation for Tree-sitter grammars
 *
 * NOTE: This implementation documents the WASM parsing limitation where pre-built
 * .wasm grammar files are not currently distributed by tree-sitter language
 * repositories. This provides a clear interface while indicating the current
 * unavailability of WASM parsing.
 */

import { BaseParser } from "./base-parser.js";
import type { ParserRuntime, ParseResult } from "../types.js";
import type { TreeSitterGrammarManager } from "../grammar-manager.js";

/**
 * WASM parser class that clearly indicates WASM parsing limitations
 */
export class WASMTreeSitterParser extends BaseParser {
  constructor(
    runtime: ParserRuntime,
    // grammarManager is required for interface compatibility but not used in WASM implementation
    grammarManager: TreeSitterGrammarManager,
  ) {
    super(runtime);
    // Store reference to maintain interface compatibility
    void grammarManager;
  }

  // Alias for backwards compatibility
  static WASMParser = WASMTreeSitterParser;
  /**
   * Parse code string into AST nodes
   * Returns an error indicating WASM parsing is not currently available
   */
  override async parseCode(
    _code: string,
    language: string,
    filePath?: string,
  ): Promise<ParseResult> {
    const startTime = performance.now();

    return {
      language,
      nodes: [],
      errors: [
        {
          type: "runtime" as const,
          message: `WASM parsing not available for ${language}. Pre-built WASM grammar files are not distributed by tree-sitter language repositories. Consider using native parsing or building WASM files from source.`,
          context: `WASM parser called for ${language} - file: ${filePath || "unknown"}`,
        },
      ],
      parseTime: performance.now() - startTime,
    };
  }

  /**
   * Parse a file into AST nodes
   * Returns an error indicating WASM parsing is not currently available
   */
  override async parseFile(filePath: string): Promise<ParseResult> {
    const startTime = performance.now();

    // Determine language from file extension
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    let language = "";

    switch (ext) {
      case "ts":
      case "tsx":
        language = "typescript";
        break;
      case "js":
      case "jsx":
        language = "javascript";
        break;
      case "py":
        language = "python";
        break;
      case "java":
        language = "java";
        break;
      case "cpp":
      case "cc":
      case "cxx":
        language = "cpp";
        break;
      case "c":
      case "h":
        language = "c";
        break;
      case "rs":
        language = "rust";
        break;
      case "go":
        language = "go";
        break;
      default:
        language = ext;
        break;
    }

    return {
      language,
      nodes: [],
      errors: [
        {
          type: "runtime" as const,
          message: `WASM parsing not available for ${language}. Pre-built WASM grammar files are not distributed by tree-sitter language repositories. Consider using native parsing or building WASM files from source.`,
          context: `WASM parser called for ${language} - file: ${filePath}`,
        },
      ],
      parseTime: performance.now() - startTime,
    };
  }

  /**
   * Dispose method for cleanup
   */
  override async dispose(): Promise<void> {
    // No resources to clean up in this implementation
    await super.dispose();
  }
}
