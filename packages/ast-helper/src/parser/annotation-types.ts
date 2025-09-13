/**
 * Annotation System Types
 * 
 * Defines types for the comprehensive annotation and metadata generation system
 * as specified in issue #10.
 */

import { NodeType, Position } from './ast-schema.js';

/**
 * Core annotation interface for AST nodes
 */
export interface Annotation {
  /** Unique identifier for the node this annotation describes */
  nodeId: string;
  
  /** Source file path */
  filePath: string;
  
  /** Language-aware extracted signature */
  signature: string;
  
  /** Generated summary describing the node's purpose */
  summary: string;
  
  /** Cyclomatic complexity score (capped at 50) */
  complexity: number;
  
  /** List of imported symbols referenced by this node */
  dependencies: string[];
  
  /** Source code snippet with configurable line limits */
  sourceSnippet: string;
  
  /** Metadata for tracking and quality control */
  metadata: AnnotationMetadata;
  
  /** Language-specific extracted features */
  languageFeatures: LanguageFeatures;
}

/**
 * Metadata for annotation tracking and quality control
 */
export interface AnnotationMetadata {
  /** Timestamp when annotation was generated */
  createdAt: string;
  
  /** Tool version that generated this annotation */
  toolVersion: string;
  
  /** Quality metrics for the annotation */
  quality: QualityMetrics;
  
  /** Character count of the source node */
  characterCount: number;
  
  /** Line count of the source node */
  lineCount: number;
  
  /** Hash of the source content for change detection */
  contentHash: string;
}

/**
 * Quality metrics for annotations
 */
export interface QualityMetrics {
  /** Confidence score for signature extraction (0-1) */
  signatureConfidence: number;
  
  /** Confidence score for summary generation (0-1) */
  summaryConfidence: number;
  
  /** Whether the node appears to be complete/well-formed */
  isComplete: boolean;
  
  /** Detected issues with the node */
  issues: string[];
}

/**
 * Language-specific features extracted from nodes
 */
export interface LanguageFeatures {
  /** Programming language */
  language: string;
  
  /** Type annotations (TypeScript/Python) */
  typeAnnotations?: string[];
  
  /** Generic parameters (TypeScript/Java/C#) */
  generics?: string[];
  
  /** Interface implementations */
  implements?: string[];
  
  /** Class inheritance */
  extends?: string[];
  
  /** Decorators/annotations */
  decorators: string[];
  
  /** Access modifiers (public, private, etc.) */
  modifiers: string[];
  
  /** Async/await usage */
  isAsync?: boolean;
  
  /** Generator function */
  isGenerator?: boolean;
  
  /** Export type (default, named, etc.) */
  exportType?: ExportType;
}

/**
 * Types of exports
 */
export enum ExportType {
  DEFAULT = 'default',
  NAMED = 'named',
  NAMESPACE = 'namespace',
  RE_EXPORT = 're-export'
}

/**
 * Signature extraction configuration
 */
export interface SignatureConfig {
  /** Include parameter names */
  includeParameterNames: boolean;
  
  /** Include return type */
  includeReturnType: boolean;
  
  /** Include modifiers */
  includeModifiers: boolean;
  
  /** Maximum signature length */
  maxLength: number;
}

/**
 * Summary generation configuration
 */
export interface SummaryConfig {
  /** Summary templates by node type */
  templates: Record<NodeType, string>;
  
  /** Maximum summary length */
  maxLength: number;
  
  /** Include parameter descriptions */
  includeParameters: boolean;
  
  /** Use heuristics for purpose inference */
  usePurposeInference: boolean;
}

/**
 * Source snippet configuration
 */
export interface SnippetConfig {
  /** Maximum lines to include */
  maxLines: number;
  
  /** Context lines before the node */
  contextBefore: number;
  
  /** Context lines after the node */
  contextAfter: number;
  
  /** Whether to preserve formatting */
  preserveFormatting: boolean;
  
  /** Truncation indicator */
  truncationIndicator: string;
}

/**
 * Complexity analysis configuration
 */
export interface ComplexityConfig {
  /** Maximum complexity score (default: 50) */
  maxComplexity: number;
  
  /** Decision point weights by type */
  decisionWeights: Record<string, number>;
  
  /** Language-specific complexity rules */
  languageRules: Record<string, ComplexityRules>;
}

/**
 * Language-specific complexity calculation rules
 */
