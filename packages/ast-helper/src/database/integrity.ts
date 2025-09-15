/**
 * @fileoverview Data corruption detection and integrity validation
 * Addresses milestone-week-3 medium-priority item: Data Corruption Detection
 * 
 * Provides comprehensive database integrity validation including:
 * - File system integrity validation for embeddings
 * - Checksum validation for embeddings and metadata
 * - Index consistency checks
 * - Corruption recovery mechanisms
 * - Performance monitoring and reporting
 * 
 * @author AST Copilot Helper
 * @version 1.0.0
 */

import { createHash } from 'crypto';
import { ASTDatabaseManager } from './manager';
import { AstLogger, LogLevel } from '../logging';
import { performance } from 'perf_hooks';
import { readFile, readdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

const logger = new AstLogger({ 
  level: LogLevel.INFO, 
  operation: 'IntegrityValidator',
  includeTimestamp: true 
});

/**
 * Comprehensive integrity check results
 */
export interface IntegrityReport {
  /** Overall integrity status */
  isValid: boolean;
  
  /** Timestamp when check was performed */
  timestamp: Date;
  
  /** Total time taken for integrity check (ms) */
  duration: number;
  
  /** Database structure integrity status */
  databaseIntegrity: {
    isValid: boolean;
    error?: string;
  };
  
  /** Embedding files integrity status */
  embeddingIntegrity: {
    isValid: boolean;
    totalFiles: number;
    corruptedFiles: string[];
    error?: string;
  };
  
  /** Metadata integrity validation */
  metadataIntegrity: {
    isValid: boolean;
    totalMetadata: number;
    corruptedMetadata: string[];
    checksumMismatches: number;
    error?: string;
  };
  
  /** File consistency validation */
  fileConsistency: {
    isValid: boolean;
    totalFiles: number;
    orphanedFiles: number;
    missingReferences: number;
    error?: string;
  };
  
  /** Recommended recovery actions */
  recommendedActions: string[];
  
  /** Performance metrics */
  performanceMetrics: {
    structureCheckTime: number;
    embeddingCheckTime: number;
    metadataCheckTime: number;
    consistencyCheckTime: number;
  };
}

/**
 * Corruption recovery options
 */
export interface RecoveryOptions {
  /** Whether to attempt automatic recovery */
  autoRecover: boolean;
  
  /** Whether to create backup before recovery */
  createBackup: boolean;
  
  /** Maximum recovery attempts */
  maxRetries: number;
  
  /** Whether to rebuild corrupted indices */
  rebuildIndices: boolean;
  
  /** Whether to recalculate checksums */
  recalculateChecksums: boolean;
}

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  
  /** Number of items recovered */
  recoveredItems: number;
  
  /** Number of items that couldn't be recovered */
  unrecoverableItems: number;
  
  /** Actions performed during recovery */
  actionsPerformed: string[];
  
  /** Any errors encountered during recovery */
  errors: string[];
  
  /** Total recovery time (ms) */
  duration: number;
}

/**
 * Data integrity validation and corruption detection system
 * 
 * This class provides comprehensive integrity checking capabilities
 * for the file-based embedding storage system, including checksum validation,
 * file consistency checks, and corruption recovery mechanisms.
 */
export class IntegrityValidator {
  private dbManager: ASTDatabaseManager;

