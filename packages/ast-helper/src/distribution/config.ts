/**
 * Distribution system configuration utilities
 * Provides configuration loading, validation, and default values
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { DistributionConfig, PackageConfig, RegistryConfig } from './types';

/**
 * Default distribution configuration
 */
export const DEFAULT_CONFIG: Partial<DistributionConfig> = {
  platforms: ['win32', 'darwin', 'linux'],
  releaseNotes: '',
  binaryDistribution: {
    enabled: true,
    platforms: ['win32', 'darwin', 'linux'],
    signing: {
      enabled: false,
    },
    packaging: {
      formats: ['tar.gz', 'zip'],
      compression: 'gzip',
      includeAssets: true,
    },
    distribution: {
      channels: ['stable', 'beta'],
      defaultChannel: 'stable',
      promotion: {
        automatic: false,
        rules: [],
      },
    },
  },
  autoUpdate: {
    enabled: true,
    server: {
      url: 'https://api.github.com',
      channels: ['stable', 'beta'],
      checkInterval: 86400000, // 24 hours
    },
    client: {
      checkInterval: 86400000, // 24 hours
      downloadTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      backgroundDownload: true,
      userPrompt: true,
      updateInterval: 24, // hours
      channel: 'stable',
      autoDownload: false,
      autoInstall: false,
      notifyUser: true,
    },
    rollback: {
      enabled: true,
      maxVersions: 5,
      autoRollback: false,
      rollbackTriggers: [],
      backupDir: './backups',
      maxBackups: 5,
      maxVersionsToKeep: 3,
    },
  },
  security: {
    signing: true,
    verification: {
      checksums: true,
      signatures: true,
      certificates: true,
    },
    vulnerability: {
      scanning: true,
      reporting: true,
      blocking: false,
    },
  },
};

/**
 * Configuration loader class
 */
