import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ChangelogGeneratorImpl } from '../core/changelog-generator.js';
import { ChangelogConfig, ChangelogEntry } from '../types.js';

describe('ChangelogGeneratorImpl', () => {
  let changelogGenerator: ChangelogGeneratorImpl;
  let mockConfig: ChangelogConfig;

  beforeEach(async () => {
    mockConfig = {
      format: 'conventional',
      sections: [
        { title: 'Features', types: ['feat'] },
        { title: 'Bug Fixes', types: ['fix'] },
        { title: 'Documentation', types: ['docs'] },
        { title: 'Performance', types: ['perf'] },
        { title: 'Refactoring', types: ['refactor'] }
      ],
      includeCommitLinks: true,
      includeAuthor: true,
      excludeTypes: ['chore', 'style'],
      customTemplate: undefined
    };

    changelogGenerator = new ChangelogGeneratorImpl();
    await changelogGenerator.initialize(mockConfig);
  });

  describe('change detection', () => {
    test('should detect changes since version', async () => {
      // Mock git operations
      vi.mock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          const mockCommits = `commit abc123
Author: Test Author <test@example.com>
Date: 2024-01-01

feat: add new feature

commit def456  
Author: Another Author <another@example.com>
Date: 2024-01-02

fix: resolve bug`;
          callback(null, { stdout: mockCommits });
        })
      }));

      const changes = await changelogGenerator.detectChangesSince('1.0.0');
      
      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle git command failures', async () => {
      vi.mock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          callback(new Error('Git command failed'), null);
        })
      }));

      await expect(changelogGenerator.detectChangesSince('1.0.0'))
        .rejects.toThrow('Git command failed');
    });
  });

  describe('commit parsing', () => {
    test('should parse conventional commits', async () => {
      const commits = [
        'feat(auth): add OAuth2 support',
        'fix(api): resolve null pointer exception',
        'docs: update API documentation',
        'feat!: breaking change in user API',
        'chore: update dependencies'
      ];

      const entries = await changelogGenerator.parseCommits(commits);
      
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(4); // excluding 'chore'
      
      const featEntry = entries.find(e => e.type === 'feat' && e.scope === 'auth');
      expect(featEntry).toBeDefined();
      expect(featEntry?.description).toBe('add OAuth2 support');
      
      const breakingEntry = entries.find(e => e.breaking === true);
      expect(breakingEntry).toBeDefined();
    });

    test('should handle malformed commits', async () => {
      const commits = [
        'not a conventional commit',
        'random text',
        'feat: valid commit'
      ];

      const entries = await changelogGenerator.parseCommits(commits);
      
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(1); // only the valid commit
      expect(entries[0].type).toBe('feat');
    });

    test('should extract scope from commits', async () => {
      const commits = [
        'feat(core): add new core feature',
        'fix(ui): fix button styling',
        'docs(api): improve API docs'
      ];

      const entries = await changelogGenerator.parseCommits(commits);
      
      expect(entries[0].scope).toBe('core');
      expect(entries[1].scope).toBe('ui');
      expect(entries[2].scope).toBe('api');
    });

    test('should detect breaking changes', async () => {
      const commits = [
        'feat!: breaking API change',
        'fix(api)!: breaking fix',
        'feat: regular feature'
      ];

      const entries = await changelogGenerator.parseCommits(commits);
      
      expect(entries[0].breaking).toBe(true);
      expect(entries[1].breaking).toBe(true);
      expect(entries[2].breaking).toBe(false);
    });
  });

  describe('change categorization', () => {
    test('should categorize commits by type', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'feat: add feature',
          author: 'Test Author',
          date: new Date('2024-01-01'),
          files: ['src/feature.ts']
        },
        {
          hash: 'def456',
          message: 'fix: fix bug',
          author: 'Test Author',
          date: new Date('2024-01-02'),
          files: ['src/bug.ts']
        },
        {
          hash: 'ghi789',
          message: 'docs: update docs',
          author: 'Test Author',
          date: new Date('2024-01-03'),
          files: ['README.md']
        }
      ];

      const entries = await changelogGenerator.categorizeChanges(mockCommits);
      
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.some(e => e.type === 'feat')).toBe(true);
      expect(entries.some(e => e.type === 'fix')).toBe(true);
      expect(entries.some(e => e.type === 'docs')).toBe(true);
    });

    test('should exclude configured types', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'chore: update dependencies',
          author: 'Test Author',
          date: new Date(),
          files: ['package.json']
        },
        {
          hash: 'def456',
          message: 'feat: add feature',
          author: 'Test Author',
          date: new Date(),
          files: ['src/feature.ts']
        }
      ];

      const entries = await changelogGenerator.categorizeChanges(mockCommits);
      
      expect(entries.some(e => e.type === 'chore')).toBe(false);
      expect(entries.some(e => e.type === 'feat')).toBe(true);
    });
  });

  describe('changelog formatting', () => {
    test('should format changelog in conventional format', async () => {
      const entries: ChangelogEntry[] = [
        {
          type: 'feat',
          scope: 'auth',
          description: 'add OAuth2 support',
          breaking: false,
          author: 'Test Author',
          commit: 'abc123',
          timestamp: new Date('2024-01-01'),
          affectedPackages: ['auth']
        },
        {
          type: 'fix',
          description: 'resolve null pointer',
          breaking: false,
          author: 'Another Author',
          commit: 'def456',
          timestamp: new Date('2024-01-02'),
          affectedPackages: ['core']
        }
      ];

      const formatted = await changelogGenerator.formatChangelog(entries);
      
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('Features');
      expect(formatted).toContain('Bug Fixes');
      expect(formatted).toContain('add OAuth2 support');
      expect(formatted).toContain('resolve null pointer');
    });

    test('should include commit links when configured', async () => {
      const entries: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'add feature',
          breaking: false,
          commit: 'abc123',
          timestamp: new Date(),
          affectedPackages: []
        }
      ];

      const formatted = await changelogGenerator.formatChangelog(entries);
      
      expect(formatted).toContain('abc123');
    });

    test('should include author information when configured', async () => {
      const entries: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'add feature',
          breaking: false,
          author: 'Test Author',
          timestamp: new Date(),
          affectedPackages: []
        }
      ];

      const formatted = await changelogGenerator.formatChangelog(entries);
      
      expect(formatted).toContain('Test Author');
    });
  });

  describe('entry generation', () => {
    test('should generate structured entries', async () => {
      const changes: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'raw feature',
          breaking: false,
          timestamp: new Date(),
          affectedPackages: []
        }
      ];

      const entries = await changelogGenerator.generateEntries(changes);
      
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe('feat');
      expect(entries[0].description).toBe('raw feature');
    });

    test('should enrich entries with metadata', async () => {
      const changes: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'basic feature',
          breaking: false,
          timestamp: new Date(),
          affectedPackages: []
        }
      ];

      const entries = await changelogGenerator.generateEntries(changes);
      
      expect(entries[0]).toHaveProperty('timestamp');
      expect(entries[0]).toHaveProperty('affectedPackages');
    });
  });

  describe('release notes generation', () => {
    test('should generate release notes from entries', async () => {
      const entries: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'major new feature',
          breaking: true,
          timestamp: new Date(),
          affectedPackages: ['core']
        },
        {
          type: 'fix',
          description: 'critical bug fix',
          breaking: false,
          timestamp: new Date(),
          affectedPackages: ['api']
        }
      ];

      const releaseNotes = await changelogGenerator.generateReleaseNotes('1.1.0', entries);
      
      expect(releaseNotes).toBeDefined();
      expect(releaseNotes.version).toBe('1.1.0');
      expect(typeof releaseNotes.title).toBe('string');
      expect(typeof releaseNotes.description).toBe('string');
      expect(Array.isArray(releaseNotes.highlights)).toBe(true);
      expect(Array.isArray(releaseNotes.breakingChanges)).toBe(true);
      expect(releaseNotes.breakingChanges.length).toBe(1);
    });

    test('should handle empty changelog entries', async () => {
      const releaseNotes = await changelogGenerator.generateReleaseNotes('1.0.1', []);
      
      expect(releaseNotes).toBeDefined();
      expect(releaseNotes.version).toBe('1.0.1');
      expect(releaseNotes.highlights.length).toBe(0);
    });
  });

  describe('configuration handling', () => {
    test('should handle keepachangelog format', async () => {
      const keepAChangelogConfig = {
        ...mockConfig,
        format: 'keepachangelog' as const
      };

      const newGenerator = new ChangelogGeneratorImpl();
      await newGenerator.initialize(keepAChangelogConfig);
      
      const entries: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'new feature',
          breaking: false,
          timestamp: new Date(),
          affectedPackages: []
        }
      ];

      const formatted = await newGenerator.formatChangelog(entries);
      expect(formatted).toContain('Added');
    });

    test('should handle custom templates', async () => {
      const customConfig = {
        ...mockConfig,
        format: 'custom' as const,
        customTemplate: '## {version}\n### {type}\n- {description}'
      };

      const newGenerator = new ChangelogGeneratorImpl();
      await newGenerator.initialize(customConfig);
      
      const entries: ChangelogEntry[] = [
        {
          type: 'feat',
          description: 'custom feature',
          breaking: false,
          timestamp: new Date(),
          affectedPackages: []
        }
      ];

      const formatted = await newGenerator.formatChangelog(entries);
      expect(formatted).toContain('custom feature');
    });
  });
});