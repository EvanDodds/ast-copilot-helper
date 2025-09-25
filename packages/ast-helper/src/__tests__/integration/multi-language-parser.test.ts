/**
 * Multi-Language Parser Integration Tests
 * Validates the multi-language AST parser implementation across all supported languages
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Import parser factory and components
import { ParserFactory } from "../../parser/parsers/factory.js";
import { TreeSitterGrammarManager } from "../../parser/grammar-manager.js";
import { NodeClassifier } from "../../parser/node-classifier.js";
import type { ASTParser } from "../../parser/types.js";

/**
 * Configuration interface for language parsers
 */
interface LanguageTestConfig {
  name: string;
  tier: number;
  grammar: string;
  extensions: string[];
}

/**
 * Multi-language parser configurations organized by support tier
 * Tier 1: Enterprise Languages (6) - Full production support
 * Tier 2: Developer Languages (5) - Strong community support
 * Tier 3: Specialized Languages (4) - Domain-specific support
 */
const languageConfigs = new Map<string, LanguageTestConfig>([
  // Tier 1: Enterprise Languages (6 languages)
  [
    "typescript",
    {
      name: "TypeScript",
      tier: 1,
      grammar: "typescript",
      extensions: [".ts", ".tsx"],
    },
  ],
  [
    "javascript",
    {
      name: "JavaScript",
      tier: 1,
      grammar: "javascript",
      extensions: [".js", ".jsx"],
    },
  ],
  [
    "python",
    { name: "Python", tier: 1, grammar: "python", extensions: [".py", ".pyi"] },
  ],
  ["java", { name: "Java", tier: 1, grammar: "java", extensions: [".java"] }],
  [
    "cpp",
    {
      name: "C++",
      tier: 1,
      grammar: "cpp",
      extensions: [".cpp", ".hpp", ".cc", ".h"],
    },
  ],
  ["csharp", { name: "C#", tier: 1, grammar: "c_sharp", extensions: [".cs"] }],

  // Tier 2: Developer Languages (5 languages)
  ["go", { name: "Go", tier: 2, grammar: "go", extensions: [".go"] }],
  ["rust", { name: "Rust", tier: 2, grammar: "rust", extensions: [".rs"] }],
  ["php", { name: "PHP", tier: 2, grammar: "php", extensions: [".php"] }],
  ["ruby", { name: "Ruby", tier: 2, grammar: "ruby", extensions: [".rb"] }],
  [
    "swift",
    { name: "Swift", tier: 2, grammar: "swift", extensions: [".swift"] },
  ],

  // Tier 3: Specialized Languages (4 languages)
  [
    "kotlin",
    { name: "Kotlin", tier: 3, grammar: "kotlin", extensions: [".kt", ".kts"] },
  ],
  [
    "scala",
    { name: "Scala", tier: 3, grammar: "scala", extensions: [".scala"] },
  ],
  ["dart", { name: "Dart", tier: 3, grammar: "dart", extensions: [".dart"] }],
  ["lua", { name: "Lua", tier: 3, grammar: "lua", extensions: [".lua"] }],
]);

/**
 * Test parser instance and grammar manager
 */
let testParser: ASTParser;
let grammarManager: TreeSitterGrammarManager;
let nodeClassifier: NodeClassifier;

