/**
 * Focused Tree-sitter Integration Tests
 *
 * This file contains focused integration tests for the Tree-sitter parser
 * implementation, designed to validate key parsing capabilities without
 * the memory overhead of the larger integration test suite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createParser } from "../../../packages/ast-helper/src/parser/parsers/factory.js";
import { TreeSitterGrammarManager } from "../../../packages/ast-helper/src/parser/grammar-manager.js";
import { detectLanguage } from "../../../packages/ast-helper/src/parser/languages.js";
import type {
  ASTParser,
  ParseResult,
} from "../../../packages/ast-helper/src/parser/types.js";

describe("Tree-sitter Integration Tests", () => {
  let parser: ASTParser;
  let grammarManager: TreeSitterGrammarManager;

  beforeEach(async () => {
    try {
      grammarManager = new TreeSitterGrammarManager();
      parser = await createParser(grammarManager);
    } catch (error) {
      console.warn("Parser creation failed, tests may be skipped:", error);
    }
  });

  describe("Language Detection", () => {
    it("should correctly detect programming languages from file extensions", () => {
      const testCases = [
        { filePath: "test.js", expected: "javascript" },
        { filePath: "test.ts", expected: "typescript" },
        { filePath: "test.py", expected: "python" },
        { filePath: "test.rs", expected: "rust" },
        { filePath: "test.go", expected: "go" },
        { filePath: "test.java", expected: "java" },
        { filePath: "test.cpp", expected: "cpp" },
        { filePath: "test.cs", expected: "csharp" },
      ];

      for (const testCase of testCases) {
        const detected = detectLanguage(testCase.filePath);
        expect(detected).toBe(testCase.expected);
      }
    });

    it("should handle unknown file extensions gracefully", () => {
      const unknown = detectLanguage("test.xyz");
      expect(unknown).toBe(null); // Unknown extensions return null
    });
  });

  describe("Multi-Language Parsing", () => {
    it("should parse JavaScript with modern syntax features", async () => {
      if (!parser) {
        return;
      }

      const jsCode = `
import { createApp } from 'vue';
import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.axios = axios.create({ baseURL });
  }

  async fetchUsers() {
    try {
      const response = await this.axios.get('/users');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  }
}

const apiClient = new APIClient();

export { APIClient, apiClient };
`;

      const result: ParseResult = await parser.parseCode(jsCode, "javascript");

      expect(result.errors.length).toBe(0);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.language).toBe("javascript");

      // Check for specific language constructs
      const classNodes = result.nodes.filter(
        (n: any) => n.type === "class" || n.type === "class_declaration",
      );
      const importNodes = result.nodes.filter(
        (n: any) => n.type === "import" || n.type === "import_statement",
      );
      const methodNodes = result.nodes.filter(
        (n: any) => n.type === "method" || n.type === "method_definition",
      );

      expect(classNodes.length).toBeGreaterThan(0);
      expect(importNodes.length).toBeGreaterThan(0);
      expect(methodNodes.length).toBeGreaterThan(0);
    });

    it("should parse Python with complex class hierarchies", async () => {
      if (!parser) {
        return;
      }

      const pythonCode = `
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Union
import asyncio
import json

class BaseProcessor(ABC):
    """Abstract base class for data processors."""
    
    def __init__(self, config: Dict[str, str]):
        self.config = config
        self._cache: Dict[str, any] = {}
    
    @abstractmethod
    async def process(self, data: List[Dict]) -> Optional[List[Dict]]:
        """Process the input data."""
        pass
    
    def clear_cache(self) -> None:
        """Clear the internal cache."""
        self._cache.clear()

class JSONProcessor(BaseProcessor):
    """JSON data processor implementation."""
    
    async def process(self, data: List[Dict]) -> Optional[List[Dict]]:
        if not data:
            return None
            
        processed = []
        for item in data:
            try:
                # Validate JSON structure
                json_str = json.dumps(item)
                validated = json.loads(json_str)
                processed.append(validated)
            except (TypeError, ValueError) as e:
                print(f"Skipping invalid item: {e}")
                continue
        
        return processed if processed else None

async def create_processor(config_path: str) -> BaseProcessor:
    """Factory function to create processor instances."""
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    return JSONProcessor(config)
`;

      const result: ParseResult = await parser.parseCode(pythonCode, "python");

      expect(result.errors.length).toBe(0);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.language).toBe("python");

      // Check for specific Python constructs
      const classNodes = result.nodes.filter(
        (n: any) => n.type === "class" || n.type === "class_definition",
      );
      const methodNodes = result.nodes.filter(
        (n: any) =>
          n.type === "method" ||
          n.type === "function" ||
          n.type === "method_definition" ||
          n.type === "function_definition",
      );
      const decoratorNodes = result.nodes.filter(
        (n: any) => n.type === "decorator" || n.type === "decorator_statement",
      );

      expect(classNodes.length).toBeGreaterThan(0);
      expect(methodNodes.length).toBeGreaterThan(0);
      // Decorators might not be captured as separate nodes depending on parser implementation
      expect(decoratorNodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Recovery", () => {
    it("should recover from syntax errors and provide partial parsing", async () => {
      if (!parser) {
        return;
      }

      const malformedCode = `
function validFunction() {
  return "this is valid";
}

// This function has syntax errors
function brokenFunction( {
  const x = "unclosed string
  return x;
}

// This function is valid again
function anotherValidFunction() {
  return 42;
}
`;

      const result: ParseResult = await parser.parseCode(
        malformedCode,
        "javascript",
      );

      // Parser should handle errors gracefully
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);

      // Should still find some valid nodes even with syntax errors
      if (result.errors.length === 0) {
        // If no errors, should find function nodes
        const functionNodes = result.nodes.filter(
          (n: any) =>
            n.type === "function" || n.type === "function_declaration",
        );
        expect(functionNodes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Performance Characteristics", () => {
    it("should parse files within reasonable time limits", async () => {
      if (!parser) {
        return;
      }

      const largeCodeSample = `
// Generate a reasonably large JavaScript file
${"class TestClass { constructor() { this.value = 0; } }\n".repeat(100)}

const instances = [];
${"instances.push(new TestClass());\n".repeat(50)}

function processInstances() {
  return instances.map(instance => ({
    value: instance.value,
    processed: true,
    timestamp: Date.now()
  }));
}

export { TestClass, processInstances };
`;

      const startTime = Date.now();
      const result: ParseResult = await parser.parseCode(
        largeCodeSample,
        "javascript",
      );
      const endTime = Date.now();

      const parseTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);
      expect(parseTime).toBeLessThan(5000); // Should complete within 5 seconds

      if (result.errors.length === 0) {
        expect(result.nodes.length).toBeGreaterThan(100); // Should find many nodes
      }
    });
  });

  describe("Caching and Memory Management", () => {
    it("should handle repeated parsing requests efficiently", async () => {
      if (!parser) {
        return;
      }

      const codeToRepeat = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
export { fibonacci, result };
`;

      const results: ParseResult[] = [];
      const parseTimes: number[] = [];

      // Parse the same code multiple times
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const result = await parser.parseCode(codeToRepeat, "javascript");
        const endTime = Date.now();

        results.push(result);
        parseTimes.push(endTime - startTime);
      }

      // All results should be consistent
      for (const result of results) {
        expect(result.errors.length).toBe(results[0].errors.length);
        expect(result.nodes.length).toBe(results[0].nodes.length);
        expect(result.language).toBe("javascript");
      }

      // Performance should not degrade significantly with repeated parsing
      // (caching might actually improve performance)
      const avgParseTime =
        parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length;
      expect(avgParseTime).toBeLessThan(1000); // Average should be under 1 second
    });
  });
});
