/**
 * Tests for Marketplace Publisher
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MarketplacePublisher } from '../marketplace-publisher';
import { DistributionConfig } from '../types';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('MarketplacePublisher', () => {
  let publisher: MarketplacePublisher;
  let testConfig: DistributionConfig;
  let tempDir: string;

  beforeEach(async () => {
    publisher = new MarketplacePublisher();

    // Create temporary directory for testing
    tempDir = path.join(__dirname, `marketplace-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create test extension package.json
    const testExtensionManifest = {
      name: 'test-vscode-extension',
      displayName: 'Test VS Code Extension',
      version: '1.0.0',
      description: 'Test VS Code extension for marketplace publishing',
      publisher: 'test-publisher',
      engines: {
        vscode: '^1.60.0',
      },
      categories: ['Other'],
      keywords: ['test', 'extension'],
      main: './out/extension.js',
      contributes: {
        commands: [
          {
            command: 'test.helloWorld',
            title: 'Hello World',
          },
        ],
      },
      activationEvents: [
        'onCommand:test.helloWorld',
      ],
      icon: 'images/icon.png',
      repository: {
        type: 'git',
        url: 'https://github.com/test/test-extension.git',
      },
      license: 'MIT',
    };

    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(testExtensionManifest, null, 2)
    );

    // Create main file
    await fs.mkdir(path.join(tempDir, 'out'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'out', 'extension.js'),
      'exports.activate = function() { console.log("Extension activated"); };'
    );

    // Create icon file
    await fs.mkdir(path.join(tempDir, 'images'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'images', 'icon.png'),
      'fake-png-content'
    );

    // Create README and CHANGELOG
    await fs.writeFile(
      path.join(tempDir, 'README.md'),
      '# Test Extension\n\nThis is a test extension.'
    );
    await fs.writeFile(
      path.join(tempDir, 'CHANGELOG.md'),
      '# Changelog\n\n## 1.0.0\n- Initial release'
    );

    // Create test configuration
    testConfig = {
      version: '2.0.0',
      packages: [
        {
          name: 'test-vscode-extension',
          type: 'vscode-extension',
          path: tempDir,
          publishConfig: {
            registry: 'https://marketplace.visualstudio.com',
            access: 'public' as const,
            tag: 'latest',
            prerelease: false,
            files: ['out/**/*', 'images/**/*', 'README.md', 'CHANGELOG.md'],
            scripts: {
              build: 'echo "build completed"',
              test: 'echo "tests passed"',
            },
          },
          metadata: {
            displayName: 'Test VS Code Extension',
            description: 'Test extension description',
            keywords: ['test', 'vscode'],
            license: 'MIT',
            author: 'Test Author',
            repository: 'https://github.com/test/test-extension',
          },
        },
      ],
      marketplaces: [
        {
          type: 'vscode-marketplace' as const,
          publisherId: 'test-publisher',
          token: 'test-vscode-token',
          categories: ['Other'],
        },
        {
          type: 'openvsx' as const,
          token: 'test-openvsx-token',
        },
      ],
      registries: [],
      platforms: ['linux'],
      releaseNotes: '',
      binaryDistribution: {
        enabled: false,
        platforms: [],
        signing: { enabled: false },
        packaging: { formats: [], compression: 'none', includeAssets: false },
        distribution: { channels: [], defaultChannel: 'stable', promotion: { automatic: false, rules: [] } },
      },
      autoUpdate: {
        enabled: false,
        server: { url: '', channels: [], checkInterval: 0 },
        client: { checkInterval: 0, downloadTimeout: 0, retryAttempts: 0, backgroundDownload: false, userPrompt: false },
        rollback: { enabled: false, maxVersions: 0, autoRollback: false, rollbackTriggers: [] },
      },
      github: {
        owner: 'test',
        repo: 'test',
        token: 'test-token',
        releaseNotes: { generate: false, sections: [], commitTypes: [] },
      },
      security: {
        signing: false,
        verification: { checksums: false, signatures: false, certificates: false },
        vulnerability: { scanning: false, reporting: false, blocking: false },
      },
    };

    // Set up environment variables
    process.env.VSCE_PAT = 'test-vscode-token';
    process.env.VSCE_PUBLISHER = 'test-publisher';
    process.env.OVSX_PAT = 'test-openvsx-token';
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up environment variables
    delete process.env.VSCE_PAT;
    delete process.env.VSCE_PUBLISHER;
    delete process.env.OVSX_PAT;
    
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync
        .mockReturnValueOnce('2.15.0\n') // vsce version
        .mockReturnValueOnce('0.5.2\n'); // ovsx version

      await expect(publisher.initialize(testConfig)).resolves.not.toThrow();
    });

    it('should handle missing ovsx gracefully', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync
        .mockReturnValueOnce('2.15.0\n') // vsce version
        .mockImplementationOnce((cmd: string) => { // ovsx version
          if (cmd === 'ovsx --version') {
            throw new Error('ovsx not found');
          }
          return 'output';
        });

      await expect(publisher.initialize(testConfig)).resolves.not.toThrow();
    });

    it('should throw error if vsce is missing', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'vsce --version') {
          throw new Error('vsce not found');
        }
        return 'output';
      });

      await expect(publisher.initialize(testConfig)).rejects.toThrow('vsce (Visual Studio Code Extension Manager) is not installed');
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync
        .mockReturnValue('2.15.0\n'); // Default return for version checks
      
      await publisher.initialize(testConfig);
    });

    it('should validate successfully with proper extension', async () => {
      const result = await publisher.validate();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for missing required fields', async () => {
      // Create extension without required fields
      const extensionWithoutRequired = {
        name: 'test-extension',
        version: '1.0.0',
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(extensionWithoutRequired, null, 2)
      );

      const result = await publisher.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MISSING_DISPLAY_NAME')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_PUBLISHER')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_VSCODE_ENGINE')).toBe(true);
    });

    it('should report warnings for missing recommended fields', async () => {
      // Create extension without recommended fields
      const extensionWithoutRecommended = {
        name: 'test-extension',
        displayName: 'Test Extension',
        version: '1.0.0',
        description: 'Test extension',
        publisher: 'test-publisher',
        engines: {
          vscode: '^1.60.0',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(extensionWithoutRecommended, null, 2)
      );

      const result = await publisher.validate();

      expect(result.warnings.some((w: any) => w.code === 'MISSING_CATEGORIES')).toBe(true);
      expect(result.warnings.some((w: any) => w.code === 'MISSING_KEYWORDS')).toBe(true);
      expect(result.warnings.some((w: any) => w.code === 'MISSING_ICON')).toBe(true);
    });

    it('should report errors for missing files', async () => {
      // Remove main file
      await fs.unlink(path.join(tempDir, 'out', 'extension.js'));

      const result = await publisher.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MAIN_FILE_NOT_FOUND')).toBe(true);
    });

    it('should report errors for missing credentials', async () => {
      // Clear environment variables
      delete process.env.VSCE_PAT;
      delete process.env.VSCE_PUBLISHER;

      // Create new publisher without credentials
      const publisherWithoutCreds = new MarketplacePublisher();
      const configWithoutCreds = { ...testConfig, marketplaces: [] };
      
      await publisherWithoutCreds.initialize(configWithoutCreds);
      
      const result = await publisherWithoutCreds.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MISSING_VSCODE_TOKEN')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_VSCODE_PUBLISHER')).toBe(true);
    });

    it('should handle no VS Code packages', async () => {
      const configWithoutVSCode = {
        ...testConfig,
        packages: [],
      };

      const publisherWithoutPackages = new MarketplacePublisher();
      await publisherWithoutPackages.initialize(configWithoutVSCode);
      
      const result = await publisherWithoutPackages.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'NO_VSCODE_PACKAGES')).toBe(true);
    });
  });

  describe('publishing', () => {
    beforeEach(async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync.mockReturnValue('2.15.0\n');
      
      await publisher.initialize(testConfig);
    });

    it('should publish successfully to VS Code Marketplace', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock all the commands that will be called during publishing
      mockExecSync
        .mockReturnValueOnce('build completed') // npm run build
        .mockReturnValueOnce('tests passed') // npm test
        .mockReturnValueOnce('') // vsce package
        .mockReturnValueOnce('Published test-publisher.test-vscode-extension@2.0.0'); // vsce publish

      const result = await publisher.publish();

      expect(result.success).toBe(true);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].success).toBe(true);
      expect(result.packages[0].registry).toBe('vscode');
    });

    it('should publish to both marketplaces when credentials available', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock successful publishing to both marketplaces
      mockExecSync
        .mockReturnValueOnce('build completed') // npm run build
        .mockReturnValueOnce('tests passed') // npm test
        .mockReturnValueOnce('') // vsce package
        .mockReturnValueOnce('Published test-publisher.test-vscode-extension@2.0.0') // vsce publish
        .mockReturnValueOnce('Published test-publisher.test-vscode-extension@2.0.0'); // ovsx publish

      const result = await publisher.publish();

      expect(result.success).toBe(true);
      expect(result.packages).toHaveLength(2); // Both VS Code Marketplace and Open VSX
      expect(result.packages.some((p: any) => p.registry === 'vscode')).toBe(true);
      expect(result.packages.some((p: any) => p.registry === 'openvsx')).toBe(true);
    });

    it('should handle packaging failures', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock build success but packaging failure
      mockExecSync
        .mockReturnValueOnce('build completed') // npm run build
        .mockReturnValueOnce('tests passed') // npm test
        .mockImplementationOnce(() => { // vsce package
          throw new Error('Packaging failed');
        });

      const result = await publisher.publish();

      expect(result.success).toBe(false);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].success).toBe(false);
      expect(result.packages[0].error).toContain('Failed to package extension');
    });

    it('should handle publish failures', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock packaging success but publishing failure
      mockExecSync
        .mockReturnValueOnce('build completed') // npm run build
        .mockReturnValueOnce('tests passed') // npm test
        .mockReturnValueOnce('') // vsce package
        .mockImplementationOnce(() => { // vsce publish
          throw new Error('Extension already exists');
        });

      const result = await publisher.publish();

      expect(result.success).toBe(false);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].success).toBe(false);
      expect(result.packages[0].error).toContain('VS Code Marketplace publish failed');
    });

    it('should handle validation failures', async () => {
      // Remove required files to cause validation failure
      await fs.unlink(path.join(tempDir, 'out', 'extension.js'));

      const result = await publisher.publish();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('verification', () => {
    beforeEach(async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync.mockReturnValue('2.15.0\n');
      
      await publisher.initialize(testConfig);
    });

    it('should verify successful VS Code Marketplace publications', async () => {
      const mockResult = {
        success: true,
        packages: [
          {
            success: true,
            packageName: 'test-publisher.test-vscode-extension',
            version: '2.0.0',
            registry: 'vscode',
            duration: 1000,
          },
        ],
        duration: 2000,
        version: '2.0.0',
        registry: 'marketplace',
      };

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock vsce show to return extension info
      mockExecSync.mockReturnValue('Extension: test-publisher.test-vscode-extension\nVersion: 2.0.0\nPublisher: test-publisher');

      const result = await publisher.verify(mockResult);

      expect(result.success).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should verify successful Open VSX publications', async () => {
      const mockResult = {
        success: true,
        packages: [
          {
            success: true,
            packageName: 'test-publisher.test-vscode-extension',
            version: '2.0.0',
            registry: 'openvsx',
            duration: 1000,
          },
        ],
        duration: 2000,
        version: '2.0.0',
        registry: 'marketplace',
      };

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock curl to return extension info from Open VSX API
      mockExecSync.mockReturnValue(JSON.stringify({
        name: 'test-vscode-extension',
        publisher: 'test-publisher',
        version: '2.0.0',
        displayName: 'Test VS Code Extension',
      }));

      const result = await publisher.verify(mockResult);

      expect(result.success).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should handle verification failures', async () => {
      const mockResult = {
        success: true,
        packages: [
          {
            success: true,
            packageName: 'nonexistent.extension',
            version: '2.0.0',
            registry: 'vscode',
            duration: 1000,
          },
        ],
        duration: 2000,
        version: '2.0.0',
        registry: 'marketplace',
      };

      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock vsce show to fail (extension not found)
      mockExecSync.mockImplementation(() => {
        throw new Error('Extension not found');
      });

      const result = await publisher.verify(mockResult);

      expect(result.success).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      mockExecSync.mockReturnValue('2.15.0\n');
      
      await publisher.initialize(testConfig);
      await expect(publisher.cleanup()).resolves.not.toThrow();
    });
  });
});