/**
 * Annotation Database Manager
 *
 * Handles persistence of code annotations in SQLite for improved performance
 * and reliability compared to individual JSON files.
 */

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import { dirname, join } from "path";
import { createLogger } from "../logging/index.js";
import type { ASTDatabaseManager } from "./manager.js";

/**
 * Annotation record structure matching the annotations table schema
 */
export interface AnnotationRecord {
  node_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  node_type: string;
  signature: string | null;
  complexity_score: number | null;
  dependencies: string | null; // JSON array stored as string
  metadata: string | null; // JSON object stored as string
  created_at: number;
  updated_at: number;
}

/**
 * Annotation insert structure (without auto-generated fields)
 */
export interface AnnotationInsert {
  node_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  node_type: string;
  signature?: string;
  complexity_score?: number;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Query options for retrieving annotations
 */
export interface AnnotationQueryOptions {
  file_path?: string;
  node_type?: string;
  min_complexity?: number;
  max_complexity?: number;
  limit?: number;
  offset?: number;
}

/**
 * Annotation statistics
 */
export interface AnnotationStats {
  total_annotations: number;
  files_count: number;
  node_types: Record<string, number>;
  avg_complexity: number | null;
  last_updated: number | null;
}

/**
 * SQLite table schema for annotations
 * Note: Foreign key to nodes table removed as this is a standalone database
 */
const ANNOTATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS annotations (
    node_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    node_type TEXT NOT NULL,
    signature TEXT,
    complexity_score REAL,
    dependencies TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

/**
 * Indexes for performance optimization
 */
const ANNOTATIONS_INDEXES = {
  file_path:
    "CREATE INDEX IF NOT EXISTS idx_annotations_file_path ON annotations(file_path)",
  complexity:
    "CREATE INDEX IF NOT EXISTS idx_annotations_complexity ON annotations(complexity_score)",
};

/**
 * Annotation Database Manager
 */
export class AnnotationDatabaseManager {
  private db!: Database.Database;
  private dbPath: string;
  private isInitialized = false;
  private logger = createLogger();

  // Prepared statements for performance
  private insertStmt?: Database.Statement;
  private updateStmt?: Database.Statement;
  private deleteStmt?: Database.Statement;
  private deleteByFileStmt?: Database.Statement;
  private getByNodeIdStmt?: Database.Statement;
  private getByFileStmt?: Database.Statement;
  private getAllStmt?: Database.Statement;

  constructor(dbManager: ASTDatabaseManager) {
    this.dbPath = join(dbManager.astdbPath, "annotations.sqlite");
    // Database will be opened in initialize()
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(this.dbPath));

      // If database was previously closed, reopen it
      if (!this.db || !this.db.open) {
        this.db = new Database(this.dbPath);

        // Configure SQLite for performance
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.db.pragma("cache_size = 10000");
        this.db.pragma("temp_store = MEMORY");
        this.db.pragma("mmap_size = 268435456"); // 256MB
      }

      // Create table
      this.db.exec(ANNOTATIONS_TABLE);

      // Create indexes
      for (const index of Object.values(ANNOTATIONS_INDEXES)) {
        this.db.exec(index);
      }

      // Prepare statements
      this.prepareStatements();

      this.isInitialized = true;
      this.logger.debug("Annotation database initialized", {
        path: this.dbPath,
      });
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error("Failed to initialize annotation database", {
        error: message,
      });
      throw new Error(`Failed to initialize annotation database: ${message}`);
    }
  }

  /**
   * Prepare SQL statements for reuse
   */
  private prepareStatements(): void {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO annotations (
        node_id, file_path, start_line, end_line, node_type,
        signature, complexity_score, dependencies, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.updateStmt = this.db.prepare(`
      UPDATE annotations
      SET file_path = ?, start_line = ?, end_line = ?, node_type = ?,
          signature = ?, complexity_score = ?, dependencies = ?,
          metadata = ?, updated_at = ?
      WHERE node_id = ?
    `);

    this.deleteStmt = this.db.prepare(
      "DELETE FROM annotations WHERE node_id = ?",
    );

    this.deleteByFileStmt = this.db.prepare(
      "DELETE FROM annotations WHERE file_path = ?",
    );

    this.getByNodeIdStmt = this.db.prepare(
      "SELECT * FROM annotations WHERE node_id = ?",
    );

    this.getByFileStmt = this.db.prepare(
      "SELECT * FROM annotations WHERE file_path = ? ORDER BY start_line",
    );

    this.getAllStmt = this.db.prepare(
      "SELECT * FROM annotations ORDER BY file_path, start_line",
    );
  }

  /**
   * Insert a single annotation
   */
  async insertAnnotation(annotation: AnnotationInsert): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.insertStmt) {
      throw new Error("Insert statement not prepared");
    }

    const now = Date.now();
    const dependencies = annotation.dependencies
      ? JSON.stringify(annotation.dependencies)
      : null;
    const metadata = annotation.metadata
      ? JSON.stringify(annotation.metadata)
      : null;

    this.insertStmt.run(
      annotation.node_id,
      annotation.file_path,
      annotation.start_line,
      annotation.end_line,
      annotation.node_type,
      annotation.signature ?? null,
      annotation.complexity_score ?? null,
      dependencies,
      metadata,
      now,
      now,
    );

