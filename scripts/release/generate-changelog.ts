#!/usr/bin/env tsx
/**
 * Changelog Generation Script
 * Uses the release management system to generate changelog
 */

import { ComprehensiveReleaseManager, ReleaseConfig, ReleaseChannel } from '../../packages/ast-helper/src/release-management/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';

async function generateChangelog() {
  console.log('🔄 Generating changelog...');

  try {
    // Initialize release manager
    const releaseManager = new ComprehensiveReleaseManager();
    
    const config: ReleaseConfig = {
      repository: {
        owner: 'EvanDodds',
        name: 'ast-copilot-helper',
        defaultBranch: 'main',
        releaseBranches: ['main', 'release/*'],
        protectedBranches: ['main'],
        monorepo: true,
        workspaces: ['packages/*']
      },
      versioning: {
        scheme: 'semver',
        initialVersion: '0.1.0',
        channels: [{
          name: ReleaseChannel.STABLE,
          pattern: '^v?\\d+\\.\\d+\\.\\d+$',
          autoPublish: false,
          requiresApproval: true
        }],
        allowPrereleasePromotion: true,
        strictMode: false
      },
      changelog: {
        format: 'keepachangelog',
        sections: [
          { title: 'Features', types: ['feat'] },
          { title: 'Bug Fixes', types: ['fix'] },
          { title: 'Documentation', types: ['docs'] },
          { title: 'Performance', types: ['perf'] }
        ],
        includeCommitLinks: true,
        includeAuthor: true,
        excludeTypes: ['test', 'chore']
      },
      platforms: [],
      compatibility: {
        checkApi: true,
        checkConfig: true,
        checkCli: true,
        checkData: true,
        breakingChangeThreshold: 1,
        generateMigrationGuides: true,
        baseVersions: ['0.1.0']
      },
      automation: {
        autoRollbackOnFailure: false,
        allowWarnings: true,
        requireApproval: true,
        parallelBuilds: false,
        timeoutMinutes: 30,
        retryAttempts: 3
      },
      notifications: {
        channels: [],
        templates: [],
        includeMetrics: false
      },
      rollback: {
        enabled: true,
        automaticTriggers: [],
        manualApprovalRequired: true,
        backupRetention: 7,
        validationSteps: []
      }
    };

    await releaseManager.initialize(config);

    // Get current version from package.json
    const rootPackageJson = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
    const currentVersion = rootPackageJson.version || '0.0.0';

    // Generate changelog from last version to current
    const lastVersion = await releaseManager.getLatestVersion(ReleaseChannel.STABLE).catch(() => '0.0.0');
    const changelog = await releaseManager.generateChangelog(lastVersion, currentVersion);

    if (changelog) {
      console.log('✅ Changelog generated successfully');
      console.log(`📝 Version: ${changelog.version}`);
      console.log(`📅 Date: ${changelog.date}`);
      
      if (changelog.entries.length > 0) {
        console.log(`📊 Generated ${changelog.entries.length} changelog entries`);
      }

      // Write changelog to file
      const changelogPath = './CHANGELOG.md';
      await fs.writeFile(changelogPath, changelog.rawContent);
      console.log(`📝 Changelog written to: ${changelogPath}`);
    } else {
      console.error('❌ No changelog generated');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error generating changelog:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateChangelog().catch(console.error);
}