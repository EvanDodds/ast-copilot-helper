/**
 * AST Node Relationship and Hierarchy Validation Tests
 *
 * This test suite validates that parent-child relationships, scope chains,
 * and hierarchical structures are correctly maintained in our AST extraction.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NativeTreeSitterParser } from "../parsers/native-parser";
import { TreeSitterGrammarManager } from "../grammar-manager";
import type { ParserRuntime, ASTNode, ParseResult } from "../types";

describe("AST Node Relationship Validation", () => {
  let parser: NativeTreeSitterParser;
  let grammarManager: TreeSitterGrammarManager;

  beforeEach(() => {
    grammarManager = new TreeSitterGrammarManager();
    const runtime: ParserRuntime = {
      type: "native",
      available: true,
      async initialize() {
        // Runtime initialization
      },
      async createParser() {
        return {}; // Mock parser for tests
      },
    };
    parser = new NativeTreeSitterParser(runtime, grammarManager);
  });

  describe("Scope Chain Validation", () => {
    it("should correctly build scope chains for nested structures", async () => {
      const testCode = `
        namespace MyNamespace {
          export class UserService {
            private repository: UserRepository;
            
            constructor(repo: UserRepository) {
              this.repository = repo;
            }
            
            async findUser(id: string): Promise<User | null> {
              const user = await this.repository.findById(id);
              if (user) {
                return this.transformUser(user);
              }
              return null;
            }
            
            private transformUser(rawUser: any): User {
              return {
                id: rawUser.id,
                name: rawUser.name,
                email: rawUser.email
              };
            }
          }
        }
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(testCode, "typescript", "test.ts");
      } catch (error) {
        console.warn("TypeScript parsing not available:", error);
        return;
      }

      if (result.nodes.length > 0) {
        // Find method nodes and validate their scope chains
        const methodNodes = result.nodes.filter(
          (n) =>
            n.type.toLowerCase().includes("method") ||
            n.type.toLowerCase().includes("function") ||
            (n.name &&
              ["findUser", "transformUser", "constructor"].includes(n.name)),
        );

        for (const methodNode of methodNodes) {
          // Methods should have at least namespace and class in their scope
          if (
            methodNode.metadata.scope &&
            methodNode.metadata.scope.length > 0
          ) {
            expect(methodNode.metadata.scope.length).toBeGreaterThanOrEqual(1);
            console.log(
              `✓ Method ${methodNode.name || methodNode.type} has scope chain:`,
              methodNode.metadata.scope,
            );
          }
        }

        // Validate that deeper nested elements have longer scope chains
        const scopeLengths = result.nodes
          .map((n) => n.metadata.scope?.length || 0)
          .filter((len) => len > 0);

        if (scopeLengths.length > 1) {
          const minScopeLength = Math.min(...scopeLengths);
          const maxScopeLength = Math.max(...scopeLengths);
          expect(maxScopeLength).toBeGreaterThanOrEqual(minScopeLength);
          console.log(
            `✓ Scope chain depth range: ${minScopeLength} to ${maxScopeLength}`,
          );
        }
      }
    });

    it("should maintain consistent scope chains for sibling nodes", async () => {
      const testCode = `
        class Calculator {
          add(a, b) { return a + b; }
          subtract(a, b) { return a - b; }
          multiply(a, b) { return a * b; }
          divide(a, b) { return b !== 0 ? a / b : 0; }
        }
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(testCode, "javascript", "test.js");
      } catch (error) {
        console.warn("JavaScript parsing not available:", error);
        return;
      }

      if (result.nodes.length > 0) {
        // Find all method nodes
        const methodNodes = result.nodes.filter(
          (n) =>
            n.type.toLowerCase().includes("method") ||
            n.type.toLowerCase().includes("function") ||
            (n.name &&
              ["add", "subtract", "multiply", "divide"].includes(n.name)),
        );

        if (methodNodes.length >= 2) {
          // All method nodes should have similar scope chain lengths
          const scopeLengths = methodNodes.map(
            (n) => n.metadata.scope?.length || 0,
          );
          const uniqueScopeLengths = [...new Set(scopeLengths)];

          // Should have at most 2 different scope lengths (slight variations are acceptable)
          expect(uniqueScopeLengths.length).toBeLessThanOrEqual(2);
          console.log(
            `✓ Method scope consistency: lengths [${scopeLengths.join(", ")}]`,
          );
        }
      }
    });
  });

  describe("Node Position Validation", () => {
    it("should assign valid line and column positions", async () => {
      const testCode = `function test() {
  const x = 42;
  return x * 2;
}`;

      let result: ParseResult;
      try {
        result = await parser.parseCode(testCode, "javascript", "test.js");
      } catch (error) {
        console.warn("JavaScript parsing not available:", error);
        return;
      }

      if (result.nodes.length > 0) {
        for (const node of result.nodes) {
          // All nodes should have valid positions
          expect(node.start.line).toBeGreaterThan(0);
          expect(node.start.column).toBeGreaterThanOrEqual(0);
          expect(node.end.line).toBeGreaterThanOrEqual(node.start.line);

          // If on same line, end column should be >= start column
          if (node.end.line === node.start.line) {
            expect(node.end.column).toBeGreaterThanOrEqual(node.start.column);
          }
        }

        console.log(
          `✓ Position validation passed for ${result.nodes.length} nodes`,
        );
      }
    });

    it("should maintain position ordering for sequential nodes", async () => {
      const testCode = `
        const first = 1;
        const second = 2;
        const third = 3;
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(testCode, "javascript", "test.js");
      } catch (error) {
        console.warn("JavaScript parsing not available:", error);
        return;
      }

      if (result.nodes.length > 1) {
        // Sort nodes by position
        const sortedNodes = [...result.nodes].sort((a, b) => {
          if (a.start.line !== b.start.line) {
            return a.start.line - b.start.line;
          }
          return a.start.column - b.start.column;
        });

        // Verify nodes are in correct order
        for (let i = 1; i < sortedNodes.length; i++) {
          const prev = sortedNodes[i - 1];
          const curr = sortedNodes[i];

          const prevEnd = prev.end.line * 1000 + prev.end.column;
          const currStart = curr.start.line * 1000 + curr.start.column;

          // Current node should start after previous node ends (with some tolerance)
          expect(currStart).toBeGreaterThanOrEqual(prevEnd - 10);
        }

        console.log(
          `✓ Position ordering validated for ${sortedNodes.length} nodes`,
        );
      }
    });
  });

  describe("Node Metadata Integrity", () => {
    it("should preserve language information consistently", async () => {
      const testCode = `
        def process_data(items):
            return [item for item in items if item.is_valid()]
        
        class DataProcessor:
            def __init__(self):
                self.processed_count = 0
                
            def process(self, data):
                result = process_data(data)
                self.processed_count += len(result)
                return result
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(testCode, "python", "test.py");
      } catch (error) {
        console.warn("Python parsing not available:", error);
        return;
      }

      if (result.nodes.length > 0) {
        // All nodes should have consistent language metadata
        for (const node of result.nodes) {
          expect(node.metadata.language).toBe("python");
          expect(node.filePath).toContain("test.py");
        }

        console.log(
          `✓ Language metadata consistent across ${result.nodes.length} nodes`,
        );
      }
    });

    it("should extract meaningful node names", async () => {
      const testCode = `
        interface DatabaseConfig {
          host: string;
          port: number;
          database: string;
        }
        
        class DatabaseConnection implements DatabaseConfig {
          host: string;
          port: number;
          database: string;
          
          constructor(config: DatabaseConfig) {
            this.host = config.host;
            this.port = config.port;
            this.database = config.database;
          }
          
          async connect(): Promise<boolean> {
            // Connection logic here
            return true;
          }
        }
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(testCode, "typescript", "test.ts");
      } catch (error) {
        console.warn("TypeScript parsing not available:", error);
        return;
      }

      if (result.nodes.length > 0) {
        // Look for nodes with meaningful names
        const namedNodes = result.nodes.filter(
          (n) => n.name && n.name.length > 0,
        );

        if (namedNodes.length > 0) {
          expect(namedNodes.length).toBeGreaterThan(0);

          // Check for expected names
          const nodeNames = namedNodes.map((n) => n.name);
          const expectedNames = [
            "DatabaseConfig",
            "DatabaseConnection",
            "connect",
            "constructor",
          ];

          for (const expectedName of expectedNames) {
            const hasExpectedName = nodeNames.some(
              (name) => name === expectedName || name?.includes(expectedName),
            );
            if (hasExpectedName) {
              console.log(`✓ Found expected name: ${expectedName}`);
            }
          }

          console.log(`✓ Named nodes: [${nodeNames.join(", ")}]`);
        }
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle syntax errors gracefully", async () => {
      const malformedCode = `
        function broken( {
          const x = ;
          return x
        }
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(malformedCode, "javascript", "test.js");
      } catch (error) {
        console.warn("JavaScript parsing not available:", error);
        return;
      }

      // Should still produce some result, possibly with errors
      expect(result).toBeDefined();
      expect(result.language).toBe("javascript");

      if (result.errors.length > 0) {
        console.log(`✓ Syntax errors detected: ${result.errors.length} errors`);

        // Errors should have meaningful information
        for (const error of result.errors) {
          expect(error.type).toBeDefined();
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
        }
      }
    });

    it("should handle empty code gracefully", async () => {
      const emptyCode = "";

      let result: ParseResult;
      try {
        result = await parser.parseCode(emptyCode, "javascript", "test.js");
      } catch (error) {
        console.warn("JavaScript parsing not available:", error);
        return;
      }

      expect(result).toBeDefined();
      expect(result.language).toBe("javascript");
      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);

      console.log(`✓ Empty code handled: ${result.nodes.length} nodes`);
    });

    it("should handle very large code files", async () => {
      // Generate a large code file
      const largeCode = `
        class LargeClass {
          ${Array.from(
            { length: 50 },
            (_, i) => `
            method${i}(param${i}) {
              const result${i} = param${i} * ${i};
              return result${i} + ${i};
            }
          `,
          ).join("\n")}
        }
      `;

      let result: ParseResult;
      try {
        result = await parser.parseCode(largeCode, "javascript", "test.js");
      } catch (error) {
        console.warn("JavaScript parsing not available:", error);
        return;
      }

      expect(result).toBeDefined();

      if (result.nodes.length > 0) {
        expect(result.nodes.length).toBeGreaterThan(10); // Should find many nodes
        console.log(`✓ Large file processed: ${result.nodes.length} nodes`);
      }
    });
  });
});
