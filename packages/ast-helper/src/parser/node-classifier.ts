/**
 * Node Classification System
 * 
 * Maps raw Tree-sitter node types to normalized NodeType enum values
 * across different programming languages with extensible architecture.
 */

import { NodeType } from './ast-schema';

/**
 * Raw node data from Tree-sitter or other parsers
 */
export interface RawNodeData {
  /** Raw node type from parser (e.g., 'function_declaration', 'class_definition') */
  type: string;
  /** Node name or identifier if available */
  name?: string;
  /** Language being parsed */
  language: string;
  /** Any additional parser-specific properties */
  properties?: Record<string, any>;
  /** Child nodes for context-aware classification */
  children?: RawNodeData[];
  /** Parent node for context */
  parent?: RawNodeData;
}

/**
 * Classification result with confidence and metadata
 */
export interface ClassificationResult {
  /** Normalized node type */
  nodeType: NodeType;
  /** Confidence level (0-1) in the classification */
  confidence: number;
  /** Reason for classification choice */
  reason: string;
  /** Alternative classifications considered */
  alternatives?: Array<{ nodeType: NodeType; confidence: number; reason: string }>;
}

/**
 * Language-specific mapping configuration
 */
export interface LanguageMapping {
  /** Direct type mappings */
  directMappings: Record<string, NodeType>;
  /** Pattern-based mappings (regex -> NodeType) */
  patternMappings: Array<{ pattern: RegExp; nodeType: NodeType; priority: number }>;
  /** Context-aware classification rules */
  contextRules: Array<ContextRule>;
  /** Default fallback for unknown types */
  defaultFallback: NodeType;
}

/**
 * Context-aware classification rule
 */
export interface ContextRule {
  /** Condition that must be met */
  condition: (node: RawNodeData, context: ClassificationContext) => boolean;
  /** Node type to assign when condition is met */
  nodeType: NodeType;
  /** Priority (higher = applied first) */
  priority: number;
  /** Description of the rule */
  description: string;
}

/**
 * Context information for classification
 */
export interface ClassificationContext {
  /** Current node being classified */
  node: RawNodeData;
  /** Parent node if available */
  parent?: RawNodeData;
  /** Sibling nodes */
  siblings: RawNodeData[];
  /** Language being parsed */
  language: string;
  /** Additional context data */
  metadata: Record<string, any>;
}

/**
 * Classification statistics and accuracy metrics
 */
export interface ClassificationStats {
  /** Total nodes classified */
  totalClassified: number;
  /** Classifications by language */
  byLanguage: Record<string, number>;
  /** Classifications by node type */
  byNodeType: Record<string, number>;
  /** Average confidence score */
  averageConfidence: number;
  /** Number of fallback classifications used */
  fallbackUsage: number;
  /** Accuracy metrics (if validation data available) */
  accuracy?: {
    correct: number;
    total: number;
    percentage: number;
  };
}

/**
 * Node Classifier
 * 
 * Provides intelligent classification of raw parser nodes into normalized
 * AST node types with language-specific mappings and extensible architecture.
 */