export interface ComplexityRules {
  /** Node types that contribute to complexity */
  complexityNodes: string[];
  
  /** Weight multipliers for nested structures */
  nestingMultipliers: Record<string, number>;
  
  /** Special handling rules */
  specialRules: Record<string, (node: any) => number>;
}

/**
 * Dependency analysis configuration
 */
export interface DependencyConfig {
  /** Track import symbols */
  trackImports: boolean;
  
  /** Track function calls */
  trackCalls: boolean;
  
  /** Track namespaced calls */
  trackNamespacedCalls: boolean;
  
  /** Resolve cross-file references */
  resolveCrossFile: boolean;
}

/**
 * Complete annotation configuration
 */
export interface AnnotationConfig {
  signature: SignatureConfig;
  summary: SummaryConfig;
  snippet: SnippetConfig;
  complexity: ComplexityConfig;
  dependency: DependencyConfig;
  
  /** Performance settings */
  performance: {
    batchSize: number;
    maxConcurrency: number;
    progressReporting: boolean;
  };
  
  /** Output settings */
  output: {
    atomicWrites: boolean;
    validateSchema: boolean;
    prettifyJson: boolean;
  };
}

/**
 * Default annotation configuration
 */
export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
  signature: {
    includeParameterNames: true,
    includeReturnType: true,
    includeModifiers: true,
    maxLength: 200
  },
  summary: {
    templates: {
      [NodeType.FUNCTION]: 'Function {name} {purpose} with parameters: {params}',
      [NodeType.CLASS]: 'Class {name} {description} implementing {interfaces}',
      [NodeType.METHOD]: 'Method {name} in {className} {purpose}',
      [NodeType.INTERFACE]: 'Interface {name} defining {members}',
      [NodeType.ENUM]: 'Enum {name} with values: {values}',
      [NodeType.VARIABLE]: 'Variable {name} of type {type} {usage}',
      [NodeType.PROPERTY]: 'Property {name} of type {type}',
      [NodeType.CONSTRUCTOR]: 'Constructor for {className}',
      [NodeType.GETTER]: 'Getter for {name}',
      [NodeType.SETTER]: 'Setter for {name}',
      [NodeType.ARROW_FUNCTION]: 'Arrow function {purpose}',
      [NodeType.MODULE]: 'Module {name} containing {exports}',
      [NodeType.NAMESPACE]: 'Namespace {name} organizing {members}',
      [NodeType.TYPE_ALIAS]: 'Type alias {name} defining {type}',
      [NodeType.IMPORT]: 'Import {symbols} from {source}',
      [NodeType.EXPORT]: 'Export {symbols}',
      [NodeType.DECORATOR]: 'Decorator {name}',
      [NodeType.FIELD]: 'Field {name} of type {type}',
      [NodeType.PARAMETER]: 'Parameter {name} of type {type}',
      [NodeType.IF_STATEMENT]: 'Conditional statement',
      [NodeType.FOR_LOOP]: 'For loop iteration',
      [NodeType.WHILE_LOOP]: 'While loop condition',
      [NodeType.SWITCH_STATEMENT]: 'Switch statement with cases',
      [NodeType.TRY_CATCH]: 'Try-catch error handling',
      [NodeType.COMMENT]: 'Comment: {content}',
      [NodeType.STRING_LITERAL]: 'String literal',
      [NodeType.FILE]: 'Source file {name}'
    },
    maxLength: 150,
    includeParameters: true,
    usePurposeInference: true
  },
  snippet: {
    maxLines: 10,
    contextBefore: 2,
    contextAfter: 2,
    preserveFormatting: true,
    truncationIndicator: '...'
  },
  complexity: {
    maxComplexity: 50,
    decisionWeights: {
      'if_statement': 1,
      'while_statement': 1,
      'for_statement': 1,
      'switch_statement': 1,
      'case_statement': 1,
      'try_statement': 1,
      'catch_clause': 1,
      'conditional_expression': 1,
      'logical_and': 1,
      'logical_or': 1
    },
    languageRules: {}
  },
  dependency: {
    trackImports: true,
    trackCalls: true,
    trackNamespacedCalls: true,
    resolveCrossFile: false // Disabled by default for performance
  },
  performance: {
    batchSize: 100,
    maxConcurrency: 4,
    progressReporting: true
  },
  output: {
    atomicWrites: true,
    validateSchema: true,
    prettifyJson: true
  }
};