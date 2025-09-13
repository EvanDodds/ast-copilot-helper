/**
 * Annotation system for AST nodes
 * Provides comprehensive metadata, signatures, and semantic analysis
 */

// Main engine
export { AnnotationEngine } from './annotation-engine.js';

// Core types and interfaces
export type {
  Annotation,
  Parameter,
  SignatureExtractor,
  AnnotationConfig,
  DependencyInfo,
  DependencyAnalysisConfig,
  SummaryTemplate,
  SummaryPattern,
  SummaryGenerationConfig
} from './types.js';

export {
  SemanticTag,
  PurposeCategory,
  DependencyType,
  DEFAULT_ANNOTATION_CONFIG
} from './types.js';

// Language-specific extractors
export {
  TypeScriptExtractor,
  JavaScriptExtractor,
  ExtractionUtils
} from './extractors/index.js';

// Analysis components
export { ComplexityAnalyzer } from './complexity-analyzer.js';
export { DependencyAnalyzer } from './dependency-analyzer.js';
export { SummaryGenerator } from './summary-generator.js';