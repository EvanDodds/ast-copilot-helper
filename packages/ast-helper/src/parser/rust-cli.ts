/**
 * Rust CLI Integration for AST Parsing
 *
 * This module provides a bridge between the TypeScript CLI and the Rust AST parser binary.
 * It handles communication via child process and provides type-safe interfaces.
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import os from "os";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

export interface RustParseRequest {
  source_code: string;
  file_path: string;
  language?: string;
}

export interface RustBatchRequest {
  files: RustParseRequest[];
  max_concurrency?: number;
}

export interface ParsedNode {
  node_type: string;
  start_byte: number;
  end_byte: number;
  start_row: number;
  end_row: number;
  start_column: number;
  end_column: number;
  text: string;
  children_count: number;
  is_named: boolean;
}

export interface RustParseResult {
  nodes: ParsedNode[];
  language: string;
  file_path: string;
  processing_time_ms: number;
  total_nodes: number;
  error_count: number;
}

export interface RustCliResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RustBatchResult {
  success: boolean;
  results: Array<{
    success: boolean;
    result?: RustParseResult;
    error?: string;
  }>;
  total_files: number;
  successful_files: number;
  total_processing_time_ms: number;
}

export interface RustLanguageInfo {
  languages: string[];
  extensions: string[];
}

export interface RustParserStats {
  parsers_initialized: number;
  total_parses: number;
  successful_parses: number;
  failed_parses: number;
  average_parse_time_ms: number;
}

export class RustCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = "RustCliError";
  }
}

export class RustParserCli {
  private readonly cliPath: string;
  private readonly maxParsers: number;
  private readonly verbose: boolean;

  constructor(
    options: {
      cliPath?: string;
      maxParsers?: number;
      verbose?: boolean;
    } = {},
  ) {
    this.cliPath = options.cliPath || this.getDefaultCliPath();
    this.maxParsers = options.maxParsers || Math.max(2, os.cpus().length / 2);
    this.verbose = options.verbose || false;
  }

  private getDefaultCliPath(): string {
    // Look for the compiled binary in the expected location
    const possiblePaths = [
      join(process.cwd(), "packages/ast-core-engine/target/debug/ast-parser"),
      join(process.cwd(), "packages/ast-core-engine/target/release/ast-parser"),
      join(__dirname, "../../ast-core-engine/target/debug/ast-parser"),
      join(__dirname, "../../ast-core-engine/target/release/ast-parser"),
      join(__dirname, "../../../ast-core-engine/target/debug/ast-parser"),
      join(__dirname, "../../../ast-core-engine/target/release/ast-parser"),
      "ast-parser", // If in PATH
    ];

    return possiblePaths[0] || "ast-parser";
  }

  /**
   * Check if the Rust CLI binary is available and working
   */
  async checkCliAvailable(): Promise<boolean> {
    try {
      await this.getSupportedLanguages();
      return true;
    } catch (error) {
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.error("Rust CLI not available:", error);
      }
      return false;
    }
  }

  /**
   * Get supported languages and file extensions
   */
  async getSupportedLanguages(): Promise<RustLanguageInfo> {
    const result = await this.runCliCommand<RustLanguageInfo>(["languages"]);
    return result.data as RustLanguageInfo;
  }

  /**
   * Check if a specific language is supported
   */
  async isLanguageSupported(language: string): Promise<boolean> {
    const result = await this.runCliCommand<{
      language: string;
      supported: boolean;
    }>(["check-language", language]);
    return (result.data as { language: string; supported: boolean }).supported;
  }

  /**
   * Parse a single piece of source code
   */
  async parseCode(request: RustParseRequest): Promise<RustParseResult> {
    const startTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Parser] Parsing ${request.file_path} (${request.language || "auto-detect"})`,
      );
    }

    const args = ["parse", "--stdin"];

    if (request.language) {
      args.push("--language", request.language);
    }

    if (this.verbose) {
      args.push("--verbose");
    }

    const result = await this.runCliCommandWithStdin<{
      success: boolean;
      result?: RustParseResult;
      error?: string;
    }>(
      args,
      JSON.stringify({
        source_code: request.source_code,
        file_path: request.file_path,
        language: request.language,
      }),
    );

    const endTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Parser] Completed in ${(endTime - startTime).toFixed(2)}ms`,
      );
    }

    const parseResult = result.data;

    if (!parseResult?.success || !parseResult.result) {
      throw new RustCliError(
        `Parse failed: ${parseResult?.error || "Unknown error"}`,
      );
    }

    return parseResult.result;
  }

  /**
   * Parse multiple files in batch
   */
  async parseBatch(request: RustBatchRequest): Promise<RustBatchResult> {
    const startTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Parser] Batch parsing ${request.files.length} files (concurrency: ${request.max_concurrency || "default"})`,
      );
    }

    const args = ["batch", "--stdin"];

    if (this.verbose) {
      args.push("--verbose");
    }

    const result = await this.runCliCommandWithStdin<RustBatchResult>(
      args,
      JSON.stringify(request),
    );

    const endTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Parser] Batch completed in ${(endTime - startTime).toFixed(2)}ms`,
      );
    }

    return result.data as RustBatchResult;
  }

  /**
   * Parse a file from disk
   */
  async parseFile(
    filePath: string,
    language?: string,
  ): Promise<RustParseResult> {
    const content = await fs.readFile(filePath, "utf-8");
    return this.parseCode({
      source_code: content,
      file_path: filePath,
      language,
    });
  }

  /**
   * Parse multiple files from disk
   */
  async parseFiles(
    filePaths: string[],
    options: {
      language?: string;
      maxConcurrency?: number;
    } = {},
  ): Promise<RustBatchResult> {
    // Read all files concurrently
    const files = await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        return {
          source_code: content,
          file_path: filePath,
          language: options.language,
        };
      }),
    );

    return this.parseBatch({
      files,
      max_concurrency: options.maxConcurrency,
    });
  }

  /**
   * Get parser statistics
   */
  async getStats(): Promise<RustParserStats> {
    const result = await this.runCliCommand<RustParserStats>(["stats"]);
    return result.data as RustParserStats;
  }

  private async runCliCommand<T = unknown>(
    args: string[],
  ): Promise<RustCliResponse<T>> {
    const allArgs = ["--max-parsers", this.maxParsers.toString(), ...args];

    if (this.verbose && !args.includes("--verbose")) {
      allArgs.push("--verbose");
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, allArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        const exitCode = code ?? 0;
        if (exitCode !== 0) {
          reject(
            new RustCliError(
              `Rust CLI exited with code ${exitCode}`,
              exitCode,
              stderr,
            ),
          );
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (!result.success && result.error) {
            reject(new RustCliError(`Rust CLI error: ${result.error}`));
            return;
          }
          resolve(result);
        } catch (error) {
          reject(
            new RustCliError(
              `Failed to parse CLI response: ${error}`,
              exitCode,
              stderr,
            ),
          );
        }
      });

      child.on("error", (error) => {
        reject(new RustCliError(`Failed to spawn Rust CLI: ${error.message}`));
      });
    });
  }

  private async runCliCommandWithStdin<T = unknown>(
    args: string[],
    stdin: string,
  ): Promise<RustCliResponse<T>> {
    const allArgs = ["--max-parsers", this.maxParsers.toString(), ...args];

    if (this.verbose && !args.includes("--verbose")) {
      allArgs.push("--verbose");
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, allArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        const exitCode = code ?? 0;
        if (exitCode !== 0) {
          reject(
            new RustCliError(
              `Rust CLI exited with code ${exitCode}`,
              exitCode,
              stderr,
            ),
          );
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (!result.success && result.error) {
            reject(new RustCliError(`Rust CLI error: ${result.error}`));
            return;
          }
          resolve(result);
        } catch (error) {
          reject(
            new RustCliError(
              `Failed to parse CLI response: ${error}`,
              exitCode,
              stderr,
            ),
          );
        }
      });

      child.on("error", (error) => {
        reject(new RustCliError(`Failed to spawn Rust CLI: ${error.message}`));
      });

      // Send stdin data
      if (child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }
}

// Default instance
export const rustParser = new RustParserCli();

// Convenience functions
export const parseCode = (request: RustParseRequest) =>
  rustParser.parseCode(request);
export const parseBatch = (request: RustBatchRequest) =>
  rustParser.parseBatch(request);
export const parseFile = (filePath: string, language?: string) =>
  rustParser.parseFile(filePath, language);
export const parseFiles = (
  filePaths: string[],
  options?: { language?: string; maxConcurrency?: number },
) => rustParser.parseFiles(filePaths, options);
export const getSupportedLanguages = () => rustParser.getSupportedLanguages();
export const isLanguageSupported = (language: string) =>
  rustParser.isLanguageSupported(language);
export const checkCliAvailable = () => rustParser.checkCliAvailable();
