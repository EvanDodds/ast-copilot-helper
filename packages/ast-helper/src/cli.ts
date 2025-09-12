#!/usr/bin/env node

/**
 * CLI entry point for ast-helper
 * Integrates configuration, logging, error handling, and file locking systems
 */

import { ConfigManager } from './config/index.js';
import { createLogger, setupGlobalErrorHandling, parseLogLevel } from './logging/index.js';
import { ErrorFormatter } from './errors/index.js';
import { LockManager, type Lock } from './locking/index.js';
import type { Config, CliArgs } from './types.js';
import { ValidationErrors, ConfigurationErrors } from './errors/index.js';
import * as path from 'path';

export interface CliOptions {
  /** Source directory or file to process */
  source?: string;
  /** Output directory for .astdb database */
  output?: string;
  /** Parse glob patterns */
  parseGlob?: string[];
  /** Watch glob patterns */
  watchGlob?: string[];
  /** Top-K search results */
  topK?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Output logs in JSON format */
  jsonLogs?: boolean;
  /** Log file path */
  logFile?: string;
  /** Enable watch mode */
  watch?: boolean;
  /** Display help */
  help?: boolean;
  /** Display version */
  version?: boolean;
}

export class AstHelperCli {
  private config!: Config;
  private logger = createLogger();
  private errorFormatter = new ErrorFormatter();
  private lockManager?: LockManager;
  private configManager = new ConfigManager();
  private currentLock?: Lock;

  constructor() {
    // Set up global error handling
    setupGlobalErrorHandling(this.logger);
  }

