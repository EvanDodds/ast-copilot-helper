/**
 * Automated Changelog Generation Implementation
 * 
 * @fileoverview Implements automated changelog generation with commit analysis,
 * categorization, conventional commits parsing, and release notes generation.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

import { ChangelogGenerator } from '../interfaces.js';
import {
  ChangelogConfig,
  ChangelogEntry,
  ReleaseNotes
} from '../types.js';

import { execSync } from 'child_process';

/**
 * Automated changelog generation implementation
 */
export class ChangelogGeneratorImpl implements ChangelogGenerator {
  private config!: ChangelogConfig;
  private initialized = false;

  /**
   * Initialize changelog generator with configuration
   */
  async initialize(config: ChangelogConfig): Promise<void> {
    console.log('📝 Initializing changelog generator...');
    
    this.config = config;
    this.initialized = true;
    
    console.log(`✅ Changelog generator initialized (format: ${config.format})`);
  }

  /**
   * Detect changes since a specific version
   */
  async detectChangesSince(version: string): Promise<ChangelogEntry[]> {
    this.ensureInitialized();
    
    console.log(`🔍 Detecting changes since version: ${version}`);
    
    try {
      // Get commit history since the specified version
      const commits = await this.getCommitsSince(version);
      
      // Parse commits into changelog entries
      const entries = await this.parseCommits(commits);
      
      // Filter out excluded types
      const filteredEntries = entries.filter(entry => 
        !this.config.excludeTypes.includes(entry.type)
      );
      
      console.log(`✅ Detected ${filteredEntries.length} changes since ${version}`);
      return filteredEntries;
      
    } catch (error) {
      console.error(`❌ Failed to detect changes since ${version}:`, error);
      throw new Error(`Failed to detect changes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Categorize changes by type and scope
   */
  async categorizeChanges(commits: Commit[]): Promise<ChangelogEntry[]> {
    this.ensureInitialized();
    
    console.log(`📊 Categorizing ${commits.length} commits`);
    
    const entries: ChangelogEntry[] = [];
    
    for (const commit of commits) {
      try {
        const entry = await this.parseCommitMessage(commit);
        if (entry) {
          entries.push(entry);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse commit ${commit.hash}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue processing other commits
      }
    }
    
    console.log(`✅ Categorized ${entries.length} changelog entries`);
    return entries;
  }

  /**
   * Generate changelog entries from categorized changes
   */
  async generateEntries(changes: ChangelogEntry[]): Promise<ChangelogEntry[]> {
    this.ensureInitialized();
    
    console.log(`📋 Generating entries from ${changes.length} changes`);
    
    // Sort changes by type and scope
    const sortedChanges = changes.sort((a, b) => {
      // Breaking changes first
      if (a.breaking && !b.breaking) return -1;
      if (!a.breaking && b.breaking) return 1;
      
      // Then by type priority
      const typePriority = this.getTypePriority(a.type) - this.getTypePriority(b.type);
      if (typePriority !== 0) return typePriority;
      
      // Then by scope
      if (a.scope && b.scope) {
        return a.scope.localeCompare(b.scope);
      }
      if (a.scope && !b.scope) return -1;
      if (!a.scope && b.scope) return 1;
      
      // Finally by timestamp
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
    
    console.log(`✅ Generated ${sortedChanges.length} sorted changelog entries`);
    return sortedChanges;
  }

  /**
   * Format changelog content
   */
  async formatChangelog(entries: ChangelogEntry[]): Promise<string> {
    this.ensureInitialized();
    
    console.log(`📄 Formatting changelog with ${entries.length} entries`);
    
    switch (this.config.format) {
      case 'keepachangelog':
        return this.formatKeepAChangelog(entries);
      case 'conventional':
        return this.formatConventionalChangelog(entries);
      case 'custom':
        return this.formatCustomChangelog(entries);
      default:
        throw new Error(`Unsupported changelog format: ${this.config.format}`);
    }
  }

  /**
   * Parse commit messages for conventional commits
   */
  async parseCommits(commits: string[]): Promise<ChangelogEntry[]> {
    this.ensureInitialized();
    
    console.log(`🔍 Parsing ${commits.length} commit messages`);
    
    const entries: ChangelogEntry[] = [];
    
    for (const commit of commits) {
      try {
        const parsed = this.parseConventionalCommit(commit);
        if (parsed) {
          entries.push(parsed);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse commit message: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log(`✅ Parsed ${entries.length} commit entries`);
    return entries;
  }

  /**
   * Generate release notes from changelog entries
   */
  async generateReleaseNotes(version: string, entries: ChangelogEntry[]): Promise<ReleaseNotes> {
    this.ensureInitialized();
    
    console.log(`📄 Generating release notes for version: ${version}`);
    
    const breakingChanges = entries.filter(e => e.breaking);
    const newFeatures = entries.filter(e => e.type === 'feat' || e.type === 'feature');
    const bugFixes = entries.filter(e => e.type === 'fix');
    const improvements = entries.filter(e => e.type === 'refactor' || e.type === 'perf');
    
    // Generate highlights
    const highlights: string[] = [];
    
    if (newFeatures.length > 0) {
      highlights.push(`🎉 ${newFeatures.length} new feature${newFeatures.length === 1 ? '' : 's'}`);
    }
    
    if (bugFixes.length > 0) {
      highlights.push(`🐛 ${bugFixes.length} bug fix${bugFixes.length === 1 ? '' : 'es'}`);
    }
    
    if (improvements.length > 0) {
      highlights.push(`⚡ ${improvements.length} improvement${improvements.length === 1 ? '' : 's'}`);
    }
    
    if (breakingChanges.length > 0) {
      highlights.push(`💥 ${breakingChanges.length} breaking change${breakingChanges.length === 1 ? '' : 's'}`);
    }
    
    // Generate description
    const description = this.generateDescription(version, entries);
    
    const releaseNotes: ReleaseNotes = {
      version,
      title: `Release ${version}`,
      description,
      date: new Date(),
      highlights,
      breakingChanges: breakingChanges.map(c => c.description),
      knownIssues: [], // Would be populated from issue tracking
      migrationGuide: breakingChanges.length > 0 ? 
        `Please review the breaking changes above and update your code accordingly.` : 
        undefined,
      downloadLinks: [], // Would be populated after publishing
      acknowledgments: this.generateAcknowledgments(entries)
    };
    
    console.log(`✅ Generated release notes for ${version}`);
    return releaseNotes;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ChangelogGenerator not initialized. Call initialize() first.');
    }
  }

  private async getCommitsSince(version: string): Promise<string[]> {
    try {
      // Get commit messages since the specified version/tag
      const command = version === 'HEAD' ? 
        'git log --pretty=format:"%H|%an|%ad|%s|%b" --date=iso' :
        `git log ${version}..HEAD --pretty=format:"%H|%an|%ad|%s|%b" --date=iso`;
      
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'ignore'],
        cwd: process.cwd()
      });
      
      return result.trim().split('\n').filter(line => line.trim());
      
    } catch (error) {
      console.warn(`⚠️ Failed to get git commits, using empty list:`, error);
      return [];
    }
  }

  private async parseCommitMessage(commit: Commit): Promise<ChangelogEntry | null> {
    // Try to parse as conventional commit first
    const conventional = this.parseConventionalCommit(`${commit.hash}|${commit.author}|${commit.date.toISOString()}|${commit.message}|`);
    
    if (conventional) {
      return conventional;
    }
    
    // Fall back to basic parsing
    return {
      type: 'other',
      description: commit.message,
      breaking: false,
      author: commit.author,
      commit: commit.hash,
      timestamp: commit.date,
      affectedPackages: []
    };
  }

  private parseConventionalCommit(commitLine: string): ChangelogEntry | null {
    const parts = commitLine.split('|');
    if (parts.length < 4) return null;
    
    const [hash, author, dateStr, message, body] = parts;
    if (!hash || !author || !dateStr || !message) return null;
    
    const date = new Date(dateStr);
    
    // Parse conventional commit format: type(scope): description
    const conventionalRegex = /^(\w+)(?:\(([^)]+)\))?\!?:\s*(.+)$/;
    const match = message.match(conventionalRegex);
    
    if (!match) {
      // Not a conventional commit, create basic entry
      return {
        type: 'other',
        description: message,
        breaking: false,
        author,
        commit: hash,
        timestamp: date,
        affectedPackages: []
      };
    }
    
    const [, type, scope, description] = match;
    if (!type || !description) return null;
    
    // Check for breaking change indicators
    const breaking = message.includes('!:') || 
                    (body && body.toLowerCase().includes('breaking change'));
    
    // Extract affected packages from scope or body
    const affectedPackages = this.extractAffectedPackages(scope || '', body || '');
    
    return {
      type,
      scope,
      description,
      body: body || undefined,
      breaking: Boolean(breaking),
      author,
      commit: hash,
      timestamp: date,
      affectedPackages
    };
  }

  private extractAffectedPackages(scope: string, body: string): string[] {
    const packages = new Set<string>();
    
    // Extract from scope
    if (scope) {
      packages.add(scope);
    }
    
    // Extract from body (look for package names)
    const packagePattern = /@[\w-]+\/[\w-]+|packages\/[\w-]+/g;
    const bodyMatches = body.match(packagePattern);
    if (bodyMatches) {
      bodyMatches.forEach(match => packages.add(match));
    }
    
    return Array.from(packages);
  }

  private getTypePriority(type: string): number {
    const priorities: Record<string, number> = {
      'feat': 1,
      'feature': 1,
      'fix': 2,
      'perf': 3,
      'refactor': 4,
      'docs': 5,
      'style': 6,
      'test': 7,
      'build': 8,
      'ci': 9,
      'chore': 10,
      'other': 11
    };
    
    return priorities[type] || 11;
  }

  private formatKeepAChangelog(entries: ChangelogEntry[]): string {
    const sections = this.groupBySection(entries);
    let changelog = '';
    
    for (const section of this.config.sections) {
      const sectionEntries = sections[section.title] || [];
      if (sectionEntries.length === 0) continue;
      
      changelog += `### ${section.title}\n\n`;
      
      for (const entry of sectionEntries) {
        const scope = entry.scope ? `**${entry.scope}**: ` : '';
        const breaking = entry.breaking ? '**BREAKING:** ' : '';
        changelog += `- ${breaking}${scope}${entry.description}\n`;
      }
      
      changelog += '\n';
    }
    
    return changelog;
  }

  private formatConventionalChangelog(entries: ChangelogEntry[]): string {
    const breakingChanges = entries.filter(e => e.breaking);
    const features = entries.filter(e => e.type === 'feat' || e.type === 'feature');
    const fixes = entries.filter(e => e.type === 'fix');
    
    let changelog = '';
    
    if (breakingChanges.length > 0) {
      changelog += '### BREAKING CHANGES\n\n';
      breakingChanges.forEach(entry => {
        changelog += `* ${entry.description}\n`;
      });
      changelog += '\n';
    }
    
    if (features.length > 0) {
      changelog += '### Features\n\n';
      features.forEach(entry => {
        const scope = entry.scope ? `**${entry.scope}**: ` : '';
        changelog += `* ${scope}${entry.description}\n`;
      });
      changelog += '\n';
    }
    
    if (fixes.length > 0) {
      changelog += '### Bug Fixes\n\n';
      fixes.forEach(entry => {
        const scope = entry.scope ? `**${entry.scope}**: ` : '';
        changelog += `* ${scope}${entry.description}\n`;
      });
      changelog += '\n';
    }
    
    return changelog;
  }

  private formatCustomChangelog(entries: ChangelogEntry[]): string {
    if (!this.config.customTemplate) {
      return this.formatConventionalChangelog(entries);
    }
    
    // Simple template replacement
    return this.config.customTemplate
      .replace('{{entries}}', entries.map(e => `- ${e.description}`).join('\n'))
      .replace('{{count}}', entries.length.toString());
  }

  private groupBySection(entries: ChangelogEntry[]): Record<string, ChangelogEntry[]> {
    const grouped: Record<string, ChangelogEntry[]> = {};
    
    for (const section of this.config.sections) {
      grouped[section.title] = entries.filter(entry => {
        return section.types.includes(entry.type) && 
               (!section.scope || entry.scope === section.scope);
      });
    }
    
    return grouped;
  }

  private generateDescription(_version: string, entries: ChangelogEntry[]): string {
    const totalChanges = entries.length;
    const breakingChanges = entries.filter(e => e.breaking).length;
    const features = entries.filter(e => e.type === 'feat' || e.type === 'feature').length;
    const fixes = entries.filter(e => e.type === 'fix').length;
    
    let description = `This release includes ${totalChanges} changes`;
    
    const parts: string[] = [];
    if (features > 0) parts.push(`${features} new feature${features === 1 ? '' : 's'}`);
    if (fixes > 0) parts.push(`${fixes} bug fix${fixes === 1 ? '' : 'es'}`);
    if (breakingChanges > 0) parts.push(`${breakingChanges} breaking change${breakingChanges === 1 ? '' : 's'}`);
    
    if (parts.length > 0) {
      description += ` including ${parts.join(', ')}`;
    }
    
    description += '.';
    
    return description;
  }

  private generateAcknowledgments(entries: ChangelogEntry[]): string[] {
    const authors = new Set<string>();
    
    entries.forEach(entry => {
      if (entry.author) {
        authors.add(entry.author);
      }
    });
    
    return Array.from(authors).map(author => `Thanks to @${author} for contributing to this release!`);
  }
}

// Helper interfaces
interface Commit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  files: string[];
}