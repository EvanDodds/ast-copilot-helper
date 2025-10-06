/**
 * Core performance optimization utilities for AST parsing
 * Provides essential caching and memory management capabilities
 */

import { EventEmitter } from "events";
import type { ParseResult, ASTParser } from "./types.js";
import { createHash } from "crypto";

/**
 * Performance metrics tracking
 */
export interface PerformanceMetrics {
  parseTime: number;
  nodeCount: number;
  errorCount: number;
  cacheHit: boolean;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  parserInstanceReused: boolean;
}

/**
 * Simple cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  lastAccessed: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxASTEntries?: number;
  maxParserInstances?: number;
  astTTL?: number; // milliseconds
  parserTTL?: number; // milliseconds
  memoryThreshold?: number; // bytes
}

/**
 * Parser pool configuration
 */
export interface ParserPoolConfig {
  maxInstances?: number;
  idleTimeout?: number; // milliseconds
  warmupLanguages?: string[];
}

/**
 * Cache key generation utility
 */
function generateCacheKey(
  code: string,
  language: string,
  filePath?: string,
): string {
  const hash = createHash("sha256");
  hash.update(code);
  hash.update(language);
  if (filePath) {
    hash.update(filePath);
  }
  return hash.digest("hex");
}

/**
 * Memory usage estimation
 */
function estimateMemoryUsage(code: string, language: string): number {
  // Rough estimation based on code size and language complexity
  const baseSize = Buffer.byteLength(code, "utf8");
  const languageMultiplier = ["typescript", "javascript"].includes(language)
    ? 3
    : 2;
  return baseSize * languageMultiplier;
}

/**
 * Performance monitoring class
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private memoryMonitorInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.startMemoryMonitoring();
  }

  recordParseMetrics(language: string, metrics: PerformanceMetrics): void {
    if (!this.metrics.has(language)) {
      this.metrics.set(language, []);
    }

    const languageMetrics = this.metrics.get(language);
    if (!languageMetrics) {
      return;
    }
    languageMetrics.push(metrics);

    // Keep only last 100 metrics per language
    if (languageMetrics.length > 100) {
      languageMetrics.shift();
    }

    this.emit("metricsRecorded", { language, metrics });
  }

  getAverageMetrics(language: string): Partial<PerformanceMetrics> | null {
    const languageMetrics = this.metrics.get(language);
    if (!languageMetrics || languageMetrics.length === 0) {
      return null;
    }

    const sum = languageMetrics.reduce(
      (acc, m) => ({
        parseTime: acc.parseTime + m.parseTime,
        nodeCount: acc.nodeCount + m.nodeCount,
        errorCount: acc.errorCount + m.errorCount,
      }),
      { parseTime: 0, nodeCount: 0, errorCount: 0 },
    );

    const length = languageMetrics.length;
    const cacheHitRate =
      languageMetrics.filter((m) => m.cacheHit).length / length;
    const reuseRate =
      languageMetrics.filter((m) => m.parserInstanceReused).length / length;

    return {
      parseTime: sum.parseTime / length,
      nodeCount: sum.nodeCount / length,
      errorCount: sum.errorCount / length,
      cacheHit: cacheHitRate > 0.5, // Majority cache hits
      parserInstanceReused: reuseRate > 0.5, // Majority reuse
    };
  }

  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.emit("memoryUpdate", memoryUsage);
    }, 5000); // Every 5 seconds
  }

  dispose(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
  }
}

/**
 * Parser instance pool for reusing parsers across parse operations
 */
export class ParserPool {
  private pools: Map<string, ASTParser[]> = new Map();
  private busyParsers: Set<ASTParser> = new Set();
  private lastUsed: Map<ASTParser, number> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private config: Required<ParserPoolConfig>;

  constructor(config: ParserPoolConfig = {}) {
    this.config = {
      maxInstances: config.maxInstances ?? 4,
      idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
      warmupLanguages: config.warmupLanguages ?? [
        "typescript",
        "javascript",
        "python",
      ],
    };

    this.startCleanupTimer();
  }

  async acquireParser(
    language: string,
    factory: () => Promise<ASTParser>,
  ): Promise<ASTParser> {
    const pool = this.pools.get(language) ?? [];

    // Try to get an available parser
    let parser = pool.find((p) => !this.busyParsers.has(p));

    if (!parser) {
      // Create new parser if under limit
      const totalInUse = pool.length;
      if (totalInUse < this.config.maxInstances) {
        parser = await factory();
        pool.push(parser);
        this.pools.set(language, pool);
      } else {
        // Wait for one to become available
        parser = await this.waitForAvailableParser(language);
      }
    }

    this.busyParsers.add(parser);
    this.lastUsed.set(parser, Date.now());
    return parser;
  }

  releaseParser(parser: ASTParser): void {
    this.busyParsers.delete(parser);
    this.lastUsed.set(parser, Date.now());
  }

