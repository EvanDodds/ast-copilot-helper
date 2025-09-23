import crypto from 'crypto';
import type { ASTNode, NormalizedASTNode, NodePosition } from './types.js';

/**
 * Configuration for AST normalization rules per language
 */
export interface NormalizationConfig {
  /** Language-specific node type mappings */
  nodeTypeMappings: Record<string, string>;
  
  /** Node types to ignore during normalization */
  ignoredNodeTypes: Set<string>;
  
  /** Node types that represent identifier-like constructs */
  identifierTypes: Set<string>;
  
  /** Node types that represent literal values */
  literalTypes: Set<string>;
  
  /** Node types that represent declarations */
  declarationTypes: Set<string>;
  
  /** Node types that represent statements */
  statementTypes: Set<string>;
  
  /** Node types that represent expressions */
  expressionTypes: Set<string>;
  
  /** Language-specific scope boundary indicators */
  scopeBoundaries: Set<string>;
  
  /** Custom normalization rules for specific node types */
  customRules?: Record<string, (node: ASTNode) => Partial<NormalizedASTNode>>;
}

/**
 * Default normalization configurations for supported languages
 */
export const NORMALIZATION_CONFIGS: Record<string, NormalizationConfig> = {
  typescript: {
    nodeTypeMappings: {
      'program': 'source_file',
      'function_declaration': 'function_definition',
      'method_definition': 'method_definition',
      'variable_declaration': 'variable_declaration',
      'const_declaration': 'variable_declaration',
      'let_declaration': 'variable_declaration',
      'interface_declaration': 'interface_definition',
      'class_declaration': 'class_definition',
      'type_alias_declaration': 'type_definition',
      'import_statement': 'import_statement',
      'export_statement': 'export_statement',
      'call_expression': 'function_call',
      'new_expression': 'constructor_call',
    },
    ignoredNodeTypes: new Set([
      'comment', 'line_comment', 'block_comment',
      '{', '}', '(', ')', '[', ']',
      ';', ',', '.', ':', '=',
      'whitespace',
    ]),
    identifierTypes: new Set([
      'identifier', 'type_identifier', 'property_identifier',
      'shorthand_property_identifier', 'statement_identifier',
    ]),
    literalTypes: new Set([
      'string', 'template_string', 'number', 'true', 'false', 'null', 'undefined',
      'string_literal', 'numeric_literal', 'boolean_literal',
    ]),
    declarationTypes: new Set([
      'variable_declaration', 'function_declaration', 'class_declaration',
      'interface_declaration', 'type_alias_declaration', 'enum_declaration',
      'method_definition', 'property_definition',
    ]),
    statementTypes: new Set([
      'expression_statement', 'if_statement', 'while_statement', 'for_statement',
      'return_statement', 'break_statement', 'continue_statement', 'throw_statement',
      'try_statement', 'switch_statement', 'block_statement',
    ]),
    expressionTypes: new Set([
      'call_expression', 'member_expression', 'binary_expression', 'unary_expression',
      'conditional_expression', 'arrow_function', 'function_expression',
      'object_expression', 'array_expression', 'assignment_expression',
    ]),
    scopeBoundaries: new Set([
      'function_declaration', 'method_definition', 'arrow_function', 'function_expression',
      'class_declaration', 'interface_declaration', 'block_statement',
    ]),
  },

  javascript: {
    nodeTypeMappings: {
      'program': 'source_file',
      'function_declaration': 'function_definition',
      'method_definition': 'method_definition',
      'variable_declaration': 'variable_declaration',
      'const_declaration': 'variable_declaration',
      'let_declaration': 'variable_declaration',
      'var_declaration': 'variable_declaration',
      'class_declaration': 'class_definition',
      'import_statement': 'import_statement',
      'export_statement': 'export_statement',
      'call_expression': 'function_call',
      'new_expression': 'constructor_call',
    },
    ignoredNodeTypes: new Set([
      'comment', 'line_comment', 'block_comment',
      '{', '}', '(', ')', '[', ']',
      ';', ',', '.', ':', '=',
      'whitespace',
    ]),
    identifierTypes: new Set([
      'identifier', 'property_identifier', 'shorthand_property_identifier',
      'statement_identifier',
    ]),
    literalTypes: new Set([
      'string', 'template_string', 'number', 'true', 'false', 'null', 'undefined',
      'string_literal', 'numeric_literal', 'boolean_literal', 'regex',
    ]),
    declarationTypes: new Set([
      'variable_declaration', 'const_declaration', 'let_declaration', 'var_declaration',
      'function_declaration', 'class_declaration',
      'method_definition', 'property_definition',
    ]),
    statementTypes: new Set([
      'expression_statement', 'if_statement', 'while_statement', 'for_statement',
      'return_statement', 'break_statement', 'continue_statement', 'throw_statement',
      'try_statement', 'switch_statement', 'block_statement',
    ]),
    expressionTypes: new Set([
      'call_expression', 'member_expression', 'binary_expression', 'unary_expression',
      'conditional_expression', 'arrow_function', 'function_expression',
      'object_expression', 'array_expression', 'assignment_expression',
    ]),
    scopeBoundaries: new Set([
      'function_declaration', 'method_definition', 'arrow_function', 'function_expression',
      'class_declaration', 'block_statement',
    ]),
  },

  python: {
    nodeTypeMappings: {
      'module': 'source_file',
      'function_definition': 'function_definition',
      'async_function_definition': 'function_definition',
      'class_definition': 'class_definition',
      'import_statement': 'import_statement',
      'import_from_statement': 'import_statement',
      'call': 'function_call',
    },
    ignoredNodeTypes: new Set([
      'comment', 'line_comment',
      '(', ')', '[', ']', '{', '}',
      ':', ',', '.', '=',
      'whitespace', 'newline', 'indent', 'dedent',
    ]),
    identifierTypes: new Set([
      'identifier', 'attribute', 'dotted_name',
    ]),
    literalTypes: new Set([
      'string', 'integer', 'float', 'true', 'false', 'none',
      'string_literal', 'numeric_literal', 'boolean_literal',
      'bytes', 'raw_string', 'f_string',
    ]),
    declarationTypes: new Set([
      'function_definition', 'async_function_definition', 'class_definition',
      'assignment', 'augmented_assignment', 'annotated_assignment',
    ]),
    statementTypes: new Set([
      'expression_statement', 'if_statement', 'while_statement', 'for_statement',
      'return_statement', 'break_statement', 'continue_statement', 'raise_statement',
      'try_statement', 'with_statement', 'pass_statement', 'del_statement',
    ]),
    expressionTypes: new Set([
      'call', 'attribute', 'binary_operator', 'unary_operator',
      'conditional_expression', 'lambda', 'list_comprehension',
      'dictionary_comprehension', 'set_comprehension', 'generator_expression',
    ]),
    scopeBoundaries: new Set([
      'function_definition', 'async_function_definition', 'class_definition',
      'lambda', 'list_comprehension', 'dictionary_comprehension',
    ]),
  },
};

