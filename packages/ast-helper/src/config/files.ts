/**
 * File-based configuration loading
 * Handles loading configuration from JSON files
 */

import { readFile } from "node:fs/promises";
import type { PartialConfig } from "../types.js";
import { resolveConfigPathsWithXdg } from "./xdg-paths.js";

/**
 * Load configuration from a JSON file
 */
export async function loadConfigFile(filePath: string): Promise<PartialConfig> {
  try {
    const content = await readFile(filePath, "utf-8");
    const config = JSON.parse(content);

    // Validate that it's an object
    if (
      typeof config !== "object" ||
      config === null ||
      Array.isArray(config)
    ) {
      throw new Error(
        `Invalid configuration format in ${filePath}: must be an object`,
      );
    }

    return config as PartialConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist, return empty config
      return {};
    }

    // Re-throw parsing or other errors
    throw new Error(
      `Failed to load configuration from ${filePath}: ${(error as Error).message}`,
    );
  }
}

/**
 * Resolve configuration file paths in priority order
 * Supports XDG Base Directory Specification
 *
 * @param workspacePath - Workspace root directory
 * @param customUserConfig - Optional custom user config from --user-config flag
 * @returns Array of config file paths in priority order
 */
export function resolveConfigPaths(
  workspacePath: string,
  customUserConfig?: string,
): string[] {
  return resolveConfigPathsWithXdg(workspacePath, customUserConfig);
}

/**
 * Load configuration from multiple file sources
 *
 * @param workspacePath - Workspace root directory
 * @param customUserConfig - Optional custom user config from --user-config flag
 * @returns Array of loaded configurations in priority order
 */
export async function loadConfigFiles(
  workspacePath: string,
  customUserConfig?: string,
): Promise<PartialConfig[]> {
  const configPaths = resolveConfigPaths(workspacePath, customUserConfig);
  const configs: PartialConfig[] = [];

  for (const configPath of configPaths) {
    const config = await loadConfigFile(configPath);
    if (Object.keys(config).length > 0) {
      configs.push(config);
    }
  }

  return configs;
}
