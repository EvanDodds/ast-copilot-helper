/**
 * Native Tree-sitter parser implementation using node-tree-sitter
 * Provides high-performance AST parsing using native bindings
 */

import { BaseParser } from './base-parser.js';
import { ASTNode, LanguageConfig, ParserRuntime } from '../types.js';
import { generateNodeId } from '../types.js';
import { TreeSitterGrammarManager } from '../grammar-manager.js';

/**
 * Native Tree-sitter parser implementation
 */
export class NativeTreeSitterParser extends BaseParser {
  private grammarManager: TreeSitterGrammarManager;
  private TreeSitter: any;
  private parsers: Map<string, any> = new Map();

  constructor(runtime: ParserRuntime, grammarManager: TreeSitterGrammarManager) {
    super(runtime);
    this.grammarManager = grammarManager;
  }

  /**
   * Initialize the native Tree-sitter module
   */
  private async initializeTreeSitter(): Promise<void> {
    if (this.TreeSitter) {
      return;
    }

    try {
      // Dynamic import of tree-sitter (native)
      this.TreeSitter = (await import('tree-sitter')).default;
    } catch (error) {
      throw new Error(`Failed to load native tree-sitter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create a parser instance for the specified language
   */
  protected async getParserForLanguage(config: LanguageConfig): Promise<any> {
    // Check if we already have a parser for this language
    if (this.parsers.has(config.name)) {
      return this.parsers.get(config.name);
    }

    // Initialize Tree-sitter if needed
    await this.initializeTreeSitter();

    // Create new parser
    const parser = new this.TreeSitter();

    // Load the language grammar
    let language;
    try {
      if (config.parserModule) {
        // Try to load native parser module first
        try {
          const languageModule = await import(config.parserModule);
          language = languageModule.default || languageModule;
        } catch (error) {
          // If native module fails, fall back to grammar manager
          console.warn(`Native module ${config.parserModule} failed to load, falling back to grammar manager:`, error);
          language = await this.loadLanguageFromGrammar(config);
        }
      } else {
        // Use grammar manager for loading
        language = await this.loadLanguageFromGrammar(config);
      }
    } catch (error) {
      throw new Error(`Failed to load language ${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Set language on parser
    try {
      parser.setLanguage(language);
    } catch (error) {
      throw new Error(`Failed to set language ${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Cache the parser
    this.parsers.set(config.name, parser);
    this.initializedLanguages.set(config.name, language);

    return parser;
  }

  /**
   * Load language from grammar file using grammar manager
   */
  private async loadLanguageFromGrammar(config: LanguageConfig): Promise<any> {
    try {
      // Ensure grammar is downloaded and cached
      await this.grammarManager.downloadGrammar(config.name);
      
      // For native parsing, we need to dynamically load the grammar
      // This is more complex than WASM and may require compilation
      // For now, we'll throw an error as this requires more setup
      throw new Error(`Native grammar loading for ${config.name} requires pre-compiled native modules. Please install ${config.parserModule} package.`);
    } catch (error) {
      throw new Error(`Grammar loading failed for ${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Tree-sitter tree to AST nodes array
   */
  protected treeToASTNodes(tree: any, sourceCode: string, filePath: string, language: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const cursor = tree.walk();

    // Stack to track scope chain
    const scopeStack: string[] = [];

    const processNode = (depth = 0) => {
      const node = cursor.currentNode;
      
      // Skip anonymous nodes and tokens
      if (node.isNamed && this.isSignificantNode(node.type)) {
        const startPos = node.startPosition;
        const endPos = node.endPosition;
        
        // Generate node ID
        const id = generateNodeId(filePath, startPos.row + 1, startPos.column + 1, node.type);
        
        // Extract node name if available
        const name = this.extractNodeName(node, sourceCode);
        
        // Determine modifiers and scope
        const modifiers = this.extractModifiers(node);
        const nodeScope = [...scopeStack];
        
        // Update scope for container nodes
        if (this.isContainerNode(node.type)) {
          if (name) {
            scopeStack.push(name);
          }
        }

        // Create AST node
        const astNode: ASTNode = {
          id,
          type: this.normalizeNodeType(node.type),
          name,
          filePath,
          start: { line: startPos.row + 1, column: startPos.column + 1 },
          end: { line: endPos.row + 1, column: endPos.column + 1 },
          children: [], // Will be populated in second pass
          metadata: {
            language,
            scope: nodeScope,
            modifiers,
            complexity: this.calculateComplexity(node),
          },
        };

        nodes.push(astNode);
      }

      // Visit children
      const childIds: string[] = [];
      if (cursor.gotoFirstChild()) {
        do {
          const childId = processNode(depth + 1);
          if (childId) {
            childIds.push(childId);
          }
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }

      // Update scope for container nodes (pop on exit)
      if (node.isNamed && this.isContainerNode(node.type) && cursor.currentNode === node) {
        const name = this.extractNodeName(node, sourceCode);
        if (name && scopeStack[scopeStack.length - 1] === name) {
          scopeStack.pop();
        }
      }

      return node.isNamed && this.isSignificantNode(node.type) ? 
        generateNodeId(filePath, node.startPosition.row + 1, node.startPosition.column + 1, node.type) :
        null;
    };

    // First pass: create nodes
    processNode();

    // Second pass: establish parent-child relationships
    this.establishRelationships(nodes, tree);

    return nodes;
  }

  /**
   * Check if a node type is significant for AST representation
   */
  private isSignificantNode(nodeType: string): boolean {
    const significantTypes = new Set([
      // Common significant node types across languages
      'function', 'function_definition', 'function_declaration',
      'class', 'class_definition', 'class_declaration',
      'method', 'method_definition', 'method_declaration',
      'interface', 'interface_declaration',
      'variable', 'variable_declaration', 'variable_declarator',
      'import', 'import_statement', 'import_declaration',
      'export', 'export_statement', 'export_declaration',
      'if_statement', 'for_statement', 'while_statement', 'try_statement',
      'block', 'statement_block',
      'identifier', 'property_identifier',
      'call_expression', 'assignment_expression',
      'module', 'program', 'source_file',
    ]);

    return significantTypes.has(nodeType) || nodeType.includes('_statement') || nodeType.includes('_expression');
  }

  /**
   * Check if a node type is a container that affects scope
   */
  private isContainerNode(nodeType: string): boolean {
    const containerTypes = new Set([
      'function', 'function_definition', 'function_declaration',
      'class', 'class_definition', 'class_declaration',
      'interface', 'interface_declaration',
      'method', 'method_definition', 'method_declaration',
      'module', 'namespace',
    ]);

    return containerTypes.has(nodeType);
  }

  /**
   * Extract node name (identifier) from the node
   */
  private extractNodeName(node: any, sourceCode: string): string | undefined {
    // Look for identifier child nodes
    const cursor = node.walk();
    if (cursor.gotoFirstChild()) {
      do {
        const child = cursor.currentNode;
        if (child.type === 'identifier' || child.type === 'property_identifier') {
          return sourceCode.slice(child.startIndex, child.endIndex);
        }
      } while (cursor.gotoNextSibling());
    }

    // Fallback: if the node itself contains text and is small
    const nodeText = sourceCode.slice(node.startIndex, node.endIndex);
    if (nodeText.length < 100 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(nodeText)) {
      return nodeText;
    }

    return undefined;
  }

  /**
   * Extract modifiers from node (async, static, public, etc.)
   */
  private extractModifiers(node: any): string[] {
    const modifiers: string[] = [];
    
    // Look for modifier nodes
    const cursor = node.walk();
    if (cursor.gotoFirstChild()) {
      do {
        const child = cursor.currentNode;
        if (child.type && this.isModifier(child.type)) {
          modifiers.push(child.type);
        }
      } while (cursor.gotoNextSibling());
    }

    return modifiers;
  }

  /**
   * Check if a node type represents a modifier
   */
  private isModifier(nodeType: string): boolean {
    const modifierTypes = new Set([
      'public', 'private', 'protected',
      'static', 'abstract', 'final',
      'async', 'await', 'const', 'readonly',
      'export', 'default',
    ]);

    return modifierTypes.has(nodeType);
  }

  /**
   * Normalize node types to common names across languages
   */
  private normalizeNodeType(nodeType: string): string {
    const normalizations: Record<string, string> = {
      'function_definition': 'function',
      'function_declaration': 'function',
      'method_definition': 'method',
      'method_declaration': 'method',
      'class_definition': 'class',
      'class_declaration': 'class',
      'interface_declaration': 'interface',
      'variable_declaration': 'variable',
      'variable_declarator': 'variable',
      'import_declaration': 'import',
      'import_statement': 'import',
      'export_declaration': 'export',
      'export_statement': 'export',
    };

    return normalizations[nodeType] || nodeType;
  }

  /**
   * Calculate cyclomatic complexity for a node
   */
  private calculateComplexity(node: any): number {
    let complexity = 0;
    const complexityNodes = new Set([
      'if_statement', 'for_statement', 'while_statement', 'do_statement',
      'switch_statement', 'case', 'catch_clause', 'conditional_expression',
      'logical_and', 'logical_or',
    ]);

    const cursor = node.walk();
    const visitNode = () => {
      if (complexityNodes.has(cursor.currentNode.type)) {
        complexity++;
      }

      if (cursor.gotoFirstChild()) {
        do {
          visitNode();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visitNode();
    return complexity;
  }

  /**
   * Establish parent-child relationships between nodes
   */
  private establishRelationships(nodes: ASTNode[], tree: any): void {
    const nodeMap = new Map<string, ASTNode>();
    
    // Build node lookup map
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build hierarchy by walking the tree again
    const cursor = tree.walk();
    const processHierarchy = () => {
      const node = cursor.currentNode;
      
      if (node.isNamed && this.isSignificantNode(node.type)) {
        const startPos = node.startPosition;
        const nodeId = generateNodeId('', startPos.row + 1, startPos.column + 1, node.type);
        const astNode = nodeMap.get(nodeId.replace(/^[^:]*:/, '')); // Remove file path prefix for lookup
        
        if (astNode && cursor.gotoFirstChild()) {
          do {
            const child = cursor.currentNode;
            if (child.isNamed && this.isSignificantNode(child.type)) {
              const childStartPos = child.startPosition;
              const childId = generateNodeId('', childStartPos.row + 1, childStartPos.column + 1, child.type);
              const childAstNode = nodeMap.get(childId.replace(/^[^:]*:/, ''));
              if (childAstNode) {
                astNode.children?.push(childAstNode.id);
              }
            }
            processHierarchy();
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      }

      // Visit children for non-significant nodes too
      if (cursor.gotoFirstChild()) {
        do {
          processHierarchy();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    processHierarchy();
  }

  /**
   * Clean up resources
   */
  override async dispose(): Promise<void> {
    await super.dispose();
    this.parsers.clear();
    this.TreeSitter = null;
  }
}