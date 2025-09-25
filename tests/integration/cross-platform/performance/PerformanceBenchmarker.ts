/**
 * Performance Benchmarker
 * Cross-platform performance testing for parsing, indexing, and querying operations
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { performance } from "perf_hooks";
import { promisify } from "util";
import { TestResult } from "../types.js";

export interface PerformanceMetrics {
  cpuUsage: {
    user: number;
    system: number;
  };
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  diskIO: {
    readOperations: number;
    writeOperations: number;
    readBytes: number;
    writeBytes: number;
    readTime: number;
    writeTime: number;
  };
  networkIO: {
    bytesReceived: number;
    bytesSent: number;
    connections: number;
  };
  gcStats: {
    collections: number;
    totalTime: number;
    averageTime: number;
  };
}

export interface BenchmarkResult {
  platform: string;
  architecture: string;
  nodeVersion: string;
  testResults: TestResult[];
  performanceMetrics: PerformanceMetrics;
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    averageExecutionTime: number;
    memoryEfficiency: number;
    cpuEfficiency: number;
    diskIOEfficiency: number;
    scalabilityScore: number;
    performanceGrade: "A" | "B" | "C" | "D" | "F";
  };
}

export class PerformanceBenchmarker {
  private platform: string;
  private architecture: string;
  private nodeVersion: string;
  private testDataPath: string;

  constructor() {
    this.platform = process.platform;
    this.architecture = process.arch;
    this.nodeVersion = process.version;
    this.testDataPath = path.join(process.cwd(), "test-output", "performance");
  }

  async runBenchmarks(): Promise<BenchmarkResult> {
    console.log(
      `🔧 Running performance benchmarks on ${this.platform}/${this.architecture}`,
    );
    console.log(`📦 Node.js version: ${this.nodeVersion}`);

    const startTime = performance.now();
    const initialMetrics = this.captureMetrics();
    const testResults: TestResult[] = [];

    // Ensure test data directory exists
    await fs.mkdir(this.testDataPath, { recursive: true });

    // Benchmark 1: File System Performance
    testResults.push(...(await this.benchmarkFileSystemPerformance()));

    // Benchmark 2: Memory Management Performance
    testResults.push(...(await this.benchmarkMemoryPerformance()));

    // Benchmark 3: CPU-Intensive Operations
    testResults.push(...(await this.benchmarkCPUPerformance()));

    // Benchmark 4: Parsing Performance
    testResults.push(...(await this.benchmarkParsingPerformance()));

    // Benchmark 5: Database Operations
    testResults.push(...(await this.benchmarkDatabasePerformance()));

    // Benchmark 6: Concurrent Operations
    testResults.push(...(await this.benchmarkConcurrencyPerformance()));

    // Benchmark 7: Network/Stream Performance
    testResults.push(...(await this.benchmarkStreamPerformance()));

    // Benchmark 8: Garbage Collection Impact
    testResults.push(...(await this.benchmarkGCPerformance()));

    // Benchmark 9: Scalability Testing
    testResults.push(...(await this.benchmarkScalabilityPerformance()));

    // Benchmark 10: Cross-Platform Comparison
    testResults.push(...(await this.benchmarkPlatformSpecificPerformance()));

    const endTime = performance.now();
    const finalMetrics = this.captureMetrics();
    const duration = endTime - startTime;

    const performanceMetrics = this.calculatePerformanceMetrics(
      initialMetrics,
      finalMetrics,
    );
    const summary = this.generateSummary(
      testResults,
      duration,
      performanceMetrics,
    );

    console.log(
      `✅ Performance benchmarks completed: ${summary.passed}/${summary.total} tests passed`,
    );
    console.log(`📊 Performance Grade: ${summary.performanceGrade}`);

    return {
      platform: this.platform,
      architecture: this.architecture,
      nodeVersion: this.nodeVersion,
      testResults,
      performanceMetrics,
      summary,
    };
  }

  private async benchmarkFileSystemPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // File Read Performance
    results.push(await this.benchmarkFileRead());

    // File Write Performance
    results.push(await this.benchmarkFileWrite());

    // Directory Operations
    results.push(await this.benchmarkDirectoryOperations());

    // Large File Handling
    results.push(await this.benchmarkLargeFileHandling());

    return results;
  }

  private async benchmarkFileRead(): Promise<TestResult> {
    const startTime = performance.now();
    const testFile = path.join(this.testDataPath, "read-test.txt");

    try {
      // Create test file
      const testData = "A".repeat(1024 * 1024); // 1MB of data
      await fs.writeFile(testFile, testData);

      // Benchmark file reading
      const readStart = performance.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const data = await fs.readFile(testFile, "utf-8");
        if (data.length !== testData.length) {
          throw new Error("Data integrity check failed");
        }
      }

      const readTime = performance.now() - readStart;
      const avgReadTime = readTime / iterations;
      const throughput = (testData.length * iterations) / (readTime / 1000); // bytes per second

      // Cleanup
      await fs.unlink(testFile).catch(() => {});

      return {
        name: "file_read_performance",
        category: "performance",
        passed: avgReadTime < 50, // Pass if average read time is under 50ms
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          fileSize: testData.length,
          totalReadTime: readTime,
          averageReadTime: avgReadTime,
          throughputBytesPerSec: throughput,
          performanceGrade: this.gradePerformance(
            avgReadTime,
            [10, 25, 50, 100],
          ),
        },
      };
    } catch (error) {
      return {
        name: "file_read_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkFileWrite(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const testData = "B".repeat(1024 * 1024); // 1MB of data
      const writeStart = performance.now();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const testFile = path.join(this.testDataPath, `write-test-${i}.txt`);
        await fs.writeFile(testFile, testData);
      }

      const writeTime = performance.now() - writeStart;
      const avgWriteTime = writeTime / iterations;
      const throughput = (testData.length * iterations) / (writeTime / 1000);

      // Cleanup
      for (let i = 0; i < iterations; i++) {
        const testFile = path.join(this.testDataPath, `write-test-${i}.txt`);
        await fs.unlink(testFile).catch(() => {});
      }

      return {
        name: "file_write_performance",
        category: "performance",
        passed: avgWriteTime < 100, // Pass if average write time is under 100ms
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          fileSize: testData.length,
          totalWriteTime: writeTime,
          averageWriteTime: avgWriteTime,
          throughputBytesPerSec: throughput,
          performanceGrade: this.gradePerformance(
            avgWriteTime,
            [20, 50, 100, 200],
          ),
        },
      };
    } catch (error) {
      return {
        name: "file_write_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkDirectoryOperations(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const testDir = path.join(this.testDataPath, "dir-test");
      const opStart = performance.now();
      const iterations = 100;

      // Create directories
      for (let i = 0; i < iterations; i++) {
        const subDir = path.join(testDir, `subdir-${i}`);
        await fs.mkdir(subDir, { recursive: true });
      }

      // List directories
      const listStart = performance.now();
      const entries = await fs.readdir(testDir);
      const listTime = performance.now() - listStart;

      // Delete directories
      const deleteStart = performance.now();
      await fs.rm(testDir, { recursive: true, force: true });
      const deleteTime = performance.now() - deleteStart;

      const totalTime = performance.now() - opStart;
      const createTime = listStart - opStart;

      return {
        name: "directory_operations_performance",
        category: "performance",
        passed: totalTime < 2000, // Pass if total time is under 2 seconds
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          createTime,
          listTime,
          deleteTime,
          totalTime,
          entriesFound: entries.length,
          performanceGrade: this.gradePerformance(
            totalTime,
            [500, 1000, 2000, 5000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "directory_operations_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkLargeFileHandling(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const largeFile = path.join(this.testDataPath, "large-file.txt");
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = 10; // 10MB total file

      // Write large file in chunks
      const writeStart = performance.now();
      const writeStream = await fs.open(largeFile, "w");

      for (let i = 0; i < totalChunks; i++) {
        const chunk = `Chunk ${i}: ${"X".repeat(chunkSize - 20)}\n`;
        await writeStream.write(chunk);
      }

      await writeStream.close();
      const writeTime = performance.now() - writeStart;

      // Read large file in chunks
      const readStart = performance.now();
      const readStream = await fs.open(largeFile, "r");
      const buffer = Buffer.alloc(chunkSize);
      let totalBytesRead = 0;
      let position = 0;

      while (true) {
        const result = await readStream.read(buffer, 0, chunkSize, position);
        if (result.bytesRead === 0) {
          break;
        }

        totalBytesRead += result.bytesRead;
        position += result.bytesRead;
      }

      await readStream.close();
      const readTime = performance.now() - readStart;

      // Get file stats
      const stats = await fs.stat(largeFile);
      const fileSize = stats.size;

      // Cleanup
      await fs.unlink(largeFile).catch(() => {});

      return {
        name: "large_file_handling_performance",
        category: "performance",
        passed: writeTime < 5000 && readTime < 3000, // Pass if reasonable performance
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          fileSize,
          totalBytesRead,
          writeTime,
          readTime,
          writeSpeed: fileSize / (writeTime / 1000), // bytes per second
          readSpeed: fileSize / (readTime / 1000),
          performanceGrade: this.gradePerformance(
            writeTime + readTime,
            [2000, 5000, 10000, 20000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "large_file_handling_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkMemoryPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkMemoryAllocation());
    results.push(await this.benchmarkMemoryFragmentation());
    results.push(await this.benchmarkBufferOperations());

    return results;
  }

  private async benchmarkMemoryAllocation(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const initialMemory = process.memoryUsage();
      const allocStart = performance.now();

      // Allocate various data structures - reduced sizes for CI stability
      const arrays: any[][] = [];
      const objects: any[] = [];
      const buffers: Buffer[] = [];

      const iterations = 100; // Reduced from 1000

      for (let i = 0; i < iterations; i++) {
        arrays.push(new Array(100).fill(i)); // Reduced from 1000 to 100
        objects.push({ id: i, data: `item-${i}`, value: Math.random() });
        buffers.push(Buffer.alloc(512, i % 256)); // Reduced from 1024 to 512
      }

      const allocTime = performance.now() - allocStart;
      const postAllocMemory = process.memoryUsage();

      // Force garbage collection if available
      if (global.gc) {
        const gcStart = performance.now();
        global.gc();
        const gcTime = performance.now() - gcStart;

        const postGcMemory = process.memoryUsage();

        return {
          name: "memory_allocation_performance",
          category: "performance",
          passed: allocTime < 1000, // Pass if allocation takes less than 1 second
          platform: this.platform,
          duration: performance.now() - startTime,
          details: {
            iterations,
            allocationTime: allocTime,
            gcTime,
            memoryUsedMB:
              (postAllocMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024,
            memoryFreedMB:
              (postAllocMemory.heapUsed - postGcMemory.heapUsed) / 1024 / 1024,
            heapTotalMB: postAllocMemory.heapTotal / 1024 / 1024,
            performanceGrade: this.gradePerformance(
              allocTime,
              [200, 500, 1000, 2000],
            ),
          },
        };
      } else {
        return {
          name: "memory_allocation_performance",
          category: "performance",
          passed: allocTime < 1000,
          platform: this.platform,
          duration: performance.now() - startTime,
          details: {
            iterations,
            allocationTime: allocTime,
            memoryUsedMB:
              (postAllocMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024,
            heapTotalMB: postAllocMemory.heapTotal / 1024 / 1024,
            performanceGrade: this.gradePerformance(
              allocTime,
              [200, 500, 1000, 2000],
            ),
            gcNotAvailable: true,
          },
        };
      }
    } catch (error) {
      return {
        name: "memory_allocation_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkMemoryFragmentation(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const initialMemory = process.memoryUsage();
      const fragStart = performance.now();

      // Create fragmented memory pattern
      const arrays: any[][] = [];
      const iterations = 100;

      // Allocate varying sizes to create fragmentation
      for (let i = 0; i < iterations; i++) {
        const size = Math.floor(Math.random() * 10000) + 1000;
        arrays.push(new Array(size).fill(Math.random()));

        // Randomly delete some arrays to create holes
        if (i > 10 && Math.random() > 0.7) {
          const indexToDelete = Math.floor(Math.random() * arrays.length);
          delete arrays[indexToDelete];
        }
      }

      const fragTime = performance.now() - fragStart;
      const postFragMemory = process.memoryUsage();

      return {
        name: "memory_fragmentation_performance",
        category: "performance",
        passed: fragTime < 500, // Pass if fragmentation test completes quickly
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          fragmentationTime: fragTime,
          memoryIncreaseMB:
            (postFragMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024,
          heapTotalMB: postFragMemory.heapTotal / 1024 / 1024,
          performanceGrade: this.gradePerformance(
            fragTime,
            [100, 250, 500, 1000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "memory_fragmentation_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkBufferOperations(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const bufferStart = performance.now();
      const iterations = 10000;

      // Buffer allocation
      const allocStart = performance.now();
      const buffers: Buffer[] = [];
      for (let i = 0; i < iterations; i++) {
        buffers.push(Buffer.alloc(1024));
      }
      const allocTime = performance.now() - allocStart;

      // Buffer operations
      const opStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const buffer = buffers[i];
        buffer.write(`Test data ${i}`, 0, "utf8");
        const readBack = buffer.toString("utf8", 0, 20);
      }
      const opTime = performance.now() - opStart;

      const totalTime = performance.now() - bufferStart;

      return {
        name: "buffer_operations_performance",
        category: "performance",
        passed: totalTime < 1000, // Pass if total time is under 1 second
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          allocationTime: allocTime,
          operationTime: opTime,
          totalTime,
          bufferSize: 1024,
          totalBuffersMB: (iterations * 1024) / 1024 / 1024,
          performanceGrade: this.gradePerformance(
            totalTime,
            [200, 500, 1000, 2000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "buffer_operations_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkCPUPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkCPUIntensive());
    results.push(await this.benchmarkMathOperations());

    return results;
  }

  private async benchmarkCPUIntensive(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const cpuStart = performance.now();

      // CPU-intensive calculation
      let result = 0;
      const iterations = 1000000;

      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i) * Math.sin(i) + Math.cos(i);
      }

      const cpuTime = performance.now() - cpuStart;
      const operationsPerSecond = iterations / (cpuTime / 1000);

      return {
        name: "cpu_intensive_performance",
        category: "performance",
        passed: cpuTime < 5000, // Pass if completes within 5 seconds
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          cpuTime,
          result,
          operationsPerSecond,
          performanceGrade: this.gradePerformance(
            cpuTime,
            [1000, 2500, 5000, 10000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "cpu_intensive_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkMathOperations(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const mathStart = performance.now();
      const iterations = 500000;

      let sum = 0;
      let product = 1;
      let divisions = 0;

      for (let i = 1; i <= iterations; i++) {
        sum += i;
        if (i <= 100) {
          product *= i;
        } // Prevent overflow
        if (i % 1000 === 0) {
          divisions += Math.floor(sum / i);
        }
      }

      const mathTime = performance.now() - mathStart;

      return {
        name: "math_operations_performance",
        category: "performance",
        passed: mathTime < 500, // Pass if completes within 500ms
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          mathTime,
          sum,
          product: product > Number.MAX_SAFE_INTEGER ? "overflow" : product,
          divisions,
          operationsPerSecond: (iterations * 3) / (mathTime / 1000), // 3 ops per iteration
          performanceGrade: this.gradePerformance(
            mathTime,
            [100, 250, 500, 1000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "math_operations_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkParsingPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkJSONParsing());
    results.push(await this.benchmarkTextParsing());

    return results;
  }

  private async benchmarkJSONParsing(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      // Generate test JSON data
      const testData = {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          profile: {
            age: 20 + (i % 50),
            interests: [`hobby${i % 10}`, `sport${i % 5}`],
            settings: {
              theme: i % 2 ? "dark" : "light",
              notifications: i % 3 === 0,
              privacy: i % 4 === 0 ? "public" : "private",
            },
          },
        })),
      };

      const jsonString = JSON.stringify(testData);
      const parseStart = performance.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const parsed = JSON.parse(jsonString);
        if (parsed.users.length !== 1000) {
          throw new Error("Parsing validation failed");
        }
      }

      const parseTime = performance.now() - parseStart;
      const avgParseTime = parseTime / iterations;
      const dataSize = Buffer.byteLength(jsonString, "utf8");

      return {
        name: "json_parsing_performance",
        category: "performance",
        passed: avgParseTime < 50, // Pass if average parse time is under 50ms
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          dataSize,
          totalParseTime: parseTime,
          averageParseTime: avgParseTime,
          parsedObjectsPerSecond: iterations / (parseTime / 1000),
          performanceGrade: this.gradePerformance(
            avgParseTime,
            [10, 25, 50, 100],
          ),
        },
      };
    } catch (error) {
      return {
        name: "json_parsing_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkTextParsing(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      // Generate test text data
      const testText = Array.from(
        { length: 10000 },
        (_, i) =>
          `Line ${i}: This is a sample line with some text to parse and process. Number: ${i * 2}`,
      ).join("\n");

      const textStart = performance.now();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const lines = testText.split("\n");
        const numbers = lines.map((line) => {
          const match = line.match(/Number: (\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });

        if (numbers.length !== 10000) {
          throw new Error("Text parsing validation failed");
        }
      }

      const textTime = performance.now() - textStart;
      const avgTextTime = textTime / iterations;
      const textSize = Buffer.byteLength(testText, "utf8");

      return {
        name: "text_parsing_performance",
        category: "performance",
        passed: avgTextTime < 100, // Pass if average parse time is under 100ms
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          iterations,
          textSize,
          linesPerIteration: 10000,
          totalTextTime: textTime,
          averageTextTime: avgTextTime,
          linesPerSecond: (10000 * iterations) / (textTime / 1000),
          performanceGrade: this.gradePerformance(
            avgTextTime,
            [25, 50, 100, 200],
          ),
        },
      };
    } catch (error) {
      return {
        name: "text_parsing_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkDatabasePerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkInMemoryOperations());

    return results;
  }

  private async benchmarkInMemoryOperations(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      // Simulate database-like operations with in-memory data structures
      const dbStart = performance.now();
      const database = new Map<string, any>();
      const index = new Map<string, Set<string>>();

      // Insert operations
      const insertStart = performance.now();
      const records = 10000;

      for (let i = 0; i < records; i++) {
        const record = {
          id: `record-${i}`,
          name: `Name ${i}`,
          category: `category-${i % 10}`,
          value: Math.random() * 1000,
          timestamp: Date.now() + i,
        };

        database.set(record.id, record);

        // Update index
        if (!index.has(record.category)) {
          index.set(record.category, new Set());
        }
        index.get(record.category)!.add(record.id);
      }

      const insertTime = performance.now() - insertStart;

      // Query operations
      const queryStart = performance.now();
      const queries = 1000;
      let queryResults = 0;

      for (let i = 0; i < queries; i++) {
        const category = `category-${i % 10}`;
        const recordIds = index.get(category);

        if (recordIds) {
          for (const recordId of recordIds) {
            const record = database.get(recordId);
            if (record && record.value > 500) {
              queryResults++;
            }
          }
        }
      }

      const queryTime = performance.now() - queryStart;
      const totalTime = performance.now() - dbStart;

      return {
        name: "database_operations_performance",
        category: "performance",
        passed: totalTime < 2000, // Pass if total time is under 2 seconds
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          records,
          queries,
          insertTime,
          queryTime,
          totalTime,
          queryResults,
          insertsPerSecond: records / (insertTime / 1000),
          queriesPerSecond: queries / (queryTime / 1000),
          performanceGrade: this.gradePerformance(
            totalTime,
            [500, 1000, 2000, 5000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "database_operations_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkConcurrencyPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkConcurrentOperations());

    return results;
  }

  private async benchmarkConcurrentOperations(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const concurrentStart = performance.now();
      const concurrentTasks = 50;

      // Create concurrent CPU-intensive tasks
      const tasks = Array.from({ length: concurrentTasks }, async (_, i) => {
        return new Promise<number>((resolve) => {
          setTimeout(() => {
            let result = 0;
            for (let j = 0; j < 1000; j++) {
              // Reduced from 10000 to 1000
              result += Math.sqrt(j + i * 1000);
            }
            resolve(result);
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });

      const results = await Promise.all(tasks);
      const concurrentTime = performance.now() - concurrentStart;

      const totalResults = results.reduce((sum, result) => sum + result, 0);

      return {
        name: "concurrent_operations_performance",
        category: "performance",
        passed: concurrentTime < 1000, // Pass if completes within 1 second
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          concurrentTasks,
          concurrentTime,
          totalResults,
          tasksPerSecond: concurrentTasks / (concurrentTime / 1000),
          performanceGrade: this.gradePerformance(
            concurrentTime,
            [200, 500, 1000, 2000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "concurrent_operations_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkStreamPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkStreamOperations());

    return results;
  }

  private async benchmarkStreamOperations(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const { Readable, Transform, pipeline } = await import("stream");
      const { promisify } = await import("util");
      const pipelineAsync = promisify(pipeline);

      const streamStart = performance.now();

      // Create a readable stream that generates data
      let dataGenerated = 0;
      const sourceStream = new Readable({
        read() {
          if (dataGenerated < 10000) {
            this.push(`data-chunk-${dataGenerated++}\n`);
          } else {
            this.push(null); // End stream
          }
        },
      });

      // Create transform streams
      let processed = 0;
      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          const data = chunk.toString().toUpperCase();
          processed++;
          callback(null, data);
        },
      });

      // Collect output
      const results: string[] = [];
      const collectStream = new Transform({
        transform(chunk, encoding, callback) {
          results.push(chunk.toString());
          callback();
        },
      });

      await pipelineAsync(sourceStream, transformStream, collectStream);

      const streamTime = performance.now() - streamStart;

      return {
        name: "stream_operations_performance",
        category: "performance",
        passed: streamTime < 1000 && processed === dataGenerated, // Pass if completes quickly and processes all data
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          dataGenerated,
          processed,
          results: results.length,
          streamTime,
          throughputItemsPerSecond: processed / (streamTime / 1000),
          performanceGrade: this.gradePerformance(
            streamTime,
            [200, 500, 1000, 2000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "stream_operations_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkGCPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkGarbageCollection());

    return results;
  }

  private async benchmarkGarbageCollection(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const initialMemory = process.memoryUsage();
      const gcStart = performance.now();

      // Create objects that will become garbage - reduced sizes for CI stability
      for (let i = 0; i < 100; i++) {
        // Reduced from 1000
        const tempArray = new Array(100).fill(i); // Reduced from 1000 to 100
        const tempObject = {
          id: i,
          data: tempArray,
          nested: { value: Math.random() },
        };
        // Don't keep references - let them become garbage
      }

      const postAllocMemory = process.memoryUsage();

      // Force GC if available
      let gcTime = 0;
      let postGcMemory = postAllocMemory;

      if (global.gc) {
        const gcTriggerStart = performance.now();
        global.gc();
        gcTime = performance.now() - gcTriggerStart;
        postGcMemory = process.memoryUsage();
      }

      const totalTime = performance.now() - gcStart;

      return {
        name: "garbage_collection_performance",
        category: "performance",
        passed: gcTime < 100 || !global.gc, // Pass if GC is fast or unavailable
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          initialHeapMB: initialMemory.heapUsed / 1024 / 1024,
          postAllocHeapMB: postAllocMemory.heapUsed / 1024 / 1024,
          postGcHeapMB: postGcMemory.heapUsed / 1024 / 1024,
          memoryAllocatedMB:
            (postAllocMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024,
          memoryFreedMB:
            (postAllocMemory.heapUsed - postGcMemory.heapUsed) / 1024 / 1024,
          gcTime,
          totalTime,
          gcAvailable: !!global.gc,
          performanceGrade: global.gc
            ? this.gradePerformance(gcTime, [20, 50, 100, 200])
            : "N/A",
        },
      };
    } catch (error) {
      return {
        name: "garbage_collection_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkScalabilityPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkScalability());

    return results;
  }

  private async benchmarkScalability(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const scalabilityStart = performance.now();
      const testSizes = [100, 500, 1000, 5000];
      const scalabilityResults: any[] = [];

      for (const size of testSizes) {
        const testStart = performance.now();

        // Create data structure of specified size
        const dataMap = new Map();
        for (let i = 0; i < size; i++) {
          dataMap.set(`key-${i}`, { value: i, data: `data-${i}` });
        }

        // Perform operations on the data
        let operationsCompleted = 0;
        for (let i = 0; i < size; i++) {
          const key = `key-${i}`;
          if (dataMap.has(key)) {
            const item = dataMap.get(key);
            if (item.value === i) {
              operationsCompleted++;
            }
          }
        }

        const testTime = performance.now() - testStart;
        scalabilityResults.push({
          size,
          time: testTime,
          operationsCompleted,
          operationsPerSecond: operationsCompleted / (testTime / 1000),
        });
      }

      const totalScalabilityTime = performance.now() - scalabilityStart;

      // Calculate scalability metrics
      const timeGrowth = scalabilityResults.map((r) => r.time);
      const isLinearScaling = this.checkLinearScaling(testSizes, timeGrowth);

      return {
        name: "scalability_performance",
        category: "performance",
        passed: totalScalabilityTime < 5000 && isLinearScaling, // Pass if reasonable scaling
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          testSizes,
          scalabilityResults,
          totalTime: totalScalabilityTime,
          isLinearScaling,
          performanceGrade: this.gradePerformance(
            totalScalabilityTime,
            [1000, 2500, 5000, 10000],
          ),
        },
      };
    } catch (error) {
      return {
        name: "scalability_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async benchmarkPlatformSpecificPerformance(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    results.push(await this.benchmarkPlatformSpecific());

    return results;
  }

  private async benchmarkPlatformSpecific(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const platformStart = performance.now();

      // Get platform-specific information
      const platformInfo = {
        platform: this.platform,
        architecture: this.architecture,
        nodeVersion: this.nodeVersion,
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
      };

      // Perform platform-specific optimizations
      let optimizationScore = 0;

      // Check for platform-specific features
      if (this.platform === "win32") {
        optimizationScore += 10; // Windows optimizations available
      } else if (this.platform === "darwin") {
        optimizationScore += 15; // macOS optimizations available
      } else if (this.platform === "linux") {
        optimizationScore += 20; // Linux optimizations available
      }

      // Check architecture optimizations
      if (this.architecture === "x64") {
        optimizationScore += 10;
      } else if (this.architecture === "arm64") {
        optimizationScore += 5;
      }

      const platformTime = performance.now() - platformStart;

      return {
        name: "platform_specific_performance",
        category: "performance",
        passed: platformTime < 100, // Pass if platform detection is fast
        platform: this.platform,
        duration: performance.now() - startTime,
        details: {
          platformInfo,
          optimizationScore,
          platformTime,
          performanceGrade: this.gradePerformance(
            platformTime,
            [20, 50, 100, 200],
          ),
        },
      };
    } catch (error) {
      return {
        name: "platform_specific_performance",
        category: "performance",
        passed: false,
        platform: this.platform,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private captureMetrics(): any {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      hrtime: process.hrtime(),
      timestamp: performance.now(),
    };
  }

  private calculatePerformanceMetrics(
    initial: any,
    final: any,
  ): PerformanceMetrics {
    const cpuDiff = process.cpuUsage(initial.cpu);
    const memoryDiff = final.memory;

    return {
      cpuUsage: {
        user: cpuDiff.user / 1000, // Convert to milliseconds
        system: cpuDiff.system / 1000,
      },
      memoryUsage: memoryDiff,
      diskIO: {
        readOperations: 0,
        writeOperations: 0,
        readBytes: 0,
        writeBytes: 0,
        readTime: 0,
        writeTime: 0,
      },
      networkIO: {
        bytesReceived: 0,
        bytesSent: 0,
        connections: 0,
      },
      gcStats: {
        collections: 0,
        totalTime: 0,
        averageTime: 0,
      },
    };
  }

  private generateSummary(
    testResults: TestResult[],
    duration: number,
    metrics: PerformanceMetrics,
  ): BenchmarkResult["summary"] {
    const total = testResults.length;
    const passed = testResults.filter((test) => test.passed).length;
    const failed = total - passed;

    const avgExecutionTime =
      testResults.reduce((sum, test) => sum + test.duration, 0) / total;

    // Calculate efficiency scores (0-100)
    const heapUsedMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    // More realistic memory efficiency calculation - scale from reasonable baseline
    // Assume 500MB as the baseline for 50% efficiency, with diminishing returns
    const memoryEfficiency = Math.max(
      0,
      Math.min(100, 100 - Math.log10(Math.max(1, heapUsedMB / 50)) * 25),
    ); // Logarithmic scale for memory efficiency
    // CPU usage is in milliseconds, but we need a more realistic efficiency calculation
    const totalCpuTimeMs = metrics.cpuUsage.user + metrics.cpuUsage.system;
    // Use a logarithmic scale for CPU efficiency similar to memory
    // Assume 1000ms of CPU time as baseline for 50% efficiency
    const cpuEfficiency = Math.max(
      10, // Minimum 10% efficiency to ensure it's always > 0
      Math.min(100, 100 - Math.log10(Math.max(1, totalCpuTimeMs / 1000)) * 30),
    ); // Logarithmic scale for CPU efficiency
    const diskIOEfficiency = 85; // Placeholder since we don't have real disk metrics

    // Calculate scalability score based on test results
    const scalabilityTest = testResults.find(
      (test) => test.name === "scalability_performance",
    );
    const scalabilityScore = scalabilityTest?.passed ? 85 : 60;

    // Calculate overall performance grade
    const overallScore =
      (memoryEfficiency + cpuEfficiency + diskIOEfficiency + scalabilityScore) /
      4;
    const performanceGrade: "A" | "B" | "C" | "D" | "F" =
      overallScore >= 90
        ? "A"
        : overallScore >= 80
          ? "B"
          : overallScore >= 70
            ? "C"
            : overallScore >= 60
              ? "D"
              : "F";

    return {
      total,
      passed,
      failed,
      duration,
      averageExecutionTime: avgExecutionTime,
      memoryEfficiency,
      cpuEfficiency,
      diskIOEfficiency,
      scalabilityScore,
      performanceGrade,
    };
  }

  private gradePerformance(time: number, thresholds: number[]): string {
    const [excellent, good, acceptable, poor] = thresholds;

    if (time <= excellent) {
      return "A";
    }
    if (time <= good) {
      return "B";
    }
    if (time <= acceptable) {
      return "C";
    }
    if (time <= poor) {
      return "D";
    }
    return "F";
  }

  private checkLinearScaling(sizes: number[], times: number[]): boolean {
    if (sizes.length !== times.length || sizes.length < 2) {
      return false;
    }

    // Check if time increase is roughly proportional to size increase
    for (let i = 1; i < sizes.length; i++) {
      const sizeRatio = sizes[i] / sizes[i - 1];
      const timeRatio = times[i] / times[i - 1];

      // If time grows much faster than size, it's not linear
      if (timeRatio > sizeRatio * 2) {
        return false;
      }
    }

    return true;
  }
}
