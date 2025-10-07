/**
 * Enhanced error classes for Tree-sitter parser system
 * Provides structured, user-friendly error messages with troubleshooting guidance
 */

export enum ErrorCategory {
  PARSER_LOAD = "PARSER_LOAD",
  GRAMMAR_DOWNLOAD = "GRAMMAR_DOWNLOAD",
  WASM_INTEGRATION = "WASM_INTEGRATION",
  NATIVE_MODULE = "NATIVE_MODULE",
  CONFIGURATION = "CONFIGURATION",
  RUNTIME = "RUNTIME",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Base class for structured Tree-sitter errors
 */
export class TreeSitterError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly language?: string;
  public readonly troubleshooting: string[];
  public readonly context: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    options: {
      language?: string;
      troubleshooting?: string[];
      context?: Record<string, unknown>;
      cause?: Error;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.severity = severity;
    this.language = options.language;
    this.troubleshooting = options.troubleshooting || [];
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Generate user-friendly error message with troubleshooting steps
   */
  toDetailedString(): string {
    const sections = [`[${this.category}] ${this.message}`, ""];

    if (this.language) {
      sections.push(`Language: ${this.language}`);
    }

    sections.push(`Severity: ${this.severity}`);
    sections.push(`Timestamp: ${this.timestamp}`);

    if (Object.keys(this.context).length > 0) {
      sections.push("");
      sections.push("Context:");
      Object.entries(this.context).forEach(([key, value]) => {
        sections.push(`  - ${key}: ${String(value)}`);
      });
    }

    if (this.troubleshooting.length > 0) {
      sections.push("");
      sections.push("Troubleshooting suggestions:");
      this.troubleshooting.forEach((step, index) => {
        sections.push(`  ${index + 1}. ${step}`);
      });
    }

    if (this.cause) {
      sections.push("");
      sections.push(
        `Root cause: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`,
      );
    }

    return sections.join("\n");
  }
}

/**
 * Error for parser loading failures
 */
export class ParserLoadError extends TreeSitterError {
  constructor(
    language: string,
    nativeError?: Error,
    wasmError?: Error,
    options: { context?: Record<string, unknown> } = {},
  ) {
    const troubleshooting = [
      `Install native parser: npm install tree-sitter-${language}`,
      "Check language configuration in languages.ts",
      "Verify network connectivity for WASM grammar download",
      "Build WASM files from source if pre-built unavailable",
    ];

    const context = {
      nativeError: nativeError?.message || "N/A",
      wasmError: wasmError?.message || "N/A",
      nativeStatus: nativeError?.message.includes("Native parser not available")
        ? "Not installed"
        : "Failed",
      wasmStatus: wasmError?.message.includes("Real WASM grammar not available")
        ? "Mock files only"
        : "Failed",
      ...options.context,
    };

    super(
      `Failed to load parser for language '${language}'. Both native and WASM parsers failed.`,
      ErrorCategory.PARSER_LOAD,
      ErrorSeverity.HIGH,
      { language, troubleshooting, context, cause: nativeError || wasmError },
    );
  }
}

/**
 * Error for grammar download failures
 */
export class GrammarDownloadError extends TreeSitterError {
  constructor(
    language: string,
    url: string,
    cause?: Error,
    options: { retryCount?: number; context?: Record<string, unknown> } = {},
  ) {
    const troubleshooting = [
      "Check internet connectivity and firewall settings",
      "Verify the grammar URL is accessible and correct",
      "Try downloading manually and placing in grammar cache directory",
      "Check if the language repository provides pre-built WASM files",
    ];

    const context = {
      grammarUrl: url,
      retryCount: options.retryCount || 0,
      ...options.context,
    };

    super(
      `Failed to download grammar for language '${language}' from ${url}`,
      ErrorCategory.GRAMMAR_DOWNLOAD,
      ErrorSeverity.MEDIUM,
      { language, troubleshooting, context, cause },
    );
  }
}

/**
 * Error for WASM integration issues
 */
export class WASMIntegrationError extends TreeSitterError {
  constructor(
    language: string,
    grammarPath: string,
    cause?: Error,
    options: { context?: Record<string, unknown> } = {},
  ) {
    const troubleshooting = [
      "Ensure web-tree-sitter is properly installed and initialized",
      "Check if the WASM file is valid and not corrupted",
      "Verify the grammar file matches the expected format",
      "Consider using native parsing as an alternative",
    ];

    const context = {
      grammarPath,
      wasmFileExists: true, // Will be updated by caller if needed
      ...options.context,
    };

    super(
      `WASM parser integration failed for language '${language}'`,
      ErrorCategory.WASM_INTEGRATION,
      ErrorSeverity.MEDIUM,
      { language, troubleshooting, context, cause },
    );
  }
}

/**
 * Error for native module issues
 */
export class NativeModuleError extends TreeSitterError {
  constructor(
    language: string,
    moduleName: string,
    cause?: Error,
    options: { context?: Record<string, unknown> } = {},
  ) {
    const troubleshooting = [
      `Install the required module: npm install ${moduleName}`,
      "Rebuild native modules: npm rebuild",
      "Check Node.js and npm versions compatibility",
      "Clear node_modules and reinstall dependencies",
    ];

    const context = {
      moduleName,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ...options.context,
    };

    super(
      `Native module '${moduleName}' failed to load for language '${language}'`,
      ErrorCategory.NATIVE_MODULE,
      ErrorSeverity.HIGH,
      { language, troubleshooting, context, cause },
    );
  }
}

/**
 * Utility function to create appropriate error based on context
 */
export function createOptimizedError(
  type: "parser" | "grammar" | "wasm" | "native",
  language: string,
  details: Record<string, unknown>,
  cause?: Error,
): TreeSitterError {
  switch (type) {
    case "parser":
      return new ParserLoadError(
        language,
        details.nativeError as Error | undefined,
        details.wasmError as Error | undefined,
        { context: details },
      );
    case "grammar":
      return new GrammarDownloadError(language, details.url as string, cause, {
        context: details,
      });
    case "wasm":
      return new WASMIntegrationError(
        language,
        details.grammarPath as string,
        cause,
        { context: details },
      );
    case "native":
      return new NativeModuleError(
        language,
        details.moduleName as string,
        cause,
        { context: details },
      );
    default:
      return new TreeSitterError(
        `Unknown error for language '${language}'`,
        ErrorCategory.RUNTIME,
        ErrorSeverity.MEDIUM,
        { language, context: details, cause },
      );
  }
}
