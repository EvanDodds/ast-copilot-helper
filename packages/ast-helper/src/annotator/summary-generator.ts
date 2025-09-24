import type { ASTNode } from "../parser/types.js";
import type {
  SummaryGenerationConfig,
  SummaryTemplate,
  SummaryPattern,
} from "./types.js";
import { SemanticTag, PurposeCategory } from "./types.js";
import { DependencyAnalyzer } from "./dependency-analyzer.js";
import { ComplexityAnalyzer } from "./complexity-analyzer.js";

/**
 * Generates human-readable summaries and semantic tags for AST nodes
 * Uses pattern-based analysis and configurable templates
 */
export class SummaryGenerator {
  private config: SummaryGenerationConfig;
  private dependencyAnalyzer: DependencyAnalyzer;
  private complexityAnalyzer: ComplexityAnalyzer;
  private summaryCache: Map<string, string> = new Map();
  private tagCache: Map<string, SemanticTag[]> = new Map();

  // Default templates for different node types
  private defaultTemplates = new Map<string, SummaryTemplate>([
    [
      "function",
      {
        pattern: "{visibility} {async}{name} function {signature} {purpose}",
        placeholders: {
          visibility: ["public", "private", "protected", "static"],
          async: ["async ", ""],
          purpose: [
            "that handles",
            "that processes",
            "that validates",
            "that transforms",
            "that creates",
          ],
        },
      } as SummaryTemplate,
    ],
    [
      "class",
      {
        pattern: "{visibility} {abstract}class {name} {inheritance} {purpose}",
        placeholders: {
          visibility: ["public", "private", "protected"],
          abstract: ["abstract ", ""],
          inheritance: ["extends {parent}", "implements {interfaces}", ""],
          purpose: [
            "for managing",
            "for handling",
            "for processing",
            "for representing",
          ],
        },
      } as SummaryTemplate,
    ],
    [
      "interface",
      {
        pattern: "{visibility} interface {name} {inheritance} {purpose}",
        placeholders: {
          visibility: ["public", "private"],
          inheritance: ["extends {parent}", ""],
          purpose: ["defining", "specifying", "describing"],
        },
      } as SummaryTemplate,
    ],
    [
      "method",
      {
        pattern:
          "{visibility} {static}{async}method {name}{signature} {purpose}",
        placeholders: {
          visibility: ["public", "private", "protected"],
          static: ["static ", ""],
          async: ["async ", ""],
          purpose: [
            "that handles",
            "that processes",
            "that validates",
            "that returns",
          ],
        },
      } as SummaryTemplate,
    ],
    [
      "variable",
      {
        pattern: "{scope} {const}{name} variable {type} {purpose}",
        placeholders: {
          scope: ["local", "global", "module"],
          const: ["constant ", "mutable "],
          type: ["of type {type}", ""],
          purpose: ["for storing", "for tracking", "for managing"],
        },
      } as SummaryTemplate,
    ],
  ]);

