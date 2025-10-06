/**
 * Advanced Annotation Features for Issue #150
 * Implements cross-reference detection, contextual relationship mapping,
 * and intelligent code insights
 */

export { CrossReferenceAnalyzer } from "./cross-reference-analyzer.js";
export { SemanticRelationshipMapper } from "./semantic-relationship-mapper.js";
export { IntelligentInsightsEngine } from "./intelligent-insights-engine.js";
export { ContextualAnalyzer } from "./contextual-analyzer.js";
export {
  AdvancedAnnotationHandler,
  DEFAULT_ADVANCED_ANNOTATION_CONFIG,
} from "./handler.js";

export type {
  CrossReference,
  SemanticRelationship,
  CodeInsight,
  ContextualMapping,
  AdvancedAnnotationConfig,
} from "./types.js";

export type { AdvancedAnnotationResults } from "./handler.js";
