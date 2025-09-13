/**
 * File-based configuration loading
 * Handles loading configuration from JSON files
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PartialConfig } from '../types.js';

/**
 * Load configuration from a JSON file
 */
export async function loadConfigFile(filePath: string): Promise<PartialConfig> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const config = JSON.parse(content);
    
    // Validate that it's an object
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      throw new Error(`Invalid configuration format in ${filePath}: must be an object`);
    }
    
    return config as PartialConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return empty config
      return {};
    }
    
    // Re-throw parsing or other errors
    throw new Error(`Failed to load configuration from ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Resolve configuration file paths in priority order
 */
export function resolveConfigPaths(workspacePath: string): string[] {
  return [
    // Project config: .astdb/config.json in workspace
    join(workspacePath, '.astdb', 'config.json'),
    // User config: ~/.config/ast-copilot-helper/config.json
    join(homedir(), '.config', 'ast-copilot-helper', 'config.json')
  ];
}

/**
 * Load configuration from multiple file sources
 */
export async function loadConfigFiles(workspacePath: string): Promise<PartialConfig[]> {
  const configPaths = resolveConfigPaths(workspacePath);
  const configs: PartialConfig[] = [];
  
  for (const configPath of configPaths) {
    const config = await loadConfigFile(configPath);
    if (Object.keys(config).length > 0) {
      configs.push(config);
    }
  }
  
  return configs;
}
