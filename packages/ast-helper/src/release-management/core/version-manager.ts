/**
 * Semantic Version Management Implementation
 * 
 * @fileoverview Implements semantic versioning with automatic version calculation,
 * validation, multi-package coordination, and channel-based versioning support.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

import { VersionManager } from '../interfaces.js';
import {
  VersioningConfig,
  ReleaseType,
  ReleaseChannel,
  ChangelogEntry
} from '../types.js';

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Semantic version management implementation
 */
export class VersionManagerImpl implements VersionManager {
  private config!: VersioningConfig;
  private initialized = false;

  /**
   * Initialize version manager with configuration
   */
  async initialize(config: VersioningConfig): Promise<void> {
    console.log('🔢 Initializing version manager...');
    
    // Validate configuration
    if (config.scheme !== 'semver') {
      throw new Error(`Unsupported versioning scheme: ${config.scheme}`);
    }
    
    if (config.initialVersion) {
      try {
        this.parseVersion(config.initialVersion);
      } catch (error) {
        throw new Error(`Invalid initial version format: ${config.initialVersion}`);
      }
    }
    
    this.config = config;
    this.initialized = true;
    
    console.log(`✅ Version manager initialized (scheme: ${config.scheme})`);
  }

  /**
   * Calculate next version based on changes and release type
   */
  async calculateNextVersion(currentVersion: string, type: ReleaseType, _changes?: ChangelogEntry[]): Promise<string> {
    this.ensureInitialized();
    
    console.log(`📈 Calculating next ${type} version from ${currentVersion}`);
    
    const parsed = this.parseVersion(currentVersion);
    
    switch (type) {
      case ReleaseType.MAJOR:
        return this.buildVersion(parsed.major + 1, 0, 0, undefined, parsed.build);
        
      case ReleaseType.MINOR:
        return this.buildVersion(parsed.major, parsed.minor + 1, 0, undefined, parsed.build);
        
      case ReleaseType.PATCH:
        return this.buildVersion(parsed.major, parsed.minor, parsed.patch + 1, undefined, parsed.build);
        
      case ReleaseType.PRERELEASE:
        if (parsed.prerelease) {
          const prereleaseNumber = this.extractPrereleaseNumber(parsed.prerelease);
          const prereleaseType = this.extractPrereleaseType(parsed.prerelease);
          return this.buildVersion(parsed.major, parsed.minor, parsed.patch, 
            `${prereleaseType}.${prereleaseNumber + 1}`, parsed.build);
        } else {
          // First prerelease for this version
          const prereleaseType = this.config.prereleasePattern || 'beta';
          return this.buildVersion(parsed.major, parsed.minor, parsed.patch + 1, 
            `${prereleaseType}.1`, parsed.build);
        }
        
      case ReleaseType.HOTFIX:
        // Hotfix is typically a patch on the previous major/minor
        return this.buildVersion(parsed.major, parsed.minor, parsed.patch + 1, undefined, parsed.build);
        
      default:
        throw new Error(`Unsupported release type: ${type}`);
    }
  }

  /**
   * Validate version format and type compatibility
   */
  async validateVersion(version: string, type: ReleaseType): Promise<boolean> {
    this.ensureInitialized();
    
    console.log(`🔍 Validating version: ${version} (${type})`);
    
    try {
      // Parse version to validate format
      const parsed = this.parseVersion(version);
      
      // Validate against scheme
      if (this.config.scheme === 'semver') {
        if (!this.isValidSemver(version)) {
          console.log(`❌ Version validation failed: ${version} - invalid semver format`);
          return false;
        }
      }

      // Validate type consistency (format only, not progression)
      switch (type) {
        case ReleaseType.PRERELEASE:
          if (!parsed.prerelease) {
            console.log(`❌ Version validation failed: ${version} - prerelease type requires prerelease identifier`);
            return false;
          }
          break;
          
        case ReleaseType.PATCH:
        case ReleaseType.MINOR:
        case ReleaseType.MAJOR:
          // For stable release types, prerelease identifiers should not be present
          if (parsed.prerelease) {
            console.log(`❌ Version validation failed: ${version} - stable release type should not have prerelease identifier`);
            return false;
          }
          break;
      }

      console.log(`✅ Version validation passed: ${version}`);
      return true;
      
    } catch (error) {
      console.log(`❌ Version validation failed: ${version} - invalid format`);
      return false;
    }
  }

