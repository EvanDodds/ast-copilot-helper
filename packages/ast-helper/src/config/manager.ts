/**
 * Configuration Manager
 * Handles loading and merging configuration from multiple sources
 */

import type { Config, PartialConfig, CliArgs } from "../types.js";
import { validateConfig } from "./defaults.js";
import { parseEnvironmentConfig } from "./environment.js";
import { parseCliArgs } from "./cli.js";
import { loadConfigFiles, resolveConfigPaths } from "./files.js";

/**
 * Configuration Manager class
 * Loads configuration from multiple sources in priority order:
 * 1. CLI Arguments (highest priority)
 * 2. Environment Variables
 * 3. Project Config (.astdb/config.json)
 * 4. User Config (~/.config/ast-copilot-helper/config.json)
 * 5. Built-in Defaults (lowest priority)
 */
export class ConfigManager {
  /**
   * Load complete configuration from all sources
   */
  async loadConfig(
    workspacePath: string,
    cliArgs: CliArgs = {},
  ): Promise<Config> {
    try {
      // Collect configuration from all sources (reverse priority order)
      const sources: PartialConfig[] = [];

      // 5. Built-in defaults are handled by validateConfig

      // 4. User config and 3. Project config
      const fileConfigs = await loadConfigFiles(workspacePath);
      if (fileConfigs && Array.isArray(fileConfigs)) {
        sources.push(...fileConfigs.reverse()); // Reverse to get user config first, then project
      }

      // 2. Environment variables
      const envConfig = parseEnvironmentConfig();
      if (Object.keys(envConfig).length > 0) {
        sources.push(envConfig);
      }

      // 1. CLI arguments (highest priority)
      const cliConfig = parseCliArgs(cliArgs);
      if (Object.keys(cliConfig).length > 0) {
        sources.push(cliConfig);
      }

      // Merge all configurations
      const mergedConfig = this.mergeConfigs(sources);

      // Validate and return complete configuration with defaults
      return validateConfig(mergedConfig);
    } catch (error) {
      throw new Error(
        `Failed to load configuration: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Merge multiple partial configurations with proper precedence
   * Later sources override earlier sources
   */
  private mergeConfigs(sources: PartialConfig[]): PartialConfig {
    const result: PartialConfig = {};

    for (const source of sources) {
      // Merge simple properties
      if (source.parseGlob !== undefined) {
        result.parseGlob = source.parseGlob;
      }
      if (source.watchGlob !== undefined) {
        result.watchGlob = source.watchGlob;
      }
      if (source.topK !== undefined) {
        result.topK = source.topK;
      }
      if (source.snippetLines !== undefined) {
        result.snippetLines = source.snippetLines;
      }
      if (source.modelHost !== undefined) {
        result.modelHost = source.modelHost;
      }
      if (source.enableTelemetry !== undefined) {
        result.enableTelemetry = source.enableTelemetry;
      }
      if (source.concurrency !== undefined) {
        result.concurrency = source.concurrency;
      }
      if (source.batchSize !== undefined) {
        result.batchSize = source.batchSize;
      }

      // Merge nested indexParams object
      if (source.indexParams) {
        if (!result.indexParams) {
          result.indexParams = {};
        }
        if (source.indexParams.efConstruction !== undefined) {
          result.indexParams.efConstruction = source.indexParams.efConstruction;
        }
        if (source.indexParams.M !== undefined) {
          result.indexParams.M = source.indexParams.M;
        }
      }
    }

    return result;
  }

  /**
   * Get configuration file paths for the given workspace
   */
  getConfigPaths(workspacePath: string): string[] {
    return resolveConfigPaths(workspacePath);
  }
}
