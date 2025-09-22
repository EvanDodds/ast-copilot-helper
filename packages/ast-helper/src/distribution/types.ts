/**
 * Distribution system types and interfaces
 * Defines the core types for package distribution and marketplace publishing
 */

export type Platform = 'win32' | 'darwin' | 'linux';
export type PackageType = 'npm' | 'vscode-extension' | 'binary';
export type RegistryType = 'npm' | 'vscode-marketplace' | 'github';
export type ReleaseChannel = 'stable' | 'beta' | 'alpha';

/**
 * Main distribution manager interface
 */
export interface DistributionManager {
  initialize(config: DistributionConfig): Promise<void>;
  preparePackages(): Promise<PackagePreparation>;
  publishToNPM(): Promise<NPMPublishResult>;
  publishToVSCodeMarketplace(): Promise<MarketplacePublishResult>;
  createGitHubRelease(): Promise<GitHubReleaseResult>;
  distributeBinaries(): Promise<BinaryDistributionResult>;
  setupAutoUpdates(): Promise<AutoUpdateConfig>;
  generateDocumentation(): Promise<DocumentationResult>;
}

/**
 * Distribution configuration
 */
export interface DistributionConfig {
  version: string;
  packages: PackageConfig[];
  registries: RegistryConfig[];
  platforms: Platform[];
  releaseNotes: string;
  marketplaces: MarketplaceConfig[];
  binaryDistribution: BinaryConfig;
  autoUpdate: AutoUpdateConfig;
  github: GitHubConfig;
  security: SecurityConfig;
}

/**
 * Package configuration
 */
export interface PackageConfig {
  name: string;
  type: PackageType;
  path: string;
  publishConfig: PublishConfig;
  dependencies?: string[];
  platforms?: Platform[];
  metadata: PackageMetadata;
}

/**
 * Publishing configuration
 */
export interface PublishConfig {
  registry: string;
  access: 'public' | 'private';
  tag: string;
  prerelease: boolean;
  files: string[];
  scripts: Record<string, string>;
}

/**
 * Package metadata
 */
export interface PackageMetadata {
  displayName: string;
  description: string;
  keywords: string[];
  license: string;
  author: string;
  repository: string;
  homepage?: string;
  bugs?: string;
  icon?: string;
  categories?: string[];
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  type: RegistryType;
  url: string;
  token?: string;
  scope?: string;
  credentials?: Record<string, string>;
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  type: 'vscode-marketplace' | 'openvsx';
  publisherId?: string; // Required for VS Code Marketplace
  token: string;
  categories?: string[];
  badges?: string[];
  url?: string; // Optional URL override
}

/**
 * Binary distribution configuration
 */
export interface BinaryConfig {
  enabled: boolean;
  platforms: Platform[];
  signing: SigningConfig;
  packaging: PackagingConfig;
  distribution: DistributionChannelConfig;
}

/**
 * Signing configuration
 */
export interface SigningConfig {
  enabled: boolean;
  certificate?: string;
  keychain?: string;
  notarization?: NotarizationConfig;
}

/**
 * Notarization configuration for macOS
 */
export interface NotarizationConfig {
  appleId: string;
  password: string;
  teamId: string;
}

/**
 * Packaging configuration
 */
export interface PackagingConfig {
  formats: PackageFormat[];
  compression: 'gzip' | 'zip' | 'none';
  includeAssets: boolean;
}

export type PackageFormat = 'tar.gz' | 'zip' | 'msi' | 'pkg' | 'deb' | 'rpm';

/**
 * Distribution channel configuration
 */
export interface DistributionChannelConfig {
  channels: ReleaseChannel[];
  defaultChannel: ReleaseChannel;
  promotion: PromotionConfig;
}

/**
 * Promotion configuration between channels
 */
export interface PromotionConfig {
  automatic: boolean;
  rules: PromotionRule[];
}

/**
 * Promotion rule
 */
export interface PromotionRule {
  from: ReleaseChannel;
  to: ReleaseChannel;
  criteria: PromotionCriteria;
}

/**
 * Promotion criteria
 */
export interface PromotionCriteria {
  minDays: number;
  maxBugs: number;
  minDownloads?: number;
  approvals?: string[];
}

/**
 * Auto-update configuration
 */
export interface AutoUpdateConfig {
  enabled: boolean;
  server: UpdateServerConfig;
  client: UpdateClientConfig;
  rollback: RollbackConfig;
}

/**
 * Update server configuration
 */
export interface UpdateServerConfig {
  url: string;
  auth?: UpdateAuthConfig;
  channels: ReleaseChannel[];
  checkInterval: number;
}

/**
 * Update client configuration
 */
export interface UpdateClientConfig {
  checkInterval: number;
  downloadTimeout: number;
  retryAttempts: number;
  backgroundDownload: boolean;
  userPrompt: boolean;
}

/**
 * Update authentication configuration
 */
export interface UpdateAuthConfig {
  type: 'token' | 'signature';
  key: string;
  algorithm?: string;
}

/**
 * Rollback configuration
 */
