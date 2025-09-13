/**
 * Significance Calculation System
 * 
 * Determines the importance level of AST nodes for indexing and analysis
 * based on node type, complexity, scope, and contextual factors.
 */

import { ASTNode, NodeType, SignificanceLevel } from './ast-schema';

/**
 * Context information for significance calculation
 */
export interface SignificanceContext {
  /** The node being analyzed */
  node: ASTNode;
  /** Parent node for hierarchical context */
  parent?: ASTNode;
  /** Child nodes for complexity analysis */
  children: ASTNode[];
  /** Sibling nodes for relative importance */
  siblings: ASTNode[];
  /** File-level context */
  fileContext: {
    totalNodes: number;
    totalFunctions: number;
    totalClasses: number;
    isMainFile: boolean;
    isTestFile: boolean;
    isConfigFile: boolean;
  };
}

/**
 * Significance calculation factors and weights
 */
export interface SignificanceFactors {
  /** Base significance from node type */
  baseSignificance: SignificanceLevel;
  /** Complexity factor (-2 to +2) */
  complexityFactor: number;
  /** Scope depth factor (-1 to +1) */
  scopeFactor: number;
  /** Size factor based on source length (-1 to +1) */
  sizeFactor: number;
  /** Context factor based on file type (-1 to +1) */
  contextFactor: number;
  /** Usage factor based on references (+0 to +2) */
  usageFactor: number;
  /** Final calculated significance */
  finalSignificance: SignificanceLevel;
  /** Explanation of the calculation */
  explanation: string;
}

/**
 * Configuration for significance calculation behavior
 */
export interface SignificanceConfig {
  /** Enable complexity-based adjustments */
  enableComplexityAdjustment: boolean;
  /** Enable scope-based adjustments */
  enableScopeAdjustment: boolean;
  /** Enable size-based adjustments */
  enableSizeAdjustment: boolean;
  /** Minimum significance level (floor) */
  minimumSignificance: SignificanceLevel;
  /** Maximum significance level (ceiling) */
  maximumSignificance: SignificanceLevel;
  /** Weight for complexity factor (0-1) */
  complexityWeight: number;
  /** Weight for scope factor (0-1) */
  scopeWeight: number;
  /** Weight for size factor (0-1) */
  sizeWeight: number;
  /** Weight for context factor (0-1) */
  contextWeight: number;
}

/**
 * Statistics for significance calculation analysis
 */
export interface SignificanceStats {
  /** Total nodes analyzed */
  totalAnalyzed: number;
  /** Distribution by significance level */
  distribution: Record<SignificanceLevel, number>;
  /** Average complexity factor */
  averageComplexity: number;
  /** Average scope depth */
  averageScopeDepth: number;
  /** Most common significance level */
  mostCommonLevel: SignificanceLevel;
  /** Percentage of nodes at each level */
  percentageByLevel: Record<SignificanceLevel, number>;
}

/**
 * Significance Calculator
 * 
 * Intelligently determines the importance level of AST nodes using
 * multi-factor analysis including type, complexity, scope, and context.
 */
export class SignificanceCalculator {
  private static readonly DEFAULT_CONFIG: SignificanceConfig = {
    enableComplexityAdjustment: true,
    enableScopeAdjustment: true,
    enableSizeAdjustment: true,
    minimumSignificance: SignificanceLevel.MINIMAL,
    maximumSignificance: SignificanceLevel.CRITICAL,
    complexityWeight: 0.3,
    scopeWeight: 0.2,
    sizeWeight: 0.1,
    contextWeight: 0.2,
  };

  private config: SignificanceConfig;
  private stats: SignificanceStats = {
    totalAnalyzed: 0,
    distribution: {
      [SignificanceLevel.MINIMAL]: 0,
      [SignificanceLevel.LOW]: 0,
      [SignificanceLevel.MEDIUM]: 0,
      [SignificanceLevel.HIGH]: 0,
      [SignificanceLevel.CRITICAL]: 0,
    },
    averageComplexity: 0,
    averageScopeDepth: 0,
    mostCommonLevel: SignificanceLevel.LOW,
    percentageByLevel: {
      [SignificanceLevel.MINIMAL]: 0,
      [SignificanceLevel.LOW]: 0,
      [SignificanceLevel.MEDIUM]: 0,
      [SignificanceLevel.HIGH]: 0,
      [SignificanceLevel.CRITICAL]: 0,
    },
  };

