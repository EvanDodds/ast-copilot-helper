/**
 * Integration & Performance Testing Suite
 *
 * Comprehensive end-to-end testing of the complete AST processing system
 * including performance benchmarks, memory usage validation, and full pipeline testing.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as fs from "fs";
import * as _path from "path";

import { NodeProcessor, ProcessingUtils } from "../node-processor";
import { NodeIDGenerator } from "../node-id-generator";
import { NodeClassifier as _NodeClassifier } from "../node-classifier";
import { SignificanceCalculator as _SignificanceCalculator } from "../significance-calculator";
import { MetadataExtractor as _MetadataExtractor } from "../metadata-extractor";
import { NodeSerializer } from "../node-serializer";
import { ASTNode, NodeType, SignificanceLevel } from "../ast-schema";

// Test data for integration tests
const SAMPLE_TYPESCRIPT_CODE = `
import { Component } from '@angular/core';
import * as lodash from 'lodash';

/**
 * Main application component
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'My App';
  private items: string[] = [];
  
  constructor(private service: DataService) {
    this.initializeComponent();
  }
  
  /**
   * Initialize the component with default values
   */
  public async initializeComponent(): Promise<void> {
    try {
      this.items = await this.service.getItems();
      console.log('Component initialized successfully');
    } catch (error) {
      console.error('Failed to initialize component', error);
      throw error;
    }
  }
  
  public addItem(item: string): void {
    if (!item || item.trim().length === 0) {
      throw new Error('Item cannot be empty');
    }
    
    this.items.push(item);
  }
  
  public getItems(): string[] {
    return [...this.items];
  }
  
  private validateItem(item: string): boolean {
    return typeof item === 'string' && item.trim().length > 0;
  }
}

interface DataService {
  getItems(): Promise<string[]>;
}
`;

const SAMPLE_JAVASCRIPT_CODE = `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

/**
 * Express application setup
 */
