/**
 * @fileoverview Advanced attribution generator with enhanced templating and multiple formats
 */

import { promises as fs } from "fs";
import { join } from "path";
import type {
  DependencyLicense,
  AttributionDocument,
  AttributionConfig,
} from "./types.js";

export interface AttributionTemplate {
  name: string;
  filename: string;
  format: "text" | "markdown" | "html" | "json" | "xml";
  template: string;
  variables: string[];
}

export interface AttributionGrouping {
  type: "license" | "category" | "author" | "domain" | "alphabetical";
  direction: "asc" | "desc";
  subGrouping?: AttributionGrouping;
}

export interface AttributionFilter {
  includeDevDependencies?: boolean;
  includeOptionalDependencies?: boolean;
  includePeerDependencies?: boolean;
  minVersion?: string;
  maxVersion?: string;
  licenseTypes?: string[];
  excludeLicenseTypes?: string[];
  requiresCopyrightNotice?: boolean;
  customFilter?: (dep: DependencyLicense) => boolean;
}

export interface AdvancedAttributionConfig extends AttributionConfig {
  templates?: AttributionTemplate[];
  grouping?: AttributionGrouping;
  filter?: AttributionFilter;
  formats?: ("text" | "markdown" | "html" | "json" | "xml" | "pdf")[];
  customVariables?: Record<string, string>;
  includeStatistics?: boolean;
  includeLicenseAnalysis?: boolean;
  generateSeparateFiles?: boolean;
  headerFooterTemplates?: {
    header?: string;
    footer?: string;
  };
}

/**
 * Advanced attribution generator with enhanced templating and multiple output formats
 */
export class AdvancedAttributionGenerator {
  private config: AdvancedAttributionConfig;

  constructor(config: AdvancedAttributionConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Create output directory if it doesn't exist
    try {
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
      console.log(
        `Initialized attribution generator output directory: ${this.config.outputDirectory}`,
      );
    } catch (error) {
      console.warn(
        `Failed to create output directory ${this.config.outputDirectory}:`,
        error,
      );
    }
  }

