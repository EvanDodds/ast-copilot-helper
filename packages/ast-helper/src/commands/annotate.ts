/**
 * Annotation Command Implementation
 * 
 * Processes AST nodes and generates comprehensive annotations as specified in issue #10.
 * Implements batch processing, progress reporting, and atomic file operations.
 */

import { join, basename } from 'node:path';
import { readFile, readdir, access, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createLogger } from '../logging/index.js';
import { ASTDatabaseManager } from '../database/manager.js';
import { FileSystemManager } from '../filesystem/manager.js';
import type { ASTNode } from '../parser/ast-schema.js';
import type { AnnotationContext } from '../parser/annotation-generator.js';
import { AnnotationGenerator } from '../parser/annotation-generator.js';
import type { Annotation, AnnotationConfig } from '../parser/annotation-types.js';
import type { Config } from '../types.js';

/**
 * Options for the annotate command
 */
export interface AnnotateCommandOptions {
  changed?: boolean;
  force?: boolean;
  config?: string;
  workspace?: string;
  batchSize?: number;
  maxConcurrency?: number;
  dryRun?: boolean;
  outputStats?: boolean;
}

/**
 * Statistics for annotation processing
 */
export interface AnnotationStats {
  totalNodes: number;
  annotatedNodes: number;
  skippedNodes: number;
  errorNodes: number;
  processingTimeMs: number;
  averageTimePerNodeMs: number;
  memoryUsage: {
    peakMB: number;
    averageMB: number;
  };
  languageBreakdown: Record<string, number>;
  qualityBreakdown: {
    highQuality: number;
    mediumQuality: number;
    lowQuality: number;
  };
}

/**
 * Progress callback for annotation processing
 */
export type AnnotationProgressCallback = (
  completed: number,
  total: number,
  currentNode?: string
) => void;

/**
 * Annotation Command Handler
 * 
 * Processes parsed AST files and generates comprehensive annotations
 * following the requirements specified in issue #10.
 */
export class AnnotateCommandHandler {
  private logger = createLogger();
  private dbManager!: ASTDatabaseManager;
  private fsManager = new FileSystemManager();
  private annotationGenerator!: AnnotationGenerator;

