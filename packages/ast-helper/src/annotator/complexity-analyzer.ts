/**
 * Complexity Analysis Engine
 * Calculates cyclomatic complexity and other code metrics from AST nodes
 */

import type { ASTNode } from "../parser/types";
import { COMPLEXITY_THRESHOLDS } from "./types";

/**
 * Configuration for complexity analysis
 */
export interface ComplexityConfig {
  /** Maximum complexity before capping */
  maxComplexity: number;

  /** Language-specific decision keywords */
  decisionKeywords: Record<string, string[]>;

  /** Weight for nested complexity */
  nestingWeight: number;

  /** Enable performance optimizations for large functions */
  optimizeForLarge: boolean;
}

/**
 * Detailed complexity metrics
 */
export interface ComplexityMetrics {
  /** Base cyclomatic complexity */
  cyclomatic: number;

  /** Cognitive complexity (accounts for nesting) */
  cognitive: number;

  /** Maximum nesting depth */
  maxNesting: number;

  /** Number of decision points found */
  decisionPoints: number;

  /** Breakdown by decision type */
  breakdown: Record<string, number>;

  /** Complexity category */
  category: "low" | "medium" | "high" | "very-high";
}

/**
 * Default complexity configuration
 */
const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
  maxComplexity: 50,
  nestingWeight: 1.5,
  optimizeForLarge: true,
  decisionKeywords: {
    typescript: [
      "if",
      "else",
      "elif",
      "while",
      "for",
      "do",
      "switch",
      "case",
      "catch",
      "finally",
      "&&",
      "||",
      "??",
      "?",
      ":",
      "forEach",
      "map",
      "filter",
      "reduce",
      "find",
      "some",
      "every",
    ],
    javascript: [
      "if",
      "else",
      "while",
      "for",
      "do",
      "switch",
      "case",
      "catch",
      "finally",
      "&&",
      "||",
      "??",
      "?",
      ":",
      "forEach",
      "map",
      "filter",
      "reduce",
      "find",
      "some",
      "every",
    ],
    python: [
      "if",
      "elif",
      "else",
      "while",
      "for",
      "try",
      "except",
      "finally",
      "and",
      "or",
      "not",
      "match",
      "case", // Python 3.10+
      "assert",
      "raise",
    ],
  },
};

/**
 * Cyclomatic complexity analyzer
 * Calculates complexity metrics from AST nodes and source code
 */
export class ComplexityAnalyzer {
  private config: ComplexityConfig;

  constructor(config: Partial<ComplexityConfig> = {}) {
    this.config = { ...DEFAULT_COMPLEXITY_CONFIG, ...config };
  }

  /**
   * Calculate cyclomatic complexity for an AST node
   */
  calculateCyclomaticComplexity(node: ASTNode, sourceText: string): number {
    const metrics = this.calculateDetailedMetrics(node, sourceText);
    return Math.min(metrics.cyclomatic, this.config.maxComplexity);
  }

  /**
   * Calculate detailed complexity metrics
   */
  calculateDetailedMetrics(
    node: ASTNode,
    sourceText: string,
  ): ComplexityMetrics {
    // Extract node content
    const nodeContent = this.extractNodeContent(node, sourceText);

    // Get language-specific decision keywords
    const language = node.metadata.language || "javascript";
    const keywords =
      this.config.decisionKeywords[language] ||
      this.config.decisionKeywords.javascript ||
      [];

    // Calculate base complexity
    let complexity = 1; // Base complexity
    const breakdown: Record<string, number> = {};
    let maxNesting = 0;
    let totalDecisionPoints = 0;

    if (this.config.optimizeForLarge && nodeContent.length > 10000) {
      // Use optimized analysis for large functions
      const result = this.calculateOptimizedComplexity(nodeContent, keywords);
      complexity = result.complexity;
      Object.assign(breakdown, result.breakdown);
      totalDecisionPoints = result.decisionPoints;
      maxNesting = result.maxNesting;
    } else {
      // Standard detailed analysis
      const result = this.calculateStandardComplexity(nodeContent, keywords);
      complexity = result.complexity;
      Object.assign(breakdown, result.breakdown);
      totalDecisionPoints = result.decisionPoints;
      maxNesting = result.maxNesting;
    }

    // Calculate cognitive complexity (accounts for nesting)
    const cognitive = this.calculateCognitiveComplexity(
      nodeContent,
      keywords,
      maxNesting,
    );

    // Determine category
    const category = this.categorizeComplexity(complexity);

    return {
      cyclomatic: Math.min(complexity, this.config.maxComplexity),
      cognitive,
      maxNesting,
      decisionPoints: totalDecisionPoints,
      breakdown,
      category,
    };
  }

  /**
   * Extract the source content for a specific node
   */
  private extractNodeContent(node: ASTNode, sourceText: string): string {
    const lines = sourceText.split("\n");
    const startLine = Math.max(0, node.start.line - 1);
    const endLine = Math.min(lines.length, node.end.line);

    return lines.slice(startLine, endLine).join("\n");
  }