  /**
   * Generate all configured attribution documents
   */
  async generateAllAttributions(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument[]> {
    console.log(
      `Generating advanced attributions for ${dependencies.length} dependencies...`,
    );

    const filteredDependencies = this.filterDependencies(dependencies);
    const documents: AttributionDocument[] = [];

    console.log(
      `Processing ${filteredDependencies.length} dependencies after filtering...`,
    );

    // Generate documents for each configured format
    const formats = this.config.formats || ["text", "json"];

    for (const format of formats) {
      try {
        const formatDocs = await this.generateForFormat(
          format,
          filteredDependencies,
        );
        documents.push(...formatDocs);
      } catch (error) {
        console.error(
          `Failed to generate attribution in format ${format}:`,
          error,
        );
      }
    }

    // Generate custom template-based documents
    if (this.config.templates) {
      for (const template of this.config.templates) {
        try {
          const templateDoc = await this.generateFromTemplate(
            template,
            filteredDependencies,
          );
          if (templateDoc) {
            documents.push(templateDoc);
          }
        } catch (error) {
          console.error(
            `Failed to generate from template ${template.name}:`,
            error,
          );
        }
      }
    }

    console.log(`Generated ${documents.length} attribution documents`);
    return documents;
  }

  /**
   * Generate enhanced NOTICE file with advanced grouping
   */
  async generateEnhancedNoticeFile(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument> {
    console.log("Generating enhanced NOTICE file...");

    const groupedDeps = this.groupDependencies(dependencies);
    let content = await this.applyHeaderFooter("NOTICE\n======\n\n");

    if (this.config.includeStatistics) {
      content += await this.generateStatisticsSection(dependencies);
      content += "\n";
    }

    content += `This software includes third-party software subject to the following licenses:\n\n`;

    // Enhanced grouping with hierarchical structure
    for (const [groupKey, groupDeps] of groupedDeps) {
      content += `## ${groupKey}\n\n`;

      if (this.config.grouping?.subGrouping) {
        const subGrouped = this.groupDependencies(
          groupDeps,
          this.config.grouping.subGrouping,
        );
        for (const [subGroupKey, subGroupDeps] of subGrouped) {
          content += `### ${subGroupKey}\n\n`;
          content += await this.generateDependencySection(subGroupDeps);
        }
      } else {
        content += await this.generateDependencySection(groupDeps);
      }

      content += "\n---\n\n";
    }

    content += await this.generateLicenseTextSection(dependencies);
    content += await this.applyHeaderFooter("", true); // Apply footer

    return {
      filename: "NOTICE",
      content,
      type: "notice",
    };
  }

  /**
   * Generate interactive HTML attribution report
   */
  async generateHtmlReport(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument> {
    console.log("Generating HTML attribution report...");

    const filteredDeps = this.filterDependencies(dependencies);
    const groupedDeps = this.groupDependencies(filteredDeps);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Third-Party Software Attributions</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; border: 1px solid #e1e5e9; border-radius: 6px; padding: 15px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #0366d6; }
        .dependency-group { margin-bottom: 30px; }
        .dependency-item { border: 1px solid #e1e5e9; border-radius: 6px; margin-bottom: 10px; }
        .dependency-header { background: #f6f8fa; padding: 12px; cursor: pointer; display: flex; justify-content: between; align-items: center; }
        .dependency-content { padding: 15px; display: none; }
        .dependency-content.expanded { display: block; }
        .license-text { background: #f8f9fa; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 0.9em; white-space: pre-wrap; }
        .filter-bar { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px; }
        .filter-bar input, .filter-bar select { margin: 0 10px; padding: 5px; border: 1px solid #d0d7de; border-radius: 4px; }
        .toggle-button { background: none; border: none; font-size: 1.2em; cursor: pointer; }
        .copyright-info { background: #fff8e1; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Third-Party Software Attributions</h1>
            <p>Generated on: ${new Date().toISOString()}</p>
            <p>Total Dependencies: ${filteredDeps.length}</p>
        </div>
`;

    if (this.config.includeStatistics) {
      html += await this.generateHtmlStatistics(filteredDeps);
    }

    // Filter bar
    html += `
        <div class="filter-bar">
            <label>Filter by license: <select id="licenseFilter">
                <option value="">All</option>`;

    const uniqueLicenses = [
      ...new Set(filteredDeps.map((d) => d.license.spdxId || d.license.name)),
    ];
    for (const license of uniqueLicenses.sort()) {
      html += `<option value="${license}">${license}</option>`;
    }

    html += `
            </select></label>
            <label>Search: <input type="text" id="searchFilter" placeholder="Search packages..."></label>
            <button onclick="toggleAll()">Expand/Collapse All</button>
        </div>
`;

    // Dependency groups
    for (const [groupKey, groupDeps] of groupedDeps) {
      html += `
        <div class="dependency-group">
            <h2>${groupKey} (${groupDeps.length} packages)</h2>`;

      for (const dep of groupDeps) {
        const depId = `dep-${dep.packageName.replace(/[^a-zA-Z0-9]/g, "-")}`;
        html += `
            <div class="dependency-item" data-license="${dep.license.spdxId || dep.license.name}" data-name="${dep.packageName}">
                <div class="dependency-header" onclick="toggleDependency('${depId}')">
                    <div>
                        <strong>${dep.packageName}</strong> v${dep.version}
                        <small style="color: #666; margin-left: 10px;">${dep.license.name}</small>
                    </div>
                    <button class="toggle-button" id="toggle-${depId}">▶</button>
                </div>
                <div class="dependency-content" id="${depId}">`;

        if (dep.copyrightHolders.length > 0) {
          html += `
                    <div class="copyright-info">
                        <strong>Copyright:</strong> ${dep.copyrightHolders.join(", ")}
                    </div>`;
        }

        if (dep.sourceUrl) {
          html += `<p><strong>Source:</strong> <a href="${dep.sourceUrl}" target="_blank">${dep.sourceUrl}</a></p>`;
        }

        html += `
                    <p><strong>License:</strong> ${dep.license.name}</p>
                    <p><strong>SPDX ID:</strong> ${dep.license.spdxId}</p>`;

        if (dep.license.url) {
          html += `<p><strong>License URL:</strong> <a href="${dep.license.url}" target="_blank">${dep.license.url}</a></p>`;
        }

        if (dep.license.text) {
          const truncatedText =
            dep.license.text.length > 500
              ? dep.license.text.substring(0, 500) + "..."
              : dep.license.text;
          html += `
                    <div class="license-text">${truncatedText}</div>`;
        }

        html += `
                </div>
            </div>`;
      }

      html += `</div>`;
    }

    // JavaScript for interactivity
    html += `
    </div>
    <script>
        function toggleDependency(id) {
            const content = document.getElementById(id);
            const toggle = document.getElementById('toggle-' + id);
            if (content.classList.contains('expanded')) {
                content.classList.remove('expanded');
                toggle.textContent = '▶';
            } else {
                content.classList.add('expanded');
                toggle.textContent = '▼';
            }
        }
        
        function toggleAll() {
            const contents = document.querySelectorAll('.dependency-content');
            const toggles = document.querySelectorAll('.toggle-button');
            const allExpanded = Array.from(contents).every(c => c.classList.contains('expanded'));
            
            contents.forEach((content, i) => {
                if (allExpanded) {
                    content.classList.remove('expanded');
                    toggles[i].textContent = '▶';
                } else {
                    content.classList.add('expanded');
                    toggles[i].textContent = '▼';
                }
            });
        }
        
        document.getElementById('licenseFilter').addEventListener('change', function() {
            const filter = this.value;
            document.querySelectorAll('.dependency-item').forEach(item => {
                if (!filter || item.dataset.license === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
        
        document.getElementById('searchFilter').addEventListener('input', function() {
            const search = this.value.toLowerCase();
            document.querySelectorAll('.dependency-item').forEach(item => {
                const name = item.dataset.name.toLowerCase();
                if (name.includes(search)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    </script>
</body>
</html>`;

    return {
      filename: "attribution-report.html",
      content: html,
      type: "license",
    };
  }

  /**
   * Generate comprehensive markdown report
   */
  async generateMarkdownReport(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument> {
    console.log("Generating Markdown attribution report...");

    const filteredDeps = this.filterDependencies(dependencies);
    const groupedDeps = this.groupDependencies(filteredDeps);

    let markdown = `# Third-Party Software Attributions\n\n`;
    markdown += `**Generated on:** ${new Date().toISOString()}\n`;
    markdown += `**Total Dependencies:** ${filteredDeps.length}\n\n`;

    if (this.config.includeStatistics) {
      markdown += await this.generateMarkdownStatistics(filteredDeps);
      markdown += "\n";
    }

    // Table of Contents
    markdown += `## Table of Contents\n\n`;
    for (const [groupKey] of groupedDeps) {
      const anchor = groupKey.toLowerCase().replace(/[^a-z0-9]/g, "-");
      markdown += `- [${groupKey}](#${anchor})\n`;
    }
    markdown += "\n";

    // Dependency groups
    for (const [groupKey, groupDeps] of groupedDeps) {
      const anchor = groupKey.toLowerCase().replace(/[^a-z0-9]/g, "-");
      markdown += `## ${groupKey}\n\n`;
      markdown += `<a id="${anchor}"></a>\n\n`;

      for (const dep of groupDeps) {
        markdown += `### ${dep.packageName} v${dep.version}\n\n`;

        markdown += `| Property | Value |\n`;
        markdown += `|----------|-------|\n`;
        markdown += `| **License** | ${dep.license.name} |\n`;
        markdown += `| **SPDX ID** | ${dep.license.spdxId} |\n`;

        if (dep.sourceUrl) {
          markdown += `| **Source** | [${dep.sourceUrl}](${dep.sourceUrl}) |\n`;
        }

        if (dep.copyrightHolders.length > 0) {
          markdown += `| **Copyright** | ${dep.copyrightHolders.join(", ")} |\n`;
        }

        if (dep.license.url) {
          markdown += `| **License URL** | [${dep.license.url}](${dep.license.url}) |\n`;
        }

        markdown += "\n";

        if (dep.license.text && dep.license.text.length > 0) {
          markdown += `**License Text:**\n\n`;
          markdown += "```\n";
          markdown += dep.license.text;
          markdown += "\n```\n\n";
        }

        markdown += "---\n\n";
      }
    }

    return {
      filename: "ATTRIBUTION.md",
      content: markdown,
      type: "license",
    };
  }

  /**
   * Generate SPDX-compliant document
   */
  async generateSpdxDocument(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument> {
    console.log("Generating SPDX attribution document...");

    const filteredDeps = this.filterDependencies(dependencies);
    const spdxDocument = {
      spdxVersion: "SPDX-2.2",
      dataLicense: "CC0-1.0",
      SPDXID: "SPDXRef-DOCUMENT",
      documentName: "Third-Party Software Attributions",
      documentNamespace: `https://ast-copilot-helper.com/spdx/${Date.now()}`,
      creationInfo: {
        created: new Date().toISOString(),
        creators: ["Tool: ast-copilot-helper-legal-compliance"],
        licenseListVersion: "3.17",
      },
      packages: filteredDeps.map((dep, index) => ({
        SPDXID: `SPDXRef-Package-${index + 1}`,
        name: dep.packageName,
        versionInfo: dep.version,
        downloadLocation: dep.sourceUrl || "NOASSERTION",
        filesAnalyzed: false,
        licenseConcluded: dep.license.spdxId || "NOASSERTION",
        licenseDeclared: dep.license.spdxId || "NOASSERTION",
        copyrightText:
          dep.copyrightHolders.length > 0
            ? dep.copyrightHolders.join(", ")
            : "NOASSERTION",
        supplier: "NOASSERTION",
      })),
      relationships: filteredDeps.map((_, index) => ({
        spdxElementId: "SPDXRef-DOCUMENT",
        relationshipType: "DESCRIBES",
        relatedSpdxElement: `SPDXRef-Package-${index + 1}`,
      })),
    };

    return {
      filename: "attributions.spdx.json",
      content: JSON.stringify(spdxDocument, null, 2),
      type: "metadata",
    };
  }

  /**
   * Save all generated documents to files
   */
  async saveAttributionDocuments(
    documents: AttributionDocument[],
  ): Promise<void> {
    console.log(`Saving ${documents.length} attribution documents...`);

    for (const doc of documents) {
      const filePath = join(this.config.outputDirectory, doc.filename);
      try {
        await fs.writeFile(filePath, doc.content, "utf8");
        console.log(`Generated attribution file: ${filePath}`);
      } catch (error) {
        console.error(`Failed to save document ${doc.filename}:`, error);
      }
    }
  }

  // Private helper methods

  private filterDependencies(
    dependencies: DependencyLicense[],
  ): DependencyLicense[] {
    if (!this.config.filter) {
      return dependencies;
    }

    return dependencies.filter((dep) => {
      const filter = this.config.filter!;

      // Custom filter function
      if (filter.customFilter && !filter.customFilter(dep)) {
        return false;
      }

      // License type filters
      if (filter.licenseTypes && filter.licenseTypes.length > 0) {
        if (
          !filter.licenseTypes.includes(dep.license.spdxId) &&
          !filter.licenseTypes.includes(dep.license.name)
        ) {
          return false;
        }
      }

      if (filter.excludeLicenseTypes && filter.excludeLicenseTypes.length > 0) {
        if (
          filter.excludeLicenseTypes.includes(dep.license.spdxId) ||
          filter.excludeLicenseTypes.includes(dep.license.name)
        ) {
          return false;
        }
      }

      // Copyright notice requirement
      if (filter.requiresCopyrightNotice !== undefined) {
        const hasCopyright = dep.copyrightHolders.length > 0;
        if (filter.requiresCopyrightNotice && !hasCopyright) {
          return false;
        }
        if (!filter.requiresCopyrightNotice && hasCopyright) {
          return false;
        }
      }

      return true;
    });
  }

  private groupDependencies(
    dependencies: DependencyLicense[],
    grouping?: AttributionGrouping,
  ): Map<string, DependencyLicense[]> {
    const actualGrouping = grouping ||
      this.config.grouping || { type: "license", direction: "asc" };
    const groups = new Map<string, DependencyLicense[]>();

    for (const dep of dependencies) {
      let groupKey: string;

      switch (actualGrouping.type) {
        case "license":
          groupKey = dep.license.name;
          break;
        case "category":
          // Extract category from package name (e.g., @types/* -> Types)
          if (dep.packageName.startsWith("@types/")) {
            groupKey = "Types";
          } else if (dep.packageName.startsWith("@")) {
            const parts = dep.packageName.split("/");
            groupKey = parts[0] ? parts[0].substring(1) : "Other";
          } else {
            groupKey = "Other";
          }
          break;
        case "author":
          groupKey =
            dep.copyrightHolders.length > 0
              ? dep.copyrightHolders[0] || "Unknown"
              : "Unknown";
          break;
        case "domain":
          // Extract domain from source URL
          if (dep.sourceUrl) {
            try {
              const url = new URL(dep.sourceUrl);
              groupKey = url.hostname;
            } catch {
              groupKey = "Unknown";
            }
          } else {
            groupKey = "Unknown";
          }
          break;
        case "alphabetical":
        default:
          groupKey = dep.packageName.charAt(0).toUpperCase();
          break;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(dep);
    }

    // Sort groups
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
      return actualGrouping.direction === "asc"
        ? a.localeCompare(b)
        : b.localeCompare(a);
    });

    // Sort dependencies within each group
    for (const [, deps] of sortedEntries) {
      deps.sort((a, b) => a.packageName.localeCompare(b.packageName));
    }

    return new Map(sortedEntries);
  }

  private async generateForFormat(
    format: string,
    allDeps: DependencyLicense[],
  ): Promise<AttributionDocument[]> {
    switch (format) {
      case "html":
        return [await this.generateHtmlReport(allDeps)];
      case "markdown":
        return [await this.generateMarkdownReport(allDeps)];
      case "json":
        return [await this.generateJsonMetadata(allDeps)];
      case "xml":
        return [await this.generateXmlReport(allDeps)];
      case "text":
      default:
        return [await this.generateEnhancedNoticeFile(allDeps)];
    }
  }

  private async generateFromTemplate(
    template: AttributionTemplate,
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument | null> {
    try {
      let content = template.template;
      const variables = this.buildTemplateVariables(dependencies);

      // Replace all variables
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        content = content.replace(regex, value);
      }

      return {
        filename: template.filename,
        content,
        type: "notice",
      };
    } catch (error) {
      console.error(
        `Failed to generate from template ${template.name}:`,
        error,
      );
      return null;
    }
  }

  private buildTemplateVariables(
    dependencies: DependencyLicense[],
  ): Record<string, string> {
    const licenseSummary = new Map<string, number>();
    let totalCopyrightHolders = 0;

    for (const dep of dependencies) {
      const licenseKey = dep.license.spdxId || dep.license.name;
      licenseSummary.set(licenseKey, (licenseSummary.get(licenseKey) || 0) + 1);
      totalCopyrightHolders += dep.copyrightHolders.length;
    }

    const variables: Record<string, string> = {
      date: new Date().toISOString(),
      totalDependencies: dependencies.length.toString(),
      attributionCount: dependencies
        .filter((d) => d.attributionRequired)
        .length.toString(),
      uniqueLicenses: licenseSummary.size.toString(),
      totalCopyrightHolders: totalCopyrightHolders.toString(),
      generator: "ast-copilot-helper-advanced-attribution-generator",
      ...this.config.customVariables,
    };

    // Generate dependency list in various formats
    variables.dependencyList = dependencies
      .map((dep) => `${dep.packageName} v${dep.version} (${dep.license.name})`)
      .join("\n");

    variables.licenseSummary = Array.from(licenseSummary.entries())
      .map(([license, count]) => `${license}: ${count}`)
      .join(", ");

    return variables;
  }

  private async generateStatisticsSection(
    dependencies: DependencyLicense[],
  ): Promise<string> {
    const stats = this.calculateStatistics(dependencies);

    let content = `## Statistics\n\n`;
    content += `- Total Dependencies: ${stats.total}\n`;
    content += `- Requiring Attribution: ${stats.attributionRequired}\n`;
    content += `- Unique Licenses: ${stats.uniqueLicenses}\n`;
    content += `- Copyright Holders: ${stats.copyrightHolders}\n`;
    content += `- Copyleft Licenses: ${stats.copyleftCount}\n`;
    content += `- Permissive Licenses: ${stats.permissiveCount}\n\n`;

    return content;
  }

  private async generateDependencySection(
    dependencies: DependencyLicense[],
  ): Promise<string> {
    let content = "";

    for (const dep of dependencies) {
      content += `**${dep.packageName}** v${dep.version}\n`;

      if (dep.copyrightHolders.length > 0) {
        content += `Copyright: ${dep.copyrightHolders.join(", ")}\n`;
      }

      if (dep.sourceUrl) {
        content += `Source: ${dep.sourceUrl}\n`;
      }

      content += `License: ${dep.license.name}\n\n`;
    }

    return content;
  }

  private async generateLicenseTextSection(
    dependencies: DependencyLicense[],
  ): Promise<string> {
    const uniqueLicenses = new Map<string, string>();

    for (const dep of dependencies) {
      const licenseKey = dep.license.spdxId || dep.license.name;
      if (dep.license.text && !uniqueLicenses.has(licenseKey)) {
        uniqueLicenses.set(licenseKey, dep.license.text);
      }
    }

    let content = `## License Texts\n\n`;

    for (const [licenseName, licenseText] of uniqueLicenses) {
      content += `### ${licenseName}\n\n`;
      content += `${licenseText}\n\n`;
      content += "---\n\n";
    }

    return content;
  }

  private async applyHeaderFooter(
    content: string,
    isFooter = false,
  ): Promise<string> {
    if (!this.config.headerFooterTemplates) {
      return content;
    }

    if (isFooter && this.config.headerFooterTemplates.footer) {
      const variables = this.buildTemplateVariables([]);
      let footer = this.config.headerFooterTemplates.footer;

      for (const [key, value] of Object.entries(variables)) {
        footer = footer.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      }

      return footer;
    }

    if (!isFooter && this.config.headerFooterTemplates.header) {
      const variables = this.buildTemplateVariables([]);
      let header = this.config.headerFooterTemplates.header;

      for (const [key, value] of Object.entries(variables)) {
        header = header.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      }

      return header + content;
    }

    return content;
  }

  private async generateHtmlStatistics(
    dependencies: DependencyLicense[],
  ): Promise<string> {
    const stats = this.calculateStatistics(dependencies);

    return `
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div>Total Dependencies</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.attributionRequired}</div>
                <div>Require Attribution</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.uniqueLicenses}</div>
                <div>Unique Licenses</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.copyrightHolders}</div>
                <div>Copyright Holders</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.copyleftCount}</div>
                <div>Copyleft Licenses</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.permissiveCount}</div>
                <div>Permissive Licenses</div>
            </div>
        </div>`;
  }

  private async generateMarkdownStatistics(
    dependencies: DependencyLicense[],
  ): Promise<string> {
    const stats = this.calculateStatistics(dependencies);

    return `## Statistics

| Metric | Count |
|--------|-------|
| Total Dependencies | ${stats.total} |
| Requiring Attribution | ${stats.attributionRequired} |
| Unique Licenses | ${stats.uniqueLicenses} |
| Copyright Holders | ${stats.copyrightHolders} |
| Copyleft Licenses | ${stats.copyleftCount} |
| Permissive Licenses | ${stats.permissiveCount} |
`;
  }

  private async generateJsonMetadata(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument> {
    const stats = this.calculateStatistics(dependencies);

    const metadata = {
      generatedAt: new Date().toISOString(),
      generator: "ast-copilot-helper-advanced-attribution-generator",
      version: "1.0.0",
      statistics: stats,
      dependencies: dependencies.map((dep) => ({
        name: dep.packageName,
        version: dep.version,
        license: {
          spdxId: dep.license.spdxId,
          name: dep.license.name,
          url: dep.license.url,
          compatibility: dep.license.compatibility,
        },
        copyrightHolders: dep.copyrightHolders,
        sourceUrl: dep.sourceUrl,
        attributionRequired: dep.attributionRequired,
        files: {
          license: dep.licenseFile,
          notice: dep.noticeFile,
        },
      })),
      licenseSummary: this.generateLicenseSummary(dependencies),
      config: {
        grouping: this.config.grouping,
        filter: this.config.filter,
        formats: this.config.formats,
      },
    };

    return {
      filename: "attribution-metadata.json",
      content: JSON.stringify(metadata, null, 2),
      type: "metadata",
    };
  }

  private async generateXmlReport(
    dependencies: DependencyLicense[],
  ): Promise<AttributionDocument> {
    const stats = this.calculateStatistics(dependencies);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<attributions>
    <metadata>
        <generatedAt>${new Date().toISOString()}</generatedAt>
        <generator>ast-copilot-helper-advanced-attribution-generator</generator>
        <totalDependencies>${stats.total}</totalDependencies>
        <uniqueLicenses>${stats.uniqueLicenses}</uniqueLicenses>
        <attributionRequired>${stats.attributionRequired}</attributionRequired>
    </metadata>
    <dependencies>`;

    for (const dep of dependencies) {
      xml += `
        <dependency>
            <name>${this.escapeXml(dep.packageName)}</name>
            <version>${this.escapeXml(dep.version)}</version>
            <license>
                <name>${this.escapeXml(dep.license.name)}</name>
                <spdxId>${this.escapeXml(dep.license.spdxId)}</spdxId>
                <url>${this.escapeXml(dep.license.url)}</url>
            </license>
            <copyrightHolders>`;

      for (const holder of dep.copyrightHolders) {
        xml += `
                <holder>${this.escapeXml(holder)}</holder>`;
      }

      xml += `
            </copyrightHolders>`;

      if (dep.sourceUrl) {
        xml += `
            <sourceUrl>${this.escapeXml(dep.sourceUrl)}</sourceUrl>`;
      }

      xml += `
            <attributionRequired>${dep.attributionRequired}</attributionRequired>
        </dependency>`;
    }

    xml += `
    </dependencies>
</attributions>`;

    return {
      filename: "attributions.xml",
      content: xml,
      type: "metadata",
    };
  }

  private calculateStatistics(dependencies: DependencyLicense[]) {
    const licenseSet = new Set<string>();
    const copyrightHolderSet = new Set<string>();
    let attributionRequired = 0;
    let copyleftCount = 0;
    let permissiveCount = 0;

    for (const dep of dependencies) {
      licenseSet.add(dep.license.spdxId || dep.license.name);

      for (const holder of dep.copyrightHolders) {
        copyrightHolderSet.add(holder);
      }

      if (dep.attributionRequired) {
        attributionRequired++;
      }

      if (dep.license.compatibility.isCopeyleft) {
        copyleftCount++;
      } else {
        permissiveCount++;
      }
    }

    return {
      total: dependencies.length,
      uniqueLicenses: licenseSet.size,
      copyrightHolders: copyrightHolderSet.size,
      attributionRequired,
      copyleftCount,
      permissiveCount,
    };
  }

  private generateLicenseSummary(
    dependencies: DependencyLicense[],
  ): Record<string, number> {
    const summary: Record<string, number> = {};

    for (const dep of dependencies) {
      const licenseKey = dep.license.spdxId || dep.license.name;
      summary[licenseKey] = (summary[licenseKey] || 0) + 1;
    }

    return summary;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
