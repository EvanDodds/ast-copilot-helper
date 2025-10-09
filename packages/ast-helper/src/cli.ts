#!/usr/bin/env node

/**
 * CLI entry point for ast-helper
 * Commander.js-based CLI framework with all subcommands defined and basic argument validation
 */

import { Command, Option } from "commander";
import * as fs from "fs/promises";
import { readFileSync, existsSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ConfigManager } from "./config/index.js";
import {
  ConfigurationErrors,
  ErrorFormatter,
  ValidationErrors,
} from "./errors/index.js";
import { LockManager, type Lock } from "./locking/index.js";
import {
  createLogger,
  parseLogLevel,
  setupGlobalErrorHandling,
} from "./logging/index.js";
import type { Config } from "./types.js";

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
  noGitignore?: boolean;
}

/**
 * Options for the parse command
 */
interface ParseOptions extends GlobalOptions {
  changed?: boolean;
  glob?: string;
  base?: string;
  staged?: boolean;
  force?: boolean;
  batchSize?: number;
  dryRun?: boolean;
  outputStats?: boolean;
  // New options for integration test compatibility
  recursive?: boolean;
  language?: string;
  languages?: string;
  output?: string;
  outputFile?: string;
  benchmark?: boolean;
}

/**
 * Options for the annotate command
 */
interface AnnotateOptions extends GlobalOptions {
  batch?: boolean;
  batchSize?: number;
  output?: string;
  format?: "json" | "yaml" | "markdown";
  force?: boolean;
  changed?: boolean;
  storeResults?: boolean;
}

/**
 * Options for the embed command
 */
interface EmbedOptions extends GlobalOptions {
  changed?: boolean;
  model?: string;
  batchSize?: number;
  force?: boolean;
  dryRun?: boolean;
}

/**
 * Options for the query command
 */
interface QueryOptions extends GlobalOptions {
  top?: number;
  minScore?: number;
  format?: "plain" | "json" | "markdown";
  intent: string;
}

/**
 * Options for the watch command
 */
interface WatchOptions extends GlobalOptions {
  changed?: boolean;
  glob?: string;
  debounce?: number;
  batchSize?: number;
}

/**
 * Options for model management commands
 */
interface ModelDownloadOptions extends GlobalOptions {
  output?: string;
  force?: boolean;
  verify?: boolean;
  progress?: boolean;
}

interface ModelCacheOptions extends GlobalOptions {
  clear?: boolean;
  stats?: boolean;
  list?: boolean;
  size?: string;
}

interface ModelVerifyOptions extends GlobalOptions {
  quarantine?: boolean;
  strict?: boolean;
  format?: boolean;
}

interface ModelListOptions extends GlobalOptions {
  format?: "table" | "json" | "yaml";
  filter?: string;
  cached?: boolean;
}

interface ModelStatusOptions extends GlobalOptions {
  detailed?: boolean;
  performance?: boolean;
  health?: boolean;
}

/**
 * Options for cache management commands
 */
interface CacheClearOptions extends GlobalOptions {
  level?: "L1" | "L2" | "L3" | "all";
  confirm?: boolean;
  verbose?: boolean;
}

interface CacheStatsOptions extends GlobalOptions {
  json?: boolean;
  detailed?: boolean;
  level?: "L1" | "L2" | "L3" | "all";
}

interface CacheWarmOptions extends GlobalOptions {
  count?: number;
  verbose?: boolean;
  dryRun?: boolean;
}

interface CachePruneOptions extends GlobalOptions {
  olderThan?: string;
  level?: "L1" | "L2" | "L3" | "all";
  dryRun?: boolean;
  verbose?: boolean;
}

interface CacheAnalyzeOptions extends GlobalOptions {
  topQueries?: number;
  format?: "text" | "json" | "markdown";
  recommendations?: boolean;
}

/**
 * Options for the performance command
 */
interface PerformanceOptions extends GlobalOptions {
  type?: string;
  verbose?: boolean;
  outputDir?: string;
  targets?: string;
  reportFormat?: string;
  memoryLimit?: number;
  concurrencyLimit?: number;
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
      .name("ast-helper")
      .description(
        "CLI data processor that builds .astdb/ database from source code",
      )
      .version(this.getVersion())
      .addOption(new Option("--config <path>", "Configuration file path"))
      .addOption(
        new Option(
          "--user-config <path>",
          "User configuration file path (overrides XDG default)",
        ),
      )
      .addOption(
        new Option("--workspace <path>", "Workspace directory").default(
          process.cwd(),
        ),
      )
      .helpOption("-h, --help", "Show help information")
      .configureHelp({
        sortSubcommands: true,
        subcommandTerm: (cmd) =>
          cmd.name() + (cmd.alias() ? "|" + cmd.alias() : ""),
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
    this.setupModelCommands();
    this.setupCacheCommands();
    this.setupSnapshotCommands();
    this.setupPerformanceCommand();
  }

  /**
   * Set up the init command
   */
  private setupInitCommand(): void {
    this.program
      .command("init")
      .description("Initialize AST database directory structure")
      .addOption(
        new Option(
          "--workspace <path>",
          "Workspace directory to initialize",
        ).default(process.cwd()),
      )
      .addOption(new Option("--force", "Overwrite existing .astdb directory"))
      .addOption(new Option("--verbose", "Show detailed progress information"))
      .addOption(
        new Option(
          "--dry-run",
          "Show what would be done without making changes",
        ),
      )
      .addOption(
        new Option(
          "--db-path <path>",
          "Custom path for AST database directory (defaults to workspace/.astdb)",
        ),
      )
      .addOption(
        new Option(
          "--no-gitignore",
          "Skip .gitignore generation (database files will not be automatically excluded)",
        ),
      )
      .action(async (options: InitOptions) => {
        await this.executeCommand("init", options);
      });
  }

  /**
   * Set up the parse command
   */
  private setupParseCommand(): void {
    this.program
      .command("parse [path]")
      .description(
        "Extract AST from source files and save to .astdb database\n\n" +
          "Git Integration Examples:\n" +
          "  ast-helper parse --staged              # Parse only staged files (pre-commit)\n" +
          "  ast-helper parse --changed             # Parse all working directory changes\n" +
          "  ast-helper parse --base main           # Parse files changed since main branch\n" +
          "  ast-helper parse --base origin/develop # Parse files changed since develop",
      )
      .addOption(
        new Option(
          "-c, --changed",
          "Process only changed files in working directory (modified, added, renamed, etc.)",
        ),
      )
      .addOption(
        new Option(
          "--glob <pattern>",
          "File pattern to parse (overrides config parseGlob)",
        ),
      )
      .addOption(
        new Option(
          "--base <ref>",
          "Git reference to compare against (e.g., main, origin/main, abc123). Example: --base main",
        ).default("HEAD"),
      )
      .addOption(
        new Option(
          "--staged",
          "Process only staged files (files added with 'git add'). Useful for pre-commit hooks.",
        ),
      )
      .addOption(
        new Option(
          "--force",
          "Reparse files even if AST already exists and is up-to-date",
        ),
      )
      .addOption(
        new Option("--batch-size <n>", "Number of files to process in parallel")
          .default(10)
          .argParser((value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 100) {
              throw new Error("--batch-size must be between 1 and 100");
            }
            return num;
          }),
      )
      .addOption(
        new Option(
          "--dry-run",
          "Show what would be parsed without actually parsing",
        ),
      )
      .addOption(
        new Option("--output-stats", "Display detailed parsing statistics"),
      )
      .addOption(
        new Option(
          "-r, --recursive",
          "Parse files recursively in subdirectories",
        ),
      )
      .addOption(
        new Option(
          "--language <lang>",
          "Parse files of specific language (typescript, javascript, python, java, etc.)",
        ),
      )
      .addOption(
        new Option(
          "--languages <langs>",
          "Parse files of multiple languages (comma-separated)",
        ),
      )
      .addOption(
        new Option(
          "--output <format>",
          "Output format (json, yaml, csv)",
        ).default("json"),
      )
      .addOption(
        new Option("--output-file <file>", "Save output to specified file"),
      )
      .addOption(
        new Option("--benchmark", "Run performance benchmarks during parsing"),
      )
      .action(async (path: string | undefined, options: ParseOptions) => {
        // If path is provided, set it in options for backward compatibility
        if (path) {
          (options as any).targetPath = path;
        }
        await this.executeCommand("parse", options);
      });
  }

