/**
 * Error reporting suggestions system exports
 */

// Main suggestion engine
export { SuggestionEngine } from "./suggestion-engine.js";

// Built-in generators
export { PatternBasedSuggestionGenerator } from "./pattern-generator.js";
export { StaticAnalysisGenerator } from "./static-analysis-generator.js";

// Types
export type {
  // Core interfaces
  SuggestionGenerator,
  ResolutionSuggestion,
  SuggestionContext,
  SuggestionEngineConfig,
  SuggestionEngineResult,

  // Suggestion types
  SuggestionType,
  SuggestionSource,
  SuggestionConfidence,
  SuggestionAction,

  // Pattern and analysis types
  ErrorPattern,
  MLPrediction,
  CommunitySuggestion,
  SuggestionEvaluation,
} from "./types.js";
