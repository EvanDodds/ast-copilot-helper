/**
 * Query Log Storage Implementation
 *
 * Provides persistent storage for query history in SQLite database.
 * Tracks query patterns, performance metrics, and cache effectiveness.
 *
 * Addresses Issue #160 acceptance criteria:
 * - Persistent query history
 * - Query analytics for cache warming
 * - Performance tracking
 */

import Database from "better-sqlite3";
import { promises as fs, mkdirSync } from "fs";
import { dirname, join } from "path";
import { createModuleLogger } from "../logging/index.js";
import { createHash } from "crypto";

const logger = createModuleLogger("QueryLog");

/**
 * Query log entry
 */
export interface QueryLogEntry {
  id?: number;
  queryText: string;
  queryHash: string;
  options: string; // JSON stringified options
  resultCount: number;
  executionTimeMs: number;
  cacheHit: boolean;
  timestamp: number;
  indexVersion?: string;
}

/**
 * Query statistics
 */
export interface QueryStatistics {
  totalQueries: number;
  cacheHitRate: number;
  averageExecutionTime: number;
  topQueries: Array<{
    queryHash: string;
    queryText: string;
    count: number;
    avgExecutionTime: number;
  }>;
}

/**
 * SQLite table schemas for query log
 */
const QUERY_LOG_TABLES = {
  queryLog: `
    CREATE TABLE IF NOT EXISTS query_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_text TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      options TEXT NOT NULL,
      result_count INTEGER NOT NULL,
      execution_time_ms REAL NOT NULL,
      cache_hit INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      index_version TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,

  metadata: `
    CREATE TABLE IF NOT EXISTS query_log_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

/**
 * Indexes for performance optimization
 */
const QUERY_LOG_INDEXES = {
  query_hash:
    "CREATE INDEX IF NOT EXISTS idx_query_hash ON query_log(query_hash)",
  timestamp: "CREATE INDEX IF NOT EXISTS idx_timestamp ON query_log(timestamp)",
  cache_hit: "CREATE INDEX IF NOT EXISTS idx_cache_hit ON query_log(cache_hit)",
  execution_time:
    "CREATE INDEX IF NOT EXISTS idx_execution_time ON query_log(execution_time_ms)",
  index_version:
    "CREATE INDEX IF NOT EXISTS idx_index_version ON query_log(index_version)",
};

/**
 * Query Log Storage Manager
 */
export class QueryLogStorage {
  private db: Database.Database;
  private dbPath: string;
  private isInitialized = false;

  // Prepared statements
  private insertLogStmt?: Database.Statement;
  private getRecentQueriesStmt?: Database.Statement;

  constructor(baseDir = ".astdb/cache") {
    this.dbPath = join(baseDir, "query-log.db");

    // Ensure directory exists before opening database
    const dir = dirname(this.dbPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (_error) {
      // Directory might already exist, that's okay
    }

    this.db = new Database(this.dbPath);

    // Configure SQLite for performance
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 5000");
    this.db.pragma("temp_store = MEMORY");
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(this.dbPath));

      // Create tables
      for (const schema of Object.values(QUERY_LOG_TABLES)) {
        this.db.exec(schema);
      }

      // Create indexes
      for (const index of Object.values(QUERY_LOG_INDEXES)) {
        this.db.exec(index);
      }

      // Prepare statements
      this.prepareStatements();

      // Initialize metadata
      await this.initializeMetadata();

      this.isInitialized = true;
      logger.info("Query log storage initialized", { dbPath: this.dbPath });
    } catch (error) {
      logger.error("Failed to initialize query log storage", {
        error: (error as Error).message,
      });
      throw new Error(
        `Failed to initialize query log storage: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Log a query execution
   */
  async logQuery(entry: QueryLogEntry): Promise<void> {
    this.ensureInitialized();

    if (!this.insertLogStmt) {
      throw new Error("Insert statement not prepared");
    }

    try {
      this.insertLogStmt.run({
        queryText: entry.queryText,
        queryHash: entry.queryHash,
        options: entry.options,
        resultCount: entry.resultCount,
        executionTimeMs: entry.executionTimeMs,
        cacheHit: entry.cacheHit ? 1 : 0,
        timestamp: entry.timestamp,
        indexVersion: entry.indexVersion || null,
      });

      logger.debug("Query logged", {
        queryHash: entry.queryHash,
        executionTimeMs: entry.executionTimeMs,
        cacheHit: entry.cacheHit,
      });
    } catch (error) {
      logger.error("Failed to log query", {
        error: (error as Error).message,
      });
      // Don't throw - logging failure shouldn't break queries
    }
  }

  /**
   * Get recent queries
   */
  async getRecentQueries(limit = 100): Promise<QueryLogEntry[]> {
    this.ensureInitialized();

    if (!this.getRecentQueriesStmt) {
      throw new Error("Get recent queries statement not prepared");
    }

    try {
      const rows = this.getRecentQueriesStmt.all(limit) as Array<
        Record<string, unknown>
      >;
      return rows.map((row) => ({
        id: row.id as number,
        queryText: row.query_text as string,
        queryHash: row.query_hash as string,
        options: row.options as string,
        resultCount: row.result_count as number,
        executionTimeMs: row.execution_time_ms as number,
        cacheHit: Boolean(row.cache_hit),
        timestamp: row.timestamp as number,
        indexVersion: row.index_version as string | undefined,
      }));
    } catch (error) {
      logger.error("Failed to get recent queries", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get top queries by frequency
   */
  async getTopQueries(
    limit = 10,
    sinceDays = 30,
  ): Promise<
    Array<{
      queryHash: string;
      queryText: string;
      count: number;
      avgExecutionTime: number;
    }>
  > {
    this.ensureInitialized();

    try {
      const cutoffTime = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare(`
        SELECT 
          query_hash,
          query_text,
          COUNT(*) as count,
          AVG(execution_time_ms) as avg_execution_time
        FROM query_log
        WHERE timestamp > ?
        GROUP BY query_hash
        ORDER BY count DESC
        LIMIT ?
      `);

      const rows = stmt.all(cutoffTime, limit) as Array<
        Record<string, unknown>
      >;
      return rows.map((row) => ({
        queryHash: row.query_hash as string,
        queryText: row.query_text as string,
        count: row.count as number,
        avgExecutionTime: row.avg_execution_time as number,
      }));
    } catch (error) {
      logger.error("Failed to get top queries", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get query statistics
   */
  async getStatistics(sinceDays = 30): Promise<QueryStatistics> {
    this.ensureInitialized();

    try {
      const cutoffTime = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as cache_hits,
          AVG(execution_time_ms) as avg_time
        FROM query_log
        WHERE timestamp > ?
      `);

      const row = stmt.get(cutoffTime) as Record<string, unknown> | undefined;
      const total = (row?.total as number) || 0;
      const cacheHits = (row?.cache_hits as number) || 0;
      const avgTime = (row?.avg_time as number) || 0;

      const topQueries = await this.getTopQueries(10, sinceDays);

      return {
        totalQueries: total,
        cacheHitRate: total > 0 ? cacheHits / total : 0,
        averageExecutionTime: avgTime,
        topQueries,
      };
    } catch (error) {
      logger.error("Failed to get query statistics", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get queries for cache warming
   * Returns frequently accessed queries that would benefit from caching
   */
  async getQueriesForWarming(
    minFrequency = 3,
    sinceDays = 7,
  ): Promise<
    Array<{
      queryHash: string;
      queryText: string;
      options: string;
      frequency: number;
    }>
  > {
    this.ensureInitialized();

    try {
      const cutoffTime = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare(`
        SELECT 
          query_hash,
          query_text,
          options,
          COUNT(*) as frequency
        FROM query_log
        WHERE timestamp > ?
        GROUP BY query_hash
        HAVING frequency >= ?
        ORDER BY frequency DESC
      `);

      const rows = stmt.all(cutoffTime, minFrequency) as Array<
        Record<string, unknown>
      >;
      return rows.map((row) => ({
        queryHash: row.query_hash as string,
        queryText: row.query_text as string,
        options: row.options as string,
        frequency: row.frequency as number,
      }));
    } catch (error) {
      logger.error("Failed to get queries for warming", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Clean old log entries
   */
  async cleanOldEntries(olderThanDays = 90): Promise<number> {
    this.ensureInitialized();

    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare(`
        DELETE FROM query_log WHERE timestamp < ?
      `);

      const result = stmt.run(cutoffTime);
      logger.info("Cleaned old query log entries", {
        deleted: result.changes,
        olderThanDays,
      });

      return result.changes;
    } catch (error) {
      logger.error("Failed to clean old entries", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      logger.info("Query log storage closed");
    }
  }

  /**
   * Generate query hash for cache key
   */
  static generateQueryHash(
    queryText: string,
    options: Record<string, unknown> = {},
  ): string {
    const normalizedQuery = queryText.trim().toLowerCase();
    const normalizedOptions = JSON.stringify(
      options,
      Object.keys(options).sort(),
    );
    const combined = `${normalizedQuery}:${normalizedOptions}`;
    return createHash("sha256").update(combined).digest("hex").substring(0, 16);
  }

  /**
   * Prepare SQL statements for performance
   */
  private prepareStatements(): void {
    this.insertLogStmt = this.db.prepare(`
      INSERT INTO query_log (
        query_text, query_hash, options, result_count,
        execution_time_ms, cache_hit, timestamp, index_version
      ) VALUES (
        @queryText, @queryHash, @options, @resultCount,
        @executionTimeMs, @cacheHit, @timestamp, @indexVersion
      )
    `);

    this.getRecentQueriesStmt = this.db.prepare(`
      SELECT * FROM query_log 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
  }

  /**
   * Initialize metadata table
   */
  private async initializeMetadata(): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO query_log_metadata (key, value)
      VALUES ('schema_version', '1.0.0')
    `);
    stmt.run();
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (_error) {
      // Directory might already exist
    }
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Query log storage not initialized. Call initialize() first.",
      );
    }
  }
}

/**
 * Singleton instance for global access
 */
let globalQueryLog: QueryLogStorage | null = null;

/**
 * Get or create global query log instance
 */
export function getQueryLog(baseDir?: string): QueryLogStorage {
  if (!globalQueryLog) {
    globalQueryLog = new QueryLogStorage(baseDir);
  }
  return globalQueryLog;
}

/**
 * Close global query log instance
 */
export function closeQueryLog(): void {
  if (globalQueryLog) {
    globalQueryLog.close();
    globalQueryLog = null;
  }
}
