/**
 * Rust Parser Adapter
 *
 * Adapter that makes the RustParserCli compatible with the BaseParser interface
 * while providing all the performance benefits of the Rust implementation.
 */

import { BaseParser } from "./parsers/base-parser.js";
import {
  RustParserCli,
  type RustParseResult,
  type ParsedNode,
} from "./rust-cli.js";
import type { ParseResult, ParserRuntime, ASTNode } from "./types.js";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

/**
 * Parser runtime for Rust CLI
 */
class RustCliRuntime implements ParserRuntime {
  type = "native" as const;
  available = true;

  async initialize(): Promise<void> {
    // Runtime is already initialized through the CLI
  }

  async createParser(): Promise<unknown> {
    // Return a placeholder - the real parser is the Rust CLI
    return {};
  }
}

/**
 * Adapter that bridges RustParserCli with BaseParser interface
 */
export class RustParserAdapter extends BaseParser {
  private rustCli: RustParserCli;

  constructor(rustCli: RustParserCli = new RustParserCli()) {
    super(new RustCliRuntime());
    this.rustCli = rustCli;
  }

  /**
   * Parse code using Rust CLI
   */
  override async parseCode(
    code: string,
    language: string,
    filePath?: string,
  ): Promise<ParseResult> {
    try {
      const rustResult = await this.rustCli.parseCode({
        source_code: code,
        file_path: filePath || "<anonymous>",
        language: language,
      });

      return this.convertRustResultToParseResult(rustResult, language);
    } catch (error) {
      return {
        language,
        nodes: [],
        errors: [
          {
            type: "runtime" as const,
            message: `Rust CLI error: ${error instanceof Error ? error.message : "Unknown error"}`,
            context: error instanceof Error ? error.stack : undefined,
          },
        ],
        parseTime: 0,
      };
    }
  }

  /**
   * Parse file using Rust CLI
   */
  override async parseFile(filePath: string): Promise<ParseResult> {
    try {
      // Try to auto-detect language from file extension
      const language = this.detectLanguageFromPath(filePath);

      // Read file content first
      const content = await readFile(filePath, "utf-8");

      // Use the parseCode method which internally calls Rust CLI
      return await this.parseCode(content, language, filePath);
    } catch (error) {
      const detectedLang = this.detectLanguageFromPath(filePath);
      return {
        language: detectedLang,
        nodes: [],
        errors: [
          {
            type: "file_system" as const,
            message: `File parsing error: ${error instanceof Error ? error.message : "Unknown error"}`,
            context: filePath,
          },
        ],
        parseTime: 0,
      };
    }
  }

  /**
   * Batch parse files using Rust CLI for optimal performance
   */
  override async batchParseFiles(
    files: string[],
    options?: {
      concurrency?: number;
      onProgress?: (
        completed: number,
        total: number,
        currentFile: string,
      ) => void;
      continueOnError?: boolean;
    },
  ): Promise<Map<string, ParseResult>> {
    const results = new Map<string, ParseResult>();

    try {
      // Use Rust CLI's batch parsing for optimal performance
      const rustBatchResult = await this.rustCli.parseFiles(files, {
        maxConcurrency: options?.concurrency || 10,
      });

      // Convert results
      for (const [filePath, rustResult] of Object.entries(
        rustBatchResult.results,
      )) {
        if (rustResult.success && rustResult.result) {
          const language = this.detectLanguageFromPath(filePath);
          results.set(
            filePath,
            this.convertRustResultToParseResult(rustResult.result, language),
          );
        } else {
          const language = this.detectLanguageFromPath(filePath);
          results.set(filePath, {
            language,
            nodes: [],
            errors: [
              {
                type: "runtime" as const,
                message: rustResult.error || "Unknown parsing error",
                context: filePath,
              },
            ],
            parseTime: 0,
          });
        }

        // Report progress
        if (options?.onProgress) {
          options.onProgress(results.size, files.length, filePath);
        }
      }
    } catch (_error) {
      // Fallback to individual file parsing if batch fails
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        if (!filePath) {
          continue;
        }

        try {
          const result = await this.parseFile(filePath);
          results.set(filePath, result);
        } catch (fileError) {
          const language = this.detectLanguageFromPath(filePath);
          results.set(filePath, {
            language,
            nodes: [],
            errors: [
              {
                type: "runtime" as const,
                message: `Fallback parsing error: ${fileError instanceof Error ? fileError.message : "Unknown error"}`,
                context: filePath,
              },
            ],
            parseTime: 0,
          });
        }

        // Report progress
        if (options?.onProgress) {
          options.onProgress(i + 1, files.length, filePath);
        }

        // Stop on first error if continueOnError is false
        if (!options?.continueOnError && results.get(filePath)?.errors.length) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Convert Rust parsing result to TypeScript ParseResult format
   */
  private convertRustResultToParseResult(
    rustResult: RustParseResult,
    language: string,
  ): ParseResult {
    return {
      language,
      nodes:
        rustResult.nodes?.map((node) =>
          this.convertRustNodeToASTNode(node, rustResult.file_path),
        ) || [],
      errors: [], // Rust result doesn't include errors in the current interface
      parseTime: rustResult.processing_time_ms || 0,
    };
  }

  /**
   * Convert Rust node to AST node format
   */
  private convertRustNodeToASTNode(
    rustNode: ParsedNode,
    filePath: string,
  ): ASTNode {
    // Generate deterministic ID
    const nodeId = `${filePath}:${rustNode.start_row}:${rustNode.start_column}:${rustNode.node_type}`;

    return {
      id: nodeId,
      type: rustNode.node_type || "unknown",
      name: undefined, // Rust parser doesn't provide names in current interface
      filePath,
      start: {
        line: rustNode.start_row,
        column: rustNode.start_column,
      },
      end: {
        line: rustNode.end_row,
        column: rustNode.end_column,
      },
      children: [], // Children would need to be built from hierarchy - simplified for now
      metadata: {
        language: "typescript", // Will be updated based on actual language
        scope: [], // To be filled by higher-level processors
        modifiers: [], // To be filled by higher-level processors
      },
    };
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguageFromPath(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const extensionMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".py": "python",
      ".java": "java",
      ".rs": "rust",
      ".cpp": "cpp",
      ".cxx": "cpp",
      ".cc": "cpp",
      ".c": "c",
      ".cs": "csharp",
      ".go": "go",
    };

    return extensionMap[ext] || "text";
  }

  /**
   * Get supported languages from Rust CLI
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const languages = await this.rustCli.getSupportedLanguages();
      // RustLanguageInfo is an object, not an array
      return Object.keys(languages);
    } catch (_error) {
      // Return known supported languages as fallback
      return [
        "typescript",
        "javascript",
        "python",
        "java",
        "rust",
        "cpp",
        "c",
        "csharp",
        "go",
      ];
    }
  }

  /**
   * Check if Rust CLI is available
   */
  async checkAvailability(): Promise<boolean> {
    return await this.rustCli.checkCliAvailable();
  }

  /**
   * Dispose resources
   */
  override async dispose(): Promise<void> {
    // Rust CLI manages its own resources
  }
}

/**
 * Create a Rust parser adapter instance
 */
export async function createRustParserAdapter(): Promise<RustParserAdapter> {
  const adapter = new RustParserAdapter();

  // Verify Rust CLI is available
  const available = await adapter.checkAvailability();
  if (!available) {
    throw new Error(
      "Rust CLI is not available. Please ensure the ast-parser binary is built and accessible.",
    );
  }

  return adapter;
}
