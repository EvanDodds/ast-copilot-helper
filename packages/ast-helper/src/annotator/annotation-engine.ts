import type { ASTNode } from "../parser/types.js";
import type { Annotation, Parameter, AnnotationConfig } from "./types.js";
import {
  DEFAULT_ANNOTATION_CONFIG,
  SemanticTag,
  PurposeCategory,
} from "./types.js";
import {
  TypeScriptExtractor,
  JavaScriptExtractor,
  PythonExtractor,
  JavaExtractor,
  CSharpExtractor,
  GoExtractor,
  RustExtractor,
  CppExtractor,
  PhpExtractor,
  RubyExtractor,
  KotlinExtractor,
  SwiftExtractor,
  DartExtractor,
  ScalaExtractor,
  LuaExtractor,
  BashExtractor,
} from "./extractors/index.js";
import { ComplexityAnalyzer } from "./complexity-analyzer.js";
import { DependencyAnalyzer } from "./dependency-analyzer.js";
import { SummaryGenerator } from "./summary-generator.js";
import type { SignatureExtractor } from "./types.js";

/**
 * Main annotation engine that orchestrates all annotation components
 * Provides a unified interface for generating comprehensive AST node annotations
 */
export class AnnotationEngine {
  private config: AnnotationConfig;
  private extractors: Map<string, SignatureExtractor> = new Map();
  private complexityAnalyzer: ComplexityAnalyzer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private summaryGenerator: SummaryGenerator;

  // Caching infrastructure
  private annotationCache: Map<string, Annotation> = new Map();
  private performanceMetrics: Map<string, number> = new Map();
  private errorLog: Array<{ timestamp: Date; error: Error; context: string }> =
    [];

  constructor(config: Partial<AnnotationConfig> = {}) {
    this.config = { ...DEFAULT_ANNOTATION_CONFIG, ...config };

    // Initialize language-specific extractors
    // Tier 1 extractors (Enterprise Priority)
    this.extractors.set("typescript", new TypeScriptExtractor());
    this.extractors.set("javascript", new JavaScriptExtractor());
    this.extractors.set("python", new PythonExtractor());
    this.extractors.set("java", new JavaExtractor());
    this.extractors.set("csharp", new CSharpExtractor());
    this.extractors.set("go", new GoExtractor());

    // Tier 2 extractors (Developer Priority)
    this.extractors.set("rust", new RustExtractor());
    this.extractors.set("cpp", new CppExtractor());
    this.extractors.set("c", new CppExtractor()); // Both C and C++ use CppExtractor
    this.extractors.set("php", new PhpExtractor());
    this.extractors.set("ruby", new RubyExtractor());
    this.extractors.set("kotlin", new KotlinExtractor());

    // Tier 3 extractors (Specialized Priority)
    this.extractors.set("swift", new SwiftExtractor());
    this.extractors.set("dart", new DartExtractor());
    this.extractors.set("scala", new ScalaExtractor());
    this.extractors.set("lua", new LuaExtractor());
    this.extractors.set("bash", new BashExtractor());

    // Initialize analysis components
    this.complexityAnalyzer = new ComplexityAnalyzer({
      maxComplexity: 50,
      nestingWeight: 1.5,
      optimizeForLarge: true,
    });

    this.dependencyAnalyzer = new DependencyAnalyzer({
      includeDynamicImports: true,
      includeTypeImports: true,
      detectCycles: true,
      maxDepth: 5,
    });

    this.summaryGenerator = new SummaryGenerator({
      maxSummaryLength: this.config.maxSnippetLines * 3, // Rough estimate
      includeComplexity: true,
      includeDependencies: true,
      includeSemanticTags: true,
      usePatternMatching: true,
      enableCaching: true,
    });
  }

