/**
 * VS Code Marketplace Publisher
 * 
 * Handles publishing VS Code extensions to both Microsoft Visual Studio Marketplace
 * and Open VSX Registry using vsce and ovsx tools.
 * 
 * Features:
 * - Extension packaging and validation
 * - Metadata management and manifest updates  
 * - Multi-marketplace publishing (VS Code Marketplace + Open VSX)
 * - Version management and release channels
 * - Asset bundling and icon optimization
 * - Publication verification and marketplace status checking
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import type {
  DistributionConfig,
  PackageConfig,
  ValidationResult,
  VerificationResult,
  VerificationCheck,
} from './types';

interface ExtensionManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  publisher: string;
  engines: {
    vscode: string;
  };
  categories: string[];
  keywords: string[];
  icon?: string;
  galleryBanner?: {
    color: string;
    theme: string;
  };
  repository?: {
    type: string;
    url: string;
  };
  bugs?: {
    url: string;
  };
  homepage?: string;
  license?: string;
  main?: string;
  contributes?: any;
  activationEvents?: string[];
  extensionDependencies?: string[];
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

interface MarketplaceCredentials {
  vscode?: {
    token: string;
    publisher: string;
  };
  openvsx?: {
    token: string;
  };
}

interface PackageResult {
  success: boolean;
  packagePath?: string;
  size?: number;
  error?: string;
}

interface MarketplacePublishResult {
  marketplace: 'vscode' | 'openvsx';
  registry?: string; // For test compatibility
  success: boolean;
  extensionId?: string;
  version?: string;
  url?: string;
  error?: string;
  duration?: number;
}

export interface Publisher {
  initialize(config: DistributionConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<any>;
  verify(result: any): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}

export class MarketplacePublisher implements Publisher {
  private config: DistributionConfig | null = null;
  private credentials: MarketplaceCredentials = {};
  private vsceVersion = '';
  private ovsxVersion = '';

  async initialize(config: DistributionConfig): Promise<void> {
    console.log('Initializing Marketplace Publisher...');
    this.config = config;

    // Load credentials from environment or config
    this.loadCredentials();

    // Verify tools are installed
    await this.verifyTools();

    console.log('Marketplace Publisher initialized successfully');
  }

  private loadCredentials(): void {
    // VS Code Marketplace credentials
    const vsceToken = process.env.VSCE_PAT || this.findMarketplaceToken('vscode-marketplace');
    const vscePublisher = process.env.VSCE_PUBLISHER || this.findPublisher();
    
    if (vsceToken && vscePublisher) {
      this.credentials.vscode = {
        token: vsceToken,
        publisher: vscePublisher,
      };
    }

    // Open VSX credentials
    const ovsxToken = process.env.OVSX_PAT || this.findMarketplaceToken('openvsx');
    
    if (ovsxToken) {
      this.credentials.openvsx = {
        token: ovsxToken,
      };
    }

    console.log('Marketplace credentials loaded');
  }

  private findMarketplaceToken(marketplace: 'vscode-marketplace' | 'openvsx'): string | undefined {
    if (!this.config) {
return undefined;
}
    
    const marketplaceConfig = this.config.marketplaces.find(m => m.type === marketplace);
    return marketplaceConfig?.token;
  }

  private findPublisher(): string | undefined {
    if (!this.config) {
return undefined;
}
    
    const vsCodeMarketplace = this.config.marketplaces.find(m => m.type === 'vscode-marketplace');
    if (vsCodeMarketplace?.publisherId) {
      return vsCodeMarketplace.publisherId;
    }
    
    const vsCodePackage = this.config.packages.find(p => p.type === 'vscode-extension');
    return vsCodePackage?.publishConfig?.registry; // Fallback - not ideal but maintains compatibility
  }

  private async verifyTools(): Promise<void> {
    try {
      // Check vsce
      this.vsceVersion = execSync('vsce --version', { 
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      console.log(`vsce version: ${this.vsceVersion}`);
    } catch (error) {
      throw new Error('vsce (Visual Studio Code Extension Manager) is not installed. Install with: npm install -g vsce');
    }

    try {
      // Check ovsx
      this.ovsxVersion = execSync('ovsx --version', {
        encoding: 'utf-8', 
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      console.log(`ovsx version: ${this.ovsxVersion}`);
    } catch (error) {
      console.warn('ovsx is not installed. Open VSX publishing will be skipped. Install with: npm install -g ovsx');
    }
  }

  async validate(_warnings: string[] = []): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; path?: string; severity: 'error' }> = [];
    const validationWarnings: Array<{ code: string; message: string; path?: string; severity: 'warning' }> = [];

    const addError = (code: string, message: string, path?: string) => {
      errors.push({ code, message, path, severity: 'error' });
    };

    const addWarning = (code: string, message: string, path?: string) => {
      validationWarnings.push({ code, message, path, severity: 'warning' });
    };

    if (!this.config) {
      addError('CONFIG_NOT_INITIALIZED', 'Marketplace publisher not initialized with config');
      return { success: false, errors, warnings: validationWarnings };
    }

    // Check for VS Code extension packages
    const vsCodePackages = this.config.packages.filter(p => p.type === 'vscode-extension');
    if (vsCodePackages.length === 0) {
      addError('NO_VSCODE_PACKAGES', 'No VS Code extension packages found in configuration');
      return { success: false, errors, warnings: validationWarnings };
    }

    // Validate each VS Code package
    for (const pkg of vsCodePackages) {
      await this.validateExtension(pkg, addError, addWarning);
    }

    // Check credentials
    this.validateCredentials(addError, addWarning);

    // Check tools
    this.validateTools(addError, addWarning);

    return {
      success: errors.length === 0,
      errors,
      warnings: validationWarnings
    };
  }

  private async validateExtension(
    pkg: PackageConfig, 
    addError: (code: string, message: string, path?: string) => void,
    addWarning: (code: string, message: string, path?: string) => void
  ): Promise<void> {
    const packageJsonPath = path.join(pkg.path, 'package.json');
    
    try {
      const manifest = await this.loadExtensionManifest(packageJsonPath);
      
      // Validate required fields
      if (!manifest.name) {
        addError('MISSING_NAME', 'Extension name is required', packageJsonPath);
      }

      if (!manifest.displayName) {
        addError('MISSING_DISPLAY_NAME', 'Extension displayName is required', packageJsonPath);
      }

      if (!manifest.version) {
        addError('MISSING_VERSION', 'Extension version is required', packageJsonPath);
      }

      if (!manifest.description) {
        addError('MISSING_DESCRIPTION', 'Extension description is required', packageJsonPath);
      }

      if (!manifest.publisher) {
        addError('MISSING_PUBLISHER', 'Extension publisher is required', packageJsonPath);
      }

      if (!manifest.engines?.vscode) {
        addError('MISSING_VSCODE_ENGINE', 'VS Code engine version is required', packageJsonPath);
      }

      // Validate optional but recommended fields
      if (!manifest.categories || manifest.categories.length === 0) {
        addWarning('MISSING_CATEGORIES', 'Extension categories are recommended for better discoverability', packageJsonPath);
      }

      if (!manifest.keywords || manifest.keywords.length === 0) {
        addWarning('MISSING_KEYWORDS', 'Extension keywords are recommended for better searchability', packageJsonPath);
      }

      if (!manifest.icon) {
        addWarning('MISSING_ICON', 'Extension icon is recommended for marketplace presentation', packageJsonPath);
      } else {
        // Check if icon file exists
        const iconPath = path.join(pkg.path, manifest.icon);
        try {
          await fs.access(iconPath);
        } catch {
          addError('ICON_FILE_NOT_FOUND', `Icon file not found: ${manifest.icon}`, packageJsonPath);
        }
      }

      if (!manifest.repository) {
        addWarning('MISSING_REPOSITORY', 'Repository information is recommended', packageJsonPath);
      }

      // Validate main entry point if specified
      if (manifest.main) {
        const mainPath = path.join(pkg.path, manifest.main);
        try {
          await fs.access(mainPath);
        } catch {
          addError('MAIN_FILE_NOT_FOUND', `Main entry file not found: ${manifest.main}`, packageJsonPath);
        }
      }

      // Check for README
      const readmePath = path.join(pkg.path, 'README.md');
      try {
        await fs.access(readmePath);
      } catch {
        addWarning('MISSING_README', 'README.md file is recommended for extension documentation', pkg.path);
      }

      // Check for CHANGELOG
      const changelogPath = path.join(pkg.path, 'CHANGELOG.md');
      try {
        await fs.access(changelogPath);
      } catch {
        addWarning('MISSING_CHANGELOG', 'CHANGELOG.md file is recommended for version history', pkg.path);
      }

    } catch (error) {
      addError('INVALID_PACKAGE_JSON', `Could not load or parse package.json: ${error}`, packageJsonPath);
    }
  }

  private validateCredentials(
    addError: (code: string, message: string, path?: string) => void,
    addWarning: (code: string, message: string, path?: string) => void
  ): void {
    if (!this.credentials.vscode?.token) {
      addError('MISSING_VSCODE_TOKEN', 'VS Code Marketplace personal access token is required (VSCE_PAT environment variable)');
    }

    if (!this.credentials.vscode?.publisher) {
      addError('MISSING_VSCODE_PUBLISHER', 'VS Code Marketplace publisher is required');
    }

    if (!this.credentials.openvsx?.token) {
      addWarning('MISSING_OPENVSX_TOKEN', 'Open VSX personal access token not provided (OVSX_PAT). Open VSX publishing will be skipped.');
    }
  }

  private validateTools(
    addError: (code: string, message: string, path?: string) => void,
    addWarning: (code: string, message: string, path?: string) => void
  ): void {
    if (!this.vsceVersion) {
      addError('VSCE_NOT_AVAILABLE', 'vsce tool not available. Install with: npm install -g vsce');
    }

    if (!this.ovsxVersion) {
      addWarning('OVSX_NOT_AVAILABLE', 'ovsx tool not available. Install with: npm install -g ovsx for Open VSX publishing');
    }
  }

  async publish(): Promise<any> {
    console.log('Starting VS Code extension publication...');

    if (!this.config) {
      const error = 'Marketplace publisher not initialized';
      console.error(`Marketplace publication failed: ${error}`);
      return {
        success: false,
        packages: [],
        error
      };
    }

    // Validate before publishing
    const validation = await this.validate();
    if (!validation.success) {
      const error = `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`;
      console.error(`Marketplace publication failed: ${error}`);
      return {
        success: false,
        packages: [],
        error
      };
    }

    const startTime = Date.now();
    const results: MarketplacePublishResult[] = [];
    const vsCodePackages = this.config.packages.filter(p => p.type === 'vscode-extension');

    try {
      for (const pkg of vsCodePackages) {
        console.log(`Publishing extension: ${pkg.name}`);
        
        // Prepare extension for publishing
        await this.prepareExtension(pkg);
        
        // Package extension
        const packageResult = await this.packageExtension(pkg);
        if (!packageResult.success) {
          results.push({
            marketplace: 'vscode',
            registry: 'vscode',
            success: false,
            error: packageResult.error
          });
          continue;
        }

        // Publish to VS Code Marketplace
        if (this.credentials.vscode) {
          const vsCodeResult = await this.publishToVSCodeMarketplace(pkg, packageResult.packagePath!);
          results.push(vsCodeResult);
        }

        // Publish to Open VSX
        if (this.credentials.openvsx && this.ovsxVersion) {
          const ovsxResult = await this.publishToOpenVSX(pkg, packageResult.packagePath!);
          results.push(ovsxResult);
        }

        // Clean up package file
        if (packageResult.packagePath) {
          try {
            await fs.unlink(packageResult.packagePath);
          } catch (error) {
            console.warn(`Could not clean up package file: ${error}`);
          }
        }
      }

      const duration = Date.now() - startTime;
      const successfulPublications = results.filter(r => r.success);
      const failedPublications = results.filter(r => !r.success);

      if (failedPublications.length > 0) {
        console.error(`❌ Some publications failed: ${failedPublications.map(r => `${r.marketplace}: ${r.error}`).join(', ')}`);
      }

      if (successfulPublications.length > 0) {
        console.log(`✅ Successfully published to ${successfulPublications.length} marketplace(s) in ${duration}ms`);
        console.log(`📧 Publishing notification:`);
        console.log(`  Marketplaces: ${successfulPublications.map(r => r.marketplace).join(', ')}`);
        console.log(`  Version: ${this.config.version}`);
        console.log(`  Extensions: ${successfulPublications.map(r => r.extensionId).join(', ')}`);
        console.log(`  Duration: ${duration}ms`);
        console.log(`  Success: ${successfulPublications.length > 0 ? '✅' : '❌'}`);
      }

      return {
        success: successfulPublications.length > 0,
        packages: results,
        duration
      };

    } catch (error) {
      const errorMessage = `Marketplace publication error: ${error}`;
      console.error(errorMessage);
      
      return {
        success: false,
        packages: [],
        error: errorMessage
      };
    }
  }

  private async prepareExtension(pkg: PackageConfig): Promise<void> {
    console.log(`Preparing ${pkg.name} for marketplace publishing...`);

    const packageJsonPath = path.join(pkg.path, 'package.json');
    const manifest = await this.loadExtensionManifest(packageJsonPath);

    // Update version if specified in config
    if (this.config!.version !== manifest.version) {
      manifest.version = this.config!.version;
      console.log(`Updated ${pkg.name} version to ${this.config!.version}`);
    }

    // Apply metadata updates from config
    if (pkg.metadata) {
      if (pkg.metadata.displayName) {
        manifest.displayName = pkg.metadata.displayName;
      }
      if (pkg.metadata.description) {
        manifest.description = pkg.metadata.description;
      }
      if (pkg.metadata.keywords) {
        manifest.keywords = pkg.metadata.keywords;
      }
      if (pkg.metadata.license) {
        manifest.license = pkg.metadata.license;
      }
    }

    // Save updated manifest
    await fs.writeFile(packageJsonPath, JSON.stringify(manifest, null, 2));

    // Run pre-publish scripts if configured
    if (pkg.publishConfig?.scripts?.build) {
      console.log(`Running build script for ${pkg.name}...`);
      try {
        execSync(pkg.publishConfig.scripts.build, {
          cwd: pkg.path,
          stdio: 'inherit'
        });
      } catch (error) {
        throw new Error(`Build script failed for ${pkg.name}: ${error}`);
      }
    }

    if (pkg.publishConfig?.scripts?.test) {
      console.log(`Running tests for ${pkg.name}...`);
      try {
        execSync(pkg.publishConfig.scripts.test, {
          cwd: pkg.path,
          stdio: 'inherit'
        });
      } catch (error) {
        throw new Error(`Tests failed for ${pkg.name}: ${error}`);
      }
    }
  }

  private async packageExtension(pkg: PackageConfig): Promise<PackageResult> {
    try {
      const outputDir = path.join(pkg.path, '.marketplace');
      await fs.mkdir(outputDir, { recursive: true });

      const packagePath = path.join(outputDir, `${pkg.name}-${this.config!.version}.vsix`);
      
      const packageCommand = [
        'vsce package',
        '--out', `"${packagePath}"`,
        '--no-git-tag-version',
        '--no-update-package-json'
      ].join(' ');

      console.log(`Executing: ${packageCommand}`);
      
      execSync(packageCommand, {
        cwd: pkg.path,
        stdio: 'inherit'
      });

      const stats = await fs.stat(packagePath);
      
      console.log(`✅ Successfully packaged ${pkg.name} (${Math.round(stats.size / 1024)}KB)`);
      
      return {
        success: true,
        packagePath,
        size: stats.size
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to package extension: ${error}`
      };
    }
  }

  private async publishToVSCodeMarketplace(pkg: PackageConfig, packagePath: string): Promise<MarketplacePublishResult> {
    const startTime = Date.now();
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const publishCommand = [
          'vsce publish',
          '--packagePath', `"${packagePath}"`,
          '--pat', this.credentials.vscode!.token,
          '--no-git-tag-version',
          '--no-update-package-json'
        ].join(' ');

        console.log(`Publishing to VS Code Marketplace (attempt ${attempt}/${maxRetries})...`);
        
        execSync(publishCommand, {
          cwd: pkg.path,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe']
        });

        const duration = Date.now() - startTime;
        
        // Extract extension ID and URL from output
        const extensionId = `${this.credentials.vscode!.publisher}.${pkg.name}`;
        const url = `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;

        console.log(`✅ Successfully published ${extensionId} to VS Code Marketplace (attempt ${attempt})`);
        
        return {
          marketplace: 'vscode',
          registry: 'vscode', // For test compatibility
          success: true,
          extensionId,
          version: this.config!.version,
          url,
          duration
        };
      } catch (error) {
        const errorMessage = error?.toString() || 'Unknown error';
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(errorMessage);
        
        if (attempt === maxRetries || !isRetryable) {
          const duration = Date.now() - startTime;
          
          console.error(`❌ Failed to publish to VS Code Marketplace after ${attempt} attempts: ${error}`);
          
          return {
            marketplace: 'vscode',
            registry: 'vscode', // For test compatibility
            success: false,
            error: `VS Code Marketplace publish failed after ${attempt} attempts: ${error}`,
            duration
          };
        }
        
        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Add jitter
        
        console.warn(`⚠️ VS Code Marketplace publish attempt ${attempt} failed: ${error}`);
        console.log(`⏳ Retrying in ${Math.round(delay)}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    const duration = Date.now() - startTime;
    return {
      marketplace: 'vscode',
      registry: 'vscode',
      success: false,
      error: 'Unexpected error in retry logic',
      duration
    };
  }

  private async publishToOpenVSX(pkg: PackageConfig, packagePath: string): Promise<MarketplacePublishResult> {
    const startTime = Date.now();
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const publishCommand = [
          'ovsx publish',
          `"${packagePath}"`,
          '--pat', this.credentials.openvsx!.token
        ].join(' ');

        console.log(`Publishing to Open VSX Registry (attempt ${attempt}/${maxRetries})...`);
        
        execSync(publishCommand, {
          cwd: pkg.path,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe']
        });

        const duration = Date.now() - startTime;
        
        // Extract extension information
        const extensionId = `${this.credentials.vscode!.publisher}.${pkg.name}`;
        const url = `https://open-vsx.org/extension/${this.credentials.vscode!.publisher}/${pkg.name}`;

        console.log(`✅ Successfully published ${extensionId} to Open VSX Registry (attempt ${attempt})`);
        
        return {
          marketplace: 'openvsx',
          registry: 'openvsx', // For test compatibility
          success: true,
          extensionId,
          version: this.config!.version,
          url,
          duration
        };
      } catch (error) {
        const errorMessage = error?.toString() || 'Unknown error';
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(errorMessage);
        
        if (attempt === maxRetries || !isRetryable) {
          const duration = Date.now() - startTime;
          
          console.error(`❌ Failed to publish to Open VSX Registry after ${attempt} attempts: ${error}`);
          
          return {
            marketplace: 'openvsx',
            registry: 'openvsx', // For test compatibility
            success: false,
            error: `Open VSX publish failed after ${attempt} attempts: ${error}`,
            duration
          };
        }
        
        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Add jitter
        
        console.warn(`⚠️ Open VSX publish attempt ${attempt} failed: ${error}`);
        console.log(`⏳ Retrying in ${Math.round(delay)}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    const duration = Date.now() - startTime;
    return {
      marketplace: 'openvsx',
      registry: 'openvsx',
      success: false,
      error: 'Unexpected error in retry logic',
      duration
    };
  }

  async verify(result: any): Promise<VerificationResult> {
    console.log('Verifying marketplace publication results...');

    const checks: VerificationCheck[] = [];

    // Extract packages from result object if needed
    const packages = Array.isArray(result) ? result : (result.packages || []);

    // Verify each successful publication
    for (const pkg of packages) {
      if (!pkg.success) {
continue;
}

      if (pkg.marketplace === 'vscode' || pkg.registry === 'vscode') {
        const check = await this.verifyVSCodeMarketplace(pkg.extensionId || '', pkg.version || '');
        checks.push(check);
      } else if (pkg.marketplace === 'openvsx' || pkg.registry === 'openvsx') {
        const check = await this.verifyOpenVSX(pkg.extensionId || '', pkg.version || '');
        checks.push(check);
      }
    }

    const allChecksSucceeded = checks.every(c => c.success);

    return {
      success: allChecksSucceeded,
      checks,
      duration: Date.now() - Date.now() // Will be set by caller
    };
  }

  private async verifyVSCodeMarketplace(extensionId: string, version: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    try {
      // Use vsce to show extension info
      const output = execSync(`vsce show ${extensionId}`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const duration = Date.now() - startTime;
      if (output.includes(version)) {
        return {
          name: `VS Code Marketplace - ${extensionId}`,
          success: true,
          message: `Extension ${extensionId}@${version} verified in VS Code Marketplace`,
        duration
        };
      } else {
        return {
          name: `VS Code Marketplace - ${extensionId}`,
          success: false,
          message: `Extension ${extensionId}@${version} not found or version mismatch in VS Code Marketplace`,
        duration
        };
      }
    } catch (error) {
      console.error(`Could not verify ${extensionId} in VS Code Marketplace: ${error}`);
      return {
        name: `VS Code Marketplace - ${extensionId}`,
        success: false,
        message: `Failed to verify ${extensionId} in VS Code Marketplace: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async verifyOpenVSX(extensionId: string, version: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    try {
      // Use curl to check Open VSX API
      const [publisher, name] = extensionId.split('.');
      const apiUrl = `https://open-vsx.org/api/${publisher}/${name}`;
      
      const output = execSync(`curl -s "${apiUrl}"`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const extensionData = JSON.parse(output);
      const duration = Date.now() - startTime;
      
      if (extensionData.version === version) {
        return {
          name: `Open VSX Registry - ${extensionId}`,
          success: true,
          message: `Extension ${extensionId}@${version} verified in Open VSX Registry`,
        duration
        };
      } else {
        return {
          name: `Open VSX Registry - ${extensionId}`,
          success: false,
          message: `Extension ${extensionId}@${version} not found or version mismatch in Open VSX Registry`,
        duration
        };
      }
    } catch (error) {
      return {
        name: `Open VSX Registry - ${extensionId}`,
        success: false,
        message: `Failed to verify ${extensionId} in Open VSX Registry: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async loadExtensionManifest(packageJsonPath: string): Promise<ExtensionManifest> {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content) as ExtensionManifest;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up marketplace publisher...');
    
    // Clean up any temporary files or directories
    if (this.config) {
      for (const pkg of this.config.packages.filter(p => p.type === 'vscode-extension')) {
        const tempDir = path.join(pkg.path, '.marketplace');
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
    
    console.log('Marketplace publisher cleanup completed');
  }

  /**
   * Determines if an error is retryable based on error message patterns
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      /network error/i,
      /timeout/i,
      /connection refused/i,
      /connection reset/i,
      /temporary failure/i,
      /service unavailable/i,
      /internal server error/i,
      /502 bad gateway/i,
      /503 service unavailable/i,
      /504 gateway timeout/i,
      /rate limit/i,
      /throttled/i,
      /temporary/i,
      /try again/i
    ];

    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }
}