  /**
   * Validate version progression against current version
   */
  async validateVersionProgression(version: string, type: ReleaseType): Promise<void> {
    this.ensureInitialized();
    
    console.log(`🔍 Validating version progression: ${version} (${type})`);
    
    try {
      // Parse version to validate format first
      const parsed = this.parseVersion(version);
      
      // Validate against scheme
      if (this.config.scheme === 'semver') {
        if (!this.isValidSemver(version)) {
          throw new Error(`Invalid semver format: ${version}`);
        }
      }
      
      // Validate type consistency and progression
      const currentVersion = await this.getCurrentVersion();
      const currentParsed = this.parseVersion(currentVersion);
      
      switch (type) {
        case ReleaseType.MAJOR:
          if (parsed.major <= currentParsed.major) {
            throw new Error(`Major version must be greater than current: ${parsed.major} <= ${currentParsed.major}`);
          }
          break;
          
        case ReleaseType.MINOR:
          if (parsed.major !== currentParsed.major || parsed.minor <= currentParsed.minor) {
            throw new Error(`Minor version must be greater than current minor: ${version} vs ${currentVersion}`);
          }
          break;
          
        case ReleaseType.PATCH:
          if (parsed.major !== currentParsed.major || parsed.minor !== currentParsed.minor || 
              parsed.patch <= currentParsed.patch) {
            throw new Error(`Patch version must be greater than current patch: ${version} vs ${currentVersion}`);
          }
          break;
          
        case ReleaseType.PRERELEASE:
          if (!parsed.prerelease) {
            throw new Error(`Prerelease version must include prerelease identifier: ${version}`);
          }
          break;
      }
      
      // Strict mode validations
      if (this.config.strictMode) {
        if (type === ReleaseType.MAJOR && parsed.minor !== 0) {
          throw new Error(`Major release must reset minor to 0 in strict mode: ${version}`);
        }
        if ((type === ReleaseType.MAJOR || type === ReleaseType.MINOR) && parsed.patch !== 0) {
          throw new Error(`Major/Minor release must reset patch to 0 in strict mode: ${version}`);
        }
      }
      
      console.log(`✅ Version progression validation passed: ${version}`);
      
    } catch (error) {
      console.error(`❌ Version progression validation failed: ${version} - ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get current version from repository
   */
  async getCurrentVersion(): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Try to get version from package.json first
      const packageJsonPath = join(process.cwd(), 'package.json');
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        if (packageJson.version) {
          return packageJson.version;
        }
      } catch (error) {
        // Package.json doesn't exist or is invalid, continue to git tags
      }
      
      // Fall back to git tags
      try {
        const gitCommand = 'git describe --tags --abbrev=0';
        const result = execSync(gitCommand, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const tag = result.trim();
        
        // Remove 'v' prefix if present
        return tag.startsWith('v') ? tag.slice(1) : tag;
      } catch (error) {
        // No git tags found, return initial version
        return this.config.initialVersion || '0.1.0';
      }
      
    } catch (error) {
      console.error('❌ Failed to get current version:', error);
      return this.config.initialVersion || '0.1.0';
    }
  }

  /**
   * Update version in package files
   */
  async updateVersion(version: string, packages: string[]): Promise<void> {
    this.ensureInitialized();
    
    console.log(`📝 Updating version to ${version} in ${packages.length} packages`);
    
    for (const packagePath of packages) {
      try {
        const packageJsonPath = join(packagePath, 'package.json');
        
        // Read existing package.json
        const packageJsonContent = await readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        
        // Update version
        packageJson.version = version;
        
        // Write updated package.json
        await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        
        console.log(`  ✅ Updated ${packageJsonPath}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to update ${packagePath}:`, error);
        throw new Error(`Failed to update version in ${packagePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log(`✅ Version updated successfully: ${version}`);
  }

  /**
   * Compare two versions (-1: v1 < v2, 0: v1 == v2, 1: v1 > v2)
   */
  compareVersions(version1: string, version2: string): number {
    this.ensureInitialized();
    
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);
    
    // Compare major
    if (v1.major !== v2.major) {
      return v1.major < v2.major ? -1 : 1;
    }
    
    // Compare minor
    if (v1.minor !== v2.minor) {
      return v1.minor < v2.minor ? -1 : 1;
    }
    
    // Compare patch
    if (v1.patch !== v2.patch) {
      return v1.patch < v2.patch ? -1 : 1;
    }
    
    // Compare prerelease
    if (v1.prerelease && v2.prerelease) {
      return v1.prerelease.localeCompare(v2.prerelease);
    }
    
    if (v1.prerelease && !v2.prerelease) {
      return -1; // prerelease < release
    }
    
    if (!v1.prerelease && v2.prerelease) {
      return 1; // release > prerelease
    }
    
    // Compare build metadata (typically ignored in semver)
    return 0;
  }

  /**
   * Check if version is prerelease
   */
  isPrerelease(version: string): boolean {
    this.ensureInitialized();
    
    try {
      const parsed = this.parseVersion(version);
      return Boolean(parsed.prerelease);
    } catch (error) {
      // Return false for malformed versions
      return false;
    }
  }

  /**
   * Get version channel from version string
   */
  getVersionChannel(version: string): ReleaseChannel {
    this.ensureInitialized();
    
    const parsed = this.parseVersion(version);
    
    if (!parsed.prerelease) {
      return ReleaseChannel.STABLE;
    }
    
    const prereleaseType = this.extractPrereleaseType(parsed.prerelease).toLowerCase();
    
    if (prereleaseType.includes('alpha')) {
      return ReleaseChannel.ALPHA;
    }
    
    if (prereleaseType.includes('beta')) {
      return ReleaseChannel.BETA;
    }
    
    if (prereleaseType.includes('nightly')) {
      return ReleaseChannel.NIGHTLY;
    }
    
    // Default to stable for unknown prerelease types
    return ReleaseChannel.STABLE;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('VersionManager not initialized. Call initialize() first.');
    }
  }

  private parseVersion(version: string): ParsedVersion {
    // Handle semver format: major.minor.patch[-prerelease][+build]
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
    const match = version.match(semverRegex);
    
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }
    
    return {
      major: parseInt(match[1]!, 10),
      minor: parseInt(match[2]!, 10),
      patch: parseInt(match[3]!, 10),
      prerelease: match[4] || undefined,
      build: match[5] || undefined,
      raw: version
    };
  }

  private buildVersion(major: number, minor: number, patch: number, prerelease?: string, build?: string): string {
    let version = `${major}.${minor}.${patch}`;
    
    if (prerelease) {
      version += `-${prerelease}`;
    }
    
    if (build) {
      version += `+${build}`;
    }
    
    return version;
  }

  private isValidSemver(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
    return semverRegex.test(version);
  }

  private extractPrereleaseNumber(prerelease: string): number {
    const match = prerelease.match(/\.(\d+)$/);
    return match ? parseInt(match[1]!, 10) : 0;
  }

  private extractPrereleaseType(prerelease: string): string {
    const match = prerelease.match(/^([a-zA-Z]+)/);
    return match ? match[1]! : 'beta';
  }
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}