  /**
   * Standard complexity calculation with detailed analysis
   */
  private calculateStandardComplexity(
    content: string,
    keywords: string[],
  ): {
    complexity: number;
    breakdown: Record<string, number>;
    decisionPoints: number;
    maxNesting: number;
  } {
    let complexity = 1; // Base complexity
    const breakdown: Record<string, number> = {};
    let decisionPoints = 0;
    let maxNesting = 0;
    let currentNesting = 0;

    // Track different types of complexity contributors
    const complexityTypes = {
      conditionals: ["if", "elif", "else if"],
      loops: ["while", "for", "do"],
      switches: ["switch", "case", "match"],
      exceptions: ["catch", "except", "finally"],
      logical: ["&&", "||", "and", "or", "??"],
      ternary: ["?", ":"],
      functional: [
        "forEach",
        "map",
        "filter",
        "reduce",
        "find",
        "some",
        "every",
      ],
    };

    // Split content into tokens for analysis
    const tokens = this.tokenizeContent(content);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) {
        continue;
      } // Skip undefined tokens

      const lowerToken = token.toLowerCase();

      // Check if token is a decision keyword
      if (keywords.includes(lowerToken)) {
        // Categorize the complexity type
        let complexityType = "other";
        for (const [type, typeKeywords] of Object.entries(complexityTypes)) {
          if (typeKeywords.includes(lowerToken)) {
            complexityType = type;
            break;
          }
        }

        // Special handling for different constructs
        if (
          lowerToken === "else" &&
          i > 0 &&
          tokens[i - 1]?.toLowerCase() === "if"
        ) {
          // "else if" - don't double count
          continue;
        }

        if (lowerToken === "case" && this.isInSwitchStatement(tokens, i)) {
          // Each case adds complexity
          complexity++;
          breakdown[complexityType] = (breakdown[complexityType] || 0) + 1;
          decisionPoints++;
        } else if (!["case", "default", "else"].includes(lowerToken)) {
          // Most decision keywords add complexity
          complexity++;
          breakdown[complexityType] = (breakdown[complexityType] || 0) + 1;
          decisionPoints++;
        }
      }

      // Track nesting level
      if (token === "{" || token === "(" || token === "[") {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (token === "}" || token === ")" || token === "]") {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    }

    return { complexity, breakdown, decisionPoints, maxNesting };
  }

  /**
   * Optimized complexity calculation for large functions
   */
  private calculateOptimizedComplexity(
    content: string,
    keywords: string[],
  ): {
    complexity: number;
    breakdown: Record<string, number>;
    decisionPoints: number;
    maxNesting: number;
  } {
    let complexity = 1;
    const breakdown: Record<string, number> = {};
    let decisionPoints = 0;
    let maxNesting = 0;

    // Use regex-based approach for performance
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi");
      const matches = content.match(regex);

      if (matches) {
        const count = matches.length;
        complexity += count;
        breakdown[keyword] = count;
        decisionPoints += count;
      }
    }

    // Estimate nesting (simple bracket counting)
    const openBrackets = (content.match(/[{[(]/g) || []).length;
    const closeBrackets = (content.match(/[}\])]/g) || []).length;
    maxNesting = Math.max(0, openBrackets - closeBrackets + 1);

    return { complexity, breakdown, decisionPoints, maxNesting };
  }

  /**
   * Calculate cognitive complexity (accounts for nesting)
   */
  private calculateCognitiveComplexity(
    content: string,
    keywords: string[],
    maxNesting: number,
  ): number {
    // Cognitive complexity gives higher weight to nested constructs
    const baseComplexity = this.calculateStandardComplexity(
      content,
      keywords,
    ).complexity;
    const nestingPenalty = Math.pow(maxNesting, this.config.nestingWeight);

    return Math.round(baseComplexity * (1 + nestingPenalty * 0.1));
  }

  /**
   * Tokenize content for analysis
   */
  private tokenizeContent(content: string): string[] {
    // Simple tokenization - could be enhanced with proper lexer
    return content
      .replace(/([{}()[\];,])/g, " $1 ") // Add spaces around special chars
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Check if a case statement is within a switch
   */
  private isInSwitchStatement(tokens: string[], currentIndex: number): boolean {
    // Look backwards for 'switch' keyword before next '}'
    let braceCount = 0;

    for (let i = currentIndex - 1; i >= 0; i--) {
      const token = tokens[i];

      if (token === "}") {
        braceCount++;
      } else if (token === "{") {
        braceCount--;

        if (braceCount < 0) {
          // Look for switch before this opening brace
          for (let j = i - 1; j >= 0; j--) {
            if (tokens[j]?.toLowerCase() === "switch") {
              return true;
            }
            if (tokens[j] === ";" || tokens[j] === "}") {
              break;
            }
          }
          break;
        }
      }
    }

    return false;
  }

  /**
   * Categorize complexity level
   */
  private categorizeComplexity(
    complexity: number,
  ): "low" | "medium" | "high" | "very-high" {
    if (complexity <= COMPLEXITY_THRESHOLDS.LOW) {
      return "low";
    } else if (complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
      return "medium";
    } else if (complexity <= COMPLEXITY_THRESHOLDS.HIGH) {
      return "high";
    } else {
      return "very-high";
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ComplexityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ComplexityConfig {
    return { ...this.config };
  }
}