  /**
   * Set up the annotate command
   */
  private setupAnnotateCommand(): void {
    this.program
      .command("annotate [path]")
      .description(
        "Generate semantic annotations for parsed ASTs using Rust backend",
      )
      .addOption(
        new Option(
          "--glob <pattern>",
          "File pattern to annotate (overrides config parseGlob)",
        ),
      )
      .addOption(
        new Option(
          "-c, --changed",
          "Process only changed files since last commit",
        ),
      )
      .addOption(
        new Option(
          "--batch",
          "Enable batch processing mode for multiple files",
        ),
      )
      .addOption(
        new Option("--batch-size <n>", "Number of files to process in parallel")
          .default(5)
          .argParser((value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 50) {
              throw new Error("--batch-size must be between 1 and 50");
            }
            return num;
          }),
      )
      .addOption(
        new Option(
          "--output <file>",
          "Save annotation results to specified file",
        ),
      )
      .addOption(
        new Option(
          "--format <format>",
          "Output format (json, yaml, markdown)",
        ).default("json"),
      )
      .addOption(
        new Option(
          "--force",
          "Regenerate annotations even if they already exist",
        ),
      )
      .addOption(
        new Option(
          "--store-results",
          "Store annotation results in database",
        ).default(true),
      )
      .action(async (path: string | undefined, options: AnnotateOptions) => {
        // If path is provided, set it in options for backward compatibility
        if (path) {
          (options as any).targetPath = path;
        }
        await this.executeCommand("annotate", options);
      });
  }

  /**
   * Set up the embed command
   */
  private setupEmbedCommand(): void {
    this.program
      .command("embed")
      .description("Generate vector embeddings for annotations")
      .addOption(
        new Option("-c, --changed", "Process only changed annotations"),
      )
      .addOption(
        new Option("--model <name>", "Embedding model to use").default(
          "codebert-base",
        ),
      )
      .addOption(
        new Option("--batch-size <n>", "Batch size for embedding generation")
          .default(32)
          .argParser((value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 1000) {
              throw new Error("--batch-size must be between 1 and 1000");
            }
            return num;
          }),
      )
      .addOption(
        new Option(
          "-f, --force",
          "Force re-embedding existing annotations",
        ).default(false),
      )
      .addOption(
        new Option(
          "--dry-run",
          "Show what would be done without actually embedding",
        ).default(false),
      )
      .action(async (options: EmbedOptions) => {
        await this.executeCommand("embed", options);
      });
  }

  /**
   * Set up the query command
   */
  private setupQueryCommand(): void {
    this.program
      .command("query")
      .description("Search for relevant code context")
      .argument("<intent>", "Query text describing desired functionality")
      .addOption(
        new Option("--top <n>", "Number of results to return")
          .default(5)
          .argParser((value) => {
            const num = parseInt(value);
            if (num < 1 || num > 100) {
              throw new Error("--top must be between 1 and 100");
            }
            return num;
          }),
      )
      .addOption(
        new Option("--min-score <n>", "Minimum similarity score (0.0-1.0)")
          .default(0.0)
          .argParser((value) => {
            const num = parseFloat(value);
            if (num < 0.0 || num > 1.0) {
              throw new Error("--min-score must be between 0.0 and 1.0");
            }
            return num;
          }),
      )
      .addOption(
        new Option("--format <fmt>", "Output format")
          .choices(["plain", "json", "markdown"])
          .default("plain"),
      )
      .action(async (intent: string, options: QueryOptions) => {
        await this.executeCommand("query", { ...options, intent });
      });
  }

  /**
   * Set up the watch command
   */
  private setupWatchCommand(): void {
    this.program
      .command("watch")
      .description("Monitor files for changes and auto-update")
      .addOption(
        new Option(
          "--glob <pattern>",
          "File pattern to watch (overrides config)",
        ),
      )
      .addOption(
        new Option("--debounce <ms>", "Debounce delay for file changes")
          .default(200)
          .argParser((value) => {
            const num = parseInt(value);
            if (num < 50) {
              throw new Error("--debounce must be at least 50ms");
            }
            return num;
          }),
      )
      .addOption(
        new Option("--batch-size <n>", "Maximum batch size for processing")
          .default(50)
          .argParser((value) => {
            const num = parseInt(value);
            if (num < 1 || num > 1000) {
              throw new Error("--batch-size must be between 1 and 1000");
            }
            return num;
          }),
      )
      .action(async (options: WatchOptions) => {
        await this.executeCommand("watch", options);
      });
  }

  /**
   * Set up model management commands
   */
  private setupModelCommands(): void {
    // Create model command group
    const modelCmd = this.program
      .command("model")
      .description("Manage AI models for embedding and processing");

    // model download <name> - Download a specific model
    modelCmd
      .command("download")
      .description("Download and cache a model")
      .argument("<name>", "Model name to download")
      .addOption(new Option("-o, --output <path>", "Custom download directory"))
      .addOption(new Option("-f, --force", "Force re-download even if cached"))
      .addOption(
        new Option("--no-verify", "Skip model verification after download"),
      )
      .addOption(new Option("--no-progress", "Hide download progress"))
      .action(async (name: string, options: ModelDownloadOptions) => {
        await this.executeCommand("model:download", { ...options, name });
      });

    // model cache - Manage model cache
    modelCmd
      .command("cache")
      .description("Manage model cache")
      .addOption(new Option("--clear", "Clear entire cache"))
      .addOption(new Option("--stats", "Show cache statistics"))
      .addOption(new Option("--list", "List cached models"))
      .addOption(
        new Option("--size <size>", 'Set cache size limit (e.g., "10GB")'),
      )
      .action(async (options: ModelCacheOptions) => {
        await this.executeCommand("model:cache", options);
      });

    // model verify <name> - Verify a cached model
    modelCmd
      .command("verify")
      .description("Verify model integrity and security")
      .argument("[name]", "Model name to verify (verifies all if omitted)")
      .addOption(new Option("--quarantine", "Show quarantined files"))
      .addOption(new Option("--strict", "Enable strict validation"))
      .addOption(new Option("--no-format", "Skip format validation"))
      .action(async (name: string | undefined, options: ModelVerifyOptions) => {
        await this.executeCommand("model:verify", { ...options, name });
      });

    // model list - List available models
    modelCmd
      .command("list")
      .description("List available and cached models")
      .addOption(
        new Option("-f, --format <fmt>", "Output format")
          .choices(["table", "json", "yaml"])
          .default("table"),
      )
      .addOption(
        new Option("--filter <pattern>", "Filter models by name pattern"),
      )
      .addOption(new Option("--cached", "Show only cached models"))
      .action(async (options: ModelListOptions) => {
        await this.executeCommand("model:list", options);
      });

    // model status - Show system status
    modelCmd
      .command("status")
      .description("Show model system status and health")
      .addOption(new Option("--detailed", "Show detailed system information"))
      .addOption(new Option("--performance", "Show performance metrics"))
      .addOption(new Option("--health", "Run health checks"))
      .action(async (options: ModelStatusOptions) => {
        await this.executeCommand("model:status", options);
      });
  }

  /**
   * Set up cache management commands
   */
  private setupCacheCommands(): void {
    // Create cache command group
    const cacheCmd = this.program
      .command("cache")
      .description("Manage query result cache");

    // cache clear - Clear cache entries
    cacheCmd
      .command("clear")
      .description("Clear cache entries at specified level(s)")
      .addOption(
        new Option("-l, --level <level>", "Cache level to clear")
          .choices(["L1", "L2", "L3", "all"])
          .default("all"),
      )
      .addOption(new Option("-y, --confirm", "Skip confirmation prompt"))
      .addOption(new Option("-v, --verbose", "Verbose output"))
      .action(async (options: CacheClearOptions) => {
        await this.executeCommand("cache:clear", options);
      });

    // cache stats - Show cache statistics
    cacheCmd
      .command("stats")
      .description("Display cache statistics and performance metrics")
      .addOption(new Option("--json", "Output in JSON format"))
      .addOption(new Option("--detailed", "Show detailed statistics"))
      .addOption(
        new Option(
          "-l, --level <level>",
          "Show stats for specific level",
        ).choices(["L1", "L2", "L3", "all"]),
      )
      .action(async (options: CacheStatsOptions) => {
        await this.executeCommand("cache:stats", options);
      });

    // cache warm - Pre-populate cache
    cacheCmd
      .command("warm")
      .description("Pre-populate cache with frequent queries")
      .addOption(
        new Option(
          "-c, --count <n>",
          "Number of queries to warm (default: 50)",
        ).argParser(parseInt),
      )
      .addOption(new Option("-v, --verbose", "Verbose output"))
      .addOption(
        new Option("--dry-run", "Show what would be done without caching"),
      )
      .action(async (options: CacheWarmOptions) => {
        await this.executeCommand("cache:warm", options);
      });

    // cache prune - Remove old entries
    cacheCmd
      .command("prune")
      .description("Remove old cache entries")
      .addOption(
        new Option(
          "-o, --older-than <duration>",
          'Remove entries older than duration (e.g., "7d", "24h", "30m")',
        ).default("7d"),
      )
      .addOption(
        new Option("-l, --level <level>", "Cache level to prune")
          .choices(["L1", "L2", "L3", "all"])
          .default("all"),
      )
      .addOption(
        new Option("--dry-run", "Show what would be pruned without removing"),
      )
      .addOption(new Option("-v, --verbose", "Verbose output"))
      .action(async (options: CachePruneOptions) => {
        await this.executeCommand("cache:prune", options);
      });

    // cache analyze - Analyze cache usage
    cacheCmd
      .command("analyze")
      .description("Analyze cache usage and provide recommendations")
      .addOption(
        new Option(
          "-t, --top-queries <n>",
          "Number of top queries to show (default: 20)",
        ).argParser(parseInt),
      )
      .addOption(
        new Option("-f, --format <fmt>", "Output format")
          .choices(["text", "json", "markdown"])
          .default("text"),
      )
      .addOption(new Option("-r, --recommendations", "Show recommendations"))
      .action(async (options: CacheAnalyzeOptions) => {
        await this.executeCommand("cache:analyze", options);
      });
  }

  /**
   * Set up snapshot management commands
   */
  private setupSnapshotCommands(): void {
    // Import types from snapshot command file
    type CreateSnapshotCommandOptions = {
      version?: string;
      description?: string;
      tags?: string;
      compression?: number;
      includeModels?: boolean;
      includeCache?: boolean;
      includeLogs?: boolean;
      output?: string;
      verbose?: boolean;
    };

    type RestoreSnapshotCommandOptions = {
      target?: string;
      skipBackup?: boolean;
      skipChecksum?: boolean;
      skipModels?: boolean;
      force?: boolean;
      verbose?: boolean;
    };

    type ListSnapshotCommandOptions = {
      location?: "local" | "remote" | "all";
      tags?: string;
      sortBy?: "created" | "version" | "size";
      order?: "asc" | "desc";
      json?: boolean;
      verbose?: boolean;
    };

    type PublishSnapshotCommandOptions = {
      remote?: string;
      verbose?: boolean;
    };

    type DownloadSnapshotCommandOptions = {
      remote?: string;
      output?: string;
      verbose?: boolean;
    };

    type DeleteSnapshotCommandOptions = {
      location?: "local" | "remote";
      confirm?: boolean;
      verbose?: boolean;
    };

    // Create snapshot command group
    const snapshotCmd = this.program
      .command("snapshot")
      .description("Manage .astdb directory snapshots");

    // snapshot create - Create compressed snapshot
    snapshotCmd
      .command("create")
      .description("Create compressed snapshot from .astdb directory")
      .addOption(
        new Option(
          "-v, --version <version>",
          "Snapshot version (e.g., '1.0.0')",
        ),
      )
      .addOption(
        new Option("-d, --description <description>", "Snapshot description"),
      )
      .addOption(new Option("-t, --tags <tags>", "Comma-separated tags"))
      .addOption(
        new Option(
          "-c, --compression <level>",
          "Compression level (0-9, default 6)",
        ).argParser(parseInt),
      )
      .addOption(
        new Option("--include-models", "Include model files (can be large)"),
      )
      .addOption(new Option("--include-cache", "Include cache files"))
      .addOption(new Option("--include-logs", "Include log files"))
      .addOption(
        new Option("-o, --output <path>", "Output path for snapshot file"),
      )
      .addOption(new Option("--verbose", "Show detailed progress"))
      .action(async (options: CreateSnapshotCommandOptions) => {
        await this.executeCommand("snapshot:create", options);
      });

    // snapshot restore - Restore snapshot to .astdb directory
    snapshotCmd
      .command("restore <snapshot-path>")
      .description("Restore snapshot to .astdb directory")
      .addOption(
        new Option(
          "-t, --target <path>",
          "Target directory (default: current .astdb)",
        ),
      )
      .addOption(
        new Option("--skip-backup", "Skip backup of existing .astdb directory"),
      )
      .addOption(new Option("--skip-checksum", "Skip checksum validation"))
      .addOption(
        new Option("--skip-models", "Skip model files during restoration"),
      )
      .addOption(new Option("-f, --force", "Overwrite existing files"))
      .addOption(new Option("--verbose", "Show detailed progress"))
      .action(
        async (
          snapshotPath: string,
          options: RestoreSnapshotCommandOptions,
        ) => {
          await this.executeCommand("snapshot:restore", {
            ...options,
            snapshotPath,
          });
        },
      );

    // snapshot list - List available snapshots
    snapshotCmd
      .command("list")
      .description("List available snapshots")
      .addOption(
        new Option("-l, --location <location>", "Snapshot location")
          .choices(["local", "remote", "all"])
          .default("all"),
      )
      .addOption(new Option("-t, --tags <tags>", "Filter by tags"))
      .addOption(
        new Option("--sort-by <field>", "Sort by field")
          .choices(["created", "version", "size"])
          .default("created"),
      )
      .addOption(
        new Option("--order <order>", "Sort order")
          .choices(["asc", "desc"])
          .default("desc"),
      )
      .addOption(new Option("--json", "Output in JSON format"))
      .addOption(new Option("--verbose", "Show detailed information"))
      .action(async (options: ListSnapshotCommandOptions) => {
        await this.executeCommand("snapshot:list", options);
      });

    // snapshot publish - Publish to remote storage
    snapshotCmd
      .command("publish <snapshot-path>")
      .description("Publish snapshot to remote storage (GitHub Releases)")
      .addOption(
        new Option(
          "-r, --remote <index>",
          "Remote storage index (default: 0)",
        ).argParser(parseInt),
      )
      .addOption(new Option("--verbose", "Show detailed progress"))
      .action(
        async (
          snapshotPath: string,
          options: PublishSnapshotCommandOptions,
        ) => {
          await this.executeCommand("snapshot:publish", {
            ...options,
            snapshotPath,
          });
        },
      );

    // snapshot download - Download from remote storage
    snapshotCmd
      .command("download <remote-id>")
      .description("Download snapshot from remote storage")
      .addOption(
        new Option(
          "-r, --remote <index>",
          "Remote storage index (default: 0)",
        ).argParser(parseInt),
      )
      .addOption(
        new Option(
          "-o, --output <path>",
          "Output path for downloaded snapshot",
        ),
      )
      .addOption(new Option("--verbose", "Show detailed progress"))
      .action(
        async (remoteId: string, options: DownloadSnapshotCommandOptions) => {
          await this.executeCommand("snapshot:download", {
            ...options,
            remoteId,
          });
        },
      );

    // snapshot delete - Delete snapshot
    snapshotCmd
      .command("delete <identifier>")
      .description("Delete snapshot from local or remote storage")
      .addOption(
        new Option("-l, --location <location>", "Snapshot location")
          .choices(["local", "remote"])
          .default("local"),
      )
      .addOption(new Option("-y, --confirm", "Skip confirmation prompt"))
      .addOption(new Option("--verbose", "Show detailed information"))
      .action(
        async (identifier: string, options: DeleteSnapshotCommandOptions) => {
          await this.executeCommand("snapshot:delete", {
            ...options,
            identifier,
          });
        },
      );
  }

  /**
   * Set up performance testing commands
   */
  private setupPerformanceCommand(): void {
    const perfCmd = this.program
      .command("performance")
      .alias("perf")
      .description("Run performance benchmarks and validation");

    // performance benchmark - Run comprehensive benchmarks
    perfCmd
      .command("benchmark")
      .alias("bench")
      .description("Run comprehensive performance benchmarks")
      .addOption(
        new Option("-t, --type <type>", "Benchmark type")
          .choices(["parsing", "querying", "memory", "concurrency", "all"])
          .default("all"),
      )
      .addOption(new Option("-v, --verbose", "Enable verbose output"))
      .addOption(
        new Option("-o, --output-dir <dir>", "Output directory for reports"),
      )
      .addOption(
        new Option("--targets <file>", "Custom performance targets file"),
      )
      .addOption(
        new Option("-f, --format <fmt>", "Report format")
          .choices(["json", "table", "html"])
          .default("table"),
      )
      .action(async (options: PerformanceOptions) => {
        await this.executeCommand("performance:benchmark", options);
      });

    // performance validate - Validate against performance targets
    perfCmd
      .command("validate")
      .alias("val")
      .description("Validate performance against defined targets")
      .addOption(
        new Option("--targets <file>", "Custom performance targets file"),
      )
      .addOption(
        new Option("--memory-limit <mb>", "Memory usage limit in MB").argParser(
          parseInt,
        ),
      )
      .addOption(
        new Option(
          "--concurrency-limit <num>",
          "Max concurrent operations",
        ).argParser(parseInt),
      )
      .addOption(
        new Option("-f, --format <fmt>", "Output format")
          .choices(["json", "table"])
          .default("table"),
      )
      .action(async (options: PerformanceOptions) => {
        await this.executeCommand("performance:validate", options);
      });

    // performance report - Generate detailed performance report
    perfCmd
      .command("report")
      .description("Generate comprehensive performance report")
      .addOption(
        new Option(
          "-o, --output-dir <dir>",
          "Output directory for report",
        ).default("./performance-report"),
      )
      .addOption(
        new Option("-f, --format <fmt>", "Report format")
          .choices(["html", "pdf", "json"])
          .default("html"),
      )
      .addOption(new Option("--include-charts", "Include performance charts"))
      .addOption(
        new Option("--compare <baseline>", "Compare with baseline report"),
      )
      .action(async (options: PerformanceOptions) => {
        await this.executeCommand("performance:report", options);
      });

    // performance monitor - Real-time performance monitoring
    perfCmd
      .command("monitor")
      .alias("mon")
      .description("Monitor real-time performance metrics")
      .addOption(
        new Option("--duration <seconds>", "Monitoring duration in seconds")
          .argParser(parseInt)
          .default(60),
      )
      .addOption(
        new Option("--interval <ms>", "Sampling interval in milliseconds")
          .argParser(parseInt)
          .default(1000),
      )
      .addOption(new Option("--output <file>", "Save monitoring data to file"))
      .action(async (options: PerformanceOptions) => {
        await this.executeCommand("performance:monitor", options);
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
      await this.program.parseAsync(args, { from: "user" });
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
    this.program.hook("preAction", (_thisCommand, actionCommand) => {
      const opts = actionCommand.opts();

      // Validate mutually exclusive options for parse command
      if (actionCommand.name() === "parse") {
        // Validate mutually exclusive file selection options
        if (opts.changed && opts.glob) {
          throw ValidationErrors.invalidValue(
            "--changed and --glob",
            "both specified",
            "These options are mutually exclusive. Use either --changed to process Git changes or --glob to specify file patterns.",
          );
        }

        // Validate that --staged and --changed are mutually exclusive
        if (opts.staged && opts.changed) {
          throw ValidationErrors.invalidValue(
            "--staged and --changed",
            "both specified",
            "These options are mutually exclusive. Use --staged for staged files only, or --changed for all working directory changes.",
          );
        }

        // Validate batch size is reasonable
        if (opts.batchSize && (opts.batchSize < 1 || opts.batchSize > 100)) {
          throw ValidationErrors.invalidValue(
            "--batch-size",
            String(opts.batchSize),
            "Batch size must be between 1 and 100 for optimal performance.",
          );
        }

        // Validate Git repository for Git-related options
        if (
          (opts.changed || opts.staged || opts.base) &&
          !this.isGitRepository(opts.workspace || process.cwd())
        ) {
          throw ValidationErrors.invalidValue(
            "--changed/--staged/--base",
            "used outside Git repository",
            'Git repository detection required for --changed, --staged, and --base flags. Initialize git with "git init" or run from within a Git repository.',
          );
        }

        // Validate Git base reference format
        if (
          opts.base &&
          opts.base !== "HEAD" &&
          !this.isValidGitRef(opts.base)
        ) {
          throw ValidationErrors.invalidValue(
            "--base",
            opts.base,
            "Git reference must be a valid commit SHA, branch name, or tag. Examples: HEAD, main, origin/main, abc123, v1.0.0",
          );
        }

        // Warn about performance implications
        if (opts.batchSize && opts.batchSize > 50) {
          console.warn(
            "⚠️  Warning: Large batch sizes (>50) may impact system performance. Consider reducing if you experience memory issues.",
          );
        }
      }
    });
  }

  /**
   * Execute a command with proper error handling and configuration loading
   */
  private async executeCommand(
    commandName: string,
    options: any,
  ): Promise<void> {
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
      const handler = await this.getCommandHandler(commandName);
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
      // In ES modules, we need to use import.meta.url to get the current file's directory
      const currentFileUrl = import.meta.url;
      const currentDir = path.dirname(fileURLToPath(currentFileUrl));

      // For compiled code, currentDir will be in dist/, so we need to go up one level
      const packagePath = path.join(currentDir, "..", "package.json");

      if (existsSync(packagePath)) {
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
        return packageJson.version || "0.1.0";
      }

      // Fallback: try to find package.json in workspace
      const workspacePackagePath = path.join(
        process.cwd(),
        "packages",
        "ast-helper",
        "package.json",
      );
      if (existsSync(workspacePackagePath)) {
        const packageJson = JSON.parse(
          readFileSync(workspacePackagePath, "utf8"),
        );
        return packageJson.version || "0.1.0";
      }

      return "0.1.0";
    } catch {
      return "0.1.0";
    }
  }

  /**
   * Get command handler for a specific command
   */
  private async getCommandHandler(
    commandName: string,
  ): Promise<CommandHandler> {
    switch (commandName) {
      case "init":
        return new InitCommandHandler();
      case "parse":
        return new ParseCommandHandler();
      case "annotate": {
        const { AnnotateCommand } = await import("./commands/annotate.js");
        return new AnnotateCommand();
      }
      case "embed": {
        return new EmbedCommandHandler();
      }
      case "query": {
        return new QueryCommandHandler();
      }
      case "watch": {
        return new WatchCommandHandler();
      }
      case "model:download": {
        const { ModelDownloadCommandHandler } = await import(
          "./commands/model-download.js"
        );
        return new ModelDownloadCommandHandler();
      }
      case "model:cache": {
        const { ModelCacheCommandHandler } = await import(
          "./commands/model-cache.js"
        );
        return new ModelCacheCommandHandler();
      }
      case "model:verify": {
        const { ModelVerifyCommandHandler } = await import(
          "./commands/model-verify.js"
        );
        return new ModelVerifyCommandHandler();
      }
      case "model:list": {
        const { ModelListCommandHandler } = await import(
          "./commands/model-list.js"
        );
        return new ModelListCommandHandler();
      }
      case "model:status": {
        const { ModelStatusCommandHandler } = await import(
          "./commands/model-status.js"
        );
        return new ModelStatusCommandHandler();
      }
      case "cache:clear": {
        const { CacheClearCommandHandler } = await import(
          "./commands/cache.js"
        );
        return new CacheClearCommandHandler();
      }
      case "cache:stats": {
        const { CacheStatsCommandHandler } = await import(
          "./commands/cache.js"
        );
        return new CacheStatsCommandHandler();
      }
      case "cache:warm": {
        const { CacheWarmCommandHandler } = await import("./commands/cache.js");
        return new CacheWarmCommandHandler();
      }
      case "cache:prune": {
        const { CachePruneCommandHandler } = await import(
          "./commands/cache.js"
        );
        return new CachePruneCommandHandler();
      }
      case "cache:analyze": {
        const { CacheAnalyzeCommandHandler } = await import(
          "./commands/cache.js"
        );
        return new CacheAnalyzeCommandHandler();
      }
      case "performance:benchmark": {
        const { PerformanceBenchmarkCommandHandler } = await import(
          "./commands/performance-benchmark.js"
        );
        return new PerformanceBenchmarkCommandHandler();
      }
      case "performance:validate": {
        const { PerformanceValidateCommandHandler } = await import(
          "./commands/performance-validate.js"
        );
        return new PerformanceValidateCommandHandler();
      }
      case "performance:report": {
        const { PerformanceReportCommandHandler } = await import(
          "./commands/performance-report.js"
        );
        return new PerformanceReportCommandHandler();
      }
      case "performance:monitor": {
        const { PerformanceMonitorCommandHandler } = await import(
          "./commands/performance-monitor.js"
        );
        return new PerformanceMonitorCommandHandler();
      }
      case "snapshot:create": {
        const { SnapshotCreateCommandHandler } = await import(
          "./commands/snapshot.js"
        );
        return new SnapshotCreateCommandHandler();
      }
      case "snapshot:restore": {
        const { SnapshotRestoreCommandHandler } = await import(
          "./commands/snapshot.js"
        );
        return new SnapshotRestoreCommandHandler();
      }
      case "snapshot:list": {
        const { SnapshotListCommandHandler } = await import(
          "./commands/snapshot.js"
        );
        return new SnapshotListCommandHandler();
      }
      case "snapshot:publish": {
        const { SnapshotPublishCommandHandler } = await import(
          "./commands/snapshot.js"
        );
        return new SnapshotPublishCommandHandler();
      }
      case "snapshot:download": {
        const { SnapshotDownloadCommandHandler } = await import(
          "./commands/snapshot.js"
        );
        return new SnapshotDownloadCommandHandler();
      }
      case "snapshot:delete": {
        const { SnapshotDeleteCommandHandler } = await import(
          "./commands/snapshot.js"
        );
        return new SnapshotDeleteCommandHandler();
      }
      default:
        throw ValidationErrors.invalidValue(
          "command",
          commandName,
          "Unknown command",
        );
    }
  }

  /**
   * Check if directory is a Git repository
   */
  private isGitRepository(workspacePath: string): boolean {
    try {
      const gitPath = path.join(workspacePath, ".git");
      return existsSync(gitPath);
    } catch {
      return false;
    }
  }

  /**
   * Validate if a string is a valid Git reference format
   */
  private isValidGitRef(ref: string): boolean {
    // Basic validation for Git reference format
    // Allow: commit SHAs (7-40 chars), branch names, tag names
    if (!ref || ref.length === 0) {
      return false;
    }

    // Disallow invalid characters for Git refs
    const invalidChars = /[~^:\s\\[\]]/;
    if (invalidChars.test(ref)) {
      return false;
    }

    // Disallow refs starting with dash or ending with lock
    if (ref.startsWith("-") || ref.endsWith(".lock")) {
      return false;
    }

    // Allow common patterns: HEAD, branch names, commit SHAs, origin/branch, tags
    const validPatterns = [
      /^HEAD$/, // HEAD
      /^[a-f0-9]{7,40}$/, // Commit SHA (7-40 chars)
      /^[a-zA-Z][a-zA-Z0-9._/-]+$/, // Branch/tag name
      /^(origin|upstream)\/[a-zA-Z][a-zA-Z0-9._/-]+$/, // Remote branch
      /^refs\/(heads|tags)\/[a-zA-Z][a-zA-Z0-9._/-]+$/, // Full ref path
    ];

    return validPatterns.some((pattern) => pattern.test(ref));
  }

  /**
   * Get appropriate exit code based on error type
   */
  private getExitCode(error: unknown): number {
    if (error && typeof error === "object" && "isAstError" in error) {
      const astError = error as any;
      if (astError.code?.startsWith("VALIDATION")) {
        return 1; // User error
      } else if (astError.code?.startsWith("CONFIGURATION")) {
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
  private async loadConfiguration(
    workspacePath: string,
    cliOptions: any,
  ): Promise<void> {
    try {
      this.config = await this.configManager.loadConfig(
        workspacePath,
        cliOptions,
        cliOptions.userConfig,
      );
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        "Failed to load configuration",
        error as Error,
      );
    }
  }

  /**
   * Set up logging based on configuration
   */
  private setupLogging(): void {
    if (!this.config) {
      return;
    }

    const logLevel = parseLogLevel(
      this.config.debug ? "debug" : this.config.verbose ? "info" : "warn",
    );

    this.logger = createLogger({
      level: logLevel,
      jsonOutput: this.config.jsonLogs,
      logFile: this.config.logFile,
      includeTimestamp: true,
    });
  }

  /**
   * Acquire exclusive lock for database operations
   */
  private async acquireDatabaseLock(): Promise<void> {
    if (!this.lockManager) {
      throw ConfigurationErrors.invalidValue(
        "lockManager",
        "undefined",
        "LockManager not initialized",
      );
    }

    if (!this.config) {
      throw ConfigurationErrors.invalidValue(
        "config",
        "undefined",
        "Configuration not loaded",
      );
    }

    try {
      const lockPath = path.join(this.config.outputDir, ".lock");
      this.currentLock = await this.lockManager.acquireExclusiveLock(lockPath, {
        timeoutMs: 30000,
      });
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        "Failed to acquire database lock",
        error as Error,
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
      this.logger.warn("Failed to release database lock", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Ensure database directory structure exists
   */
  private async ensureDatabaseDirectory(): Promise<void> {
    if (!this.config) {
      throw ConfigurationErrors.invalidValue(
        "config",
        "undefined",
        "Configuration not loaded",
      );
    }

    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Create subdirectories
      await fs.mkdir(path.join(this.config.outputDir, "index"), {
        recursive: true,
      });
      await fs.mkdir(path.join(this.config.outputDir, "cache"), {
        recursive: true,
      });
      await fs.mkdir(path.join(this.config.outputDir, "logs"), {
        recursive: true,
      });
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        "Failed to create database directory structure",
        error as Error,
      );
    }
  }

  /**
   * Handle errors with appropriate formatting and logging
   */
  private async handleError(error: unknown): Promise<void> {
    if (error && typeof error === "object" && "isAstError" in error) {
      // Handle AST-specific errors
      const userMessage = this.errorFormatter.formatForUser(error as any);
      const debugMessage = this.errorFormatter.formatForDebug(error as any);

      console.error(userMessage);

      if (this.config?.debug) {
        console.error("Debug details:", debugMessage);
      }

      // Log structured error details
      this.logger.error("CLI error occurred", {
        message: (error as any).message,
        code: (error as any).code,
        context: (error as any).context,
      });
    } else {
      // Handle generic errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error: ${errorMessage}`);

      this.logger.error("Unexpected CLI error", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
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
      dbPath,
    } = options;

    if (verbose) {
      console.log("🚀 Initializing AST database structure...");
      console.log(`   Workspace: ${workspace}`);
      console.log(`   Force overwrite: ${force}`);
      console.log(`   Dry run: ${dryRun}`);
      if (dbPath) {
        console.log(`   Custom DB path: ${dbPath}`);
      }
      console.log("");
    }

    try {
      // Import database modules dynamically to avoid circular dependencies
      const {
        ASTDatabaseManager,
        DatabaseConfigurationManager,
        DatabaseVersionManager,
        WorkspaceDetector,
      } = await import("./database/index.js");

      // Step 1: Detect and validate workspace
      if (verbose) {
        console.log("📂 Detecting workspace...");
      }

      const workspaceDetector = new WorkspaceDetector();
      const workspaceInfo = await workspaceDetector.detectWorkspace({
        startDir: workspace,
        allowExisting: true,
      });

      if (verbose) {
        console.log(`   ✅ Workspace detected: ${workspaceInfo.root}`);
        console.log(`   Method: ${workspaceInfo.detectionMethod}`);
        console.log(
          `   Git repository: ${workspaceInfo.isGitRepository ? "Yes" : "No"}`,
        );
        if (workspaceInfo.indicators.length > 0) {
          console.log(`   Indicators: ${workspaceInfo.indicators.join(", ")}`);
        }
        console.log("");
      }

      // Determine database path
      const astdbPath =
        dbPath || workspaceDetector.getDefaultDatabasePath(workspaceInfo.root);

      if (verbose) {
        console.log(`📁 Database path: ${astdbPath}`);
        console.log("");
      }

      // Step 2: Validate workspace for database creation
      if (verbose) {
        console.log("🔍 Validating workspace...");
      }

      const databaseInitOptions = {
        force,
        verbose,
        dryRun,
      };

      await workspaceDetector.validateWorkspaceForDatabase(
        workspaceInfo,
        databaseInitOptions,
      );

      if (verbose) {
        console.log("   ✅ Workspace validation passed");
        console.log("");
      }

      // Step 3: Create database directory structure
      if (verbose) {
        console.log("🏗️  Creating database structure...");
      }

      const dbManager = new ASTDatabaseManager(workspaceInfo.root);
      await dbManager.createDirectoryStructure(databaseInitOptions);

      if (verbose) {
        console.log("   ✅ Database directories created");
        console.log("");
      }

      // Step 4: Generate configuration file
      if (verbose) {
        console.log("⚙️  Generating configuration...");
      }

      const configManager = new DatabaseConfigurationManager();
      await configManager.createConfigurationFile(
        astdbPath,
        databaseInitOptions,
      );

      if (verbose) {
        console.log("   ✅ Configuration file created");
        console.log("");
      }

      // Step 5: Create version file
      if (verbose) {
        console.log("📋 Creating version file...");
      }

      const versionManager = new DatabaseVersionManager();
      await versionManager.createVersionFile(astdbPath, databaseInitOptions);

      if (verbose) {
        console.log("   ✅ Version file created");
        console.log("");
      }

      // Step 6: Final validation
      if (verbose) {
        console.log("🔎 Validating database structure...");
      }

      await dbManager.validateDatabaseStructure();

      if (verbose) {
        console.log("   ✅ Database structure validated");
        console.log("");
      }

      // Step 6.5: Set up .gitignore (if not disabled)
      if (!options.noGitignore) {
        await this.setupGitignore(workspaceInfo.root, {
          dryRun,
          verbose,
        });
      }

      // Success message
      if (dryRun) {
        console.log("✅ Dry run completed successfully!");
        console.log(`   Database structure would be created at: ${astdbPath}`);
      } else {
        console.log("✅ AST database initialized successfully!");
        console.log(`   Database location: ${astdbPath}`);
        console.log(`   Workspace: ${workspaceInfo.root}`);
        console.log(
          `   Next steps: Run 'ast-helper parse' to index your codebase`,
        );
      }

      this.logger.info("Database initialization completed", {
        workspace: workspaceInfo.root,
        dbPath: astdbPath,
        method: workspaceInfo.detectionMethod,
        dryRun,
      });
    } catch (error) {
      const errorFormatter = new ErrorFormatter();
      const formattedError = errorFormatter.formatForUser(error as Error);

      console.error("❌ Failed to initialize AST database");
      console.error(formattedError);

      this.logger.error("Database initialization failed", {
        workspace,
        dbPath,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      process.exit(1);
    }
  }

  /**
   * Set up .gitignore with .astdb/ exclusions
   */
  private async setupGitignore(
    workspaceRoot: string,
    options: { dryRun?: boolean; verbose?: boolean },
  ): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, ".gitignore");

    if (options.verbose) {
      console.log("📝 Setting up .gitignore...");
    }

    try {
      // Check if update is needed
      const needsUpdate = await this.needsGitignoreUpdate(gitignorePath);

      if (!needsUpdate) {
        if (options.verbose) {
          console.log("   ℹ️  .astdb/ already in .gitignore, skipping");
        }
        return;
      }

      // Load template
      const template = await this.loadGitignoreTemplate();

      // Apply template
      if (!options.dryRun) {
        await this.applyGitignoreTemplate(gitignorePath, template);
      }

      if (options.verbose) {
        const fileExists = await this.fileExists(gitignorePath);
        const action = fileExists ? "Updated" : "Created";
        console.log(`   ✅ ${action} .gitignore with .astdb/ exclusions`);
      }
    } catch (error) {
      // Non-fatal error - log but don't fail init
      this.logger.warn("Failed to update .gitignore", {
        error: (error as Error).message,
      });

      if (options.verbose) {
        console.log(
          `   ⚠️  Could not update .gitignore: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Check if .gitignore needs to be updated with .astdb/ patterns
   */
  private async needsGitignoreUpdate(gitignorePath: string): Promise<boolean> {
    if (!(await this.fileExists(gitignorePath))) {
      return true; // Need to create
    }

    const content = await fs.readFile(gitignorePath, "utf-8");

    // Check for .astdb/ or .astdb (with or without trailing slash)
    // Use regex that matches common patterns:
    // - .astdb/
    // - .astdb
    // - /.astdb/
    // - *.astdb/
    const astdbPattern = /(?:^|\/)\.astdb\/?(?:\s|$)/m;

    return !astdbPattern.test(content);
  }

  /**
   * Load gitignore template from templates directory
   */
  private async loadGitignoreTemplate(): Promise<string> {
    const templatePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "templates",
      "gitignore.template",
    );

    return await fs.readFile(templatePath, "utf-8");
  }

  /**
   * Apply gitignore template to file
   */
  private async applyGitignoreTemplate(
    gitignorePath: string,
    template: string,
  ): Promise<void> {
    let content = "";

    if (await this.fileExists(gitignorePath)) {
      content = await fs.readFile(gitignorePath, "utf-8");
    }

    // Ensure proper spacing
    const separator =
      content.length > 0 ? (content.endsWith("\n") ? "\n" : "\n\n") : "";

    const newContent = content + separator + template;

    // Ensure file ends with newline
    const finalContent = newContent.endsWith("\n")
      ? newContent
      : newContent + "\n";

    await fs.writeFile(gitignorePath, finalContent, "utf-8");
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

class ParseCommandHandler implements CommandHandler<ParseOptions> {
  async execute(options: ParseOptions, config: Config): Promise<void> {
    // Import ParseCommand dynamically to avoid circular dependencies
    const { ParseCommand } = await import("./commands/parse.js");
    const parseCommand = new ParseCommand();
    await parseCommand.execute(options, config);
  }
}

class EmbedCommandHandler implements CommandHandler<EmbedOptions> {
  async execute(options: EmbedOptions, config: Config): Promise<void> {
    const logger = createLogger({
      operation: "embed",
      level: parseLogLevel(process.env.LOG_LEVEL || "info"),
    });

    try {
      // Import the embed command
      const { EmbedCommand } = await import("./commands/embed.js");

      // Create and execute the embed command
      const embedCommand = new EmbedCommand(config, logger);

      // Map CLI options to command options
      const commandOptions = {
        input: options.changed ? undefined : options.workspace, // Use workspace if not changed mode
        model: options.model,
        batchSize: options.batchSize,
        verbose: true, // Always enable progress reporting in CLI
        force: options.force || false,
        dryRun: options.dryRun || false,
      };

      await embedCommand.execute(commandOptions);
    } catch (error: any) {
      logger.error("❌ Embed command failed:", error.message);
      process.exit(1);
    }
  }
}

class QueryCommandHandler implements CommandHandler<QueryOptions> {
  async execute(options: QueryOptions, config: Config): Promise<void> {
    const { QueryCommandHandler: RealQueryHandler } = await import(
      "./commands/query.js"
    );
    const handler = new RealQueryHandler();
    await handler.execute(options, config);
  }
}

class WatchCommandHandler implements CommandHandler<WatchOptions> {
  async execute(options: WatchOptions, config: Config): Promise<void> {
    const { WatchCommand } = await import("./commands/watch.js");

    // Map CLI options to WatchCommand options
    const globValue = options.glob || config.watchGlob;
    const watchOptions = {
      glob: Array.isArray(globValue) ? globValue[0] : globValue,
      debounce: options.debounce,
      includeAnnotation: options.changed,
      batch: options.changed,
      recursive: true,
      followSymlinks: false,
    };

    const watchCommand = new WatchCommand(config, watchOptions);

    // Set up signal handlers for graceful shutdown
    const shutdownHandler = async () => {
      console.log("\n\nShutting down watch command...");
      await watchCommand.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdownHandler);
    process.on("SIGTERM", shutdownHandler);

    // Start watching
    await watchCommand.start();
  }
}

// Run CLI if this file is executed directly
const isMain =
  process.argv &&
  process.argv.length >= 2 &&
  (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts"));
if (isMain) {
  const cli = new AstHelperCli();
  cli.run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export default AstHelperCli;
