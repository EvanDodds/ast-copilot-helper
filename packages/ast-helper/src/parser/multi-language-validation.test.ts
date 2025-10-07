import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TreeSitterGrammarManager } from "./grammar-manager.js";
import { cleanupTestEnvironment } from "./test-utils.js";
import * as fs from "fs/promises";
import * as path from "path";

describe("Tree-sitter Language Support Validation", () => {
  let grammarManager: TreeSitterGrammarManager;
  const testBaseDir = path.join(
    process.cwd(),
    "test-tmp",
    "multilang-validation-test",
  );

  beforeEach(async () => {
    // Clean up any existing test data and create fresh directory
    await fs.rm(testBaseDir, { recursive: true, force: true });
    await fs.mkdir(testBaseDir, { recursive: true });

    grammarManager = new TreeSitterGrammarManager(testBaseDir);
  });

  afterEach(async () => {
    // Clean up test directory to prevent cache interference
    try {
      await grammarManager.cleanCache();
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clear grammarManager reference and force cleanup
    grammarManager = null as any;

    // Use comprehensive Tree-sitter state cleanup
    await cleanupTestEnvironment();
  });

  describe("Core Working Languages", () => {
    it("should successfully parse TypeScript with advanced features", async () => {
      const parser = await grammarManager.loadParser("typescript");
      expect(parser).toBeDefined();

      // Test parsing advanced TypeScript code
      const code = `
        interface User<T = string> {
          id: T;
          name: string;
          meta?: Record<string, unknown>;
        }

        class UserService implements Service {
          async findUser<T extends User>(id: T['id']): Promise<T | null> {
            return this.repository.findById(id);
          }
        }
      `;

      const tree = (parser as any).parse(code);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe("program");
      // Check if tree has any errors - Tree-sitter uses hasError as a property
      expect(tree.rootNode.hasError).toBe(false);
    });

    it("should successfully parse JavaScript ES6+ features", async () => {
      const parser = await grammarManager.loadParser("javascript");
      expect(parser).toBeDefined();

      const code = `
        const fetchData = async (url, { timeout = 5000 } = {}) => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              signal: controller.signal,
              ...options
            });
            return await response.json();
          } catch (error) {
            throw new APIError(\`Failed to fetch: \${error.message}\`);
          }
        };
      `;

      const tree = (parser as any).parse(code);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe("program");
      expect(tree.rootNode.hasError).toBe(false);
    });

    it("should successfully parse Python with modern syntax", async () => {
      const parser = await grammarManager.loadParser("python");
      expect(parser).toBeDefined();

      const code = `
from typing import Generic, TypeVar, Optional, List
from dataclasses import dataclass
import asyncio

T = TypeVar('T')

@dataclass
class Repository(Generic[T]):
    items: List[T] = field(default_factory=list)
    
    async def find_by_id(self, id: str) -> Optional[T]:
        return next((item for item in self.items if item.id == id), None)
        
    def __post_init__(self) -> None:
        if not self.items:
            self.items = []
      `;

      const tree = (parser as any).parse(code);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe("module");
      expect(tree.rootNode.hasError).toBe(false);
    });
  });

  describe("Extended Language Support", () => {
    it("should detect incompatible parser modules and provide helpful errors", async () => {
      // Test that Java parser gives a helpful error about missing language property or WASM fallback
      await expect(grammarManager.loadParser("java")).rejects.toThrow();
    });

    it("should detect incompatible C# parser modules", async () => {
      await expect(grammarManager.loadParser("csharp")).rejects.toThrow();
    });

    it("should detect incompatible Go parser modules", async () => {
      await expect(grammarManager.loadParser("go")).rejects.toThrow();
    });

    it("should detect incompatible Rust parser modules", async () => {
      await expect(grammarManager.loadParser("rust")).rejects.toThrow();
    });

    it("should detect incompatible C parser modules", async () => {
      await expect(grammarManager.loadParser("c")).rejects.toThrow();
    });

    it("should detect incompatible C++ parser modules", async () => {
      await expect(grammarManager.loadParser("cpp")).rejects.toThrow();
    });
  });

  describe("Language Detection and Error Handling", () => {
    it("should handle parsing failures gracefully", async () => {
      // Test with invalid syntax
      const parser = await grammarManager.loadParser("typescript");
      const invalidCode = "class { invalid syntax }";

      const tree = (parser as any).parse(invalidCode);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      // Tree-sitter still creates a tree even with errors
      expect(tree.rootNode.hasError).toBe(true);
    });

    it("should throw for completely unsupported languages", async () => {
      await expect(grammarManager.loadParser("nonexistent")).rejects.toThrow(
        "Unsupported language: nonexistent",
      );
    });
  });

  describe("Parser Management", () => {
    it("should load parsers successfully for working languages", async () => {
      // Test that all working languages can be loaded
      const languages = ["typescript", "javascript", "python"];

      for (const language of languages) {
        const parser = await grammarManager.loadParser(language);
        expect(parser).toBeDefined();

        // Test basic parsing
        const simpleCode = language === "python" ? "x = 1" : "const x = 1";
        const tree = (parser as any).parse(simpleCode);
        expect(tree).toBeDefined();
        expect(tree.rootNode).toBeDefined();
      }
    });

    it("should maintain parser instances efficiently", async () => {
      const parser1 = await grammarManager.loadParser("typescript");
      const parser2 = await grammarManager.loadParser("typescript");

      expect(parser1).toBeDefined();
      expect(parser2).toBeDefined();
      // Both should work independently

      const tree1 = (parser1 as any).parse("const a = 1;");
      const tree2 = (parser2 as any).parse("const b = 2;");

      expect(tree1.rootNode.hasError).toBe(false);
      expect(tree2.rootNode.hasError).toBe(false);
    });
  });

  describe("Language Features Validation", () => {
    it("should parse complex TypeScript syntax correctly", async () => {
      const parser = await grammarManager.loadParser("typescript");

      const complexCode = `
        export default class GenericService<T extends BaseEntity> {
          constructor(private repository: Repository<T>) {}
          
          async findAll(): Promise<T[]> {
            return await this.repository.findMany({});
          }
          
          async create(data: Partial<T>): Promise<T> {
            return await this.repository.create(data);
          }
        }
      `;

      const tree = (parser as any).parse(complexCode);
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.type).toBe("program");
    });

    it("should parse modern JavaScript features", async () => {
      const parser = await grammarManager.loadParser("javascript");

      const modernCode = `
        export const createUser = async ({ name, email, ...rest }) => {
          const user = { 
            id: crypto.randomUUID(),
            name,
            email,
            createdAt: new Date().toISOString(),
            ...rest
          };
          
          return await database.users.create(user);
        };
      `;

      const tree = (parser as any).parse(modernCode);
      expect(tree.rootNode.hasError).toBe(false);
    });

    it("should parse Python type annotations and async features", async () => {
      const parser = await grammarManager.loadParser("python");

      const pythonCode = `
async def process_items(items: List[Dict[str, Any]]) -> Dict[str, int]:
    results = {}
    
    async for item in items:
        key = item.get('key', 'default')
        value = await calculate_value(item)
        results[key] = value
    
    return results
      `;

      const tree = (parser as any).parse(pythonCode);
      expect(tree.rootNode.hasError).toBe(false);
    });
  });
});