  private async waitForAvailableParser(language: string): Promise<ASTParser> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const pool = this.pools.get(language);
        if (pool) {
          const available = pool.find((p) => !this.busyParsers.has(p));
          if (available) {
            clearInterval(checkInterval);
            resolve(available);
          }
        }
      }, 100); // Check every 100ms
    });
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleParsers();
    }, 60000); // Every minute
  }

  private cleanupIdleParsers(): void {
    const now = Date.now();

    for (const [language, pool] of this.pools.entries()) {
      const activePool = pool.filter((parser) => {
        const lastUsedTime = this.lastUsed.get(parser) ?? 0;
        const isIdle = now - lastUsedTime > this.config.idleTimeout;
        const isBusy = this.busyParsers.has(parser);

        if (isIdle && !isBusy) {
          // Cleanup idle parser
          this.lastUsed.delete(parser);
          if ("dispose" in parser && typeof parser.dispose === "function") {
            parser.dispose().catch(() => {
              // Ignore disposal errors
            });
          }
          return false;
        }
        return true;
      });

      this.pools.set(language, activePool);
    }
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Dispose all parsers
    for (const pool of this.pools.values()) {
      for (const parser of pool) {
        if ("dispose" in parser && typeof parser.dispose === "function") {
          parser.dispose().catch(() => {
            // Ignore disposal errors
          });
        }
      }
    }

    this.pools.clear();
    this.busyParsers.clear();
    this.lastUsed.clear();
  }
}

/**
 * Simple TTL-based cache implementation
 */
class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.lastAccessed = now;
    return entry.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();

    // Clean up expired entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    // If still at capacity, remove least recently used
    if (this.cache.size >= this.maxSize) {
      let oldestKey = "";
      let oldestTime = now;

      for (const [k, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      lastAccessed: now,
    });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * High-performance cache for parsing results and parser instances
 */
export class ParseCache {
  private astCache: SimpleCache<ParseResult>;
  private parserCache: SimpleCache<ASTParser>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: CacheConfig = {}) {
    this.astCache = new SimpleCache(
      config.maxASTEntries ?? 1000,
      config.astTTL ?? 1800000, // 30 minutes
    );

    this.parserCache = new SimpleCache(
      config.maxParserInstances ?? 20,
      config.parserTTL ?? 3600000, // 1 hour
    );
  }

  getCachedResult(
    code: string,
    language: string,
    filePath?: string,
  ): ParseResult | null {
    const key = generateCacheKey(code, language, filePath);
    const result = this.astCache.get(key);

    if (result) {
      this.stats.hits++;
      return result;
    } else {
      this.stats.misses++;
      return null;
    }
  }

  cacheResult(
    code: string,
    language: string,
    result: ParseResult,
    filePath?: string,
  ): void {
    const key = generateCacheKey(code, language, filePath);
    this.astCache.set(key, result);
  }

  getCachedParser(language: string): ASTParser | null {
    return this.parserCache.get(language) ?? null;
  }

  cacheParser(language: string, parser: ASTParser): void {
    this.parserCache.set(language, parser);
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      astCacheSize: this.astCache.size,
      parserCacheSize: this.parserCache.size,
    };
  }

  clear(): void {
    this.astCache.clear();
    this.parserCache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  dispose(): void {
    this.clear();
  }
}

/**
 * Memory-aware parsing with automatic throttling
 */
export class MemoryManager {
  private memoryThreshold: number;
  private activeParses: Map<string, number> = new Map();
  private memoryMonitorInterval?: NodeJS.Timeout;

  constructor(memoryThresholdMB = 1024) {
    this.memoryThreshold = memoryThresholdMB * 1024 * 1024; // Convert to bytes
    this.startMemoryMonitoring();
  }

  async parseWithMemoryManagement<T>(
    parseId: string,
    code: string,
    language: string,
    parseFunction: () => Promise<T>,
  ): Promise<T> {
    try {
      // Estimate memory requirement
      const estimatedMemory = estimateMemoryUsage(code, language);
      this.activeParses.set(parseId, estimatedMemory);

      // Check if we should throttle
      if (await this.shouldThrottleForMemory()) {
        await this.waitForMemoryRelief();
      }

      return await parseFunction();
    } finally {
      this.activeParses.delete(parseId);
    }
  }

  private async shouldThrottleForMemory(): Promise<boolean> {
    const memoryUsage = process.memoryUsage();
    const totalEstimatedUsage = Array.from(this.activeParses.values()).reduce(
      (sum, mem) => sum + mem,
      0,
    );

    return memoryUsage.heapUsed + totalEstimatedUsage > this.memoryThreshold;
  }

  private async waitForMemoryRelief(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.shouldThrottleForMemory()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500); // Check every 500ms
    });
  }

  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > this.memoryThreshold) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, 10000); // Every 10 seconds
  }

  dispose(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    this.activeParses.clear();
  }
}
