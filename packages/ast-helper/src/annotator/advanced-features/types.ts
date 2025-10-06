/**
 * Type definitions for Advanced Annotation Features
 * Part of Issue #150 - Advanced Annotation Features
 */

/**
 * Cross-reference between code elements
 */
export interface CrossReference {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceFilePath: string;
  targetFilePath: string;
  referenceType: CrossReferenceType;
  confidence: number; // 0-1 confidence score
  location: {
    line: number;
    column: number;
    length: number;
  };
  context: string; // Code context around the reference
  metadata?: {
    isDefinition?: boolean;
    isUsage?: boolean;
    isImport?: boolean;
    isExport?: boolean;
    isTypeReference?: boolean;
    accessLevel?: "public" | "private" | "protected" | "internal";
  };
}

/**
 * Types of cross-references
 */
export enum CrossReferenceType {
  FUNCTION_CALL = "function_call",
  METHOD_CALL = "method_call",
  VARIABLE_REFERENCE = "variable_reference",
  TYPE_REFERENCE = "type_reference",
  CLASS_INHERITANCE = "class_inheritance",
  INTERFACE_IMPLEMENTATION = "interface_implementation",
  IMPORT_DECLARATION = "import_declaration",
  EXPORT_DECLARATION = "export_declaration",
  PROPERTY_ACCESS = "property_access",
  CONSTRUCTOR_CALL = "constructor_call",
  GENERIC_PARAMETER = "generic_parameter",
  ANNOTATION_REFERENCE = "annotation_reference",
  MODULE_REFERENCE = "module_reference",
  NAMESPACE_REFERENCE = "namespace_reference",
}

/**
 * Semantic relationship between code elements
 */
export interface SemanticRelationship {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: SemanticRelationshipType;
  strength: number; // 0-1 strength of the relationship
  bidirectional: boolean;
  metadata: {
    description: string;
    examples: string[];
    implications: string[];
    suggestedActions?: string[];
  };
}

/**
 * Types of semantic relationships
 */
export enum SemanticRelationshipType {
  DEPENDENCY = "dependency",
  COMPOSITION = "composition",
  AGGREGATION = "aggregation",
  ASSOCIATION = "association",
  INHERITANCE = "inheritance",
  IMPLEMENTATION = "implementation",
  COLLABORATION = "collaboration",
  CONTROL_FLOW = "control_flow",
  DATA_FLOW = "data_flow",
  TEMPORAL = "temporal",
  FUNCTIONAL = "functional",
  ARCHITECTURAL = "architectural",
}

/**
 * Intelligent code insight
 */
export interface CodeInsight {
  id: string;
  nodeId: string;
  filePath: string;
  insightType: CodeInsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation: string;
  confidence: number; // 0-1 confidence in the insight
  impact: InsightImpact;
  evidence: {
    codePatterns: string[];
    metrics: Record<string, number>;
    relatedNodes: string[];
  };
  actionable: boolean;
  tags: string[];
}

/**
 * Types of code insights
 */
export enum CodeInsightType {
  DESIGN_PATTERN = "design_pattern",
  CODE_SMELL = "code_smell",
  OPTIMIZATION_OPPORTUNITY = "optimization_opportunity",
  BEST_PRACTICE = "best_practice",
  SECURITY_CONCERN = "security_concern",
  MAINTAINABILITY = "maintainability",
  PERFORMANCE = "performance",
  REUSABILITY = "reusability",
  TESTABILITY = "testability",
  READABILITY = "readability",
  ARCHITECTURAL = "architectural",
  DEPENDENCY_ISSUE = "dependency_issue",
}

/**
 * Insight severity levels
 */