    this.logger.debug("Inserted annotation", {
      node_id: annotation.node_id,
      file: annotation.file_path,
    });
  }

  /**
   * Insert multiple annotations in a transaction
   */
  async insertAnnotations(annotations: AnnotationInsert[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (annotations.length === 0) {
      return;
    }

    if (!this.insertStmt) {
      throw new Error("Insert statement not prepared");
    }

    const insertStmt = this.insertStmt;
    const insertMany = this.db.transaction((annots: AnnotationInsert[]) => {
      for (const annotation of annots) {
        const now = Date.now();
        const dependencies = annotation.dependencies
          ? JSON.stringify(annotation.dependencies)
          : null;
        const metadata = annotation.metadata
          ? JSON.stringify(annotation.metadata)
          : null;

        insertStmt.run(
          annotation.node_id,
          annotation.file_path,
          annotation.start_line,
          annotation.end_line,
          annotation.node_type,
          annotation.signature ?? null,
          annotation.complexity_score ?? null,
          dependencies,
          metadata,
          now,
          now,
        );
      }
    });

    insertMany(annotations);

    this.logger.debug("Inserted annotations batch", {
      count: annotations.length,
    });
  }

  /**
   * Update an existing annotation
   */
  async updateAnnotation(annotation: AnnotationInsert): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.updateStmt) {
      throw new Error("Update statement not prepared");
    }

    const now = Date.now();
    const dependencies = annotation.dependencies
      ? JSON.stringify(annotation.dependencies)
      : null;
    const metadata = annotation.metadata
      ? JSON.stringify(annotation.metadata)
      : null;

    this.updateStmt.run(
      annotation.file_path,
      annotation.start_line,
      annotation.end_line,
      annotation.node_type,
      annotation.signature ?? null,
      annotation.complexity_score ?? null,
      dependencies,
      metadata,
      now,
      annotation.node_id,
    );

    this.logger.debug("Updated annotation", {
      node_id: annotation.node_id,
    });
  }

  /**
   * Delete annotation by node_id
   */
  async deleteAnnotation(nodeId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.deleteStmt) {
      throw new Error("Delete statement not prepared");
    }

    this.deleteStmt.run(nodeId);

    this.logger.debug("Deleted annotation", { node_id: nodeId });
  }

  /**
   * Delete all annotations for a file
   */
  async deleteAnnotationsByFile(filePath: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.deleteByFileStmt) {
      throw new Error("Delete by file statement not prepared");
    }

    this.deleteByFileStmt.run(filePath);

    this.logger.debug("Deleted annotations for file", { file: filePath });
  }

  /**
   * Get annotation by node_id
   */
  async getAnnotation(nodeId: string): Promise<AnnotationRecord | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.getByNodeIdStmt) {
      throw new Error("Get by node_id statement not prepared");
    }

    const row = this.getByNodeIdStmt.get(nodeId) as
      | AnnotationRecord
      | undefined;
    return row ?? null;
  }

  /**
   * Get all annotations for a file
   */
  async getAnnotationsByFile(filePath: string): Promise<AnnotationRecord[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.getByFileStmt) {
      throw new Error("Get by file statement not prepared");
    }

    const rows = this.getByFileStmt.all(filePath) as AnnotationRecord[];
    return rows;
  }

  /**
   * Get all annotations
   */
  async getAllAnnotations(): Promise<AnnotationRecord[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.getAllStmt) {
      throw new Error("Get all statement not prepared");
    }

    const rows = this.getAllStmt.all() as AnnotationRecord[];
    return rows;
  }

  /**
   * Query annotations with filters
   */
  async queryAnnotations(
    options: AnnotationQueryOptions,
  ): Promise<AnnotationRecord[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let query = "SELECT * FROM annotations WHERE 1=1";
    const params: (string | number)[] = [];

    if (options.file_path) {
      query += " AND file_path = ?";
      params.push(options.file_path);
    }

    if (options.node_type) {
      query += " AND node_type = ?";
      params.push(options.node_type);
    }

    if (options.min_complexity !== undefined) {
      query += " AND complexity_score >= ?";
      params.push(options.min_complexity);
    }

    if (options.max_complexity !== undefined) {
      query += " AND complexity_score <= ?";
      params.push(options.max_complexity);
    }

    query += " ORDER BY file_path, start_line";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    if (options.offset) {
      query += " OFFSET ?";
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AnnotationRecord[];
    return rows;
  }

  /**
   * Get annotation statistics
   */
  async getStatistics(): Promise<AnnotationStats> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Total count
    const countRow = this.db
      .prepare("SELECT COUNT(*) as count FROM annotations")
      .get() as { count: number };

    // Unique files count
    const filesRow = this.db
      .prepare("SELECT COUNT(DISTINCT file_path) as count FROM annotations")
      .get() as { count: number };

    // Node types distribution
    const typeRows = this.db
      .prepare(
        "SELECT node_type, COUNT(*) as count FROM annotations GROUP BY node_type",
      )
      .all() as { node_type: string; count: number }[];

    const node_types: Record<string, number> = {};
    for (const row of typeRows) {
      node_types[row.node_type] = row.count;
    }

    // Average complexity
    const complexityRow = this.db
      .prepare(
        "SELECT AVG(complexity_score) as avg FROM annotations WHERE complexity_score IS NOT NULL",
      )
      .get() as { avg: number | null };

    // Last updated
    const lastUpdatedRow = this.db
      .prepare("SELECT MAX(updated_at) as last FROM annotations")
      .get() as { last: number | null };

    return {
      total_annotations: countRow.count,
      files_count: filesRow.count,
      node_types,
      avg_complexity: complexityRow.avg,
      last_updated: lastUpdatedRow.last,
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      // Clear prepared statements
      this.insertStmt = undefined;
      this.updateStmt = undefined;
      this.deleteStmt = undefined;
      this.deleteByFileStmt = undefined;
      this.getByNodeIdStmt = undefined;
      this.getByFileStmt = undefined;
      this.getAllStmt = undefined;
      this.logger.debug("Annotation database closed");
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Get the database file path
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
