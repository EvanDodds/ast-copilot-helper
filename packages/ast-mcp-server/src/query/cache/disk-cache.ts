/**
 * @fileoverview L2 Disk Cache Implementation
 *
 * Persistent disk-based cache for recent queries with <500ms access time target.
 * Second level in the multi-level cache architecture.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { createLogger } from "../../../../ast-helper/src/logging/index.js";

import type {
  CacheEntry,
  CacheLevel,
  LevelCacheConfig,
  LevelCacheStats,
  CacheOperationResult,
} from "./types.js";

/**
 * L2 Disk Cache configuration
 */
interface DiskCacheConfig extends LevelCacheConfig {
  /** Base path for cache files */
  path: string;
}

/**
 * L2 Disk Cache - Persistent file-based cache
 *
 * Target performance: <500ms access time
 * Typical usage: Recent queries, intermediate persistence
 */
export class DiskCache<T = unknown> {
  private config: DiskCacheConfig;
  private logger = createLogger({ operation: "disk-cache-l2" });

  // In-memory index for fast lookups
  private index = new Map<
    string,
    { file: string; timestamp: number; size: number }
  >();

  // Statistics
  private stats: LevelCacheStats = {
    level: "L2",
    hits: 0,
    misses: 0,
    hitRate: 0,
    entryCount: 0,
    sizeBytes: 0,
    evictions: 0,
    avgAccessTime: 0,
  };

  private accessTimes: number[] = [];
  private initPromise: Promise<void>;

  constructor(config: DiskCacheConfig) {
    this.config = config;
    this.initPromise = this.initialize();
  }

