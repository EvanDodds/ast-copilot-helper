/**
 * Model metadata management utilities
 * Handles metadata storage, retrieval, and synchronization
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { ModelConfig, ModelMetadata, ModelUsageStats, ModelUsageAnalytics, SystemUsageAnalytics } from './types.js';
import { createModuleLogger } from '../logging/index.js';

const logger = createModuleLogger('ModelMetadata');

/**
 * Metadata query options
 */
export interface MetadataQuery {
  /** Filter by model name */
  name?: string;
  /** Filter by version */
  version?: string;
  /** Filter by format */
  format?: string;
  /** Only include verified models */
  verifiedOnly?: boolean;
  /** Minimum usage count */
  minUsage?: number;
  /** Maximum age in days */
  maxAge?: number;
}

/**
 * Metadata manager for model information
 * Addresses acceptance criteria:
 * - ✅ Metadata storage and retrieval
 * - ✅ Version management
 * - ✅ Usage tracking
 * - ✅ Metadata synchronization
 */
export class MetadataManager {
  private baseDir: string;
  private metadataDir: string;
  private indexFile: string;

  constructor(baseDir: string = '.astdb/models') {
    this.baseDir = baseDir;
    this.metadataDir = join(baseDir, 'metadata');
    this.indexFile = join(this.metadataDir, 'index.json');
  }