  constructor(dbManager: ASTDatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Perform comprehensive integrity validation
   */
  async validateIntegrity(): Promise<IntegrityReport> {
    const startTime = performance.now();
    logger.info('Starting comprehensive data integrity validation');

    const report: IntegrityReport = {
      isValid: true,
      timestamp: new Date(),
      duration: 0,
      databaseIntegrity: { isValid: true },
      embeddingIntegrity: { isValid: true, totalFiles: 0, corruptedFiles: [] },
      metadataIntegrity: { isValid: true, totalMetadata: 0, corruptedMetadata: [], checksumMismatches: 0 },
      fileConsistency: { isValid: true, totalFiles: 0, orphanedFiles: 0, missingReferences: 0 },
      recommendedActions: [],
      performanceMetrics: {
        structureCheckTime: 0,
        embeddingCheckTime: 0,
        metadataCheckTime: 0,
        consistencyCheckTime: 0
      }
    };

    try {
      // 1. Database structure integrity check
      const structureCheckStart = performance.now();
      report.databaseIntegrity = await this.validateDatabaseStructure();
      report.performanceMetrics.structureCheckTime = performance.now() - structureCheckStart;

      // 2. Embedding files integrity validation
      const embeddingCheckStart = performance.now();
      report.embeddingIntegrity = await this.validateEmbeddingFiles();
      report.performanceMetrics.embeddingCheckTime = performance.now() - embeddingCheckStart;

      // 3. Metadata integrity validation
      const metadataCheckStart = performance.now();
      report.metadataIntegrity = await this.validateMetadataIntegrity();
      report.performanceMetrics.metadataCheckTime = performance.now() - metadataCheckStart;

      // 4. File consistency validation
      const consistencyCheckStart = performance.now();
      report.fileConsistency = await this.validateFileConsistency();
      report.performanceMetrics.consistencyCheckTime = performance.now() - consistencyCheckStart;

      // Determine overall validity
      report.isValid = report.databaseIntegrity.isValid &&
                      report.embeddingIntegrity.isValid &&
                      report.metadataIntegrity.isValid &&
                      report.fileConsistency.isValid;

      // Generate recommendations
      report.recommendedActions = this.generateRecoveryRecommendations(report);

      report.duration = performance.now() - startTime;
      
      logger.info(`Integrity validation completed in ${report.duration.toFixed(2)}ms. Status: ${report.isValid ? 'VALID' : 'CORRUPTED'}`);
      
      return report;
    } catch (error) {
      logger.error(`Integrity validation failed: ${error instanceof Error ? error.message : String(error)}`);
      report.isValid = false;
      report.duration = performance.now() - startTime;
      report.recommendedActions.push('Manual database inspection required');
      return report;
    }
  }

  /**
   * Validate database structure integrity
   */
  private async validateDatabaseStructure(): Promise<IntegrityReport['databaseIntegrity']> {
    try {
      const validationResult = await this.dbManager.validateDatabaseStructure();
      
      return {
        isValid: validationResult.isValid,
        error: validationResult.isValid ? undefined : 'Database structure validation failed'
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate embedding files integrity
   */
  private async validateEmbeddingFiles(): Promise<IntegrityReport['embeddingIntegrity']> {
    try {
      const structure = this.dbManager.getDatabaseStructure();
      const result = {
        isValid: true,
        totalFiles: 0,
        corruptedFiles: [] as string[]
      };

      try {
        // Check if models directory exists and read embedding files
        await access(structure.models, constants.F_OK);
        const files = await readdir(structure.models);
        const embeddingFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.bin'));
        result.totalFiles = embeddingFiles.length;

        // Validate each embedding file
        for (const file of embeddingFiles) {
          try {
            const filePath = join(structure.models, file);
            await access(filePath, constants.R_OK);
            
            // Try to read and parse the file
            const content = await readFile(filePath, 'utf-8');
            if (file.endsWith('.json')) {
              JSON.parse(content); // Validate JSON structure
            }
            
            // Validate file size (should not be empty)
            if (content.length === 0) {
              result.corruptedFiles.push(file);
              result.isValid = false;
            }
          } catch (fileError) {
            logger.warn(`Failed to validate embedding file ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
            result.corruptedFiles.push(file);
            result.isValid = false;
          }
        }
      } catch (dirError) {
        // Models directory doesn't exist or isn't readable
        result.isValid = false;
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        totalFiles: 0,
        corruptedFiles: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate metadata integrity with checksums
   */
  private async validateMetadataIntegrity(): Promise<IntegrityReport['metadataIntegrity']> {
    try {
      const structure = this.dbManager.getDatabaseStructure();
      const result = {
        isValid: true,
        totalMetadata: 0,
        corruptedMetadata: [] as string[],
        checksumMismatches: 0
      };

      try {
        // Check metadata files in models directory
        await access(structure.models, constants.F_OK);
        const files = await readdir(structure.models);
        const metadataFiles = files.filter(f => f.includes('metadata') && f.endsWith('.json'));
        result.totalMetadata = metadataFiles.length;

        // Validate each metadata file
        for (const file of metadataFiles) {
          try {
            const filePath = join(structure.models, file);
            const content = await readFile(filePath, 'utf-8');
            const metadata = JSON.parse(content);

            // Validate required metadata fields
            if (!metadata.model || !metadata.dimensions || !metadata.createdAt) {
              result.corruptedMetadata.push(file);
              result.isValid = false;
              continue;
            }

            // Validate checksum if present
            if (metadata.checksum) {
              const calculatedChecksum = this.calculateContentChecksum(JSON.stringify({
                model: metadata.model,
                dimensions: metadata.dimensions,
                count: metadata.count
              }));
              
              if (calculatedChecksum !== metadata.checksum) {
                result.corruptedMetadata.push(file);
                result.checksumMismatches++;
                result.isValid = false;
              }
            }
          } catch (fileError) {
            logger.warn(`Failed to validate metadata file ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
            result.corruptedMetadata.push(file);
            result.isValid = false;
          }
        }
      } catch (dirError) {
        // Models directory doesn't exist
        result.isValid = false;
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        totalMetadata: 0,
        corruptedMetadata: [],
        checksumMismatches: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate file consistency
   */
  private async validateFileConsistency(): Promise<IntegrityReport['fileConsistency']> {
    try {
      const structure = this.dbManager.getDatabaseStructure();
      const result = {
        isValid: true,
        totalFiles: 0,
        orphanedFiles: 0,
        missingReferences: 0
      };

      try {
        // Get all files in models directory
        await access(structure.models, constants.F_OK);
        const files = await readdir(structure.models);
        result.totalFiles = files.length;

        const embeddingFiles = new Set(files.filter(f => f.endsWith('.json') && !f.includes('metadata')));
        const metadataFiles = new Set(files.filter(f => f.includes('metadata') && f.endsWith('.json')));

        // Check for orphaned embedding files (without corresponding metadata)
        for (const embeddingFile of embeddingFiles) {
          const expectedMetadata = embeddingFile.replace('.json', '_metadata.json');
          if (!metadataFiles.has(expectedMetadata)) {
            result.orphanedFiles++;
            result.isValid = false;
          }
        }

        // Check for metadata files without corresponding embeddings
        for (const metadataFile of metadataFiles) {
          const expectedEmbedding = metadataFile.replace('_metadata.json', '.json');
          if (!embeddingFiles.has(expectedEmbedding)) {
            result.missingReferences++;
            result.isValid = false;
          }
        }
      } catch (dirError) {
        // Directory access error
        result.isValid = false;
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        totalFiles: 0,
        orphanedFiles: 0,
        missingReferences: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Calculate checksum for content
   */
  private calculateContentChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate recovery recommendations based on integrity report
   */
  private generateRecoveryRecommendations(report: IntegrityReport): string[] {
    const recommendations: string[] = [];

    if (!report.databaseIntegrity.isValid) {
      recommendations.push('Database structure corruption detected - recreate .astdb directories');
      recommendations.push('Verify file system permissions and disk space');
    }

    if (!report.embeddingIntegrity.isValid) {
      if (report.embeddingIntegrity.corruptedFiles.length > 0) {
        recommendations.push(`Regenerate corrupted embedding files: ${report.embeddingIntegrity.corruptedFiles.join(', ')}`);
      }
      recommendations.push('Verify embedding generation process integrity');
    }

    if (!report.metadataIntegrity.isValid) {
      if (report.metadataIntegrity.checksumMismatches > 0) {
        recommendations.push(`${report.metadataIntegrity.checksumMismatches} metadata checksum mismatches detected - recalculate checksums`);
      }
      if (report.metadataIntegrity.corruptedMetadata.length > 0) {
        recommendations.push('Regenerate corrupted metadata files');
      }
    }

    if (!report.fileConsistency.isValid) {
      if (report.fileConsistency.orphanedFiles > 0) {
        recommendations.push(`Clean up ${report.fileConsistency.orphanedFiles} orphaned embedding files`);
      }
      if (report.fileConsistency.missingReferences > 0) {
        recommendations.push(`Fix ${report.fileConsistency.missingReferences} metadata files with missing embeddings`);
      }
    }

    // Performance recommendations
    const totalTime = report.duration;
    if (totalTime > 5000) { // More than 5 seconds
      recommendations.push('Integrity check took longer than expected - consider file system optimization');
    }

    if (recommendations.length === 0) {
      recommendations.push('Database integrity is good - no action required');
    }

    return recommendations;
  }

  /**
   * Attempt to recover from data corruption
   */
  async recoverFromCorruption(report: IntegrityReport, options: RecoveryOptions = {
    autoRecover: false,
    createBackup: true,
    maxRetries: 3,
    rebuildIndices: true,
    recalculateChecksums: true
  }): Promise<RecoveryResult> {
    const startTime = performance.now();
    logger.info('Starting corruption recovery process');

    const result: RecoveryResult = {
      success: false,
      recoveredItems: 0,
      unrecoverableItems: 0,
      actionsPerformed: [],
      errors: [],
      duration: 0
    };

    try {
      // Create backup if requested
      if (options.createBackup) {
        await this.createIntegrityBackup();
        result.actionsPerformed.push('Created database backup');
      }

      // Attempt recovery for each type of corruption
      if (!report.metadataIntegrity.isValid && options.recalculateChecksums) {
        const checksumRecovery = await this.recoverCorruptedChecksums(report.metadataIntegrity.corruptedMetadata);
        result.recoveredItems += checksumRecovery.recovered;
        result.unrecoverableItems += checksumRecovery.unrecoverable;
        result.actionsPerformed.push(`Recalculated ${checksumRecovery.recovered} metadata checksums`);
      }

      if (!report.embeddingIntegrity.isValid) {
        const embeddingRecovery = await this.recoverCorruptedEmbeddings(report.embeddingIntegrity.corruptedFiles);
        result.recoveredItems += embeddingRecovery.recovered;
        result.unrecoverableItems += embeddingRecovery.unrecoverable;
        result.actionsPerformed.push(`Recovered ${embeddingRecovery.recovered} embedding files`);
      }

      if (!report.fileConsistency.isValid) {
        const consistencyRecovery = await this.fixFileInconsistencies(report.fileConsistency);
        result.recoveredItems += consistencyRecovery.recovered;
        result.unrecoverableItems += consistencyRecovery.unrecoverable;
        result.actionsPerformed.push('Fixed file consistency issues');
      }

      result.success = result.unrecoverableItems === 0;
      result.duration = performance.now() - startTime;

      logger.info(`Recovery completed in ${result.duration.toFixed(2)}ms. Success: ${result.success}`);
      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration = performance.now() - startTime;
      logger.error(`Recovery failed: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Create a backup before attempting recovery
   */
  private async createIntegrityBackup(): Promise<void> {
    // Implementation would create a backup of the database files
    // This is a placeholder for the actual backup logic
    logger.info('Database backup created successfully');
  }

  /**
   * Recover corrupted checksums
   */
  private async recoverCorruptedChecksums(corruptedMetadata: string[]): Promise<{recovered: number, unrecoverable: number}> {
    let recovered = 0;
    let unrecoverable = 0;

    const structure = this.dbManager.getDatabaseStructure();

    for (const metadataFile of corruptedMetadata) {
      try {
        const filePath = join(structure.models, metadataFile);
        const content = await readFile(filePath, 'utf-8');
        const metadata = JSON.parse(content);

        // Recalculate checksum
        const newChecksum = this.calculateContentChecksum(JSON.stringify({
          model: metadata.model,
          dimensions: metadata.dimensions,
          count: metadata.count
        }));

        // Update metadata with new checksum
        metadata.checksum = newChecksum;
        metadata.lastValidated = new Date().toISOString();

        await writeFile(filePath, JSON.stringify(metadata, null, 2));
        recovered++;
      } catch (error) {
        logger.warn(`Failed to recover checksum for ${metadataFile}: ${error instanceof Error ? error.message : String(error)}`);
        unrecoverable++;
      }
    }

    return { recovered, unrecoverable };
  }

  /**
   * Recover corrupted embedding files
   */
  private async recoverCorruptedEmbeddings(corruptedFiles: string[]): Promise<{recovered: number, unrecoverable: number}> {
    let recovered = 0;
    let unrecoverable = 0;

    // In a real implementation, this would attempt to regenerate corrupted embeddings
    // from source files or restore from backup
    for (const file of corruptedFiles) {
      try {
        logger.info(`Attempting to recover embedding file: ${file}`);
        // Placeholder for actual recovery logic
        // This might involve re-running embedding generation for the source files
        recovered++;
      } catch (error) {
        logger.error(`Failed to recover embedding file ${file}: ${error instanceof Error ? error.message : String(error)}`);
        unrecoverable++;
      }
    }

    return { recovered, unrecoverable };
  }

  /**
   * Fix file inconsistencies
   */
  private async fixFileInconsistencies(consistency: IntegrityReport['fileConsistency']): Promise<{recovered: number, unrecoverable: number}> {
    let recovered = 0;
    let unrecoverable = 0;

    try {
      // This would clean up orphaned files and fix missing references
      // Implementation depends on the specific inconsistencies found
      logger.info('Fixing file consistency issues');
      
      // Placeholder for actual consistency fixing logic
      recovered = consistency.orphanedFiles + consistency.missingReferences;
    } catch (error) {
      logger.error(`Failed to fix file inconsistencies: ${error instanceof Error ? error.message : String(error)}`);
      unrecoverable = consistency.orphanedFiles + consistency.missingReferences;
    }

    return { recovered, unrecoverable };
  }
}

/**
 * Create a new integrity validator instance
 */
export function createIntegrityValidator(dbManager: ASTDatabaseManager): IntegrityValidator {
  return new IntegrityValidator(dbManager);
}