  /**
   * Main entry point for CLI
   */
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    try {
      // Parse CLI arguments
      const cliArgs = this.parseArgs(args);
      
      // Handle help and version flags
      if (cliArgs.help) {
        this.showHelp();
        return;
      }
      
      if (cliArgs.version) {
        this.showVersion();
        return;
      }

      // Determine workspace path
      const workspacePath = cliArgs.source || process.cwd();
      
      // Initialize LockManager with workspace path
      this.lockManager = new LockManager(workspacePath);

      // Load configuration
      await this.loadConfiguration(workspacePath, cliArgs);
      
      // Set up logging based on configuration
      this.setupLogging();
      
      // Acquire database lock
      await this.acquireDatabaseLock();
      
      // Create database directory structure if needed
      await this.ensureDatabaseDirectory();

      // TODO: Add actual AST processing logic here
      this.logger.info('AST Helper CLI started successfully', {
        workspacePath,
        outputDir: this.config.outputDir,
        verbose: this.config.verbose,
        debug: this.config.debug
      });

      // Release lock before exit
      await this.releaseDatabaseLock();
      
    } catch (error) {
      await this.handleError(error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): CliArgs {
    const parsed: CliArgs = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--help' || arg === '-h') {
        parsed.help = true;
      } else if (arg === '--version' || arg === '-v') {
        parsed.version = true;
      } else if (arg === '--verbose') {
        parsed.verbose = true;
      } else if (arg === '--debug') {
        parsed.debug = true;
      } else if (arg === '--json-logs') {
        parsed.jsonLogs = true;
      } else if (arg === '--watch') {
        parsed.watch = true;
      } else if (arg === '--source') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          throw ValidationErrors.missingValue('--source', 'directory path');
        }
        parsed.source = nextArg;
        i++;
      } else if (arg === '--output') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          throw ValidationErrors.missingValue('--output', 'directory path');
        }
        parsed.outputDir = nextArg;
        i++;
      } else if (arg === '--parse-glob') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          throw ValidationErrors.missingValue('--parse-glob', 'glob pattern');
        }
        parsed.parseGlob = nextArg.split(',').map(p => p.trim());
        i++;
      } else if (arg === '--watch-glob') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          throw ValidationErrors.missingValue('--watch-glob', 'glob pattern');
        }
        parsed.watchGlob = nextArg.split(',').map(p => p.trim());
        i++;
      } else if (arg === '--top-k') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          throw ValidationErrors.missingValue('--top-k', 'number');
        }
        const topK = parseInt(nextArg, 10);
        if (isNaN(topK)) {
          throw ValidationErrors.invalidValue('--top-k', nextArg, 'Must be a number');
        }
        parsed.topK = topK;
        i++;
      } else if (arg === '--log-file') {
        const nextArg = args[i + 1];
        if (!nextArg || nextArg.startsWith('-')) {
          throw ValidationErrors.missingValue('--log-file', 'file path');
        }
        parsed.logFile = nextArg;
        i++;
      } else {
        // Handle positional arguments or unknown flags
        const currentArg = args[i];
        if (currentArg && !currentArg.startsWith('-')) {
          // Positional argument - treat as source if not set
          if (!parsed.source) {
            parsed.source = currentArg;
          }
        } else {
          throw ValidationErrors.invalidValue('CLI argument', currentArg || '', 'Use --help for usage information');
        }
      }
    }
    
    return parsed;
  }

  /**
   * Load and merge configuration from all sources
   */
  private async loadConfiguration(workspacePath: string, cliArgs: CliArgs): Promise<void> {
    try {
      this.config = await this.configManager.loadConfig(workspacePath, cliArgs);
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        'Failed to load configuration',
        error as Error
      );
    }
  }

  /**
   * Set up logging based on configuration
   */
  private setupLogging(): void {
    const logLevel = parseLogLevel(this.config.debug ? 'debug' : this.config.verbose ? 'info' : 'warn');
    
    this.logger = createLogger({ 
      level: logLevel,
      jsonOutput: this.config.jsonLogs,
      logFile: this.config.logFile,
      includeTimestamp: true
    });
  }

  /**
   * Acquire exclusive lock for database operations
   */
  private async acquireDatabaseLock(): Promise<void> {
    if (!this.lockManager) {
      throw ConfigurationErrors.invalidValue('lockManager', 'undefined', 'LockManager not initialized');
    }

    try {
      const lockPath = path.join(this.config.outputDir, '.lock');
      this.currentLock = await this.lockManager.acquireExclusiveLock(lockPath, { 
        timeoutMs: 30000 
      });
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        'Failed to acquire database lock',
        error as Error
      );
    }
  }

  /**
   * Release database lock
   */
  private async releaseDatabaseLock(): Promise<void> {
    if (!this.lockManager || !this.currentLock) {
      return;
    }
    
    try {
      await this.lockManager.releaseLock(this.currentLock);
    } catch (error) {
      this.logger.warn('Failed to release database lock', { error: (error as Error).message });
    }
  }

  /**
   * Ensure database directory structure exists
   */
  private async ensureDatabaseDirectory(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      
      await fs.mkdir(this.config.outputDir, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.config.outputDir, 'index'), { recursive: true });
      await fs.mkdir(path.join(this.config.outputDir, 'cache'), { recursive: true });
      await fs.mkdir(path.join(this.config.outputDir, 'logs'), { recursive: true });
      
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        'Failed to create database directory structure',
        error as Error
      );
    }
  }

  /**
   * Handle errors with appropriate formatting and logging
   */
  private async handleError(error: unknown): Promise<void> {
    if (error && typeof error === 'object' && 'isAstError' in error) {
      // Handle AST-specific errors
      const userMessage = this.errorFormatter.formatForUser(error as any);
      const debugMessage = this.errorFormatter.formatForDebug(error as any);
      
      console.error(userMessage);
      
      if (this.config?.debug) {
        console.error('Debug details:', debugMessage);
      }
      
      // Log structured error details
      this.logger.error('CLI error occurred', {
        message: (error as any).message,
        code: (error as any).code,
        context: (error as any).context
      });
    } else {
      // Handle generic errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${errorMessage}`);
      
      this.logger.error('Unexpected CLI error', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Display help message
   */
  private showHelp(): void {
    const help = `
AST Copilot Helper - Code Analysis and Search Tool

USAGE:
    ast-helper [OPTIONS] [SOURCE]

ARGUMENTS:
    <SOURCE>              Source directory or file to process (default: current directory)

OPTIONS:
    -h, --help           Show this help message
    -v, --version        Show version information
    
    --source <PATH>      Source directory or file to process
    --output <PATH>      Output directory for database files (default: .astdb)
    
    --parse-glob <GLOB>  File patterns to parse (comma-separated)
    --watch-glob <GLOB>  File patterns to watch (comma-separated)
    --top-k <NUMBER>     Number of search results to return
    
    --verbose            Enable verbose logging
    --debug              Enable debug logging
    --json-logs          Output logs in JSON format
    --log-file <PATH>    Write logs to specified file
    --watch              Enable watch mode for file changes

EXAMPLES:
    ast-helper                           # Process current directory
    ast-helper ./src                     # Process specific directory
    ast-helper --parse-glob "**/*.ts"    # Parse only TypeScript files
    ast-helper --top-k 20 --verbose     # Increase results and enable verbose logging

ENVIRONMENT VARIABLES:
    AST_COPILOT_OUTPUT_DIR              Output directory for database files
    AST_COPILOT_TOP_K                   Number of search results
    AST_COPILOT_PARSE_GLOB              File patterns to parse
    AST_COPILOT_WATCH_GLOB              File patterns to watch
    AST_COPILOT_VERBOSE                 Enable verbose logging (true/false)
    AST_COPILOT_DEBUG                   Enable debug logging (true/false)
    AST_COPILOT_JSON_LOGS               Output logs in JSON format (true/false)
    AST_COPILOT_LOG_FILE                Log file path

For more information, visit: https://github.com/EvanDodds/ast-copilot-helper
`;

    console.log(help);
  }

  /**
   * Display version information
   */
  private showVersion(): void {
    // TODO: Read version from package.json
    console.log('ast-helper version 0.1.0');
  }
}

// Run CLI if this file is executed directly
const isMain = process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts');
if (isMain) {
  const cli = new AstHelperCli();
  cli.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default AstHelperCli;