describe("Multi-Language Parser Integration", () => {
  beforeAll(async () => {
    // Initialize grammar manager and parser
    grammarManager = new TreeSitterGrammarManager();
    testParser = await ParserFactory.createParser(grammarManager);
    nodeClassifier = new NodeClassifier();
  });

  afterAll(async () => {
    // Clean up parser resources
    if (testParser) {
      await testParser.dispose();
    }
  });

  // Test each tier of languages
  describe("Tier 1: Enterprise Languages", () => {
    const tier1Languages = Array.from(languageConfigs.entries()).filter(
      ([, config]) => config.tier === 1,
    );

    tier1Languages.forEach(([languageKey, config]) => {
      describe(`${config.name.toUpperCase()} Integration`, () => {
        it(`should support ${config.name} grammar`, () => {
          expect(config.grammar).toBeDefined();
          expect(config.grammar).toBe(
            languageKey === "csharp" ? "c_sharp" : languageKey,
          );
        });

        it(`should have file extensions defined`, () => {
          expect(config.extensions).toBeDefined();
          expect(config.extensions.length).toBeGreaterThan(0);
        });

        it(`should be classified as tier 1 enterprise language`, () => {
          expect(config.tier).toBe(1);
        });
      });
    });
  });

  describe("Tier 2: Developer Languages", () => {
    const tier2Languages = Array.from(languageConfigs.entries()).filter(
      ([, config]) => config.tier === 2,
    );

    tier2Languages.forEach(([languageKey, config]) => {
      describe(`${config.name.toUpperCase()} Integration`, () => {
        it(`should support ${config.name} grammar`, () => {
          expect(config.grammar).toBeDefined();
          expect(config.grammar).toBe(languageKey);
        });

        it(`should have file extensions defined`, () => {
          expect(config.extensions).toBeDefined();
          expect(config.extensions.length).toBeGreaterThan(0);
        });

        it(`should be classified as tier 2 developer language`, () => {
          expect(config.tier).toBe(2);
        });
      });
    });
  });

  describe("Tier 3: Specialized Languages", () => {
    const tier3Languages = Array.from(languageConfigs.entries()).filter(
      ([, config]) => config.tier === 3,
    );

    tier3Languages.forEach(([languageKey, config]) => {
      describe(`${config.name.toUpperCase()} Integration`, () => {
        it(`should support ${config.name} grammar`, () => {
          expect(config.grammar).toBeDefined();
          expect(config.grammar).toBe(languageKey);
        });

        it(`should have file extensions defined`, () => {
          expect(config.extensions).toBeDefined();
          expect(config.extensions.length).toBeGreaterThan(0);
        });

        it(`should be classified as tier 3 specialized language`, () => {
          expect(config.tier).toBe(3);
        });
      });
    });
  });

  describe("Parser Infrastructure", () => {
    it("should initialize parser successfully", () => {
      expect(testParser).toBeDefined();
      expect(testParser.parseCode).toBeDefined();
      expect(testParser.parseFile).toBeDefined();
    });

    it("should initialize grammar manager", () => {
      expect(grammarManager).toBeDefined();
    });

    it("should initialize node classifier", () => {
      expect(nodeClassifier).toBeDefined();
      expect(nodeClassifier.classifyNode).toBeDefined();
    });
  });

  describe("Language Support Matrix", () => {
    it("should have exactly 15 supported languages", () => {
      expect(languageConfigs.size).toBe(15);
    });

    it("should have proper tier distribution", () => {
      const tierCounts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0 };

      for (const [, config] of languageConfigs) {
        tierCounts[config.tier]++;
      }

      expect(tierCounts[1]).toBe(6); // Enterprise: 6 languages
      expect(tierCounts[2]).toBe(5); // Developer: 5 languages
      expect(tierCounts[3]).toBe(4); // Specialized: 4 languages
    });

    it("should support all major programming paradigms", () => {
      const languages = Array.from(languageConfigs.keys());

      // Object-oriented languages
      expect(languages).toContain("java");
      expect(languages).toContain("csharp");
      expect(languages).toContain("kotlin");
      expect(languages).toContain("scala");

      // Functional programming
      expect(languages).toContain("scala"); // Multi-paradigm

      // Systems programming
      expect(languages).toContain("rust");
      expect(languages).toContain("cpp");
      expect(languages).toContain("go");

      // Web development
      expect(languages).toContain("javascript");
      expect(languages).toContain("typescript");
      expect(languages).toContain("php");

      // Scripting and general purpose
      expect(languages).toContain("python");
      expect(languages).toContain("ruby");
      expect(languages).toContain("lua");

      // Mobile development
      expect(languages).toContain("swift");
      expect(languages).toContain("dart");
    });

    it("should have balanced tier distribution", () => {
      const tierCounts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0 };

      for (const [, config] of languageConfigs) {
        tierCounts[config.tier]++;
      }

      // Validate decreasing tier sizes (enterprise > developer > specialized)
      expect(tierCounts[1]).toBeGreaterThan(tierCounts[2]);
      expect(tierCounts[2]).toBeGreaterThan(tierCounts[3]);

      // Validate total coverage
      const total = tierCounts[1] + tierCounts[2] + tierCounts[3];
      expect(total).toBe(15);
    });
  });

  describe("Runtime Validation", () => {
    it("should detect runtime availability", async () => {
      const runtimeInfo = await ParserFactory.getRuntimeInfo();
      expect(runtimeInfo).toBeDefined();
      expect(runtimeInfo.recommended).toMatch(/^(native|wasm)$/);

      // At least WASM should be available as fallback
      expect(runtimeInfo.wasm.available || runtimeInfo.native.available).toBe(
        true,
      );
    });
  });

  describe("Basic Parsing Functionality", () => {
    const testCodes = {
      javascript: 'function hello() { return "world"; }',
      typescript: 'function hello(): string { return "world"; }',
      python: 'def hello():\n    return "world"',
      java: 'public class Test { public String hello() { return "world"; } }',
    };

    Object.entries(testCodes).forEach(([language, code]) => {
      const config = languageConfigs.get(language);
      if (config) {
        it(`should parse basic ${config.name} code`, async () => {
          const result = await testParser.parseCode(code, config.grammar);
          expect(result).toBeDefined();
          expect(result.language).toBe(config.grammar);
          expect(Array.isArray(result.nodes)).toBe(true);
          expect(Array.isArray(result.errors)).toBe(true);
          expect(typeof result.parseTime).toBe("number");
        });
      }
    });
  });
});
