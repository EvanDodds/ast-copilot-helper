import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Pull Request Template', () => {
  const templatePath = join(process.cwd(), '.github', 'pull_request_template.md');

  it('should exist', () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  describe('template content structure', () => {
    let templateContent: string;

    beforeAll(() => {
      templateContent = readFileSync(templatePath, 'utf-8');
    });

    it('should have PR description section', () => {
      expect(templateContent).toContain('## Pull Request Description');
      expect(templateContent).toContain('**What does this PR do?**');
      expect(templateContent).toContain('**Related Issue(s):**');
    });

    it('should have type of change section', () => {
      expect(templateContent).toContain('## Type of Change');
      expect(templateContent).toContain('🐛 Bug fix');
      expect(templateContent).toContain('✨ New feature');
      expect(templateContent).toContain('💥 Breaking change');
      expect(templateContent).toContain('📚 Documentation update');
    });

    it('should have changes made section', () => {
      expect(templateContent).toContain('## Changes Made');
      expect(templateContent).toContain('### Added');
      expect(templateContent).toContain('### Changed');
      expect(templateContent).toContain('### Removed');
      expect(templateContent).toContain('### Fixed');
    });

    it('should have testing section', () => {
      expect(templateContent).toContain('## Testing');
      expect(templateContent).toContain('### Test Coverage');
      expect(templateContent).toContain('### Test Commands Used');
      expect(templateContent).toContain('### Testing Checklist');
    });

    it('should have documentation section', () => {
      expect(templateContent).toContain('## Documentation');
      expect(templateContent).toContain('README.md updated');
      expect(templateContent).toContain('API documentation updated');
      expect(templateContent).toContain('CHANGELOG.md updated');
    });

    it('should have screenshots/demo section', () => {
      expect(templateContent).toContain('## Screenshots/Demo');
      expect(templateContent).toContain('**Before:**');
      expect(templateContent).toContain('**After:**');
    });

    it('should have breaking changes section', () => {
      expect(templateContent).toContain('## Breaking Changes');
      expect(templateContent).toContain('This PR does not introduce any breaking changes');
      expect(templateContent).toContain('### What breaks?');
      expect(templateContent).toContain('### Migration path');
    });

    it('should have performance impact section', () => {
      expect(templateContent).toContain('## Performance Impact');
      expect(templateContent).toContain('No performance impact');
      expect(templateContent).toContain('Improves performance');
      expect(templateContent).toContain('May impact performance');
    });

    it('should have security considerations section', () => {
      expect(templateContent).toContain('## Security Considerations');
      expect(templateContent).toContain('No security implications');
      expect(templateContent).toContain('Security review needed');
      expect(templateContent).toContain('This fixes a security issue');
    });

    it('should have deployment notes section', () => {
      expect(templateContent).toContain('## Deployment Notes');
      expect(templateContent).toContain('No special deployment requirements');
      expect(templateContent).toContain('Database migrations required');
      expect(templateContent).toContain('Environment variables changes needed');
    });

    it('should have comprehensive checklist', () => {
      expect(templateContent).toContain('## Checklist');
      expect(templateContent).toContain('### Code Quality');
      expect(templateContent).toContain('### Testing');
      expect(templateContent).toContain('### Documentation');
      expect(templateContent).toContain('### Review');
    });

    it('should have review notes section', () => {
      expect(templateContent).toContain('## Review Notes');
      expect(templateContent).toContain('**Focus Areas:**');
      expect(templateContent).toContain('**Questions for Reviewers:**');
      expect(templateContent).toContain('**Known Issues/TODOs:**');
    });

    it('should have additional context section', () => {
      expect(templateContent).toContain('## Additional Context');
      expect(templateContent).toContain('**References:**');
      expect(templateContent).toContain('**Dependencies:**');
    });

    it('should end with ready for review section', () => {
      expect(templateContent).toContain('**🚀 Ready for Review**');
      expect(templateContent).toContain('This PR is ready for review');
      expect(templateContent).toContain('This PR is a work in progress');
    });
  });

  describe('template formatting', () => {
    let templateContent: string;

    beforeAll(() => {
      templateContent = readFileSync(templatePath, 'utf-8');
    });

    it('should use proper markdown headers', () => {
      const headers = templateContent.match(/^## .+$/gm) || [];
      expect(headers.length).toBeGreaterThan(8);
    });

    it('should have checkbox format for interactive elements', () => {
      const checkboxes = templateContent.match(/- \[ \]/g) || [];
      expect(checkboxes.length).toBeGreaterThan(20);
    });

    it('should contain code block examples', () => {
      expect(templateContent).toContain('```bash');
      expect(templateContent).toContain('npm test');
      expect(templateContent).toContain('npm run test:integration');
    });

    it('should have proper comment sections', () => {
      const comments = templateContent.match(/<!-- .+ -->/g) || [];
      expect(comments.length).toBeGreaterThan(10);
    });

    it('should use emojis for visual clarity', () => {
      expect(templateContent).toContain('🐛');
      expect(templateContent).toContain('✨');
      expect(templateContent).toContain('💥');
      expect(templateContent).toContain('📚');
      expect(templateContent).toContain('🚀');
    });
  });
});