export class NodeClassifier {
  private static readonly LANGUAGE_MAPPINGS: Record<string, LanguageMapping> = {
    typescript: {
      directMappings: {
        // Top-level constructs
        'source_file': NodeType.FILE,
        'module': NodeType.MODULE,
        'namespace_declaration': NodeType.NAMESPACE,
        
        // Class-related
        'class_declaration': NodeType.CLASS,
        'interface_declaration': NodeType.INTERFACE,
        'enum_declaration': NodeType.ENUM,
        'type_alias_declaration': NodeType.TYPE_ALIAS,
        
        // Function-related
        'function_declaration': NodeType.FUNCTION,
        'method_definition': NodeType.METHOD,
        'constructor_definition': NodeType.CONSTRUCTOR,
        'get_accessor': NodeType.GETTER,
        'set_accessor': NodeType.SETTER,
        'arrow_function': NodeType.ARROW_FUNCTION,
        'function_expression': NodeType.FUNCTION,
        
        // Variable-related
        'variable_declarator': NodeType.VARIABLE,
        'parameter': NodeType.PARAMETER,
        'property_declaration': NodeType.PROPERTY,
        'property_signature': NodeType.PROPERTY,
        'public_field_definition': NodeType.FIELD,
        'private_field_definition': NodeType.FIELD,
        
        // Control flow
        'if_statement': NodeType.IF_STATEMENT,
        'for_statement': NodeType.FOR_LOOP,
        'for_in_statement': NodeType.FOR_LOOP,
        'for_of_statement': NodeType.FOR_LOOP,
        'while_statement': NodeType.WHILE_LOOP,
        'do_statement': NodeType.WHILE_LOOP,
        'switch_statement': NodeType.SWITCH_STATEMENT,
        'try_statement': NodeType.TRY_CATCH,
        
        // Imports and exports
        'import_statement': NodeType.IMPORT,
        'import_declaration': NodeType.IMPORT,
        'export_statement': NodeType.EXPORT,
        'export_declaration': NodeType.EXPORT,
        
        // Other constructs
        'decorator': NodeType.DECORATOR,
        'comment': NodeType.COMMENT,
        'string': NodeType.STRING_LITERAL,
        'template_string': NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*variable.*$/, nodeType: NodeType.VARIABLE, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) => 
            node.type === 'identifier' && 
            context.parent?.type === 'class_declaration',
          nodeType: NodeType.CLASS,
          priority: 10,
          description: 'Class name identifier',
        },
        {
          condition: (node, context) => 
            node.type === 'identifier' && 
            context.parent?.type === 'function_declaration',
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: 'Function name identifier',
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },
    
    javascript: {
      directMappings: {
        // Top-level constructs
        'program': NodeType.FILE,
        'module': NodeType.MODULE,
        
        // Class-related
        'class_declaration': NodeType.CLASS,
        'class_expression': NodeType.CLASS,
        
        // Function-related
        'function_declaration': NodeType.FUNCTION,
        'function_expression': NodeType.FUNCTION,
        'method_definition': NodeType.METHOD,
        'arrow_function': NodeType.ARROW_FUNCTION,
        
        // Variable-related
        'variable_declarator': NodeType.VARIABLE,
        'parameter': NodeType.PARAMETER,
        'property_definition': NodeType.PROPERTY,
        
        // Control flow
        'if_statement': NodeType.IF_STATEMENT,
        'for_statement': NodeType.FOR_LOOP,
        'for_in_statement': NodeType.FOR_LOOP,
        'for_of_statement': NodeType.FOR_LOOP,
        'while_statement': NodeType.WHILE_LOOP,
        'do_statement': NodeType.WHILE_LOOP,
        'switch_statement': NodeType.SWITCH_STATEMENT,
        'try_statement': NodeType.TRY_CATCH,
        
        // Imports and exports
        'import_statement': NodeType.IMPORT,
        'export_statement': NodeType.EXPORT,
        
        // Other constructs
        'comment': NodeType.COMMENT,
        'string': NodeType.STRING_LITERAL,
        'template_string': NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*variable.*$/, nodeType: NodeType.VARIABLE, priority: 1 },
      ],
      contextRules: [],
      defaultFallback: NodeType.VARIABLE,
    },
    
    python: {
      directMappings: {
        // Top-level constructs
        'module': NodeType.FILE,
        
        // Class-related
        'class_definition': NodeType.CLASS,
        
        // Function-related
        'function_definition': NodeType.FUNCTION,
        'lambda': NodeType.ARROW_FUNCTION,
        
        // Variable-related
        'assignment': NodeType.VARIABLE,
        'parameter': NodeType.PARAMETER,
        
        // Control flow
        'if_statement': NodeType.IF_STATEMENT,
        'for_statement': NodeType.FOR_LOOP,
        'while_statement': NodeType.WHILE_LOOP,
        'with_statement': NodeType.TRY_CATCH, // Similar resource handling
        'try_statement': NodeType.TRY_CATCH,
        
        // Imports and exports
        'import_statement': NodeType.IMPORT,
        'import_from_statement': NodeType.IMPORT,
        
        // Other constructs
        'comment': NodeType.COMMENT,
        'string': NodeType.STRING_LITERAL,
        'decorator': NodeType.DECORATOR,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*def.*$/, nodeType: NodeType.FUNCTION, priority: 2 },
      ],
      contextRules: [
        {
          condition: (node, context) => 
            node.type === 'identifier' && 
            context.parent?.type === 'function_definition',
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: 'Function name in Python def',
        },
        {
          condition: (node, context) => 
            node.type === 'assignment' && 
            context.parent?.type === 'class_definition',
          nodeType: NodeType.FIELD,
          priority: 8,
          description: 'Class attribute assignment',
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },
  };

