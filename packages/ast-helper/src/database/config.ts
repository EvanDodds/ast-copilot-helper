/**
 * Database Configuration Manager
 * Handles creation, validation, and management of AST database configuration
 */

import { readFile } from "node:fs/promises";
import { cpus } from "node:os";
import { join } from "node:path";
import { ConfigurationErrors, ValidationErrors } from "../errors/index.js";
import { FileSystemManager } from "../filesystem/manager.js";
import { createLogger } from "../logging/index.js";
import type { ASTDBConfig, InitOptions } from "./types.js";

/**
 * Database Configuration Manager class
 * Manages AST database configuration file creation and validation
 */
export class DatabaseConfigurationManager {
  private fs: FileSystemManager;
  private logger = createLogger();

  constructor() {
    this.fs = new FileSystemManager();
  }

  /**
   * Create default AST database configuration
   */
  createDefaultConfig(): ASTDBConfig {
    const now = new Date().toISOString();

    return {
      // Parse configuration
      parseGlob: [
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
        "**/*.py",
        "**/*.java",
        "**/*.cpp",
        "**/*.c",
        "**/*.h",
      ],
      excludeGlob: [
        "node_modules/**",
        "dist/**",
        "build/**",
        "coverage/**",
        ".git/**",
        "**/*.min.js",
        "**/*.bundle.js",
      ],

      // Watch configuration
      watchGlob: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"],
      watchDebounce: 200,

      // Query configuration
      topK: 5,
      snippetLines: 10,

      // Index configuration
      indexParams: {
        efConstruction: 200, // HNSW build quality (16-800)
        M: 16, // HNSW connectivity (4-64)
        ef: 100, // HNSW query quality (16-512)
      },

      // Model configuration
      modelName: "codebert-base",
      modelHost: "https://huggingface.co",
      batchSize: 32,

      // Performance configuration
      concurrency: Math.max(1, Math.floor((cpus()?.length || 4) / 2)),
      maxMemory: 2048, // 2GB default

      // Feature flags
      enableTelemetry: false,
      enableNative: true,

      // Metadata
      version: "1.0.0",
      created: now,
      lastUpdated: now,
    };
  }

