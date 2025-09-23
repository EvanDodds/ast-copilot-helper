/**
 * Vector Database Configuration Management
 * 
 * Handles configuration loading, validation, and management for the vector database system.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { 
  VectorDBConfig} from './types.js';
import { 
  createVectorDBConfig, 
  validateVectorDBConfig,
  DEFAULT_VECTOR_DB_CONFIG 
} from './types.js';

/**
 * Vector database configuration with environment-specific settings
 */
export interface VectorConfigOptions {
  /** Base directory for vector database files */
  dataDir: string;
  
  /** Database name prefix */
  dbName?: string;
  
  /** Environment (dev, test, prod) */
  environment?: string;
  
  /** Override specific config values */
  overrides?: Partial<VectorDBConfig>;
}

/**
 * Default configuration options
 */
const DEFAULT_CONFIG_OPTIONS: Required<VectorConfigOptions> = {
  dataDir: './data/vectors',
  dbName: 'ast-copilot',
  environment: 'development',
  overrides: {},
};

/**
 * Vector database configuration manager
 */
export class VectorConfigManager {
  private config: VectorDBConfig | null = null;
  private configPath: string | null = null;

  /**
   * Create vector database configuration
   */
  async createConfig(options: VectorConfigOptions): Promise<VectorDBConfig> {
    const opts = { ...DEFAULT_CONFIG_OPTIONS, ...options };
    
    // Ensure data directory exists
    await this.ensureDataDirectory(opts.dataDir);
    
    // Build file paths
    const storageFile = join(opts.dataDir, `${opts.dbName}.sqlite`);
    const indexFile = join(opts.dataDir, `${opts.dbName}.hnsw`);
    
    // Create base configuration
    const baseConfig = {
      ...DEFAULT_VECTOR_DB_CONFIG,
      storageFile,
      indexFile,
      // Environment-specific adjustments
      ...(opts.environment === 'test' && {
        maxElements: 1000, // Smaller for tests
        saveInterval: 10,  // More frequent saves in tests
        autoSave: false,   // Manual control in tests
      }),
      ...(opts.environment === 'production' && {
        maxElements: 500000, // Larger for production
        saveInterval: 600,   // Less frequent saves in production
        autoSave: true,
      }),
      // Apply user overrides
      ...opts.overrides,
    } as VectorDBConfig;

    // Validate configuration
    const errors = validateVectorDBConfig(baseConfig);
    if (errors.length > 0) {
      throw new Error(`Invalid vector database configuration: ${errors.join(', ')}`);
    }

    this.config = baseConfig;
    return baseConfig;
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(configPath: string): Promise<VectorDBConfig> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      const config = createVectorDBConfig(parsed);
      const errors = validateVectorDBConfig(config);
      
      if (errors.length > 0) {
        throw new Error(`Invalid configuration in ${configPath}: ${errors.join(', ')}`);
      }
      
      this.config = config;
      this.configPath = configPath;
      return config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      throw error;
    }
  }

  /**
   * Save current configuration to file
   */
  async saveToFile(configPath: string): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save. Create or load configuration first.');
    }

    await this.ensureDataDirectory(dirname(configPath));
    
    const configJson = JSON.stringify(this.config, null, 2);
    await fs.writeFile(configPath, configJson, 'utf-8');
    
    this.configPath = configPath;
  }

  /**
   * Get current configuration file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }
  getConfig(): VectorDBConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call createConfig() or loadFromFile() first.');
    }
    return this.config;
  }

  /**
   * Update configuration with partial changes
   */
  updateConfig(updates: Partial<VectorDBConfig>): VectorDBConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call createConfig() or loadFromFile() first.');
    }

    const newConfig = { ...this.config, ...updates };
    const errors = validateVectorDBConfig(newConfig);
    
    if (errors.length > 0) {
      throw new Error(`Invalid configuration updates: ${errors.join(', ')}`);
    }

    this.config = newConfig;
    return newConfig;
  }

  /**
   * Get configuration summary for logging
   */
  getConfigSummary(): object {
    if (!this.config) {
      return { status: 'not_initialized' };
    }

    return {
      dimensions: this.config.dimensions,
      maxElements: this.config.maxElements,
      M: this.config.M,
      efConstruction: this.config.efConstruction,
      space: this.config.space,
      autoSave: this.config.autoSave,
      saveInterval: this.config.saveInterval,
      storageFile: this.config.storageFile,
      indexFile: this.config.indexFile,
    };
  }

  /**
   * Validate file paths exist and are writable
   */
  async validatePaths(): Promise<string[]> {
    if (!this.config) {
      return ['Configuration not initialized'];
    }

    const errors: string[] = [];
    
    // Check if parent directories exist
    const storageDir = dirname(this.config.storageFile);
    const indexDir = dirname(this.config.indexFile);
    
    try {
      await this.ensureDataDirectory(storageDir);
    } catch (error) {
      errors.push(`Cannot create storage directory: ${storageDir}`);
    }
    
    try {
      await this.ensureDataDirectory(indexDir);
    } catch (error) {
      errors.push(`Cannot create index directory: ${indexDir}`);
    }

    return errors;
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(dataDir = './data/vectors'): VectorDBConfig {
    const config = createVectorDBConfig({
      storageFile: join(dataDir, 'ast-copilot.sqlite'),
      indexFile: join(dataDir, 'ast-copilot.hnsw'),
    });
    
    this.config = config;
    return config;
  }

  /**
   * Ensure directory exists, create if not
   */
  private async ensureDataDirectory(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

/**
 * Create a vector configuration manager with sensible defaults
 */
export async function createVectorConfig(options?: Partial<VectorConfigOptions>): Promise<VectorDBConfig> {
  const manager = new VectorConfigManager();
  const defaultOptions: VectorConfigOptions = {
    dataDir: './data/vectors',
    dbName: 'ast-copilot',
    environment: 'development',
    overrides: {},
  };
  return manager.createConfig({ ...defaultOptions, ...options });
}

/**
 * Load vector configuration from environment or defaults
 */
export async function loadVectorConfig(): Promise<VectorDBConfig> {
  const dataDir = process.env.AST_VECTOR_DATA_DIR || './data/vectors';
  const dbName = process.env.AST_VECTOR_DB_NAME || 'ast-copilot';
  const environment = process.env.NODE_ENV || 'development';
  
  // Try to load from file first
  const configFile = process.env.AST_VECTOR_CONFIG_FILE;
  if (configFile) {
    const manager = new VectorConfigManager();
    return manager.loadFromFile(configFile);
  }
  
  // Otherwise create with environment defaults
  return createVectorConfig({
    dataDir,
    dbName,
    environment,
  });
}