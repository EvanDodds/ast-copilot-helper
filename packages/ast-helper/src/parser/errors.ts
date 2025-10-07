/**
 * Enhanced error classes for Tree-sitter parser system
 * Provides structured, user-friendly error messages with troubleshooting guidance
 */

export enum ErrorCategory {
  PARSER_LOAD = "PARSER_LOAD",
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
    _wasmError?: Error, // Unused in native-only mode
    options: { context?: Record<string, unknown> } = {},
  ) {
    const troubleshooting = [
      `Install native parser: npm install tree-sitter-${language}`,
      "Check language configuration in languages.ts",
      "Verify native module compatibility with your Node.js version",
      "Rebuild native modules: npm rebuild",
    ];

    const context = {
      nativeError: nativeError?.message || "N/A",
      nativeStatus: nativeError?.message.includes("Native parser not available")
        ? "Not installed"
        : "Failed",
      ...options.context,
    };

    super(
      `Failed to load parser for language '${language}'. Native parser failed.`,
      ErrorCategory.PARSER_LOAD,
      ErrorSeverity.HIGH,
      { language, troubleshooting, context, cause: nativeError },
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
  type: "parser" | "native",
  language: string,
  details: Record<string, unknown>,
  cause?: Error,
): TreeSitterError {
  switch (type) {
    case "parser":
      return new ParserLoadError(
        language,
        details.nativeError as Error | undefined,
        undefined,
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