  /**
   * Initialize metadata storage structure
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.metadataDir, { recursive: true });
      
      // Create index file if it doesn't exist
      try {
        await fs.access(this.indexFile);
      } catch {
        const initialIndex = {
          version: '1.0.0',
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          models: []
        };
        await fs.writeFile(this.indexFile, JSON.stringify(initialIndex, null, 2));
      }

      logger.info(`Metadata manager initialized: ${this.metadataDir}`);
    } catch (error) {
      logger.error(`Failed to initialize metadata manager: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Store model metadata
   * Addresses acceptance criteria:
   * - ✅ Metadata persistence
   */
  async storeMetadata(modelConfig: ModelConfig, metadata: ModelMetadata): Promise<void> {
    try {
      await this.initialize();

      const metadataPath = this.getMetadataPath(modelConfig);
      
      // Store individual metadata file
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Update index
      await this.updateIndex(modelConfig, 'add');
      
      logger.debug(`Stored metadata for ${modelConfig.name} v${modelConfig.version}`);
    } catch (error) {
      logger.error(`Failed to store metadata for ${modelConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Retrieve model metadata
   * Addresses acceptance criteria:
   * - ✅ Metadata retrieval
   */
  async getMetadata(modelConfig: ModelConfig): Promise<ModelMetadata | null> {
    try {
      const metadataPath = this.getMetadataPath(modelConfig);
      const data = await fs.readFile(metadataPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Convert date strings back to Date objects
      if (parsed.downloadedAt) {
        parsed.downloadedAt = new Date(parsed.downloadedAt);
      }
      if (parsed.lastVerified) {
        parsed.lastVerified = new Date(parsed.lastVerified);
      }
      if (parsed.usageStats?.lastUsed) {
        parsed.usageStats.lastUsed = new Date(parsed.usageStats.lastUsed);
      }
      if (parsed.usageStats?.firstUsed) {
        parsed.usageStats.firstUsed = new Date(parsed.usageStats.firstUsed);
      }
      
      return parsed;
    } catch (error) {
      logger.debug(`Metadata not found for ${modelConfig.name} v${modelConfig.version}`);
      return null;
    }
  }

  /**
   * Query metadata with filters
   * Addresses acceptance criteria:
   * - ✅ Metadata querying and filtering
   */
  async queryMetadata(query: MetadataQuery = {}): Promise<ModelMetadata[]> {
    try {
      const index = await this.loadIndex();
      const results: ModelMetadata[] = [];

      for (const modelInfo of index.models) {
        // Apply filters
        if (query.name && !modelInfo.name.includes(query.name)) continue;
        if (query.version && modelInfo.version !== query.version) continue;
        if (query.format && modelInfo.format !== query.format) continue;

        // Load full metadata
        const mockConfig: ModelConfig = {
          name: modelInfo.name,
          version: modelInfo.version,
          url: '',
          checksum: '',
          size: 0,
          format: modelInfo.format as any,
          dimensions: 0
        };

        const metadata = await this.getMetadata(mockConfig);
        if (!metadata) continue;

        // Apply additional filters
        if (query.verifiedOnly && !metadata.verified) continue;
        if (query.minUsage && (!metadata.usageStats || metadata.usageStats.loadCount < query.minUsage)) continue;
        if (query.maxAge) {
          const ageInDays = (Date.now() - new Date(metadata.downloadedAt).getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays > query.maxAge) continue;
        }

        results.push(metadata);
      }

      return results;
    } catch (error) {
      logger.error(`Failed to query metadata: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * List all available models
   * Addresses acceptance criteria:
   * - ✅ Model discovery
   */
  async listModels(): Promise<Array<{ name: string; version: string; format: string; verified: boolean; downloadedAt: Date }>> {
    try {
      const index = await this.loadIndex();
      const models = [];

      for (const modelInfo of index.models) {
        const mockConfig: ModelConfig = {
          name: modelInfo.name,
          version: modelInfo.version,
          url: '',
          checksum: '',
          size: 0,
          format: modelInfo.format as any,
          dimensions: 0
        };

        const metadata = await this.getMetadata(mockConfig);
        if (metadata) {
          models.push({
            name: modelInfo.name,
            version: modelInfo.version,
            format: modelInfo.format,
            verified: metadata.verified,
            downloadedAt: metadata.downloadedAt
          });
        }
      }

      return models;
    } catch (error) {
      logger.error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Update metadata for a model
   * Addresses acceptance criteria:
   * - ✅ Metadata updates
   */
  async updateMetadata(modelConfig: ModelConfig, updates: Partial<ModelMetadata>): Promise<boolean> {
    try {
      const existing = await this.getMetadata(modelConfig);
      if (!existing) {
        logger.warn(`Cannot update metadata for non-existent model: ${modelConfig.name} v${modelConfig.version}`);
        return false;
      }

      const updated = { ...existing, ...updates };
      await this.storeMetadata(modelConfig, updated);
      
      logger.debug(`Updated metadata for ${modelConfig.name} v${modelConfig.version}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update metadata for ${modelConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Remove metadata for a model
   * Addresses acceptance criteria:
   * - ✅ Metadata cleanup
   */
  async removeMetadata(modelConfig: ModelConfig): Promise<boolean> {
    try {
      const metadataPath = this.getMetadataPath(modelConfig);
      
      // Remove metadata file
      await fs.unlink(metadataPath);
      
      // Update index
      await this.updateIndex(modelConfig, 'remove');
      
      logger.debug(`Removed metadata for ${modelConfig.name} v${modelConfig.version}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove metadata for ${modelConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Synchronize metadata with actual files
   * Addresses acceptance criteria:
   * - ✅ Metadata consistency
   */
  async synchronize(): Promise<{ added: number; removed: number; updated: number }> {
    try {
      const modelsDir = join(this.baseDir, 'models');
      const stats = { added: 0, removed: 0, updated: 0 };

      // Check for orphaned metadata (metadata without files)
      const index = await this.loadIndex();
      for (const modelInfo of index.models) {
        const modelFileName = `${modelInfo.name}-${modelInfo.version}.${modelInfo.format}`;
        const modelPath = join(modelsDir, modelFileName);
        
        try {
          await fs.access(modelPath);
        } catch {
          // Model file doesn't exist, remove metadata
          const mockConfig: ModelConfig = {
            name: modelInfo.name,
            version: modelInfo.version,
            url: '',
            checksum: '',
            size: 0,
            format: modelInfo.format as any,
            dimensions: 0
          };
          
          await this.removeMetadata(mockConfig);
          stats.removed++;
        }
      }

      // Check for files without metadata
      try {
        const files = await fs.readdir(modelsDir);
        for (const file of files) {
          if (!file.endsWith('.onnx') && !file.endsWith('.json')) continue;
          
          // Parse filename to extract model info
          const parts = file.split('-');
          if (parts.length < 2) continue;
          
          const name = parts.slice(0, -1).join('-');
          const versionAndFormat = parts[parts.length - 1];
          if (!versionAndFormat) continue;
          
          const lastDotIndex = versionAndFormat.lastIndexOf('.');
          if (lastDotIndex === -1) continue;
          
          const version = versionAndFormat.substring(0, lastDotIndex);
          const format = versionAndFormat.substring(lastDotIndex + 1);
          
          const mockConfig: ModelConfig = {
            name,
            version,
            url: '',
            checksum: '',
            size: 0,
            format: format as any,
            dimensions: 0
          };
          
          const metadata = await this.getMetadata(mockConfig);
          if (!metadata) {
            // Create basic metadata for orphaned file
            const filePath = join(modelsDir, file);
            const fileStats = await fs.stat(filePath);
            
            const basicMetadata: ModelMetadata = {
              config: mockConfig,
              downloadedAt: fileStats.mtime,
              lastVerified: new Date(),
              downloadDuration: 0,
              verified: false,
              usageStats: this.createInitialUsageStats()
            };
            
            await this.storeMetadata(mockConfig, basicMetadata);
            stats.added++;
          }
        }
      } catch (error) {
        logger.warn(`Could not scan models directory: ${error instanceof Error ? error.message : String(error)}`);
      }

      logger.info(`Metadata synchronization complete: ${stats.added} added, ${stats.removed} removed, ${stats.updated} updated`);
      return stats;
    } catch (error) {
      logger.error(`Failed to synchronize metadata: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get metadata statistics
   * Addresses acceptance criteria:
   * - ✅ Metadata reporting
   */
  async getStats(): Promise<{
    totalModels: number;
    verifiedModels: number;
    formats: Record<string, number>;
    totalUsage: number;
    oldestModel: Date | null;
    newestModel: Date | null;
  }> {
    try {
      const allMetadata = await this.queryMetadata();
      
      const stats = {
        totalModels: allMetadata.length,
        verifiedModels: allMetadata.filter(m => m.verified).length,
        formats: {} as Record<string, number>,
        totalUsage: 0,
        oldestModel: null as Date | null,
        newestModel: null as Date | null
      };

      for (const metadata of allMetadata) {
        // Count formats
        const format = metadata.config.format;
        stats.formats[format] = (stats.formats[format] || 0) + 1;
        
        // Sum usage
        if (metadata.usageStats) {
          stats.totalUsage += metadata.usageStats.loadCount;
        }
        
        // Track dates
        const downloadDate = new Date(metadata.downloadedAt);
        if (!stats.oldestModel || downloadDate < stats.oldestModel) {
          stats.oldestModel = downloadDate;
        }
        if (!stats.newestModel || downloadDate > stats.newestModel) {
          stats.newestModel = downloadDate;
        }
      }

      return stats;
    } catch (error) {
      logger.error(`Failed to get metadata stats: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Record model usage for analytics
   * Addresses acceptance criteria:
   * - ✅ Usage tracking and analytics
   */
  async recordModelUsage(
    modelConfig: ModelConfig,
    usageData: {
      processingTime: number;
      memoryUsage: number;
      itemsProcessed: number;
      success: boolean;
      errorMessage?: string;
      cacheHitRate?: number;
    }
  ): Promise<void> {
    try {
      let metadata = await this.getMetadata(modelConfig);
      if (!metadata) {
        logger.warn(`No metadata found for ${modelConfig.name}, creating basic entry`);
        metadata = {
          config: modelConfig,
          downloadedAt: new Date(),
          lastVerified: new Date(),
          downloadDuration: 0,
          verified: false,
          usageStats: this.createInitialUsageStats()
        };
      }

      const now = new Date();
      const stats = metadata.usageStats || this.createInitialUsageStats();

      // Update basic usage counters
      stats.loadCount += 1;
      stats.lastUsed = now;
      if (!stats.firstUsed) stats.firstUsed = now;

      // Update processing statistics
      stats.totalProcessingTime += usageData.processingTime;
      stats.embeddingRequests += usageData.itemsProcessed;
      stats.averageProcessingTime = stats.totalProcessingTime / stats.loadCount;

      // Update memory tracking
      if (usageData.memoryUsage > stats.peakMemoryUsage) {
        stats.peakMemoryUsage = usageData.memoryUsage;
      }

      // Update error tracking and success rate
      if (!usageData.success) {
        stats.errorCount += 1;
      }
      const totalRequests = stats.loadCount;
      const successfulRequests = totalRequests - stats.errorCount;
      stats.successRate = (successfulRequests / totalRequests) * 100;

      // Add performance history entry
      const performanceEntry = {
        timestamp: now,
        processingTime: usageData.processingTime,
        memoryUsage: usageData.memoryUsage,
        itemsProcessed: usageData.itemsProcessed,
        success: usageData.success,
        errorMessage: usageData.errorMessage,
        cacheHitRate: usageData.cacheHitRate
      };
      
      stats.performanceHistory.push(performanceEntry);
      
      // Keep only last 100 performance entries to prevent unbounded growth
      if (stats.performanceHistory.length > 100) {
        stats.performanceHistory = stats.performanceHistory.slice(-100);
      }

      // Update usage patterns
      const hour = now.getHours();
      const dayOfWeek = now.getDay();
      stats.hourlyUsage[hour] = (stats.hourlyUsage[hour] || 0) + 1;
      stats.weeklyUsage[dayOfWeek] = (stats.weeklyUsage[dayOfWeek] || 0) + 1;

      // Update cache hit rate if provided
      if (usageData.cacheHitRate !== undefined) {
        stats.cacheHitRate = stats.cacheHitRate 
          ? (stats.cacheHitRate + usageData.cacheHitRate) / 2 
          : usageData.cacheHitRate;
      }

      metadata.usageStats = stats;
      await this.storeMetadata(modelConfig, metadata);

      logger.debug(`Recorded usage for ${modelConfig.name}: ${usageData.itemsProcessed} items, ${usageData.processingTime}ms`);
    } catch (error) {
      logger.error(`Failed to record usage for ${modelConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get usage analytics report for a model
   */
  async getUsageAnalytics(modelConfig: ModelConfig): Promise<ModelUsageAnalytics | null> {
    try {
      const metadata = await this.getMetadata(modelConfig);
      if (!metadata?.usageStats) {
        return null;
      }

      const stats = metadata.usageStats;
      const now = Date.now();
      
      // Ensure dates are properly converted from strings if needed
      const firstUsedDate = stats.firstUsed instanceof Date 
        ? stats.firstUsed 
        : new Date(stats.firstUsed);
        
      const daysSinceFirstUse = stats.firstUsed 
        ? Math.floor((now - firstUsedDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        modelName: modelConfig.name,
        modelVersion: modelConfig.version,
        totalUsage: stats.loadCount,
        totalProcessingTime: stats.totalProcessingTime,
        averageProcessingTime: stats.averageProcessingTime,
        peakMemoryUsage: stats.peakMemoryUsage,
        successRate: stats.successRate,
        errorCount: stats.errorCount,
        daysSinceFirstUse,
        recentPerformance: stats.performanceHistory.slice(-10), // Last 10 entries
        usageByHour: stats.hourlyUsage,
        usageByDay: stats.weeklyUsage,
        cacheEfficiency: stats.cacheHitRate,
        recommendedOptimizations: this.generateOptimizationRecommendations(stats)
      };
    } catch (error) {
      logger.error(`Failed to get usage analytics for ${modelConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get system-wide usage analytics
   */
  async getSystemUsageAnalytics(): Promise<SystemUsageAnalytics> {
    try {
      const allMetadata = await this.queryMetadata();
      const analytics: SystemUsageAnalytics = {
        totalModels: allMetadata.length,
        totalUsage: 0,
        averageSuccessRate: 0,
        totalProcessingTime: 0,
        topPerformingModels: [],
        recommendedActions: []
      };

      let totalSuccessRate = 0;
      const modelPerformance: Array<{ name: string; version: string; score: number }> = [];

      for (const metadata of allMetadata) {
        if (metadata.usageStats) {
          const stats = metadata.usageStats;
          analytics.totalUsage += stats.loadCount;
          analytics.totalProcessingTime += stats.totalProcessingTime;
          totalSuccessRate += stats.successRate;

          // Calculate performance score (higher is better)
          const score = (stats.successRate * 0.4) + 
                       (Math.max(0, 100 - stats.averageProcessingTime) * 0.3) + 
                       (Math.max(0, 100 - stats.errorCount) * 0.3);
          
          modelPerformance.push({
            name: metadata.config.name,
            version: metadata.config.version,
            score
          });
        }
      }

      analytics.averageSuccessRate = allMetadata.length > 0 ? totalSuccessRate / allMetadata.length : 0;
      analytics.topPerformingModels = modelPerformance
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Generate system-level recommendations
      if (analytics.averageSuccessRate < 90) {
        analytics.recommendedActions.push('Consider model optimization - success rate below 90%');
      }
      
      const avgProcessingTime = analytics.totalUsage > 0 
        ? analytics.totalProcessingTime / analytics.totalUsage 
        : 0;
      
      if (avgProcessingTime > 1000) {
        analytics.recommendedActions.push('Performance optimization needed - average processing time > 1s');
      }

      return analytics;
    } catch (error) {
      logger.error(`Failed to get system usage analytics: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create initial usage statistics structure
   */
  private createInitialUsageStats(): ModelUsageStats {
    return {
      loadCount: 0,
      lastUsed: new Date(),
      firstUsed: new Date(),
      totalProcessingTime: 0,
      embeddingRequests: 0,
      averageProcessingTime: 0,
      peakMemoryUsage: 0,
      errorCount: 0,
      successRate: 100,
      performanceHistory: [],
      hourlyUsage: {},
      weeklyUsage: {},
      cacheHitRate: 0
    };
  }

  /**
   * Generate optimization recommendations based on usage patterns
   */
  private generateOptimizationRecommendations(stats: ModelUsageStats): string[] {
    const recommendations: string[] = [];

    if (stats.successRate < 95) {
      recommendations.push(`Success rate is ${stats.successRate.toFixed(1)}% - investigate error patterns`);
    }

    if (stats.averageProcessingTime > 500) {
      recommendations.push(`Average processing time ${stats.averageProcessingTime.toFixed(0)}ms is high - consider optimization`);
    }

    if (stats.errorCount > stats.loadCount * 0.1) {
      recommendations.push(`Error rate ${(stats.errorCount / stats.loadCount * 100).toFixed(1)}% is high - review error handling`);
    }

    const recentPerformance = stats.performanceHistory.slice(-10);
    if (recentPerformance.length >= 5) {
      const recentAverage = recentPerformance.reduce((sum: number, entry) => sum + entry.processingTime, 0) / recentPerformance.length;
      if (recentAverage > stats.averageProcessingTime * 1.5) {
        recommendations.push('Recent performance degradation detected - consider model refresh');
      }
    }

    if (stats.cacheHitRate !== undefined && stats.cacheHitRate < 50) {
      recommendations.push(`Cache hit rate ${stats.cacheHitRate.toFixed(1)}% is low - review caching strategy`);
    }

    return recommendations;
  }

  // Private helper methods

  private getMetadataPath(modelConfig: ModelConfig): string {
    const fileName = `${modelConfig.name}-${modelConfig.version}.json`;
    return join(this.metadataDir, fileName);
  }

  private async loadIndex(): Promise<any> {
    try {
      const data = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { version: '1.0.0', models: [] };
    }
  }

  private async updateIndex(modelConfig: ModelConfig, operation: 'add' | 'remove'): Promise<void> {
    try {
      const index = await this.loadIndex();
      
      const modelInfo = {
        name: modelConfig.name,
        version: modelConfig.version,
        format: modelConfig.format
      };
      
      if (operation === 'add') {
        // Remove existing entry if present
        index.models = index.models.filter((m: any) => 
          !(m.name === modelInfo.name && m.version === modelInfo.version)
        );
        
        // Add new entry
        index.models.push(modelInfo);
      } else {
        // Remove entry
        index.models = index.models.filter((m: any) => 
          !(m.name === modelInfo.name && m.version === modelInfo.version)
        );
      }
      
      index.lastUpdated = new Date().toISOString();
      
      await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      logger.warn(`Failed to update index: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Default metadata manager instance
 */
export const metadataManager = new MetadataManager();

/**
 * Convenience function for metadata storage
 */
export async function storeModelMetadata(modelConfig: ModelConfig, metadata: ModelMetadata): Promise<void> {
  return metadataManager.storeMetadata(modelConfig, metadata);
}

/**
 * Convenience function for metadata retrieval
 */
export async function getModelMetadata(modelConfig: ModelConfig): Promise<ModelMetadata | null> {
  return metadataManager.getMetadata(modelConfig);
}

/**
 * Convenience function for metadata querying
 */
export async function queryModelMetadata(query?: MetadataQuery): Promise<ModelMetadata[]> {
  return metadataManager.queryMetadata(query);
}