/**
 * Normalized AST node with consistent structure across languages
 */

/**
 * Options for AST normalization
 */
export interface NormalizationOptions {
  /** Include position information in normalization */
  includePositions?: boolean;
  
  /** Include original node types */
  preserveOriginalTypes?: boolean;
  
  /** Maximum depth for normalization (prevents infinite recursion) */
  maxDepth?: number;
  
  /** Custom normalization config to override defaults */
  customConfig?: Partial<NormalizationConfig>;
  
  /** Generate content hashes for change detection */
  generateHashes?: boolean;
  
  /** Include complexity calculations */
  includeComplexity?: boolean;
}

/**
 * AST Normalizer that creates consistent node representations across languages
 */
export class ASTNormalizer {
  private configs: Record<string, NormalizationConfig>;
  private nodeCache = new Map<string, NormalizedASTNode>();
  
  constructor(customConfigs?: Record<string, Partial<NormalizationConfig>>) {
    this.configs = { ...NORMALIZATION_CONFIGS };
    
    // Merge custom configurations
    if (customConfigs) {
      for (const [language, customConfig] of Object.entries(customConfigs)) {
        if (this.configs[language]) {
          this.configs[language] = this.mergeConfigs(this.configs[language], customConfig);
        } else {
          this.configs[language] = this.createDefaultConfig(customConfig);
        }
      }
    }
  }

  /**
   * Normalize a single AST node and its children
   */
  async normalize(
    node: ASTNode,
    language: string,
    filePath: string,
    options: NormalizationOptions = {}
  ): Promise<NormalizedASTNode> {
    const config = this.getLanguageConfig(language);
    const opts = this.mergeOptions(options);
    
    return this.normalizeNode(node, config, language, filePath, opts, 0, '');
  }

