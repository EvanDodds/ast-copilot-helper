/**
 * Advanced Annotation Handler - Coordinating component for all advanced features
 * Part of Issue #150 - Advanced Annotation Features
 */

import type { ASTNode } from "../../parser/types.js";
import type { Annotation } from "../types.js";
import type {
  AdvancedAnnotationConfig,
  CrossReference,
  SemanticRelationship,
  CodeInsight,
  ContextualMapping,
} from "./types.js";
import { CrossReferenceAnalyzer } from "./cross-reference-analyzer.js";
import { SemanticRelationshipMapper } from "./semantic-relationship-mapper.js";
import { IntelligentInsightsEngine } from "./intelligent-insights-engine.js";
import { ContextualAnalyzer } from "./contextual-analyzer.js";
import { createLogger } from "../../logging/index.js";

/**
 * Default configuration for advanced annotation features
 */
export const DEFAULT_ADVANCED_ANNOTATION_CONFIG: AdvancedAnnotationConfig = {
  enabled: true,
  crossReference: {
    enabled: true,
    confidenceThreshold: 0.7,
    analyzeImports: true,
    analyzeExports: true,
    cacheResults: true,
  },
  semanticMapping: {
    enabled: true,
    confidenceThreshold: 0.6,
    analyzeDependencies: true,
    analyzeInheritance: true,
  },
  insights: {
    enabled: true,
    generateComplexityInsights: true,
    generatePatternInsights: true,
    generatePerformanceInsights: false,
  },
  contextual: {
    enabled: true,
    analyzeScope: true,
    analyzeDataFlow: false,
    analyzeControlFlow: false,
  },
  performance: {
    maxProcessingTime: 5000, // 5 seconds
    enableCaching: true,
    batchSize: 100,
  },
};

/**
 * Results from advanced annotation analysis
 */
export interface AdvancedAnnotationResults {
  crossReferences: CrossReference[];
  semanticRelationships: SemanticRelationship[];
  insights: CodeInsight[];
  contextualMappings: ContextualMapping[];
  processingTime: number;
  analysisMetadata: {
    totalNodesAnalyzed: number;
    cacheHitRate: number;
    componentsEnabled: string[];
  };
}

/**
 * Advanced Annotation Handler - coordinates all advanced annotation features
 */
export class AdvancedAnnotationHandler {
  private logger = createLogger({ operation: "advanced-annotation-handler" });
  private config: AdvancedAnnotationConfig;
  private crossReferenceAnalyzer: CrossReferenceAnalyzer;
  private semanticMapper: SemanticRelationshipMapper;
  private insightsEngine: IntelligentInsightsEngine;
  private contextualAnalyzer: ContextualAnalyzer;

  constructor(config: Partial<AdvancedAnnotationConfig> = {}) {
    this.config = { ...DEFAULT_ADVANCED_ANNOTATION_CONFIG, ...config };

    // Initialize component analyzers
    this.crossReferenceAnalyzer = new CrossReferenceAnalyzer(
      this.config.crossReference,
    );
    this.semanticMapper = new SemanticRelationshipMapper(
      this.config.semanticMapping,
    );
    this.insightsEngine = new IntelligentInsightsEngine(this.config.insights);
    this.contextualAnalyzer = new ContextualAnalyzer(this.config.contextual);

    this.logger.info("Advanced Annotation Handler initialized", {
      enabled: this.config.enabled,
      components: this.getEnabledComponents(),
    });
  }

  /**
   * Perform advanced annotation analysis on AST nodes
   */
  public async analyzeNodes(
    nodes: ASTNode[],
    sourceText: string,
    filePath: string,
  ): Promise<AdvancedAnnotationResults> {
    if (!this.config.enabled) {
      return this.createEmptyResults();
    }

    const startTime = performance.now();
    const allNodesMap = new Map<string, ASTNode>();

    // Build node map for cross-references
    for (const node of nodes) {
      allNodesMap.set(node.id, node);
    }

    try {
      this.logger.debug("Advanced annotation analysis started", {
        filePath,
        nodeCount: nodes.length,
        components: this.getEnabledComponents(),
      });

      const results: AdvancedAnnotationResults = {
        crossReferences: [],
        semanticRelationships: [],
        insights: [],
        contextualMappings: [],
        processingTime: 0,
        analysisMetadata: {
          totalNodesAnalyzed: nodes.length,
          cacheHitRate: 0,
          componentsEnabled: this.getEnabledComponents(),
        },
      };

      // Process nodes in batches to manage memory and performance
      const batchSize = this.config.performance.batchSize;

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        await this.processBatch(
          batch,
          sourceText,
          filePath,
          allNodesMap,
          results,
        );

        // Check processing time limit
        const currentTime = performance.now() - startTime;
        if (currentTime > this.config.performance.maxProcessingTime) {
          this.logger.warn("Advanced annotation analysis timed out", {
            filePath,
            processingTime: currentTime,
            nodesProcessed: i + batch.length,
          });
          break;
        }
      }

      results.processingTime = performance.now() - startTime;

      this.logger.info("Advanced annotation analysis completed", {
        filePath,
        processingTime: `${results.processingTime.toFixed(2)}ms`,
        crossReferences: results.crossReferences.length,
        semanticRelationships: results.semanticRelationships.length,
        insights: results.insights.length,
        contextualMappings: results.contextualMappings.length,
      });

      return results;
    } catch (error) {
      this.logger.error("Advanced annotation analysis failed", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createEmptyResults();
    }
  }

