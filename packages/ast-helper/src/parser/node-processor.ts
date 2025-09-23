/**
 * AST Node Processing Pipeline
 * 
 * Main coordinator that integrates all AST processing components:
 * ID generation, classification, significance calculation, metadata extraction, and serialization.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ASTNode, ProcessingContext } from './ast-schema';
import { NodeType, SignificanceLevel } from './ast-schema';
import { NodeIDGenerator } from './node-id-generator';
import type { RawNodeData } from './node-classifier';
import { NodeClassifier } from './node-classifier';
import type { SignificanceContext } from './significance-calculator';
import { SignificanceCalculator } from './significance-calculator';
import type { RawASTNode, ExtractionContext } from './metadata-extractor';
import { MetadataExtractor } from './metadata-extractor';
import type { SerializationConfig } from './node-serializer';
import { NodeSerializer } from './node-serializer';

/**
 * Processing configuration for the pipeline
 */
export interface ProcessingConfig {
  /** Enable ID generation */
  generateIds: boolean;
  /** Enable node classification */
  classifyNodes: boolean;
  /** Enable significance calculation */
  calculateSignificance: boolean;
  /** Enable metadata extraction */
  extractMetadata: boolean;
  /** Enable serialization */
  enableSerialization: boolean;
  /** Serialization configuration */
  serializationConfig?: Partial<SerializationConfig>;
  /** Processing timeout in milliseconds */
  timeoutMs: number;
  /** Maximum file size in bytes */
  maxFileSizeBytes: number;
  /** Include source text in nodes */
  includeSourceText: boolean;
  /** Generate function signatures */
  generateSignatures: boolean;
  /** Calculate complexity metrics */
  calculateComplexity: boolean;
  /** Validate processed nodes */
  validateNodes: boolean;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  /** Total nodes processed */
  totalNodes: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Nodes by type */
  nodesByType: Record<NodeType, number>;
  /** Nodes by significance */
  nodesBySignificance: Record<SignificanceLevel, number>;
  /** Memory usage statistics */
  memoryUsage: {
    /** Peak memory usage in MB */
    peakMB: number;
    /** Average memory usage in MB */
    averageMB: number;
  };
  /** Performance metrics */
  performance: {
    /** Nodes processed per second */
    nodesPerSecond: number;
    /** Average time per node in microseconds */
    avgTimePerNodeUs: number;
  };
}

/**
 * Processing result for a single file
 */
export interface ProcessingResult {
  /** File path */
  filePath: string;
  /** Programming language */
  language: string;
  /** Processing success */
  success: boolean;
  /** Processed AST nodes */
  nodes: ASTNode[];
  /** Error information if processing failed */
  error?: Error;
  /** Processing statistics */
  stats: ProcessingStats;
  /** Serialized output path (if serialization enabled) */
  serializedPath?: string;
  /** Generated file hash */
  fileHash: string;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  /** Results for each file */
  results: ProcessingResult[];
  /** Overall statistics */
  overallStats: ProcessingStats & {
    /** Total files processed */
    totalFiles: number;
    /** Successful files */
    successfulFiles: number;
    /** Failed files */
    failedFiles: number;
  };
  /** Processing errors */
  errors: Error[];
}

/**
 * Processing pipeline errors
 */
export class ProcessingError extends Error {
  public override readonly cause?: Error;
  
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly stage: string,
    cause?: Error
  ) {
    super(`Processing failed at ${stage} for ${filePath}: ${message}`);
    this.name = 'ProcessingError';
    this.cause = cause;
  }
}

/**
 * Default processing configuration
 */
export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  generateIds: true,
  classifyNodes: true,
  calculateSignificance: true,
  extractMetadata: true,
  enableSerialization: false,
  timeoutMs: 30000, // 30 seconds
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  includeSourceText: true,
  generateSignatures: true,
  calculateComplexity: true,
  validateNodes: true,
};

/**
 * Main AST Node Processing Pipeline
 */
export class NodeProcessor {
  private config: ProcessingConfig;
  private idGenerator: NodeIDGenerator;
  private classifier: NodeClassifier;
  private significanceCalculator: SignificanceCalculator;
  private metadataExtractor: MetadataExtractor;
  private serializer: NodeSerializer;

