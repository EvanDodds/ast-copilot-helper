import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TreeSitterGrammarManager } from "./grammar-manager.js";
import { cleanupTestEnvironment } from "./test-utils.js";
import * as path from "path";
import * as fs from "fs/promises";

describe("TypeScript Parsing Validation", () => {
  let grammarManager: TreeSitterGrammarManager;
  const testBaseDir = path.join(process.cwd(), "test-tmp", "ts-parsing-test");

  beforeEach(async () => {
    // Clean up any existing test data
    await fs.rm(testBaseDir, { recursive: true, force: true });
    await fs.mkdir(testBaseDir, { recursive: true });

    grammarManager = new TreeSitterGrammarManager(testBaseDir);
  });

  afterEach(async () => {
    // Clean up test directory and state
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clear grammarManager reference and force cleanup
    grammarManager = null as any;

    // Use comprehensive Tree-sitter state cleanup
    await cleanupTestEnvironment();
  });

  describe("TypeScript Grammar Compatibility", () => {
    it("should successfully parse basic TypeScript syntax", async () => {
      const parser = await grammarManager.loadParser("typescript");
      expect(parser).toBeDefined();

      const basicTypeScript = `
        interface User {
          name: string;
          age: number;
        }

        const user: User = {
          name: "John",
          age: 30
        };

        function greet(user: User): string {
          return \`Hello, \${user.name}!\`;
        }
      `;

      const tree = (parser as any).parse(basicTypeScript);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe("program");

      // Should have parsed the interface, const declaration, and function
      expect(tree.rootNode.childCount).toBeGreaterThan(0);
    });

    it("should parse TypeScript with advanced features", async () => {
      const parser = await grammarManager.loadParser("typescript");

      const advancedTypeScript = `
        type Status = "pending" | "approved" | "rejected";
        
        class UserManager<T extends User> {
          private users: T[] = [];
          
          async addUser(user: T): Promise<void> {
            this.users.push(user);
          }
          
          getUsersByStatus(status: Status): T[] {
            return this.users.filter(u => u.status === status);
          }
        }
        
        export default UserManager;
      `;

      const tree = (parser as any).parse(advancedTypeScript);
      expect(tree).toBeDefined();
      expect(tree.rootNode.childCount).toBeGreaterThan(0);

      // Should not have any error nodes for valid TypeScript
      const hasErrors = tree.rootNode.hasError;
      expect(hasErrors).toBe(false);
    });

    it("should handle TypeScript syntax errors gracefully", async () => {
      const parser = await grammarManager.loadParser("typescript");

      const invalidTypeScript = `
        const user: User = {
          name: "John"
          age: 30  // Missing comma
        }
        
        function greet(user: User): string {
          return \`Hello, \${user.name!
        }  // Unclosed template literal
      `;

      const tree = (parser as any).parse(invalidTypeScript);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();

      // Should have error nodes but still parse
      const hasErrors = tree.rootNode.hasError;
      expect(hasErrors).toBe(true);
    });
  });

  describe("JavaScript Grammar Compatibility", () => {
    it("should successfully parse JavaScript", async () => {
      const parser = await grammarManager.loadParser("javascript");

      const jsCode = `
        const users = [];
        
        function addUser(name, age) {
          users.push({ name, age });
        }
        
        addUser("John", 30);
      `;

      const tree = (parser as any).parse(jsCode);
      expect(tree).toBeDefined();
      expect(tree.rootNode.type).toBe("program");
      expect(tree.rootNode.hasError).toBe(false);
    });
  });

  describe("Python Grammar Compatibility", () => {
    it("should successfully parse Python", async () => {
      const parser = await grammarManager.loadParser("python");

      const pythonCode = `
def greet(name: str) -> str:
    return f"Hello, {name}!"

class User:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
    
    def __str__(self) -> str:
        return f"User(name={self.name}, age={self.age})"

user = User("John", 30)
print(greet(user.name))
      `;

      const tree = (parser as any).parse(pythonCode);
      expect(tree).toBeDefined();
      expect(tree.rootNode.type).toBe("module");
      expect(tree.rootNode.hasError).toBe(false);
    });
  });
});
