/**
 * Main suggestion engine that orchestrates different suggestion generators
 */

import type {
  SuggestionGenerator,
  SuggestionContext,
  ResolutionSuggestion,
  SuggestionEngineConfig,
  SuggestionEngineResult,
  MLPrediction,
  CommunitySuggestion
} from './types.js';

import { PatternBasedSuggestionGenerator } from './pattern-generator.js';
import { StaticAnalysisGenerator } from './static-analysis-generator.js';

/**
 * Generator performance metrics
 */
interface GeneratorMetrics {
  generatorName: string;
  totalCalls: number;
  successfulSuggestions: number;
  averageConfidence: number;
  averageProcessingTime: number;
  lastUsed: string;
}

/**
 * Suggestion cache entry
 */
interface CachedSuggestion {
  suggestions: ResolutionSuggestion[];
  timestamp: number;
  contextHash: string;
}

/**
 * Main suggestion engine that coordinates multiple suggestion generators
 * and provides intelligent suggestion ranking and filtering
 */
export class SuggestionEngine {
  private generators: Map<string, SuggestionGenerator> = new Map();
  private metrics: Map<string, GeneratorMetrics> = new Map();
  private cache: Map<string, CachedSuggestion> = new Map();
  private config: SuggestionEngineConfig;

  constructor(config?: Partial<SuggestionEngineConfig>) {
    this.config = {
      maxSuggestions: config?.maxSuggestions ?? 10,
      minConfidenceThreshold: config?.minConfidenceThreshold ?? 0.3,
      enableCaching: config?.enableCaching ?? true,
      cacheExpirationMs: config?.cacheExpirationMs ?? 300000, // 5 minutes
      enableMLIntegration: config?.enableMLIntegration ?? false,
      enableCommunityData: config?.enableCommunityData ?? false,
      generatorTimeout: config?.generatorTimeout ?? 5000,
      parallelGeneration: config?.parallelGeneration ?? true,
      adaptiveLearning: config?.adaptiveLearning ?? true
    };

    this.initializeDefaultGenerators();
  }

  /**
   * Initialize default suggestion generators
   */
  private initializeDefaultGenerators(): void {
    // Add built-in generators
    this.addGenerator(new PatternBasedSuggestionGenerator());
    this.addGenerator(new StaticAnalysisGenerator());

    console.log(`SuggestionEngine initialized with ${this.generators.size} generators`);
  }

  /**
   * Add a suggestion generator to the engine
   */
  addGenerator(generator: SuggestionGenerator): void {
    this.generators.set(generator.name, generator);
    
    // Initialize metrics for new generator
    this.metrics.set(generator.name, {
      generatorName: generator.name,
      totalCalls: 0,
      successfulSuggestions: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      lastUsed: new Date().toISOString()
    });

    console.log(`Added generator: ${generator.name} (priority: ${generator.priority})`);
  }

  /**
   * Remove a suggestion generator
   */
  removeGenerator(generatorName: string): boolean {
    const removed = this.generators.delete(generatorName);
    if (removed) {
      this.metrics.delete(generatorName);
      console.log(`Removed generator: ${generatorName}`);
    }
    return removed;
  }

