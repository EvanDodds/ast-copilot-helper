/**
 * Type definitions for the comprehensive release management system
 * 
 * @fileoverview Core types and interfaces for semantic versioning, 
 * release workflows, compatibility checking, and multi-platform publishing.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

// Core release management types
export enum ReleaseType {
  MAJOR = 'major',
  MINOR = 'minor', 
  PATCH = 'patch',
  PRERELEASE = 'prerelease',
  HOTFIX = 'hotfix'
}

export enum ReleaseChannel {
  STABLE = 'stable',
  BETA = 'beta',
  ALPHA = 'alpha',
  NIGHTLY = 'nightly'
}

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum SuggestionActionType {
  CODE_CHANGE = 'code-change',
  FILE_CREATE = 'file-create', 
  FILE_DELETE = 'file-delete',
  COMMAND_RUN = 'command-run',
  CONFIG_UPDATE = 'config-update',
  INSTALL_PACKAGE = 'install-package'
}

export enum SuggestionType {
  QUICK_FIX = 'quick-fix',
  REFACTOR = 'refactor',
  ENHANCEMENT = 'enhancement',
  DOCUMENTATION = 'documentation'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Configuration interfaces
export interface ReleaseConfig {
  repository: RepositoryConfig;
  versioning: VersioningConfig;
  changelog: ChangelogConfig;
  platforms: PlatformConfig[];
  compatibility: CompatibilityConfig;
  automation: AutomationConfig;
  notifications: NotificationConfig;
  rollback: RollbackConfig;
}

export interface RepositoryConfig {
  owner: string;
  name: string;
  defaultBranch: string;
  releaseBranches: string[];
  protectedBranches: string[];
  monorepo: boolean;
  workspaces?: string[];
}

export interface VersioningConfig {
  scheme: 'semver' | 'calver' | 'custom';
  initialVersion: string;
  prereleasePattern?: string;
  channels: VersionChannel[];
  allowPrereleasePromotion: boolean;
  strictMode: boolean;
}

export interface VersionChannel {
  name: ReleaseChannel;
  pattern: string;
  autoPublish: boolean;
  requiresApproval: boolean;
}

export interface ChangelogConfig {
  format: 'keepachangelog' | 'conventional' | 'custom';
  sections: ChangelogSection[];
  includeCommitLinks: boolean;
  includeAuthor: boolean;
  excludeTypes: string[];
  customTemplate?: string;
}

export interface ChangelogSection {
  title: string;
  types: string[];
  scope?: string;
}

export interface PlatformConfig {
  name: 'npm' | 'vscode-marketplace' | 'github-releases' | 'docker' | 'custom';
  enabled: boolean;
  config: Record<string, any>;
  requirements: string[];
  artifacts: string[];
}

export interface CompatibilityConfig {
  checkApi: boolean;
  checkConfig: boolean;
  checkCli: boolean;
  checkData: boolean;
  breakingChangeThreshold: number;
  generateMigrationGuides: boolean;
  baseVersions: string[];
}

export interface AutomationConfig {
  autoRollbackOnFailure: boolean;
  allowWarnings: boolean;
  requireApproval: boolean;
  parallelBuilds: boolean;
  timeoutMinutes: number;
  retryAttempts: number;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  templates: NotificationTemplate[];
  includeMetrics: boolean;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook';
  config: Record<string, any>;
  events: string[];
}

export interface NotificationTemplate {
  event: string;
  title: string;
  body: string;
  variables: string[];
}

export interface RollbackConfig {
  enabled: boolean;
  automaticTriggers: string[];
  manualApprovalRequired: boolean;
  backupRetention: number; // days
  validationSteps: string[];
}

// Release planning and execution
export interface ReleasePlan {
  version: string;
  type: ReleaseType;
  previousVersion: string;
  timestamp: Date;
  branch: string;
  packages: PackageRelease[];
  changes: ChangelogEntry[];
  breakingChanges: BreakingChange[];
  dependencies: DependencyUpdate[];
  platforms: PlatformRelease[];
  validations: ValidationStep[];
  rollbackPlan: RollbackPlan;
  estimatedDuration: number; // minutes
}

export interface PackageRelease {
  name: string;
  currentVersion: string;
  targetVersion: string;
  changes: ChangelogEntry[];
  dependencies: PackageDependency[];
  platforms: string[];
  buildRequired: boolean;
  testRequired: boolean;
}

export interface PackageDependency {
  name: string;
  currentVersion: string;
  targetVersion?: string;
  type: 'dependencies' | 'devDependencies' | 'peerDependencies';
}

export interface ChangelogEntry {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  author?: string;
  commit?: string;
  pullRequest?: number;
  issues?: number[];
  timestamp: Date;
  affectedPackages: string[];
}

export interface BreakingChange {
  description: string;
  migration: string;
  affectedApi: string[];
  severity: 'minor' | 'major' | 'critical';
  automatedMigration: boolean;
}

export interface DependencyUpdate {
  name: string;
  from: string;
  to: string;
  type: 'patch' | 'minor' | 'major';
  breaking: boolean;
  securityFix: boolean;
}

export interface PlatformRelease {
  platform: string;
  version: string;
  artifacts: ReleaseArtifact[];
  metadata: Record<string, any>;
  requirements: ValidationStep[];
}

export interface ReleaseArtifact {
  name: string;
  path: string;
  size: number;
  checksum: string;
  platform?: string;
  architecture?: string;
}

export interface ValidationStep {
  name: string;
  description: string;
  required: boolean;
  timeout: number; // seconds
  command?: string;
  script?: string;
  dependencies: string[];
}

export interface RollbackPlan {
  targetVersion: string;
  steps: RollbackStep[];
  validations: ValidationStep[];
  estimatedDuration: number; // minutes
  risks: RollbackRisk[];
}

export interface RollbackStep {
  name: string;
  description: string;
  type: 'git' | 'package' | 'database' | 'config' | 'custom';
  command?: string;
  script?: string;
  validation?: string;
  required: boolean;
}

export interface RollbackRisk {
  description: string;
  severity: RiskLevel;
  mitigation: string;
  likelihood: 'low' | 'medium' | 'high';
}

// Validation and results
export interface ValidationResult {
  success: boolean;
  steps: ValidationStepResult[];
  warnings: ValidationStepResult[];
  errors: ValidationStepResult[];
  duration: number; // milliseconds
  canProceed: boolean;
}

export interface ValidationStepResult {
  stepName: string;
  success: boolean;
  severity: ValidationSeverity;
  message: string;
  details?: string;
  duration: number; // milliseconds
}

export interface ReleaseResult {
  success: boolean;
  version: string;
  duration: number; // milliseconds
  message: string;
  artifacts?: ReleaseArtifact[];
  publishResults?: PublishResult[];
  releaseNotes?: ReleaseNotes;
  changelog?: Changelog;
  rollbackAvailable: boolean;
  error?: string;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  version: string;
  url?: string;
  message?: string;
  error?: string;
  artifacts: ReleaseArtifact[];
}

// Changelog and documentation
export interface Changelog {
  version: string;
  date: Date;
  entries: ChangelogEntry[];
  breakingChanges: ChangelogEntry[];
  newFeatures: ChangelogEntry[];
  bugFixes: ChangelogEntry[];
  improvements: ChangelogEntry[];
  rawContent: string;
}

export interface ReleaseNotes {
  version: string;
  title: string;
  description: string;
  date: Date;
  highlights: string[];
  breakingChanges: string[];
  knownIssues: string[];
  migrationGuide?: string;
  downloadLinks: DownloadLink[];
  acknowledgments: string[];
}

export interface DownloadLink {
  platform: string;
  architecture?: string;
  url: string;
  checksum: string;
  size: number;
}

// Compatibility checking
export interface CompatibilityReport {
  baseVersion: string;
  newVersion: string;
  compatible: boolean;
  checks: {
    api: CompatibilityCheck;
    config: CompatibilityCheck;
    cli: CompatibilityCheck;
    data: CompatibilityCheck;
  };
  breakingChanges: BreakingChange[];
  migrationRequired: boolean;
  migrationGuide?: MigrationGuide;
}

export interface CompatibilityCheck {
  compatible: boolean;
  breakingChanges: BreakingChange[];
  migrationRequired: boolean;
  confidence: number; // 0-1
  details: string[];
}

export interface MigrationGuide {
  version: string;
  title: string;
  description: string;
  steps: MigrationStep[];
  estimatedTime: number; // minutes
  riskLevel: RiskLevel;
  prerequisites: string[];
}

export interface MigrationStep {
  title: string;
  description: string;
  type: 'manual' | 'automated' | 'review';
  actions: MigrationAction[];
  validation: string;
  rollback?: string;
}

export interface MigrationAction {
  type: SuggestionActionType;
  description: string;
  command?: string;
  code?: string;
  file?: string;
  automated: boolean;
  riskLevel: RiskLevel;
}

// Rollback management
export interface RollbackResult {
  success: boolean;
  rolledBackVersion: string;
  targetVersion?: string;
  duration: number; // milliseconds
  steps?: RollbackStepResult[];
  reason: string;
  message: string;
  error?: string;
}

export interface RollbackStepResult {
  stepName: string;
  success: boolean;
  message: string;
  duration: number; // milliseconds
  error?: string;
}

// Filters and queries
export interface ReleaseFilter {
  channel?: ReleaseChannel;
  type?: ReleaseType;
  dateFrom?: Date;
  dateTo?: Date;
  includePrerelease?: boolean;
  tags?: string[];
}

export interface Release {
  version: string;
  type: ReleaseType;
  channel: ReleaseChannel;
  date: Date;
  notes: ReleaseNotes;
  artifacts: ReleaseArtifact[];
  statistics: ReleaseStatistics;
}

export interface ReleaseStatistics {
  downloads: number;
  duration: number; // milliseconds
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  contributors: number;
}