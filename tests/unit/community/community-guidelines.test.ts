import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Community Guidelines", () => {
  describe("Code of Conduct", () => {
    const cocPath = join(process.cwd(), "CODE_OF_CONDUCT.md");

    it("should exist", () => {
      expect(existsSync(cocPath)).toBe(true);
    });

    describe("content structure", () => {
      let cocContent: string;

      beforeAll(() => {
        cocContent = readFileSync(cocPath, "utf-8");
      });

      it("should have our pledge section", () => {
        expect(cocContent).toContain("## Our Pledge");
        expect(cocContent).toContain("harassment-free experience for everyone");
        expect(cocContent).toContain("open, welcoming,");
        expect(cocContent).toContain(
          "diverse, inclusive, and healthy community",
        );
      });

      it("should have our standards section", () => {
        expect(cocContent).toContain("## Our Standards");
        expect(cocContent).toContain("Demonstrating empathy and kindness");
        expect(cocContent).toContain("Being respectful of differing opinions");
        expect(cocContent).toContain("### Technical Standards");
      });

      it("should have unacceptable behavior section", () => {
        expect(cocContent).toContain("## Unacceptable Behavior");
        expect(cocContent).toContain("sexualized language or imagery");
        expect(cocContent).toContain("### Technical Misconduct");
        expect(cocContent).toContain("Malicious Code");
      });

      it("should have enforcement responsibilities section", () => {
        expect(cocContent).toContain("## Enforcement Responsibilities");
        expect(cocContent).toContain("Community leaders are responsible");
        expect(cocContent).toContain("appropriate and fair corrective action");
      });

      it("should have scope section", () => {
        expect(cocContent).toContain("## Scope");
        expect(cocContent).toContain("### Community Spaces");
        expect(cocContent).toContain("GitHub repositories");
      });

      it("should have enforcement section", () => {
        expect(cocContent).toContain("## Enforcement");
        expect(cocContent).toContain("conduct@ast-copilot-helper.dev");
        expect(cocContent).toContain("### Reporting Guidelines");
      });

      it("should have enforcement guidelines", () => {
        expect(cocContent).toContain("## Enforcement Guidelines");
        expect(cocContent).toContain("### 1. Correction");
        expect(cocContent).toContain("### 2. Warning");
        expect(cocContent).toContain("### 3. Temporary Ban");
        expect(cocContent).toContain("### 4. Permanent Ban");
      });

      it("should have appeals process", () => {
        expect(cocContent).toContain("## Appeals Process");
        expect(cocContent).toContain("14 days of receipt");
      });

      it("should have community guidelines", () => {
        expect(cocContent).toContain("## Community Guidelines");
        expect(cocContent).toContain("### Communication");
        expect(cocContent).toContain("### Collaboration");
        expect(cocContent).toContain("### Technical Conduct");
      });

      it("should have attribution section", () => {
        expect(cocContent).toContain("## Attribution");
        expect(cocContent).toContain("Contributor Covenant");
        expect(cocContent).toContain("version 2.1");
      });

      it("should have contact information", () => {
        expect(cocContent).toContain("conduct@ast-copilot-helper.dev");
        expect(cocContent).toContain("September 22, 2025");
        expect(cocContent).toContain("Version**: 1.0");
      });
    });
  });

  describe("Community Engagement Guide", () => {
    const communityPath = join(process.cwd(), "COMMUNITY.md");

    it("should exist", () => {
      expect(existsSync(communityPath)).toBe(true);
    });

    describe("content structure", () => {
      let communityContent: string;

      beforeAll(() => {
        communityContent = readFileSync(communityPath, "utf-8");
      });

      it("should have community overview section", () => {
        expect(communityContent).toContain("## Community Overview");
        expect(communityContent).toContain("### Mission Statement");
        expect(communityContent).toContain("### Core Values");
        expect(communityContent).toContain("Excellence");
        expect(communityContent).toContain("Collaboration");
        expect(communityContent).toContain("Innovation");
      });

      it("should have getting started section", () => {
        expect(communityContent).toContain("## Getting Started");
        expect(communityContent).toContain("### For New Contributors");
        expect(communityContent).toContain("### For New Users");
        expect(communityContent).toContain("good-first-issue");
      });

      it("should have communication channels section", () => {
        expect(communityContent).toContain("## Communication Channels");
        expect(communityContent).toContain("### Primary Channels");
        expect(communityContent).toContain("GitHub Issues");
        expect(communityContent).toContain("GitHub Discussions");
        expect(communityContent).toContain("### Response Time Expectations");
      });

      it("should have participation guidelines section", () => {
        expect(communityContent).toContain("## Participation Guidelines");
        expect(communityContent).toContain("### Contributing Code");
        expect(communityContent).toContain("### Reviewing Code");
        expect(communityContent).toContain("### Asking for Help");
        expect(communityContent).toContain("### Helping Others");
      });

      it("should have community roles section", () => {
        expect(communityContent).toContain("## Community Roles");
        expect(communityContent).toContain("### Contributors");
        expect(communityContent).toContain("### Regular Contributors");
        expect(communityContent).toContain("### Maintainers");
        expect(communityContent).toContain("### Community Champions");
      });

      it("should have recognition program section", () => {
        expect(communityContent).toContain("## Recognition Program");
        expect(communityContent).toContain("### Contribution Recognition");
        expect(communityContent).toContain("### Monthly Highlights");
        expect(communityContent).toContain("Contributor of the Month");
      });

      it("should have events and activities section", () => {
        expect(communityContent).toContain("## Events and Activities");
        expect(communityContent).toContain("### Regular Activities");
        expect(communityContent).toContain("### Special Events");
        expect(communityContent).toContain("Monthly Community Calls");
      });

      it("should have conflict resolution section", () => {
        expect(communityContent).toContain("## Conflict Resolution");
        expect(communityContent).toContain("### Step 1: Direct Communication");
        expect(communityContent).toContain("### Step 2: Community Mediation");
        expect(communityContent).toContain("### Step 3: Formal Reporting");
        expect(communityContent).toContain("### Escalation Guidelines");
      });

      it("should have community health section", () => {
        expect(communityContent).toContain("## Community Health");
        expect(communityContent).toContain("### Metrics We Track");
        expect(communityContent).toContain("### Health Initiatives");
        expect(communityContent).toContain("Participation");
        expect(communityContent).toContain("Responsiveness");
      });

      it("should have contact information", () => {
        expect(communityContent).toContain("community@ast-copilot-helper.dev");
        expect(communityContent).toContain("September 22, 2025");
        expect(communityContent).toContain("Version**: 1.0");
      });
    });

    describe("formatting and structure", () => {
      let communityContent: string;

      beforeAll(() => {
        communityContent = readFileSync(communityPath, "utf-8");
      });

      it("should have table of contents", () => {
        expect(communityContent).toContain("## Table of Contents");
        expect(communityContent).toContain(
          "[Community Overview](#community-overview)",
        );
        expect(communityContent).toContain(
          "[Getting Started](#getting-started)",
        );
      });

      it("should have proper markdown tables", () => {
        expect(communityContent).toContain(
          "| Channel              | Expected Response Time        |",
        );
        expect(communityContent).toContain(
          "| Severity                  | Response             | Timeline        |",
        );
      });

      it("should have numbered lists for processes", () => {
        expect(communityContent).toContain("1. **Read the Documentation**");
        expect(communityContent).toContain("2. **Set Up Your Environment**");
        expect(communityContent).toContain("3. **Find Your First Issue**");
      });

      it("should use proper markdown emphasis", () => {
        const boldItems = communityContent.match(/\*\*[^*]+\*\*/g) || [];
        expect(boldItems.length).toBeGreaterThan(50);
      });

      it("should have resource links", () => {
        expect(communityContent).toContain(
          "[Code of Conduct](CODE_OF_CONDUCT.md)",
        );
        expect(communityContent).toContain(
          "[Contributing Guidelines](CONTRIBUTING.md)",
        );
        expect(communityContent).toContain("[Project Documentation](docs/)");
      });
    });
  });

  describe("file integration", () => {
    it("should reference each other appropriately", () => {
      const cocPath = join(process.cwd(), "CODE_OF_CONDUCT.md");
      const communityPath = join(process.cwd(), "COMMUNITY.md");

      const cocContent = readFileSync(cocPath, "utf-8");
      const communityContent = readFileSync(communityPath, "utf-8");

      // Community guide should reference Code of Conduct
      expect(communityContent).toContain("CODE_OF_CONDUCT.md");
      expect(communityContent).toContain("Code of Conduct");

      // Both should have consistent contact information
      expect(cocContent).toContain("conduct@ast-copilot-helper.dev");
      expect(communityContent).toContain("community@ast-copilot-helper.dev");

      // Both should have consistent versioning
      expect(cocContent).toContain("September 22, 2025");
      expect(communityContent).toContain("September 22, 2025");
    });

    it("should have consistent formatting style", () => {
      const cocPath = join(process.cwd(), "CODE_OF_CONDUCT.md");
      const communityPath = join(process.cwd(), "COMMUNITY.md");

      const cocContent = readFileSync(cocPath, "utf-8");
      const communityContent = readFileSync(communityPath, "utf-8");

      // Both should use consistent header styles
      expect(cocContent).toMatch(/^## [A-Z]/m);
      expect(communityContent).toMatch(/^## [A-Z]/m);

      // Both should use consistent bullet points
      expect(cocContent).toContain("- ");
      expect(communityContent).toContain("- ");
    });
  });
});
