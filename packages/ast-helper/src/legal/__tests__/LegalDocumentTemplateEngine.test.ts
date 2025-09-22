import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import {
  LegalDocumentTemplateEngine,
  DocumentType,
  TemplateVariables,
  TemplateMetadata,
  DocumentGenerationOptions
} from '../LegalDocumentTemplateEngine';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

describe('LegalDocumentTemplateEngine', () => {
  let engine: LegalDocumentTemplateEngine;

  beforeEach(() => {
    engine = new LegalDocumentTemplateEngine();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(engine).toBeDefined();
    });

    it('should load built-in templates', () => {
      const templates = engine.getAvailableTemplates();
      expect(templates).toHaveLength(3);
      
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('privacy-policy-standard');
      expect(templateIds).toContain('terms-of-service-saas');
      expect(templateIds).toContain('cookie-policy-standard');
    });

    it('should organize templates by type', () => {
      const privacyTemplates = engine.getTemplatesByType('privacy-policy');
      const termsTemplates = engine.getTemplatesByType('terms-of-service');
      const cookieTemplates = engine.getTemplatesByType('cookie-policy');

      expect(privacyTemplates).toHaveLength(1);
      expect(termsTemplates).toHaveLength(1);
      expect(cookieTemplates).toHaveLength(1);
    });
  });

  describe('template management', () => {
    it('should register custom templates', () => {
      const metadata: TemplateMetadata = {
        id: 'custom-test',
        name: 'Custom Test Template',
        description: 'A test template',
        type: 'custom',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test Author',
        language: 'en',
        requiredVariables: ['testVar'],
        optionalVariables: ['optionalVar'],
        tags: ['test']
      };

      const content = '# {{testVar}}\n\nThis is a test template.';
      
      engine.registerTemplate(metadata, content);
      
      const retrievedTemplate = engine.getTemplate('custom-test');
      expect(retrievedTemplate).toEqual(metadata);
    });

    it('should retrieve templates by ID', () => {
      const template = engine.getTemplate('privacy-policy-standard');
      expect(template).toBeDefined();
      expect(template?.id).toBe('privacy-policy-standard');
      expect(template?.type).toBe('privacy-policy');
    });

    it('should return undefined for non-existent templates', () => {
      const template = engine.getTemplate('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('template validation', () => {
    it('should validate required variables', () => {
      const variables: TemplateVariables = {
        companyName: 'Test Company',
        contactEmail: 'test@example.com',
        lastUpdated: new Date(),
        dataTypes: ['name', 'email'],
        purposes: ['communication', 'analytics']
      };

      const result = engine.validateTemplate('privacy-policy-standard', variables);
      
      expect(result.isValid).toBe(true);
      expect(result.missingVariables).toHaveLength(0);
      expect(result.invalidVariables).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const variables: TemplateVariables = {
        companyName: 'Test Company'
        // Missing other required variables
      };

      const result = engine.validateTemplate('privacy-policy-standard', variables);
      
      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toContain('contactEmail');
      expect(result.missingVariables).toContain('lastUpdated');
      expect(result.missingVariables).toContain('dataTypes');
      expect(result.missingVariables).toContain('purposes');
    });

    it('should validate email format', () => {
      const variables: TemplateVariables = {
        companyName: 'Test Company',
        contactEmail: 'invalid-email',
        lastUpdated: new Date(),
        dataTypes: ['name', 'email'],
        purposes: ['communication', 'analytics']
      };

      const result = engine.validateTemplate('privacy-policy-standard', variables);
      
      expect(result.isValid).toBe(false);
      expect(result.invalidVariables).toContain('contactEmail: Invalid email format');
    });

    it('should provide suggestions for optional variables', () => {
      const variables: TemplateVariables = {
        companyName: 'Test Company',
        contactEmail: 'test@example.com',
        lastUpdated: new Date(),
        dataTypes: ['name', 'email'],
        purposes: ['communication', 'analytics']
      };

      const result = engine.validateTemplate('privacy-policy-standard', variables);
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('companyAddress'))).toBe(true);
    });

    it('should handle non-existent template', () => {
      expect(() => {
        engine.validateTemplate('non-existent', {});
      }).toThrow('Template not found: non-existent');
    });
  });

  describe('document generation', () => {
    const validVariables: TemplateVariables = {
      companyName: 'Acme Corp',
      contactEmail: 'legal@acme.com',
      lastUpdated: new Date('2024-01-01'),
      dataTypes: ['Personal information', 'Usage data'],
      purposes: ['Service provision', 'Analytics', 'Communication']
    };

    it('should generate privacy policy document', async () => {
      const result = await engine.generateDocument(
        'privacy-policy-standard',
        validVariables
      );

      expect(result).toBeDefined();
      expect(result.format).toBe('markdown');
      expect(result.content).toContain('# Privacy Policy');
      expect(result.content).toContain('Acme Corp');
      expect(result.content).toContain('legal@acme.com');
      expect(result.content).toContain('Personal information');
      expect(result.content).toContain('Service provision');
      expect(result.metadata.templateId).toBe('privacy-policy-standard');
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.metadata.estimatedReadingTime).toBeGreaterThan(0);
    });

    it('should generate terms of service document', async () => {
      const tosVariables: TemplateVariables = {
        serviceName: 'Acme Platform',
        companyName: 'Acme Corp',
        contactEmail: 'legal@acme.com',
        lastUpdated: new Date('2024-01-01')
      };

      const result = await engine.generateDocument(
        'terms-of-service-saas',
        tosVariables
      );

      expect(result.content).toContain('# Terms of Service');
      expect(result.content).toContain('Acme Platform');
      expect(result.content).toContain('Acme Corp');
      expect(result.content).toContain('legal@acme.com');
    });

    it('should generate cookie policy document', async () => {
      const cookieVariables: TemplateVariables = {
        websiteName: 'acme.com',
        companyName: 'Acme Corp',
        contactEmail: 'privacy@acme.com',
        cookieTypes: ['Essential cookies', 'Analytics cookies', 'Marketing cookies']
      };

      const result = await engine.generateDocument(
        'cookie-policy-standard',
        cookieVariables
      );

      expect(result.content).toContain('# Cookie Policy');
      expect(result.content).toContain('acme.com');
      expect(result.content).toContain('Essential cookies');
    });

    it('should handle HTML output format', async () => {
      const options: DocumentGenerationOptions = {
        outputFormat: 'html',
        includeLastModified: true,
        includeGeneratedBy: true
      };

      const result = await engine.generateDocument(
        'privacy-policy-standard',
        validVariables,
        options
      );

      expect(result.format).toBe('html');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('<h1>');
      expect(result.content).toContain('</h1>');
      expect(result.content).toContain('Last modified:');
      expect(result.content).toContain('Generated by AST Legal Compliance Framework');
    });

    it('should handle plain text output format', async () => {
      const options: DocumentGenerationOptions = {
        outputFormat: 'plain-text'
      };

      const result = await engine.generateDocument(
        'privacy-policy-standard',
        validVariables,
        options
      );

      expect(result.format).toBe('plain-text');
      expect(result.content).not.toContain('#');
      expect(result.content).not.toContain('**');
      expect(result.content).not.toContain('*');
    });

    it('should throw error for PDF format', async () => {
      const options: DocumentGenerationOptions = {
        outputFormat: 'pdf'
      };

      await expect(
        engine.generateDocument('privacy-policy-standard', validVariables, options)
      ).rejects.toThrow('PDF output not yet implemented');
    });

    it('should handle validation failure', async () => {
      const invalidVariables: TemplateVariables = {
        companyName: 'Test Company'
        // Missing required variables
      };

      await expect(
        engine.generateDocument('privacy-policy-standard', invalidVariables)
      ).rejects.toThrow('Template validation failed');
    });

    it('should handle non-existent template', async () => {
      await expect(
        engine.generateDocument('non-existent', validVariables)
      ).rejects.toThrow('Template not found: non-existent');
    });
  });

  describe('template processing', () => {
    beforeEach(() => {
      // Register a test template for processing tests
      const testMetadata: TemplateMetadata = {
        id: 'test-processing',
        name: 'Test Processing Template',
        description: 'Template for testing variable processing',
        type: 'custom',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test',
        language: 'en',
        requiredVariables: ['name'],
        optionalVariables: [],
        tags: ['test']
      };

      const testContent = `
# Hello {{name}}!

{{#if premium}}
You have premium access.
{{/if}}

{{#each features}}
- {{this}}
{{/each}}

Contact: {{formatDate:lastUpdated}}
      `.trim();

      engine.registerTemplate(testMetadata, testContent);
    });

    it('should process simple variable substitution', async () => {
      const variables: TemplateVariables = {
        name: 'John Doe'
      };

      const result = await engine.generateDocument('test-processing', variables);
      expect(result.content).toContain('Hello John Doe!');
    });

    it('should process conditional blocks', async () => {
      const variables: TemplateVariables = {
        name: 'John',
        premium: true
      };

      const result = await engine.generateDocument('test-processing', variables);
      expect(result.content).toContain('You have premium access.');

      const variablesNoPremium: TemplateVariables = {
        name: 'John',
        premium: false
      };

      const resultNoPremium = await engine.generateDocument('test-processing', variablesNoPremium);
      expect(resultNoPremium.content).not.toContain('You have premium access.');
    });

    it('should process loop blocks', async () => {
      const variables: TemplateVariables = {
        name: 'John',
        features: ['Feature 1', 'Feature 2', 'Feature 3']
      };

      const result = await engine.generateDocument('test-processing', variables);
      expect(result.content).toContain('- Feature 1');
      expect(result.content).toContain('- Feature 2');
      expect(result.content).toContain('- Feature 3');
    });

    it('should handle array variable substitution', async () => {
      const variables: TemplateVariables = {
        name: 'John',
        tags: ['tag1', 'tag2', 'tag3']
      };

      // Register template with array substitution
      const arrayTemplate = 'Tags: {{tags}}';
      engine.registerTemplate({
        id: 'array-test',
        name: 'Array Test',
        description: 'Test array substitution',
        type: 'custom',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test',
        language: 'en',
        requiredVariables: ['name'],
        optionalVariables: [],
        tags: ['test']
      }, arrayTemplate);

      const result = await engine.generateDocument('array-test', variables);
      expect(result.content).toContain('tag1, tag2, tag3');
    });

    it('should handle date variable substitution', async () => {
      const testDate = new Date('2024-01-15');
      const variables: TemplateVariables = {
        name: 'John',
        lastUpdated: testDate
      };

      // Register template with date substitution
      const dateTemplate = 'Updated: {{lastUpdated}}';
      engine.registerTemplate({
        id: 'date-test',
        name: 'Date Test',
        description: 'Test date substitution',
        type: 'custom',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test',
        language: 'en',
        requiredVariables: ['name'],
        optionalVariables: [],
        tags: ['test']
      }, dateTemplate);

      const result = await engine.generateDocument('date-test', variables);
      // Check that it contains a date string (format may vary by locale)
      expect(result.content).toMatch(/Updated: \d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('file operations', () => {
    it('should load template from file', async () => {
      const mockContent = `---
{
  "id": "loaded-template",
  "name": "Loaded Template",
  "description": "Template loaded from file",
  "type": "custom",
  "version": "1.0.0",
  "lastModified": "2024-01-01T00:00:00.000Z",
  "author": "File Author",
  "language": "en",
  "requiredVariables": ["testVar"],
  "optionalVariables": [],
  "tags": ["file"]
}
---
# {{testVar}}

This template was loaded from a file.`;

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      await engine.loadTemplateFromFile('/path/to/template.md');

      const template = engine.getTemplate('loaded-template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Loaded Template');
      expect(template?.author).toBe('File Author');
    });

    it('should handle file without metadata', async () => {
      const mockContent = `# Test Template

This is a template without metadata.`;

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      await engine.loadTemplateFromFile('/path/to/simple-template.md');

      const template = engine.getTemplate('simple-template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Simple Template');
      expect(template?.type).toBe('custom');
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(
        engine.loadTemplateFromFile('/nonexistent/template.md')
      ).rejects.toThrow('File not found');
    });

    it('should save template to file', async () => {
      await engine.saveTemplateToFile('privacy-policy-standard', '/path/to/output.md');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/output.md',
        expect.stringContaining('privacy-policy-standard'),
        'utf-8'
      );
    });

    it('should handle save errors for non-existent template', async () => {
      await expect(
        engine.saveTemplateToFile('non-existent', '/path/to/output.md')
      ).rejects.toThrow('Template not found: non-existent');
    });
  });

  describe('advanced features', () => {
    it('should handle custom functions in templates', async () => {
      // The formatDate function is already tested implicitly in other tests
      // This test specifically checks function error handling

      const testTemplate = `Date: {{formatDate:invalidDate}}`;
      engine.registerTemplate({
        id: 'function-test',
        name: 'Function Test',
        description: 'Test custom functions',
        type: 'custom',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test',
        language: 'en',
        requiredVariables: [],
        optionalVariables: [],
        tags: ['test']
      }, testTemplate);

      const result = await engine.generateDocument('function-test', {
        invalidDate: 'not-a-date'
      });

      // Should handle function errors gracefully
      expect(result.content).toBeDefined();
    });

    it('should generate appropriate warnings', async () => {
      // Test EU jurisdiction warning
      const euTemplate: TemplateMetadata = {
        id: 'eu-template',
        name: 'EU Template',
        description: 'Template for EU jurisdiction',
        type: 'privacy-policy',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test',
        jurisdiction: 'EU',
        language: 'en',
        requiredVariables: ['companyName'],
        optionalVariables: [],
        tags: ['eu', 'gdpr']
      };

      engine.registerTemplate(euTemplate, '# {{companyName}} Privacy Policy');

      const validation = engine.validateTemplate('eu-template', {
        companyName: 'Test Company'
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('GDPR'))).toBe(true);
    });

    it('should estimate reading time correctly', async () => {
      const variables: TemplateVariables = {
        companyName: 'Acme Corp',
        contactEmail: 'legal@acme.com',
        lastUpdated: new Date('2024-01-01'),
        dataTypes: ['Personal information', 'Usage data'],
        purposes: ['Service provision', 'Analytics', 'Communication']
      };

      const result = await engine.generateDocument(
        'privacy-policy-standard',
        variables
      );

      expect(result.metadata.estimatedReadingTime).toBeGreaterThan(0);
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      // Roughly 200 words per minute
      expect(result.metadata.estimatedReadingTime).toBe(
        Math.ceil(result.metadata.wordCount / 200)
      );
    });
  });

  describe('HTML output formatting', () => {
    it('should generate proper HTML structure', async () => {
      const variables: TemplateVariables = {
        companyName: 'Test Company',
        contactEmail: 'test@example.com',
        lastUpdated: new Date(),
        dataTypes: ['name', 'email'],
        purposes: ['communication']
      };

      const options: DocumentGenerationOptions = {
        outputFormat: 'html',
        customStyles: 'body { font-size: 16px; }',
        headerFooter: {
          header: '<div>Custom Header</div>',
          footer: '<div>Custom Footer</div>'
        }
      };

      const result = await engine.generateDocument(
        'privacy-policy-standard',
        variables,
        options
      );

      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('<html lang="en">');
      expect(result.content).toContain('body { font-size: 16px; }');
      expect(result.content).toContain('Custom Header');
      expect(result.content).toContain('Custom Footer');
      expect(result.content).toContain('<h1>');
      expect(result.content).toContain('<p>');
    });

    it('should handle markdown to HTML conversion', async () => {
      const testTemplate = `# Main Title

## Subtitle

**Bold text** and *italic text*.

Regular paragraph text.`;

      engine.registerTemplate({
        id: 'html-test',
        name: 'HTML Test',
        description: 'Test HTML conversion',
        type: 'custom',
        version: '1.0.0',
        lastModified: new Date(),
        author: 'Test',
        language: 'en',
        requiredVariables: [],
        optionalVariables: [],
        tags: ['test']
      }, testTemplate);

      const options: DocumentGenerationOptions = {
        outputFormat: 'html'
      };

      const result = await engine.generateDocument('html-test', {}, options);

      expect(result.content).toContain('<h1>Main Title</h1>');
      expect(result.content).toContain('<h2>Subtitle</h2>');
      expect(result.content).toContain('<strong>Bold text</strong>');
      expect(result.content).toContain('<em>italic text</em>');
    });
  });

  describe('error handling', () => {
    it('should handle malformed metadata in file loading', async () => {
      const mockContent = `---
{
  "id": "malformed-template",
  "name": "Malformed Template"
  // This is invalid JSON
}
---
# Template content`;

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      await engine.loadTemplateFromFile('/path/to/malformed.md');

      // Should create default metadata on parsing error
      const template = engine.getTemplate('malformed');
      expect(template).toBeDefined();
      expect(template?.type).toBe('custom');
    });

    it('should handle empty metadata in file loading', async () => {
      const mockContent = `---

---
# Template content`;

      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      await engine.loadTemplateFromFile('/path/to/empty-meta.md');

      const template = engine.getTemplate('empty-meta');
      expect(template).toBeDefined();
      expect(template?.type).toBe('custom');
    });
  });
});