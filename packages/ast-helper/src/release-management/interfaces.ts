/**
 * Core interfaces for the comprehensive release management system
 * 
 * @fileoverview Defines the main interfaces that must be implemented
 * by all release management components.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

import type {
  ReleaseConfig,
  ReleasePlan,
  ValidationResult,
  ReleaseResult,
  Changelog,
  CompatibilityReport,
  RollbackResult,
  ReleaseChannel,
  ReleaseType,
  ReleaseFilter,
  Release,
  ChangelogEntry
} from './types.js';

/**
 * Main interface for the comprehensive release management system
 */
export interface ReleaseManager {
  /**
   * Initialize the release manager with configuration
   */
  initialize(config: ReleaseConfig): Promise<void>;
  
  /**
   * Plan a release with specified version and type
   */
  planRelease(version: string, type: ReleaseType): Promise<ReleasePlan>;
  
  /**
   * Validate a release plan before execution
   */
  validateRelease(plan: ReleasePlan): Promise<ValidationResult>;
  
  /**
   * Execute a validated release plan
   */
  executeRelease(plan: ReleasePlan): Promise<ReleaseResult>;
  
  /**
   * Generate changelog between two versions
   */
  generateChangelog(fromVersion: string, toVersion: string): Promise<Changelog>;
  
  /**
   * Check backward compatibility between versions
   */
  checkBackwardCompatibility(newVersion: string, baseVersion: string): Promise<CompatibilityReport>;
  
  /**
   * Create release notes for a version
   */
  createReleaseNotes(version: string, changes: ChangelogEntry[]): Promise<import('./types.js').ReleaseNotes>;
  
  /**
   * Publish release to configured platforms
   */
  publishRelease(release: Release, platforms: import('./types.js').Platform[]): Promise<import('./types.js').PublishResult[]>;
  
  /**
   * Rollback a release with specified reason
   */
  rollbackRelease(version: string, reason: string): Promise<RollbackResult>;
  
  /**
   * Get the latest version for a release channel
   */
  getLatestVersion(channel: ReleaseChannel): Promise<string>;
  
  /**
   * List releases with optional filtering
   */
  listReleases(filter?: ReleaseFilter): Promise<Release[]>;
}

/**
 * Interface for semantic versioning management
 */
export interface VersionManager {
  /**
   * Initialize version manager with configuration
   */
  initialize(config: import('./types.js').VersioningConfig): Promise<void>;
  
  /**
   * Calculate next version based on changes
   */
  calculateNextVersion(currentVersion: string, type: ReleaseType, changes?: ChangelogEntry[]): Promise<string>;
  
  /**
   * Validate version format and type compatibility
   */
  validateVersion(version: string, type: ReleaseType): Promise<boolean>;
  
  /**
   * Validate version progression against current version (throws on invalid progression)
   */
  validateVersionProgression(version: string, type: ReleaseType): Promise<void>;
  
  /**
   * Get current version from repository
   */
  getCurrentVersion(): Promise<string>;
  
  /**
   * Update version in package files
   */
  updateVersion(version: string, packages: string[]): Promise<void>;
  
  /**
   * Compare two versions
   */
  compareVersions(version1: string, version2: string): number;
  
  /**
   * Check if version is prerelease
   */
  isPrerelease(version: string): boolean;
  
  /**
   * Get version channel from version string
   */
  getVersionChannel(version: string): ReleaseChannel;
}

/**
 * Interface for automated changelog generation
 */
export interface ChangelogGenerator {
  /**
   * Initialize changelog generator with configuration
   */
  initialize(config: import('./types.js').ChangelogConfig): Promise<void>;
  
  /**
   * Detect changes since a specific version
   */
  detectChangesSince(version: string): Promise<ChangelogEntry[]>;
  
  /**
   * Categorize changes by type and scope
   */
  categorizeChanges(commits: import('./types.js').Commit[]): Promise<ChangelogEntry[]>;
  
  /**
   * Generate changelog entries from categorized changes
   */
  generateEntries(changes: ChangelogEntry[]): Promise<ChangelogEntry[]>;
  
  /**
   * Format changelog content
   */
  formatChangelog(entries: ChangelogEntry[]): Promise<string>;
  
  /**
   * Parse commit messages for conventional commits
   */
  parseCommits(commits: string[]): Promise<ChangelogEntry[]>;
  
  /**
   * Generate release notes from changelog entries
   */
  generateReleaseNotes(version: string, entries: ChangelogEntry[]): Promise<import('./types.js').ReleaseNotes>;
}

