/**
 * SQLite Vector Storage Implementation
 *
 * Handles vector metadata storage, label mappings, and binary vector data persistence
 * for the HNSW vector database system.
 */

import Database from "better-sqlite3";
import { promises as fs, mkdirSync } from "fs";
import { dirname } from "path";
import type {
  VectorMetadata,
  VectorInsert,
  VectorDBConfig,
  LabelMapping,
} from "./types.js";

/**
 * SQLite table schemas for vector storage
 */
const VECTOR_TABLES = {
  vectors: `
    CREATE TABLE IF NOT EXISTS vectors (
      node_id TEXT PRIMARY KEY,
      vector_data BLOB NOT NULL,
      dimensions INTEGER NOT NULL,
      signature TEXT NOT NULL,
      summary TEXT NOT NULL,
      file_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      confidence REAL NOT NULL,
      last_updated TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      vector_hash TEXT NOT NULL
    )
  `,

  labels: `
    CREATE TABLE IF NOT EXISTS labels (
      node_id TEXT PRIMARY KEY,
      label INTEGER UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,

  metadata: `
    CREATE TABLE IF NOT EXISTS vector_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

/**
 * Indexes for performance optimization
 */
const VECTOR_INDEXES = {
  vectors_file_id:
    "CREATE INDEX IF NOT EXISTS idx_vectors_file_id ON vectors(file_id)",
  vectors_file_path:
    "CREATE INDEX IF NOT EXISTS idx_vectors_file_path ON vectors(file_path)",
  vectors_confidence:
    "CREATE INDEX IF NOT EXISTS idx_vectors_confidence ON vectors(confidence)",
  vectors_last_updated:
    "CREATE INDEX IF NOT EXISTS idx_vectors_last_updated ON vectors(last_updated)",
  vectors_hash:
    "CREATE INDEX IF NOT EXISTS idx_vectors_hash ON vectors(vector_hash)",
  labels_label: "CREATE INDEX IF NOT EXISTS idx_labels_label ON labels(label)",
};

/**
 * SQLite vector storage manager
 */
export class SQLiteVectorStorage {
  private db: Database.Database;
  private config: VectorDBConfig;
  private isInitialized = false;

  // Prepared statements for performance
  private insertVectorStmt?: Database.Statement;
  private insertLabelStmt?: Database.Statement;
  private updateVectorStmt?: Database.Statement;
  private deleteVectorStmt?: Database.Statement;
  private deleteLabelStmt?: Database.Statement;
  private getVectorStmt?: Database.Statement;
  private getLabelsStmt?: Database.Statement;

  constructor(config: VectorDBConfig) {
    this.config = config;

    // Ensure directory exists before opening database
    const dir = dirname(config.storageFile);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (_error) {
      // Directory might already exist, that's okay
    }

    this.db = new Database(config.storageFile);

    // Configure SQLite for performance
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 10000");
    this.db.pragma("temp_store = MEMORY");
    this.db.pragma("mmap_size = 268435456"); // 256MB
  }

  /**
   * Initialize the SQLite database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(this.config.storageFile));

      // Create tables
      for (const schema of Object.values(VECTOR_TABLES)) {
        this.db.exec(schema);
      }

      // Create indexes
      for (const index of Object.values(VECTOR_INDEXES)) {
        this.db.exec(index);
      }

      // Prepare statements
      this.prepareStatements();

      // Initialize metadata
      await this.initializeMetadata();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize SQLite vector storage: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Insert a single vector with metadata
   */
  async insertVector(
    nodeId: string,
    vector: number[],
    metadata: VectorMetadata,
  ): Promise<number> {
    this.ensureInitialized();

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimensions mismatch: expected ${this.config.dimensions}, got ${vector.length}`,
      );
    }

    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
    const vectorHash = this.calculateVectorHash(vector);

    try {
      // Start transaction
      const transaction = this.db.transaction(
        (
          nodeId: string,
          vectorData: Buffer,
          metadata: VectorMetadata,
          hash: string,
        ) => {
          // Insert vector data
          this.insertVectorStmt!.run({
            node_id: nodeId,
            vector_data: vectorData,
            dimensions: this.config.dimensions,
            signature: metadata.signature,
            summary: metadata.summary,
            file_id: metadata.fileId,
            file_path: metadata.filePath,
            line_number: metadata.lineNumber,
            confidence: metadata.confidence,
            last_updated: metadata.lastUpdated.toISOString(),
            vector_hash: hash,
          });

          // Get or create label
          const existingLabel = this.db
            .prepare("SELECT label FROM labels WHERE node_id = ?")
            .get(nodeId) as { label: number } | undefined;

          let label: number;
          if (existingLabel) {
            label = existingLabel.label;
          } else {
            // Get next available label from metadata counter
            const nextLabelResult = this.db
              .prepare("SELECT value FROM vector_metadata WHERE key = ?")
              .get("next_label_id") as { value: string } | undefined;
            if (!nextLabelResult) {
              throw new Error(
                "next_label_id not found in metadata - database may be corrupted",
              );
            }
            label = parseInt(nextLabelResult.value, 10);

            // Insert new label mapping
            this.insertLabelStmt!.run({
              node_id: nodeId,
              label: label,
            });

            // Increment the counter for next time
            this.db
              .prepare(
                "UPDATE vector_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
              )
              .run((label + 1).toString(), "next_label_id");
          }

          return label;
        },
      );

      return transaction(nodeId, vectorBuffer, metadata, vectorHash);
    } catch (error) {
      if ((error as Error).message.includes("UNIQUE constraint failed")) {
        throw new Error(`Vector with nodeId '${nodeId}' already exists`);
      }
      throw new Error(`Failed to insert vector: ${(error as Error).message}`);
    }
  }

  /**
   * Insert multiple vectors in a batch transaction
   */
  async insertVectors(vectors: VectorInsert[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: Array<{ nodeId: string; error: string }>;
  }> {
    this.ensureInitialized();

    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as Array<{ nodeId: string; error: string }>,
    };

    const transaction = this.db.transaction((vectors: VectorInsert[]) => {
      for (const vectorInsert of vectors) {
        try {
          if (vectorInsert.vector.length !== this.config.dimensions) {
            throw new Error(
              `Vector dimensions mismatch: expected ${this.config.dimensions}, got ${vectorInsert.vector.length}`,
            );
          }

          const vectorBuffer = Buffer.from(
            new Float32Array(vectorInsert.vector).buffer,
          );
          const vectorHash = this.calculateVectorHash(vectorInsert.vector);

          // Insert vector data
          this.insertVectorStmt!.run({
            node_id: vectorInsert.nodeId,
            vector_data: vectorBuffer,
            dimensions: this.config.dimensions,
            signature: vectorInsert.metadata.signature,
            summary: vectorInsert.metadata.summary,
            file_id: vectorInsert.metadata.fileId,
            file_path: vectorInsert.metadata.filePath,
            line_number: vectorInsert.metadata.lineNumber,
            confidence: vectorInsert.metadata.confidence,
            last_updated: vectorInsert.metadata.lastUpdated.toISOString(),
            vector_hash: vectorHash,
          });

          // Get or create label
          const existingLabel = this.db
            .prepare("SELECT label FROM labels WHERE node_id = ?")
            .get(vectorInsert.nodeId) as { label: number } | undefined;

          if (!existingLabel) {
            const maxLabelResult = this.db
              .prepare("SELECT MAX(label) as max_label FROM labels")
              .get() as { max_label: number | null };
            const label = (maxLabelResult.max_label || 0) + 1;

            this.insertLabelStmt!.run({
              node_id: vectorInsert.nodeId,
              label: label,
            });
          }

          results.successCount++;
        } catch (error) {
          results.failureCount++;
          results.errors.push({
            nodeId: vectorInsert.nodeId,
            error: (error as Error).message,
          });
        }
      }
    });

    transaction(vectors);
    return results;
  }

  /**
   * Update vector data and metadata
   */
  async updateVector(
    nodeId: string,
    vector: number[],
    metadata?: Partial<VectorMetadata>,
  ): Promise<void> {
    this.ensureInitialized();

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimensions mismatch: expected ${this.config.dimensions}, got ${vector.length}`,
      );
    }

    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
    const vectorHash = this.calculateVectorHash(vector);

    // Get existing metadata if only partial update
    let finalMetadata: VectorMetadata;
    if (metadata) {
      const existing = await this.getVector(nodeId);
      if (!existing) {
        throw new Error(`Vector with nodeId '${nodeId}' not found`);
      }
      finalMetadata = {
        ...existing.metadata,
        ...metadata,
        lastUpdated: new Date(),
      };
    } else {
      const existing = await this.getVector(nodeId);
      if (!existing) {
        throw new Error(`Vector with nodeId '${nodeId}' not found`);
      }
      finalMetadata = { ...existing.metadata, lastUpdated: new Date() };
    }

    this.updateVectorStmt!.run({
      vector_data: vectorBuffer,
      signature: finalMetadata.signature,
      summary: finalMetadata.summary,
      file_id: finalMetadata.fileId,
      file_path: finalMetadata.filePath,
      line_number: finalMetadata.lineNumber,
      confidence: finalMetadata.confidence,
      last_updated: finalMetadata.lastUpdated.toISOString(),
      vector_hash: vectorHash,
      node_id: nodeId,
    });
  }

  /**
   * Delete vector and its label mapping
   */
  async deleteVector(nodeId: string): Promise<boolean> {
    this.ensureInitialized();

    const transaction = this.db.transaction((nodeId: string) => {
      const vectorResult = this.deleteVectorStmt!.run(nodeId);
      this.deleteLabelStmt!.run(nodeId);
      return vectorResult.changes > 0;
    });

    return transaction(nodeId);
  }

  /**
   * Get vector data and metadata by nodeId
   */
  async getVector(
    nodeId: string,
  ): Promise<{ vector: number[]; metadata: VectorMetadata } | null> {
    this.ensureInitialized();

    const row = this.getVectorStmt!.get(nodeId) as any;
    if (!row) {
      return null;
    }

    return {
      vector: this.deserializeVector(row.vector_data),
      metadata: this.deserializeMetadata(row),
    };
  }

  /**
   * Get multiple vectors by nodeIds
   */
  async getVectors(
    nodeIds: string[],
  ): Promise<Map<string, { vector: number[]; metadata: VectorMetadata }>> {
    this.ensureInitialized();

    const results = new Map<
      string,
      { vector: number[]; metadata: VectorMetadata }
    >();

    if (nodeIds.length === 0) {
      return results;
    }

    const placeholders = nodeIds.map(() => "?").join(",");
    const query = `SELECT * FROM vectors WHERE node_id IN (${placeholders})`;
    const rows = this.db.prepare(query).all(...nodeIds) as any[];

    for (const row of rows) {
      results.set(row.node_id, {
        vector: this.deserializeVector(row.vector_data),
        metadata: this.deserializeMetadata(row),
      });
    }

    return results;
  }

  /**
   * Get all label mappings for HNSW index reconstruction
   */
  async getLabelMappings(): Promise<LabelMapping> {
    this.ensureInitialized();

    const rows = this.getLabelsStmt!.all() as Array<{
      node_id: string;
      label: number;
    }>;

    const nodeIdToLabel = new Map<string, number>();
    const labelToNodeId = new Map<number, string>();
    let nextLabel = 0;

    for (const row of rows) {
      nodeIdToLabel.set(row.node_id, row.label);
      labelToNodeId.set(row.label, row.node_id);
      nextLabel = Math.max(nextLabel, row.label + 1);
    }

    return {
      nodeIdToLabel,
      labelToNodeId,
      nextLabel,
    };
  }

  /**
   * Get metadata for search results by nodeIds
   */
  async getSearchMetadata(
    nodeIds: string[],
  ): Promise<Map<string, VectorMetadata>> {
    this.ensureInitialized();

    const results = new Map<string, VectorMetadata>();

    if (nodeIds.length === 0) {
      return results;
    }

    const placeholders = nodeIds.map(() => "?").join(",");
    const query = `
      SELECT node_id, signature, summary, file_id, file_path, line_number, confidence, last_updated
      FROM vectors 
      WHERE node_id IN (${placeholders})
    `;

    const rows = this.db.prepare(query).all(...nodeIds) as any[];

    for (const row of rows) {
      results.set(row.node_id, this.deserializeMetadata(row));
    }

    return results;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    vectorCount: number;
    storageSize: number;
    averageConfidence: number;
    oldestVector: Date | null;
    newestVector: Date | null;
  }> {
    this.ensureInitialized();

    const stats = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as vector_count,
        AVG(confidence) as avg_confidence,
        MIN(created_at) as oldest,
        MAX(last_updated) as newest
      FROM vectors
    `,
      )
      .get() as any;

    // Get file size
    const storageSize = await this.getFileSize(this.config.storageFile);

    return {
      vectorCount: stats.vector_count || 0,
      storageSize,
      averageConfidence: stats.avg_confidence || 0,
      oldestVector: stats.oldest ? new Date(stats.oldest) : null,
      newestVector: stats.newest ? new Date(stats.newest) : null,
    };
  }

  /**
   * Clean up resources and close database
   */
  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  // ===== Private Methods =====

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "SQLite vector storage not initialized. Call initialize() first.",
      );
    }
  }

  private prepareStatements(): void {
    this.insertVectorStmt = this.db.prepare(`
      INSERT INTO vectors (
        node_id, vector_data, dimensions, signature, summary, file_id, file_path, 
        line_number, confidence, last_updated, vector_hash
      ) VALUES (
        @node_id, @vector_data, @dimensions, @signature, @summary, @file_id, @file_path,
        @line_number, @confidence, @last_updated, @vector_hash
      )
    `);

    this.insertLabelStmt = this.db.prepare(`
      INSERT INTO labels (node_id, label) VALUES (@node_id, @label)
    `);

    this.updateVectorStmt = this.db.prepare(`
      UPDATE vectors SET 
        vector_data = @vector_data,
        signature = @signature,
        summary = @summary,
        file_id = @file_id,
        file_path = @file_path,
        line_number = @line_number,
        confidence = @confidence,
        last_updated = @last_updated,
        vector_hash = @vector_hash
      WHERE node_id = @node_id
    `);

    this.deleteVectorStmt = this.db.prepare(
      `DELETE FROM vectors WHERE node_id = ?`,
    );
    this.deleteLabelStmt = this.db.prepare(
      `DELETE FROM labels WHERE node_id = ?`,
    );

    this.getVectorStmt = this.db.prepare(
      `SELECT * FROM vectors WHERE node_id = ?`,
    );
    this.getLabelsStmt = this.db.prepare(
      `SELECT node_id, label FROM labels ORDER BY label`,
    );
  }

  private async initializeMetadata(): Promise<void> {
    // Get current max label to initialize next_label_id
    const maxLabelResult = this.db
      .prepare("SELECT MAX(label) as max_label FROM labels")
      .get() as { max_label: number | null };
    const nextLabelId = (maxLabelResult.max_label || 0) + 1;

    const metadata = [
      { key: "version", value: "1.0.0" },
      { key: "dimensions", value: this.config.dimensions.toString() },
      { key: "space", value: this.config.space },
      { key: "initialized_at", value: new Date().toISOString() },
    ];

    const insertMetadata = this.db.prepare(`
      INSERT OR REPLACE INTO vector_metadata (key, value) VALUES (?, ?)
    `);

    // Insert base metadata
    for (const { key, value } of metadata) {
      insertMetadata.run(key, value);
    }

    // Initialize next_label_id if it doesn't exist
    const existingLabelId = this.db
      .prepare("SELECT value FROM vector_metadata WHERE key = ?")
      .get("next_label_id") as { value: string } | undefined;
    if (!existingLabelId) {
      insertMetadata.run("next_label_id", nextLabelId.toString());
    }
  }

  private deserializeVector(buffer: Buffer): number[] {
    return Array.from(
      new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4),
    );
  }

  private deserializeMetadata(row: any): VectorMetadata {
    return {
      signature: row.signature,
      summary: row.summary,
      fileId: row.file_id,
      filePath: row.file_path,
      lineNumber: row.line_number,
      confidence: row.confidence,
      lastUpdated: new Date(row.last_updated),
    };
  }

  /**
   * Get label mapping for a specific node ID
   */
  async getLabelMapping(nodeId: string): Promise<number | null> {
    this.ensureInitialized();

    const row = this.db
      .prepare("SELECT label FROM labels WHERE node_id = ?")
      .get(nodeId) as { label: number } | undefined;
    return row ? row.label : null;
  }

  /**
   * Get node ID from label mapping (reverse lookup)
   */
  async getNodeIdFromLabel(label: number): Promise<string | null> {
    this.ensureInitialized();

    const row = this.db
      .prepare("SELECT node_id FROM labels WHERE label = ?")
      .get(label) as { node_id: string } | undefined;
    return row ? row.node_id : null;
  }

  /**
   * Get all node IDs (for index rebuilding)
   */
  async getAllNodeIds(): Promise<string[]> {
    this.ensureInitialized();

    const rows = this.db.prepare("SELECT node_id FROM vectors").all() as Array<{
      node_id: string;
    }>;
    return rows.map((row) => row.node_id);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  private calculateVectorHash(vector: number[]): string {
    // Simple hash for deduplication - sum of squares modulo large prime
    const sum = vector.reduce((acc, val) => acc + val * val, 0);
    return (sum % 982451653).toString(36);
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