  private stats: ClassificationStats = {
    totalClassified: 0,
    byLanguage: {},
    byNodeType: {},
    averageConfidence: 0,
    fallbackUsage: 0,
  };
  
  private confidenceScores: number[] = [];

  /**
   * Classify a raw node into a normalized NodeType
   * 
   * @param rawNode - Raw node data from parser
   * @param context - Optional classification context
   * @returns Classification result with confidence
   */
  classifyNode(rawNode: RawNodeData, context?: Partial<ClassificationContext>): ClassificationResult {
    try {
      const fullContext: ClassificationContext = {
        node: rawNode,
        parent: context?.parent,
        siblings: context?.siblings || [],
        language: rawNode.language,
        metadata: context?.metadata || {},
      };

      const mapping = this.getLanguageMapping(rawNode.language);
      let result = this.performClassification(rawNode, mapping, fullContext);

      // Update statistics
      this.updateStats(result, rawNode.language);

      return result;
    } catch (error) {
      // Fallback classification on error
      const fallbackResult: ClassificationResult = {
        nodeType: NodeType.VARIABLE,
        confidence: 0.1,
        reason: `Classification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      
      this.updateStats(fallbackResult, rawNode.language);
      return fallbackResult;
    }
  }

  /**
   * Classify multiple nodes efficiently
   * 
   * @param rawNodes - Array of raw node data
   * @returns Array of classification results
   */
  classifyBatch(rawNodes: RawNodeData[]): ClassificationResult[] {
    return rawNodes.map(node => this.classifyNode(node));
  }

  /**
   * Get supported languages
   * 
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): string[] {
    return Object.keys(NodeClassifier.LANGUAGE_MAPPINGS);
  }

  /**
   * Add or update language mapping
   * 
   * @param language - Language identifier
   * @param mapping - Language mapping configuration
   */
  addLanguageMapping(language: string, mapping: LanguageMapping): void {
    NodeClassifier.LANGUAGE_MAPPINGS[language] = mapping;
  }

  /**
   * Get classification statistics
   * 
   * @returns Current statistics
   */
  getStats(): ClassificationStats {
    // Update average confidence
    if (this.confidenceScores.length > 0) {
      this.stats.averageConfidence = 
        this.confidenceScores.reduce((sum, score) => sum + score, 0) / 
        this.confidenceScores.length;
    }

    return { ...this.stats };
  }

  /**
   * Reset classification statistics
   */
  resetStats(): void {
    this.stats = {
      totalClassified: 0,
      byLanguage: {},
      byNodeType: {},
      averageConfidence: 0,
      fallbackUsage: 0,
    };
    this.confidenceScores = [];
  }

  /**
   * Validate classification accuracy against known correct data
   * 
   * @param testData - Array of nodes with expected classifications
   * @returns Accuracy metrics
   */
  validateAccuracy(testData: Array<{ node: RawNodeData; expected: NodeType }>): { correct: number; total: number; percentage: number } {
    let correct = 0;
    const total = testData.length;

    for (const { node, expected } of testData) {
      const result = this.classifyNode(node);
      if (result.nodeType === expected) {
        correct++;
      }
    }

    const accuracy = {
      correct,
      total,
      percentage: total > 0 ? (correct / total) * 100 : 0,
    };

    this.stats.accuracy = accuracy;
    return accuracy;
  }

  /**
   * Get language mapping for the specified language
   */
  private getLanguageMapping(language: string): LanguageMapping {
    const mapping = NodeClassifier.LANGUAGE_MAPPINGS[language.toLowerCase()];
    if (!mapping) {
      // Return default mapping for unknown languages
      return {
        directMappings: {},
        patternMappings: [],
        contextRules: [],
        defaultFallback: NodeType.VARIABLE,
      };
    }
    return mapping;
  }

  /**
   * Perform the actual classification logic
   */
  private performClassification(
    rawNode: RawNodeData, 
    mapping: LanguageMapping, 
    context: ClassificationContext
  ): ClassificationResult {
    const alternatives: Array<{ nodeType: NodeType; confidence: number; reason: string }> = [];

    // 1. Try context rules first (highest priority)
    const contextRules = mapping.contextRules.sort((a, b) => b.priority - a.priority);
    for (const rule of contextRules) {
      if (rule.condition(rawNode, context)) {
        return {
          nodeType: rule.nodeType,
          confidence: 0.95,
          reason: `Context rule: ${rule.description}`,
          alternatives,
        };
      }
    }

    // 2. Try direct mappings
    const directMapping = mapping.directMappings[rawNode.type];
    if (directMapping) {
      return {
        nodeType: directMapping,
        confidence: 0.9,
        reason: `Direct mapping for '${rawNode.type}'`,
        alternatives,
      };
    }

    // 3. Try pattern mappings
    const patternMappings = mapping.patternMappings.sort((a, b) => b.priority - a.priority);
    for (const pattern of patternMappings) {
      if (pattern.pattern.test(rawNode.type)) {
        alternatives.push({
          nodeType: pattern.nodeType,
          confidence: 0.7,
          reason: `Pattern match: ${pattern.pattern}`,
        });
      }
    }

    // Return best pattern match if any
    if (alternatives.length > 0) {
      const best = alternatives[0];
      if (best) {
        return {
          nodeType: best.nodeType,
          confidence: best.confidence,
          reason: best.reason,
          alternatives: alternatives.slice(1),
        };
      }
    }

    // 4. Use fallback
    return {
      nodeType: mapping.defaultFallback,
      confidence: 0.5,
      reason: `Fallback for unknown type '${rawNode.type}'`,
      alternatives,
    };
  }

  /**
   * Update classification statistics
   */
  private updateStats(result: ClassificationResult, language: string): void {
    this.stats.totalClassified++;
    
    // Track by language
    this.stats.byLanguage[language] = (this.stats.byLanguage[language] || 0) + 1;
    
    // Track by node type
    const nodeTypeKey = result.nodeType;
    this.stats.byNodeType[nodeTypeKey] = (this.stats.byNodeType[nodeTypeKey] || 0) + 1;
    
    // Track confidence
    this.confidenceScores.push(result.confidence);
    
    // Keep only recent confidence scores for rolling average
    if (this.confidenceScores.length > 1000) {
      this.confidenceScores.shift();
    }
    
    // Track fallback usage
    if (result.confidence <= 0.5) {
      this.stats.fallbackUsage++;
    }
  }
}

/**
 * Utility functions for node classification
 */
export class ClassificationUtils {
  /**
   * Check if a node type is likely to be a container (has children)
   * 
   * @param nodeType - Node type to check
   * @returns True if typically contains other nodes
   */
  static isContainerType(nodeType: NodeType): boolean {
    return [
      NodeType.FILE,
      NodeType.MODULE,
      NodeType.NAMESPACE,
      NodeType.CLASS,
      NodeType.INTERFACE,
      NodeType.FUNCTION,
      NodeType.METHOD,
      NodeType.CONSTRUCTOR,
      NodeType.IF_STATEMENT,
      NodeType.FOR_LOOP,
      NodeType.WHILE_LOOP,
      NodeType.SWITCH_STATEMENT,
      NodeType.TRY_CATCH,
    ].includes(nodeType);
  }

  /**
   * Check if a node type represents a declaration
   * 
   * @param nodeType - Node type to check
   * @returns True if it's a declaration type
   */
  static isDeclarationType(nodeType: NodeType): boolean {
    return [
      NodeType.CLASS,
      NodeType.INTERFACE,
      NodeType.ENUM,
      NodeType.TYPE_ALIAS,
      NodeType.FUNCTION,
      NodeType.METHOD,
      NodeType.CONSTRUCTOR,
      NodeType.VARIABLE,
      NodeType.PARAMETER,
      NodeType.PROPERTY,
      NodeType.FIELD,
    ].includes(nodeType);
  }

  /**
   * Get the hierarchical level of a node type
   * 
   * @param nodeType - Node type to evaluate
   * @returns Numeric level (0 = top-level, higher = more nested)
   */
  static getHierarchyLevel(nodeType: NodeType): number {
    const levels: Partial<Record<NodeType, number>> = {
      [NodeType.FILE]: 0,
      [NodeType.MODULE]: 1,
      [NodeType.NAMESPACE]: 2,
      [NodeType.CLASS]: 3,
      [NodeType.INTERFACE]: 3,
      [NodeType.ENUM]: 3,
      [NodeType.FUNCTION]: 4,
      [NodeType.METHOD]: 4,
      [NodeType.CONSTRUCTOR]: 4,
      [NodeType.PROPERTY]: 5,
      [NodeType.FIELD]: 5,
      [NodeType.VARIABLE]: 6,
      [NodeType.PARAMETER]: 7,
    };

    return levels[nodeType] ?? 8; // Default high level for others
  }
}

/**
 * Default singleton instance for common usage
 */
export const defaultNodeClassifier = new NodeClassifier();