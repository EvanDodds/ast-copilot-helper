#!/usr/bin/env node

/**
 * CLI entry point for ast-helper
 * Commander.js-based CLI framework with all subcommands defined and basic argument validation
 */

import { Command, Option } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from './config/index.js';
import { ConfigurationErrors, ErrorFormatter, ValidationErrors } from './errors/index.js';
import { LockManager, type Lock } from './locking/index.js';
import { createLogger, parseLogLevel, setupGlobalErrorHandling } from './logging/index.js';
import type { Config } from './types.js';

/**
 * Global CLI options available for all commands
 */
interface GlobalOptions {
  config?: string;
  workspace?: string;
}

/**
 * Options for the init command
 */
interface InitOptions extends GlobalOptions {
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  dbPath?: string;
}

/**
 * Options for the parse command
 */
interface ParseOptions extends GlobalOptions {
  changed?: boolean;
  glob?: string;
  base?: string;
  staged?: boolean;
}

/**
 * Options for the annotate command
 */
interface AnnotateOptions extends GlobalOptions {
  changed?: boolean;
  force?: boolean;
}

/**
 * Options for the embed command
 */
interface EmbedOptions extends GlobalOptions {
  changed?: boolean;
  model?: string;
  batchSize?: number;
}

/**
 * Options for the query command
 */
interface QueryOptions extends GlobalOptions {
  top?: number;
  minScore?: number;
  format?: 'plain' | 'json' | 'markdown';
  intent?: string;
}

/**
 * Options for the watch command
 */
interface WatchOptions extends GlobalOptions {
  glob?: string;
  debounce?: number;
  batchSize?: number;
}

/**
 * Interface for command handlers
 */
interface CommandHandler<T = any> {
  execute(options: T, config: Config): Promise<void>;
}

/**
 * Main CLI class using Commander.js framework
 */
export class AstHelperCli {
  private program: Command;
  private config?: Config;
  private logger = createLogger();
  private errorFormatter = new ErrorFormatter();
  private lockManager?: LockManager;
  private configManager = new ConfigManager();
  private currentLock?: Lock;

  constructor() {
    this.program = new Command();
    this.setupGlobalSettings();
    this.setupCommands();
    setupGlobalErrorHandling(this.logger);
  }

  /**
   * Set up global program settings
   */
  private setupGlobalSettings(): void {
    this.program
      .name('ast-helper')
      .description('CLI data processor that builds .astdb/ database from source code')
      .version(this.getVersion())
      .addOption(new Option('--config <path>', 'Configuration file path'))
      .addOption(new Option('--workspace <path>', 'Workspace directory').default(process.cwd()))
      .helpOption('-h, --help', 'Show help information')
      .configureHelp({
        sortSubcommands: true,
        subcommandTerm: (cmd) => cmd.name() + (cmd.alias() ? '|' + cmd.alias() : '')
      });
  }

  /**
   * Set up all commands with their options and validation
   */
  private setupCommands(): void {
    this.setupInitCommand();
    this.setupParseCommand();
    this.setupAnnotateCommand();
    this.setupEmbedCommand();
    this.setupQueryCommand();
    this.setupWatchCommand();
  }

  /**
   * Set up the init command
   */
  private setupInitCommand(): void {
    this.program
      .command('init')
      .description('Initialize AST database directory structure')
      .addOption(new Option('--workspace <path>', 'Workspace directory to initialize').default(process.cwd()))
      .addOption(new Option('--force', 'Overwrite existing .astdb directory'))
      .addOption(new Option('--verbose', 'Show detailed progress information'))
      .addOption(new Option('--dry-run', 'Show what would be done without making changes'))
      .addOption(new Option('--db-path <path>', 'Custom path for AST database directory (defaults to workspace/.astdb)'))
      .action(async (options: InitOptions) => {
        await this.executeCommand('init', options);
      });
  }

  /**
   * Set up the parse command
   */
  private setupParseCommand(): void {
    this.program
      .command('parse')
      .description('Extract AST from source files')
      .addOption(new Option('-c, --changed', 'Process only changed files since last commit'))
      .addOption(new Option('--glob <pattern>', 'File pattern to parse (overrides config)'))
      .addOption(new Option('--base <ref>', 'Git reference for --changed comparison').default('HEAD'))
      .addOption(new Option('--staged', 'Process only staged files (with --changed)'))
      .action(async (options: ParseOptions) => {
        await this.executeCommand('parse', options);
      });
  }