/**
 * Interface for backward compatibility checking
 */
export interface CompatibilityChecker {
  /**
   * Initialize compatibility checker with configuration
   */
  initialize(config: import('./types.js').CompatibilityConfig): Promise<void>;
  
  /**
   * Check API compatibility between versions
   */
  checkApiCompatibility(baseVersion: string, newVersion: string): Promise<import('./types.js').CompatibilityCheck>;
  
  /**
   * Check configuration compatibility
   */
  checkConfigCompatibility(baseVersion: string, newVersion: string): Promise<import('./types.js').CompatibilityCheck>;
  
  /**
   * Check CLI compatibility
   */
  checkCliCompatibility(baseVersion: string, newVersion: string): Promise<import('./types.js').CompatibilityCheck>;
  
  /**
   * Check data format compatibility
   */
  checkDataFormatCompatibility(baseVersion: string, newVersion: string): Promise<import('./types.js').CompatibilityCheck>;
  
  /**
   * Find breaking changes between versions
   */
  findBreakingChanges(baseVersion: string, newVersion: string): Promise<import('./types.js').BreakingChange[]>;
  
  /**
   * Generate migration guide for breaking changes
   */
  generateMigrationGuide(baseVersion: string, newVersion: string): Promise<import('./types.js').MigrationGuide>;
}

/**
 * Interface for multi-platform publishing
 */
export interface PlatformPublisher {
  /**
   * Initialize platform publisher with configurations
   */
  initialize(platforms: import('./types.js').PlatformConfig[]): Promise<void>;
  
  /**
   * Publish to a specific platform
   */
  publishToPlatform(platform: string, version: string, artifacts: import('./types.js').ReleaseArtifact[]): Promise<import('./types.js').PublishResult>;
  
  /**
   * Publish to multiple platforms in parallel
   */
  publishToMultiplePlatforms(platforms: string[], version: string, artifacts: import('./types.js').ReleaseArtifact[]): Promise<import('./types.js').PublishResult[]>;
  
  /**
   * Validate platform requirements
   */
  validatePlatformRequirements(platform: string): Promise<boolean>;
  
  /**
   * Get platform-specific metadata
   */
  getPlatformMetadata(platform: string, version: string): Promise<Record<string, any>>;
  
  /**
   * Build platform-specific artifacts
   */
  buildArtifacts(platform: string, version: string): Promise<import('./types.js').ReleaseArtifact[]>;
}

/**
 * Interface for rollback and recovery management
 */
export interface RollbackManager {
  /**
   * Initialize rollback manager with configuration
   */
  initialize(config: import('./types.js').RollbackConfig): Promise<void>;
  
  /**
   * Create rollback plan for a version
   */
  createRollbackPlan(version: string, targetVersion: string): Promise<import('./types.js').RollbackPlan>;
  
  /**
   * Get existing rollback plan for a version
   */
  getRollbackPlan(version: string): Promise<import('./types.js').RollbackPlan | null>;
  
  /**
   * Execute rollback plan
   */
  executeRollback(plan: import('./types.js').RollbackPlan, reason: string): Promise<import('./types.js').RollbackStepResult[]>;
  
  /**
   * Validate rollback feasibility
   */
  validateRollback(version: string): Promise<boolean>;
  
  /**
   * Create backup before release
   */
  createBackup(version: string): Promise<string>;
  
  /**
   * Restore from backup
   */
  restoreFromBackup(backupId: string): Promise<void>;
}

/**
 * Interface for release analytics and monitoring
 */
export interface ReleaseAnalytics {
  /**
   * Initialize analytics with configuration
   */
  initialize(config: Record<string, any>): Promise<void>;
  
  /**
   * Track release metrics
   */
  trackRelease(release: Release, result: ReleaseResult): Promise<void>;
  
  /**
   * Get release statistics
   */
  getReleaseStatistics(version: string): Promise<import('./types.js').ReleaseStatistics>;
  
  /**
   * Get deployment metrics
   */
  getDeploymentMetrics(dateFrom: Date, dateTo: Date): Promise<Record<string, any>>;
  
  /**
   * Monitor release health
   */
  monitorReleaseHealth(version: string): Promise<Record<string, any>>;
}

// Helper types for interface implementations
declare module './types.js' {
  interface Platform {
    name: string;
    config: Record<string, any>;
  }
  
  interface Commit {
    hash: string;
    message: string;
    author: string;
    date: Date;
    files: string[];
  }
}