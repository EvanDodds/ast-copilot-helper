/**
 * @fileoverview Attribution generator for creating legal attribution files
 */

import { promises as fs } from 'fs';
import type { DependencyLicense, AttributionDocument, AttributionConfig } from './types.js';

/**
 * Generates legal attribution files (NOTICE, LICENSE-THIRD-PARTY, CREDITS, metadata)
 */
export class AttributionGenerator {
  private config: AttributionConfig;

  constructor(config: AttributionConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Create output directory if it doesn't exist
    try {
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
    } catch (error) {
      console.warn(`Failed to create output directory ${this.config.outputDirectory}:`, error);
    }
  }

  /**
   * Generate NOTICE file with all required attributions
   */
  async generateNoticeFile(dependencies: DependencyLicense[]): Promise<AttributionDocument> {
    console.log('Generating NOTICE file...');
    
    let noticeContent = `NOTICE\n`;
    noticeContent += `======\n\n`;
    noticeContent += `This software includes third-party software subject to the following licenses:\n\n`;
    
    // Group by license type
    const licenseGroups = new Map<string, DependencyLicense[]>();
    
    for (const dep of dependencies) {
      const licenseKey = dep.license.spdxId || dep.license.name;
      if (!licenseGroups.has(licenseKey)) {
        licenseGroups.set(licenseKey, []);
      }
      licenseGroups.get(licenseKey)!.push(dep);
    }
    
    for (const [licenseType, deps] of licenseGroups) {
      noticeContent += `## ${licenseType}\n\n`;
      
      for (const dep of deps) {
        noticeContent += `### ${dep.packageName} v${dep.version}\n`;
        
        if (dep.copyrightHolders.length > 0) {
          noticeContent += `Copyright: ${dep.copyrightHolders.join(', ')}\n`;
        }
        
        if (dep.sourceUrl) {
          noticeContent += `Source: ${dep.sourceUrl}\n`;
        }
        
        noticeContent += `License: ${dep.license.name}\n\n`;
      }
      
      // Add license text for first occurrence
      const firstDep = deps[0];
      if (firstDep && firstDep.license.text) {
        noticeContent += `License Text:\n`;
        noticeContent += `${firstDep.license.text}\n\n`;
        noticeContent += '---\n\n';
      }
    }
    
    noticeContent += `\nGenerated on: ${new Date().toISOString()}\n`;
    noticeContent += `By: ast-copilot-helper legal compliance system\n`;
    
    return {
      filename: 'NOTICE',
      content: noticeContent,
      type: 'notice',
    };
  }

  /**
   * Generate LICENSE-THIRD-PARTY file with complete license texts
   */
  async generateThirdPartyLicenseFile(dependencies: DependencyLicense[]): Promise<AttributionDocument> {
    console.log('Generating LICENSE-THIRD-PARTY file...');
    
    let licenseContent = `THIRD-PARTY SOFTWARE LICENSES\n`;
    licenseContent += `================================\n\n`;
    licenseContent += `This software contains third-party software subject to the following licenses:\n\n`;
    
    for (const dep of dependencies) {
      licenseContent += `--------------------------------------------------------------------------------\n`;
      licenseContent += `Package: ${dep.packageName}\n`;
      licenseContent += `Version: ${dep.version}\n`;
      licenseContent += `License: ${dep.license.name}\n`;
      
      if (dep.copyrightHolders.length > 0) {
        licenseContent += `Copyright: ${dep.copyrightHolders.join(', ')}\n`;
      }
      
      if (dep.sourceUrl) {
        licenseContent += `Source: ${dep.sourceUrl}\n`;
      }
      
      licenseContent += `\n${dep.license.text}\n\n`;
    }
    
    licenseContent += `Generated on: ${new Date().toISOString()}\n`;
    
    return {
      filename: 'LICENSE-THIRD-PARTY',
      content: licenseContent,
      type: 'license',
    };
  }

