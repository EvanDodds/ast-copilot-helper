# Release Management API Documentation

## Overview

The Comprehensive Release Management System provides automated semantic versioning, changelog generation, backward compatibility checking, and multi-platform publishing for TypeScript/Node.js projects.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Classes](#core-classes)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Installation

```bash
npm install @ast-copilot-helper/release-management
```

## Quick Start

```typescript
import { ComprehensiveReleaseManager, ReleaseType } from '@ast-copilot-helper/release-management';

// Initialize the release manager
const manager = new ComprehensiveReleaseManager();
await manager.initialize(config);

// Plan a release
const plan = await manager.planRelease('1.1.0', ReleaseType.MINOR);

// Validate the plan
const validation = await manager.validateRelease(plan);

// Execute the release if validation passes
if (validation.success) {
  const result = await manager.executeRelease(plan);
  console.log(`Release ${result.version} completed: ${result.success}`);
}
```

## Core Classes

### ComprehensiveReleaseManager

The main orchestrator class that coordinates all release management activities.

#### Methods

##### `initialize(config: ReleaseConfig): Promise<void>`

Initializes the release manager with configuration.

**Parameters:**
- `config` - Complete release configuration object

**Throws:**
- Error if configuration is invalid or initialization fails

##### `planRelease(version: string, type: ReleaseType): Promise<ReleasePlan>`

Creates a comprehensive release plan for the specified version and type.

**Parameters:**
- `version` - Target version string (e.g., '1.2.3')
- `type` - Release type (MAJOR, MINOR, PATCH, PRERELEASE, HOTFIX)

**Returns:**
- `ReleasePlan` - Detailed release plan with packages, changes, and validations

**Example:**
```typescript
const plan = await manager.planRelease('1.2.0', ReleaseType.MINOR);
console.log(`Planning release ${plan.version} with ${plan.changes.length} changes`);
```

##### `validateRelease(plan: ReleasePlan): Promise<ValidationResult>`

Validates a release plan before execution.

**Parameters:**
- `plan` - Release plan to validate

**Returns:**
- `ValidationResult` - Validation status with errors, warnings, and step results

**Example:**
```typescript
const validation = await manager.validateRelease(plan);
if (!validation.success) {
  console.log('Validation failed:', validation.errors);
}
```

##### `executeRelease(plan: ReleasePlan): Promise<ReleaseResult>`

Executes a validated release plan.

**Parameters:**
- `plan` - Validated release plan

**Returns:**
- `ReleaseResult` - Execution result with success status and artifacts

**Example:**
```typescript
const result = await manager.executeRelease(plan);
if (result.success) {
  console.log(`Release completed in ${result.duration}ms`);
  console.log(`Artifacts: ${result.artifacts?.length || 0}`);
}
```

##### `generateChangelog(fromVersion: string, toVersion: string): Promise<Changelog>`

Generates changelog between two versions.

**Parameters:**
- `fromVersion` - Starting version for changelog
- `toVersion` - Ending version for changelog

**Returns:**
- `Changelog` - Structured changelog with categorized entries

**Example:**
```typescript
const changelog = await manager.generateChangelog('1.0.0', '1.1.0');
console.log(`Changelog has ${changelog.entries.length} entries`);
console.log(`Breaking changes: ${changelog.breakingChanges.length}`);
```

##### `checkBackwardCompatibility(newVersion: string, baseVersion: string): Promise<CompatibilityReport>`

Checks backward compatibility between versions.

**Parameters:**
- `newVersion` - New version to check
- `baseVersion` - Base version for comparison

**Returns:**
- `CompatibilityReport` - Compatibility analysis with breaking changes

**Example:**
```typescript
const compatibility = await manager.checkBackwardCompatibility('2.0.0', '1.5.0');
if (!compatibility.compatible) {
  console.log(`Found ${compatibility.breakingChanges.length} breaking changes`);
}
```

##### `createReleaseNotes(version: string, changes: ChangelogEntry[]): Promise<ReleaseNotes>`

Creates formatted release notes from changelog entries.

**Parameters:**
- `version` - Version for release notes
- `changes` - Array of changelog entries

**Returns:**
- `ReleaseNotes` - Formatted release notes with highlights

**Example:**
```typescript
const notes = await manager.createReleaseNotes('1.2.0', changes);
console.log(`Release notes: ${notes.title}`);
console.log(`Highlights: ${notes.highlights.join(', ')}`);
```

##### `rollbackRelease(version: string, reason: string): Promise<RollbackResult>`

Rolls back a release to the previous version.

**Parameters:**
- `version` - Version to rollback
- `reason` - Reason for rollback

**Returns:**
- `RollbackResult` - Rollback execution result

**Example:**
```typescript
const rollback = await manager.rollbackRelease('1.2.0', 'Critical bug detected');
if (rollback.success) {
  console.log(`Rolled back to version ${rollback.rolledBackVersion}`);
}
```

##### `getLatestVersion(channel: ReleaseChannel): Promise<string>`

Gets the latest version for a specific release channel.

**Parameters:**
- `channel` - Release channel (STABLE, BETA, ALPHA, NIGHTLY)

**Returns:**
- Latest version string for the channel

**Example:**
```typescript
const latestStable = await manager.getLatestVersion(ReleaseChannel.STABLE);
const latestBeta = await manager.getLatestVersion(ReleaseChannel.BETA);
```

##### `listReleases(filter?: ReleaseFilter): Promise<Release[]>`

Lists releases with optional filtering.

**Parameters:**
- `filter` - Optional filter criteria

**Returns:**
- Array of releases matching the filter

**Example:**
```typescript
// List all patch releases
const patches = await manager.listReleases({ type: ReleaseType.PATCH });

// List releases from last month
const recent = await manager.listReleases({
  dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
});
```

### VersionManagerImpl

Handles semantic versioning calculations and validations.

#### Methods

##### `calculateNextVersion(currentVersion: string, type: ReleaseType, changes?: ChangelogEntry[]): Promise<string>`

Calculates the next version based on current version and release type.

**Example:**
```typescript
const versionManager = new VersionManagerImpl();
await versionManager.initialize(config.versioning);

const nextVersion = await versionManager.calculateNextVersion('1.0.0', ReleaseType.MINOR);
console.log(`Next version: ${nextVersion}`); // "1.1.0"
```

##### `validateVersion(version: string, type: ReleaseType): Promise<boolean>`

Validates if a version string matches the expected format for the release type.

##### `compareVersions(version1: string, version2: string): number`

Compares two version strings semantically.

**Returns:**
- `-1` if version1 < version2
- `0` if version1 === version2  
- `1` if version1 > version2

### ChangelogGeneratorImpl

Generates changelogs from commit history and conventional commits.

#### Methods

##### `detectChangesSince(version: string): Promise<ChangelogEntry[]>`

Detects changes in the repository since a specific version.

##### `parseCommits(commits: string[]): Promise<ChangelogEntry[]>`

Parses conventional commit messages into structured changelog entries.

**Example:**
```typescript
const generator = new ChangelogGeneratorImpl();
await generator.initialize(config.changelog);

const commits = [
  'feat(auth): add OAuth2 support',
  'fix(api): resolve null pointer exception',
  'feat!: breaking change in user API'
];

const entries = await generator.parseCommits(commits);
console.log(`Parsed ${entries.length} commits`);
console.log(`Breaking changes: ${entries.filter(e => e.breaking).length}`);
```

##### `formatChangelog(entries: ChangelogEntry[]): Promise<string>`

Formats changelog entries into markdown content.

### CompatibilityCheckerImpl

Checks backward compatibility across different aspects of the application.

#### Methods

##### `checkApiCompatibility(baseVersion: string, newVersion: string): Promise<CompatibilityCheck>`

Checks API compatibility between versions.

##### `checkConfigCompatibility(baseVersion: string, newVersion: string): Promise<CompatibilityCheck>`

Checks configuration compatibility between versions.

##### `findBreakingChanges(baseVersion: string, newVersion: string): Promise<BreakingChange[]>`

Identifies breaking changes between versions.

**Example:**
```typescript
const checker = new CompatibilityCheckerImpl();
await checker.initialize(config.compatibility);

const breaking = await checker.findBreakingChanges('1.0.0', '2.0.0');
breaking.forEach(change => {
  console.log(`Breaking: ${change.description}`);
  console.log(`Migration: ${change.migration}`);
});
```

## Configuration

### ReleaseConfig

Complete configuration object for the release management system.

```typescript
interface ReleaseConfig {
  repository: RepositoryConfig;
  versioning: VersioningConfig;
  changelog: ChangelogConfig;
  platforms: PlatformConfig[];
  compatibility: CompatibilityConfig;
  automation: AutomationConfig;
  notifications: NotificationConfig;
  rollback: RollbackConfig;
}
```

### Repository Configuration

```typescript
interface RepositoryConfig {
  owner: string;              // GitHub owner/organization
  name: string;               // Repository name
  defaultBranch: string;      // Default branch (usually 'main')
  releaseBranches: string[];  // Branches allowed for releases
  protectedBranches: string[]; // Protected branches requiring approval
  monorepo: boolean;          // Whether this is a monorepo
  workspaces?: string[];      // Workspace patterns for monorepos
}
```

### Versioning Configuration

```typescript
interface VersioningConfig {
  scheme: 'semver' | 'calver' | 'custom';  // Versioning scheme
  initialVersion: string;                   // Starting version
  prereleasePattern?: string;              // Pattern for prerelease versions
  channels: VersionChannel[];              // Release channels configuration
  allowPrereleasePromotion: boolean;       // Allow promoting prereleases
  strictMode: boolean;                     // Enforce strict semver
}
```

## Examples

### Basic Release Workflow

```typescript
import { 
  ComprehensiveReleaseManager,
  ReleaseType,
  ReleaseChannel 
} from '@ast-copilot-helper/release-management';

async function performRelease() {
  const manager = new ComprehensiveReleaseManager();
  
  // Initialize with configuration
  await manager.initialize({
    repository: {
      owner: 'myorg',
      name: 'myproject',
      defaultBranch: 'main',
      releaseBranches: ['main'],
      protectedBranches: ['main'],
      monorepo: false
    },
    versioning: {
      scheme: 'semver',
      initialVersion: '1.0.0',
      channels: [{
        name: ReleaseChannel.STABLE,
        pattern: 'stable',
        autoPublish: true,
        requiresApproval: false
      }],
      allowPrereleasePromotion: true,
      strictMode: true
    },
    // ... other configuration
  });

  try {
    // Plan the release
    const plan = await manager.planRelease('1.1.0', ReleaseType.MINOR);
    console.log(`Planned release ${plan.version} with ${plan.changes.length} changes`);

    // Validate the plan
    const validation = await manager.validateRelease(plan);
    if (!validation.success) {
      console.error('Validation failed:', validation.errors);
      return;
    }

    // Execute the release
    const result = await manager.executeRelease(plan);
    if (result.success) {
      console.log(`✅ Release ${result.version} completed successfully!`);
      console.log(`📦 Generated ${result.artifacts?.length || 0} artifacts`);
      console.log(`🚀 Published to ${result.publishResults?.length || 0} platforms`);
    } else {
      console.error('❌ Release failed:', result.error);
    }

  } catch (error) {
    console.error('Release process failed:', error);
  }
}
```

### Automated Changelog Generation

```typescript
async function generateChangelog() {
  const manager = new ComprehensiveReleaseManager();
  await manager.initialize(config);

  // Generate changelog between versions
  const changelog = await manager.generateChangelog('1.0.0', '1.1.0');
  
  console.log('# Changelog\n');
  console.log(`## ${changelog.version} - ${changelog.date.toISOString().split('T')[0]}\n`);
  
  // Group by type
  const features = changelog.newFeatures;
  const bugfixes = changelog.bugFixes;
  const breaking = changelog.breakingChanges;

  if (features.length > 0) {
    console.log('### 🚀 New Features\n');
    features.forEach(entry => {
      console.log(`- ${entry.description} ${entry.scope ? `(${entry.scope})` : ''}`);
    });
    console.log();
  }

  if (bugfixes.length > 0) {
    console.log('### 🐛 Bug Fixes\n');
    bugfixes.forEach(entry => {
      console.log(`- ${entry.description} ${entry.scope ? `(${entry.scope})` : ''}`);
    });
    console.log();
  }

  if (breaking.length > 0) {
    console.log('### ⚠️ BREAKING CHANGES\n');
    breaking.forEach(entry => {
      console.log(`- ${entry.description}`);
    });
    console.log();
  }
}
```

### Compatibility Checking

```typescript
async function checkCompatibility() {
  const manager = new ComprehensiveReleaseManager();
  await manager.initialize(config);

  const report = await manager.checkBackwardCompatibility('2.0.0', '1.5.0');
  
  console.log(`Compatibility Check: ${report.baseVersion} → ${report.newVersion}`);
  console.log(`Compatible: ${report.compatible ? '✅' : '❌'}`);
  
  if (report.breakingChanges.length > 0) {
    console.log('\n🚨 Breaking Changes Found:');
    report.breakingChanges.forEach(change => {
      console.log(`- ${change.description}`);
      console.log(`  Severity: ${change.severity}`);
      console.log(`  Migration: ${change.migration}`);
      console.log();
    });
  }

  if (report.migrationRequired && report.migrationGuide) {
    console.log('📋 Migration Guide:');
    console.log(report.migrationGuide.description);
    report.migrationGuide.steps.forEach((step, i) => {
      console.log(`${i + 1}. ${step.description}`);
    });
  }
}
```

### Multi-Platform Publishing

```typescript
const config = {
  // ... other config
  platforms: [
    {
      name: 'npm',
      enabled: true,
      config: {
        registry: 'https://registry.npmjs.org/',
        access: 'public'
      },
      requirements: ['build', 'test'],
      artifacts: ['dist/**', 'package.json']
    },
    {
      name: 'github-releases',
      enabled: true,
      config: {
        owner: 'myorg',
        repo: 'myproject',
        generateNotes: true
      },
      requirements: ['changelog'],
      artifacts: ['dist.zip']
    },
    {
      name: 'vscode-marketplace',
      enabled: true,
      config: {
        publisher: 'mypublisher'
      },
      requirements: ['package'],
      artifacts: ['*.vsix']
    }
  ]
};
```

## Best Practices

### 1. Version Planning

- Use semantic versioning consistently
- Plan major version changes carefully
- Create prereleases for testing
- Document breaking changes thoroughly

### 2. Changelog Management

- Use conventional commits for automated changelog generation
- Include scope information in commit messages
- Document breaking changes in commit body
- Review generated changelogs before publishing

### 3. Compatibility Checking

- Always run compatibility checks before major releases
- Generate migration guides for breaking changes
- Test backward compatibility with real-world scenarios
- Consider deprecation warnings before removing APIs

### 4. Testing Strategy

- Validate release plans before execution
- Test releases in staging environments
- Use automated rollback triggers for failed releases
- Monitor post-release metrics and health checks

### 5. Multi-Platform Coordination

- Configure platform-specific requirements
- Use consistent versioning across all platforms
- Coordinate release timing for synchronized publishing
- Have rollback procedures for each platform

### 6. Error Handling

- Always handle release failures gracefully
- Implement comprehensive logging and monitoring
- Use rollback capabilities when issues are detected
- Maintain backup strategies for critical releases

## Error Handling

The release management system provides comprehensive error handling:

```typescript
try {
  const result = await manager.executeRelease(plan);
  if (!result.success) {
    // Handle execution failure
    console.error('Release failed:', result.error);
    
    // Attempt rollback if enabled
    if (config.rollback.enabled) {
      const rollback = await manager.rollbackRelease(plan.version, result.error);
      if (rollback.success) {
        console.log('Successfully rolled back release');
      }
    }
  }
} catch (error) {
  // Handle unexpected errors
  console.error('Unexpected error during release:', error);
}
```

## Type Definitions

For complete type definitions, see the [types.ts](./types.ts) file which includes:

- `ReleaseConfig` - Complete configuration interface
- `ReleasePlan` - Release plan structure
- `ReleaseResult` - Release execution result
- `ValidationResult` - Validation outcome
- `Changelog` - Changelog structure
- `CompatibilityReport` - Compatibility analysis
- And many more interfaces for comprehensive type safety