  constructor(config: Partial<ProcessingConfig> = {}) {
    this.config = { ...DEFAULT_PROCESSING_CONFIG, ...config };
    
    // Initialize all component processors
    this.idGenerator = new NodeIDGenerator();
    this.classifier = new NodeClassifier();
    this.significanceCalculator = new SignificanceCalculator();
    this.metadataExtractor = new MetadataExtractor();
    this.serializer = new NodeSerializer(this.config.serializationConfig);
  }

  /**
   * Process a single file and return AST nodes
   */
  async processFile(
    filePath: string,
    language: string,
    sourceText?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    try {
      // Validate input parameters
      if (!filePath || filePath.trim() === '') {
        throw new ProcessingError('File path cannot be empty', filePath, 'validation');
      }
      
      if (!language || language.trim() === '') {
        throw new ProcessingError('Language cannot be empty', filePath, 'validation');
      }

      // Read source text if not provided
      if (!sourceText) {
        if (!fs.existsSync(filePath)) {
          throw new ProcessingError('File not found', filePath, 'file-read');
        }
        
        const stats = fs.statSync(filePath);
        if (stats.size > this.config.maxFileSizeBytes) {
          throw new ProcessingError(
            `File too large: ${stats.size} bytes (max: ${this.config.maxFileSizeBytes})`,
            filePath,
            'file-validation'
          );
        }
        
        sourceText = fs.readFileSync(filePath, 'utf8');
      }

      // Generate file hash for tracking
      const fileHash = this.generateFileHash(sourceText);
      
      // Create processing context
      const context: ProcessingContext = {
        filePath,
        language,
        sourceText,
        parentScope: [],
        imports: new Map(),
        exports: new Set(),
      };

      // Start with an empty node list - in real implementation, this would come from AST parsing
      let nodes: ASTNode[] = [];

      // For demonstration, create a sample root node
      // In real implementation, this would be populated by a tree-sitter parser
      const rootNode: Partial<ASTNode> = {
        type: NodeType.FILE,
        name: path.basename(filePath),
        filePath,
        start: { line: 1, column: 0 },
        end: { line: sourceText.split('\n').length, column: 0 },
        children: [],
        sourceText: this.config.includeSourceText ? sourceText.substring(0, 500) : undefined,
      };

      // Apply processing pipeline stages
      nodes = await this.applyProcessingStages([rootNode as ASTNode], context);

      // Calculate processing statistics
      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();
      const stats = this.calculateProcessingStats(nodes, startTime, endTime, startMemory, endMemory);

      // Handle serialization if enabled
      let serializedPath: string | undefined;
      if (this.config.enableSerialization && nodes.length > 0) {
        serializedPath = await this.serializeNodes(nodes, filePath, language, fileHash);
      }

      return {
        filePath,
        language,
        success: true,
        nodes,
        stats,
        serializedPath,
        fileHash,
      };

    } catch (error) {
      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();
      const stats = this.calculateProcessingStats([], startTime, endTime, startMemory, endMemory);

      return {
        filePath,
        language,
        success: false,
        nodes: [],
        error: error as Error,
        stats,
        fileHash: '',
      };
    }
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(
    files: Array<{ filePath: string; language: string; sourceText?: string }>
  ): Promise<BatchProcessingResult> {
    const results: ProcessingResult[] = [];
    const errors: Error[] = [];
    const startTime = Date.now();

    // Process files sequentially (could be parallelized with concurrency control)
    for (const file of files) {
      try {
        const result = await this.processFile(file.filePath, file.language, file.sourceText);
        results.push(result);
        
        if (!result.success && result.error) {
          errors.push(result.error);
        }
      } catch (error) {
        errors.push(error as Error);
        
        // Add failed result
        results.push({
          filePath: file.filePath,
          language: file.language,
          success: false,
          nodes: [],
          error: error as Error,
          stats: {
            totalNodes: 0,
            processingTimeMs: 0,
            nodesByType: {} as Record<NodeType, number>,
            nodesBySignificance: {} as Record<SignificanceLevel, number>,
            memoryUsage: { peakMB: 0, averageMB: 0 },
            performance: { nodesPerSecond: 0, avgTimePerNodeUs: 0 },
          },
          fileHash: '',
        });
      }
    }

    const endTime = Date.now();
    const overallStats = this.calculateOverallStats(results, endTime - startTime);

    return {
      results,
      overallStats,
      errors,
    };
  }

  /**
   * Process a directory recursively
   */
  async processDirectory(
    directoryPath: string,
    options: {
      extensions?: string[];
      recursive?: boolean;
      maxFiles?: number;
      outputDirectory?: string;
    } = {}
  ): Promise<BatchProcessingResult> {
    const {
      extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java'],
      recursive = true,
      maxFiles = 1000,
      outputDirectory,
    } = options;

    const files = this.discoverFiles(directoryPath, extensions, recursive, maxFiles);
    
    // Set up serialization output directory if provided
    if (outputDirectory && this.config.enableSerialization) {
      this.ensureDirectoryExists(outputDirectory);
    }

    return this.processBatch(files.map(filePath => ({
      filePath,
      language: this.detectLanguageFromPath(filePath),
    })));
  }

  /**
   * Update processing configuration
   */
  updateConfig(newConfig: Partial<ProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update serializer configuration if needed
    if (newConfig.serializationConfig) {
      this.serializer.updateConfig(newConfig.serializationConfig);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ProcessingConfig {
    return { ...this.config };
  }

  /**
   * Validate processed nodes
   */
  validateProcessedNodes(nodes: ASTNode[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const node of nodes) {
      // Check required fields
      if (!node.id) {
errors.push(`Node missing ID: ${JSON.stringify(node)}`);
}
      if (!node.type) {
errors.push(`Node missing type: ${node.id}`);
}
      if (!node.filePath) {
errors.push(`Node missing filePath: ${node.id}`);
}
      if (!node.start) {
errors.push(`Node missing start position: ${node.id}`);
}
      if (!node.end) {
errors.push(`Node missing end position: ${node.id}`);
}
      if (!node.metadata) {
errors.push(`Node missing metadata: ${node.id}`);
}
      if (node.significance === undefined) {
errors.push(`Node missing significance: ${node.id}`);
}

      // Check position validity
      if (node.start && node.end) {
        if (node.start.line > node.end.line) {
          errors.push(`Invalid position range for node ${node.id}: start line > end line`);
        }
        if (node.start.line === node.end.line && node.start.column > node.end.column) {
          errors.push(`Invalid position range for node ${node.id}: start column > end column`);
        }
      }

      // Check children references
      if (node.children) {
        for (const childId of node.children) {
          if (typeof childId !== 'string' || childId.length === 0) {
            errors.push(`Invalid child ID for node ${node.id}: ${childId}`);
          }
        }
      }

      // Check significance level
      if (node.significance !== undefined && !Object.values(SignificanceLevel).includes(node.significance)) {
        errors.push(`Invalid significance level for node ${node.id}: ${node.significance}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get processing statistics summary
   */
  getProcessingStatsSummary(results: ProcessingResult[]): {
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalNodes: number;
    averageProcessingTime: number;
    nodeDistribution: Record<NodeType, number>;
    significanceDistribution: Record<SignificanceLevel, number>;
  } {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalNodes = successful.reduce((sum, r) => sum + r.stats.totalNodes, 0);
    const averageProcessingTime = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.stats.processingTimeMs, 0) / successful.length
      : 0;

    const nodeDistribution: Record<NodeType, number> = {} as any;
    const significanceDistribution: Record<SignificanceLevel, number> = {} as any;

    for (const result of successful) {
      for (const [type, count] of Object.entries(result.stats.nodesByType)) {
        nodeDistribution[type as NodeType] = (nodeDistribution[type as NodeType] || 0) + count;
      }
      
      for (const [significance, count] of Object.entries(result.stats.nodesBySignificance)) {
        const sig = significance as unknown as SignificanceLevel;
        significanceDistribution[sig] = (significanceDistribution[sig] || 0) + count;
      }
    }

    return {
      totalFiles: results.length,
      successfulFiles: successful.length,
      failedFiles: failed.length,
      totalNodes,
      averageProcessingTime,
      nodeDistribution,
      significanceDistribution,
    };
  }

  /**
   * Apply all processing stages to nodes
   */
  private async applyProcessingStages(nodes: ASTNode[], context: ProcessingContext): Promise<ASTNode[]> {
    let processedNodes = [...nodes];

    try {
      // Stage 1: Generate IDs
      if (this.config.generateIds) {
        processedNodes = processedNodes.map(node => {
          if (!node.id) {
            node.id = this.idGenerator.generateId(node);
          }
          return node;
        });
      }

      // Stage 2: Classify nodes
      if (this.config.classifyNodes) {
        processedNodes = processedNodes.map(node => {
          // Create RawNodeData for classification
          const rawNodeData: RawNodeData = {
            type: node.type,
            name: node.name,
            language: context.language,
            properties: {},
            children: [], // Children will be populated during processing
          };
          
          const classification = this.classifier.classifyNode(rawNodeData, context);
          return { ...node, ...classification };
        });
      }

      // Stage 3: Calculate significance
      if (this.config.calculateSignificance) {
        processedNodes = processedNodes.map(node => {
          if (node.significance === undefined) {
            // Create SignificanceContext for calculation
            const significanceContext: Partial<SignificanceContext> = {
              node,
              parent: undefined, // Would be populated in real implementation
              children: [], // Would be populated from node references
              siblings: [],
              fileContext: {
                totalNodes: 1, // Placeholder values
                totalFunctions: 0,
                totalClasses: 0,
                isMainFile: false,
                isTestFile: context.filePath.includes('.test.') || context.filePath.includes('.spec.'),
                isConfigFile: context.filePath.includes('config') || context.filePath.includes('.config.'),
              },
            };
            
            node.significance = this.significanceCalculator.calculateSignificance(node, significanceContext);
          }
          return node;
        });
      }

      // Stage 4: Extract metadata
      if (this.config.extractMetadata) {
        processedNodes = await Promise.all(
          processedNodes.map(async node => {
            // Create RawASTNode for metadata extraction
            const rawNode: RawASTNode = {
              type: node.type,
              text: node.sourceText || '',
              startPosition: { row: node.start.line, column: node.start.column },
              endPosition: { row: node.end.line, column: node.end.column },
              children: [], // Would be populated in real implementation
              namedChildren: [],
              fieldName: node.name,
            };
            
            // Create extraction context
            const extractionContext: ExtractionContext = {
              filePath: context.filePath,
              language: context.language,
              sourceText: context.sourceText,
              scopeStack: [],
              fileImports: new Map(),
              fileExports: new Set(),
            };
            
            const metadata = await this.metadataExtractor.extractMetadata(rawNode, extractionContext);
            return { ...node, metadata };
          })
        );
      }

      // Stage 5: Generate signatures and calculate complexity
      if (this.config.generateSignatures || this.config.calculateComplexity) {
        processedNodes = processedNodes.map(node => {
          if (this.config.generateSignatures && !node.signature && this.shouldGenerateSignature(node)) {
            node.signature = this.generateSignature(node);
          }
          
          if (this.config.calculateComplexity && node.complexity === undefined) {
            node.complexity = this.calculateComplexity(node);
          }
          
          return node;
        });
      }

      // Stage 6: Validate processed nodes
      if (this.config.validateNodes) {
        const validation = this.validateProcessedNodes(processedNodes);
        if (!validation.isValid) {
          throw new ProcessingError(
            `Node validation failed: ${validation.errors.join(', ')}`,
            context.filePath,
            'validation'
          );
        }
      }

      return processedNodes;

    } catch (error) {
      throw new ProcessingError(
        'Processing pipeline failed',
        context.filePath,
        'pipeline',
        error as Error
      );
    }
  }

  /**
   * Serialize processed nodes
   */
  private async serializeNodes(
    nodes: ASTNode[],
    filePath: string,
    language: string,
    fileHash: string
  ): Promise<string> {
    const outputPath = this.generateSerializationPath(filePath);
    
    await this.serializer.saveToFile(nodes, filePath, outputPath, language, fileHash);
    
    return outputPath;
  }

  /**
   * Calculate processing statistics
   */
  private calculateProcessingStats(
    nodes: ASTNode[],
    startTime: number,
    endTime: number,
    startMemory: number,
    endMemory: number
  ): ProcessingStats {
    const processingTimeMs = endTime - startTime;

    const nodesByType: Record<NodeType, number> = {} as any;
    const nodesBySignificance: Record<SignificanceLevel, number> = {} as any;

    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
      nodesBySignificance[node.significance] = (nodesBySignificance[node.significance] || 0) + 1;
    }

    const nodesPerSecond = processingTimeMs > 0 ? (nodes.length * 1000) / processingTimeMs : 
                          nodes.length > 0 ? nodes.length * 1000 : 0; // If 0ms but nodes exist, assume 1ms
    const avgTimePerNodeUs = nodes.length > 0 ? (processingTimeMs * 1000) / nodes.length : 0;

    return {
      totalNodes: nodes.length,
      processingTimeMs,
      nodesByType,
      nodesBySignificance,
      memoryUsage: {
        peakMB: Math.max(startMemory, endMemory),
        averageMB: (startMemory + endMemory) / 2,
      },
      performance: {
        nodesPerSecond,
        avgTimePerNodeUs,
      },
    };
  }

  /**
   * Calculate overall statistics from individual results
   */
  private calculateOverallStats(results: ProcessingResult[], totalTimeMs: number): BatchProcessingResult['overallStats'] {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalNodes = successful.reduce((sum, r) => sum + r.stats.totalNodes, 0);
    
    const nodesByType: Record<NodeType, number> = {} as any;
    const nodesBySignificance: Record<SignificanceLevel, number> = {} as any;
    
    let totalPeakMemory = 0;
    let totalAvgMemory = 0;

    for (const result of successful) {
      for (const [type, count] of Object.entries(result.stats.nodesByType)) {
        nodesByType[type as NodeType] = (nodesByType[type as NodeType] || 0) + count;
      }
      
      for (const [significance, count] of Object.entries(result.stats.nodesBySignificance)) {
        const sig = significance as unknown as SignificanceLevel;
        nodesBySignificance[sig] = (nodesBySignificance[sig] || 0) + count;
      }
      
      totalPeakMemory += result.stats.memoryUsage.peakMB;
      totalAvgMemory += result.stats.memoryUsage.averageMB;
    }

    const avgPeakMemory = successful.length > 0 ? totalPeakMemory / successful.length : 0;
    const avgAvgMemory = successful.length > 0 ? totalAvgMemory / successful.length : 0;

    const nodesPerSecond = totalTimeMs > 0 ? (totalNodes * 1000) / totalTimeMs : 
                          totalNodes > 0 ? totalNodes * 1000 : 0; // If 0ms but nodes exist, assume 1ms
    const avgTimePerNodeUs = totalNodes > 0 ? (totalTimeMs * 1000) / totalNodes : 0;

    return {
      totalFiles: results.length,
      successfulFiles: successful.length,
      failedFiles: failed.length,
      totalNodes,
      processingTimeMs: totalTimeMs,
      nodesByType,
      nodesBySignificance,
      memoryUsage: {
        peakMB: avgPeakMemory,
        averageMB: avgAvgMemory,
      },
      performance: {
        nodesPerSecond,
        avgTimePerNodeUs,
      },
    };
  }

  /**
   * Discover files in directory
   */
  private discoverFiles(
    dirPath: string,
    extensions: string[],
    recursive: boolean,
    maxFiles: number
  ): string[] {
    const files: string[] = [];

    const traverse = (currentPath: string, depth = 0) => {
      if (files.length >= maxFiles) {
return;
}

      try {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          if (files.length >= maxFiles) {
break;
}
          
          const fullPath = path.join(currentPath, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && recursive) {
            traverse(fullPath, depth + 1);
          } else if (stat.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    traverse(dirPath);
    return files;
  }

  /**
   * Detect language from file path
   */
  private detectLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
    };

    return languageMap[ext] || 'unknown';
  }

  /**
   * Generate file hash for tracking
   */
  private generateFileHash(content: string): string {
    // Simple hash implementation (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate serialization output path
   */
  private generateSerializationPath(filePath: string): string {
    const baseName = path.basename(filePath, path.extname(filePath));
    const dirName = path.dirname(filePath);
    return path.join(dirName, `${baseName}.ast.json`);
  }

  /**
   * Check if signature should be generated for node
   */
  private shouldGenerateSignature(node: ASTNode): boolean {
    const signatureTypes = [
      NodeType.FUNCTION,
      NodeType.METHOD,
      NodeType.CONSTRUCTOR,
      NodeType.CLASS,
      NodeType.INTERFACE,
    ];
    
    return signatureTypes.includes(node.type);
  }

  /**
   * Generate signature for node
   */
  private generateSignature(node: ASTNode): string {
    // Basic signature generation - would be more sophisticated in real implementation
    switch (node.type) {
      case NodeType.FUNCTION:
      case NodeType.METHOD:
        return `${node.name || 'anonymous'}(...)`;
      case NodeType.CLASS:
        return `class ${node.name || 'Anonymous'}`;
      case NodeType.INTERFACE:
        return `interface ${node.name || 'Anonymous'}`;
      default:
        return node.name || node.type;
    }
  }

  /**
   * Calculate complexity for node
   */
  private calculateComplexity(node: ASTNode): number {
    // Basic complexity calculation - would be more sophisticated in real implementation
    let complexity = 1; // Base complexity

    // Add complexity based on node type
    switch (node.type) {
      case NodeType.IF_STATEMENT:
      case NodeType.WHILE_LOOP:
      case NodeType.FOR_LOOP:
        complexity += 2;
        break;
      case NodeType.SWITCH_STATEMENT:
        complexity += 3;
        break;
      case NodeType.TRY_CATCH:
        complexity += 2;
        break;
    }

    // Add complexity based on children count
    complexity += Math.floor(node.children.length / 5);

    return Math.max(1, complexity);
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

/**
 * Default processor instance
 */
export const defaultProcessor = new NodeProcessor();

/**
 * Utility functions for processing
 */
export class ProcessingUtils {
  /**
   * Create processor with minimal configuration
   */
  static createMinimalProcessor(): NodeProcessor {
    return new NodeProcessor({
      generateIds: true,
      classifyNodes: false,
      calculateSignificance: false,
      extractMetadata: false,
      enableSerialization: false,
      validateNodes: false,
      includeSourceText: false,
      generateSignatures: false,
      calculateComplexity: false,
    });
  }

  /**
   * Create processor with full feature set
   */
  static createFullProcessor(): NodeProcessor {
    return new NodeProcessor({
      generateIds: true,
      classifyNodes: true,
      calculateSignificance: true,
      extractMetadata: true,
      enableSerialization: true,
      validateNodes: true,
      includeSourceText: true,
      generateSignatures: true,
      calculateComplexity: true,
    });
  }

  /**
   * Create processor optimized for performance
   */
  static createPerformanceProcessor(): NodeProcessor {
    return new NodeProcessor({
      generateIds: true,
      classifyNodes: true,
      calculateSignificance: true,
      extractMetadata: false, // Skip expensive metadata extraction
      enableSerialization: false,
      validateNodes: false,
      includeSourceText: false,
      generateSignatures: false,
      calculateComplexity: false,
      timeoutMs: 5000, // Shorter timeout
      maxFileSizeBytes: 5 * 1024 * 1024, // Smaller file limit
    });
  }

  /**
   * Merge processing results from multiple runs
   */
  static mergeProcessingResults(results: BatchProcessingResult[]): BatchProcessingResult {
    const mergedResults: ProcessingResult[] = [];
    const mergedErrors: Error[] = [];
    let totalProcessingTime = 0;

    for (const result of results) {
      mergedResults.push(...result.results);
      mergedErrors.push(...result.errors);
      totalProcessingTime += result.overallStats.processingTimeMs;
    }

    // Calculate merged overall stats
    const successful = mergedResults.filter(r => r.success);
    const failed = mergedResults.filter(r => !r.success);
    
    const totalNodes = successful.reduce((sum, r) => sum + r.stats.totalNodes, 0);
    
    const nodesByType: Record<NodeType, number> = {} as any;
    const nodesBySignificance: Record<SignificanceLevel, number> = {} as any;

    for (const result of successful) {
      for (const [type, count] of Object.entries(result.stats.nodesByType)) {
        nodesByType[type as NodeType] = (nodesByType[type as NodeType] || 0) + count;
      }
      
      for (const [significance, count] of Object.entries(result.stats.nodesBySignificance)) {
        const sig = significance as unknown as SignificanceLevel;
        nodesBySignificance[sig] = (nodesBySignificance[sig] || 0) + count;
      }
    }

    const overallStats = {
      totalFiles: mergedResults.length,
      successfulFiles: successful.length,
      failedFiles: failed.length,
      totalNodes,
      processingTimeMs: totalProcessingTime,
      nodesByType,
      nodesBySignificance,
      memoryUsage: { peakMB: 0, averageMB: 0 },
      performance: {
        nodesPerSecond: totalProcessingTime > 0 ? (totalNodes * 1000) / totalProcessingTime : 
                       totalNodes > 0 ? totalNodes * 1000 : 0, // If 0ms but nodes exist, assume 1ms
        avgTimePerNodeUs: totalNodes > 0 ? (totalProcessingTime * 1000) / totalNodes : 0,
      },
    };

    return {
      results: mergedResults,
      overallStats,
      errors: mergedErrors,
    };
  }
}