  /**
   * Generate CREDITS file with copyright holder information
   */
  async generateCreditsFile(dependencies: DependencyLicense[]): Promise<AttributionDocument> {
    console.log('Generating CREDITS file...');
    
    let creditsContent = `CREDITS\n`;
    creditsContent += `=======\n\n`;
    creditsContent += `This software is made possible by the following open source contributors:\n\n`;
    
    // Collect all unique contributors
    const contributors = new Set<string>();
    const packageContributors = new Map<string, string[]>();
    
    for (const dep of dependencies) {
      for (const holder of dep.copyrightHolders) {
        contributors.add(holder);
        
        if (!packageContributors.has(dep.packageName)) {
          packageContributors.set(dep.packageName, []);
        }
        packageContributors.get(dep.packageName)!.push(holder);
      }
    }
    
    // List all contributors alphabetically
    const sortedContributors = Array.from(contributors).sort();
    
    creditsContent += `## Contributors (${sortedContributors.length} total)\n\n`;
    for (const contributor of sortedContributors) {
      creditsContent += `- ${contributor}\n`;
    }
    
    creditsContent += `\n## Package Contributors\n\n`;
    
    const sortedPackages = Array.from(packageContributors.entries())
      .sort(([a], [b]) => a.localeCompare(b));
      
    for (const [packageName, holders] of sortedPackages) {
      creditsContent += `### ${packageName}\n`;
      for (const holder of holders) {
        creditsContent += `- ${holder}\n`;
      }
      creditsContent += `\n`;
    }
    
    creditsContent += `\nGenerated on: ${new Date().toISOString()}\n`;
    creditsContent += `By: ast-copilot-helper legal compliance system\n`;
    
    return {
      filename: 'CREDITS',
      content: creditsContent,
      type: 'credits',
    };
  }

  /**
   * Generate machine-readable license metadata (JSON)
   */
  async generateLicenseMetadata(dependencies: DependencyLicense[]): Promise<AttributionDocument> {
    console.log('Generating license metadata...');
    
    const metadata = {
      generatedAt: new Date().toISOString(),
      generator: 'ast-copilot-helper-legal-compliance',
      totalDependencies: dependencies.length,
      dependencies: dependencies.map(dep => ({
        name: dep.packageName,
        version: dep.version,
        license: {
          spdxId: dep.license.spdxId,
          name: dep.license.name,
          url: dep.license.url
        },
        copyrightHolders: dep.copyrightHolders,
        sourceUrl: dep.sourceUrl,
        attributionRequired: dep.attributionRequired,
        licenseFile: dep.licenseFile,
        noticeFile: dep.noticeFile
      })),
      licenseSummary: this.generateLicenseSummary(dependencies),
      complianceInfo: {
        attributionRequiredCount: dependencies.filter(d => d.attributionRequired).length,
        uniqueLicenses: Array.from(new Set(dependencies.map(d => d.license.spdxId || d.license.name))),
        copyleftDependencies: dependencies.filter(d => d.license.compatibility.isCopeyleft).length
      }
    };
    
    return {
      filename: 'licenses.json',
      content: JSON.stringify(metadata, null, 2),
      type: 'metadata',
    };
  }

  /**
   * Apply custom attribution template if configured
   */
  async applyCustomTemplate(dependencies: DependencyLicense[]): Promise<AttributionDocument | null> {
    if (!this.config.customAttributionTemplate) {
      return null;
    }

    try {
      const templateContent = await fs.readFile(this.config.customAttributionTemplate, 'utf8');
      
      // Simple template variable replacement
      let content = templateContent;
      content = content.replace(/\{\{date\}\}/g, new Date().toISOString());
      content = content.replace(/\{\{totalDependencies\}\}/g, dependencies.length.toString());
      content = content.replace(/\{\{attributionCount\}\}/g, 
        dependencies.filter(d => d.attributionRequired).length.toString());
      
      // Replace dependency list placeholder
      let dependencyList = '';
      for (const dep of dependencies) {
        dependencyList += `${dep.packageName} v${dep.version} (${dep.license.name})\n`;
      }
      content = content.replace(/\{\{dependencyList\}\}/g, dependencyList);
      
      return {
        filename: 'CUSTOM-ATTRIBUTION',
        content,
        type: 'notice',
      };
    } catch (error) {
      console.warn(`Failed to apply custom template ${this.config.customAttributionTemplate}:`, error);
      return null;
    }
  }

  private generateLicenseSummary(dependencies: DependencyLicense[]): Record<string, number> {
    const summary: Record<string, number> = {};
    
    for (const dep of dependencies) {
      const licenseKey = dep.license.spdxId || dep.license.name;
      summary[licenseKey] = (summary[licenseKey] || 0) + 1;
    }
    
    return summary;
  }
}