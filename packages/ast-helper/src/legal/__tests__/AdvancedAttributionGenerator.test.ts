/**
 * @fileoverview Tests for AdvancedAttributionGenerator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  AdvancedAttributionGenerator, 
  AdvancedAttributionConfig,
  AttributionTemplate,
  AttributionGrouping,
  AttributionFilter
} from '../AdvancedAttributionGenerator.js';
import { DependencyLicense } from '../types.js';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn()
  }
}));

describe('AdvancedAttributionGenerator', () => {
  let generator: AdvancedAttributionGenerator;
  let config: AdvancedAttributionConfig;
  let testDependencies: DependencyLicense[];

  beforeEach(() => {
    config = {
      generateNotice: true,
      generateThirdPartyLicense: true,
      generateCredits: true,
      generateMetadata: true,
      includeDevDependencies: true,
      outputDirectory: '/tmp/test-attribution',
      formats: ['text', 'html', 'markdown', 'json'],
      includeStatistics: true,
      includeLicenseAnalysis: true,
      grouping: {
        type: 'license',
        direction: 'asc'
      },
      filter: {
        includeDevDependencies: true,
        requiresCopyrightNotice: undefined
      }
    };

    generator = new AdvancedAttributionGenerator(config);

    testDependencies = [
      {
        packageName: 'test-package-1',
        version: '1.0.0',
        license: {
          name: 'MIT License',
          spdxId: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
          text: 'MIT License text here...',
          permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
          conditions: ['include-copyright'],
          limitations: ['liability', 'warranty'],
          compatibility: {
            compatibleWith: ['Apache-2.0', 'BSD-3-Clause'],
            incompatibleWith: ['GPL-3.0'],
            requiresNotice: true,
            requiresSourceDisclosure: false,
            allowsLinking: true,
            isCopeyleft: false,
            copyleftScope: null
          }
        },
        copyrightHolders: ['Test Company Inc.'],
        attributionRequired: true,
        sourceUrl: 'https://github.com/test/test-package-1'
      },
      {
        packageName: 'another-package',
        version: '2.1.0',
        license: {
          name: 'Apache License 2.0',
          spdxId: 'Apache-2.0',
          url: 'https://apache.org/licenses/LICENSE-2.0',
          text: 'Apache License 2.0 text here...',
          permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
          conditions: ['include-copyright', 'document-changes'],
          limitations: ['liability', 'warranty'],
          compatibility: {
            compatibleWith: ['MIT', 'BSD-3-Clause'],
            incompatibleWith: ['GPL-2.0'],
            requiresNotice: true,
            requiresSourceDisclosure: false,
            allowsLinking: true,
            isCopeyleft: false,
            copyleftScope: null
          }
        },
        copyrightHolders: ['Apache Software Foundation', 'Individual Contributors'],
        attributionRequired: true,
        sourceUrl: 'https://github.com/apache/another-package'
      },
      {
        packageName: '@types/node',
        version: '20.0.0',
        license: {
          name: 'MIT License',
          spdxId: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
          text: 'MIT License text here...',
          permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
          conditions: ['include-copyright'],
          limitations: ['liability', 'warranty'],
          compatibility: {
            compatibleWith: ['Apache-2.0', 'BSD-3-Clause'],
            incompatibleWith: ['GPL-3.0'],
            requiresNotice: true,
            requiresSourceDisclosure: false,
            allowsLinking: true,
            isCopeyleft: false,
            copyleftScope: null
          }
        },
        copyrightHolders: ['Microsoft Corporation'],
        attributionRequired: true,
        sourceUrl: 'https://github.com/DefinitelyTyped/DefinitelyTyped'
      },
      {
        packageName: 'gpl-package',
        version: '1.5.0',
        license: {
          name: 'GNU General Public License v3.0',
          spdxId: 'GPL-3.0',
          url: 'https://www.gnu.org/licenses/gpl-3.0.en.html',
          text: 'GPL v3.0 license text here...',
          permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
          conditions: ['include-copyright', 'document-changes', 'disclose-source', 'same-license'],
          limitations: ['liability', 'warranty'],
          compatibility: {
            compatibleWith: ['GPL-3.0', 'LGPL-3.0'],
            incompatibleWith: ['MIT', 'Apache-2.0'],
            requiresNotice: true,
            requiresSourceDisclosure: true,
            allowsLinking: false,
            isCopeyleft: true,
            copyleftScope: 'project'
          }
        },
        copyrightHolders: ['Free Software Foundation'],
        attributionRequired: true,
        sourceUrl: 'https://github.com/fsf/gpl-package'
      }
    ];

    // Reset mocks
    vi.clearAllMocks();
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await generator.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/test-attribution', { recursive: true });
    });

    it('should handle initialization errors gracefully', async () => {
      (fs.mkdir as any).mockRejectedValue(new Error('Permission denied'));
      
      await expect(generator.initialize()).resolves.not.toThrow();
      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/test-attribution', { recursive: true });
    });
  });

  describe('dependency filtering', () => {
    it('should filter dependencies by license type', async () => {
      const filterConfig: AdvancedAttributionConfig = {
        ...config,
        filter: {
          licenseTypes: ['MIT']
        }
      };
      
      const filteredGenerator = new AdvancedAttributionGenerator(filterConfig);
      const documents = await filteredGenerator.generateAllAttributions(testDependencies);
      
      expect(documents.length).toBeGreaterThan(0);
      // Should contain documents with only MIT licensed dependencies
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      expect(jsonDoc).toBeDefined();
      
      const metadata = JSON.parse(jsonDoc!.content);
      expect(metadata.dependencies.every((dep: any) => dep.license.spdxId === 'MIT')).toBe(true);
    });

    it('should exclude dependencies by license type', async () => {
      const filterConfig: AdvancedAttributionConfig = {
        ...config,
        filter: {
          excludeLicenseTypes: ['GPL-3.0']
        }
      };
      
      const filteredGenerator = new AdvancedAttributionGenerator(filterConfig);
      const documents = await filteredGenerator.generateAllAttributions(testDependencies);
      
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      expect(jsonDoc).toBeDefined();
      
      const metadata = JSON.parse(jsonDoc!.content);
      expect(metadata.dependencies.every((dep: any) => dep.license.spdxId !== 'GPL-3.0')).toBe(true);
    });

    it('should filter by copyright notice requirement', async () => {
      const filterConfig: AdvancedAttributionConfig = {
        ...config,
        filter: {
          requiresCopyrightNotice: true
        }
      };
      
      const filteredGenerator = new AdvancedAttributionGenerator(filterConfig);
      const documents = await filteredGenerator.generateAllAttributions(testDependencies);
      
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      expect(jsonDoc).toBeDefined();
      
      const metadata = JSON.parse(jsonDoc!.content);
      expect(metadata.dependencies.every((dep: any) => dep.copyrightHolders.length > 0)).toBe(true);
    });

    it('should apply custom filter function', async () => {
      const filterConfig: AdvancedAttributionConfig = {
        ...config,
        filter: {
          customFilter: (dep: DependencyLicense) => dep.packageName.startsWith('@types/')
        }
      };
      
      const filteredGenerator = new AdvancedAttributionGenerator(filterConfig);
      const documents = await filteredGenerator.generateAllAttributions(testDependencies);
      
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      expect(jsonDoc).toBeDefined();
      
      const metadata = JSON.parse(jsonDoc!.content);
      expect(metadata.dependencies.every((dep: any) => dep.name.startsWith('@types/'))).toBe(true);
    });
  });

  describe('dependency grouping', () => {
    it('should group dependencies by license', async () => {
      const groupingConfig: AdvancedAttributionConfig = {
        ...config,
        grouping: {
          type: 'license',
          direction: 'asc'
        }
      };
      
      const groupedGenerator = new AdvancedAttributionGenerator(groupingConfig);
      const documents = await groupedGenerator.generateAllAttributions(testDependencies);
      
      const noticeDoc = documents.find(doc => doc.filename === 'NOTICE');
      expect(noticeDoc).toBeDefined();
      expect(noticeDoc!.content).toContain('## Apache License 2.0');
      expect(noticeDoc!.content).toContain('## MIT License');
    });

    it('should group dependencies by category', async () => {
      const groupingConfig: AdvancedAttributionConfig = {
        ...config,
        grouping: {
          type: 'category',
          direction: 'asc'
        }
      };
      
      const groupedGenerator = new AdvancedAttributionGenerator(groupingConfig);
      const documents = await groupedGenerator.generateAllAttributions(testDependencies);
      
      const noticeDoc = documents.find(doc => doc.filename === 'NOTICE');
      expect(noticeDoc).toBeDefined();
      expect(noticeDoc!.content).toContain('## Types');
      expect(noticeDoc!.content).toContain('## Other');
    });

    it('should group dependencies alphabetically', async () => {
      const groupingConfig: AdvancedAttributionConfig = {
        ...config,
        grouping: {
          type: 'alphabetical',
          direction: 'asc'
        }
      };
      
      const groupedGenerator = new AdvancedAttributionGenerator(groupingConfig);
      const documents = await groupedGenerator.generateAllAttributions(testDependencies);
      
      const noticeDoc = documents.find(doc => doc.filename === 'NOTICE');
      expect(noticeDoc).toBeDefined();
      // Should contain alphabetical groupings like ## A, ## G, ## T
      expect(noticeDoc!.content).toMatch(/## [A-Z]/);
    });
  });

  describe('format generation', () => {
    it('should generate enhanced NOTICE file', async () => {
      const documents = await generator.generateAllAttributions(testDependencies);
      const noticeDoc = documents.find(doc => doc.filename === 'NOTICE');
      
      expect(noticeDoc).toBeDefined();
      expect(noticeDoc!.type).toBe('notice');
      expect(noticeDoc!.content).toContain('NOTICE');
      expect(noticeDoc!.content).toContain('test-package-1');
      expect(noticeDoc!.content).toContain('MIT License');
      expect(noticeDoc!.content).toContain('Statistics');
      expect(noticeDoc!.content).toContain('Total Dependencies: 4');
    });

    it('should generate interactive HTML report', async () => {
      const documents = await generator.generateAllAttributions(testDependencies);
      const htmlDoc = documents.find(doc => doc.filename === 'attribution-report.html');
      
      expect(htmlDoc).toBeDefined();
      expect(htmlDoc!.type).toBe('license');
      expect(htmlDoc!.content).toContain('<!DOCTYPE html>');
      expect(htmlDoc!.content).toContain('Third-Party Software Attributions');
      expect(htmlDoc!.content).toContain('test-package-1');
      expect(htmlDoc!.content).toContain('toggleDependency');
      expect(htmlDoc!.content).toContain('stat-card');
    });

    it('should generate comprehensive markdown report', async () => {
      const documents = await generator.generateAllAttributions(testDependencies);
      const markdownDoc = documents.find(doc => doc.filename === 'ATTRIBUTION.md');
      
      expect(markdownDoc).toBeDefined();
      expect(markdownDoc!.type).toBe('license');
      expect(markdownDoc!.content).toContain('# Third-Party Software Attributions');
      expect(markdownDoc!.content).toContain('## Table of Contents');
      expect(markdownDoc!.content).toContain('### test-package-1');
      expect(markdownDoc!.content).toContain('| Property | Value |');
      expect(markdownDoc!.content).toContain('```\nMIT License text here...\n```');
    });

    it('should generate JSON metadata', async () => {
      const documents = await generator.generateAllAttributions(testDependencies);
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      
      expect(jsonDoc).toBeDefined();
      expect(jsonDoc!.type).toBe('metadata');
      
      const metadata = JSON.parse(jsonDoc!.content);
      expect(metadata.generatedAt).toBeDefined();
      expect(metadata.generator).toBe('ast-copilot-helper-advanced-attribution-generator');
      expect(metadata.statistics.total).toBe(4);
      expect(metadata.dependencies).toHaveLength(4);
      expect(metadata.licenseSummary).toHaveProperty('MIT', 2);
      expect(metadata.licenseSummary).toHaveProperty('Apache-2.0', 1);
      expect(metadata.licenseSummary).toHaveProperty('GPL-3.0', 1);
    });

    it('should generate XML report', async () => {
      config.formats = ['xml'];
      const xmlGenerator = new AdvancedAttributionGenerator(config);
      const documents = await xmlGenerator.generateAllAttributions(testDependencies);
      const xmlDoc = documents.find(doc => doc.filename === 'attributions.xml');
      
      expect(xmlDoc).toBeDefined();
      expect(xmlDoc!.type).toBe('metadata');
      expect(xmlDoc!.content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xmlDoc!.content).toContain('<attributions>');
      expect(xmlDoc!.content).toContain('<dependency>');
      expect(xmlDoc!.content).toContain('<name>test-package-1</name>');
      expect(xmlDoc!.content).toContain('<spdxId>MIT</spdxId>');
    });

    it('should generate SPDX-compliant document', async () => {
      const spdxDoc = await generator.generateSpdxDocument(testDependencies);
      
      expect(spdxDoc.filename).toBe('attributions.spdx.json');
      expect(spdxDoc.type).toBe('metadata');
      
      const spdxData = JSON.parse(spdxDoc.content);
      expect(spdxData.spdxVersion).toBe('SPDX-2.2');
      expect(spdxData.dataLicense).toBe('CC0-1.0');
      expect(spdxData.packages).toHaveLength(4);
      expect(spdxData.relationships).toHaveLength(4);
      
      const testPackage = spdxData.packages.find((pkg: any) => pkg.name === 'test-package-1');
      expect(testPackage).toBeDefined();
      expect(testPackage.licenseConcluded).toBe('MIT');
      expect(testPackage.copyrightText).toBe('Test Company Inc.');
    });
  });

  describe('template system', () => {
    it('should generate from custom template', async () => {
      const customTemplate: AttributionTemplate = {
        name: 'Custom Notice',
        filename: 'CUSTOM-NOTICE.txt',
        format: 'text',
        template: `Custom Attribution Notice
Generated: {{date}}
Dependencies: {{totalDependencies}}
Unique Licenses: {{uniqueLicenses}}

{{dependencyList}}
`,
        variables: ['date', 'totalDependencies', 'uniqueLicenses', 'dependencyList']
      };
      
      const templateConfig: AdvancedAttributionConfig = {
        ...config,
        templates: [customTemplate]
      };
      
      const templateGenerator = new AdvancedAttributionGenerator(templateConfig);
      const documents = await templateGenerator.generateAllAttributions(testDependencies);
      
      const customDoc = documents.find(doc => doc.filename === 'CUSTOM-NOTICE.txt');
      expect(customDoc).toBeDefined();
      expect(customDoc!.content).toContain('Custom Attribution Notice');
      expect(customDoc!.content).toContain('Dependencies: 4');
      expect(customDoc!.content).toContain('Unique Licenses: 3');
      expect(customDoc!.content).toContain('test-package-1 v1.0.0 (MIT License)');
    });

    it('should handle template generation errors gracefully', async () => {
      const badTemplate: AttributionTemplate = {
        name: 'Bad Template',
        filename: 'BAD-TEMPLATE.txt',
        format: 'text',
        template: 'Template with {{undefinedVariable}}',
        variables: ['undefinedVariable']
      };
      
      const templateConfig: AdvancedAttributionConfig = {
        ...config,
        templates: [badTemplate]
      };
      
      const templateGenerator = new AdvancedAttributionGenerator(templateConfig);
      const documents = await templateGenerator.generateAllAttributions(testDependencies);
      
      // Should still generate other documents
      expect(documents.length).toBeGreaterThan(0);
      const badDoc = documents.find(doc => doc.filename === 'BAD-TEMPLATE.txt');
      expect(badDoc).toBeDefined();
      expect(badDoc!.content).toContain('{{undefinedVariable}}'); // Variable not replaced
    });
  });

  describe('statistics and analysis', () => {
    it('should include comprehensive statistics', async () => {
      const documents = await generator.generateAllAttributions(testDependencies);
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      
      expect(jsonDoc).toBeDefined();
      const metadata = JSON.parse(jsonDoc!.content);
      
      expect(metadata.statistics).toEqual({
        total: 4,
        uniqueLicenses: 3,
        copyrightHolders: 5, // Test Company Inc., Apache Software Foundation, Individual Contributors, Microsoft Corporation, Free Software Foundation
        attributionRequired: 4,
        copyleftCount: 1, // GPL-3.0
        permissiveCount: 3  // MIT, Apache-2.0
      });
    });

    it('should generate license analysis', async () => {
      const noticeDoc = await generator.generateEnhancedNoticeFile(testDependencies);
      
      expect(noticeDoc.content).toContain('Statistics');
      expect(noticeDoc.content).toContain('Total Dependencies: 4');
      expect(noticeDoc.content).toContain('Requiring Attribution: 4');
      expect(noticeDoc.content).toContain('Unique Licenses: 3');
      expect(noticeDoc.content).toContain('Copyleft Licenses: 1');
      expect(noticeDoc.content).toContain('Permissive Licenses: 3');
    });
  });

  describe('file operations', () => {
    it('should save attribution documents to files', async () => {
      const documents = await generator.generateAllAttributions(testDependencies);
      await generator.saveAttributionDocuments(documents);
      
      expect(fs.writeFile).toHaveBeenCalledTimes(documents.length);
      
      for (const doc of documents) {
        const expectedPath = join('/tmp/test-attribution', doc.filename);
        expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, doc.content, 'utf8');
      }
    });

    it('should handle file save errors gracefully', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Write permission denied'));
      
      const documents = await generator.generateAllAttributions([testDependencies[0]]);
      
      await expect(generator.saveAttributionDocuments(documents)).resolves.not.toThrow();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle empty dependencies list', async () => {
      const documents = await generator.generateAllAttributions([]);
      
      expect(documents).toHaveLength(4); // text, html, markdown, json
      
      const jsonDoc = documents.find(doc => doc.filename === 'attribution-metadata.json');
      expect(jsonDoc).toBeDefined();
      
      const metadata = JSON.parse(jsonDoc!.content);
      expect(metadata.statistics.total).toBe(0);
      expect(metadata.dependencies).toHaveLength(0);
    });

    it('should handle malformed license data', async () => {
      const malformedDep: DependencyLicense = {
        packageName: 'malformed-package',
        version: '1.0.0',
        license: {
          name: '',
          spdxId: '',
          url: '',
          text: '',
          permissions: [],
          conditions: [],
          limitations: [],
          compatibility: {
            compatibleWith: [],
            incompatibleWith: [],
            requiresNotice: true,
            requiresSourceDisclosure: false,
            allowsLinking: true,
            isCopeyleft: false,
            copyleftScope: null
          }
        },
        copyrightHolders: [],
        attributionRequired: true
      };
      
      const documents = await generator.generateAllAttributions([malformedDep]);
      
      expect(documents.length).toBeGreaterThan(0);
      const noticeDoc = documents.find(doc => doc.filename === 'NOTICE');
      expect(noticeDoc).toBeDefined();
      expect(noticeDoc!.content).toContain('malformed-package');
    });

    it('should handle format generation errors', async () => {
      // Create a config with an unsupported format
      const errorConfig: AdvancedAttributionConfig = {
        ...config,
        formats: ['unsupported-format' as any]
      };
      
      const errorGenerator = new AdvancedAttributionGenerator(errorConfig);
      const documents = await errorGenerator.generateAllAttributions(testDependencies);
      
      // Should generate text format as fallback
      expect(documents.length).toBeGreaterThan(0);
    });
  });
});