  constructor(config: Partial<SignificanceConfig> = {}) {
    this.config = { ...SignificanceCalculator.DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate significance level for an AST node
   * 
   * @param node - The AST node to analyze
   * @param context - Optional context information
   * @returns Calculated significance level
   */
  calculateSignificance(node: ASTNode, context?: Partial<SignificanceContext>): SignificanceLevel {
    const factors = this.calculateSignificanceFactors(node, context);
    this.updateStats(factors);
    return factors.finalSignificance;
  }

  /**
   * Calculate detailed significance factors for analysis
   * 
   * @param node - The AST node to analyze
   * @param context - Optional context information
   * @returns Detailed significance calculation factors
   */
  calculateSignificanceFactors(node: ASTNode, context?: Partial<SignificanceContext>): SignificanceFactors {
    // Build full context
    const fullContext: SignificanceContext = {
      node,
      parent: context?.parent,
      children: context?.children || [],
      siblings: context?.siblings || [],
      fileContext: context?.fileContext || {
        totalNodes: 100,
        totalFunctions: 10,
        totalClasses: 5,
        isMainFile: false,
        isTestFile: false,
        isConfigFile: false,
      },
    };

    // Calculate base significance from node type
    const baseSignificance = this.getBaseSignificance(node.type);

    // Calculate adjustment factors
    const complexityFactor = this.calculateComplexityFactor(node, fullContext);
    const scopeFactor = this.calculateScopeFactor(node, fullContext);
    const sizeFactor = this.calculateSizeFactor(node);
    const contextFactor = this.calculateContextFactor(node, fullContext);
    const usageFactor = this.calculateUsageFactor(node, fullContext);

    // Apply weighted adjustments
    let adjustedSignificance = baseSignificance;
    
    if (this.config.enableComplexityAdjustment) {
      adjustedSignificance += complexityFactor * this.config.complexityWeight;
    }
    
    if (this.config.enableScopeAdjustment) {
      adjustedSignificance += scopeFactor * this.config.scopeWeight;
    }
    
    if (this.config.enableSizeAdjustment) {
      adjustedSignificance += sizeFactor * this.config.sizeWeight;
    }

    adjustedSignificance += contextFactor * this.config.contextWeight;
    adjustedSignificance += usageFactor * 0.1; // Usage factor has lower weight

    // Clamp to valid range
    const finalSignificance = this.clampSignificance(adjustedSignificance);

    // Generate explanation
    const explanation = this.generateExplanation(
      baseSignificance,
      complexityFactor,
      scopeFactor,
      sizeFactor,
      contextFactor,
      usageFactor,
      finalSignificance
    );

    return {
      baseSignificance,
      complexityFactor,
      scopeFactor,
      sizeFactor,
      contextFactor,
      usageFactor,
      finalSignificance,
      explanation,
    };
  }

  /**
   * Calculate significance for multiple nodes efficiently
   * 
   * @param nodes - Array of AST nodes
   * @returns Array of significance levels
   */
  calculateBatch(nodes: ASTNode[]): SignificanceLevel[] {
    return nodes.map(node => this.calculateSignificance(node));
  }

  /**
   * Get calculation statistics
   * 
   * @returns Current statistics
   */
  getStats(): SignificanceStats {
    this.updatePercentages();
    return { ...this.stats };
  }

  /**
   * Reset calculation statistics
   */
  resetStats(): void {
    this.stats = {
      totalAnalyzed: 0,
      distribution: {
        [SignificanceLevel.MINIMAL]: 0,
        [SignificanceLevel.LOW]: 0,
        [SignificanceLevel.MEDIUM]: 0,
        [SignificanceLevel.HIGH]: 0,
        [SignificanceLevel.CRITICAL]: 0,
      },
      averageComplexity: 0,
      averageScopeDepth: 0,
      mostCommonLevel: SignificanceLevel.LOW,
      percentageByLevel: {
        [SignificanceLevel.MINIMAL]: 0,
        [SignificanceLevel.LOW]: 0,
        [SignificanceLevel.MEDIUM]: 0,
        [SignificanceLevel.HIGH]: 0,
        [SignificanceLevel.CRITICAL]: 0,
      },
    };
  }

  /**
   * Get base significance level from node type
   */
  private getBaseSignificance(nodeType: NodeType): SignificanceLevel {
    // Critical: Top-level structural constructs
    if ([NodeType.FILE, NodeType.MODULE, NodeType.NAMESPACE].includes(nodeType)) {
      return SignificanceLevel.CRITICAL;
    }

    // Critical: Major declarations
    if ([NodeType.CLASS, NodeType.INTERFACE].includes(nodeType)) {
      return SignificanceLevel.CRITICAL;
    }

    // High: Function-like constructs
    if ([
      NodeType.FUNCTION,
      NodeType.METHOD,
      NodeType.CONSTRUCTOR,
      NodeType.GETTER,
      NodeType.SETTER
    ].includes(nodeType)) {
      return SignificanceLevel.HIGH;
    }

    // Medium: Type definitions and imports
    if ([
      NodeType.ENUM,
      NodeType.TYPE_ALIAS,
      NodeType.IMPORT,
      NodeType.EXPORT
    ].includes(nodeType)) {
      return SignificanceLevel.MEDIUM;
    }

    // Medium: Complex control flow
    if ([
      NodeType.SWITCH_STATEMENT,
      NodeType.TRY_CATCH
    ].includes(nodeType)) {
      return SignificanceLevel.MEDIUM;
    }

    // Low: Simple control flow
    if ([
      NodeType.IF_STATEMENT,
      NodeType.FOR_LOOP,
      NodeType.WHILE_LOOP
    ].includes(nodeType)) {
      return SignificanceLevel.LOW;
    }

    // Low: Data declarations
    if ([
      NodeType.PROPERTY,
      NodeType.FIELD,
      NodeType.VARIABLE
    ].includes(nodeType)) {
      return SignificanceLevel.LOW;
    }

    // Minimal: Basic constructs
    if ([
      NodeType.PARAMETER,
      NodeType.COMMENT,
      NodeType.STRING_LITERAL,
      NodeType.DECORATOR
    ].includes(nodeType)) {
      return SignificanceLevel.MINIMAL;
    }

    // Default for arrow functions (context-dependent)
    if (nodeType === NodeType.ARROW_FUNCTION) {
      return SignificanceLevel.MEDIUM;
    }

    return SignificanceLevel.LOW; // Safe default
  }

  /**
   * Calculate complexity factor based on node characteristics
   */
  private calculateComplexityFactor(node: ASTNode, context: SignificanceContext): number {
    let complexityFactor = 0;

    // Child count contributes to complexity
    const childCount = context.children.length;
    if (childCount > 20) complexityFactor += 2;
    else if (childCount > 10) complexityFactor += 1;
    else if (childCount > 5) complexityFactor += 0.5;

    // Cyclomatic complexity if available
    if (node.complexity !== undefined) {
      if (node.complexity > 10) complexityFactor += 2;
      else if (node.complexity > 5) complexityFactor += 1;
      else if (node.complexity > 2) complexityFactor += 0.5;
    }

    // Source text length indicates complexity
    if (node.sourceText) {
      const lines = node.sourceText.split('\n').length;
      if (lines > 50) complexityFactor += 1;
      else if (lines > 20) complexityFactor += 0.5;
    }

    // Functions/methods with many parameters are more complex
    if ([NodeType.FUNCTION, NodeType.METHOD, NodeType.CONSTRUCTOR].includes(node.type)) {
      const parameterCount = context.children.filter(child => 
        child.type === NodeType.PARAMETER
      ).length;
      
      if (parameterCount > 5) complexityFactor += 1;
      else if (parameterCount > 3) complexityFactor += 0.5;
    }

    // Classes with many members are more complex
    if (node.type === NodeType.CLASS) {
      const memberCount = context.children.filter(child => 
        [NodeType.METHOD, NodeType.PROPERTY, NodeType.FIELD].includes(child.type)
      ).length;
      
      if (memberCount > 10) complexityFactor += 1.5;
      else if (memberCount > 5) complexityFactor += 0.5;
    }

    return Math.min(complexityFactor, 2); // Cap at +2
  }

  /**
   * Calculate scope depth factor
   */
  private calculateScopeFactor(node: ASTNode, _context: SignificanceContext): number {
    const scopeDepth = node.metadata?.scope?.length ?? 0;
    
    // Deeply nested items are less significant
    if (scopeDepth > 6) return -1;
    if (scopeDepth > 4) return -0.5;
    if (scopeDepth > 2) return -0.2;
    
    // Top-level items are more significant
    if (scopeDepth === 0) return 0.5;
    if (scopeDepth === 1) return 0.2;
    
    return 0;
  }

  /**
   * Calculate size factor based on source text
   */
  private calculateSizeFactor(node: ASTNode): number {
    if (!node.sourceText) return 0;
    
    const length = node.sourceText.length;
    
    // Very large nodes are more significant
    if (length > 1000) return 1;
    if (length > 500) return 0.5;
    
    // Very small nodes are less significant
    if (length < 10) return -0.5;
    if (length < 50) return -0.2;
    
    return 0;
  }

  /**
   * Calculate context factor based on file and position
   */
  private calculateContextFactor(node: ASTNode, context: SignificanceContext): number {
    let contextFactor = 0;
    
    // Test files have reduced significance
    if (context.fileContext.isTestFile) {
      contextFactor -= 0.5;
    }
    
    // Config files have reduced significance for most nodes
    if (context.fileContext.isConfigFile) {
      contextFactor -= 0.3;
    }
    
    // Main files have increased significance
    if (context.fileContext.isMainFile) {
      contextFactor += 0.3;
    }
    
    // Exported items are more significant
    if (node.metadata?.exports && node.metadata.exports.length > 0) {
      contextFactor += 0.5;
    }
    
    // Items with documentation are more significant
    if (node.metadata?.docstring) {
      contextFactor += 0.2;
    }
    
    // Items with many modifiers (public, static, etc.) are more significant
    if (node.metadata?.modifiers && node.metadata.modifiers.length > 2) {
      contextFactor += 0.3;
    }
    
    return Math.max(-1, Math.min(1, contextFactor));
  }

  /**
   * Calculate usage factor based on potential importance
   */
  private calculateUsageFactor(node: ASTNode, _context: SignificanceContext): number {
    let usageFactor = 0;
    
    // Names that suggest importance
    if (node.name) {
      const name = node.name.toLowerCase();
      
      // Main/primary functions
      if (['main', 'index', 'init', 'start', 'run'].some(keyword => name.includes(keyword))) {
        usageFactor += 1;
      }
      
      // API/public functions
      if (['api', 'public', 'export'].some(keyword => name.includes(keyword))) {
        usageFactor += 0.5;
      }
      
      // Core/base classes
      if (['base', 'core', 'abstract', 'interface'].some(keyword => name.includes(keyword))) {
        usageFactor += 0.5;
      }
    }
    
    // Generic or utility names are less significant
    if (node.name) {
      const name = node.name.toLowerCase();
      if (['temp', 'tmp', 'test', 'debug', 'util', 'helper'].some(keyword => name.includes(keyword))) {
        usageFactor -= 0.5;
      }
    }
    
    return Math.max(0, Math.min(2, usageFactor));
  }

  /**
   * Clamp significance to valid range
   */
  private clampSignificance(value: number): SignificanceLevel {
    const clamped = Math.max(
      this.config.minimumSignificance,
      Math.min(this.config.maximumSignificance, Math.round(value))
    );
    
    return clamped as SignificanceLevel;
  }

  /**
   * Generate explanation for significance calculation
   */
  private generateExplanation(
    base: SignificanceLevel,
    complexity: number,
    scope: number,
    size: number,
    context: number,
    usage: number,
    final: SignificanceLevel
  ): string {
    const parts = [`Base: ${this.significanceLevelName(base)}`];
    
    if (complexity !== 0) {
      parts.push(`Complexity: ${complexity > 0 ? '+' : ''}${complexity.toFixed(1)}`);
    }
    
    if (scope !== 0) {
      parts.push(`Scope: ${scope > 0 ? '+' : ''}${scope.toFixed(1)}`);
    }
    
    if (size !== 0) {
      parts.push(`Size: ${size > 0 ? '+' : ''}${size.toFixed(1)}`);
    }
    
    if (context !== 0) {
      parts.push(`Context: ${context > 0 ? '+' : ''}${context.toFixed(1)}`);
    }
    
    if (usage !== 0) {
      parts.push(`Usage: ${usage > 0 ? '+' : ''}${usage.toFixed(1)}`);
    }
    
    parts.push(`→ ${this.significanceLevelName(final)}`);
    
    return parts.join(', ');
  }

  /**
   * Get human-readable name for significance level
   */
  private significanceLevelName(level: SignificanceLevel): string {
    switch (level) {
      case SignificanceLevel.CRITICAL: return 'Critical';
      case SignificanceLevel.HIGH: return 'High';
      case SignificanceLevel.MEDIUM: return 'Medium';
      case SignificanceLevel.LOW: return 'Low';
      case SignificanceLevel.MINIMAL: return 'Minimal';
      default: return 'Unknown';
    }
  }

  /**
   * Update statistics with new calculation
   */
  private updateStats(factors: SignificanceFactors): void {
    this.stats.totalAnalyzed++;
    this.stats.distribution[factors.finalSignificance]++;
    
    // Update averages (simple running average for performance)
    const n = this.stats.totalAnalyzed;
    this.stats.averageComplexity = 
      (this.stats.averageComplexity * (n - 1) + factors.complexityFactor) / n;
    
    // Find most common level
    let maxCount = 0;
    let mostCommon = SignificanceLevel.LOW;
    
    for (const [level, count] of Object.entries(this.stats.distribution)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = parseInt(level) as SignificanceLevel;
      }
    }
    
    this.stats.mostCommonLevel = mostCommon;
  }

  /**
   * Update percentage calculations
   */
  private updatePercentages(): void {
    const total = this.stats.totalAnalyzed;
    
    if (total === 0) {
      Object.keys(this.stats.percentageByLevel).forEach(level => {
        this.stats.percentageByLevel[parseInt(level) as SignificanceLevel] = 0;
      });
      return;
    }
    
    Object.entries(this.stats.distribution).forEach(([level, count]) => {
      this.stats.percentageByLevel[parseInt(level) as SignificanceLevel] = 
        (count / total) * 100;
    });
  }
}

/**
 * Utility functions for significance analysis
 */
export class SignificanceUtils {
  /**
   * Compare significance levels
   * 
   * @param level1 - First significance level
   * @param level2 - Second significance level
   * @returns -1, 0, or 1 for sorting
   */
  static compareSignificance(level1: SignificanceLevel, level2: SignificanceLevel): number {
    return level2 - level1; // Higher significance first
  }