  /**
   * Normalize an array of AST nodes
   */
  async normalizeNodes(
    nodes: ASTNode[],
    language: string,
    filePath: string,
    options: NormalizationOptions = {}
  ): Promise<NormalizedASTNode[]> {
    const config = this.getLanguageConfig(language);
    const opts = this.mergeOptions(options);
    
    const normalized: NormalizedASTNode[] = [];
    for (const node of nodes) {
      const normalizedNode = await this.normalizeNode(
        node, config, language, filePath, opts, 0, ''
      );
      normalized.push(normalizedNode);
    }
    
    return normalized;
  }

  /**
   * Generate a deterministic ID for a node
   */
  generateNodeId(
    node: ASTNode,
    language: string,
    filePath: string,
    scopeId: string
  ): string {
    const content = `${filePath}:${language}:${node.type}:${node.start.line}:${node.start.column}:${scopeId}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Calculate content hash for a node
   */
  generateContentHash(node: ASTNode, sourceCode: string): string {
    // Extract source code for the node
    const startOffset = this.positionToOffset(sourceCode, node.start);
    const endOffset = this.positionToOffset(sourceCode, node.end);
    const nodeContent = sourceCode.slice(startOffset, endOffset);
    
    return crypto.createHash('md5').update(nodeContent).digest('hex');
  }

  /**
   * Clear the normalization cache
   */
  clearCache(): void {
    this.nodeCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // For now, just return basic stats
    return {
      size: this.nodeCache.size,
      hitRate: 0, // Would need to track hits/misses for real implementation
    };
  }

  private normalizeNode(
    node: ASTNode,
    config: NormalizationConfig,
    language: string,
    filePath: string,
    options: Required<NormalizationOptions>,
    depth: number,
    parentScopeId: string
  ): NormalizedASTNode {
    if (depth > options.maxDepth) {
      throw new Error(`Maximum normalization depth (${options.maxDepth}) exceeded`);
    }

    // Check if node should be ignored
    if (config.ignoredNodeTypes.has(node.type)) {
      // Return a minimal normalized node for ignored types
      return {
        id: this.generateNodeId(node, language, filePath, parentScopeId),
        normalizedType: 'ignored',
        originalType: node.type,
        language,
        filePath,
        position: {
          start: node.start,
          end: node.end,
        },
        metadata: {
          category: 'other',
          scopeDepth: depth,
          scopeId: parentScopeId,
          createsSope: false,
          complexity: { cyclomatic: 0, cognitive: 0, nesting: depth },
          attributes: {},
        },
        children: [],
        contentHash: '',
      };
    }

    // Determine scope information
    const createsSope = config.scopeBoundaries.has(node.type);
    const currentScopeId = createsSope ? 
      this.generateNodeId(node, language, filePath, parentScopeId) : 
      parentScopeId;

    // Normalize node type
    const normalizedType = config.nodeTypeMappings[node.type] || node.type;
    
    // Determine semantic category
    const category = this.categorizeNode(node.type, config);
    
    // Calculate complexity
    const complexity = options.includeComplexity ? 
      this.calculateComplexity(node, config, depth) : 
      { cyclomatic: 0, cognitive: 0, nesting: depth };

    // Generate node ID and content hash
    const nodeId = this.generateNodeId(node, language, filePath, currentScopeId);
    const contentHash = options.generateHashes ? 
      this.generateContentHash(node, '') : // Would need source code here
      '';

    // Apply custom rules if available
    let customAttributes = {};
    if (config.customRules?.[node.type]) {
      const customResult = config.customRules[node.type]!(node);
      customAttributes = customResult.metadata?.attributes || {};
    }

    // Normalize children
    const normalizedChildren: NormalizedASTNode[] = [];
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const normalizedChild = this.normalizeNode(
          child, config, language, filePath, options, depth + 1, currentScopeId
        );
        normalizedChildren.push(normalizedChild);
      }
    }

    const normalizedNode: NormalizedASTNode = {
      id: nodeId,
      normalizedType,
      originalType: options.preserveOriginalTypes ? node.type : '',
      language,
      filePath,
      position: options.includePositions ? {
        start: node.start,
        end: node.end,
      } : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
      metadata: {
        category,
        scopeDepth: depth,
        scopeId: currentScopeId,
        createsSope,
        complexity,
        attributes: {
          ...this.extractNodeAttributes(node, config),
          ...customAttributes,
        },
      },
      children: normalizedChildren,
      contentHash,
    };

    return normalizedNode;
  }

  private getLanguageConfig(language: string): NormalizationConfig {
    const config = this.configs[language.toLowerCase()];
    if (!config) {
      // Return a default config for unsupported languages
      return this.createDefaultConfig();
    }
    return config;
  }

  private mergeOptions(options: NormalizationOptions): Required<NormalizationOptions> {
    return {
      includePositions: options.includePositions ?? true,
      preserveOriginalTypes: options.preserveOriginalTypes ?? true,
      maxDepth: options.maxDepth ?? 100,
      customConfig: options.customConfig ?? {},
      generateHashes: options.generateHashes ?? false,
      includeComplexity: options.includeComplexity ?? true,
    };
  }

  private categorizeNode(nodeType: string, config: NormalizationConfig): NormalizedASTNode['metadata']['category'] {
    if (config.declarationTypes.has(nodeType)) {
return 'declaration';
}
    if (config.statementTypes.has(nodeType)) {
return 'statement';
}
    if (config.expressionTypes.has(nodeType)) {
return 'expression';
}
    if (config.literalTypes.has(nodeType)) {
return 'literal';
}
    if (config.identifierTypes.has(nodeType)) {
return 'identifier';
}
    return 'other';
  }

  private calculateComplexity(
    node: ASTNode, 
    _config: NormalizationConfig,  // Mark as unused with underscore
    nesting: number
  ): { cyclomatic: number; cognitive: number; nesting: number } {
    // Simplified complexity calculation
    let cyclomatic = 1; // Base complexity
    let cognitive = 0;

    // Add complexity for control flow structures
    const complexityNodes = new Set([
      'if_statement', 'while_statement', 'for_statement', 'switch_statement',
      'conditional_expression', 'try_statement', 'catch_clause',
    ]);

    if (complexityNodes.has(node.type)) {
      cyclomatic += 1;
      cognitive += 1 + nesting; // Cognitive complexity increases with nesting
    }

    return { cyclomatic, cognitive, nesting };
  }

  private extractNodeAttributes(node: ASTNode, config: NormalizationConfig): Record<string, any> {
    const attributes: Record<string, any> = {};
    
    // Add language-specific attributes based on node type
    if (config.identifierTypes.has(node.type)) {
      attributes.isIdentifier = true;
    }
    
    if (config.literalTypes.has(node.type)) {
      attributes.isLiteral = true;
    }
    
    if (config.declarationTypes.has(node.type)) {
      attributes.isDeclaration = true;
    }

    return attributes;
  }

  private mergeConfigs(
    base: NormalizationConfig, 
    custom: Partial<NormalizationConfig>
  ): NormalizationConfig {
    return {
      nodeTypeMappings: { ...base.nodeTypeMappings, ...custom.nodeTypeMappings },
      ignoredNodeTypes: new Set([...base.ignoredNodeTypes, ...(custom.ignoredNodeTypes || [])]),
      identifierTypes: new Set([...base.identifierTypes, ...(custom.identifierTypes || [])]),
      literalTypes: new Set([...base.literalTypes, ...(custom.literalTypes || [])]),
      declarationTypes: new Set([...base.declarationTypes, ...(custom.declarationTypes || [])]),
      statementTypes: new Set([...base.statementTypes, ...(custom.statementTypes || [])]),
      expressionTypes: new Set([...base.expressionTypes, ...(custom.expressionTypes || [])]),
      scopeBoundaries: new Set([...base.scopeBoundaries, ...(custom.scopeBoundaries || [])]),
      customRules: { ...base.customRules, ...custom.customRules },
    };
  }

  private createDefaultConfig(partial?: Partial<NormalizationConfig>): NormalizationConfig {
    return {
      nodeTypeMappings: {},
      ignoredNodeTypes: new Set(['comment', 'whitespace']),
      identifierTypes: new Set(['identifier']),
      literalTypes: new Set(['string', 'number', 'boolean']),
      declarationTypes: new Set(['declaration']),
      statementTypes: new Set(['statement']),
      expressionTypes: new Set(['expression']),
      scopeBoundaries: new Set(['function', 'class', 'block']),
      customRules: {},
      ...partial,
    };
  }

  private positionToOffset(source: string, position: NodePosition): number {
    const lines = source.split('\n');
    let offset = 0;
    
    for (let i = 0; i < position.line - 1; i++) {
      offset += (lines[i]?.length || 0) + 1; // +1 for newline, handle undefined
    }
    
    offset += position.column;
    return offset;
  }
}