  // Pattern matchers for different code structures
  private patterns: SummaryPattern[] = [
    // Event handlers
    {
      name: "event-handler",
      matcher: (node: ASTNode) => this.isEventHandler(node),
      template: "Event handler for {event} that {action}",
      tags: [SemanticTag.HANDLER, SemanticTag.EVENT_DRIVEN],
      purpose: PurposeCategory.EVENT_HANDLING,
    },
    // Factory functions
    {
      name: "factory-function",
      matcher: (node: ASTNode) => this.isFactoryFunction(node),
      template:
        "Factory function that creates and returns {returnType} instances",
      tags: [SemanticTag.FACTORY, SemanticTag.CREATIONAL],
      purpose: PurposeCategory.OBJECT_CREATION,
    },
    // Validators
    {
      name: "validator",
      matcher: (node: ASTNode) => this.isValidator(node),
      template:
        "Validator function that checks {validation} and returns boolean result",
      tags: [SemanticTag.VALIDATOR, SemanticTag.UTILITY],
      purpose: PurposeCategory.VALIDATION,
    },
    // Transformers
    {
      name: "transformer",
      matcher: (node: ASTNode) => this.isTransformer(node),
      template: "Transformer function that converts {input} to {output}",
      tags: [SemanticTag.TRANSFORMER, SemanticTag.UTILITY],
      purpose: PurposeCategory.DATA_TRANSFORMATION,
    },
    // API endpoints
    {
      name: "api-endpoint",
      matcher: (node: ASTNode) => this.isApiEndpoint(node),
      template: "{method} endpoint at {path} that {action}",
      tags: [SemanticTag.API_ENDPOINT, SemanticTag.HTTP_HANDLER],
      purpose: PurposeCategory.API_HANDLING,
    },
    // Database operations
    {
      name: "database-operation",
      matcher: (node: ASTNode) => this.isDatabaseOperation(node),
      template: "Database operation that {operation} {entity} data",
      tags: [SemanticTag.DATABASE, SemanticTag.PERSISTENCE],
      purpose: PurposeCategory.DATA_PERSISTENCE,
    },
    // Middleware
    {
      name: "middleware",
      matcher: (node: ASTNode) => this.isMiddleware(node),
      template: "Middleware function that {action} requests/responses",
      tags: [SemanticTag.MIDDLEWARE, SemanticTag.INTERCEPTOR],
      purpose: PurposeCategory.REQUEST_PROCESSING,
    },
    // React components
    {
      name: "react-component",
      matcher: (node: ASTNode) => this.isReactComponent(node),
      template: "React component that renders {ui} with {props} props",
      tags: [SemanticTag.COMPONENT, SemanticTag.UI],
      purpose: PurposeCategory.UI_RENDERING,
    },
    // Test functions
    {
      name: "test-function",
      matcher: (node: ASTNode) => this.isTestFunction(node),
      template: "Test function that verifies {testCase}",
      tags: [SemanticTag.TEST, SemanticTag.VERIFICATION],
      purpose: PurposeCategory.TESTING,
    },
  ];

  constructor(config: Partial<SummaryGenerationConfig> = {}) {
    this.config = {
      maxSummaryLength: 150,
      includeComplexity: true,
      includeDependencies: true,
      includeSemanticTags: true,
      usePatternMatching: true,
      customTemplates: new Map(),
      customPatterns: [],
      enableCaching: true,
      ...config,
    };

    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.complexityAnalyzer = new ComplexityAnalyzer();

    // Merge custom templates
    if (config.customTemplates) {
      Array.from(config.customTemplates.entries()).forEach(
        ([key, template]) => {
          this.defaultTemplates.set(key, template);
        },
      );
    }

    // Add custom patterns
    if (config.customPatterns) {
      this.patterns.push(...config.customPatterns);
    }
  }