  /**
   * Generate suggestions for the given context
   */
  async generateSuggestions(context: SuggestionContext): Promise<SuggestionEngineResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedSuggestions(context);
        if (cached) {
          return {
            suggestions: cached,
            totalProcessingTime: Date.now() - startTime,
            generatorsUsed: [],
            cacheHit: true,
            mlPredictions: [],
            communityData: []
          };
        }
      }

      // Get applicable generators
      const applicableGenerators = await this.getApplicableGenerators(context);
      
      if (applicableGenerators.length === 0) {
        return {
          suggestions: [],
          totalProcessingTime: Date.now() - startTime,
          generatorsUsed: [],
          cacheHit: false,
          mlPredictions: [],
          communityData: []
        };
      }

      // Generate suggestions from all applicable generators
      const generatorResults = await this.executeGenerators(applicableGenerators, context);
      
      // Combine and rank all suggestions
      let allSuggestions: ResolutionSuggestion[] = [];
      const generatorsUsed: string[] = [];

      for (const result of generatorResults) {
        allSuggestions.push(...result.suggestions);
        generatorsUsed.push(result.generatorName);
        this.updateGeneratorMetrics(result.generatorName, result.suggestions, result.processingTime);
      }

      // Apply ML predictions if enabled
      const mlPredictions: MLPrediction[] = [];
      if (this.config.enableMLIntegration) {
        const predictions = await this.applyMLPredictions(allSuggestions, context);
        mlPredictions.push(...predictions);
        allSuggestions = this.adjustSuggestionsWithML(allSuggestions, predictions);
      }

      // Enrich with community data if enabled
      const communityData: CommunitySuggestion[] = [];
      if (this.config.enableCommunityData) {
        const communityResults = await this.enrichWithCommunityData(allSuggestions, context);
        communityData.push(...communityResults);
        allSuggestions = this.adjustSuggestionsWithCommunity(allSuggestions, communityResults);
      }

      // Rank and filter suggestions
      const rankedSuggestions = await this.rankAndFilterSuggestions(allSuggestions, context);

      // Cache results
      if (this.config.enableCaching) {
        this.cacheResults(context, rankedSuggestions);
      }

      const result: SuggestionEngineResult = {
        suggestions: rankedSuggestions.slice(0, this.config.maxSuggestions),
        totalProcessingTime: Date.now() - startTime,
        generatorsUsed,
        cacheHit: false,
        mlPredictions,
        communityData
      };

      return result;

    } catch (error) {
      console.error('Error generating suggestions:', error);
      
      return {
        suggestions: [],
        totalProcessingTime: Date.now() - startTime,
        generatorsUsed: [],
        cacheHit: false,
        mlPredictions: [],
        communityData: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get generators that can handle the given context
   */
  private async getApplicableGenerators(context: SuggestionContext): Promise<SuggestionGenerator[]> {
    const applicable: SuggestionGenerator[] = [];

    for (const generator of this.generators.values()) {
      try {
        const canHandle = await Promise.race([
          generator.canHandle(context),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Generator canHandle timeout')), 1000)
          )
        ]);

        if (canHandle) {
          applicable.push(generator);
        }
      } catch (error) {
        console.warn(`Generator ${generator.name} canHandle check failed:`, error);
      }
    }

    // Sort by priority (higher priority first)
    return applicable.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Execute suggestion generators
   */
  private async executeGenerators(
    generators: SuggestionGenerator[], 
    context: SuggestionContext
  ): Promise<Array<{
    generatorName: string;
    suggestions: ResolutionSuggestion[];
    processingTime: number;
    error?: string;
  }>> {
    const results = [];

    if (this.config.parallelGeneration) {
      // Execute generators in parallel
      const promises = generators.map(async (generator) => {
        const startTime = Date.now();
        
        try {
          const suggestions = await Promise.race([
            generator.generateSuggestions(context),
            new Promise<ResolutionSuggestion[]>((_, reject) => 
              setTimeout(() => reject(new Error('Generator timeout')), this.config.generatorTimeout)
            )
          ]);

          return {
            generatorName: generator.name,
            suggestions: suggestions || [],
            processingTime: Date.now() - startTime
          };

        } catch (error) {
          console.warn(`Generator ${generator.name} failed:`, error);
          return {
            generatorName: generator.name,
            suggestions: [],
            processingTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      results.push(...await Promise.all(promises));
    } else {
      // Execute generators sequentially
      for (const generator of generators) {
        const startTime = Date.now();
        
        try {
          const suggestions = await generator.generateSuggestions(context);
          
          results.push({
            generatorName: generator.name,
            suggestions: suggestions || [],
            processingTime: Date.now() - startTime
          });

        } catch (error) {
          console.warn(`Generator ${generator.name} failed:`, error);
          results.push({
            generatorName: generator.name,
            suggestions: [],
            processingTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }

  /**
   * Apply ML predictions to suggestions (placeholder for future ML integration)
   */
  private async applyMLPredictions(
    suggestions: ResolutionSuggestion[], 
    context: SuggestionContext
  ): Promise<MLPrediction[]> {
    // Placeholder for ML integration
    // In a real implementation, this would call ML models to predict suggestion effectiveness
    
    if (suggestions.length === 0) {
return [];
}

    const prediction: MLPrediction = {
      suggestionIds: suggestions.map(s => s.id),
      confidence: Math.random() * 0.4 + 0.6, // Random between 0.6-1.0
      reasoning: [
        `Based on error type: ${context.error.type}`,
        `User experience level: ${context.user.experienceLevel || 'unknown'}`,
        `Code context: ${context.codebase.languages.join(', ')}`
      ],
      features: suggestions.reduce((acc, suggestion, index) => {
        acc[`suggestion_${index}_type`] = suggestion.type === 'code-fix' ? 1 : 0;
        acc[`suggestion_${index}_priority`] = suggestion.priority / 100;
        return acc;
      }, {} as Record<string, number>),
      modelVersion: 'placeholder-v1.0.0',
      timestamp: new Date().toISOString()
    };

    return [prediction];
  }

  /**
   * Enrich suggestions with community data (placeholder)
   */
  private async enrichWithCommunityData(
    _suggestions: ResolutionSuggestion[], 
    _context: SuggestionContext
  ): Promise<CommunitySuggestion[]> {
    // Placeholder for community data integration
    // In a real implementation, this would query Stack Overflow, GitHub issues, etc.
    
    return []; // Return empty array for now
  }

  /**
   * Adjust suggestions based on ML predictions
   */
  private adjustSuggestionsWithML(
    suggestions: ResolutionSuggestion[], 
    predictions: MLPrediction[]
  ): ResolutionSuggestion[] {
    if (predictions.length === 0) {
return suggestions;
}
    
    const prediction = predictions[0]!; // Use the first (and likely only) prediction
    const suggestionIds = new Set(prediction.suggestionIds);

    return suggestions.map(suggestion => {
      if (suggestionIds.has(suggestion.id)) {
        // Adjust relevance score based on ML prediction confidence
        const adjustedScore = suggestion.relevanceScore * prediction.confidence;
        
        return {
          ...suggestion,
          relevanceScore: Math.min(adjustedScore, 1.0),
          contextualFactors: [
            ...suggestion.contextualFactors,
            `ML confidence: ${(prediction.confidence * 100).toFixed(1)}%`,
            `ML reasoning: ${prediction.reasoning[0] || 'Model prediction available'}`
          ]
        };
      }
      return suggestion;
    });
  }

  /**
   * Adjust suggestions based on community data
   */
  private adjustSuggestionsWithCommunity(
    suggestions: ResolutionSuggestion[], 
    _communityData: CommunitySuggestion[]
  ): ResolutionSuggestion[] {
    // Placeholder for community data integration
    return suggestions;
  }

  /**
   * Rank and filter suggestions based on various criteria
   */
  private async rankAndFilterSuggestions(
    suggestions: ResolutionSuggestion[], 
    context: SuggestionContext
  ): Promise<ResolutionSuggestion[]> {
    
    // Filter out low confidence suggestions
    const filtered = suggestions.filter(suggestion => 
      suggestion.relevanceScore >= this.config.minConfidenceThreshold
    );

    // Calculate composite scores for ranking
    const scored = filtered.map(suggestion => ({
      suggestion,
      score: this.calculateCompositeScore(suggestion, context)
    }));

    // Sort by composite score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Apply diversity filtering to avoid too many similar suggestions
    const diverse = this.applyDiversityFilter(scored.map(s => s.suggestion));

    return diverse;
  }

  /**
   * Calculate composite score for suggestion ranking
   */
  private calculateCompositeScore(suggestion: ResolutionSuggestion, context: SuggestionContext): number {
    let score = 0;

    // Base score from relevance
    score += suggestion.relevanceScore * 0.4;

    // Confidence boost
    const confidenceWeight = this.confidenceToNumber(suggestion.confidence);
    score += confidenceWeight * 0.3;

    // Priority boost
    score += (suggestion.priority / 100) * 0.2;

    // Type preference (prefer automated fixes)
    if (suggestion.type === 'code-fix') {
score += 0.05;
}
    if (suggestion.type === 'dependency') {
score += 0.03;
}

    // User experience adjustment
    if (context.user.experienceLevel === 'beginner' && suggestion.difficulty === 'beginner') {
      score += 0.05;
    } else if (context.user.experienceLevel === 'advanced' && suggestion.difficulty === 'advanced') {
      score += 0.03;
    }

    // Recency boost for recently successful patterns
    if (suggestion.evidence?.successRate && suggestion.evidence.successRate > 0.8) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Apply diversity filter to avoid too many similar suggestions
   */
  private applyDiversityFilter(suggestions: ResolutionSuggestion[]): ResolutionSuggestion[] {
    const diverse: ResolutionSuggestion[] = [];
    const seenTypes = new Set<string>();
    const seenTitles = new Set<string>();

    for (const suggestion of suggestions) {
      const typeKey = `${suggestion.type}_${suggestion.source}`;
      const titleKey = suggestion.title.toLowerCase();

      // Skip if we already have too many of this type
      const typeCount = diverse.filter(s => `${s.type}_${s.source}` === typeKey).length;
      if (typeCount >= 3) {
continue;
}

      // Skip if we have a very similar title
      if (seenTitles.has(titleKey)) {
continue;
}

      diverse.push(suggestion);
      seenTypes.add(typeKey);
      seenTitles.add(titleKey);

      // Stop if we have enough diverse suggestions
      if (diverse.length >= this.config.maxSuggestions * 2) {
break;
}
    }

    return diverse;
  }

  /**
   * Get cached suggestions if available and valid
   */
  private getCachedSuggestions(context: SuggestionContext): ResolutionSuggestion[] | null {
    const contextHash = this.createContextHash(context);
    const cached = this.cache.get(contextHash);

    if (cached && Date.now() - cached.timestamp < this.config.cacheExpirationMs) {
      return cached.suggestions;
    }

    // Remove expired cache entries
    if (cached) {
      this.cache.delete(contextHash);
    }

    return null;
  }

  /**
   * Cache suggestion results
   */
  private cacheResults(context: SuggestionContext, suggestions: ResolutionSuggestion[]): void {
    const contextHash = this.createContextHash(context);
    this.cache.set(contextHash, {
      suggestions,
      timestamp: Date.now(),
      contextHash
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Create a hash of the context for caching
   */
  private createContextHash(context: SuggestionContext): string {
    const relevant = {
      errorMessage: context.error.message,
      errorType: context.error.type,
      errorCode: context.error.code,
      currentFile: context.codebase.currentFile,
      languages: context.codebase.languages.sort(),
      nodeVersion: context.environment.nodeVersion
    };

    return Buffer.from(JSON.stringify(relevant)).toString('base64').substring(0, 32);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.config.cacheExpirationMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Update generator metrics
   */
  private updateGeneratorMetrics(
    generatorName: string, 
    suggestions: ResolutionSuggestion[], 
    processingTime: number
  ): void {
    const metrics = this.metrics.get(generatorName);
    if (!metrics) {
return;
}

    metrics.totalCalls++;
    metrics.successfulSuggestions += suggestions.length;
    metrics.lastUsed = new Date().toISOString();

    // Update average processing time
    metrics.averageProcessingTime = 
      (metrics.averageProcessingTime + processingTime) / 2;

    // Update average confidence
    if (suggestions.length > 0) {
      const avgConfidence = suggestions.reduce((sum, s) => 
        sum + this.confidenceToNumber(s.confidence), 0
      ) / suggestions.length;
      
      metrics.averageConfidence = 
        (metrics.averageConfidence + avgConfidence) / 2;
    }
  }

  /**
   * Convert confidence string to number
   */
  private confidenceToNumber(confidence: string): number {
    switch (confidence) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.4;
      default: return 0.5;
    }
  }

  /**
   * Get generator metrics
   */
  getGeneratorMetrics(): GeneratorMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get engine configuration
   */
  getConfiguration(): SuggestionEngineConfig {
    return { ...this.config };
  }

  /**
   * Update engine configuration
   */
  updateConfiguration(newConfig: Partial<SuggestionEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('SuggestionEngine configuration updated');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('SuggestionEngine cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalEntries: number;
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses to calculate
      totalEntries: this.cache.size
    };
  }

  /**
   * Record suggestion feedback for adaptive learning
   */
  recordFeedback(
    suggestionId: string, 
    feedback: {
      helpful: boolean;
      applied: boolean;
      successful?: boolean;
      timeToResolve?: number;
      userRating?: number;
      comments?: string;
    }
  ): void {
    if (this.config.adaptiveLearning) {
      // Placeholder for feedback recording
      // In a real implementation, this would update ML models or pattern weights
      console.log(`Recorded feedback for suggestion ${suggestionId}:`, feedback);
    }
  }

  /**
   * Get suggestion engine statistics
   */
  getEngineStats(): {
    totalSuggestions: number;
    totalProcessingTime: number;
    averageResponseTime: number;
    generatorCount: number;
    cacheHitRate: number;
  } {
    const metrics = Array.from(this.metrics.values());
    const totalSuggestions = metrics.reduce((sum, m) => sum + m.successfulSuggestions, 0);
    const totalCalls = metrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const avgProcessingTime = metrics.reduce((sum, m) => sum + m.averageProcessingTime, 0) / metrics.length;

    return {
      totalSuggestions,
      totalProcessingTime: totalCalls * avgProcessingTime,
      averageResponseTime: avgProcessingTime,
      generatorCount: this.generators.size,
      cacheHitRate: 0 // Would need to track hits to calculate
    };
  }
}