export class ConfigLoader {
  /**
   * Load configuration from file
   */
  static async loadFromFile(configPath: string): Promise<DistributionConfig> {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      return this.mergeWithDefaults(config);
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load configuration from package.json files
   */
  static async loadFromPackageJson(workspaceRoot: string): Promise<DistributionConfig> {
    const packages: PackageConfig[] = [];
    const registries: RegistryConfig[] = [];

    // Find all package.json files
    const packagePaths = await this.findPackageJsonFiles(workspaceRoot);

    for (const packagePath of packagePaths) {
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      const packageDir = path.dirname(packagePath);

      // Determine package type
      let packageType: 'npm' | 'vscode-extension' | 'binary' = 'npm';
      if (packageJson.engines?.vscode) {
        packageType = 'vscode-extension';
      }

      // Create package configuration
      const packageConfig: PackageConfig = {
        name: packageJson.name,
        type: packageType,
        path: packageDir,
        publishConfig: {
          registry: packageJson.publishConfig?.registry || 'https://registry.npmjs.org',
          access: packageJson.publishConfig?.access || 'public',
          tag: 'latest',
          prerelease: false,
          files: packageJson.files || ['dist/**/*', 'lib/**/*', 'src/**/*'],
          scripts: packageJson.scripts || {},
        },
        metadata: {
          displayName: packageJson.displayName || packageJson.name,
          description: packageJson.description || '',
          keywords: packageJson.keywords || [],
          license: packageJson.license || 'MIT',
          author: packageJson.author || '',
          repository: packageJson.repository?.url || '',
          homepage: packageJson.homepage,
          bugs: packageJson.bugs?.url,
          icon: packageJson.icon,
          categories: packageJson.categories || [],
        },
      };

      packages.push(packageConfig);
    }

    // Create basic configuration
    const config: DistributionConfig = {
      name: 'ast-copilot-helper',
      version: '0.1.0', // Will be updated during distribution
      packages,
      registries,
      platforms: ['win32', 'darwin', 'linux'],
      releaseNotes: '',
      marketplaces: [],
      binaryDistribution: DEFAULT_CONFIG.binaryDistribution!,
      autoUpdate: DEFAULT_CONFIG.autoUpdate!,
      github: {
        owner: '',
        repo: '',
        token: '',
        releaseNotes: {
          generate: true,
          sections: [
            { title: '✨ New Features', commitTypes: ['feat'], order: 1 },
            { title: '🐛 Bug Fixes', commitTypes: ['fix'], order: 2 },
            { title: '📚 Documentation', commitTypes: ['docs'], order: 3 },
            { title: '🔧 Other Changes', commitTypes: ['chore', 'refactor', 'style'], order: 4 },
          ],
          commitTypes: [
            { type: 'feat', section: '✨ New Features', emoji: '✨' },
            { type: 'fix', section: '🐛 Bug Fixes', emoji: '🐛' },
            { type: 'docs', section: '📚 Documentation', emoji: '📚' },
            { type: 'chore', section: '🔧 Other Changes', emoji: '🔧' },
          ],
        },
      },
      security: DEFAULT_CONFIG.security!,
    };

    return this.mergeWithDefaults(config);
  }

  /**
   * Create a basic configuration template
   */
  static createTemplate(): DistributionConfig {
    return {
      name: 'my-package',
      version: '1.0.0',
      packages: [],
      registries: [
        {
          type: 'npm',
          url: 'https://registry.npmjs.org',
          scope: '@your-scope',
        },
      ],
      platforms: ['win32', 'darwin', 'linux'],
      releaseNotes: '',
      marketplaces: [
        {
          type: 'vscode-marketplace',
          publisherId: 'your-publisher-id',
          token: 'your-marketplace-token',
          categories: ['Other'],
        },
      ],
      binaryDistribution: DEFAULT_CONFIG.binaryDistribution!,
      autoUpdate: DEFAULT_CONFIG.autoUpdate!,
      github: {
        owner: 'your-username',
        repo: 'your-repo',
        token: 'your-github-token',
        releaseNotes: {
          generate: true,
          sections: [
            { title: '✨ New Features', commitTypes: ['feat'], order: 1 },
            { title: '🐛 Bug Fixes', commitTypes: ['fix'], order: 2 },
          ],
          commitTypes: [
            { type: 'feat', section: '✨ New Features' },
            { type: 'fix', section: '🐛 Bug Fixes' },
          ],
        },
      },
      security: DEFAULT_CONFIG.security!,
    };
  }

  /**
   * Merge configuration with defaults
   */
  private static mergeWithDefaults(config: Partial<DistributionConfig>): DistributionConfig {
    return {
      name: config.name || 'unnamed-package',
      version: config.version || '1.0.0',
      packages: config.packages || [],
      registries: config.registries || [],
      platforms: config.platforms || DEFAULT_CONFIG.platforms!,
      releaseNotes: config.releaseNotes || '',
      marketplaces: config.marketplaces || [],
      binaryDistribution: {
        ...DEFAULT_CONFIG.binaryDistribution!,
        ...config.binaryDistribution,
      },
      autoUpdate: {
        ...DEFAULT_CONFIG.autoUpdate!,
        ...config.autoUpdate,
        server: {
          ...DEFAULT_CONFIG.autoUpdate!.server,
          ...config.autoUpdate?.server,
        },
        client: {
          ...DEFAULT_CONFIG.autoUpdate!.client,
          ...config.autoUpdate?.client,
        },
        rollback: {
          ...DEFAULT_CONFIG.autoUpdate!.rollback,
          ...config.autoUpdate?.rollback,
        },
      },
      github: config.github || {
        owner: '',
        repo: '',
        token: '',
        releaseNotes: {
          generate: true,
          sections: [],
          commitTypes: [],
        },
      },
      security: {
        ...DEFAULT_CONFIG.security!,
        ...config.security,
        verification: {
          ...DEFAULT_CONFIG.security!.verification,
          ...config.security?.verification,
        },
        vulnerability: {
          ...DEFAULT_CONFIG.security!.vulnerability,
          ...config.security?.vulnerability,
        },
      },
    };
  }

  /**
   * Find all package.json files in workspace
   */
  private static async findPackageJsonFiles(workspaceRoot: string): Promise<string[]> {
    const packageFiles: string[] = [];

    async function searchDirectory(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules and other common directories
            if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
              await searchDirectory(fullPath);
            }
          } else if (entry.name === 'package.json') {
            packageFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await searchDirectory(workspaceRoot);
    return packageFiles;
  }
}

/**
 * Environment configuration
 */
export class EnvironmentConfig {
  /**
   * Get configuration from environment variables
   */
  static fromEnvironment(): Partial<DistributionConfig> {
    return {
      github: {
        owner: process.env.GITHUB_OWNER || '',
        repo: process.env.GITHUB_REPO || '',
        token: process.env.GITHUB_TOKEN || '',
        releaseNotes: {
          generate: true,
          sections: [],
          commitTypes: [],
        },
      },
      registries: [
        {
          type: 'npm',
          url: process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org',
          token: process.env.NPM_TOKEN,
          scope: process.env.NPM_SCOPE,
        },
      ],
      marketplaces: process.env.VSCODE_MARKETPLACE_TOKEN ? [
        {
          type: 'vscode-marketplace' as const,
          publisherId: process.env.VSCODE_PUBLISHER_ID || '',
          token: process.env.VSCODE_MARKETPLACE_TOKEN,
          categories: (process.env.VSCODE_CATEGORIES || 'Other').split(','),
        },
      ] : [],
    };
  }

