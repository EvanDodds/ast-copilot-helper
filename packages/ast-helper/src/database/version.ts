/**
 * Database Version Manager
 * Handles version tracking, compatibility checking, and migration planning for AST database
 */

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { FileSystemManager } from '../filesystem/manager.js';
import { createLogger } from '../logging/index.js';
import { ConfigurationErrors, DatabaseErrors } from '../errors/factories.js';
import type { VersionInfo, InitOptions } from './types.js';

/**
 * Current database schema version
 * Update this when making breaking changes to the database structure
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Minimum tool version required for this database schema
 */
export const MIN_TOOL_VERSION = '0.1.0';

/**
 * Database Version Manager class
 * Manages database version information and compatibility checking
 */
export class DatabaseVersionManager {
  private fs: FileSystemManager;
  private logger = createLogger();
  
  constructor() {
    this.fs = new FileSystemManager();
  }
  
  /**
   * Get current tool version from package.json
   */
  getToolVersion(): string {
    try {
      // Try to read from package.json
      const packagePath = join(process.cwd(), 'package.json');
      const fs = require('fs');
      
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return packageJson.version || '0.1.0';
      }
      
      // Fallback - try to find package.json in parent directories
      return this.findVersionFromParentDirs() || '0.1.0';
    } catch (error) {
      this.logger.warn('Could not determine tool version', { 
        error: (error as Error).message 
      });
      return '0.1.0';
    }
  }
  
  /**
   * Create default version information
   */
  createDefaultVersionInfo(): VersionInfo {
    const now = new Date().toISOString();
    const toolVersion = this.getToolVersion();
    
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      toolVersion,
      created: now,
      compatibility: {
        minToolVersion: MIN_TOOL_VERSION,
        migrations: []
      }
    };
  }
  
  /**
   * Create version file in the database directory
   */
  async createVersionFile(
    astdbPath: string,
    options: InitOptions = {}
  ): Promise<void> {
    const { verbose = false, dryRun = false } = options;
    const versionPath = join(astdbPath, 'version.json');
    
    if (verbose) {
      console.log('  Creating version file: version.json');
    }
    
    // Create version information
    const versionInfo = this.createDefaultVersionInfo();
    
    if (!dryRun) {
      try {
        const versionJson = JSON.stringify(versionInfo, null, 2);
        await this.fs.atomicWriteFile(versionPath, versionJson, {
          encoding: 'utf8',
          mode: 0o644
        });
        
        this.logger.debug('Created version file', { 
          path: versionPath,
          schemaVersion: versionInfo.schemaVersion,
          toolVersion: versionInfo.toolVersion
        });
      } catch (error) {
        throw ConfigurationErrors.loadFailed(
          'Failed to create version file',
          error as Error
        );
      }
    }
    
    if (verbose) {
      console.log(`    Schema version: ${versionInfo.schemaVersion}`);
      console.log(`    Tool version: ${versionInfo.toolVersion}`);
      console.log('    ✅ Version file created successfully');
    }
  }
  
  /**
   * Load version information from file
   */
  async loadVersionInfo(astdbPath: string): Promise<VersionInfo> {
    const versionPath = join(astdbPath, 'version.json');
    
    if (!await this.fs.exists(versionPath)) {
      throw ConfigurationErrors.fileNotAccessible(
        versionPath,
        'Version file does not exist'
      );
    }
    
    try {
      const versionContent = await readFile(versionPath, 'utf8');
      const versionInfo = JSON.parse(versionContent);
      
      // Validate version information structure
      this.validateVersionInfo(versionInfo);
      
      return versionInfo;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw ConfigurationErrors.loadFailed(
          'Invalid JSON in version file',
          error
        );
      }
      throw error;
    }
  }
  
  /**
   * Save version information to file
   */
  async saveVersionInfo(astdbPath: string, versionInfo: VersionInfo): Promise<void> {
    const versionPath = join(astdbPath, 'version.json');
    
    // Validate before saving
    this.validateVersionInfo(versionInfo);
    
    try {
      const versionJson = JSON.stringify(versionInfo, null, 2);
      await this.fs.atomicWriteFile(versionPath, versionJson, {
        encoding: 'utf8',
        mode: 0o644
      });
      
      this.logger.debug('Saved version file', { 
        path: versionPath,
        schemaVersion: versionInfo.schemaVersion,
        toolVersion: versionInfo.toolVersion
      });
    } catch (error) {
      throw ConfigurationErrors.loadFailed(
        'Failed to save version file',
        error as Error
      );
    }
  }
  
  /**
   * Check if database version is compatible with current tool
   */
  async validateVersionCompatibility(astdbPath: string): Promise<void> {
    const versionInfo = await this.loadVersionInfo(astdbPath);
    const currentToolVersion = this.getToolVersion();
    
    // Check if current tool version is compatible with database
    if (!this.isVersionCompatible(currentToolVersion, versionInfo.compatibility.minToolVersion)) {
      throw DatabaseErrors.versionMismatch(
        currentToolVersion,
        versionInfo.compatibility.minToolVersion,
        astdbPath
      );
    }
    
    // Check if database schema is compatible with current tool
    const currentSchemaVersion = CURRENT_SCHEMA_VERSION;
    if (!this.isVersionCompatible(versionInfo.schemaVersion, currentSchemaVersion)) {
      // Database is newer than current tool
      if (this.compareVersions(versionInfo.schemaVersion, currentSchemaVersion) > 0) {
        throw DatabaseErrors.versionMismatch(
          versionInfo.schemaVersion,
          `<= ${currentSchemaVersion}`,
          astdbPath
        );
      }
      
      // Database is older - might need migration (future feature)
      this.logger.warn('Database schema version is older than current', {
        dbVersion: versionInfo.schemaVersion,
        currentVersion: currentSchemaVersion,
        path: astdbPath
      });
    }
  }
  
  /**
   * Update version information after migration or tool upgrade
   */
  async updateVersionInfo(
    astdbPath: string,
    migrationId?: string
  ): Promise<void> {
    const versionInfo = await this.loadVersionInfo(astdbPath);
    const now = new Date().toISOString();
    
    // Update tool version and migration timestamp
    versionInfo.toolVersion = this.getToolVersion();
    versionInfo.lastMigrated = now;
    
    // Add migration to history if provided
    if (migrationId && !versionInfo.compatibility.migrations.includes(migrationId)) {
      versionInfo.compatibility.migrations.push(migrationId);
    }
    
    await this.saveVersionInfo(astdbPath, versionInfo);
    
    this.logger.info('Updated version information', {
      schemaVersion: versionInfo.schemaVersion,
      toolVersion: versionInfo.toolVersion,
      migrationId,
      path: astdbPath
    });
  }
  
  /**
   * Plan database migration (future feature)
   */
  async planMigration(astdbPath: string): Promise<string[]> {
    const versionInfo = await this.loadVersionInfo(astdbPath);
    const currentSchemaVersion = CURRENT_SCHEMA_VERSION;
    
    // If versions match, no migration needed
    if (versionInfo.schemaVersion === currentSchemaVersion) {
      return [];
    }
    
    // Plan migrations based on version differences
    const migrationPlan: string[] = [];
    
    // This is a placeholder for future migration logic
    // In a real implementation, you would analyze version differences
    // and return a list of migration steps needed
    
    const comparison = this.compareVersions(versionInfo.schemaVersion, currentSchemaVersion);
    
    if (comparison < 0) {
      // Database is older - upgrade needed
      migrationPlan.push(`upgrade-from-${versionInfo.schemaVersion}-to-${currentSchemaVersion}`);
    } else if (comparison > 0) {
      // Database is newer - downgrade needed (rarely supported)
      migrationPlan.push(`downgrade-from-${versionInfo.schemaVersion}-to-${currentSchemaVersion}`);
    }
    
    return migrationPlan;
  }
  
  /**
   * Get database age information
   */
  async getDatabaseAge(astdbPath: string): Promise<{ 
    ageInDays: number; 
    created: Date; 
    lastMigrated?: Date;
  }> {
    const versionInfo = await this.loadVersionInfo(astdbPath);
    const created = new Date(versionInfo.created);
    const lastMigrated = versionInfo.lastMigrated ? new Date(versionInfo.lastMigrated) : undefined;
    const now = new Date();
    
    const ageInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      ageInDays,
      created,
      lastMigrated
    };
  }
  
  /**
   * Validate version information structure
   */
  private validateVersionInfo(versionInfo: any): void {
    const errors: string[] = [];
    
    // Check required string fields
    const requiredStringFields = ['schemaVersion', 'toolVersion', 'created'];
    for (const field of requiredStringFields) {
      if (typeof versionInfo[field] !== 'string' || versionInfo[field].trim() === '') {
        errors.push(`Field '${field}' must be a non-empty string`);
      }
    }
    
    // Validate semver format
    if (versionInfo.schemaVersion && !this.isValidSemver(versionInfo.schemaVersion)) {
      errors.push("schemaVersion must be in semver format (e.g., '1.0.0')");
    }
    
    if (versionInfo.toolVersion && !this.isValidSemver(versionInfo.toolVersion)) {
      errors.push("toolVersion must be in semver format (e.g., '1.0.0')");
    }
    
    // Validate timestamps
    if (versionInfo.created && isNaN(new Date(versionInfo.created).getTime())) {
      errors.push('created must be a valid ISO timestamp');
    }
    
    if (versionInfo.lastMigrated && isNaN(new Date(versionInfo.lastMigrated).getTime())) {
      errors.push('lastMigrated must be a valid ISO timestamp');
    }
    
    // Validate compatibility object
    if (typeof versionInfo.compatibility !== 'object' || versionInfo.compatibility === null) {
      errors.push("Field 'compatibility' must be an object");
    } else {
      const comp = versionInfo.compatibility;
      
      if (typeof comp.minToolVersion !== 'string' || comp.minToolVersion.trim() === '') {
        errors.push("compatibility.minToolVersion must be a non-empty string");
      } else if (!this.isValidSemver(comp.minToolVersion)) {
        errors.push("compatibility.minToolVersion must be in semver format");
      }
      
      if (!Array.isArray(comp.migrations)) {
        errors.push("compatibility.migrations must be an array");
      } else if (!comp.migrations.every((m: any) => typeof m === 'string')) {
        errors.push("All items in compatibility.migrations must be strings");
      }
    }
    
    // Throw error if validation failed
    if (errors.length > 0) {
      throw new Error(`Invalid version information: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Check if a version string is valid semver format
   */
  private isValidSemver(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
  }
  
  /**
   * Check if version1 is compatible with (greater than or equal to) version2
   */
  private isVersionCompatible(version1: string, version2: string): boolean {
    return this.compareVersions(version1, version2) >= 0;
  }
  
  /**
   * Compare two semver version strings
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parseVersion = (v: string) => {
      const versionPart = v.split('-')[0];
      if (!versionPart) return { major: 0, minor: 0, patch: 0 };
      
      const parts = versionPart.split('.').map(Number);
      return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
    };
    
    const version1 = parseVersion(v1);
    const version2 = parseVersion(v2);
    
    if (version1.major !== version2.major) {
      return version1.major - version2.major;
    }
    
    if (version1.minor !== version2.minor) {
      return version1.minor - version2.minor;
    }
    
    return version1.patch - version2.patch;
  }
  
  /**
   * Find version from parent directories' package.json files
   */
  private findVersionFromParentDirs(): string | null {
    let currentDir = process.cwd();
    const root = require('path').parse(currentDir).root;
    
    while (currentDir !== root) {
      try {
        const packagePath = join(currentDir, 'package.json');
        const fs = require('fs');
        
        if (fs.existsSync(packagePath)) {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          if (packageJson.version) {
            return packageJson.version;
          }
        }
        
        currentDir = require('path').dirname(currentDir);
      } catch (error) {
        // Continue searching in parent directories
      }
    }
    
    return null;
  }
}