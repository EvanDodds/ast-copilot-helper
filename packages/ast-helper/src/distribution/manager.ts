/**
 * Main Distribution Manager
 * Orchestrates the entire package distribution and marketplace publishing process
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MarketplacePublisher } from './marketplace-publisher';
import type {
  DistributionManager as IDistributionManager,
  DistributionConfig,
  PackagePreparation,
  NPMPublishResult,
  MarketplacePublishResult,
  GitHubReleaseResult,
  BinaryDistributionResult,
  AutoUpdateConfig,
  DocumentationResult,
  ValidationResult,
  ValidationMessage,
  PreparedPackage,
  PackageConfig,
} from './types';

export class DistributionManager implements IDistributionManager {
  private config!: DistributionConfig;
  private initialized = false;
  private logger: Console = console;

  /**
   * Initialize the distribution manager with configuration
   */
  async initialize(config: DistributionConfig): Promise<void> {
    this.logger.log('Initializing Distribution Manager...');
    const startTime = Date.now();

    try {
      // 1. Validate configuration
      await this.validateConfig(config);
      
      // 2. Store configuration
      this.config = config;
      
      // 3. Verify environment requirements
      await this.verifyEnvironment();
      
      // 4. Initialize publishers
      await this.initializePublishers();
      
      // 5. Prepare workspace
      await this.prepareWorkspace();
      
      this.initialized = true;
      const duration = Date.now() - startTime;
      
      this.logger.log(`Distribution Manager initialized successfully in ${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to initialize Distribution Manager:', error);
      throw error;
    }
  }

  /**
   * Prepare all packages for distribution
   */
  async preparePackages(): Promise<PackagePreparation> {
    this.ensureInitialized();
    
    this.logger.log('Preparing packages for distribution...');
    const startTime = Date.now();
    
    try {
      const packages: PreparedPackage[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      
      // Process each package configuration
      for (const packageConfig of this.config.packages) {
        try {
          const preparedPackage = await this.preparePackage(packageConfig);
          packages.push(preparedPackage);
          
          this.logger.log(`Package prepared: ${preparedPackage.name} (${preparedPackage.size} bytes)`);
        } catch (error) {
          const errorMsg = `Failed to prepare package ${packageConfig.name}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }
      
      const result: PackagePreparation = {
        success: errors.length === 0,
        packages,
        duration: Date.now() - startTime,
        warnings,
        errors,
      };
      
      this.logger.log(`Package preparation completed: ${packages.length} packages prepared, ${errors.length} errors`);
      
      return result;
    } catch (error) {
      this.logger.error('Package preparation failed:', error);
      throw error;
    }
  }

  /**
   * Publish packages to NPM
   */
  async publishToNPM(): Promise<NPMPublishResult> {
    this.ensureInitialized();
    
    this.logger.log('Starting NPM package publication...');
    
    try {
      const { NPMPublisher } = await import('./npm-publisher');
      const npmPublisher = new NPMPublisher();
      
      await npmPublisher.initialize(this.config);
      const result = await npmPublisher.publish();
      await npmPublisher.cleanup();
      
      return result;
    } catch (error) {
      this.logger.error('NPM publishing failed:', error);
      
      return {
        success: false,
        packages: [],
        duration: 0,
        registry: this.config.registries.find(r => r.type === 'npm')?.url || 'https://registry.npmjs.org',
        version: this.config.version,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Publish extension to VS Code Marketplace
   */
  async publishToVSCodeMarketplace(): Promise<MarketplacePublishResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    this.logger.log('Starting VS Code Marketplace publishing...');

    try {
      // Initialize marketplace publisher
      const publisher = new MarketplacePublisher();
      await publisher.initialize(this.config);

      // Publish to marketplace
      const result = await publisher.publish();
      
      // Clean up
      await publisher.cleanup();

      const duration = Date.now() - startTime;
      const successful = result.filter((r: unknown) => (r as { success: boolean }).success);
      const failed = result.filter((r: unknown) => !(r as { success: boolean }).success);
      
      if (successful.length > 0) {
        this.logger.log(`✅ VS Code Marketplace publishing completed: ${successful.length} successful, ${failed.length} failed in ${duration}ms`);
      } else {
        this.logger.error(`❌ VS Code Marketplace publishing failed: All ${result.length} publications failed`);
      }

      // Convert to MarketplacePublishResult format
      return {
        success: successful.length > 0,
        extensions: result.map((res: unknown) => {
          const r = res as { success: boolean; extensionId?: string; version?: string; marketplace: string; duration?: number; error?: string };
          return {
            success: r.success,
            extensionName: r.extensionId || '',
            version: r.version || this.config.version,
            marketplace: r.marketplace,
            duration: r.duration || 0,
            error: r.error,
          };
        }),
        duration,
        marketplace: 'vscode-marketplace',
        version: this.config.version,
        error: failed.length > 0 ? `Failed: ${failed.map((f: unknown) => (f as { error?: string }).error).join(', ')}` : undefined,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `VS Code Marketplace publishing failed: ${error}`;
      this.logger.error(errorMessage);
      
      return {
        success: false,
        extensions: [],
        duration,
        marketplace: 'vscode-marketplace',
        version: this.config?.version || '0.0.0',
        error: errorMessage,
      };
    }
  }

  /**
   * Create GitHub release
   */
  async createGitHubRelease(): Promise<GitHubReleaseResult> {
    this.ensureInitialized();
    
    // This will be implemented in the GitHub Release Manager subtask
    throw new Error('GitHub release creation not yet implemented - will be done in Subtask 4');
  }

  /**
   * Distribute binaries
   */
  async distributeBinaries(): Promise<BinaryDistributionResult> {
    this.ensureInitialized();
    
    // This will be implemented in the Binary Distributor subtask
    throw new Error('Binary distribution not yet implemented - will be done in Subtask 5');
  }

  /**
   * Setup auto-update system
   */
  async setupAutoUpdates(): Promise<AutoUpdateConfig> {
    this.ensureInitialized();
    
    // This will be implemented in the Auto-Update System subtask
    throw new Error('Auto-update setup not yet implemented - will be done in Subtask 6');
  }

  /**
   * Generate documentation
   */
  async generateDocumentation(): Promise<DocumentationResult> {
    this.ensureInitialized();
    
    // This will be implemented in the Documentation subtask
    throw new Error('Documentation generation not yet implemented - will be done in Subtask 7');
  }

  // Private helper methods

  /**
   * Validate the distribution configuration
   */
  private async validateConfig(config: DistributionConfig): Promise<ValidationResult> {
    const warnings: ValidationMessage[] = [];
    const errors: ValidationMessage[] = [];

    // 1. Basic required fields
    if (!config.version) {
      errors.push({ code: 'MISSING_VERSION', message: 'Version is required', severity: 'error' });
    }

    if (!config.packages || config.packages.length === 0) {
      errors.push({ code: 'NO_PACKAGES', message: 'At least one package must be configured', severity: 'error' });
    }

    // 2. Validate each package
    if (config.packages) {
      for (const pkg of config.packages) {
        await this.validatePackageConfig(pkg, errors, warnings);
      }
    }

    // 3. Validate registries
    if (!config.registries || config.registries.length === 0) {
      warnings.push({ code: 'NO_REGISTRIES', message: 'No registries configured', severity: 'warning' });
    }

    // 4. Validate GitHub configuration
    if (config.github) {
      if (!config.github.owner || !config.github.repo) {
        errors.push({ code: 'INVALID_GITHUB', message: 'GitHub owner and repo are required', severity: 'error' });
      }
    }

    const result: ValidationResult = {
      success: errors.length === 0,
      warnings,
      errors,
    };

    if (!result.success) {
      this.logger.error('Configuration validation failed:', errors);
      throw new Error(`Configuration validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    if (warnings.length > 0) {
      this.logger.warn('Configuration validation warnings:', warnings);
    }

    return result;
  }

  /**
   * Validate a single package configuration
   */
  private async validatePackageConfig(
    pkg: PackageConfig, 
    errors: ValidationMessage[], 
    warnings: ValidationMessage[]
  ): Promise<void> {
    // Check required fields
    if (!pkg.name) {
      errors.push({ code: 'MISSING_PACKAGE_NAME', message: `Package name is required`, severity: 'error' });
    }

    if (!pkg.path) {
      errors.push({ code: 'MISSING_PACKAGE_PATH', message: `Package path is required for ${pkg.name}`, severity: 'error' });
    }

    // Check if package path exists
    if (pkg.path) {
      try {
        const stats = await fs.stat(pkg.path);
        if (!stats.isDirectory()) {
          errors.push({ code: 'INVALID_PACKAGE_PATH', message: `Package path is not a directory: ${pkg.path}`, severity: 'error' });
        }
      } catch (_error) {
        errors.push({ code: 'PACKAGE_PATH_NOT_FOUND', message: `Package path not found: ${pkg.path}`, severity: 'error' });
      }
    }

    // Check package.json exists
    if (pkg.path) {
      const packageJsonPath = path.join(pkg.path, 'package.json');
      try {
        await fs.access(packageJsonPath);
        
        // Add warning for packages without description
        try {
          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageJsonContent);
          if (!packageJson.description) {
            warnings.push({ code: 'MISSING_DESCRIPTION', message: `Package ${pkg.name} has no description`, severity: 'warning' });
          }
        } catch (_error) {
          // Ignore JSON parsing errors here - will be caught in main validation
        }
      } catch (_error) {
        errors.push({ code: 'PACKAGE_JSON_MISSING', message: `package.json not found at ${packageJsonPath}`, severity: 'error' });
      }
    }
  }

  /**
   * Verify environment requirements
   */
  private async verifyEnvironment(): Promise<void> {
    this.logger.log('Verifying environment requirements...');

    // Check required environment variables
    const requiredEnvVars = ['NODE_ENV'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      this.logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Check Node.js version
    const nodeVersion = process.version;
    this.logger.log(`Node.js version: ${nodeVersion}`);

    // Verify npm is available
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.logger.log(`npm version: ${npmVersion}`);
    } catch (_error) {
      throw new Error('npm is not available in the environment');
    }

    this.logger.log('Environment verification completed');
  }

  /**
   * Initialize publishers
   */
  private async initializePublishers(): Promise<void> {
    this.logger.log('Initializing publishers...');
    
    // Publishers will be initialized as they are implemented in subsequent subtasks
    // For now, we just log that this step is ready
    
    this.logger.log('Publisher initialization completed (publishers will be added in subsequent subtasks)');
  }

  /**
   * Prepare workspace
   */
  private async prepareWorkspace(): Promise<void> {
    this.logger.log('Preparing workspace...');

    // Create distribution output directory
    const distDir = path.join(process.cwd(), 'dist');
    try {
      await fs.mkdir(distDir, { recursive: true });
      this.logger.log(`Distribution directory created: ${distDir}`);
    } catch (_error) {
      // Directory might already exist, which is fine
    }

    this.logger.log('Workspace preparation completed');
  }

  /**
   * Prepare a single package
   */
  private async preparePackage(packageConfig: PackageConfig): Promise<PreparedPackage> {
    this.logger.log(`Preparing package: ${packageConfig.name}`);

    // 1. Read package.json
    const packageJsonPath = path.join(packageConfig.path, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    // 2. Update version if needed
    if (packageJson.version !== this.config.version) {
      packageJson.version = this.config.version;
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      this.logger.log(`Updated ${packageConfig.name} version to ${this.config.version}`);
    }

    // 3. Calculate package size
    const packageSize = await this.calculatePackageSize(packageConfig.path);

    // 4. Generate checksum
    const checksum = await this.generatePackageChecksum(packageConfig.path);

    // 5. Basic validation
    const validated = await this.validatePackageStructure(packageConfig);

    return {
      name: packageConfig.name,
      version: this.config.version,
      path: packageConfig.path,
      size: packageSize,
      checksum,
      validated,
    };
  }

  /**
   * Calculate package size
   */
  private async calculatePackageSize(packagePath: string): Promise<number> {
    // Simple implementation - get directory size
    try {
      const sizeOutput = execSync(`du -sb "${packagePath}"`, { encoding: 'utf8' });
      const sizeStr = sizeOutput.split('\t')[0];
      return parseInt(sizeStr || '1024', 10);
    } catch (_error) {
      // Fallback to a basic estimate
      return 1024; // Default size estimate
    }
  }

  /**
   * Generate package checksum
   */
  private async generatePackageChecksum(packagePath: string): Promise<string> {
    
    // For now, generate a simple hash based on package.json content
    const packageJsonPath = path.join(packagePath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf8');
    
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Validate package structure
   */
  private async validatePackageStructure(packageConfig: PackageConfig): Promise<boolean> {
    try {
      // Check required files exist
      const requiredFiles = ['package.json'];
      
      if (packageConfig.type === 'vscode-extension') {
        requiredFiles.push('README.md');
      }

      for (const file of requiredFiles) {
        const filePath = path.join(packageConfig.path, file);
        await fs.access(filePath);
      }

      return true;
    } catch (error) {
      this.logger.warn(`Package validation failed for ${packageConfig.name}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('DistributionManager not initialized. Call initialize() first.');
    }
  }
}

export default DistributionManager;