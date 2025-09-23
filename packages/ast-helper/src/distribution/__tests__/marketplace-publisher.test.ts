/**
 * Tests for Marketplace Publisher
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { MarketplacePublisher } from '../marketplace-publisher';
import type { DistributionConfig } from '../types';

// Mock fs and child_process at module level to avoid ESM issues  
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('MarketplacePublisher', () => {
  let publisher: MarketplacePublisher;
  let testConfig: DistributionConfig;
  let tempDir: string;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Setup default mock behaviors
    const { promises: fsMocks } = await import('fs');
    vi.mocked(fsMocks.mkdir).mockResolvedValue(undefined);
    vi.mocked(fsMocks.writeFile).mockResolvedValue(undefined);
    vi.mocked(fsMocks.access).mockResolvedValue(undefined);
    vi.mocked(fsMocks.readFile).mockResolvedValue(JSON.stringify({
      name: 'test-vscode-extension',
      displayName: 'Test VS Code Extension',
      version: '1.0.0',
      description: 'Test VS Code extension for marketplace publishing',
      publisher: 'test-publisher',
      engines: { vscode: '^1.60.0' },
      categories: ['Other'],
      keywords: ['test', 'extension'],
      main: './out/extension.js',
      contributes: { commands: [{ command: 'test.helloWorld', title: 'Hello World' }] },
      activationEvents: ['onCommand:test.helloWorld'],
      icon: 'images/icon.png',
      repository: { type: 'git', url: 'https://github.com/test/test-extension.git' },
      license: 'MIT',
    }, null, 2));
    vi.mocked(fsMocks.stat).mockResolvedValue({ size: 1024000 } as any);
    vi.mocked(fsMocks.unlink).mockResolvedValue(undefined);
    vi.mocked(fsMocks.rm).mockResolvedValue(undefined);
    
    publisher = new MarketplacePublisher();
    tempDir = path.join(__dirname, `marketplace-test-${Date.now()}`);

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
    // Clear all mocks
    vi.clearAllMocks();
    
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
      // Mock fs.readFile to return extension without required fields
      const { promises: fsMocks } = await import('fs');
      const extensionWithoutRequired = {
        name: 'test-extension',
        version: '1.0.0',
      };
      vi.mocked(fsMocks.readFile).mockResolvedValueOnce(JSON.stringify(extensionWithoutRequired, null, 2));

      const result = await publisher.validate();

      expect(result.success).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MISSING_DISPLAY_NAME')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_PUBLISHER')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_VSCODE_ENGINE')).toBe(true);
    });

    it('should report warnings for missing recommended fields', async () => {
      // Mock fs.readFile to return extension without recommended fields
      const { promises: fsMocks } = await import('fs');
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
      vi.mocked(fsMocks.readFile).mockResolvedValueOnce(JSON.stringify(extensionWithoutRecommended, null, 2));

      const result = await publisher.validate();

      expect(result.warnings.some((w: any) => w.code === 'MISSING_CATEGORIES')).toBe(true);
      expect(result.warnings.some((w: any) => w.code === 'MISSING_KEYWORDS')).toBe(true);
      expect(result.warnings.some((w: any) => w.code === 'MISSING_ICON')).toBe(true);
    });

    it('should report errors for missing files', async () => {
      // Mock fs.access to throw error for missing main file
      const { promises: fsMocks } = await import('fs');
      vi.mocked(fsMocks.access).mockReset();
      vi.mocked(fsMocks.access).mockRejectedValue(new Error('ENOENT: no such file or directory'));

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
      // Create config with only VS Code Marketplace
      const vsCodeOnlyConfig = {
        ...testConfig,
        marketplaces: [
          {
            type: 'vscode-marketplace' as const,
            publisherId: 'test-publisher',
            token: 'test-vscode-token',
            categories: ['Other'],
          },
        ],
      };
      
      // Clear and setup mocks
      vi.clearAllMocks();
      const { promises: fsMocks } = await import('fs');
      vi.mocked(fsMocks.stat).mockResolvedValue({ size: 1024000 } as any);
      vi.mocked(fsMocks.readFile).mockResolvedValue(JSON.stringify({
        name: 'test-vscode-extension',
        displayName: 'Test VS Code Extension',
        description: 'A test VS Code extension for marketplace publishing',
        version: '1.0.0',
        publisher: 'test-publisher',
        engines: { vscode: '^1.60.0' },
        categories: ['Other'],
        main: './out/extension.js',
      }, null, 2));
      vi.mocked(fsMocks.access).mockResolvedValue(undefined);
      vi.mocked(fsMocks.writeFile).mockResolvedValue(undefined);
      vi.mocked(fsMocks.mkdir).mockResolvedValue(undefined);
      
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock all the commands that will be called during publishing
      mockExecSync
        .mockReturnValueOnce('2.15.0') // vsce --version (initialization)
        .mockImplementationOnce(() => { throw new Error('ovsx not found'); }) // ovsx --version (should fail)
        .mockReturnValueOnce('build completed') // npm run build
        .mockReturnValueOnce('tests passed') // npm test
        .mockReturnValueOnce('') // vsce package
        .mockReturnValueOnce('Published test-publisher.test-vscode-extension@2.0.0'); // vsce publish
      
      // Set up environment variables for credentials
      const originalVscePat = process.env.VSCE_PAT;
      const originalVscePublisher = process.env.VSCE_PUBLISHER;
      const originalOvsxPat = process.env.OVSX_PAT;
      process.env.VSCE_PAT = 'test-vscode-token';
      process.env.VSCE_PUBLISHER = 'test-publisher';
      // Don't set OVSX_PAT to ensure only VS Code Marketplace publishing
      delete process.env.OVSX_PAT;
      
      try {
        // Initialize with VS Code only config
        await publisher.initialize(vsCodeOnlyConfig);
        const result = await publisher.publish();

        expect(result.success).toBe(true);
        expect(result.packages.length).toBeGreaterThanOrEqual(1);
        expect(result.packages.some((p: any) => p.registry === 'vscode')).toBe(true);
      } finally {
        // Restore environment variables
        if (originalVscePat !== undefined) {
          process.env.VSCE_PAT = originalVscePat;
        } else {
          delete process.env.VSCE_PAT;
        }
        if (originalVscePublisher !== undefined) {
          process.env.VSCE_PUBLISHER = originalVscePublisher;
        } else {
          delete process.env.VSCE_PUBLISHER;
        }
      }
    });

    it('should publish to both marketplaces when credentials available', async () => {
      // Set up environment variables for both marketplaces
      const originalVscePat = process.env.VSCE_PAT;
      const originalVscePublisher = process.env.VSCE_PUBLISHER;
      const originalOvsxPat = process.env.OVSX_PAT;
      process.env.VSCE_PAT = 'test-vscode-token';
      process.env.VSCE_PUBLISHER = 'test-publisher';
      process.env.OVSX_PAT = 'test-ovsx-token';
      
      try {
        const { execSync } = await import('child_process');
        const mockExecSync = execSync as any;
        
        // Mock initialization and publishing commands
        mockExecSync
          .mockReturnValueOnce('2.15.0') // vsce --version
          .mockReturnValueOnce('1.5.0') // ovsx --version  
          .mockReturnValueOnce('build completed') // npm run build
          .mockReturnValueOnce('tests passed') // npm test
          .mockReturnValueOnce('') // vsce package
          .mockReturnValueOnce('Published test-publisher.test-vscode-extension@2.0.0') // vsce publish
          .mockReturnValueOnce('Published test-publisher.test-vscode-extension@2.0.0'); // ovsx publish
        
        // Mock fs.stat to simulate packaged file exists
        const { promises: fsMocks2 } = await import('fs');
        vi.mocked(fsMocks2.stat).mockResolvedValue({ size: 1024000 } as any); // 1MB file

        // Reinitialize publisher to pick up new environment variables
        const newPublisher = new MarketplacePublisher();
        await newPublisher.initialize(testConfig);
        const result = await newPublisher.publish();

        expect(result.success).toBe(true);
        expect(result.packages).toHaveLength(2); // Both VS Code Marketplace and Open VSX
        expect(result.packages.some((p: any) => p.registry === 'vscode')).toBe(true);
        expect(result.packages.some((p: any) => p.registry === 'openvsx')).toBe(true);
      } finally {
        // Restore environment variables
        if (originalVscePat !== undefined) {
          process.env.VSCE_PAT = originalVscePat;
        } else {
          delete process.env.VSCE_PAT;
        }
        if (originalVscePublisher !== undefined) {
          process.env.VSCE_PUBLISHER = originalVscePublisher;
        } else {
          delete process.env.VSCE_PUBLISHER;
        }
        if (originalOvsxPat !== undefined) {
          process.env.OVSX_PAT = originalOvsxPat;
        } else {
          delete process.env.OVSX_PAT;
        }
      }
    });

    it('should handle packaging failures', async () => {
      // Set up environment variables for credentials
      const originalVscePat = process.env.VSCE_PAT;
      const originalVscePublisher = process.env.VSCE_PUBLISHER;
      process.env.VSCE_PAT = 'test-vscode-token';
      process.env.VSCE_PUBLISHER = 'test-publisher';
      
      try {
        const { execSync } = await import('child_process');
        const mockExecSync = execSync as any;
        
        // Mock build success but packaging failure
        mockExecSync
          .mockReturnValueOnce('2.15.0') // vsce --version (initialization)
          .mockReturnValueOnce('build completed') // npm run build
          .mockReturnValueOnce('tests passed') // npm test
          .mockImplementationOnce(() => { // vsce package - failure
            throw new Error('Packaging failed');
          });

        const result = await publisher.publish();

        // Should be successful overall since Open VSX succeeds, but with some failures
        expect(result.success).toBe(true);
        expect(result.packages.length).toBeGreaterThanOrEqual(1);
        expect(result.packages.some((p: any) => !p.success && p.error?.includes('VS Code Marketplace publish failed'))).toBe(true);
      } finally {
        // Restore environment variables
        if (originalVscePat !== undefined) {
          process.env.VSCE_PAT = originalVscePat;
        } else {
          delete process.env.VSCE_PAT;
        }
        if (originalVscePublisher !== undefined) {
          process.env.VSCE_PUBLISHER = originalVscePublisher;
        } else {
          delete process.env.VSCE_PUBLISHER;
        }
      }
    });

    it('should handle publish failures', async () => {
      // Create config with only VS Code Marketplace
      const vsCodeOnlyConfig = {
        ...testConfig,
        marketplaces: [
          {
            type: 'vscode-marketplace' as const,
            publisherId: 'test-publisher', 
            token: 'test-vscode-token',
            categories: ['Other'],
          },
        ],
      };
      
      // Clear and setup mocks
      vi.clearAllMocks();
      const { promises: fsMocks } = await import('fs');
      vi.mocked(fsMocks.stat).mockResolvedValue({ size: 1024000 } as any);
      vi.mocked(fsMocks.readFile).mockResolvedValue(JSON.stringify({
        name: 'test-vscode-extension',
        displayName: 'Test VS Code Extension',
        description: 'A test VS Code extension for marketplace publishing',
        version: '1.0.0',
        publisher: 'test-publisher',
        engines: { vscode: '^1.60.0' },
        categories: ['Other'],
        main: './out/extension.js',
      }, null, 2));
      vi.mocked(fsMocks.access).mockResolvedValue(undefined);
      vi.mocked(fsMocks.writeFile).mockResolvedValue(undefined);
      vi.mocked(fsMocks.mkdir).mockResolvedValue(undefined);
      
      // Set up environment variables for credentials
      const originalVscePat = process.env.VSCE_PAT;
      const originalVscePublisher = process.env.VSCE_PUBLISHER;
      process.env.VSCE_PAT = 'test-vscode-token';
      process.env.VSCE_PUBLISHER = 'test-publisher';
      
      try {
        const { execSync } = await import('child_process');
        const mockExecSync = execSync as any;
        
        // Mock packaging success but publishing failure
        mockExecSync
          .mockReturnValueOnce('2.15.0') // vsce --version (initialization)
          .mockReturnValueOnce('build completed') // npm run build
          .mockReturnValueOnce('tests passed') // npm test
          .mockReturnValueOnce('') // vsce package - success
          .mockImplementationOnce(() => { // vsce publish - failure
            throw new Error('Extension already exists');
          });
        
        // Initialize with VS Code only config
        await publisher.initialize(vsCodeOnlyConfig);
        const result = await publisher.publish();

        expect(result.success).toBe(false);
        expect(result.packages).toHaveLength(1);
        expect(result.packages[0].success).toBe(false);
        expect(result.packages[0].error).toContain('Failed to package extension');
      } finally {
        // Restore environment variables
        if (originalVscePat !== undefined) {
          process.env.VSCE_PAT = originalVscePat;
        } else {
          delete process.env.VSCE_PAT;
        }
        if (originalVscePublisher !== undefined) {
          process.env.VSCE_PUBLISHER = originalVscePublisher;
        } else {
          delete process.env.VSCE_PUBLISHER;
        }
      }
    });

    it('should handle validation failures', async () => {
      const { execSync } = await import('child_process');
      const mockExecSync = execSync as any;
      
      // Mock tool check but let validation fail
      mockExecSync.mockReturnValue('2.15.0\n'); // vsce --version for initialization

      // Create a new publisher to test validation failures
      const newPublisher = new MarketplacePublisher();
      
      // Mock fs.access to fail for main file (simulating missing file)
      const { promises: fsMocks } = await import('fs');
      vi.mocked(fsMocks.access).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await newPublisher.initialize(testConfig);
      const result = await newPublisher.publish();

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