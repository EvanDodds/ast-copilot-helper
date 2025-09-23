/**
 * Embedding database operations
 * Handles storage and retrieval of embedding vectors and metadata
 */

import { join } from 'node:path';
import { readFile, writeFile, mkdir, access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { EmbeddingResult } from '../embedder/types.js';
import type { ASTDatabaseManager } from './manager.js';
import { DatabaseErrors, DatabaseError } from '../errors/index.js';
import { createLogger } from '../logging/index.js';

/**
 * Embedding database metadata
 */
export interface EmbeddingMetadata {
  /** Model used to generate embeddings */
  model: string;
  /** Model version/hash */
  modelVersion: string;
  /** Dimensions of embedding vectors */
  dimensions: number;
  /** Timestamp when embeddings were generated */
  createdAt: string;
  /** Total number of embeddings */
  count: number;
  /** Configuration used for generation */
  config: {
    batchSize: number;
    maxConcurrency: number;
    textProcessing: any;
  };
}

/**
 * Stored embedding entry with index information
 */
export interface StoredEmbedding extends EmbeddingResult {
  /** Index in the embedding collection */
  index: number;
  /** Timestamp when stored */
  storedAt: string;
}

/**
 * Embedding database manager
 */
export class EmbeddingDatabaseManager {
  private dbManager: ASTDatabaseManager;
  private logger = createLogger({ operation: 'embedding-db' });

  constructor(dbManager: ASTDatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Get embeddings directory path
   */
  private get embeddingsPath(): string {
    return join(this.dbManager.astdbPath, 'embeddings');
  }

  /**
   * Initialize embeddings storage
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.embeddingsPath, { recursive: true });
      this.logger.debug('Embeddings directory initialized', { path: this.embeddingsPath });
    } catch (error: any) {
      throw DatabaseErrors.corruption(
        this.embeddingsPath,
        `Failed to initialize embeddings directory: ${error.message}`
      );
    }
  }

  /**
   * Store embedding results
   */
  async storeEmbeddings(
    results: EmbeddingResult[],
    modelInfo: { name: string; version: string; dimensions: number },
    config: any
  ): Promise<void> {
    if (results.length === 0) {
      this.logger.warn('No embeddings to store');
      return;
    }

    await this.initialize();

    const timestamp = new Date().toISOString();
    const embeddingFile = join(this.embeddingsPath, `embeddings-${Date.now()}.json`);
    const metadataFile = join(this.embeddingsPath, `metadata-${Date.now()}.json`);

    try {
      // Prepare stored embeddings with indices
      const storedEmbeddings: StoredEmbedding[] = results.map((result, index) => ({
        ...result,
        index,
        storedAt: timestamp
      }));

      // Create metadata
      const metadata: EmbeddingMetadata = {
        model: modelInfo.name,
        modelVersion: modelInfo.version,
        dimensions: modelInfo.dimensions,
        createdAt: timestamp,
        count: results.length,
        config: {
          batchSize: config.defaultBatchSize || 32,
          maxConcurrency: config.maxConcurrency || 2,
          textProcessing: config.textProcessing || {}
        }
      };

      // Store embeddings and metadata atomically
      await Promise.all([
        writeFile(embeddingFile, JSON.stringify(storedEmbeddings, null, 2)),
        writeFile(metadataFile, JSON.stringify(metadata, null, 2))
      ]);

      this.logger.info('✅ Embeddings stored successfully', {
        count: results.length,
        file: embeddingFile,
        metadata: metadataFile
      });

    } catch (error: any) {
      throw new DatabaseError(
        `Failed to store embeddings: ${error.message}`,
        { 
          operation: 'store_embeddings',
          embeddingFile,
          metadataFile,
          count: results.length,
          error: error.message 
        }
      );
    }
  }

  /**
   * Load all embeddings from storage
   */
  async loadEmbeddings(): Promise<{ embeddings: StoredEmbedding[]; metadata: EmbeddingMetadata[] }> {
    await this.initialize();

    try {
      // Check if embeddings directory exists and has content
      const files = await readdir(this.embeddingsPath).catch(() => []);
      
      if (files.length === 0) {
        this.logger.debug('No embedding files found');
        return { embeddings: [], metadata: [] };
      }

      // Load all embedding files
      const embeddingFiles = files.filter(f => f.startsWith('embeddings-') && f.endsWith('.json'));
      const metadataFiles = files.filter(f => f.startsWith('metadata-') && f.endsWith('.json'));

      const [embeddingResults, metadataResults] = await Promise.all([
        Promise.all(embeddingFiles.map(async (file) => {
          const content = await readFile(join(this.embeddingsPath, file), 'utf-8');
          return JSON.parse(content) as StoredEmbedding[];
        })),
        Promise.all(metadataFiles.map(async (file) => {
          const content = await readFile(join(this.embeddingsPath, file), 'utf-8');
          return JSON.parse(content) as EmbeddingMetadata;
        }))
      ]);

      // Flatten results
      const allEmbeddings = embeddingResults.flat();
      const allMetadata = metadataResults;

      this.logger.debug('Loaded embeddings from storage', {
        embeddingCount: allEmbeddings.length,
        metadataCount: allMetadata.length
      });

      return { embeddings: allEmbeddings, metadata: allMetadata };

    } catch (error: any) {
      throw new DatabaseError(
        `Failed to load embeddings: ${error.message}`,
        { operation: 'load_embeddings', path: this.embeddingsPath, error: error.message }
      );
    }
  }

  /**
   * Check if embeddings exist for given node IDs
   */
  async getExistingEmbeddings(nodeIds: string[]): Promise<Record<string, StoredEmbedding>> {
    const { embeddings } = await this.loadEmbeddings();
    
    const existing: Record<string, StoredEmbedding> = {};
    
    for (const embedding of embeddings) {
      if (nodeIds.includes(embedding.nodeId)) {
        existing[embedding.nodeId] = embedding;
      }
    }
    
    return existing;
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    totalEmbeddings: number;
    uniqueModels: number;
    averageDimensions: number;
    dateRange: { oldest: string; newest: string } | null;
    storageFiles: number;
  }> {
    const { embeddings, metadata } = await this.loadEmbeddings();
    
    if (embeddings.length === 0) {
      return {
        totalEmbeddings: 0,
        uniqueModels: 0,
        averageDimensions: 0,
        dateRange: null,
        storageFiles: 0
      };
    }

    // Calculate statistics
    const uniqueModels = new Set(metadata.map(m => m.model)).size;
    const averageDimensions = metadata.length > 0 
      ? metadata.reduce((sum, m) => sum + m.dimensions, 0) / metadata.length 
      : 0;
    
    const dates = metadata.map(m => m.createdAt).sort();
    const dateRange = dates.length > 0 
      ? { oldest: dates[0]!, newest: dates[dates.length - 1]! }
      : null;

    return {
      totalEmbeddings: embeddings.length,
      uniqueModels,
      averageDimensions: Math.round(averageDimensions),
      dateRange,
      storageFiles: metadata.length
    };
  }

  /**
   * Clean up old embedding files
   */
  async cleanup(keepLatest = 10): Promise<void> {
    await this.initialize();

    try {
      const files = await readdir(this.embeddingsPath).catch(() => []);
      const metadataFiles = files
        .filter(f => f.startsWith('metadata-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Newest first

      if (metadataFiles.length <= keepLatest) {
        this.logger.debug('No cleanup needed', { 
          totalFiles: metadataFiles.length, 
          keepLatest 
        });
        return;
      }

      const filesToDelete = metadataFiles.slice(keepLatest);
      
      // Delete old files and their corresponding embedding files
      for (const metadataFile of filesToDelete) {
        const timestamp = metadataFile.replace('metadata-', '').replace('.json', '');
        const embeddingFile = `embeddings-${timestamp}.json`;
        
        try {
          await Promise.all([
            access(join(this.embeddingsPath, metadataFile), constants.F_OK)
              .then(() => writeFile(join(this.embeddingsPath, metadataFile), ''))
              .catch(() => {}),
            access(join(this.embeddingsPath, embeddingFile), constants.F_OK)
              .then(() => writeFile(join(this.embeddingsPath, embeddingFile), ''))
              .catch(() => {})
          ]);
        } catch (error: any) {
          this.logger.warn('Failed to delete old embedding file', { 
            file: metadataFile, 
            error: error.message 
          });
        }
      }

      this.logger.info('🧹 Cleaned up old embeddings', { 
        deleted: filesToDelete.length, 
        kept: keepLatest 
      });

    } catch (error: any) {
      throw new DatabaseError(
        `Failed to cleanup embeddings: ${error.message}`,
        { operation: 'cleanup_embeddings', path: this.embeddingsPath, error: error.message }
      );
    }
  }
}