export interface RollbackConfig {
  enabled: boolean;
  maxVersions: number;
  autoRollback: boolean;
  rollbackTriggers: RollbackTrigger[];
}

/**
 * Rollback trigger
 */
export interface RollbackTrigger {
  type: 'crash' | 'error-rate' | 'user-report';
  threshold: number;
  timeWindow: number;
}

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  releaseNotes: ReleaseNotesConfig;
}

/**
 * Release notes configuration
 */
export interface ReleaseNotesConfig {
  generate: boolean;
  template?: string;
  sections: ReleaseNotesSection[];
  commitTypes: CommitTypeMapping[];
}

/**
 * Release notes section
 */
export interface ReleaseNotesSection {
  title: string;
  commitTypes: string[];
  order: number;
}

/**
 * Commit type mapping
 */
export interface CommitTypeMapping {
  type: string;
  section: string;
  emoji?: string;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  signing: boolean;
  verification: VerificationConfig;
  vulnerability: VulnerabilityConfig;
}

/**
 * Verification configuration
 */
export interface VerificationConfig {
  checksums: boolean;
  signatures: boolean;
  certificates: boolean;
}

/**
 * Vulnerability configuration
 */
export interface VulnerabilityConfig {
  scanning: boolean;
  reporting: boolean;
  blocking: boolean;
}

// Result types

/**
 * Package preparation result
 */
export interface PackagePreparation {
  success: boolean;
  packages: PreparedPackage[];
  duration: number;
  warnings: string[];
  errors: string[];
}

/**
 * Prepared package
 */
export interface PreparedPackage {
  name: string;
  version: string;
  path: string;
  size: number;
  checksum: string;
  validated: boolean;
}

/**
 * NPM publish result
 */
export interface NPMPublishResult {
  success: boolean;
  packages: PackagePublishResult[];
  duration: number;
  registry: string;
  version: string;
  error?: string;
}

/**
 * Package publish result
 */
export interface PackagePublishResult {
  success: boolean;
  packageName: string;
  version: string;
  registry: string;
  duration: number;
  publishOutput?: string;
  verification?: PublicationVerification;
  error?: string;
}

/**
 * Publication verification
 */
export interface PublicationVerification {
  packageExists: boolean;
  versionExists: boolean;
  metadataCorrect: boolean;
  installationWorks: boolean;
  downloadUrl?: string;
  publishTime?: Date;
  error?: string;
}

/**
 * Marketplace publish result
 */
export interface MarketplacePublishResult {
  success: boolean;
  extensions: ExtensionPublishResult[];
  duration: number;
  marketplace: string;
  version: string;
  error?: string;
}

/**
 * Extension publish result
 */
export interface ExtensionPublishResult {
  success: boolean;
  extensionName: string;
  version: string;
  marketplace: string;
  duration: number;
  publishOutput?: any;
  verification?: ExtensionVerification;
  error?: string;
}

/**
 * Extension verification
 */
export interface ExtensionVerification {
  extensionExists: boolean;
  versionCorrect: boolean;
  metadataCorrect: boolean;
  installationWorks: boolean;
  marketplaceUrl?: string;
  publishTime?: Date;
  error?: string;
}

/**
 * GitHub release result
 */
export interface GitHubReleaseResult {
  success: boolean;
  releaseId: number | null;
  releaseUrl: string | null;
  tagName: string;
  assets: AssetUploadResult[];
  duration: number;
  error?: string;
}

/**
 * Asset upload result
 */
export interface AssetUploadResult {
  success: boolean;
  assetName: string;
  assetUrl?: string;
  size: number;
  contentType: string;
  checksum: string;
  error?: string;
}

/**
 * Release asset
 */
export interface ReleaseAsset {
  name: string;
  path: string;
  contentType: string;
}

/**
 * Binary distribution result
 */
export interface BinaryDistributionResult {
  success: boolean;
  binaries: BinaryBuildResult[];
  duration: number;
  platforms: Platform[];
  error?: string;
}

/**
 * Binary build result
 */
export interface BinaryBuildResult {
  success: boolean;
  platform: Platform;
  architecture: string;
  binaryPath: string;
  packagePath?: string;
  signed: boolean;
  verified: boolean;
  size: number;
  checksum: string;
  error?: string;
}

/**
 * Documentation result
 */
export interface DocumentationResult {
  success: boolean;
  documents: DocumentGeneration[];
  duration: number;
  formats: string[];
  error?: string;
}

/**
 * Document generation result
 */
export interface DocumentGeneration {
  success: boolean;
  type: string;
  path: string;
  format: string;
  size: number;
  error?: string;
}

// Base publisher interface
export interface BasePublisher<TConfig, TResult> {
  initialize(config: TConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<TResult>;
  verify(result: TResult): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
}

/**
 * Validation message
 */
export interface ValidationMessage {
  code: string;
  message: string;
  field?: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Verification result
 */
export interface VerificationResult {
  success: boolean;
  checks: VerificationCheck[];
  duration: number;
}

/**
 * Verification check
 */
export interface VerificationCheck {
  name: string;
  success: boolean;
  message: string;
  duration: number;
}