  /**
   * Execute the annotation command
   */
  async execute(options: AnnotateCommandOptions, config: Config): Promise<void> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    try {
      // Initialize managers and configuration
      await this.initialize(config, options);

      // Get AST files to process
      const astFiles = await this.getASTFilesToProcess(options);
      
      if (astFiles.length === 0) {
        this.logger.info('No AST files found to annotate');
        return;
      }

      this.logger.info('Starting annotation generation', {
        files: astFiles.length,
        batchSize: options.batchSize || config.batchSize,
        force: options.force
      });

      // Process files in batches
      const stats = await this.processASTFiles(
        astFiles,
        options,
        config,
        this.createProgressCallback()
      );

      // Calculate final statistics
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      stats.processingTimeMs = endTime - startTime;
      stats.averageTimePerNodeMs = stats.totalNodes > 0 
        ? stats.processingTimeMs / stats.totalNodes 
        : 0;
      stats.memoryUsage = {
        peakMB: Math.max(startMemory, endMemory),
        averageMB: (startMemory + endMemory) / 2
      };

      // Output results
      await this.outputResults(stats, options);

      this.logger.info('Annotation generation completed', {
        totalNodes: stats.totalNodes,
        annotated: stats.annotatedNodes,
        timeMs: Math.round(stats.processingTimeMs),
        throughput: Math.round(stats.totalNodes / (stats.processingTimeMs / 1000))
      });

    } catch (error) {
      this.logger.error('Annotation command failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Initialize managers and configuration
   */
  private async initialize(config: Config, options: AnnotateCommandOptions): Promise<void> {
    // Initialize database manager
    this.dbManager = new ASTDatabaseManager(config.outputDir);

    // Ensure database structure exists
    await this.dbManager.createDirectoryStructure({ force: false });

    // Initialize annotation generator with merged config
    const annotationConfig: Partial<AnnotationConfig> = {
      performance: {
        batchSize: options.batchSize || config.batchSize,
        maxConcurrency: options.maxConcurrency || config.concurrency,
        progressReporting: true
      },
      output: {
        atomicWrites: true,
        validateSchema: true,
        prettifyJson: !options.dryRun
      }
    };

    this.annotationGenerator = new AnnotationGenerator(annotationConfig);
  }

  /**
   * Get AST files that need annotation processing
   */
  private async getASTFilesToProcess(options: AnnotateCommandOptions): Promise<string[]> {
    const structure = this.dbManager.getDatabaseStructure();
    
    try {
      await access(structure.asts);
    } catch {
      this.logger.warn('AST directory does not exist', { path: structure.asts });
      return [];
    }

    const allAstFiles = await readdir(structure.asts);
    const astJsonFiles = allAstFiles.filter(f => f.endsWith('.json'));

    if (options.changed) {
      // Only process files that have changed or don't have annotations
      return this.filterChangedFiles(astJsonFiles, structure);
    }

    if (options.force) {
      // Process all files
      return astJsonFiles.map(f => join(structure.asts, f));
    }

    // Process files that don't have annotations
    return this.filterUnannotatedFiles(astJsonFiles, structure);
  }

  /**
   * Filter files that have changed since last annotation
   */
  private async filterChangedFiles(astFiles: string[], structure: any): Promise<string[]> {
    const changedFiles: string[] = [];

    for (const astFile of astFiles) {
      const astPath = join(structure.asts, astFile);
      
      try {
        // Read AST file to get metadata
        const astContent = await readFile(astPath, 'utf8');
        const astData = JSON.parse(astContent);
        
        if (astData.nodes && Array.isArray(astData.nodes)) {
          // Check if any nodes need re-annotation
          const needsUpdate = await this.checkNodesNeedUpdate(astData.nodes, structure);
          if (needsUpdate) {
            changedFiles.push(astPath);
          }
        }
      } catch (error) {
        this.logger.warn('Failed to check AST file for changes', {
          file: astFile,
          error: error instanceof Error ? error.message : String(error)
        });
        // Include file if we can't determine status
        changedFiles.push(astPath);
      }
    }

    return changedFiles;
  }

  /**
   * Filter files that don't have annotations
   */
  private async filterUnannotatedFiles(astFiles: string[], structure: any): Promise<string[]> {
    const unannotatedFiles: string[] = [];

    for (const astFile of astFiles) {
      const astPath = join(structure.asts, astFile);
      
      try {
        const astContent = await readFile(astPath, 'utf8');
        const astData = JSON.parse(astContent);
        
        if (astData.nodes && Array.isArray(astData.nodes)) {
          // Check if any nodes lack annotations
          const hasUnannotatedNodes = await this.hasUnannotatedNodes(astData.nodes, structure);
          if (hasUnannotatedNodes) {
            unannotatedFiles.push(astPath);
          }
        }
      } catch (error) {
        this.logger.warn('Failed to check AST file annotations', {
          file: astFile,
          error: error instanceof Error ? error.message : String(error)
        });
        unannotatedFiles.push(astPath);
      }
    }

    return unannotatedFiles;
  }

  /**
   * Check if nodes need annotation updates
   */
  private async checkNodesNeedUpdate(nodes: ASTNode[], structure: any): Promise<boolean> {
    for (const node of nodes.slice(0, 5)) { // Check first 5 nodes only for performance
      const annotationPath = join(structure.annots, `${node.id}.json`);
      
      try {
        await access(annotationPath);
        // Could add hash comparison here for more sophisticated change detection
      } catch {
        // Annotation doesn't exist
        return true;
      }
    }

    return false;
  }

  /**
   * Check if file has nodes without annotations
   */
  private async hasUnannotatedNodes(nodes: ASTNode[], structure: any): Promise<boolean> {
    for (const node of nodes.slice(0, 10)) { // Check first 10 nodes for performance
      const annotationPath = join(structure.annots, `${node.id}.json`);
      
      try {
        await access(annotationPath);
      } catch {
        // Annotation doesn't exist
        return true;
      }
    }

    return false;
  }

  /**
   * Process AST files and generate annotations
   */
  private async processASTFiles(
    astFiles: string[],
    options: AnnotateCommandOptions,
    config: Config,
    onProgress: AnnotationProgressCallback
  ): Promise<AnnotationStats> {
    const stats: AnnotationStats = {
      totalNodes: 0,
      annotatedNodes: 0,
      skippedNodes: 0,
      errorNodes: 0,
      processingTimeMs: 0,
      averageTimePerNodeMs: 0,
      memoryUsage: { peakMB: 0, averageMB: 0 },
      languageBreakdown: {},
      qualityBreakdown: { highQuality: 0, mediumQuality: 0, lowQuality: 0 }
    };

    const batchSize = options.batchSize || config.batchSize || 10;
    let processedFiles = 0;

    for (let i = 0; i < astFiles.length; i += batchSize) {
      const batch = astFiles.slice(i, i + batchSize);
      
      this.logger.debug('Processing batch', {
        batch: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(astFiles.length / batchSize),
        files: batch.length
      });

      // Process batch of files
      const batchStats = await this.processBatch(batch, options, config, onProgress);
      
      // Merge statistics
      this.mergeStats(stats, batchStats);
      
      processedFiles += batch.length;
      
      // Report progress
      this.logger.info('Batch completed', {
        processed: processedFiles,
        total: astFiles.length,
        nodesInBatch: batchStats.totalNodes
      });
    }

    return stats;
  }

  /**
   * Process a batch of AST files
   */
  private async processBatch(
    astFiles: string[],
    options: AnnotateCommandOptions,
    config: Config,
    onProgress: AnnotationProgressCallback
  ): Promise<AnnotationStats> {
    const batchStats: AnnotationStats = {
      totalNodes: 0,
      annotatedNodes: 0,
      skippedNodes: 0,
      errorNodes: 0,
      processingTimeMs: 0,
      averageTimePerNodeMs: 0,
      memoryUsage: { peakMB: 0, averageMB: 0 },
      languageBreakdown: {},
      qualityBreakdown: { highQuality: 0, mediumQuality: 0, lowQuality: 0 }
    };

    for (const astFile of astFiles) {
      try {
        const fileStats = await this.processASTFile(astFile, options, config, onProgress);
        this.mergeStats(batchStats, fileStats);
      } catch (error) {
        this.logger.error('Failed to process AST file', {
          file: astFile,
          error: error instanceof Error ? error.message : String(error)
        });
        batchStats.errorNodes++;
      }
    }

    return batchStats;
  }

  /**
   * Process a single AST file and generate annotations
   */
  private async processASTFile(
    astFilePath: string,
    options: AnnotateCommandOptions,
    _config: Config,
    onProgress: AnnotationProgressCallback
  ): Promise<AnnotationStats> {
    const fileStats: AnnotationStats = {
      totalNodes: 0,
      annotatedNodes: 0,
      skippedNodes: 0,
      errorNodes: 0,
      processingTimeMs: 0,
      averageTimePerNodeMs: 0,
      memoryUsage: { peakMB: 0, averageMB: 0 },
      languageBreakdown: {},
      qualityBreakdown: { highQuality: 0, mediumQuality: 0, lowQuality: 0 }
    };

    // Read and parse AST file
    const astContent = await readFile(astFilePath, 'utf8');
    const astData = JSON.parse(astContent);
    
    if (!astData.nodes || !Array.isArray(astData.nodes)) {
      this.logger.warn('AST file has no nodes array', { file: astFilePath });
      return fileStats;
    }

    const nodes: ASTNode[] = astData.nodes;
    fileStats.totalNodes = nodes.length;

    // Create annotation context
    const context: AnnotationContext = {
      filePath: astData.metadata?.filePath || astFilePath,
      language: astData.metadata?.language || 'unknown',
      sourceText: await this.loadSourceText(astData.metadata?.filePath),
      allNodes: nodes,
      imports: new Map(),
      exports: new Set()
    };

    // Update language breakdown
    fileStats.languageBreakdown[context.language] = 
      (fileStats.languageBreakdown[context.language] || 0) + nodes.length;

    this.logger.debug('Processing AST file', {
      file: basename(astFilePath),
      nodes: nodes.length,
      language: context.language
    });

    // Process each node
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      
      if (!node) {
        this.logger.warn('Encountered undefined node at index', { index: i });
        continue;
      }
      
      try {
        // Generate annotation
        const annotation = await this.annotationGenerator.generateAnnotation(node, context);
        
        // Save annotation (unless dry run)
        if (!options.dryRun) {
          await this.saveAnnotation(annotation);
        }
        
        fileStats.annotatedNodes++;
        
        // Update quality breakdown
        this.updateQualityBreakdown(fileStats, annotation);
        
        // Report progress
        onProgress(fileStats.annotatedNodes, fileStats.totalNodes, node.name);
        
      } catch (error) {
        this.logger.warn('Failed to annotate node', {
          nodeId: node.id,
          nodeName: node.name,
          error: error instanceof Error ? error.message : String(error)
        });
        fileStats.errorNodes++;
      }
    }

    return fileStats;
  }

  /**
   * Load source text for a file (with caching and error handling)
   */
  private async loadSourceText(filePath?: string): Promise<string> {
    if (!filePath) {
      return '';
    }

    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      this.logger.warn('Failed to load source text', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return '';
    }
  }

  /**
   * Save annotation to disk with atomic writes
   */
  private async saveAnnotation(annotation: Annotation): Promise<void> {
    const structure = this.dbManager.getDatabaseStructure();
    const annotationPath = join(structure.annots, `${annotation.nodeId}.json`);
    
    // Ensure annots directory exists
    await mkdir(structure.annots, { recursive: true });
    
    // Perform atomic write
    await this.fsManager.atomicWriteFile(
      annotationPath,
      JSON.stringify(annotation, null, 2)
    );
  }

  /**
   * Create progress callback for reporting
   */
  private createProgressCallback(): AnnotationProgressCallback {
    let lastReportTime = 0;
    const reportInterval = 1000; // Report every second

    return (completed: number, total: number, currentNode?: string) => {
      const now = Date.now();
      
      if (now - lastReportTime >= reportInterval) {
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        this.logger.info('Annotation progress', {
          completed,
          total,
          percentage,
          currentNode: currentNode || 'unknown'
        });
        
        lastReportTime = now;
      }
    };
  }

  /**
   * Merge statistics from multiple sources
   */
  private mergeStats(target: AnnotationStats, source: AnnotationStats): void {
    target.totalNodes += source.totalNodes;
    target.annotatedNodes += source.annotatedNodes;
    target.skippedNodes += source.skippedNodes;
    target.errorNodes += source.errorNodes;

    // Merge language breakdown
    for (const [language, count] of Object.entries(source.languageBreakdown)) {
      target.languageBreakdown[language] = 
        (target.languageBreakdown[language] || 0) + count;
    }

    // Merge quality breakdown
    target.qualityBreakdown.highQuality += source.qualityBreakdown.highQuality;
    target.qualityBreakdown.mediumQuality += source.qualityBreakdown.mediumQuality;
    target.qualityBreakdown.lowQuality += source.qualityBreakdown.lowQuality;
  }

  /**
   * Update quality breakdown based on annotation
   */
  private updateQualityBreakdown(stats: AnnotationStats, annotation: Annotation): void {
    const avgConfidence = (
      annotation.metadata.quality.signatureConfidence + 
      annotation.metadata.quality.summaryConfidence
    ) / 2;

    if (avgConfidence >= 0.8 && annotation.metadata.quality.isComplete) {
      stats.qualityBreakdown.highQuality++;
    } else if (avgConfidence >= 0.5) {
      stats.qualityBreakdown.mediumQuality++;
    } else {
      stats.qualityBreakdown.lowQuality++;
    }
  }

  /**
   * Output results and statistics
   */
  private async outputResults(stats: AnnotationStats, options: AnnotateCommandOptions): Promise<void> {
    if (options.outputStats) {
      console.log('\n=== Annotation Generation Statistics ===');
      console.log(`Total nodes processed: ${stats.totalNodes}`);
      console.log(`Successfully annotated: ${stats.annotatedNodes}`);
      console.log(`Skipped: ${stats.skippedNodes}`);
      console.log(`Errors: ${stats.errorNodes}`);
      console.log(`Processing time: ${Math.round(stats.processingTimeMs)}ms`);
      console.log(`Average per node: ${Math.round(stats.averageTimePerNodeMs)}ms`);
      console.log(`Peak memory: ${Math.round(stats.memoryUsage.peakMB)}MB`);
      
      console.log('\nLanguage breakdown:');
      for (const [language, count] of Object.entries(stats.languageBreakdown)) {
        console.log(`  ${language}: ${count} nodes`);
      }
      
      console.log('\nQuality breakdown:');
      console.log(`  High quality: ${stats.qualityBreakdown.highQuality}`);
      console.log(`  Medium quality: ${stats.qualityBreakdown.mediumQuality}`);
      console.log(`  Low quality: ${stats.qualityBreakdown.lowQuality}`);
    }

    // Performance validation
    const targetTimeMs = 3 * 60 * 1000; // 3 minutes
    const targetNodes = 15000;
    
    if (stats.totalNodes >= targetNodes) {
      const meetsRequirement = stats.processingTimeMs <= targetTimeMs;
      const throughput = Math.round(stats.totalNodes / (stats.processingTimeMs / 1000));
      
      console.log(`\n=== Performance Validation ===`);
      console.log(`Target: ${targetNodes} nodes in ${targetTimeMs / 1000}s`);
      console.log(`Actual: ${stats.totalNodes} nodes in ${Math.round(stats.processingTimeMs / 1000)}s`);
      console.log(`Throughput: ${throughput} nodes/second`);
      console.log(`Requirement ${meetsRequirement ? '✅ MET' : '❌ NOT MET'}`);
    }
  }
}