export enum InsightSeverity {
  INFO = "info",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Impact of implementing the insight
 */
export interface InsightImpact {
  codeQuality: number; // -5 to +5 impact on code quality
  performance: number; // -5 to +5 impact on performance
  maintainability: number; // -5 to +5 impact on maintainability
  security: number; // -5 to +5 impact on security
  effort: number; // 1-5 effort required to implement
}

/**
 * Contextual mapping of code elements
 */
export interface ContextualMapping {
  nodeId: string;
  filePath: string;
  context: CodeContext;
  relationships: ContextualRelationship[];
  usage: UsagePattern[];
  lifecycle: LifecyclePhase[];
}

/**
 * Code context information
 */
export interface CodeContext {
  domain: string; // Business domain (auth, payment, etc.)
  layer: ArchitecturalLayer; // Architectural layer
  responsibility: string; // Primary responsibility
  scope: CodeScope; // Scope of influence
  coupling: CouplingMetrics;
  cohesion: CohesionMetrics;
}

/**
 * Architectural layers
 */
export enum ArchitecturalLayer {
  PRESENTATION = "presentation",
  SERVICE = "service",
  BUSINESS = "business",
  DATA_ACCESS = "data_access",
  INFRASTRUCTURE = "infrastructure",
  UTILITY = "utility",
  CONFIGURATION = "configuration",
  TEST = "test",
}

/**
 * Code scope levels
 */
export enum CodeScope {
  GLOBAL = "global",
  MODULE = "module",
  PACKAGE = "package",
  CLASS = "class",
  METHOD = "method",
  BLOCK = "block",
}

/**
 * Contextual relationship
 */
export interface ContextualRelationship {
  relatedNodeId: string;
  relationType: ContextualRelationType;
  strength: number;
  description: string;
}

/**
 * Types of contextual relationships
 */
export enum ContextualRelationType {
  CONCEPTUAL = "conceptual",
  FUNCTIONAL = "functional",
  STRUCTURAL = "structural",
  BEHAVIORAL = "behavioral",
  EVOLUTIONARY = "evolutionary",
}

/**
 * Usage pattern information
 */
export interface UsagePattern {
  pattern: string;
  frequency: number;
  contexts: string[];
  examples: string[];
}

/**
 * Code lifecycle phases
 */
export interface LifecyclePhase {
  phase: LifecycleStage;
  timestamp: string;
  confidence: number;
  indicators: string[];
}

/**
 * Lifecycle stages
 */
export enum LifecycleStage {
  PROTOTYPE = "prototype",
  DEVELOPMENT = "development",
  STABLE = "stable",
  MATURE = "mature",
  LEGACY = "legacy",
  DEPRECATED = "deprecated",
}

/**
 * Coupling metrics
 */
export interface CouplingMetrics {
  afferent: number; // Incoming dependencies
  efferent: number; // Outgoing dependencies
  instability: number; // Efferent / (Afferent + Efferent)
  abstractness: number; // Abstract classes / Total classes
}

/**
 * Cohesion metrics
 */
export interface CohesionMetrics {
  functionalCohesion: number; // 0-1
  sequentialCohesion: number; // 0-1
  communicationalCohesion: number; // 0-1
  proceduralCohesion: number; // 0-1
  temporalCohesion: number; // 0-1
  logicalCohesion: number; // 0-1
  coincidentalCohesion: number; // 0-1
}

/**
 * Configuration for advanced annotation features
 */
export interface AdvancedAnnotationConfig {
  enabled: boolean;
  crossReference: {
    enabled: boolean;
    confidenceThreshold: number;
    analyzeImports: boolean;
    analyzeExports: boolean;
    cacheResults: boolean;
  };
  semanticMapping: {
    enabled: boolean;
    confidenceThreshold: number;
    analyzeDependencies: boolean;
    analyzeInheritance: boolean;
  };
  insights: {
    enabled: boolean;
    generateComplexityInsights: boolean;
    generatePatternInsights: boolean;
    generatePerformanceInsights: boolean;
  };
  contextual: {
    enabled: boolean;
    analyzeScope: boolean;
    analyzeDataFlow: boolean;
    analyzeControlFlow: boolean;
  };
  performance: {
    maxProcessingTime: number;
    enableCaching: boolean;
    batchSize: number;
  };
}

/**
 * Result from advanced annotation processing
 */
export interface AdvancedAnnotationResult {
  nodeId: string;
  filePath: string;
  crossReferences: CrossReference[];
  semanticRelationships: SemanticRelationship[];
  insights: CodeInsight[];
  contextualMapping: ContextualMapping;
  processingTime: number;
  confidence: number;
  metadata: {
    version: string;
    timestamp: string;
    features: string[];
    errors: string[];
  };
}
