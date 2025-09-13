/**
 * Types and interfaces for the annotation system
 * Generates metadata, signatures, and complexity metrics from parsed AST nodes
 */

import { ASTNode } from '../parser/types';

/**
 * Complete annotation data for an AST node
 * Generated from parsed AST to enable rich semantic understanding
 */
export interface Annotation {
  // Identity and linking
  nodeId: string;                    // References ASTNode.id
  filePath: string;                  // Source file path
  
  // Generated signatures and summaries
  signature: string;                 // Function/class signature
  summary: string;                   // "Function X does Y" description
  
  // Code analysis metrics
  complexity: number;                // Cyclomatic complexity
  lineCount: number;                // Source lines of code
  characterCount: number;            // Character count
  
  // Dependencies and relationships
  dependencies: string[];            // Imported symbols referenced
  exports: string[];                // Symbols exported
  calls: string[];                   // Function/method calls made
  
  // Source code context
  sourceSnippet: string;            // Code excerpt with context
  contextLines: {                   // Surrounding context
    before: string[];
    after: string[];
  };
  
  // Semantic information
  purpose: string;                  // Inferred purpose/intent
  tags: string[];                   // Semantic tags (utility, handler, etc.)
  
  // Quality metrics
  completeness: number;             // How complete the annotation is (0-1)
  confidence: number;              // Confidence in annotation quality (0-1)
  
  // Metadata
  language: string;                // Programming language
  lastUpdated: string;             // ISO timestamp
  version: string;                 // Annotation schema version
}

/**
 * Function/method parameter information
 */
export interface Parameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

/**
 * Language-specific signature extractor interface
 * Enables extensible support for different programming languages
 */
export interface SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string;
  extractParameters(node: ASTNode, sourceText: string): Parameter[];
  extractReturnType(node: ASTNode, sourceText: string): string | null;
  extractAccessModifiers(node: ASTNode, sourceText: string): string[];
}

/**
 * Context lines around a code snippet
 */
export interface ContextLines {
  before: string[];
  after: string[];
}

/**
 * Configuration for annotation generation
 */
export interface AnnotationConfig {
  // Source context settings
  maxSnippetLines: number;          // Maximum lines to include in snippet
  contextLinesBefore: number;       // Context lines before the node
  contextLinesAfter: number;        // Context lines after the node
  
  // Performance settings
  batchSize: number;                // Number of nodes to process in batch
  maxConcurrency: number;           // Maximum concurrent annotation operations
  timeoutMs: number;                // Timeout for individual annotation generation
  
  // Quality settings
  minCompleteness: number;          // Minimum completeness score (0-1)
  minConfidence: number;            // Minimum confidence score (0-1)
  
  // Output settings
  outputDir: string;                // Directory for annotation JSON files
  enableValidation: boolean;        // Enable schema validation
  enableDeduplication: boolean;     // Enable duplicate annotation detection
}

/**
 * Progress information for batch annotation operations
 */
export interface AnnotationProgress {
  completed: number;
  total: number;
  currentNodeId: string;
  currentFilePath: string;
  errors: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
}

/**
 * Error information for annotation generation
 */
export interface AnnotationError {
  nodeId: string;
  filePath: string;
  error: Error;
  context?: string;
  recoverable: boolean;
}

/**
 * Result of annotation generation operation
 */
export interface AnnotationResult {
  annotations: Annotation[];
  errors: AnnotationError[];
  totalProcessed: number;
  totalTime: number;
  performance: {
    averageTimePerNode: number;
    nodesPerSecond: number;
    memoryUsageMB: number;
  };
}

/**
 * Semantic tags for code classification
 */
export enum SemanticTag {
  // Functional categories
  UTILITY = 'utility',
  HANDLER = 'handler',
  VALIDATOR = 'validator',
  TRANSFORMER = 'transformer',
  FACTORY = 'factory',
  BUILDER = 'builder',
  
  // Architectural patterns
  MODEL = 'model',
  CONTROLLER = 'controller',
  SERVICE = 'service',
  REPOSITORY = 'repository',
  MIDDLEWARE = 'middleware',
  
  // Data flow
  GETTER = 'getter',
  SETTER = 'setter',
  PREDICATE = 'predicate',
  PROCESSOR = 'processor',
  PARSER = 'parser',
  FORMATTER = 'formatter',
  
  // Infrastructure
  CONFIG = 'config',
  HELPER = 'helper',
  CONSTANT = 'constant',
  TYPE = 'type',
  INTERFACE = 'interface',
  ENUM = 'enum'
}

/**
 * Purpose categories for code classification
 */
export enum PurposeCategory {
  DATA_PROCESSING = 'data-processing',
  USER_INTERFACE = 'user-interface',
  BUSINESS_LOGIC = 'business-logic',
  INFRASTRUCTURE = 'infrastructure',
  TESTING = 'testing',
  CONFIGURATION = 'configuration',
  UTILITY = 'utility'
}

/**
 * Complexity thresholds for classification
 */
export const COMPLEXITY_THRESHOLDS = {
  LOW: 5,
  MEDIUM: 10,
  HIGH: 20,
  VERY_HIGH: 50
} as const;

/**
 * Default annotation configuration
 */
export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
  maxSnippetLines: 50,
  contextLinesBefore: 3,
  contextLinesAfter: 3,
  batchSize: 100,
  maxConcurrency: 4,
  timeoutMs: 30000,
  minCompleteness: 0.7,
  minConfidence: 0.6,
  outputDir: '.astdb/annotations',
  enableValidation: true,
  enableDeduplication: true
};