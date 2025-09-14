/**
 * Configuration System Entry Point
 * Provides unified access to MCP server configuration
 */

export * from './types.js';
export * from './defaults.js';
export * from './validator.js';
export * from './loader.js';

// Re-export commonly used functions and classes
export { ConfigManager, createConfigManager, loadConfig } from './loader.js';
export { validateConfig, validateConfigConstraints } from './validator.js';
export { 
  DEFAULT_MCP_SERVER_CONFIG, 
  DEVELOPMENT_CONFIG, 
  PRODUCTION_CONFIG, 
  TEST_CONFIG,
  getEnvironmentConfig 
} from './defaults.js';

/**
 * Quick configuration factory functions
 */

/**
 * Create configuration for development environment
 */
export async function createDevelopmentConfig(): Promise<import('./types.js').MCPServerConfig> {
  const { ConfigManager } = await import('./loader.js');
  const { DEVELOPMENT_CONFIG } = await import('./defaults.js');
  
  const configManager = new ConfigManager();
  
  // Load base config and merge with development overrides
  const config = await configManager.loadConfig({
    validateConfig: true,
    allowEnvironmentOverrides: true,
    enableDefaults: true,
  });
  
  // Apply development-specific configuration
  return configManager.mergeConfigs(config, DEVELOPMENT_CONFIG);
}

/**
 * Create configuration for production environment
 */
export async function createProductionConfig(): Promise<import('./types.js').MCPServerConfig> {
  const { ConfigManager } = await import('./loader.js');
  const { PRODUCTION_CONFIG } = await import('./defaults.js');
  
  const configManager = new ConfigManager();
  
  // Load base config and merge with production overrides
  const config = await configManager.loadConfig({
    validateConfig: true,
    allowEnvironmentOverrides: true,
    strictMode: true,
    enableDefaults: true,
  });
  
  // Apply production-specific configuration
  return configManager.mergeConfigs(config, PRODUCTION_CONFIG);
}

/**
 * Create configuration for test environment
 */
export async function createTestConfig(): Promise<import('./types.js').MCPServerConfig> {
  const { ConfigManager } = await import('./loader.js');
  const { TEST_CONFIG } = await import('./defaults.js');
  
  const configManager = new ConfigManager();
  
  // Load base config and merge with test overrides
  const config = await configManager.loadConfig({
    validateConfig: true,
    allowEnvironmentOverrides: true,
    enableDefaults: true,
  });
  
  // Apply test-specific configuration
  return configManager.mergeConfigs(config, TEST_CONFIG);
}