  /**
   * Generates a comprehensive annotation for an AST node
   * This is the main entry point for the annotation system
   */
  public async generateAnnotation(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<Annotation> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(node, filePath);

    try {
      // Check cache first
      if (this.annotationCache.has(cacheKey)) {
        const cached = this.annotationCache.get(cacheKey)!;
        this.recordPerformance("cache-hit", performance.now() - startTime);
        return cached;
      }

      // Generate annotation components
      const [
        signature,
        parameters,
        complexity,
        dependencies,
        summary,
        semanticTags,
        purposeCategory,
      ] = await Promise.all([
        this.extractSignature(node, sourceText, filePath),
        this.extractParameters(node, sourceText, filePath),
        this.analyzeComplexity(node, sourceText, filePath),
        this.analyzeDependencies(node, sourceText, filePath),
        this.generateSummary(node, sourceText, filePath),
        this.generateSemanticTags(node, sourceText, filePath),
        this.determinePurposeCategory(node, sourceText, filePath),
      ]);

      // Create comprehensive annotation
      const annotation: Annotation = {
        nodeId: node.id,
        filePath: filePath || "",
        signature: signature || "",
        summary: summary || "",
        complexity: complexity,
        lineCount: this.calculateLineCount(node, sourceText),
        characterCount: this.calculateCharacterCount(node, sourceText),
        dependencies: dependencies?.map((d) => d.source) || [],
        exports: [], // Will be populated from dependencies
        calls:
          dependencies?.filter((d) => d.type === "call").map((d) => d.source) ||
          [],
        sourceSnippet: this.extractCodeSnippet(node, sourceText),
        contextLines: this.extractContextLines(node, sourceText),
        purpose: purposeCategory || PurposeCategory.UTILITY,
        tags: semanticTags?.map((tag) => tag.toString()) || [],
        completeness: this.calculateCompleteness(
          node,
          signature,
          parameters,
          summary,
        ),
        confidence: this.calculateConfidence(node, signature, summary),
        language: this.detectLanguage(filePath, node),
        lastUpdated: new Date().toISOString(),
        version: "1.0.0",
      };

      // Record performance and cache
      const processingTime = performance.now() - startTime;

      this.recordPerformance("annotation-generation", processingTime);
      this.recordPerformance(
        "total-annotations",
        this.annotationCache.size + 1,
      );

      // Cache if enabled
      if (this.config.enableDeduplication) {
        this.annotationCache.set(cacheKey, annotation);
      }

      return annotation;
    } catch (error) {
      this.logError(
        error as Error,
        `generateAnnotation for ${node.type}:${node.name}`,
      );
      const processingTime = performance.now() - startTime;
      this.recordPerformance("annotation-error", processingTime);

      // Return fallback annotation
      return this.createFallbackAnnotation(node, filePath, error as Error);
    }
  }

  /**
   * Batch processing for multiple nodes with optimized performance
   */
  public async generateAnnotationsBatch(
    nodes: Array<{ node: ASTNode; sourceText?: string; filePath?: string }>,
    options: {
      maxConcurrency?: number;
      progressCallback?: (completed: number, total: number) => void;
    } = {},
  ): Promise<Annotation[]> {
    const { maxConcurrency = this.config.maxConcurrency, progressCallback } =
      options;
    const results: Annotation[] = [];

    // Process in batches to control concurrency
    for (let i = 0; i < nodes.length; i += maxConcurrency) {
      const batch = nodes.slice(i, i + maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(({ node, sourceText, filePath }) =>
          this.generateAnnotation(node, sourceText, filePath),
        ),
      );

      results.push(...batchResults);

      if (progressCallback) {
        progressCallback(results.length, nodes.length);
      }
    }

    return results;
  }

  /**
   * Component methods for individual annotation aspects
   */

