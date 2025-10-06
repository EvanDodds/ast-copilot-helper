/**
 * Base parser implementation that provides common functionality
 */

import type { ParseResult, ASTParser, ParserRuntime } from "../types.js";

export abstract class BaseParser implements ASTParser {
  protected runtime: ParserRuntime;

  constructor(runtime: ParserRuntime) {
    this.runtime = runtime;
  }

  getRuntime(): ParserRuntime {
    return this.runtime;
  }

  // Abstract method that concrete parsers must implement
  abstract parseFile(filePath: string): Promise<ParseResult>;

  // Default implementation of parseCode - can be overridden by subclasses
  async parseCode(
    _code: string,
    language: string,
    filePath?: string,
  ): Promise<ParseResult> {
    // This should never be reached in production - all concrete parsers must override this method
    throw new Error(
      `CRITICAL: parseCode not implemented for ${language} in ${this.constructor.name}. ` +
        `This indicates a programming error - all parser implementations must override parseCode. ` +
        `File: ${filePath || "unknown"}`,
    );
  }

  // Default implementation of batch parsing
  async batchParseFiles(
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
    const { onProgress, continueOnError = false } = options || {};

    let completed = 0;

    for (const file of files) {
      try {
        const result = await this.parseFile(file);
        results.set(file, result);
        completed++;
        onProgress?.(completed, files.length, file);
      } catch (error) {
        const errorResult: ParseResult = {
          nodes: [],
          errors: [
            {
              type: "runtime",
              message: error instanceof Error ? error.message : "Unknown error",
              context: file,
            },
          ],
          language: "",
          parseTime: 0,
        };
        results.set(file, errorResult);

        if (!continueOnError) {
          break;
        }
        completed++;
        onProgress?.(completed, files.length, file);
      }
    }

    return results;
  }

  async dispose(): Promise<void> {
    // Base implementation - can be overridden by subclasses
  }
}
