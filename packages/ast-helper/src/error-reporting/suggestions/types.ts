/**
 * @fileoverview Types for error resolution suggestions system
 * @module @ast-copilot-helper/ast-helper/error-reporting/suggestions/types
 */

/**
 * Confidence levels for suggestions
 */
export type SuggestionConfidence = "low" | "medium" | "high" | "critical";

/**
 * Categories of suggestion sources
 */
export type SuggestionSource =
  | "static-analysis"
  | "pattern-matching"
  | "ml-model"
  | "community"
  | "documentation"
  | "history"
  | "context-aware";

/**
 * Types of suggestions
 */
export type SuggestionType =
  | "code-fix"
  | "configuration"
  | "dependency"
  | "environment"
  | "documentation"
  | "debugging"
  | "alternative-approach";

/**
 * Suggestion action types
 */
export interface SuggestionAction {
  type:
    | "code-change"
    | "file-create"
    | "file-delete"
    | "command-run"
    | "config-update"
    | "install-package";
  description: string;
  target?: string;
  content?: string;
  command?: string;
  automated: boolean;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Resolution suggestion structure
 */
export interface ResolutionSuggestion {
  id: string;
  title: string;
  description: string;
  type: SuggestionType;
  source: SuggestionSource;
  confidence: SuggestionConfidence;
  priority: number;

  // Matching information
  relevanceScore: number;
  matchedPatterns: string[];
  contextualFactors: string[];

  // Actions to resolve
  actions: SuggestionAction[];
  prerequisites?: string[];
  sideEffects?: string[];

  // Evidence and sources
  evidence: {
    errorPatterns: string[];
    contextClues: string[];
    similarCases: number;
    successRate: number;
  };

  // Metadata
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  estimatedTime: string;
  resources: Array<{
    type: "documentation" | "tutorial" | "example" | "tool";
    url: string;
    title: string;
  }>;

  // Tracking
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  successCount: number;
  feedbackScore?: number;
}

/**
 * Suggestion generation context
 */
export interface SuggestionContext {
  error: {
    message: string;
    stack?: string;
    type: string;
    category: string;
    operation?: string;
    code?: string;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    projectType?: string;
    dependencies?: Record<string, string>;
    configFiles?: string[];
  };
  codebase: {
    languages: string[];
    frameworks?: string[];
    currentFile?: string;
    recentChanges?: Array<{
      file: string;
      type: "modified" | "added" | "deleted";
      timestamp: string;
    }>;
    relatedFiles?: string[];
  };
  history: {
    similarErrors: number;
    recentPatterns: string[];
    successfulResolutions?: Array<{
      suggestionId: string;
      success: boolean;
      timestamp: string;
    }>;
  };
  user: {
    experienceLevel?: "beginner" | "intermediate" | "advanced" | "expert";
    preferences?: {
      automated: boolean;
      detailed: boolean;
      conservative: boolean;
    };
  };
}

/**
 * Suggestion generator interface
 */
export interface SuggestionGenerator {
  readonly name: string;
  readonly source: SuggestionSource;
  readonly priority: number;
  readonly supportedTypes: string[];

  /**
   * Check if generator can provide suggestions for the given context
   */
  canHandle(context: SuggestionContext): Promise<boolean>;

  /**
   * Generate suggestions for the given context
   */
  generateSuggestions(
    context: SuggestionContext,
  ): Promise<ResolutionSuggestion[]>;

  /**
   * Get confidence score for a specific error pattern
   */
  getConfidenceScore(context: SuggestionContext): Promise<number>;
}

/**
 * Suggestion filtering and ranking options
 */
export interface SuggestionFilters {
  minConfidence?: SuggestionConfidence;
  maxResults?: number;
  preferredSources?: SuggestionSource[];
  excludedTypes?: SuggestionType[];
  userExperience?: "beginner" | "intermediate" | "advanced" | "expert";
  automatedOnly?: boolean;
  includeExperimental?: boolean;
}

/**
 * Suggestion evaluation result
 */
export interface SuggestionEvaluation {
  suggestionId: string;
  applied: boolean;
  success: boolean;
  feedback: "helpful" | "partially-helpful" | "not-helpful" | "harmful";
  userNotes?: string;
  timeToResolve?: number;
  automaticallyApplied: boolean;
  timestamp: string;
}

/**
 * Pattern matching rule for error analysis
 */
export interface ErrorPattern {
  id: string;
  pattern: RegExp | string;
  type: "regex" | "substring" | "exact" | "fuzzy";
  scope: "message" | "stack" | "code" | "all";
  weight: number;
  category: string;
  tags: string[];
  associatedSuggestions: string[];
  lastUpdated: string;
  matchCount: number;
  successRate: number;
}

/**
 * ML model prediction result
 */
export interface MLPrediction {
  suggestionIds: string[];
  confidence: number;
  reasoning: string[];
  features: Record<string, number>;
  modelVersion: string;
  timestamp: string;
}

/**
 * Community suggestion data
 */
export interface CommunitySuggestion {
  id: string;
  errorPattern: string;
  suggestion: Omit<
    ResolutionSuggestion,
    "id" | "createdAt" | "updatedAt" | "usageCount" | "successCount"
  >;
  submittedBy: string;
  votes: number;
  verified: boolean;
  moderatedAt?: string;
  submittedAt: string;
}

/**
 * Configuration for the suggestion engine
 */
export interface SuggestionEngineConfig {
  maxSuggestions: number;
  minConfidenceThreshold: number;
  enableCaching: boolean;
  cacheExpirationMs: number;
  enableMLIntegration: boolean;
  enableCommunityData: boolean;
  generatorTimeout: number;
  parallelGeneration: boolean;
  adaptiveLearning: boolean;
}

/**
 * Result from suggestion engine execution
 */
export interface SuggestionEngineResult {
  suggestions: ResolutionSuggestion[];
  totalProcessingTime: number;
  generatorsUsed: string[];
  cacheHit: boolean;
  mlPredictions: MLPrediction[];
  communityData: CommunitySuggestion[];
  error?: string;
}
