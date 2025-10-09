/**
 * XDG Base Directory Specification implementation
 * Handles user configuration path discovery following XDG standards
 *
 * @see https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */

import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get XDG config home directory
 * Follows XDG Base Directory Specification:
 * - Returns $XDG_CONFIG_HOME if set and non-empty
 * - Falls back to ~/.config if not set
 *
 * @returns The XDG config home directory path
 *
 * @example
 * // With XDG_CONFIG_HOME set
 * process.env.XDG_CONFIG_HOME = '/custom/config';
 * getXdgConfigHome(); // Returns: '/custom/config'
 *
 * @example
 * // Without XDG_CONFIG_HOME
 * getXdgConfigHome(); // Returns: '/home/user/.config'
 */
export function getXdgConfigHome(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;

  if (xdgConfigHome && xdgConfigHome.trim() !== "") {
    return xdgConfigHome;
  }

  return join(homedir(), ".config");
}

/**
 * Get user config directory for ast-copilot-helper
 * Returns: $XDG_CONFIG_HOME/ast-copilot-helper (or ~/.config/ast-copilot-helper)
 *
 * @returns The ast-copilot-helper config directory path
 *
 * @example
 * getUserConfigDir(); // Returns: '/home/user/.config/ast-copilot-helper'
 */
export function getUserConfigDir(): string {
  return join(getXdgConfigHome(), "ast-copilot-helper");
}

/**
 * Get user config file path
 * Returns: $XDG_CONFIG_HOME/ast-copilot-helper/config.json
 *
 * @returns The full path to the user config file
 *
 * @example
 * getUserConfigPath(); // Returns: '/home/user/.config/ast-copilot-helper/config.json'
 */
export function getUserConfigPath(): string {
  return join(getUserConfigDir(), "config.json");
}

/**
 * Resolve config file paths in priority order
 *
 * Configuration Priority (highest to lowest):
 * 1. Custom user config (if --user-config flag provided)
 * 2. Project config (.astdb/config.json in workspace)
 * 3. User config (XDG or ~/.config)
 *
 * Note: This returns paths in reverse priority order for config merging.
 * The config system loads lower priority files first, then higher priority
 * files override them.
 *
 * @param workspacePath - Workspace root directory
 * @param customUserConfig - Optional custom user config path from --user-config flag
 * @returns Array of config paths in priority order (lowest priority first for merging)
 *
 * @example
 * // Without custom user config
 * resolveConfigPathsWithXdg('/workspace');
 * // Returns: [
 * //   '/home/user/.config/ast-copilot-helper/config.json',
 * //   '/workspace/.astdb/config.json'
 * // ]
 *
 * @example
 * // With custom user config
 * resolveConfigPathsWithXdg('/workspace', '/custom/config.json');
 * // Returns: [
 * //   '/custom/config.json',
 * //   '/workspace/.astdb/config.json'
 * // ]
 */
export function resolveConfigPathsWithXdg(
  workspacePath: string,
  customUserConfig?: string,
): string[] {
  const paths: string[] = [];

  // 1. User config (lowest priority - loaded first)
  if (customUserConfig) {
    // Custom user config from --user-config flag
    paths.push(customUserConfig);
  } else {
    // Default XDG user config
    paths.push(getUserConfigPath());
  }

  // 2. Project config (higher priority - loaded last, overrides user config)
  paths.push(join(workspacePath, ".astdb", "config.json"));

  return paths;
}
