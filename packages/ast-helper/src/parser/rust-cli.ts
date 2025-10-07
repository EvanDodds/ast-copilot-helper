/**
 * Rust CLI Integration for AST Parsing
 *
 * This module provides a bridge between the TypeScript CLI and the Rust AST parser binary.
 * It handles communication via child process and provides type-safe interfaces.
 */

import { spawn } from "child_process";
import { promises as fs, existsSync } from "fs";
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

// Annotation interfaces
export interface RustAnnotateRequest {
  file_path: string;
  language?: string;
}

export interface RustAnnotationParameter {
  name: string;
  param_type: string;
  optional: boolean;
  default_value: string | null;
}

export interface RustComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  max_nesting: number;
  decision_points: number;
  category: string;
  breakdown: {
    branches: number;
    loops: number;
    returns: number;
  };
}

export interface RustDependencies {
  imports: string[];
  exports: string[];
  calls: string[];
  internal_dependencies: string[];
  external_dependencies: string[];
}

export interface RustAnnotation {
  node_type: string;
  signature: string;
  summary: string;
  language: string;
  start_line: number;
  end_line: number;
  parameters: RustAnnotationParameter[];
  return_type: string | null;
  modifiers: string[];
  semantic_tags: string[];
  complexity_metrics: RustComplexityMetrics;
  dependencies: RustDependencies;
}

export interface RustAnnotateResult {
  annotations: RustAnnotation[];
  file_path: string;
  language: string;
  total_nodes: number;
  processing_time_ms: number;
  summary: string;
}

export interface RustBatchAnnotateRequest {
  files: RustAnnotateRequest[];
  max_concurrency?: number;
}

export interface RustBatchAnnotateResult {
  success: boolean;
  results: Record<
    string,
    {
      success: boolean;
      result?: RustAnnotateResult;
      error?: string;
    }
  >;
  total_files: number;
  successful_files: number;
  total_processing_time_ms: number;
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
    // Look for the compiled binary in the expected location (prefer release over debug)
    const possiblePaths = [
      join(process.cwd(), "packages/ast-core-engine/target/release/ast-parser"),
      join(process.cwd(), "packages/ast-core-engine/target/debug/ast-parser"),
      join(__dirname, "../../ast-core-engine/target/release/ast-parser"),
      join(__dirname, "../../ast-core-engine/target/debug/ast-parser"),
      join(__dirname, "../../../ast-core-engine/target/release/ast-parser"),
      join(__dirname, "../../../ast-core-engine/target/debug/ast-parser"),
      "ast-parser", // If in PATH
    ];

    // Check which path actually exists
    for (const path of possiblePaths) {
      try {
        if (existsSync(path)) {
          return path;
        }
      } catch {
        // Continue to next path
      }
    }

    return "ast-parser"; // Fallback to PATH
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
   * Annotate a single file
   */
  async annotateFile(
    filePath: string,
    language?: string,
  ): Promise<RustAnnotateResult> {
    const startTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Annotator] Annotating ${filePath} (${language || "auto-detect"})`,
      );
    }

    const args = ["annotate", "--file", filePath, "--format", "json"];

    if (language) {
      args.push("--language", language);
    }

    if (this.verbose) {
      args.push("--verbose");
    }

    const result = await this.runCliCommand<{
      success: boolean;
      data?: RustAnnotateResult;
      error?: string;
    }>(args);

    const endTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Annotator] Completed in ${(endTime - startTime).toFixed(2)}ms`,
      );
    }

    if (!result.success || !result.data) {
      throw new RustCliError(
        `Annotation failed: ${result.error || "Unknown error"}. Full result: ${JSON.stringify(result)}`,
      );
    }

    return result.data as unknown as RustAnnotateResult;
  }

  /**
   * Annotate multiple files in batch
   */
  async annotateFiles(
    filePaths: string[],
    options: {
      language?: string;
      maxConcurrency?: number;
    } = {},
  ): Promise<RustBatchAnnotateResult> {
    const startTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Annotator] Batch annotating ${filePaths.length} files (concurrency: ${options.maxConcurrency || "default"})`,
      );
    }

    // For now, process files individually since Rust CLI doesn't have batch annotate yet
    // This can be optimized later with a dedicated batch annotate command in Rust
    const results: Record<
      string,
      {
        success: boolean;
        result?: RustAnnotateResult;
        error?: string;
      }
    > = {};

    let successCount = 0;
    const concurrency = options.maxConcurrency || this.maxParsers;

    // Process files in batches
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (filePath) => {
          try {
            const result = await this.annotateFile(filePath, options.language);
            results[filePath] = { success: true, result };
            successCount++;
          } catch (error) {
            results[filePath] = {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );
    }

    const endTime = performance.now();

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[Rust Annotator] Batch completed in ${(endTime - startTime).toFixed(2)}ms`,
      );
    }

    return {
      success: true,
      results,
      total_files: filePaths.length,
      successful_files: successCount,
      total_processing_time_ms: endTime - startTime,
    };
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
export const annotateFile = (filePath: string, language?: string) =>
  rustParser.annotateFile(filePath, language);
export const annotateFiles = (
  filePaths: string[],
  options?: { language?: string; maxConcurrency?: number },
) => rustParser.annotateFiles(filePaths, options);
export const getSupportedLanguages = () => rustParser.getSupportedLanguages();
export const isLanguageSupported = (language: string) =>
  rustParser.isLanguageSupported(language);
export const checkCliAvailable = () => rustParser.checkCliAvailable();