  /**
   * Initialize disk cache
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Ensure cache directory exists
      await fs.mkdir(this.config.path, { recursive: true });

      // Load index from disk
      await this.loadIndex();

      this.logger.debug("L2 disk cache initialized", {
        path: this.config.path,
        maxSize: this.config.maxSize,
        entryCount: this.index.size,
      });
    } catch (error) {
      this.logger.error("Failed to initialize L2 disk cache", { error });
    }
  }

  /**
   * Load index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.path);
      let totalSize = 0;

      for (const file of files) {
        if (!file.endsWith(".cache")) {
          continue;
        }

        const filePath = join(this.config.path, file);
        const stats = await fs.stat(filePath);

        // Extract key from filename (remove .cache extension)
        const key = file.slice(0, -6);

        this.index.set(key, {
          file: filePath,
          timestamp: stats.mtimeMs,
          size: stats.size,
        });

        totalSize += stats.size;
      }

      this.stats.entryCount = this.index.size;
      this.stats.sizeBytes = totalSize;

      this.logger.debug("L2 index loaded", {
        entries: this.index.size,
        sizeBytes: totalSize,
      });
    } catch (error) {
      this.logger.warn("Failed to load L2 index", { error });
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<CacheOperationResult<T>> {
    await this.initPromise;
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: "L2 cache is disabled",
      };
    }

    const indexEntry = this.index.get(key);

    if (!indexEntry) {
      this.stats.misses++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      return {
        success: false,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Read cache file
      const data = await fs.readFile(indexEntry.file, "utf-8");
      const entry: CacheEntry<T> = JSON.parse(data);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        this.recordAccessTime(Date.now() - startTime);

        this.logger.debug("L2 cache expired entry", { key });

        return {
          success: false,
          latencyMs: Date.now() - startTime,
        };
      }

      // Update access information
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      // Write back updated entry (async, don't wait)
      fs.writeFile(indexEntry.file, JSON.stringify(entry)).catch((error) => {
        this.logger.warn("Failed to update L2 cache entry", { key, error });
      });

      this.stats.hits++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      this.logger.debug("L2 cache hit", {
        key,
        accessCount: entry.accessCount,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: true,
        value: entry.value,
        level: "L2",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to read L2 cache entry", { key, error });
      this.stats.misses++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: T,
    ttl?: number,
  ): Promise<CacheOperationResult<T>> {
    await this.initPromise;
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: "L2 cache is disabled",
      };
    }

    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        ttl: ttl || this.config.defaultTTL,
        accessCount: 0,
        lastAccessed: now,
        size: 0,
        level: "L2",
      };

      // Generate filename from key hash
      const filename = this.generateFilename(key);
      const filePath = join(this.config.path, filename);

      // Serialize entry
      const data = JSON.stringify(entry);
      entry.size = data.length * 2;

      // Evict entries if at capacity
      while (this.index.size >= this.config.maxSize) {
        await this.evictLRU();
      }

      // Write to disk
      await fs.writeFile(filePath, data, "utf-8");

      // Update index
      this.index.set(key, {
        file: filePath,
        timestamp: now,
        size: entry.size,
      });

      this.stats.entryCount = this.index.size;
      this.updateSizeBytes();

      this.logger.debug("L2 cache set", {
        key,
        size: entry.size,
        ttl: entry.ttl,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: true,
        level: "L2",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to write L2 cache entry", { key, error });

      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    await this.initPromise;

    if (!this.config.enabled) {
      return false;
    }

    const indexEntry = this.index.get(key);

    if (!indexEntry) {
      return false;
    }

    try {
      await fs.unlink(indexEntry.file);
      this.index.delete(key);
      this.stats.entryCount = this.index.size;
      this.updateSizeBytes();

      this.logger.debug("L2 cache delete", { key });

      return true;
    } catch (error) {
      this.logger.warn("Failed to delete L2 cache entry", { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    await this.initPromise;

    if (!this.config.enabled) {
      return false;
    }

    const indexEntry = this.index.get(key);

    if (!indexEntry) {
      return false;
    }

    // Verify file exists
    try {
      await fs.access(indexEntry.file);
      return true;
    } catch {
      // File doesn't exist, remove from index
      this.index.delete(key);
      return false;
    }
  }

  /**
   * Get all keys in cache
   */
  async keys(): Promise<string[]> {
    await this.initPromise;

    if (!this.config.enabled) {
      return [];
    }

    return Array.from(this.index.keys());
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    await this.initPromise;

    if (!this.config.enabled) {
      return;
    }

    try {
      // Delete all cache files
      for (const [_key, indexEntry] of this.index.entries()) {
        await fs.unlink(indexEntry.file).catch(() => {
          // Ignore errors
        });
      }

      this.index.clear();
      this.stats.entryCount = 0;
      this.stats.sizeBytes = 0;

      this.logger.info("L2 cache cleared");
    } catch (error) {
      this.logger.error("Failed to clear L2 cache", { error });
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    if (this.index.size === 0) {
      return;
    }

    // Find least recently accessed entry
    let oldestKey: string | undefined;
    let oldestTime = Number.MAX_SAFE_INTEGER;

    for (const [key, indexEntry] of this.index.entries()) {
      if (indexEntry.timestamp < oldestTime) {
        oldestTime = indexEntry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      await this.delete(oldestKey);
      this.stats.evictions++;
      this.logger.debug("L2 cache eviction", { key: oldestKey });
    }
  }

  /**
   * Generate filename from key
   */
  private generateFilename(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex");
    return `${hash}.cache`;
  }

  /**
   * Update total size in bytes
   */
  private updateSizeBytes(): void {
    let total = 0;

    for (const [_key, indexEntry] of this.index.entries()) {
      total += indexEntry.size;
    }

    this.stats.sizeBytes = total;
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Record access time for averaging
   */
  private recordAccessTime(timeMs: number): void {
    this.accessTimes.push(timeMs);

    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-1000);
    }

    const sum = this.accessTimes.reduce((a, b) => a + b, 0);
    this.stats.avgAccessTime = sum / this.accessTimes.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): LevelCacheStats {
    this.updateSizeBytes();
    return { ...this.stats };
  }

  /**
   * Get cache level identifier
   */
  getLevel(): CacheLevel {
    return "L2";
  }

  /**
   * Shutdown cache
   */
  async shutdown(): Promise<void> {
    // Save index state if needed
    this.logger.debug("L2 cache shutdown");
  }
}