  /**
   * Generates a comprehensive summary for an AST node
   */
  public async generateSummary(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<string> {
    const cacheKey = this.getCacheKey(node, "summary");

    if (this.config.enableCaching && this.summaryCache.has(cacheKey)) {
      return this.summaryCache.get(cacheKey)!;
    }

    try {
      // Try pattern-based summary first
      if (this.config.usePatternMatching) {
        const patternSummary = await this.generatePatternBasedSummary(
          node,
          sourceText,
          filePath,
        );
        if (patternSummary) {
          this.summaryCache.set(cacheKey, patternSummary);
          return patternSummary;
        }
      }

      // Fall back to template-based summary
      const templateSummary = await this.generateTemplateBasedSummary(
        node,
        sourceText,
        filePath,
      );

      // Enhance with additional information
      const enhancedSummary = await this.enhanceSummary(
        templateSummary,
        node,
        sourceText,
        filePath,
      );

      if (this.config.enableCaching) {
        this.summaryCache.set(cacheKey, enhancedSummary);
      }

      return enhancedSummary;
    } catch (error) {
      console.error("Error generating summary:", error);
      return this.generateFallbackSummary(node);
    }
  }

  /**
   * Generates semantic tags for an AST node
   */
  public async generateSemanticTags(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<SemanticTag[]> {
    const cacheKey = this.getCacheKey(node, "tags");

    if (this.config.enableCaching && this.tagCache.has(cacheKey)) {
      return this.tagCache.get(cacheKey)!;
    }

    try {
      const tags: Set<SemanticTag> = new Set();

      // Check pattern-based tags
      for (const pattern of this.patterns) {
        if (await pattern.matcher(node)) {
          pattern.tags.forEach((tag) => tags.add(tag));
        }
      }

      // Add node type based tags
      const nodeTypeTags = this.getNodeTypeBasedTags(node);
      nodeTypeTags.forEach((tag) => tags.add(tag));

      // Add complexity-based tags
      if (this.config.includeComplexity) {
        const complexityTags = await this.getComplexityBasedTags(
          node,
          sourceText,
        );
        complexityTags.forEach((tag) => tags.add(tag));
      }

      // Add dependency-based tags
      if (this.config.includeDependencies) {
        const dependencyTags = await this.getDependencyBasedTags(
          node,
          filePath,
        );
        dependencyTags.forEach((tag) => tags.add(tag));
      }

      const tagArray = Array.from(tags);

      if (this.config.enableCaching) {
        this.tagCache.set(cacheKey, tagArray);
      }

      return tagArray;
    } catch (error) {
      console.error("Error generating semantic tags:", error);
      return [SemanticTag.UNKNOWN];
    }
  }

  /**
   * Determines the purpose category of a node
   */
  public async determinePurposeCategory(
    node: ASTNode,
    _sourceText?: string,
  ): Promise<PurposeCategory> {
    // Check patterns first
    for (const pattern of this.patterns) {
      if (await pattern.matcher(node)) {
        return pattern.purpose;
      }
    }

    // Fall back to heuristics based on node type and content
    const nodeType = node.type?.toLowerCase() || "";
    const nodeName = node.name?.toLowerCase() || "";

    if (
      nodeType.includes("test") ||
      nodeName.includes("test") ||
      nodeName.includes("spec")
    ) {
      return PurposeCategory.TESTING;
    }

    if (nodeType.includes("class") || nodeType.includes("interface")) {
      return PurposeCategory.TYPE_DEFINITION;
    }

    if (nodeType.includes("function") || nodeType.includes("method")) {
      return PurposeCategory.BUSINESS_LOGIC;
    }

    return PurposeCategory.UTILITY;
  }

  /**
   * Generates pattern-based summary
   */
  private async generatePatternBasedSummary(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<string | null> {
    for (const pattern of this.patterns) {
      if (await pattern.matcher(node)) {
        return this.applyTemplate(pattern.template, node, sourceText, filePath);
      }
    }
    return null;
  }

  /**
   * Generates template-based summary
   */
  private async generateTemplateBasedSummary(
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<string> {
    const nodeType = node.type?.toLowerCase() || "unknown";
    const template =
      this.defaultTemplates.get(nodeType) ||
      this.defaultTemplates.get("function")!;

    return this.applyTemplate(template.pattern, node, sourceText, filePath);
  }

  /**
   * Enhances summary with additional context
   */
  private async enhanceSummary(
    baseSummary: string,
    node: ASTNode,
    sourceText?: string,
    filePath?: string,
  ): Promise<string> {
    let enhanced = baseSummary;

    // Add complexity information
    if (this.config.includeComplexity && sourceText) {
      const complexity =
        await this.complexityAnalyzer.calculateCyclomaticComplexity(
          node,
          sourceText,
        );
      if (complexity > 5) {
        enhanced += ` (complexity: ${complexity})`;
      }
    }

    // Add dependency count
    if (this.config.includeDependencies && filePath) {
      const dependencies = await this.dependencyAnalyzer.analyzeDependencies(
        node,
        filePath,
      );
      const importCount = dependencies.filter(
        (d) => d.type === "import",
      ).length;
      if (importCount > 0) {
        enhanced += ` with ${importCount} dependencies`;
      }
    }

    // Trim to max length
    if (enhanced.length > this.config.maxSummaryLength) {
      enhanced =
        enhanced.substring(0, this.config.maxSummaryLength - 3) + "...";
    }

    return enhanced;
  }

  /**
   * Applies template with placeholder replacement
   */
  private applyTemplate(
    template: string,
    node: ASTNode,
    sourceText?: string,
    _filePath?: string,
  ): string {
    let result = template;

    // Basic replacements
    result = result.replace("{name}", node.name || "unnamed");
    result = result.replace("{type}", node.type || "unknown");

    // Advanced replacements based on node analysis

    // Signature extraction
    if (result.includes("{signature}")) {
      const signature = this.extractSignature(node, sourceText);
      result = result.replace("{signature}", signature);
    }

    // Visibility determination
    if (result.includes("{visibility}")) {
      const visibility = this.determineVisibility(node);
      result = result.replace("{visibility}", visibility);
    }

    // Async detection
    if (result.includes("{async}")) {
      const isAsync = this.isAsyncFunction(node);
      result = result.replace("{async}", isAsync ? "async " : "");
    }

    // Purpose inference
    if (result.includes("{purpose}")) {
      const purpose = this.inferPurpose(node, sourceText);
      result = result.replace("{purpose}", purpose);
    }

    return result.trim();
  }

  /**
   * Pattern matcher methods
   */

  private isEventHandler(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    const type = node.type?.toLowerCase() || "";

    return (
      name.startsWith("on") ||
      name.includes("handler") ||
      name.includes("listener") ||
      (type.includes("function") && name.includes("event"))
    );
  }

  private isFactoryFunction(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    return (
      name.includes("factory") ||
      name.includes("create") ||
      name.includes("make") ||
      name.startsWith("new")
    );
  }

  private isValidator(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    return (
      name.includes("valid") ||
      name.includes("check") ||
      name.includes("verify") ||
      name.startsWith("is") ||
      name.startsWith("has")
    );
  }

  private isTransformer(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    return (
      name.includes("transform") ||
      name.includes("convert") ||
      name.includes("parse") ||
      name.includes("format") ||
      name.includes("map") ||
      name.includes("filter")
    );
  }

  private isApiEndpoint(node: ASTNode): boolean {
    const nodeAny = node as any;
    const name = node.name?.toLowerCase() || "";

    // Check for HTTP method decorators or route definitions
    const hasRouteDecorator = nodeAny.decorators?.some(
      (d: any) =>
        d.name &&
        ["get", "post", "put", "delete", "patch"].includes(
          d.name.toLowerCase(),
        ),
    );

    return (
      hasRouteDecorator ||
      name.includes("endpoint") ||
      name.includes("route") ||
      name.includes("controller")
    );
  }

  private isDatabaseOperation(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    return (
      name.includes("find") ||
      name.includes("save") ||
      name.includes("update") ||
      name.includes("delete") ||
      name.includes("insert") ||
      name.includes("query") ||
      name.includes("repository")
    );
  }

  private isMiddleware(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    return (
      name.includes("middleware") ||
      name.includes("interceptor") ||
      name.includes("guard") ||
      name.includes("filter")
    );
  }

  private isReactComponent(node: ASTNode): boolean {
    const name = node.name || "";
    const type = node.type?.toLowerCase() || "";

    // React components start with capital letter and are functions or classes
    return (
      (type.includes("function") || type.includes("class")) &&
      name.length > 0 &&
      name.charAt(0) === name.charAt(0).toUpperCase()
    );
  }

  private isTestFunction(node: ASTNode): boolean {
    const name = node.name?.toLowerCase() || "";
    return (
      name.includes("test") ||
      name.includes("spec") ||
      name.includes("should") ||
      name.startsWith("it") ||
      name.startsWith("describe")
    );
  }

  /**
   * Utility methods
   */

  private extractSignature(node: ASTNode, _sourceText?: string): string {
    const nodeAny = node as any;

    if (nodeAny.parameters) {
      const params = nodeAny.parameters
        .map((p: any) => p.name || "param")
        .join(", ");
      return `(${params})`;
    }

    return "()";
  }

  private determineVisibility(node: ASTNode): string {
    const nodeAny = node as any;
    const modifiers = nodeAny.modifiers || [];

    if (modifiers.includes("private")) {
      return "private";
    }
    if (modifiers.includes("protected")) {
      return "protected";
    }
    return "public";
  }

  private isAsyncFunction(node: ASTNode): boolean {
    const nodeAny = node as any;
    const modifiers = nodeAny.modifiers || [];
    return modifiers.includes("async");
  }

  private inferPurpose(node: ASTNode, _sourceText?: string): string {
    const name = node.name?.toLowerCase() || "";

    if (name.includes("handle")) {
      return "that handles events";
    }
    if (name.includes("process")) {
      return "that processes data";
    }
    if (name.includes("validate")) {
      return "that validates input";
    }
    if (name.includes("create")) {
      return "that creates objects";
    }
    if (name.includes("update")) {
      return "that updates state";
    }
    if (name.includes("delete")) {
      return "that removes data";
    }

    return "that performs operations";
  }

  private getNodeTypeBasedTags(node: ASTNode): SemanticTag[] {
    const type = node.type?.toLowerCase() || "";
    const tags: SemanticTag[] = [];

    if (type.includes("function")) {
      tags.push(SemanticTag.FUNCTION);
    }
    if (type.includes("class")) {
      tags.push(SemanticTag.CLASS);
    }
    if (type.includes("interface")) {
      tags.push(SemanticTag.INTERFACE);
    }
    if (type.includes("method")) {
      tags.push(SemanticTag.METHOD);
    }
    if (type.includes("variable")) {
      tags.push(SemanticTag.VARIABLE);
    }

    return tags;
  }

  private async getComplexityBasedTags(
    node: ASTNode,
    sourceText?: string,
  ): Promise<SemanticTag[]> {
    const tags: SemanticTag[] = [];

    if (sourceText) {
      const complexity =
        await this.complexityAnalyzer.calculateCyclomaticComplexity(
          node,
          sourceText,
        );

      if (complexity > 10) {
        tags.push(SemanticTag.HIGH_COMPLEXITY);
      } else if (complexity > 5) {
        tags.push(SemanticTag.MEDIUM_COMPLEXITY);
      }
    }

    return tags;
  }

  private async getDependencyBasedTags(
    node: ASTNode,
    filePath?: string,
  ): Promise<SemanticTag[]> {
    const tags: SemanticTag[] = [];

    if (filePath) {
      const dependencies = await this.dependencyAnalyzer.analyzeDependencies(
        node,
        filePath,
      );

      const hasExternalDeps = dependencies.some((d) => d.isExternal);
      if (hasExternalDeps) {
        tags.push(SemanticTag.EXTERNAL_DEPENDENCY);
      }

      const hasCircularDeps = dependencies.some((d) => d.circularDependency);
      if (hasCircularDeps) {
        tags.push(SemanticTag.CIRCULAR_DEPENDENCY);
      }
    }

    return tags;
  }

  private generateFallbackSummary(node: ASTNode): string {
    return `${node.type || "Unknown"} ${node.name ? `'${node.name}'` : "element"}`;
  }

  private getCacheKey(node: ASTNode, type: string): string {
    return `${type}:${node.type}:${node.name || "unnamed"}:${node.start?.line || 0}`;
  }

  /**
   * Clears all caches
   */
  public clearCache(): void {
    this.summaryCache.clear();
    this.tagCache.clear();
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { summaries: number; tags: number } {
    return {
      summaries: this.summaryCache.size,
      tags: this.tagCache.size,
    };
  }
}