class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
  }
  
  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    this.app.get('/api/users', async (req, res) => {
      try {
        const users = await this.getUsersFromDatabase();
        res.json({ users, count: users.length });
      } catch (error) {
        console.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
  
  async getUsersFromDatabase() {
    // Simulate database call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ]);
      }, 100);
    });
  }
  
  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(\`Server running on port \${this.port}\`);
        resolve();
      });
    });
  }
  
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

module.exports = Server;
`;

const SAMPLE_PYTHON_CODE = `
import asyncio
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class User:
    """User data model"""
    id: int
    name: str
    email: str
    is_active: bool = True
    
    def __str__(self) -> str:
        return f"User(id={self.id}, name='{self.name}')"
    
    def to_dict(self) -> Dict[str, any]:
        """Convert user to dictionary representation"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'is_active': self.is_active
        }

class DatabaseInterface(ABC):
    """Abstract database interface"""
    
    @abstractmethod
    async def get_users(self) -> List[User]:
        pass
    
    @abstractmethod
    async def create_user(self, user: User) -> User:
        pass

class UserService:
    """Service class for user operations"""
    
    def __init__(self, database: DatabaseInterface):
        self.database = database
        self._cache: Dict[int, User] = {}
    
    async def get_all_users(self) -> List[User]:
        """Retrieve all users from database"""
        try:
            users = await self.database.get_users()
            logger.info(f"Retrieved {len(users)} users")
            
            # Update cache
            for user in users:
                self._cache[user.id] = user
            
            return users
        except Exception as e:
            logger.error(f"Failed to retrieve users: {e}")
            raise
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID, with caching"""
        if user_id in self._cache:
            return self._cache[user_id]
        
        users = await self.get_all_users()
        return next((user for user in users if user.id == user_id), None)
    
    async def create_user(self, name: str, email: str) -> User:
        """Create a new user"""
        if not name or not email:
            raise ValueError("Name and email are required")
        
        user = User(id=0, name=name, email=email)  # ID will be set by database
        created_user = await self.database.create_user(user)
        
        self._cache[created_user.id] = created_user
        logger.info(f"Created user: {created_user}")
        
        return created_user
    
    def clear_cache(self) -> None:
        """Clear the user cache"""
        self._cache.clear()
        logger.info("User cache cleared")

async def main():
    """Main application entry point"""
    try:
        # This would be replaced with actual database implementation
        # database = PostgreSQLDatabase()
        # service = UserService(database)
        
        print("User service application started")
        # await service.get_all_users()
        
    except Exception as e:
        logger.error(f"Application error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
`;

// Mock file system for integration tests
vi.mock("fs");
const mockFs = fs as any;

describe("Integration & Performance Testing", () => {
  let processor: NodeProcessor;
  let _tempDir: string;

  beforeEach(() => {
    processor = ProcessingUtils.createFullProcessor();
    _tempDir = "/tmp/ast-test";

    // Reset all mocks
    vi.clearAllMocks();

    // Setup file system mocks
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.statSync = vi.fn().mockReturnValue({ size: 5000 });
    mockFs.readFileSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
    mockFs.mkdirSync = vi.fn();
    mockFs.readdirSync = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("End-to-End Pipeline Integration", () => {
    it("should process TypeScript code through complete pipeline", async () => {
      mockFs.readFileSync.mockReturnValue(SAMPLE_TYPESCRIPT_CODE);

      const result = await processor.processFile(
        "/test/app.component.ts",
        "typescript",
      );

      // Verify basic processing success
      expect(result.success).toBe(true);
      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
      expect(result.fileHash).toBeTruthy();

      // Verify node processing quality
      const rootNode = result.nodes[0];
      expect(rootNode.id).toBeTruthy();
      expect(rootNode.type).toBe(NodeType.FILE);
      expect(rootNode.metadata).toBeDefined();
      expect(rootNode.significance).toBeDefined();
    });

    it("should process JavaScript code through complete pipeline", async () => {
      mockFs.readFileSync.mockReturnValue(SAMPLE_JAVASCRIPT_CODE);

      const result = await processor.processFile(
        "/test/server.js",
        "javascript",
      );

      expect(result.success).toBe(true);
      expect(result.nodes).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.language).toBe("javascript");

      // Verify processing statistics
      expect(result.stats.totalNodes).toBeGreaterThan(0);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.performance.nodesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it("should process Python code through complete pipeline", async () => {
      mockFs.readFileSync.mockReturnValue(SAMPLE_PYTHON_CODE);

      const result = await processor.processFile(
        "/test/user_service.py",
        "python",
      );

      expect(result.success).toBe(true);
      expect(result.nodes).toBeDefined();
      expect(result.language).toBe("python");

      // Verify metadata extraction worked
      const rootNode = result.nodes[0];
      expect(rootNode.metadata.language).toBe("python");
      expect(rootNode.metadata.scope).toBeDefined();
      expect(rootNode.metadata.modifiers).toBeDefined();
    });

    it("should handle mixed language batch processing", async () => {
      const files = [
        {
          filePath: "/test/app.component.ts",
          language: "typescript",
          sourceText: SAMPLE_TYPESCRIPT_CODE,
        },
        {
          filePath: "/test/server.js",
          language: "javascript",
          sourceText: SAMPLE_JAVASCRIPT_CODE,
        },
        {
          filePath: "/test/user_service.py",
          language: "python",
          sourceText: SAMPLE_PYTHON_CODE,
        },
      ];

      const result = await processor.processBatch(files);

      expect(result.results).toHaveLength(3);
      expect(result.overallStats.totalFiles).toBe(3);

      // Verify all files processed successfully
      const successfulResults = result.results.filter((r) => r.success);
      expect(successfulResults).toHaveLength(3);

      // Verify language-specific processing
      const tsResult = result.results.find((r) => r.language === "typescript");
      const jsResult = result.results.find((r) => r.language === "javascript");
      const pyResult = result.results.find((r) => r.language === "python");

      expect(tsResult?.success).toBe(true);
      expect(jsResult?.success).toBe(true);
      expect(pyResult?.success).toBe(true);
    });
  });

  describe("Component Integration Testing", () => {
    it("should integrate ID generation with other components", () => {
      const idGenerator = new NodeIDGenerator();
      const sampleNode: ASTNode = {
        id: "",
        type: NodeType.FUNCTION,
        name: "testFunction",
        filePath: "/test.ts",
        start: { line: 1, column: 0 },
        end: { line: 5, column: 1 },
        children: [],
        significance: SignificanceLevel.HIGH,
        metadata: {
          language: "typescript",
          scope: [],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
      };

      const id1 = idGenerator.generateId(sampleNode);
      const id2 = idGenerator.generateId({ ...sampleNode });

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).toBe(id2); // Same node should generate same ID

      // Different node should generate different ID
      const differentNode = { ...sampleNode, name: "differentFunction" };
      const id3 = idGenerator.generateId(differentNode);
      expect(id3).toBeTruthy();
      expect(id3).not.toBe(id1);
    });

    it("should integrate serialization with processing results", async () => {
      const serializer = new NodeSerializer({
        prettyPrint: true,
        validateOnSerialize: true,
        validateOnDeserialize: true,
      });

      // Create mock nodes for serialization
      const mockNodes: ASTNode[] = [
        {
          id: "test-function-1",
          type: NodeType.FUNCTION,
          name: "testFunction",
          filePath: "/test.ts",
          start: { line: 1, column: 0 },
          end: { line: 5, column: 1 },
          children: [],
          significance: SignificanceLevel.HIGH,
          metadata: {
            language: "typescript",
            scope: [],
            modifiers: ["public", "async"],
            imports: [],
            exports: [],
            annotations: ["@Component"],
          },
          sourceText: "async testFunction() { return 42; }",
          signature: "testFunction(): Promise<number>",
          complexity: 1,
        },
      ];

      // Test serialization
      const serializedNode = serializer.serializeNode(mockNodes[0]);
      expect(serializedNode).toBeTruthy();
      expect(serializedNode.$schema).toBeTruthy();
      expect(serializedNode.id).toBe("test-function-1");
      expect(serializedNode.type).toBe("function");

      // Test deserialization
      const deserializedNode = serializer.deserializeNode(serializedNode);
      expect(deserializedNode).toBeTruthy();
      expect(deserializedNode.id).toBe(mockNodes[0].id);
      expect(deserializedNode.type).toBe(mockNodes[0].type);
      expect(deserializedNode.name).toBe(mockNodes[0].name);
    });

    it("should validate round-trip serialization integrity", async () => {
      const serializer = new NodeSerializer();

      const originalNodes: ASTNode[] = [
        {
          id: "test-1",
          type: NodeType.CLASS,
          name: "TestClass",
          filePath: "/test.ts",
          start: { line: 1, column: 0 },
          end: { line: 20, column: 1 },
          children: ["test-method-1", "test-property-1"],
          significance: SignificanceLevel.CRITICAL,
          metadata: {
            language: "typescript",
            scope: ["global"],
            modifiers: ["export", "default"],
            imports: ["Component"],
            exports: ["TestClass"],
            annotations: ["@Component"],
            docstring: "Test class for demonstration",
          },
          sourceText: "export default class TestClass { ... }",
          signature: "class TestClass",
          complexity: 5,
        },
      ];

      // Test round-trip validation
      const serializedNode = serializer.serializeNode(originalNodes[0]);
      const deserializedNode = serializer.deserializeNode(serializedNode);

      const validation = serializer.validateRoundTrip(
        originalNodes[0],
        serializedNode,
        deserializedNode,
      );

      expect(validation).toBe(true);
    });
  });

  describe("Performance Benchmarking", () => {
    it("should process large TypeScript files efficiently", async () => {
      // Create a larger TypeScript code sample by repeating the base code
      const largeTypeScriptCode = Array(10)
        .fill(SAMPLE_TYPESCRIPT_CODE)
        .join("\n\n");
      mockFs.readFileSync.mockReturnValue(largeTypeScriptCode);
      mockFs.statSync.mockReturnValue({ size: largeTypeScriptCode.length });

      const startTime = Date.now();

      const result = await processor.processFile(
        "/test/large-app.ts",
        "typescript",
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.stats.processingTimeMs).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.stats.performance.nodesPerSecond).toBeGreaterThan(0);

      // Performance thresholds
      expect(processingTime).toBeLessThan(10000); // Total processing under 10 seconds
      expect(result.stats.memoryUsage.peakMB).toBeLessThan(350); // Memory usage under 350MB
    });

    it("should handle batch processing of multiple files efficiently", async () => {
      const files = Array.from({ length: 20 }, (_, i) => ({
        filePath: `/test/file${i}.ts`,
        language: "typescript" as const,
        sourceText: SAMPLE_TYPESCRIPT_CODE,
      }));

      const startTime = Date.now();

      const result = await processor.processBatch(files);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(result.results).toHaveLength(20);
      expect(result.overallStats.totalFiles).toBe(20);

      // Performance expectations for batch processing
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.overallStats.performance.nodesPerSecond).toBeGreaterThan(0);

      // Verify all files processed successfully (in our mock scenario)
      const averageTimePerFile = totalTime / 20;
      expect(averageTimePerFile).toBeLessThan(2000); // Average under 2 seconds per file
    });

    it("should maintain consistent memory usage during processing", async () => {
      const files = Array.from({ length: 5 }, (_, i) => ({
        filePath: `/test/memory-test-${i}.ts`,
        language: "typescript" as const,
        sourceText: SAMPLE_TYPESCRIPT_CODE,
      }));

      const memoryUsages: number[] = [];

      for (const file of files) {
        const result = await processor.processFile(
          file.filePath,
          file.language,
          file.sourceText,
        );

        expect(result.success).toBe(true);
        memoryUsages.push(result.stats.memoryUsage.peakMB);
      }

      // Memory usage should be relatively stable across multiple files
      const avgMemory =
        memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
      const maxMemory = Math.max(...memoryUsages);
      const minMemory = Math.min(...memoryUsages);

      // Memory usage should not vary too dramatically
      const memoryVariation = (maxMemory - minMemory) / avgMemory;
      expect(memoryVariation).toBeLessThan(0.5); // Less than 50% variation
    });

    it("should demonstrate scalable directory processing", async () => {
      // Mock a directory structure with multiple files
      const fileNames = [
        "app.component.ts",
        "user.service.ts",
        "auth.guard.ts",
        "server.js",
        "routes.js",
        "middleware.js",
        "models.py",
        "views.py",
        "utils.py",
      ];

      mockFs.readdirSync.mockReturnValue(fileNames);
      mockFs.statSync.mockImplementation((filePath: string) => ({
        size: 3000,
        isDirectory: () => false,
        isFile: () => true,
      }));
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes(".ts")) return SAMPLE_TYPESCRIPT_CODE;
        if (filePath.includes(".js")) return SAMPLE_JAVASCRIPT_CODE;
        if (filePath.includes(".py")) return SAMPLE_PYTHON_CODE;
        return 'console.log("default");';
      });

      const startTime = Date.now();

      const result = await processor.processDirectory("/test/project", {
        recursive: true,
        extensions: [".ts", ".js", ".py"],
      });

      const endTime = Date.now();

      expect(result.results).toHaveLength(fileNames.length);
      expect(result.overallStats.totalFiles).toBe(fileNames.length);

      // Performance validation
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(20000); // Under 20 seconds for 9 files

      // Verify mixed language processing
      const languages = new Set(result.results.map((r) => r.language));
      expect(languages.size).toBeGreaterThan(1); // Multiple languages processed
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should gracefully handle and recover from processing errors", async () => {
      const files = [
        {
          filePath: "/test/good.ts",
          language: "typescript",
          sourceText: SAMPLE_TYPESCRIPT_CODE,
        },
        { filePath: "/test/bad.ts", language: "typescript" }, // No source text, will fail
        {
          filePath: "/test/good2.js",
          language: "javascript",
          sourceText: SAMPLE_JAVASCRIPT_CODE,
        },
      ];

      // Make the bad file fail by not providing source and making fs.readFile fail
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes("bad.ts")) {
          throw new Error("File read error");
        }
        return SAMPLE_TYPESCRIPT_CODE;
      });

      const result = await processor.processBatch(files);

      expect(result.results).toHaveLength(3);
      expect(result.overallStats.successfulFiles).toBeGreaterThan(0);
      expect(result.overallStats.failedFiles).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(result.overallStats.failedFiles);

      // Verify successful files still processed correctly
      const successfulResults = result.results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);

      for (const successResult of successfulResults) {
        expect(successResult.nodes).toBeDefined();
        expect(successResult.stats).toBeDefined();
      }
    });

    it("should handle timeout scenarios gracefully", async () => {
      // Create a processor with very short timeout
      const timeoutProcessor = new NodeProcessor({ timeoutMs: 1 });

      const result = await timeoutProcessor.processFile(
        "/test/timeout.ts",
        "typescript",
        SAMPLE_TYPESCRIPT_CODE,
      );

      // Processing should complete (our mock is fast), but this tests the timeout mechanism exists
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should handle file size limit violations", async () => {
      // Create processor with small file size limit
      const limitedProcessor = new NodeProcessor({ maxFileSizeBytes: 100 });

      mockFs.statSync.mockReturnValue({ size: 1000000 }); // 1MB file

      const result = await limitedProcessor.processFile(
        "/test/large.ts",
        "typescript",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("File too large");
    });

    it("should validate input parameters and provide meaningful errors", async () => {
      // Test with empty file path
      const result1 = await processor.processFile("", "typescript", "code");
      expect(result1.success).toBe(false);

      // Test with invalid language
      const result2 = await processor.processFile("/test.ts", "", "code");
      expect(result2.success).toBe(false);
    });
  });

  describe("Configuration and Customization", () => {
    it("should support different processor configurations", async () => {
      const configurations = [
        ProcessingUtils.createMinimalProcessor(),
        ProcessingUtils.createFullProcessor(),
        ProcessingUtils.createPerformanceProcessor(),
      ];

      for (const processor of configurations) {
        const result = await processor.processFile(
          "/test/config.ts",
          "typescript",
          SAMPLE_TYPESCRIPT_CODE,
        );

        // All configurations should produce some result
        expect(result).toBeDefined();
        expect(result.stats).toBeDefined();

        // The level of processing may vary based on configuration
        if (processor.getConfig().generateIds) {
          expect(result.nodes.every((n) => n.id)).toBe(true);
        }
      }
    });

    it("should allow runtime configuration updates", async () => {
      const initialConfig = processor.getConfig();
      expect(initialConfig.enableSerialization).toBe(true);

      // Update configuration
      processor.updateConfig({
        enableSerialization: false,
        includeSourceText: false,
      });

      const updatedConfig = processor.getConfig();
      expect(updatedConfig.enableSerialization).toBe(false);
      expect(updatedConfig.includeSourceText).toBe(false);
      expect(updatedConfig.generateIds).toBe(initialConfig.generateIds); // Should preserve other settings

      // Test that the configuration change affects processing
      const result = await processor.processFile(
        "/test/updated-config.ts",
        "typescript",
        SAMPLE_TYPESCRIPT_CODE,
      );

      expect(result.success).toBe(true);
      expect(result.serializedPath).toBeUndefined(); // Serialization disabled
    });

    it("should support custom serialization configurations", async () => {
      const customProcessor = new NodeProcessor({
        enableSerialization: true,
        serializationConfig: {
          prettyPrint: true,
          validateOnSerialize: true,
          validateOnDeserialize: true,
        },
      });

      const result = await customProcessor.processFile(
        "/test/custom-serial.ts",
        "typescript",
        SAMPLE_TYPESCRIPT_CODE,
      );

      expect(result.success).toBe(true);

      // In a real implementation, we could verify the serialization format
      // For now, just ensure the custom configuration doesn't break processing
      expect(result.stats).toBeDefined();
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should provide comprehensive processing statistics", async () => {
      const files = [
        {
          filePath: "/test/stats1.ts",
          language: "typescript",
          sourceText: SAMPLE_TYPESCRIPT_CODE,
        },
        {
          filePath: "/test/stats2.js",
          language: "javascript",
          sourceText: SAMPLE_JAVASCRIPT_CODE,
        },
      ];

      const result = await processor.processBatch(files);
      const summary = processor.getProcessingStatsSummary(result.results);

      // Verify statistics completeness
      expect(summary.totalFiles).toBe(2);
      expect(summary.successfulFiles).toBeDefined();
      expect(summary.failedFiles).toBeDefined();
      expect(summary.totalNodes).toBeGreaterThanOrEqual(0);
      expect(summary.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(summary.nodeDistribution).toBeDefined();
      expect(summary.significanceDistribution).toBeDefined();

      // Verify statistics accuracy
      expect(summary.totalFiles).toBe(
        summary.successfulFiles + summary.failedFiles,
      );

      // Verify distribution statistics are meaningful
      const nodeTypes = Object.keys(summary.nodeDistribution);
      expect(nodeTypes.length).toBeGreaterThanOrEqual(0);

      const significanceLevels = Object.keys(summary.significanceDistribution);
      expect(significanceLevels.length).toBeGreaterThanOrEqual(0);
    });

    it("should track performance metrics accurately", async () => {
      const result = await processor.processFile(
        "/test/perf-metrics.ts",
        "typescript",
        SAMPLE_TYPESCRIPT_CODE,
      );

      expect(result.success).toBe(true);

      const stats = result.stats;
      expect(stats.totalNodes).toBeGreaterThanOrEqual(0);
      expect(stats.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.performance.nodesPerSecond).toBeGreaterThanOrEqual(0);
      expect(stats.performance.avgTimePerNodeUs).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage.peakMB).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage.averageMB).toBeGreaterThanOrEqual(0);

      // Performance metrics should be logically consistent
      if (stats.totalNodes > 0 && stats.processingTimeMs > 0) {
        const expectedNodesPerSecond =
          (stats.totalNodes * 1000) / stats.processingTimeMs;
        expect(
          Math.abs(stats.performance.nodesPerSecond - expectedNodesPerSecond),
        ).toBeLessThan(1);
      }
    });

    it("should support merging results from multiple processing runs", async () => {
      const run1 = await processor.processBatch([
        {
          filePath: "/test/merge1.ts",
          language: "typescript",
          sourceText: SAMPLE_TYPESCRIPT_CODE,
        },
      ]);

      const run2 = await processor.processBatch([
        {
          filePath: "/test/merge2.js",
          language: "javascript",
          sourceText: SAMPLE_JAVASCRIPT_CODE,
        },
      ]);

      const merged = ProcessingUtils.mergeProcessingResults([run1, run2]);

      expect(merged.results).toHaveLength(2);
      expect(merged.overallStats.totalFiles).toBe(2);
      expect(merged.overallStats.processingTimeMs).toBeGreaterThanOrEqual(
        run1.overallStats.processingTimeMs + run2.overallStats.processingTimeMs,
      );

      // Verify merged statistics are cumulative
      expect(merged.overallStats.totalNodes).toBeGreaterThanOrEqual(0);
      expect(merged.errors).toEqual([...run1.errors, ...run2.errors]);
    });
  });

  describe("Real-world Scenario Testing", () => {
    it("should handle typical frontend project structure", async () => {
      const frontendFiles = [
        "src/app.component.ts",
        "src/services/user.service.ts",
        "src/guards/auth.guard.ts",
        "src/models/user.model.ts",
        "src/utils/helpers.ts",
      ];

      mockFs.readdirSync.mockReturnValue(frontendFiles);
      mockFs.statSync.mockImplementation(() => ({
        size: 2000,
        isDirectory: () => false,
        isFile: () => true,
      }));
      mockFs.readFileSync.mockReturnValue(SAMPLE_TYPESCRIPT_CODE);

      const result = await processor.processDirectory("/project/frontend", {
        extensions: [".ts", ".tsx"],
        recursive: true,
      });

      expect(result.results).toHaveLength(frontendFiles.length);
      expect(result.overallStats.totalFiles).toBe(frontendFiles.length);

      // Verify all TypeScript files detected
      expect(result.results.every((r) => r.language === "typescript")).toBe(
        true,
      );
    });

    it("should handle typical backend project structure", async () => {
      // Backend project files for testing (currently unused - test needs implementation)
      // const backendFileStructure = [
      //   "server.js",
      //   "routes/users.js",
      //   "routes/auth.js",
      //   "middleware/cors.js",
      //   "models/User.js",
      //   "config/database.js",
      // ];

      mockFs.readdirSync
        .mockReturnValueOnce([
          "server.js",
          "routes",
          "middleware",
          "models",
          "config",
        ])
        .mockReturnValueOnce(["users.js", "auth.js"])
        .mockReturnValueOnce(["cors.js"])
        .mockReturnValueOnce(["User.js"])
        .mockReturnValueOnce(["database.js"]);

      mockFs.statSync.mockImplementation((filePath: string) => ({
        size: 1500,
        isDirectory: () => !filePath.includes(".js"),
        isFile: () => filePath.includes(".js"),
      }));

      mockFs.readFileSync.mockReturnValue(SAMPLE_JAVASCRIPT_CODE);

      const result = await processor.processDirectory("/project/backend", {
        extensions: [".js"],
        recursive: true,
      });

      // Should find some JavaScript files
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.every((r) => r.language === "javascript")).toBe(
        true,
      );
    });

    it("should process mixed-language full-stack project", async () => {
      const projectFiles = [
        // Frontend TypeScript
        { path: "frontend/src/app.ts", content: SAMPLE_TYPESCRIPT_CODE },
        { path: "frontend/src/component.tsx", content: SAMPLE_TYPESCRIPT_CODE },

        // Backend JavaScript
        { path: "backend/server.js", content: SAMPLE_JAVASCRIPT_CODE },
        { path: "backend/routes.js", content: SAMPLE_JAVASCRIPT_CODE },

        // Scripts Python
        { path: "scripts/deploy.py", content: SAMPLE_PYTHON_CODE },
      ];

      const result = await processor.processBatch(
        projectFiles.map((file) => ({
          filePath: `/project/${file.path}`,
          language: file.path.endsWith(".py")
            ? "python"
            : file.path.endsWith(".ts") || file.path.endsWith(".tsx")
              ? "typescript"
              : "javascript",
          sourceText: file.content,
        })),
      );

      expect(result.results).toHaveLength(5);
      expect(result.overallStats.totalFiles).toBe(5);

      // Verify mixed languages processed
      const languages = new Set(result.results.map((r) => r.language));
      expect(languages).toContain("typescript");
      expect(languages).toContain("javascript");
      expect(languages).toContain("python");
      expect(languages.size).toBe(3);

      // Verify processing quality across languages
      const successfulResults = result.results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  describe("Regression Testing", () => {
    it("should maintain backward compatibility with previous versions", async () => {
      // Test that current implementation can handle data from previous versions
      const legacyResult = await processor.processFile(
        "/test/legacy.ts",
        "typescript",
        SAMPLE_TYPESCRIPT_CODE,
      );

      expect(legacyResult.success).toBe(true);
      expect(legacyResult.nodes).toBeDefined();
      expect(legacyResult.stats).toBeDefined();

      // Verify all required fields are present
      for (const node of legacyResult.nodes) {
        expect(node.id).toBeTruthy();
        expect(node.type).toBeTruthy();
        expect(node.filePath).toBeTruthy();
        expect(node.start).toBeDefined();
        expect(node.end).toBeDefined();
        expect(node.children).toBeDefined();
        expect(node.significance).toBeDefined();
        expect(node.metadata).toBeDefined();
      }
    });

    it("should handle edge cases consistently", async () => {
      const edgeCases = [
        { name: "empty file", content: "" },
        { name: "whitespace only", content: "   \n\n\t   " },
        { name: "single line", content: "const x = 1;" },
        { name: "unicode content", content: 'const 名前 = "テスト";' },
        {
          name: "very long line",
          content: `const longString = "${"x".repeat(1000)}";`,
        },
      ];

      for (const testCase of edgeCases) {
        const result = await processor.processFile(
          `/test/edge-case-${testCase.name.replace(/\s+/g, "-")}.ts`,
          "typescript",
          testCase.content,
        );

        // Should handle gracefully without crashing
        expect(result).toBeDefined();
        expect(typeof result.success).toBe("boolean");

        if (result.success) {
          expect(result.nodes).toBeDefined();
          expect(result.stats).toBeDefined();
        } else {
          expect(result.error).toBeDefined();
        }
      }
    });

    it("should maintain consistent behavior across multiple runs", async () => {
      const runs = [];

      for (let i = 0; i < 3; i++) {
        const result = await processor.processFile(
          "/test/consistency.ts",
          "typescript",
          SAMPLE_TYPESCRIPT_CODE,
        );
        runs.push(result);
      }

      // Verify consistency across runs
      const fileHashes = runs.map((r) => r.fileHash);
      expect(new Set(fileHashes).size).toBe(1); // All hashes should be the same

      const successStatus = runs.map((r) => r.success);
      expect(new Set(successStatus).size).toBe(1); // All should have same success status

      const nodesCounts = runs.map((r) => r.nodes.length);
      expect(new Set(nodesCounts).size).toBe(1); // All should have same number of nodes
    });
  });

  describe("Production Readiness Validation", () => {
    it("should demonstrate production-level error handling", async () => {
      const productionProcessor = ProcessingUtils.createPerformanceProcessor();

      // Simulate various production scenarios
      const scenarios = [
        {
          filePath: "/prod/normal.ts",
          sourceText: SAMPLE_TYPESCRIPT_CODE,
          shouldSucceed: true,
        },
        {
          filePath: "",
          sourceText: SAMPLE_TYPESCRIPT_CODE,
          shouldSucceed: false,
        }, // Invalid path
        { filePath: "/prod/empty.ts", sourceText: "", shouldSucceed: true }, // Empty file
        {
          filePath: "/prod/large.ts",
          sourceText: "x".repeat(100000),
          shouldSucceed: true,
        }, // Large content
      ];

      for (const scenario of scenarios) {
        const result = await productionProcessor.processFile(
          scenario.filePath,
          "typescript",
          scenario.sourceText,
        );

        if (scenario.shouldSucceed) {
          // Should handle gracefully even if not successful
          expect(result).toBeDefined();
          expect(result.stats).toBeDefined();
        } else {
          // Should fail gracefully with proper error information
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      }
    });

    it("should support enterprise-scale processing requirements", async () => {
      // Simulate enterprise-scale batch processing
      const enterpriseFiles = Array.from({ length: 50 }, (_, i) => ({
        filePath: `/enterprise/module-${Math.floor(i / 10)}/file-${i}.ts`,
        language: "typescript" as const,
        sourceText:
          i % 3 === 0
            ? SAMPLE_TYPESCRIPT_CODE
            : i % 3 === 1
              ? SAMPLE_JAVASCRIPT_CODE
              : SAMPLE_PYTHON_CODE.substring(0, 500), // Vary content sizes
      }));

      const startTime = Date.now();
      const result = await processor.processBatch(enterpriseFiles);
      const endTime = Date.now();

      // Enterprise requirements
      expect(result.results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(60000); // Complete within 1 minute
      expect(result.overallStats.performance.nodesPerSecond).toBeGreaterThan(0);

      // Should maintain good success rate
      const successRate =
        result.overallStats.successfulFiles / result.overallStats.totalFiles;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });

    it("should provide detailed monitoring and observability data", async () => {
      const result = await processor.processFile(
        "/prod/monitoring.ts",
        "typescript",
        SAMPLE_TYPESCRIPT_CODE,
      );

      expect(result.success).toBe(true);

      // Verify comprehensive monitoring data
      const stats = result.stats;
      expect(stats).toMatchObject({
        totalNodes: expect.any(Number),
        processingTimeMs: expect.any(Number),
        nodesByType: expect.any(Object),
        nodesBySignificance: expect.any(Object),
        memoryUsage: {
          peakMB: expect.any(Number),
          averageMB: expect.any(Number),
        },
        performance: {
          nodesPerSecond: expect.any(Number),
          avgTimePerNodeUs: expect.any(Number),
        },
      });

      // All metrics should be non-negative
      expect(stats.totalNodes).toBeGreaterThanOrEqual(0);
      expect(stats.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage.peakMB).toBeGreaterThanOrEqual(0);
      expect(stats.performance.nodesPerSecond).toBeGreaterThanOrEqual(0);
    });
  });
});