  /**
   * Check if a significance level is above a threshold
   * 
   * @param level - Level to check
   * @param threshold - Minimum threshold
   * @returns True if level meets or exceeds threshold
   */
  static isAboveThreshold(level: SignificanceLevel, threshold: SignificanceLevel): boolean {
    return level >= threshold;
  }

  /**
   * Get nodes above a significance threshold
   * 
   * @param nodes - Nodes to filter
   * @param threshold - Minimum significance level
   * @returns Filtered nodes
   */
  static filterBySignificance(nodes: ASTNode[], threshold: SignificanceLevel): ASTNode[] {
    return nodes.filter(node => node.significance >= threshold);
  }

  /**
   * Group nodes by significance level
   * 
   * @param nodes - Nodes to group
   * @returns Nodes grouped by significance
   */
  static groupBySignificance(nodes: ASTNode[]): Record<SignificanceLevel, ASTNode[]> {
    const groups: Record<SignificanceLevel, ASTNode[]> = {
      [SignificanceLevel.MINIMAL]: [],
      [SignificanceLevel.LOW]: [],
      [SignificanceLevel.MEDIUM]: [],
      [SignificanceLevel.HIGH]: [],
      [SignificanceLevel.CRITICAL]: [],
    };

    for (const node of nodes) {
      groups[node.significance].push(node);
    }

    return groups;
  }
}

/**
 * Default singleton instance for common usage
 */
export const defaultSignificanceCalculator = new SignificanceCalculator();