/**
 * GitHub Release Manager
 * 
 * Handles automated GitHub release creation, asset uploads, and release management
 * using the GitHub API. Supports draft releases, asset uploads, release notes
 * generation, and tag management.
 * 
 * Features:
 * - Automated release creation with semantic versioning
 * - Asset       return {
        success: false,
        error,
        releaseId: null,
        tagName: `v${this.config.version}`,
        releaseUrl: null,
        assets: [],
        duration: 0
      };attachment management
 * - Release notes generation from changelog and commits
 * - Draft/published release state management
 * - GitHub API integration with authentication
 * - Release verification and rollback capabilities
 * - Tag creation and management
 * - Pre-release and stable channel support
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import type {
  DistributionConfig,
  ValidationResult,
  VerificationResult,
  VerificationCheck,
  GitHubReleaseResult,
  ReleaseConfig,
} from './types';

export interface Publisher {
  initialize(config: DistributionConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<GitHubReleaseResult>;
  verify(result: GitHubReleaseResult): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}

interface GitHubCredentials {
  token: string;
  owner: string;
  repo: string;
}

interface ReleaseAsset {
  path: string;
  name: string;
  label?: string;
  contentType?: string;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at?: string;
  html_url: string;
  upload_url: string;
  assets: Array<{
    id: number;
    name: string;
    size: number;
    download_count: number;
    browser_download_url: string;
  }>;
}

interface ReleaseNotes {
  version: string;
  changes: string[];
  breakingChanges: string[];
  features: string[];
  fixes: string[];
  dependencies: string[];
  contributors: string[];
}

export class GitHubReleaseManager implements Publisher {
  private config: DistributionConfig | null = null;
  private credentials: GitHubCredentials = { token: '', owner: '', repo: '' };
  private githubApiUrl = 'https://api.github.com';

  async initialize(config: DistributionConfig): Promise<void> {
    console.log('Initializing GitHub Release Manager...');
    this.config = config;

    // Load credentials from environment or config
    this.loadCredentials();

    // Verify GitHub API access
    await this.verifyGitHubAccess();

    console.log('GitHub Release Manager initialized successfully');
  }

  private loadCredentials(): void {
    // GitHub token from environment
    this.credentials.token = process.env.GITHUB_TOKEN || this.findReleaseToken();
    
    // Repository information from git remote or config
    const remoteInfo = this.getRepositoryInfo();
    this.credentials.owner = remoteInfo.owner;
    this.credentials.repo = remoteInfo.repo;

    if (!this.credentials.token) {
      throw new Error('GitHub token not found. Set GITHUB_TOKEN environment variable.');
    }
  }

  private findReleaseToken(): string {
    // Check for GitHub token in various common environment variables
    return process.env.GH_TOKEN || 
           process.env.GITHUB_PAT || 
           process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';
  }

  private getRepositoryInfo(): { owner: string; repo: string } {
    try {
      // Get remote origin URL
      const remoteUrl = execSync('git remote get-url origin', { 
        encoding: 'utf-8' 
      }).trim();

      // Parse GitHub URL (both HTTPS and SSH formats)
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+)(?:\.git)?$/);
      if (!match || !match[1] || !match[2]) {
        throw new Error('Could not parse GitHub repository URL');
      }

      return {
        owner: match[1],
        repo: match[2].replace('.git', '')
      };
    } catch (error) {
      throw new Error(`Could not determine repository information: ${error}`);
    }
  }

  private async verifyGitHubAccess(): Promise<void> {
    try {
      const response = await this.makeGitHubApiRequest(`/repos/${this.credentials.owner}/${this.credentials.repo}`);
      
      if (!response.permissions?.push) {
        throw new Error('GitHub token does not have push permissions to repository');
      }

      console.log(`✅ GitHub API access verified for ${this.credentials.owner}/${this.credentials.repo}`);
    } catch (error) {
      throw new Error(`GitHub API access verification failed: ${error}`);
    }
  }

  async validate(): Promise<ValidationResult> {
    const errors: Array<{ code: string; message: string; path?: string; severity: 'error' }> = [];
    const validationWarnings: Array<{ code: string; message: string; path?: string; severity: 'warning' }> = [];

    const addError = (code: string, message: string, path?: string) => {
      errors.push({ code, message, path, severity: 'error' });
    };

    const addWarning = (code: string, message: string, path?: string) => {
      validationWarnings.push({ code, message, path, severity: 'warning' });
    };

    if (!this.config) {
      addError('CONFIG_NOT_INITIALIZED', 'GitHub Release Manager not initialized with config');
      return { success: false, errors, warnings: validationWarnings };
    }

    // Validate credentials
    this.validateCredentials(addError, addWarning);

    // Validate repository access
    await this.validateRepositoryAccess(addError, addWarning);

    // Validate release configuration
    this.validateReleaseConfig(addError, addWarning);

    // Validate assets exist
    await this.validateReleaseAssets(addError, addWarning);

    return {
      success: errors.length === 0,
      errors,
      warnings: validationWarnings
    };
  }

  private validateCredentials(
    addError: (code: string, message: string, path?: string) => void,
    _addWarning: (code: string, message: string, path?: string) => void
  ): void {
    if (!this.credentials.token) {
      addError('MISSING_GITHUB_TOKEN', 'GitHub personal access token is required (GITHUB_TOKEN environment variable)');
    }

    if (!this.credentials.owner) {
      addError('MISSING_REPO_OWNER', 'Repository owner could not be determined from git remote');
    }

    if (!this.credentials.repo) {
      addError('MISSING_REPO_NAME', 'Repository name could not be determined from git remote');
    }
  }

  private async validateRepositoryAccess(
    addError: (code: string, message: string, path?: string) => void,
    _addWarning: (code: string, message: string, path?: string) => void
  ): Promise<void> {
    try {
      const repo = await this.makeGitHubApiRequest(`/repos/${this.credentials.owner}/${this.credentials.repo}`);
      
      if (!repo.permissions?.push) {
        addError('INSUFFICIENT_PERMISSIONS', 'GitHub token lacks push permissions for releases');
      }

      if (repo.archived) {
        addError('REPO_ARCHIVED', 'Cannot create releases for archived repository');
      }

      if (!repo.permissions?.contents_write && !repo.permissions?.push) {
        addError('MISSING_CONTENTS_PERMISSION', 'GitHub token lacks contents write permission');
      }

    } catch (error) {
      addError('REPO_ACCESS_FAILED', `Cannot access repository: ${error}`);
    }
  }

  private validateReleaseConfig(
    addError: (code: string, message: string, path?: string) => void,
    addWarning: (code: string, message: string, path?: string) => void
  ): void {
    if (!this.config!.version) {
      addError('MISSING_VERSION', 'Release version is required');
    }

    // Validate version format
    if (this.config!.version && !this.isValidSemVer(this.config!.version)) {
      addWarning('INVALID_SEMVER', `Version "${this.config!.version}" is not valid semantic versioning`);
    }

    // Check if tag already exists
    try {
      const tagExists = this.checkTagExists(`v${this.config!.version}`);
      if (tagExists) {
        addError('TAG_EXISTS', `Git tag v${this.config!.version} already exists`);
      }
    } catch (error) {
      addWarning('TAG_CHECK_FAILED', `Could not verify tag existence: ${error}`);
    }
  }

  private async validateReleaseAssets(
    addError: (code: string, message: string, path?: string) => void,
    addWarning: (code: string, message: string, path?: string) => void
  ): Promise<void> {
    const releaseConfig = this.getReleaseConfig();
    
    if (releaseConfig.assets) {
      for (const asset of releaseConfig.assets) {
        try {
          await fs.access(asset.path);
          const stats = await fs.stat(asset.path);
          if (stats.size === 0) {
            addWarning('EMPTY_ASSET', `Release asset is empty: ${asset.path}`);
          }
        } catch (error) {
          addError('ASSET_NOT_FOUND', `Release asset not found: ${asset.path}`);
        }
      }
    }

    // Check for common release assets
    const commonAssets = [
      'CHANGELOG.md',
      'README.md',
      'LICENSE'
    ];

    for (const assetName of commonAssets) {
      try {
        await fs.access(assetName);
      } catch (error) {
        addWarning('MISSING_COMMON_ASSET', `Common release asset missing: ${assetName}`);
      }
    }
  }

  async publish(): Promise<GitHubReleaseResult> {
    console.log('Starting GitHub release creation...');

    if (!this.config) {
      const error = 'GitHub Release Manager not initialized';
      console.error(`GitHub release failed: ${error}`);
      return {
        success: false,
        error,
        releaseId: 0,
        tagName: '',
        releaseUrl: '',
        assets: [],
        duration: 0
      };
    }

    // Validate before publishing
    const validation = await this.validate();
    if (!validation.success) {
      const error = `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`;
      console.error(`GitHub release failed: ${error}`);
      return {
        success: false,
        error,
        releaseId: 0,
        tagName: `v${this.config.version}`,
        releaseUrl: '',
        assets: [],
        duration: 0
      };
    }

    const startTime = Date.now();

    try {
      console.log(`Creating release for version ${this.config.version}...`);

      // Generate release notes
      const releaseNotes = await this.generateReleaseNotes();
      
      // Create GitHub release
      const release = await this.createGitHubRelease(releaseNotes);
      
      // Upload assets
      const assets = await this.uploadReleaseAssets(release);

      // Publish release if not draft
      const finalRelease = await this.publishReleaseIfReady(release);

      const duration = Date.now() - startTime;

      console.log(`✅ GitHub release created successfully!`);
      console.log(`  Release: ${finalRelease.html_url}`);
      console.log(`  Tag: ${finalRelease.tag_name}`);
      console.log(`  Assets: ${assets.length} uploaded`);
      console.log(`  Duration: ${duration}ms`);

      return {
        success: true,
        releaseId: finalRelease.id,
        tagName: finalRelease.tag_name,
        releaseUrl: finalRelease.html_url,
        assets: assets.map(asset => ({
          success: true,
          assetName: asset.name,
          assetUrl: asset.browser_download_url,
          size: asset.size,
          contentType: asset.content_type || 'application/octet-stream',
          checksum: asset.node_id // Using node_id as a proxy for checksum
        })),
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `GitHub release creation error: ${error}`;
      console.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        releaseId: 0,
        tagName: `v${this.config.version}`,
        releaseUrl: '',
        assets: [],
        duration
      };
    }
  }

  private async generateReleaseNotes(): Promise<ReleaseNotes> {
    console.log('Generating release notes...');
    
    const version = this.config!.version;
    const notes: ReleaseNotes = {
      version,
      changes: [],
      breakingChanges: [],
      features: [],
      fixes: [],
      dependencies: [],
      contributors: []
    };

    try {
      // Try to read CHANGELOG.md first
      const changelogNotes = await this.extractFromChangelog(version);
      if (changelogNotes) {
        Object.assign(notes, changelogNotes);
      } else {
        // Generate from git commits
        const commitNotes = await this.generateFromCommits();
        Object.assign(notes, commitNotes);
      }
    } catch (error) {
      console.warn(`Could not generate release notes: ${error}`);
      notes.changes = [`Release ${version}`];
    }

    return notes;
  }

  private async extractFromChangelog(version: string): Promise<ReleaseNotes | null> {
    try {
      const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
      const content = await fs.readFile(changelogPath, 'utf-8');
      
      // Look for version section in changelog
      const versionPattern = new RegExp(`## \\[?${version}\\]?.*?(?=## |$)`, 'gs');
      const match = content.match(versionPattern);
      
      if (!match) {
return null;
}

      const sectionContent = match[0];
      
      return this.parseChangelogSection(sectionContent, version);
      
    } catch (error) {
      return null;
    }
  }

  private parseChangelogSection(content: string, version: string): ReleaseNotes {
    const notes: ReleaseNotes = {
      version,
      changes: [],
      breakingChanges: [],
      features: [],
      fixes: [],
      dependencies: [],
      contributors: []
    };

    // Parse different sections
    const sections = {
      'BREAKING CHANGES?': 'breakingChanges',
      'Features?|Added': 'features',
      'Bug ?Fixes?|Fixed': 'fixes',
      'Dependencies?|Changed': 'dependencies'
    };

    for (const [pattern, key] of Object.entries(sections)) {
      const regex = new RegExp(`### ${pattern}([\\s\\S]*?)(?=### |$)`, 'i');
      const match = content.match(regex);
      if (match && match[1]) {
        const items = match[1]
          .split('\n')
          .filter(line => line.trim().startsWith('- '))
          .map(line => line.replace(/^- /, '').trim());
        (notes as any)[key] = items;
      }
    }

    // If no specific sections found, extract all bullet points
    if (notes.features.length === 0 && notes.fixes.length === 0) {
      const bullets = content
        .split('\n')
        .filter(line => line.trim().startsWith('- '))
        .map(line => line.replace(/^- /, '').trim());
      notes.changes = bullets;
    }

    return notes;
  }

  private async generateFromCommits(): Promise<ReleaseNotes> {
    const version = this.config!.version;
    
    try {
      // Get commits since last tag
      const lastTag = this.getLastTag();
      const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
      
      const commits = execSync(`git log ${range} --pretty=format:"%s"`, {
        encoding: 'utf-8'
      }).split('\n').filter(Boolean);

      return this.parseCommitMessages(commits, version);
      
    } catch (error) {
      return {
        version,
        changes: [`Release ${version}`],
        breakingChanges: [],
        features: [],
        fixes: [],
        dependencies: [],
        contributors: []
      };
    }
  }

  private parseCommitMessages(commits: string[], version: string): ReleaseNotes {
    const notes: ReleaseNotes = {
      version,
      changes: [],
      breakingChanges: [],
      features: [],
      fixes: [],
      dependencies: [],
      contributors: []
    };

    for (const commit of commits) {
      const message = commit.trim();
      
      // Skip merge commits and version bumps
      if (message.startsWith('Merge ') || 
          message.includes('version bump') ||
          message.includes('chore: release')) {
        continue;
      }

      // Categorize by conventional commit format
      if (message.startsWith('feat:') || message.startsWith('feat(')) {
        notes.features.push(message.replace(/^feat(\([^)]+\))?:\s*/, ''));
      } else if (message.startsWith('fix:') || message.startsWith('fix(')) {
        notes.fixes.push(message.replace(/^fix(\([^)]+\))?:\s*/, ''));
      } else if (message.includes('BREAKING CHANGE')) {
        notes.breakingChanges.push(message);
      } else if (message.startsWith('deps:') || 
                 message.startsWith('build:') ||
                 message.startsWith('chore:')) {
        notes.dependencies.push(message);
      } else {
        notes.changes.push(message);
      }
    }

    return notes;
  }

  private formatReleaseNotes(notes: ReleaseNotes): string {
    let body = `# Release ${notes.version}\n\n`;

    if (notes.breakingChanges.length > 0) {
      body += '## ⚠️ Breaking Changes\n\n';
      notes.breakingChanges.forEach(change => {
        body += `- ${change}\n`;
      });
      body += '\n';
    }

    if (notes.features.length > 0) {
      body += '## ✨ New Features\n\n';
      notes.features.forEach(feature => {
        body += `- ${feature}\n`;
      });
      body += '\n';
    }

    if (notes.fixes.length > 0) {
      body += '## 🐛 Bug Fixes\n\n';
      notes.fixes.forEach(fix => {
        body += `- ${fix}\n`;
      });
      body += '\n';
    }

    if (notes.changes.length > 0 && 
        notes.features.length === 0 && 
        notes.fixes.length === 0) {
      body += '## Changes\n\n';
      notes.changes.forEach(change => {
        body += `- ${change}\n`;
      });
      body += '\n';
    }

    if (notes.dependencies.length > 0) {
      body += '## 📦 Dependencies & Build\n\n';
      notes.dependencies.forEach(dep => {
        body += `- ${dep}\n`;
      });
      body += '\n';
    }

    return body.trim();
  }

  private async createGitHubRelease(releaseNotes: ReleaseNotes): Promise<GitHubRelease> {
    const releaseConfig = this.getReleaseConfig();
    const tagName = `v${this.config!.version}`;
    
    const releaseData = {
      tag_name: tagName,
      target_commitish: 'main',
      name: `${this.config!.name} ${this.config!.version}`,
      body: this.formatReleaseNotes(releaseNotes),
      draft: releaseConfig.draft || false,
      prerelease: this.isPreRelease(this.config!.version),
      generate_release_notes: false
    };

    console.log(`Creating GitHub release: ${releaseData.name}`);
    
    const release = await this.makeGitHubApiRequest(
      `/repos/${this.credentials.owner}/${this.credentials.repo}/releases`,
      'POST',
      releaseData
    );

    return release;
  }

  private async uploadReleaseAssets(release: GitHubRelease): Promise<Array<any>> {
    const releaseConfig = this.getReleaseConfig();
    const assets = releaseConfig.assets || [];
    
    if (assets.length === 0) {
      console.log('No assets to upload');
      return [];
    }

    console.log(`Uploading ${assets.length} release assets...`);
    const uploadedAssets = [];

    for (const asset of assets) {
      try {
        console.log(`  Uploading: ${asset.name}`);
        const uploadedAsset = await this.uploadSingleAsset(release, asset);
        uploadedAssets.push(uploadedAsset);
        console.log(`    ✅ ${asset.name} uploaded successfully`);
      } catch (error) {
        console.error(`    ❌ Failed to upload ${asset.name}: ${error}`);
        throw error;
      }
    }

    return uploadedAssets;
  }

  private async uploadSingleAsset(release: GitHubRelease, asset: ReleaseAsset): Promise<any> {
    const fileContent = await fs.readFile(asset.path);
    const stats = await fs.stat(asset.path);
    
    const uploadUrl = release.upload_url.replace('{?name,label}', '');
    const url = `${uploadUrl}?name=${encodeURIComponent(asset.name)}${asset.label ? `&label=${encodeURIComponent(asset.label)}` : ''}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.credentials.token}`,
        'Content-Type': asset.contentType || 'application/octet-stream',
        'Content-Length': stats.size.toString()
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private async publishReleaseIfReady(release: GitHubRelease): Promise<GitHubRelease> {
    const releaseConfig = this.getReleaseConfig();
    
    if (release.draft && !releaseConfig.draft) {
      // Publish the draft release
      console.log('Publishing draft release...');
      
      const updatedRelease = await this.makeGitHubApiRequest(
        `/repos/${this.credentials.owner}/${this.credentials.repo}/releases/${release.id}`,
        'PATCH',
        { draft: false }
      );
      
      return updatedRelease;
    }

    return release;
  }

  async verify(result: GitHubReleaseResult): Promise<VerificationResult> {
    console.log('Verifying GitHub release...');
    const startTime = Date.now();

    const checks: VerificationCheck[] = [];

    if (!result.success) {
      return {
        success: false,
        checks: [{
          name: 'GitHub Release Creation',
          success: false,
          message: result.error || 'Release creation failed',
          duration: 0
        }],
        duration: Date.now() - startTime
      };
    }

    // Verify release exists
    if (result.releaseId !== null) {
      const releaseCheck = await this.verifyReleaseExists(result.releaseId);
      checks.push(releaseCheck);
    }

    // Verify tag exists
    const tagCheck = await this.verifyTagExists(result.tagName);
    checks.push(tagCheck);

    // Verify assets if any
    if (result.assets.length > 0 && result.releaseId !== null) {
      const assetCheck = await this.verifyReleaseAssets(result.releaseId, result.assets);
      checks.push(assetCheck);
    }

    const allChecksSucceeded = checks.every(c => c.success);
    const duration = Date.now() - startTime;

    return {
      success: allChecksSucceeded,
      checks,
        duration
    };
  }

  private async verifyReleaseExists(releaseId: number): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const release = await this.makeGitHubApiRequest(
        `/repos/${this.credentials.owner}/${this.credentials.repo}/releases/${releaseId}`
      );

      const duration = Date.now() - startTime;
      return {
        name: 'Release Existence',
        success: true,
        message: `Release ${release.tag_name} verified successfully`,
        duration
      };
    } catch (error) {
      return {
        name: 'Release Existence',
        success: false,
        message: `Failed to verify release: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async verifyTagExists(tagName: string): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      execSync(`git tag -l "${tagName}"`, { encoding: 'utf-8' });
      
      const duration = Date.now() - startTime;
      return {
        name: 'Git Tag Verification',
        success: true,
        message: `Git tag ${tagName} verified successfully`,
        duration
      };
    } catch (error) {
      return {
        name: 'Git Tag Verification',
        success: false,
        message: `Failed to verify git tag: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async verifyReleaseAssets(releaseId: number, expectedAssets: Array<any>): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    try {
      const release = await this.makeGitHubApiRequest(
        `/repos/${this.credentials.owner}/${this.credentials.repo}/releases/${releaseId}`
      );

      const actualAssets = release.assets;
      const missingAssets = expectedAssets.filter(expected => 
        !actualAssets.some((actual: any) => actual.name === expected.name)
      );

      const duration = Date.now() - startTime;
      
      if (missingAssets.length === 0) {
        return {
          name: 'Release Assets',
          success: true,
          message: `All ${expectedAssets.length} release assets verified successfully`,
        duration
        };
      } else {
        return {
          name: 'Release Assets',
          success: false,
          message: `Missing ${missingAssets.length} release assets: ${missingAssets.map(a => a.name).join(', ')}`,
        duration
        };
      }
    } catch (error) {
      return {
        name: 'Release Assets',
        success: false,
        message: `Failed to verify release assets: ${error}`,
        duration: Date.now() - startTime
      };
    }
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up GitHub Release Manager...');
    
    // Clean up any temporary files
    if (this.config) {
      // Remove any temporary release files
      const tempDir = path.join(process.cwd(), '.release-temp');
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log('GitHub Release Manager cleanup completed');
  }

  // Utility methods
  private async makeGitHubApiRequest(endpoint: string, method = 'GET', body?: any): Promise<any> {
    const url = `${this.githubApiUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `token ${this.credentials.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ast-copilot-helper-distribution'
      }
    };

    if (body) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API request failed: ${response.statusText} - ${error}`);
    }

    return await response.json();
  }

  private getReleaseConfig(): ReleaseConfig {
    return this.config?.releases || {
      draft: false,
      prerelease: false,
      assets: [],
      generateReleaseNotes: true
    };
  }

  private isValidSemVer(version: string): boolean {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  private checkTagExists(tagName: string): boolean {
    try {
      const result = execSync(`git tag -l "${tagName}"`, { encoding: 'utf-8' });
      return result.trim() !== '';
    } catch (error) {
      return false;
    }
  }

  private isPreRelease(version: string): boolean {
    return /-(alpha|beta|rc|pre)/i.test(version);
  }

  private getLastTag(): string | null {
    try {
      const result = execSync('git describe --tags --abbrev=0', { 
        encoding: 'utf-8' 
      }).trim();
      return result || null;
    } catch (error) {
      return null;
    }
  }
}