  /**
   * Create configuration file in the database directory
   */
  async createConfigurationFile(
    astdbPath: string,
    options: InitOptions = {},
  ): Promise<void> {
    const { force = false, verbose = false, dryRun = false } = options;
    const configPath = join(astdbPath, "config.json");

    if (verbose) {
      console.log("  Creating configuration file: config.json");
    }

    let config: ASTDBConfig;

    // Check if configuration already exists
    const configExists = await this.fs.exists(configPath);

    if (configExists && !force) {
      throw ConfigurationErrors.fileNotAccessible(
        configPath,
        "Configuration file already exists. Use --force to overwrite.",
      );
    }

    if (configExists && force) {
      // Load existing configuration and merge with defaults
      try {
        config = await this.loadAndMergeConfig(configPath);
        config.lastUpdated = new Date().toISOString();

        if (verbose) {
          console.log("    Merging with existing configuration");
        }
      } catch (error) {
        this.logger.warn("Failed to load existing config, using defaults", {
          error: (error as Error).message,
        });
        config = this.createDefaultConfig();
      }
    } else {
      // Use default configuration
      config = this.createDefaultConfig();
    }

    // Validate configuration before saving
    await this.validateConfig(config);

    if (!dryRun) {
      try {
        const configJson = JSON.stringify(config, null, 2);
        await this.fs.atomicWriteFile(configPath, configJson, {
          encoding: "utf8",
          mode: 0o644,
        });

        this.logger.debug("Created configuration file", {
          path: configPath,
          size: configJson.length,
        });
      } catch (error) {
        throw ConfigurationErrors.loadFailed(
          "Failed to create configuration file",
          error as Error,
        );
      }
    }

    if (verbose) {
      console.log("    ✅ Configuration file created successfully");
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig(astdbPath: string): Promise<ASTDBConfig> {
    const configPath = join(astdbPath, "config.json");

    if (!(await this.fs.exists(configPath))) {
      throw ConfigurationErrors.fileNotAccessible(
        configPath,
        "Configuration file does not exist",
      );
    }

    try {
      const configContent = await readFile(configPath, "utf8");
      const config = JSON.parse(configContent);

      // Validate loaded configuration
      await this.validateConfig(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw ConfigurationErrors.loadFailed(
          "Invalid JSON in configuration file",
          error,
        );
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(astdbPath: string, config: ASTDBConfig): Promise<void> {
    const configPath = join(astdbPath, "config.json");

    // Validate before saving
    await this.validateConfig(config);

    // Update last modified timestamp
    config.lastUpdated = new Date().toISOString();

    try {
      const configJson = JSON.stringify(config, null, 2);
      await this.fs.atomicWriteFile(configPath, configJson, {
        encoding: "utf8",
        mode: 0o644,
      });

      this.logger.debug("Saved configuration file", {
        path: configPath,
        size: configJson.length,
      });
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        "Failed to save configuration file",
        error as Error,
      );
    }
  }

  /**
   * Validate configuration against schema
   */
  async validateConfig(config: any): Promise<void> {
    const errors: string[] = [];

    // Check required fields
    const requiredStringFields = [
      "modelName",
      "modelHost",
      "version",
      "created",
      "lastUpdated",
    ];

    const requiredArrayFields = ["parseGlob", "excludeGlob", "watchGlob"];

    const requiredNumberFields = [
      "watchDebounce",
      "topK",
      "snippetLines",
      "batchSize",
      "concurrency",
      "maxMemory",
    ];

    const requiredBooleanFields = ["enableTelemetry", "enableNative"];

    // Validate string fields
    for (const field of requiredStringFields) {
      if (typeof config[field] !== "string" || config[field].trim() === "") {
        errors.push(`Field '${field}' must be a non-empty string`);
      }
    }

    // Validate array fields
    for (const field of requiredArrayFields) {
      if (!Array.isArray(config[field])) {
        errors.push(`Field '${field}' must be an array`);
      } else if (
        !config[field].every((item: any) => typeof item === "string")
      ) {
        errors.push(`All items in '${field}' must be strings`);
      }
    }

    // Validate number fields
    for (const field of requiredNumberFields) {
      if (typeof config[field] !== "number" || isNaN(config[field])) {
        errors.push(`Field '${field}' must be a valid number`);
      }
    }

    // Validate boolean fields
    for (const field of requiredBooleanFields) {
      if (typeof config[field] !== "boolean") {
        errors.push(`Field '${field}' must be a boolean`);
      }
    }

    // Validate indexParams object
    if (typeof config.indexParams !== "object" || config.indexParams === null) {
      errors.push("Field 'indexParams' must be an object");
    } else {
      const indexParams = config.indexParams;

      if (
        typeof indexParams.efConstruction !== "number" ||
        indexParams.efConstruction < 16 ||
        indexParams.efConstruction > 800
      ) {
        errors.push(
          "indexParams.efConstruction must be a number between 16 and 800",
        );
      }

      if (
        typeof indexParams.M !== "number" ||
        indexParams.M < 4 ||
        indexParams.M > 64
      ) {
        errors.push("indexParams.M must be a number between 4 and 64");
      }

      if (
        typeof indexParams.ef !== "number" ||
        indexParams.ef < 16 ||
        indexParams.ef > 512
      ) {
        errors.push("indexParams.ef must be a number between 16 and 512");
      }
    }

    // Validate specific number ranges
    if (config.topK && (config.topK < 1 || config.topK > 100)) {
      errors.push("topK must be between 1 and 100");
    }

    if (
      config.snippetLines &&
      (config.snippetLines < 1 || config.snippetLines > 50)
    ) {
      errors.push("snippetLines must be between 1 and 50");
    }

    if (config.batchSize && (config.batchSize < 1 || config.batchSize > 1000)) {
      errors.push("batchSize must be between 1 and 1000");
    }

    if (
      config.concurrency &&
      (config.concurrency < 1 || config.concurrency > 32)
    ) {
      errors.push("concurrency must be between 1 and 32");
    }

    if (
      config.maxMemory &&
      (config.maxMemory < 512 || config.maxMemory > 32768)
    ) {
      errors.push("maxMemory must be between 512 and 32768 MB");
    }

    if (
      config.watchDebounce &&
      (config.watchDebounce < 50 || config.watchDebounce > 5000)
    ) {
      errors.push("watchDebounce must be between 50 and 5000 ms");
    }

    // Validate version format (basic semver check)
    if (config.version && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(config.version)) {
      errors.push("version must be in semver format (e.g., '1.0.0')");
    }

    // Validate timestamps (ISO format)
    const timestampFields = ["created", "lastUpdated"];
    for (const field of timestampFields) {
      if (config[field] && isNaN(new Date(config[field]).getTime())) {
        errors.push(`${field} must be a valid ISO timestamp`);
      }
    }

    // Validate URLs
    if (config.modelHost) {
      try {
        new URL(config.modelHost);
      } catch {
        errors.push("modelHost must be a valid URL");
      }
    }

    // Throw validation error if any errors found
    if (errors.length > 0) {
      throw ValidationErrors.invalidFormat(
        JSON.stringify(config, null, 2).substring(0, 200) + "...",
        `Valid ASTDBConfig: ${errors.join(", ")}`,
      );
    }
  }

  /**
   * Load existing configuration and merge with defaults
   */
  private async loadAndMergeConfig(configPath: string): Promise<ASTDBConfig> {
    let existingConfig: Partial<ASTDBConfig> = {};

    try {
      const configContent = await readFile(configPath, "utf8");
      existingConfig = JSON.parse(configContent);
    } catch (error) {
      this.logger.warn("Could not load existing configuration", {
        path: configPath,
        error: (error as Error).message,
      });
    }

    // Get default configuration
    const defaultConfig = this.createDefaultConfig();

    // Merge configurations (existing takes precedence where valid)
    const mergedConfig: ASTDBConfig = {
      ...defaultConfig,
      ...existingConfig,
      // Always update metadata
      lastUpdated: new Date().toISOString(),
      // Preserve creation date if it exists
      created: existingConfig.created || defaultConfig.created,
      // Merge indexParams separately to avoid overwriting entire object
      indexParams: {
        ...defaultConfig.indexParams,
        ...(existingConfig.indexParams || {}),
      },
    };

    return mergedConfig;
  }
}
