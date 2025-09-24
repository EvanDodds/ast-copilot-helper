import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";

const TEMPLATE_DIR = path.join(__dirname, "../../../.github/ISSUE_TEMPLATE");

describe("GitHub Issue Templates", () => {
  let templates: string[] = [];

  beforeAll(async () => {
    try {
      const files = await fs.readdir(TEMPLATE_DIR);
      templates = files.filter((file) => file.endsWith(".md"));
    } catch (error) {
      console.warn(
        "Issue template directory not found:",
        (error as Error).message,
      );
    }
  });

  it("should have all required issue templates", async () => {
    const expectedTemplates = [
      "bug_report.md",
      "feature_request.md",
      "performance_issue.md",
      "documentation.md",
      "question.md",
    ];

    for (const template of expectedTemplates) {
      expect(templates).toContain(template);
    }
  });

  it("should have valid YAML front matter in each template", async () => {
    for (const template of templates) {
      const content = await fs.readFile(
        path.join(TEMPLATE_DIR, template),
        "utf-8",
      );

      // Extract YAML front matter
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(
        yamlMatch,
        `Template ${template} should have YAML front matter`,
      ).toBeTruthy();

      if (yamlMatch) {
        const yamlContent = yamlMatch[1];
        expect(
          () => yaml.load(yamlContent),
          `Template ${template} should have valid YAML`,
        ).not.toThrow();

        const parsed = yaml.load(yamlContent) as any;
        expect(
          parsed.name,
          `Template ${template} should have a name`,
        ).toBeTruthy();
        expect(
          parsed.about,
          `Template ${template} should have an about field`,
        ).toBeTruthy();
        expect(
          parsed.title,
          `Template ${template} should have a title`,
        ).toBeTruthy();
        expect(
          parsed.labels,
          `Template ${template} should have labels`,
        ).toBeTruthy();
      }
    }
  });

  it("should have config.yml with proper structure", async () => {
    const configPath = path.join(TEMPLATE_DIR, "config.yml");
    const configExists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);

    expect(configExists, "config.yml should exist").toBeTruthy();

    if (configExists) {
      const content = await fs.readFile(configPath, "utf-8");
      const config = yaml.load(content) as any;

      expect(config.blank_issues_enabled).toBeDefined();
      expect(config.contact_links).toBeInstanceOf(Array);
      expect(config.contact_links.length).toBeGreaterThan(0);

      for (const link of config.contact_links) {
        expect(link.name).toBeTruthy();
        expect(link.url).toBeTruthy();
        expect(link.about).toBeTruthy();
      }
    }
  });

  it("should have appropriate labels for each template type", async () => {
    const templateLabels: Record<string, string[]> = {
      "bug_report.md": ["bug", "triage"],
      "feature_request.md": ["enhancement", "triage"],
      "performance_issue.md": ["performance", "triage"],
      "documentation.md": ["documentation", "triage"],
      "question.md": ["question", "triage"],
    };

    for (const [template, expectedLabels] of Object.entries(templateLabels)) {
      if (templates.includes(template)) {
        const content = await fs.readFile(
          path.join(TEMPLATE_DIR, template),
          "utf-8",
        );
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (yamlMatch) {
          const parsed = yaml.load(yamlMatch[1]) as any;
          const labels = parsed.labels.split(", ").map((l: string) => l.trim());

          for (const expectedLabel of expectedLabels) {
            expect(labels).toContain(expectedLabel);
          }
        }
      }
    }
  });

  it("should have structured content sections in each template", async () => {
    const requiredSections = {
      "bug_report.md": [
        "Bug Description",
        "To Reproduce",
        "Expected Behavior",
        "Environment",
      ],
      "feature_request.md": ["Describe the solution", "Use Case", "Priority"],
      "performance_issue.md": [
        "Performance Problem Description",
        "Current Behavior",
        "System Information",
      ],
      "documentation.md": [
        "Documentation Issue Type",
        "Location",
        "Suggested Improvement",
      ],
      "question.md": ["What would you like to know?", "Context", "Checklist"],
    };

    for (const [template, sections] of Object.entries(requiredSections)) {
      if (templates.includes(template)) {
        const content = await fs.readFile(
          path.join(TEMPLATE_DIR, template),
          "utf-8",
        );

        for (const section of sections) {
          expect(
            content.includes(section),
            `Template ${template} should contain section: ${section}`,
          ).toBeTruthy();
        }
      }
    }
  });
});
