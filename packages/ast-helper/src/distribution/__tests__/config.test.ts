/**
 * Tests for Configuration utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ConfigLoader, EnvironmentConfig, DEFAULT_CONFIG } from '../config';

describe('ConfigLoader', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, `config-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('loadFromFile', () => {
    it('should load configuration from JSON file', async () => {
      const testConfig = {
        version: '1.2.3',
        packages: [],
        registries: [],
        platforms: ['win32'],
        releaseNotes: 'Test release',
      };

      const configPath = path.join(tempDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(testConfig, null, 2));

      const config = await ConfigLoader.loadFromFile(configPath);

      expect(config.version).toBe('1.2.3');
      expect(config.platforms).toEqual(['win32']);
      expect(config.releaseNotes).toBe('Test release');
      
      // Should merge with defaults
      expect(config.autoUpdate).toBeDefined();
      expect(config.security).toBeDefined();
    });

    it('should throw error for missing file', async () => {
      const configPath = path.join(tempDir, 'nonexistent.json');

      await expect(ConfigLoader.loadFromFile(configPath)).rejects.toThrow(
        'Failed to load configuration'
      );
    });

    it('should throw error for invalid JSON', async () => {
      const configPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(configPath, 'invalid json');

      await expect(ConfigLoader.loadFromFile(configPath)).rejects.toThrow(
        'Failed to load configuration'
      );
    });
  });

  describe('loadFromPackageJson', () => {
    it('should detect NPM packages', async () => {
      // Create NPM package
      const npmPackageDir = path.join(tempDir, 'npm-package');
      await fs.mkdir(npmPackageDir, { recursive: true });
      
      const npmPackageJson = {
        name: 'test-npm-package',
        version: '1.0.0',
        description: 'Test NPM package',
        main: 'index.js',
      };
      
      await fs.writeFile(
        path.join(npmPackageDir, 'package.json'),
        JSON.stringify(npmPackageJson, null, 2)
      );

      const config = await ConfigLoader.loadFromPackageJson(tempDir);

      expect(config.packages).toHaveLength(1);
      expect(config.packages[0].name).toBe('test-npm-package');
      expect(config.packages[0].type).toBe('npm');
      expect(config.packages[0].path).toBe(npmPackageDir);
    });

    it('should detect VS Code extensions', async () => {
      // Create VS Code extension package
      const extensionDir = path.join(tempDir, 'extension');
      await fs.mkdir(extensionDir, { recursive: true });
      
      const extensionPackageJson = {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test VS Code extension',
        main: 'extension.js',
        engines: {
          vscode: '^1.80.0',
        },
        categories: ['Other'],
      };
      
      await fs.writeFile(
        path.join(extensionDir, 'package.json'),
        JSON.stringify(extensionPackageJson, null, 2)
      );

      const config = await ConfigLoader.loadFromPackageJson(tempDir);

      expect(config.packages).toHaveLength(1);
      expect(config.packages[0].name).toBe('test-extension');
      expect(config.packages[0].type).toBe('vscode-extension');
      expect(config.packages[0].metadata.categories).toEqual(['Other']);
    });

    it('should skip node_modules and other directories', async () => {
      // Create package in node_modules (should be skipped)
      const nodeModulesDir = path.join(tempDir, 'node_modules', 'some-package');
      await fs.mkdir(nodeModulesDir, { recursive: true });
      
      await fs.writeFile(
        path.join(nodeModulesDir, 'package.json'),
        JSON.stringify({ name: 'should-be-skipped' }, null, 2)
      );

      // Create valid package
      const validPackageDir = path.join(tempDir, 'valid-package');
      await fs.mkdir(validPackageDir, { recursive: true });
      
      await fs.writeFile(
        path.join(validPackageDir, 'package.json'),
        JSON.stringify({ name: 'valid-package' }, null, 2)
      );

      const config = await ConfigLoader.loadFromPackageJson(tempDir);

      expect(config.packages).toHaveLength(1);
      expect(config.packages[0].name).toBe('valid-package');
    });
  });

  describe('createTemplate', () => {
    it('should create a valid template configuration', () => {
      const template = ConfigLoader.createTemplate();

      expect(template.version).toBe('1.0.0');
      expect(template.packages).toEqual([]);
      expect(template.registries).toHaveLength(1);
      expect(template.marketplaces).toHaveLength(1);
      expect(template.binaryDistribution).toBeDefined();
      expect(template.autoUpdate).toBeDefined();
      expect(template.github).toBeDefined();
      expect(template.security).toBeDefined();
    });
  });
});

describe('EnvironmentConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('fromEnvironment', () => {
    it('should load configuration from environment variables', () => {
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.GITHUB_REPO = 'test-repo';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.NPM_TOKEN = 'npm-test-token';
      process.env.VSCODE_MARKETPLACE_TOKEN = 'vscode-token';
      process.env.VSCODE_PUBLISHER_ID = 'test-publisher';

      const config = EnvironmentConfig.fromEnvironment();

      expect(config.github?.owner).toBe('test-owner');
      expect(config.github?.repo).toBe('test-repo');
      expect(config.github?.token).toBe('test-token');
      expect(config.registries?.[0]?.token).toBe('npm-test-token');
      expect(config.marketplaces?.[0]?.token).toBe('vscode-token');
      expect(config.marketplaces?.[0]?.publisherId).toBe('test-publisher');
    });

    it('should use defaults for missing environment variables', () => {
      const config = EnvironmentConfig.fromEnvironment();

      expect(config.github?.owner).toBe('');
      expect(config.registries?.[0]?.url).toBe('https://registry.npmjs.org');
      expect(config.marketplaces).toEqual([]);
    });
  });

  describe('validateEnvironment', () => {
    it('should validate environment with required and optional variables', () => {
      process.env.NODE_ENV = 'test';
      process.env.GITHUB_TOKEN = 'test-token';

      const result = EnvironmentConfig.validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should report missing required variables', () => {
      delete process.env.NODE_ENV;

      const result = EnvironmentConfig.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('NODE_ENV');
    });

    it('should report missing optional variables', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.GITHUB_TOKEN;
      delete process.env.NPM_TOKEN;
      delete process.env.VSCODE_MARKETPLACE_TOKEN;

      const result = EnvironmentConfig.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.missing.some(msg => msg.includes('At least one of'))).toBe(true);
    });
  });
});

describe('DEFAULT_CONFIG', () => {
  it('should have valid default configuration', () => {
    expect(DEFAULT_CONFIG.platforms).toEqual(['win32', 'darwin', 'linux']);
    expect(DEFAULT_CONFIG.binaryDistribution?.enabled).toBe(true);
    expect(DEFAULT_CONFIG.autoUpdate?.enabled).toBe(true);
    expect(DEFAULT_CONFIG.security?.signing).toBe(true);
  });

  it('should have reasonable timeout values', () => {
    expect(DEFAULT_CONFIG.autoUpdate?.server?.checkInterval).toBe(86400000); // 24 hours
    expect(DEFAULT_CONFIG.autoUpdate?.client?.downloadTimeout).toBe(300000); // 5 minutes
    expect(DEFAULT_CONFIG.autoUpdate?.client?.retryAttempts).toBe(3);
  });
});