  /**
   * Process a batch of nodes with all enabled analyzers
   */
  private async processBatch(
    batch: ASTNode[],
    sourceText: string,
    filePath: string,
    allNodesMap: Map<string, ASTNode>,
    results: AdvancedAnnotationResults,
  ): Promise<void> {
    const analysisPromises: Promise<void>[] = [];

    for (const node of batch) {
      // Cross-reference analysis
      if (this.config.crossReference.enabled) {
        analysisPromises.push(
          this.crossReferenceAnalyzer
            .analyzeCrossReferences(node, sourceText, filePath, allNodesMap)
            .then((refs) => {
              results.crossReferences.push(...refs);
            }),
        );
      }

      // Semantic relationship mapping
      if (this.config.semanticMapping.enabled) {
        analysisPromises.push(
          this.semanticMapper
            .mapSemanticRelationships(node, sourceText, filePath, allNodesMap)
            .then((relationships) => {
              results.semanticRelationships.push(...relationships);
            }),
        );
      }

      // Intelligent insights generation
      if (this.config.insights.enabled) {
        analysisPromises.push(
          this.insightsEngine
            .generateInsights(node, sourceText, filePath, allNodesMap)
            .then((insights) => {
              results.insights.push(...insights);
            }),
        );
      }

      // Contextual analysis
      if (this.config.contextual.enabled) {
        analysisPromises.push(
          this.contextualAnalyzer
            .analyzeContext(node, sourceText, filePath, allNodesMap)
            .then((mappings) => {
              results.contextualMappings.push(...mappings);
            }),
        );
      }
    }

    await Promise.all(analysisPromises);
  }

  /**
   * Enhance existing annotations with advanced features
   */
  public async enhanceAnnotations(
    annotations: Annotation[],
    sourceText: string,
    filePath: string,
    allNodes: Map<string, ASTNode>,
  ): Promise<Annotation[]> {
    if (!this.config.enabled) {
      return annotations;
    }

    this.logger.debug("Enhancing annotations with advanced features", {
      filePath,
      annotationCount: annotations.length,
    });

    const enhancedAnnotations: Annotation[] = [];

    for (const annotation of annotations) {
      const enhanced = { ...annotation };

      // Find the corresponding AST node
      const node = allNodes.get(annotation.nodeId);
      if (node) {
        // Add cross-reference information
        if (this.config.crossReference.enabled) {
          const crossRefs =
            await this.crossReferenceAnalyzer.analyzeCrossReferences(
              node,
              sourceText,
              filePath,
              allNodes,
            );
          if (crossRefs.length > 0) {
            enhanced.tags = [...enhanced.tags, "cross-referenced"];
            if (crossRefs.some((ref) => ref.targetFilePath !== filePath)) {
              enhanced.tags = [...enhanced.tags, "external-refs"];
            }
          }
        }

        // Add semantic insights
        if (this.config.insights.enabled) {
          const insights = await this.insightsEngine.generateInsights(
            node,
            sourceText,
            filePath,
            allNodes,
          );
          if (insights.length > 0) {
            enhanced.tags = [...enhanced.tags, "insights-available"];
            const performanceInsights = insights.filter(
              (i) => i.insightType === "performance",
            );
            if (performanceInsights.length > 0) {
              enhanced.tags = [...enhanced.tags, "performance-insights"];
            }
          }
        }
      }

      enhancedAnnotations.push(enhanced);
    }

    return enhancedAnnotations;
  }

  /**
   * Get enabled component names
   */
  private getEnabledComponents(): string[] {
    const components: string[] = [];

    if (this.config.crossReference.enabled) {
      components.push("cross-reference");
    }
    if (this.config.semanticMapping.enabled) {
      components.push("semantic-mapping");
    }
    if (this.config.insights.enabled) {
      components.push("insights");
    }
    if (this.config.contextual.enabled) {
      components.push("contextual");
    }

    return components;
  }

  /**
   * Create empty results structure
   */
  private createEmptyResults(): AdvancedAnnotationResults {
    return {
      crossReferences: [],
      semanticRelationships: [],
      insights: [],
      contextualMappings: [],
      processingTime: 0,
      analysisMetadata: {
        totalNodesAnalyzed: 0,
        cacheHitRate: 0,
        componentsEnabled: [],
      },
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AdvancedAnnotationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info("Advanced annotation configuration updated", {
      enabled: this.config.enabled,
      components: this.getEnabledComponents(),
    });
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.crossReferenceAnalyzer.clearCache();
    this.logger.debug("Advanced annotation caches cleared");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    crossReference: { size: number; symbolTableSize: number };
  } {
    return {
      crossReference: this.crossReferenceAnalyzer.getCacheStats(),
    };
  }
}
