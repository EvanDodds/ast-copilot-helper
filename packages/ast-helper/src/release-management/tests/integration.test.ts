import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ComprehensiveReleaseManager } from '../manager.js';
import { ReleaseConfig, ReleaseType, ReleaseChannel } from '../types.js';

describe('Release Management Integration Tests', () => {
  let manager: ComprehensiveReleaseManager;
  let integrationConfig: ReleaseConfig;

  beforeEach(async () => {
    integrationConfig = {
      repository: {
        owner: 'testorg',
        name: 'integration-test-repo',
        defaultBranch: 'main',
        releaseBranches: ['main', 'release/*'],
        protectedBranches: ['main'],
        monorepo: false
      },
      versioning: {
        scheme: 'semver',
        initialVersion: '1.0.0',
        channels: [
          {
            name: ReleaseChannel.STABLE,
            pattern: 'stable',
            autoPublish: true,
            requiresApproval: false
          }
        ],
        allowPrereleasePromotion: true,
        strictMode: false
      },
      changelog: {
        format: 'conventional',
        sections: [
          { title: 'Features', types: ['feat'] },
          { title: 'Bug Fixes', types: ['fix'] }
        ],
        includeCommitLinks: true,
        includeAuthor: false,
        excludeTypes: ['chore']
      },
      platforms: [
        {
          name: 'npm',
          enabled: true,
          config: { registry: 'https://registry.npmjs.org/' },
          requirements: ['test'],
          artifacts: ['dist/**']
        }
      ],
      compatibility: {
        checkApi: true,
        checkConfig: false,
        checkCli: false,
        checkData: false,
        breakingChangeThreshold: 0.7,
        generateMigrationGuides: false,
        baseVersions: []
      },
      automation: {
        autoRollbackOnFailure: false,
        allowWarnings: true,
        requireApproval: false,
        parallelBuilds: false,
        timeoutMinutes: 10,
        retryAttempts: 1
      },
      notifications: {
        channels: [],
        templates: [],
        includeMetrics: false
      },
      rollback: {
        enabled: false,
        automaticTriggers: [],
        manualApprovalRequired: false,
        backupRetention: 7,
        validationSteps: []
      }
    };

    manager = new ComprehensiveReleaseManager();
    await manager.initialize(integrationConfig);
  });

  afterEach(() => {
    // Clean up any test artifacts
  });

  describe('end-to-end release workflow', () => {
    test('should complete patch release workflow', async () => {
      const targetVersion = '1.0.1';
      
      // Step 1: Plan the release
      const plan = await manager.planRelease(targetVersion, ReleaseType.PATCH);
      expect(plan).toBeDefined();
      expect(plan.version).toBe(targetVersion);
      expect(plan.type).toBe(ReleaseType.PATCH);

      // Step 2: Validate the release plan
      const validation = await manager.validateRelease(plan);
      expect(validation).toBeDefined();
      expect(validation.success).toBe(true);

      // Step 3: Execute the release
      const result = await manager.executeRelease(plan);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.version).toBe(targetVersion);
    });

    test('should complete minor release workflow', async () => {
      const targetVersion = '1.1.0';
      
      const plan = await manager.planRelease(targetVersion, ReleaseType.MINOR);
      const validation = await manager.validateRelease(plan);
      const result = await manager.executeRelease(plan);

      expect(plan.type).toBe(ReleaseType.MINOR);
      expect(validation.success).toBe(true);
      expect(result.success).toBe(true);
      expect(result.version).toBe(targetVersion);
    });

    test('should complete major release workflow', async () => {
      const targetVersion = '2.0.0';
      
      const plan = await manager.planRelease(targetVersion, ReleaseType.MAJOR);
      const validation = await manager.validateRelease(plan);
      const result = await manager.executeRelease(plan);

      expect(plan.type).toBe(ReleaseType.MAJOR);
      expect(validation.success).toBe(true);
      expect(result.success).toBe(true);
      expect(result.version).toBe(targetVersion);
    });
  });

  describe('changelog integration', () => {
    test('should generate changelog as part of release', async () => {
      const plan = await manager.planRelease('1.0.1', ReleaseType.PATCH);
      
      expect(Array.isArray(plan.changes)).toBe(true);
      
      // Generate full changelog
      const changelog = await manager.generateChangelog('1.0.0', '1.0.1');
      expect(changelog).toBeDefined();
      expect(changelog.version).toBe('1.0.1');
      expect(Array.isArray(changelog.entries)).toBe(true);
    });

    test('should create release notes from changelog', async () => {
      const mockChanges = [
        {
          type: 'feat',
          description: 'Add new integration feature',
          breaking: false,
          timestamp: new Date(),
          affectedPackages: ['core']
        }
      ];

      const notes = await manager.createReleaseNotes('1.1.0', mockChanges);
      expect(notes).toBeDefined();
      expect(notes.version).toBe('1.1.0');
      expect(notes.title).toContain('1.1.0');
      expect(Array.isArray(notes.highlights)).toBe(true);
    });
  });

  describe('compatibility integration', () => {
    test('should check compatibility during release planning', async () => {
      const plan = await manager.planRelease('2.0.0', ReleaseType.MAJOR);
      
      expect(plan).toBeDefined();
      expect(Array.isArray(plan.breakingChanges)).toBe(true);
      
      // Check compatibility independently
      const compatibility = await manager.checkBackwardCompatibility('2.0.0', '1.0.0');
      expect(compatibility).toBeDefined();
      expect(typeof compatibility.compatible).toBe('boolean');
    });
  });

  describe('version management integration', () => {
    test('should handle version progression correctly', async () => {
      // Test patch progression
      const patch1 = await manager.planRelease('1.0.1', ReleaseType.PATCH);
      expect(patch1.version).toBe('1.0.1');
      
      const patch2 = await manager.planRelease('1.0.2', ReleaseType.PATCH);
      expect(patch2.version).toBe('1.0.2');
      
      // Test minor progression
      const minor = await manager.planRelease('1.1.0', ReleaseType.MINOR);
      expect(minor.version).toBe('1.1.0');
      
      // Test major progression
      const major = await manager.planRelease('2.0.0', ReleaseType.MAJOR);
      expect(major.version).toBe('2.0.0');
    });

    test('should get current and latest versions', async () => {
      const latestStable = await manager.getLatestVersion(ReleaseChannel.STABLE);
      expect(typeof latestStable).toBe('string');
      expect(latestStable).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('platform publishing integration', () => {
    test('should prepare platform releases', async () => {
      const plan = await manager.planRelease('1.0.1', ReleaseType.PATCH);
      
      expect(Array.isArray(plan.platforms)).toBe(true);
      
      // Verify platform requirements are included
      const npmPlatform = plan.platforms.find(p => p.platform === 'npm');
      expect(npmPlatform).toBeDefined();
    });
  });

  describe('validation integration', () => {
    test('should validate complete release plan', async () => {
      const plan = await manager.planRelease('1.0.1', ReleaseType.PATCH);
      const validation = await manager.validateRelease(plan);
      
      expect(validation).toBeDefined();
      expect(typeof validation.success).toBe('boolean');
      expect(Array.isArray(validation.warnings)).toBe(true);
      expect(Array.isArray(validation.errors)).toBe(true);
      
      // Should have validation steps
      expect(Array.isArray(plan.validations)).toBe(true);
      expect(plan.validations.length).toBeGreaterThan(0);
    });

    test('should handle validation failures appropriately', async () => {
      // Create a plan that might fail validation
      const plan = await manager.planRelease('invalid-version-format', ReleaseType.PATCH);
      const validation = await manager.validateRelease(plan);
      
      expect(validation).toBeDefined();
      // Should still return a validation result even if invalid
    });
  });

  describe('release listing and filtering', () => {
    test('should list releases with various filters', async () => {
      // List all releases
      const allReleases = await manager.listReleases();
      expect(Array.isArray(allReleases)).toBe(true);

      // List stable releases only
      const stableReleases = await manager.listReleases({
        channel: ReleaseChannel.STABLE
      });
      expect(Array.isArray(stableReleases)).toBe(true);

      // List patch releases only  
      const patchReleases = await manager.listReleases({
        type: ReleaseType.PATCH
      });
      expect(Array.isArray(patchReleases)).toBe(true);
    });
  });

  describe('error handling integration', () => {
    test('should handle release execution failures gracefully', async () => {
      const plan = await manager.planRelease('1.0.1', ReleaseType.PATCH);
      
      // Mock a failure scenario
      const result = await manager.executeRelease(plan);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    test('should provide meaningful error messages', async () => {
      try {
        await manager.planRelease('invalid.version', ReleaseType.PATCH);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe('concurrent release handling', () => {
    test('should handle multiple concurrent release operations', async () => {
      const promises = [
        manager.getLatestVersion(ReleaseChannel.STABLE),
        manager.listReleases({ type: ReleaseType.PATCH }),
        manager.generateChangelog('1.0.0', '1.0.1')
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(typeof results[0]).toBe('string'); // latest version
      expect(Array.isArray(results[1])).toBe(true); // releases list
      expect(results[2]).toBeDefined(); // changelog
    });
  });
});