  /**
   * Set up the annotate command
   */
  private setupAnnotateCommand(): void {
    this.program
      .command('annotate')
      .description('Generate metadata for parsed AST nodes')
      .addOption(new Option('-c, --changed', 'Process only nodes from changed files'))
      .addOption(new Option('--force', 'Regenerate all annotations even if unchanged'))
      .action(async (options: AnnotateOptions) => {
        await this.executeCommand('annotate', options);
      });
  }

  /**
   * Set up the embed command
   */
  private setupEmbedCommand(): void {
    this.program
      .command('embed')
      .description('Generate vector embeddings for annotations')
      .addOption(new Option('-c, --changed', 'Process only changed annotations'))
      .addOption(new Option('--model <name>', 'Embedding model to use').default('codebert-base'))
      .addOption(new Option('--batch-size <n>', 'Batch size for embedding generation').default(32).argParser((value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 1000) {
          throw new Error('--batch-size must be between 1 and 1000');
        }
        return num;
      }))
      .action(async (options: EmbedOptions) => {
        await this.executeCommand('embed', options);
      });
  }

  /**
   * Set up the query command
   */
  private setupQueryCommand(): void {
    this.program
      .command('query')
      .description('Search for relevant code context')
      .argument('<intent>', 'Query text describing desired functionality')
      .addOption(new Option('--top <n>', 'Number of results to return').default(5).argParser((value) => {
        const num = parseInt(value);
        if (num < 1 || num > 100) {
          throw new Error('--top must be between 1 and 100');
        }
        return num;
      }))
      .addOption(new Option('--min-score <n>', 'Minimum similarity score (0.0-1.0)').default(0.0).argParser((value) => {
        const num = parseFloat(value);
        if (num < 0.0 || num > 1.0) {
          throw new Error('--min-score must be between 0.0 and 1.0');
        }
        return num;
      }))
      .addOption(new Option('--format <fmt>', 'Output format').choices(['plain', 'json', 'markdown']).default('plain'))
      .action(async (intent: string, options: QueryOptions) => {
        await this.executeCommand('query', { ...options, intent });
      });
  }

  /**
   * Set up the watch command
   */
  private setupWatchCommand(): void {
    this.program
      .command('watch')
      .description('Monitor files for changes and auto-update')
      .addOption(new Option('--glob <pattern>', 'File pattern to watch (overrides config)'))
      .addOption(new Option('--debounce <ms>', 'Debounce delay for file changes').default(200).argParser((value) => {
        const num = parseInt(value);
        if (num < 50) {
          throw new Error('--debounce must be at least 50ms');
        }
        return num;
      }))
      .addOption(new Option('--batch-size <n>', 'Maximum batch size for processing').default(50).argParser((value) => {
        const num = parseInt(value);
        if (num < 1 || num > 1000) {
          throw new Error('--batch-size must be between 1 and 1000');
        }
        return num;
      }))
      .action(async (options: WatchOptions) => {
        await this.executeCommand('watch', options);
      });
  }

  /**
   * Main entry point for CLI
   */
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    try {
      // Initialize LockManager with current workspace
      this.lockManager = new LockManager(process.cwd());

      // Add custom validation before parsing
      this.addCustomValidation();

      // Parse and execute commands
      await this.program.parseAsync(args, { from: 'user' });
    } catch (error) {
      await this.handleError(error);
      process.exit(this.getExitCode(error));
    }
  }

  /**
   * Add custom validation for mutually exclusive options and other complex rules
   */
  private addCustomValidation(): void {
    // Add hook to validate mutually exclusive options
    this.program.hook('preAction', (_thisCommand, actionCommand) => {
      const opts = actionCommand.opts();

      // Validate mutually exclusive options for parse command
      if (actionCommand.name() === 'parse') {
        if (opts.changed && opts.glob) {
          throw ValidationErrors.invalidValue('--changed and --glob', 'both specified', 'These options are mutually exclusive');
        }

        // Validate staged option only works with changed
        if (opts.staged && !opts.changed) {
          throw ValidationErrors.invalidValue('--staged', 'used without --changed', 'The --staged option can only be used with --changed');
        }
      }

      // Validate Git repository for --changed flag
      if ((opts.changed || opts.staged) && !this.isGitRepository(opts.workspace || process.cwd())) {
        throw ValidationErrors.invalidValue('--changed', 'used outside Git repository', 'Git repository detection required for --changed flag');
      }
    });
  }

  /**
   * Execute a command with proper error handling and configuration loading
   */
  private async executeCommand(commandName: string, options: any): Promise<void> {
    try {
      // Determine workspace path
      const workspacePath = options.workspace || process.cwd();

      // Load configuration
      await this.loadConfiguration(workspacePath, options);

      // Set up logging
      this.setupLogging();

      // Acquire database lock
      await this.acquireDatabaseLock();

      // Create database directory if needed
      await this.ensureDatabaseDirectory();

      // Execute the appropriate command handler
      const handler = this.getCommandHandler(commandName);
      await handler.execute(options, this.config!);

      // Release lock
      await this.releaseDatabaseLock();

    } catch (error) {
      await this.releaseDatabaseLock();
      throw error;
    }
  }

  /**
   * Get version from package.json
   */
  private getVersion(): string {
    try {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(require('fs').readFileSync(packagePath, 'utf8'));
      return packageJson.version || '0.1.0';
    } catch {
      return '0.1.0';
    }
  }

  /**
   * Get command handler for a specific command
   */
  private getCommandHandler(commandName: string): CommandHandler {
    switch (commandName) {
      case 'init':
        return new InitCommandHandler();
      case 'parse':
        return new ParseCommandHandler();
      case 'annotate':
        return new AnnotateCommandHandler();
      case 'embed':
        return new EmbedCommandHandler();
      case 'query':
        return new QueryCommandHandler();
      case 'watch':
        return new WatchCommandHandler();
      default:
        throw ValidationErrors.invalidValue('command', commandName, 'Unknown command');
    }
  }

  /**
   * Check if directory is a Git repository
   */
  private isGitRepository(workspacePath: string): boolean {
    try {
      const gitPath = path.join(workspacePath, '.git');
      return require('fs').existsSync(gitPath);
    } catch {
      return false;
    }
  }

  /**
   * Get appropriate exit code based on error type
   */
  private getExitCode(error: unknown): number {
    if (error && typeof error === 'object' && 'isAstError' in error) {
      const astError = error as any;
      if (astError.code?.startsWith('VALIDATION')) {
        return 1; // User error
      } else if (astError.code?.startsWith('CONFIGURATION')) {
        return 1; // User error
      } else {
        return 2; // System error
      }
    }
    return 1; // Default to user error
  }

  /**
   * Load and merge configuration from all sources
   */
  private async loadConfiguration(workspacePath: string, cliOptions: any): Promise<void> {
    try {
      this.config = await this.configManager.loadConfig(workspacePath, cliOptions);
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
    if (!this.config) return;

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

    if (!this.config) {
      throw ConfigurationErrors.invalidValue('config', 'undefined', 'Configuration not loaded');
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
    if (!this.config) {
      throw ConfigurationErrors.invalidValue('config', 'undefined', 'Configuration not loaded');
    }

    try {
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
}

/**
 * Command Handler Implementations - Stub handlers for each command
 */

class InitCommandHandler implements CommandHandler<InitOptions> {
  private logger = createLogger();

  async execute(options: InitOptions, _config: Config): Promise<void> {
    const {
      workspace = process.cwd(),
      force = false,
      verbose = false,
      dryRun = false,
      dbPath
    } = options;

    if (verbose) {
      console.log('🚀 Initializing AST database structure...');
      console.log(`   Workspace: ${workspace}`);
      console.log(`   Force overwrite: ${force}`);
      console.log(`   Dry run: ${dryRun}`);
      if (dbPath) {
        console.log(`   Custom DB path: ${dbPath}`);
      }
      console.log('');
    }

    try {
      // Import database modules dynamically to avoid circular dependencies
      const {
        ASTDatabaseManager,
        DatabaseConfigurationManager,
        DatabaseVersionManager,
        WorkspaceDetector
      } = await import('./database/index.js');

      // Step 1: Detect and validate workspace
      if (verbose) console.log('📂 Detecting workspace...');

      const workspaceDetector = new WorkspaceDetector();
      const workspaceInfo = await workspaceDetector.detectWorkspace({
        startDir: workspace,
        allowExisting: true
      });

      if (verbose) {
        console.log(`   ✅ Workspace detected: ${workspaceInfo.root}`);
        console.log(`   Method: ${workspaceInfo.detectionMethod}`);
        console.log(`   Git repository: ${workspaceInfo.isGitRepository ? 'Yes' : 'No'}`);
        if (workspaceInfo.indicators.length > 0) {
          console.log(`   Indicators: ${workspaceInfo.indicators.join(', ')}`);
        }
        console.log('');
      }

      // Determine database path
      const astdbPath = dbPath || workspaceDetector.getDefaultDatabasePath(workspaceInfo.root);

      if (verbose) {
        console.log(`📁 Database path: ${astdbPath}`);
        console.log('');
      }

      // Step 2: Validate workspace for database creation
      if (verbose) console.log('🔍 Validating workspace...');

      const databaseInitOptions = {
        force,
        verbose,
        dryRun
      };

      await workspaceDetector.validateWorkspaceForDatabase(workspaceInfo, databaseInitOptions);

      if (verbose) {
        console.log('   ✅ Workspace validation passed');
        console.log('');
      }

      // Step 3: Create database directory structure
      if (verbose) console.log('🏗️  Creating database structure...');

      const dbManager = new ASTDatabaseManager(workspaceInfo.root);
      await dbManager.createDirectoryStructure(databaseInitOptions);

      if (verbose) {
        console.log('   ✅ Database directories created');
        console.log('');
      }

      // Step 4: Generate configuration file
      if (verbose) console.log('⚙️  Generating configuration...');

      const configManager = new DatabaseConfigurationManager();
      await configManager.createConfigurationFile(astdbPath, databaseInitOptions);

      if (verbose) {
        console.log('   ✅ Configuration file created');
        console.log('');
      }

      // Step 5: Create version file
      if (verbose) console.log('📋 Creating version file...');

      const versionManager = new DatabaseVersionManager();
      await versionManager.createVersionFile(astdbPath, databaseInitOptions);

      if (verbose) {
        console.log('   ✅ Version file created');
        console.log('');
      }

      // Step 6: Final validation
      if (verbose) console.log('🔎 Validating database structure...');

      await dbManager.validateDatabaseStructure();

      if (verbose) {
        console.log('   ✅ Database structure validated');
        console.log('');
      }

      // Success message
      if (dryRun) {
        console.log('✅ Dry run completed successfully!');
        console.log(`   Database structure would be created at: ${astdbPath}`);
      } else {
        console.log('✅ AST database initialized successfully!');
        console.log(`   Database location: ${astdbPath}`);
        console.log(`   Workspace: ${workspaceInfo.root}`);
        console.log(`   Next steps: Run 'ast-helper parse' to index your codebase`);
      }

      this.logger.info('Database initialization completed', {
        workspace: workspaceInfo.root,
        dbPath: astdbPath,
        method: workspaceInfo.detectionMethod,
        dryRun
      });

    } catch (error) {
      const errorFormatter = new ErrorFormatter();
      const formattedError = errorFormatter.formatForUser(error as Error);

      console.error('❌ Failed to initialize AST database');
      console.error(formattedError);

      this.logger.error('Database initialization failed', {
        workspace,
        dbPath,
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      process.exit(1);
    }
  }
}

class ParseCommandHandler implements CommandHandler<ParseOptions> {
  async execute(options: ParseOptions, config: Config): Promise<void> {
    console.log('Parse command executed with options:', options);
    console.log('Using config:', { outputDir: config.outputDir, parseGlob: config.parseGlob });
    // TODO: Implement actual parse logic
  }
}

class AnnotateCommandHandler implements CommandHandler<AnnotateOptions> {
  async execute(options: AnnotateOptions, config: Config): Promise<void> {
    console.log('Annotate command executed with options:', options);
    console.log('Using config:', { outputDir: config.outputDir });
    // TODO: Implement actual annotate logic
  }
}

class EmbedCommandHandler implements CommandHandler<EmbedOptions> {
  async execute(options: EmbedOptions, config: Config): Promise<void> {
    console.log('Embed command executed with options:', options);
    console.log('Using config:', { outputDir: config.outputDir });
    // TODO: Implement actual embed logic
  }
}

class QueryCommandHandler implements CommandHandler<QueryOptions> {
  async execute(options: QueryOptions, config: Config): Promise<void> {
    console.log('Query command executed with options:', options);
    console.log('Using config:', { outputDir: config.outputDir, topK: config.topK });
    // TODO: Implement actual query logic
  }
}

class WatchCommandHandler implements CommandHandler<WatchOptions> {
  async execute(options: WatchOptions, config: Config): Promise<void> {
    console.log('Watch command executed with options:', options);
    console.log('Using config:', { outputDir: config.outputDir, watchGlob: config.watchGlob });
    // TODO: Implement actual watch logic
  }
}

// Run CLI if this file is executed directly
const isMain = process.argv && process.argv.length >= 2 && (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts'));
if (isMain) {
  const cli = new AstHelperCli();
  cli.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default AstHelperCli;