  private async extractSignature(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<string | null> {
    try {
      const language = this.detectLanguage(filePath, node);
      const extractor = this.extractors.get(language);

      if (!extractor) {
        return this.generateFallbackSignature(node);
      }

      return extractor.extractSignature(node, sourceText || "");
    } catch (error) {
      this.logError(error as Error, "extractSignature");
      return this.generateFallbackSignature(node);
    }
  }

  private async extractParameters(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<Parameter[]> {
    try {
      const language = this.detectLanguage(filePath, node);
      const extractor = this.extractors.get(language);

      if (!extractor) {
        return this.generateFallbackParameters(node);
      }

      return extractor.extractParameters(node, sourceText || "");
    } catch (error) {
      this.logError(error as Error, "extractParameters");
      return this.generateFallbackParameters(node);
    }
  }

  private async analyzeComplexity(
    node: ASTNode,
    sourceText?: string,
    _filePath?: string,
  ): Promise<number> {
    try {
      if (!sourceText) {
        return 1;
      }
      return await this.complexityAnalyzer.calculateCyclomaticComplexity(
        node,
        sourceText,
      );
    } catch (error) {
      this.logError(error as Error, "analyzeComplexity");
      return 1;
    }
  }

  private async analyzeDependencies(
    node: ASTNode,
    _sourceText?: string,
    filePath?: string,
  ) {
    try {
      return await this.dependencyAnalyzer.analyzeDependencies(node, filePath);
    } catch (error) {
      this.logError(error as Error, "analyzeDependencies");
      return [];
    }
  }

  private async generateSummary(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<string> {
    try {
      return await this.summaryGenerator.generateSummary(
        node,
        sourceText,
        filePath,
      );
    } catch (error) {
      this.logError(error as Error, "generateSummary");
      return `${node.type || "Unknown"} ${node.name ? `'${node.name}'` : "element"}`;
    }
  }

  private async generateSemanticTags(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<SemanticTag[]> {
    try {
      return await this.summaryGenerator.generateSemanticTags(
        node,
        sourceText,
        filePath,
      );
    } catch (error) {
      this.logError(error as Error, "generateSemanticTags");
      return [SemanticTag.UNKNOWN];
    }
  }

  private async determinePurposeCategory(
    node: ASTNode,
    sourceText?: string,
    _filePath?: string,
  ): Promise<PurposeCategory> {
    try {
      return await this.summaryGenerator.determinePurposeCategory(
        node,
        sourceText,
      );
    } catch (error) {
      this.logError(error as Error, "determinePurposeCategory");
      return PurposeCategory.UTILITY;
    }
  }

  /**
   * Utility methods
   */

  private calculateLineCount(node: ASTNode, sourceText?: string): number {
    if (!sourceText || !node.start || !node.end) {
      return 0;
    }

    const startLine = node.start.line || 0;
    const endLine = node.end.line || 0;
    return Math.max(1, endLine - startLine + 1);
  }

  private calculateCharacterCount(node: ASTNode, sourceText?: string): number {
    if (!sourceText || !node.start || !node.end) {
      return 0;
    }

    const startPos = node.start.column || 0;
    const endPos = node.end.column || 0;
    return Math.max(0, endPos - startPos);
  }

  private extractContextLines(
    node: ASTNode,
    sourceText?: string,
  ): { before: string[]; after: string[] } {
    if (!sourceText || !node.start) {
      return { before: [], after: [] };
    }

    const lines = sourceText.split("\n");
    const currentLine = (node.start.line || 1) - 1; // Convert to 0-based

    const beforeStart = Math.max(
      0,
      currentLine - this.config.contextLinesBefore,
    );
    const afterEnd = Math.min(
      lines.length,
      currentLine + 1 + this.config.contextLinesAfter,
    );

    return {
      before: lines.slice(beforeStart, currentLine),
      after: lines.slice(currentLine + 1, afterEnd),
    };
  }

  private detectLanguage(filePath?: string, node?: ASTNode): string {
    if (filePath) {
      const ext = filePath.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "ts":
          return "typescript";
        case "tsx":
          return "typescript";
        case "js":
          return "javascript";
        case "jsx":
          return "javascript";
        case "py":
          return "python";
        default:
          return "javascript"; // Default fallback
      }
    }

    if (node?.metadata?.language) {
      return node.metadata.language;
    }

    return "javascript";
  }

  private extractCodeSnippet(node: ASTNode, sourceText?: string): string {
    if (!sourceText || !node.start || !node.end) {
      return "";
    }

    try {
      const lines = sourceText.split("\n");
      const startLine = Math.max(
        0,
        (node.start.line || 1) - this.config.contextLinesBefore - 1,
      );
      const endLine = Math.min(
        lines.length,
        (node.end.line || 1) + this.config.contextLinesAfter,
      );

      return lines
        .slice(startLine, endLine)
        .slice(0, this.config.maxSnippetLines)
        .join("\n");
    } catch (error) {
      this.logError(error as Error, "extractCodeSnippet");
      return "";
    }
  }

  private generateFallbackSignature(node: ASTNode): string {
    const name = node.name || "unnamed";
    const type = node.type || "unknown";

    if (
      type.toLowerCase().includes("function") ||
      type.toLowerCase().includes("method")
    ) {
      return `${name}()`;
    }

    return name;
  }

  private generateFallbackParameters(node: ASTNode): Parameter[] {
    // Try to extract from node structure if available
    const nodeAny = node as any;
    if (nodeAny.parameters && Array.isArray(nodeAny.parameters)) {
      return nodeAny.parameters.map((param: any, index: number) => ({
        name: param.name || `param${index}`,
        type: param.type || "unknown",
        optional: Boolean(param.optional),
        description: `Parameter ${index + 1}`,
      }));
    }

    return [];
  }

  private calculateConfidence(
    node: ASTNode,
    signature?: string | null,
    summary?: string,
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on available information
    if (node.name) {
      confidence += 0.1;
    }
    if (node.type) {
      confidence += 0.1;
    }
    if (signature && signature.length > 0) {
      confidence += 0.1;
    }
    if (summary && summary.length > 10) {
      confidence += 0.1;
    }
    if (node.start && node.end) {
      confidence += 0.1;
    }
    if (node.metadata?.language) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private calculateCompleteness(
    node: ASTNode,
    signature?: string | null,
    parameters?: Parameter[],
    summary?: string,
  ): number {
    let completeness = 0.0;
    const totalAspects = 6;

    // Check completeness of different aspects
    if (node.name) {
      completeness += 1 / totalAspects;
    }
    if (node.type) {
      completeness += 1 / totalAspects;
    }
    if (signature && signature.length > 0) {
      completeness += 1 / totalAspects;
    }
    if (parameters && parameters.length > 0) {
      completeness += 1 / totalAspects;
    }
    if (summary && summary.length > 10) {
      completeness += 1 / totalAspects;
    }
    if (node.start && node.end) {
      completeness += 1 / totalAspects;
    }

    return Math.min(1.0, completeness);
  }

  private createFallbackAnnotation(
    node: ASTNode,
    filePath?: string,
    _error?: Error,
  ): Annotation {
    return {
      nodeId: node.id,
      filePath: filePath || "",
      signature: this.generateFallbackSignature(node),
      summary: `${node.type || "Unknown"} ${node.name ? `'${node.name}'` : "element"}`,
      complexity: 1,
      lineCount: 1,
      characterCount: 0,
      dependencies: [],
      exports: [],
      calls: [],
      sourceSnippet: "",
      contextLines: { before: [], after: [] },
      purpose: PurposeCategory.UTILITY,
      tags: [SemanticTag.UNKNOWN.toString()],
      completeness: 0.2,
      confidence: 0.1,
      language: this.detectLanguage(filePath, node),
      lastUpdated: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  private generateCacheKey(node: ASTNode, filePath?: string): string {
    const nodeKey = `${node.type}:${node.name}:${node.start?.line}:${node.start?.column}`;
    const fileKey = filePath || "nofile";
    return `${fileKey}:${nodeKey}`;
  }

  private recordPerformance(metric: string, value: number): void {
    this.performanceMetrics.set(metric, value);
  }

  private logError(error: Error, context: string): void {
    this.errorLog.push({
      timestamp: new Date(),
      error,
      context,
    });

    // Keep error log bounded
    if (this.errorLog.length > 100) {
      this.errorLog.splice(0, 50); // Remove oldest 50 entries
    }

    console.error(`AnnotationEngine Error in ${context}:`, error.message);
  }

  /**
   * Management and monitoring methods
   */

  public getPerformanceMetrics(): Record<string, number> {
    return Object.fromEntries(this.performanceMetrics.entries());
  }

  public getErrorLog(): Array<{
    timestamp: Date;
    error: Error;
    context: string;
  }> {
    return [...this.errorLog];
  }

  public clearCaches(): void {
    this.annotationCache.clear();
    this.dependencyAnalyzer.clearCache();
    this.summaryGenerator.clearCache();
    // Note: ComplexityAnalyzer doesn't have cache methods in current implementation
  }

  public getCacheStatistics(): {
    annotations: number;
    dependencies: number;
    summaries: number;
  } {
    const dependencyStats = this.dependencyAnalyzer.getCacheStats();
    const summaryStats = this.summaryGenerator.getCacheStats();

    return {
      annotations: this.annotationCache.size,
      dependencies: dependencyStats.dependencies,
      summaries: summaryStats.summaries,
    };
  }

  public validateConfiguration(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.config.batchSize <= 0) {
      issues.push("Batch size must be positive");
    }

    if (this.config.maxConcurrency <= 0) {
      issues.push("Max concurrency must be positive");
    }

    if (this.config.timeoutMs <= 0) {
      issues.push("Timeout must be positive");
    }

    if (this.config.minConfidence < 0 || this.config.minConfidence > 1) {
      issues.push("Min confidence must be between 0 and 1");
    }

    if (this.config.minCompleteness < 0 || this.config.minCompleteness > 1) {
      issues.push("Min completeness must be between 0 and 1");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