  /**
   * Validate environment configuration
   */
  static validateEnvironment(): { valid: boolean; missing: string[] } {
    const required = [
      'NODE_ENV',
    ];

    const optional = [
      'GITHUB_TOKEN',
      'NPM_TOKEN',
      'VSCODE_MARKETPLACE_TOKEN',
    ];

    const missing = required.filter(varName => !process.env[varName]);
    const hasOptional = optional.some(varName => process.env[varName]);

    return {
      valid: missing.length === 0 && hasOptional,
      missing: missing.concat(hasOptional ? [] : ['At least one of: ' + optional.join(', ')]),
    };
  }
}

/**
 * Create distribution config from workspace
 */
export async function createFromWorkspace(workspacePath: string): Promise<DistributionConfig> {
  const packageJsonPath = path.join(workspacePath, 'package.json');
  
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
    const config: DistributionConfig = {
      ...DEFAULT_CONFIG,
      name: packageJson.name || 'ast-copilot-helper',
      version: packageJson.version || '1.0.0',
      packages: [
        {
          name: packageJson.name || 'ast-copilot-helper',
          type: 'npm',
          path: workspacePath,
          publishConfig: {
            registry: 'https://registry.npmjs.org',
            access: 'public',
            tag: 'latest',
            prerelease: false,
            files: ['dist/**/*', 'package.json', 'README.md'],
            scripts: {}
          },
          metadata: {
            displayName: packageJson.displayName || packageJson.name || 'AST Copilot Helper',
            description: packageJson.description || 'AST manipulation and analysis tools',
            keywords: packageJson.keywords || ['ast', 'code-analysis', 'typescript'],
            license: packageJson.license || 'MIT',
            author: packageJson.author || 'AST Copilot Helper Team',
            homepage: packageJson.homepage || 'https://github.com/ast-copilot-helper',
            repository: packageJson.repository || 'https://github.com/ast-copilot-helper/ast-copilot-helper'
          }
        }
      ],
      registries: [
        {
          type: 'npm',
          url: 'https://registry.npmjs.org',
          token: process.env.NPM_TOKEN || ''
        }
      ]
    } as DistributionConfig;
    
    return config;
  } catch (error) {
    console.warn('Could not read package.json, using defaults');
    return {
      ...DEFAULT_CONFIG,
      name: 'ast-copilot-helper',
      version: '1.0.0',
      packages: [],
      registries: []
    } as DistributionConfig;
  }
}