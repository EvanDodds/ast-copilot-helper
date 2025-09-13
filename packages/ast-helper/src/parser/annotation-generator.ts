/**
 * Annotation System Implementation
 * 
 * Implements comprehensive annotation and metadata generation system
 * as specified in issue #10.
 */

import { createHash } from 'node:crypto';
import { createLogger } from '../logging/index.js';
import { ASTNode, NodeType } from './ast-schema.js';
import { 
  Annotation, 
  AnnotationConfig, 
  AnnotationMetadata,
  DEFAULT_ANNOTATION_CONFIG,
  ExportType, 
  LanguageFeatures,
  QualityMetrics
} from './annotation-types.js';

/**
 * Context for annotation generation
 */
export interface AnnotationContext {
  filePath: string;
  language: string;
  sourceText: string;
  allNodes: ASTNode[];
  imports: Map<string, string>;
  exports: Set<string>;
}

/**
 * Main annotation generator class
 */
export class AnnotationGenerator {
  private logger = createLogger();
  private config: AnnotationConfig;

  constructor(config: Partial<AnnotationConfig> = {}) {
    this.config = { ...DEFAULT_ANNOTATION_CONFIG, ...config };
  }

  /**
   * Generate annotation for a single AST node
   */
  async generateAnnotation(node: ASTNode, context: AnnotationContext): Promise<Annotation> {
    try {
      // Extract language-specific features
      const languageFeatures = this.extractLanguageFeatures(node, context);
      
      // Generate signature
      const signature = this.generateSignature(node, languageFeatures, context);
      
      // Calculate complexity
      const complexity = this.calculateComplexity(node, context);
      
      // Analyze dependencies
      const dependencies = this.analyzeDependencies(node, context);
      
      // Generate summary
      const summary = this.generateSummary(node, languageFeatures, context);
      
      // Extract source snippet
      const sourceSnippet = this.extractSourceSnippet(node, context);
      
      // Create quality metrics
      const quality = this.calculateQuality(node, signature, summary, context);
      
      // Create metadata
      const metadata = this.createMetadata(node, context, quality);

      return {
        nodeId: node.id,
        filePath: context.filePath,
        signature,
        summary,
        complexity: Math.min(complexity, this.config.complexity.maxComplexity),
        dependencies,
        sourceSnippet,
        metadata,
        languageFeatures
      };
    } catch (error) {
      this.logger.error('Failed to generate annotation for node', {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return minimal annotation on error
      return this.createFallbackAnnotation(node, context, error);
    }
  }

  /**
   * Extract language-specific features from a node
   */
  private extractLanguageFeatures(node: ASTNode, context: AnnotationContext): LanguageFeatures {
    const features: LanguageFeatures = {
      language: context.language,
      decorators: node.metadata.annotations || [],
      modifiers: node.metadata.modifiers || []
    };

    switch (context.language) {
      case 'typescript':
        this.extractTypeScriptFeatures(node, features);
        break;
      case 'javascript':
        this.extractJavaScriptFeatures(node, features);
        break;
      case 'python':
        this.extractPythonFeatures(node, features);
        break;
      case 'java':
        this.extractJavaFeatures(node, features);
        break;
    }

    return features;
  }

  /**
   * Extract TypeScript-specific features
   */
  private extractTypeScriptFeatures(node: ASTNode, features: LanguageFeatures): void {
    // Extract type annotations
    if (node.metadata.languageSpecific?.typeAnnotation) {
      features.typeAnnotations = [node.metadata.languageSpecific.typeAnnotation];
    }

    // Extract generics
    if (node.metadata.languageSpecific?.generics) {
      features.generics = node.metadata.languageSpecific.generics;
    }

    // Extract interface implementations
    if (node.metadata.languageSpecific?.implements) {
      features.implements = node.metadata.languageSpecific.implements;
    }

    // Extract inheritance
    if (node.metadata.languageSpecific?.extends) {
      features.extends = [node.metadata.languageSpecific.extends];
    }

    // Detect async/generator patterns
    features.isAsync = features.modifiers.includes('async');
    features.isGenerator = features.modifiers.includes('generator') || node.name?.includes('*');

    // Determine export type
    if (features.modifiers.includes('export')) {
      if (features.modifiers.includes('default')) {
        features.exportType = ExportType.DEFAULT;
      } else {
        features.exportType = ExportType.NAMED;
      }
    }
  }

  /**
   * Extract JavaScript-specific features
   */
  private extractJavaScriptFeatures(node: ASTNode, features: LanguageFeatures): void {
    // Similar to TypeScript but without type annotations
    features.isAsync = features.modifiers.includes('async');
    features.isGenerator = features.modifiers.includes('generator') || node.name?.includes('*');

    // ES6+ class features
    if (node.type === NodeType.CLASS) {
      // Extract extends from modifiers or metadata
      const extendsMatch = features.modifiers.find(m => m.startsWith('extends:'));
      if (extendsMatch) {
        features.extends = [extendsMatch.replace('extends:', '')];
      }
    }

    // Export detection
    if (features.modifiers.includes('export')) {
      features.exportType = features.modifiers.includes('default') 
        ? ExportType.DEFAULT 
        : ExportType.NAMED;
    }
  }

  /**
   * Extract Python-specific features
   */
  private extractPythonFeatures(node: ASTNode, features: LanguageFeatures): void {
    // Python decorators are already in the decorators array
    
    // Extract type hints if available
    if (node.metadata.languageSpecific?.typeHints) {
      features.typeAnnotations = node.metadata.languageSpecific.typeHints;
    }

    // Python inheritance
    if (node.metadata.languageSpecific?.bases) {
      features.extends = node.metadata.languageSpecific.bases;
    }

    // Async detection
    features.isAsync = features.modifiers.includes('async') || node.name?.startsWith('async ');
  }

  /**
   * Extract Java-specific features
   */
  private extractJavaFeatures(node: ASTNode, features: LanguageFeatures): void {
    // Java annotations are in decorators
    
    // Extract generics
    if (node.metadata.languageSpecific?.generics) {
      features.generics = node.metadata.languageSpecific.generics;
    }

    // Interface implementations
    if (node.metadata.languageSpecific?.implements) {
      features.implements = node.metadata.languageSpecific.implements;
    }

    // Class inheritance
    if (node.metadata.languageSpecific?.extends) {
      features.extends = [node.metadata.languageSpecific.extends];
    }
  }

  /**
   * Generate a language-aware signature for the node
   */
  private generateSignature(node: ASTNode, features: LanguageFeatures, context: AnnotationContext): string {
    let signature = '';

    // Add modifiers
    if (this.config.signature.includeModifiers && features.modifiers.length > 0) {
      const relevantModifiers = features.modifiers.filter(m => 
        !m.startsWith('export') && !m.startsWith('extends:')
      );
      if (relevantModifiers.length > 0) {
        signature += relevantModifiers.join(' ') + ' ';
      }
    }

    // Generate signature based on node type
    switch (node.type) {
      case NodeType.FUNCTION:
      case NodeType.METHOD:
      case NodeType.ARROW_FUNCTION:
        signature += this.generateFunctionSignature(node, features, context);
        break;
      case NodeType.CLASS:
        signature += this.generateClassSignature(node, features);
        break;
      case NodeType.INTERFACE:
        signature += this.generateInterfaceSignature(node, features);
        break;
      case NodeType.VARIABLE:
      case NodeType.PROPERTY:
      case NodeType.FIELD:
        signature += this.generateVariableSignature(node, features);
        break;
      case NodeType.ENUM:
        signature += this.generateEnumSignature(node);
        break;
      default:
        signature += node.name || node.type;
    }

    // Truncate if too long
    if (signature.length > this.config.signature.maxLength) {
      signature = signature.substring(0, this.config.signature.maxLength - 3) + '...';
    }

    return signature.trim();
  }

  /**
   * Generate function signature
   */
  private generateFunctionSignature(node: ASTNode, features: LanguageFeatures, context: AnnotationContext): string {
    let sig = '';

    // Function keyword and name
    if (node.type === NodeType.ARROW_FUNCTION) {
      sig = node.name ? `const ${node.name} = ` : '';
    } else {
      sig = `${node.type} ${node.name || 'anonymous'}`;
    }

    // Generics
    if (features.generics && features.generics.length > 0) {
      sig += `<${features.generics.join(', ')}>`;
    }

    // Parameters
    sig += '(';
    if (this.config.signature.includeParameterNames) {
      // Extract parameters from metadata or source
      const params = this.extractParameters(node, context);
      sig += params.join(', ');
    } else {
      sig += '...';
    }
    sig += ')';

    // Return type
    if (this.config.signature.includeReturnType && features.typeAnnotations) {
      const returnType = features.typeAnnotations.find(t => t.includes('->') || t.includes(':'));
      if (returnType) {
        sig += `: ${returnType}`;
      }
    }

    return sig;
  }

  /**
   * Generate class signature
   */
  private generateClassSignature(node: ASTNode, features: LanguageFeatures): string {
    let sig = `class ${node.name || 'Anonymous'}`;

    // Generics
    if (features.generics && features.generics.length > 0) {
      sig += `<${features.generics.join(', ')}>`;
    }

    // Inheritance
    if (features.extends && features.extends.length > 0) {
      sig += ` extends ${features.extends[0]}`;
    }

    // Interfaces
    if (features.implements && features.implements.length > 0) {
      sig += ` implements ${features.implements.join(', ')}`;
    }

    return sig;
  }

  /**
   * Generate interface signature
   */
  private generateInterfaceSignature(node: ASTNode, features: LanguageFeatures): string {
    let sig = `interface ${node.name || 'Anonymous'}`;

    if (features.generics && features.generics.length > 0) {
      sig += `<${features.generics.join(', ')}>`;
    }

    if (features.extends && features.extends.length > 0) {
      sig += ` extends ${features.extends.join(', ')}`;
    }

    return sig;
  }

  /**
   * Generate variable signature
   */
  private generateVariableSignature(node: ASTNode, features: LanguageFeatures): string {
    let sig = `${node.name || 'variable'}`;
    
    if (features.typeAnnotations && features.typeAnnotations.length > 0) {
      sig += `: ${features.typeAnnotations[0]}`;
    }

    return sig;
  }

  /**
   * Generate enum signature
   */
  private generateEnumSignature(node: ASTNode): string {
    return `enum ${node.name || 'Anonymous'}`;
  }

  /**
   * Extract parameters from a function node
   */
  private extractParameters(node: ASTNode, context: AnnotationContext): string[] {
    // This is a simplified implementation
    // In a real implementation, you'd parse the source text or AST structure
    const sourceLines = context.sourceText.split('\n');
    const startLine = node.start.line - 1;
    const endLine = Math.min(node.end.line - 1, sourceLines.length - 1);
    
    let params: string[] = [];
    
    // Look for parameter patterns in the first few lines of the function
    for (let i = startLine; i <= Math.min(startLine + 3, endLine); i++) {
      if (i < sourceLines.length) {
        const line = sourceLines[i];
        if (line) {
          const paramMatch = line.match(/\(([^)]*)\)/);
          if (paramMatch && paramMatch[1]) {
            const paramStr = paramMatch[1].trim();
            if (paramStr) {
              params = paramStr.split(',').map(p => p.trim()).slice(0, 5); // Limit to 5 params
            }
            break;
          }
        }
      }
    }
    
    return params.length > 0 ? params : ['...'];
  }

  /**
   * Calculate cyclomatic complexity for the node
   */
  private calculateComplexity(node: ASTNode, context: AnnotationContext): number {
    // Start with base complexity
    let complexity = 1;

    // Use existing complexity from metadata if available
    if (node.complexity) {
      complexity = node.complexity;
    } else {
      // Calculate based on node type and content
      complexity = this.calculateNodeComplexity(node, context);
    }

    // Apply language-specific rules
    const langRules = this.config.complexity.languageRules[context.language];
    if (langRules) {
      complexity = this.applyLanguageComplexityRules(complexity, node, context, langRules);
    }

    return Math.min(complexity, this.config.complexity.maxComplexity);
  }

  /**
   * Calculate complexity for a specific node
   */
  private calculateNodeComplexity(node: ASTNode, context: AnnotationContext): number {
    let complexity = 1;

    // Add complexity based on node type
    const weights = this.config.complexity.decisionWeights;
    const nodeTypeKey = node.type.toString().toLowerCase();
    
    if (weights[nodeTypeKey]) {
      complexity += weights[nodeTypeKey];
    }

    // Analyze source text for additional complexity indicators
    const sourceLines = context.sourceText.split('\n');
    const startLine = node.start.line - 1;
    const endLine = Math.min(node.end.line, sourceLines.length);

    for (let i = startLine; i < endLine; i++) {
      if (i < sourceLines.length) {
        const line = sourceLines[i];
        complexity += this.countComplexityPatterns(line);
      }
    }

    return complexity;
  }

  /**
   * Count complexity patterns in a line of code
   */
  private countComplexityPatterns(line: string): number {
    let count = 0;
    const patterns = [
      /\bif\b/g, /\belse\b/g, /\bwhile\b/g, /\bfor\b/g,
      /\bswitch\b/g, /\bcase\b/g, /\btry\b/g, /\bcatch\b/g,
      /\?\s*.*\s*:/g, // ternary
      /&&/g, /\|\|/g // logical operators
    ];

    patterns.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        count += matches.length;
      }
    });

    return count;
  }

  /**
   * Apply language-specific complexity rules
   */
  private applyLanguageComplexityRules(complexity: number, node: ASTNode, context: AnnotationContext, rules: any): number {
    // This would contain language-specific complexity adjustments
    // For now, return the base complexity
    return complexity;
  }

  /**
   * Analyze dependencies for the node
   */
  private analyzeDependencies(node: ASTNode, context: AnnotationContext): string[] {
    const dependencies = new Set<string>();

    if (this.config.dependency.trackImports) {
      // Add imports from metadata
      if (node.metadata.imports) {
        node.metadata.imports.forEach(imp => dependencies.add(imp));
      }
    }

    if (this.config.dependency.trackCalls) {
      // Extract function calls from source text
      const calls = this.extractFunctionCalls(node, context);
      calls.forEach(call => dependencies.add(call));
    }

    if (this.config.dependency.trackNamespacedCalls) {
      // Extract namespaced calls (Math.floor, fs.readFile, etc.)
      const namespacedCalls = this.extractNamespacedCalls(node, context);
      namespacedCalls.forEach(call => dependencies.add(call));
    }

    return Array.from(dependencies).slice(0, 20); // Limit to 20 dependencies
  }

  /**
   * Extract function calls from node source
   */
  private extractFunctionCalls(node: ASTNode, context: AnnotationContext): string[] {
    const calls: string[] = [];
    const sourceLines = context.sourceText.split('\n');
    const startLine = node.start.line - 1;
    const endLine = Math.min(node.end.line, sourceLines.length);

    for (let i = startLine; i < endLine; i++) {
      if (i < sourceLines.length) {
        const line = sourceLines[i];
        // Simple regex to find function calls
        const callMatches = line.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
        if (callMatches) {
          callMatches.forEach(match => {
            const funcName = match.replace(/\s*\($/, '');
            if (funcName !== node.name) { // Don't include self-references
              calls.push(funcName);
            }
          });
        }
      }
    }

    return Array.from(new Set(calls));
  }

  /**
   * Extract namespaced calls
   */
  private extractNamespacedCalls(node: ASTNode, context: AnnotationContext): string[] {
    const calls: string[] = [];
    const sourceLines = context.sourceText.split('\n');
    const startLine = node.start.line - 1;
    const endLine = Math.min(node.end.line, sourceLines.length);

    for (let i = startLine; i < endLine; i++) {
      if (i < sourceLines.length) {
        const line = sourceLines[i];
        // Regex to find namespaced calls
        const namespacedMatches = line.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
        if (namespacedMatches) {
          namespacedMatches.forEach(match => {
            const call = match.replace(/\s*\($/, '');
            calls.push(call);
          });
        }
      }
    }

    return Array.from(new Set(calls));
  }

  /**
   * Generate a descriptive summary for the node
   */
  private generateSummary(node: ASTNode, features: LanguageFeatures, context: AnnotationContext): string {
    const template = this.config.summary.templates[node.type] || 'Code element {name}';
    
    // Extract template variables
    const variables = this.extractSummaryVariables(node, features, context);
    
    // Replace template placeholders
    let summary = template.replace(/{(\w+)}/g, (_, key) => {
      return variables[key] || 'unknown';
    });

    // Apply purpose inference
    if (this.config.summary.usePurposeInference) {
      const purpose = this.inferPurpose(node, context);
      summary = summary.replace('{purpose}', purpose);
    }

    // Truncate if too long
    if (summary.length > this.config.summary.maxLength) {
      summary = summary.substring(0, this.config.summary.maxLength - 3) + '...';
    }

    return summary;
  }

  /**
   * Extract variables for summary templates
   */
  private extractSummaryVariables(node: ASTNode, features: LanguageFeatures, context: AnnotationContext): Record<string, string> {
    const variables: Record<string, string> = {
      name: node.name || 'anonymous',
      type: node.type,
      language: context.language
    };

    // Add parameters for functions
    if ([NodeType.FUNCTION, NodeType.METHOD, NodeType.ARROW_FUNCTION].includes(node.type)) {
      const params = this.extractParameters(node, context);
      variables.params = params.join(', ');
    }

    // Add class-specific variables
    if (node.type === NodeType.CLASS) {
      variables.className = node.name || 'Anonymous';
      variables.interfaces = features.implements?.join(', ') || 'none';
    }

    // Add interface members
    if (node.type === NodeType.INTERFACE) {
      variables.members = 'members'; // Simplified
    }

    // Add enum values
    if (node.type === NodeType.ENUM) {
      variables.values = 'values'; // Simplified
    }

    // Add type information
    if (features.typeAnnotations && features.typeAnnotations.length > 0) {
      variables.type = features.typeAnnotations[0];
    }

    return variables;
  }

  /**
   * Infer the purpose of a node from its name and context
   */
  private inferPurpose(node: ASTNode, context: AnnotationContext): string {
    if (!node.name) return 'performs some operation';

    const name = node.name.toLowerCase();

    // Common purpose patterns
    if (name.startsWith('get') || name.startsWith('fetch')) return 'retrieves data';
    if (name.startsWith('set') || name.startsWith('update')) return 'modifies data';
    if (name.startsWith('create') || name.startsWith('make')) return 'creates something';
    if (name.startsWith('delete') || name.startsWith('remove')) return 'removes something';
    if (name.startsWith('validate') || name.startsWith('check')) return 'validates data';
    if (name.startsWith('handle') || name.startsWith('process')) return 'processes input';
    if (name.startsWith('calculate') || name.startsWith('compute')) return 'computes values';
    if (name.startsWith('render') || name.startsWith('draw')) return 'renders output';
    if (name.includes('test') || name.includes('spec')) return 'tests functionality';

    // Default based on node type
    switch (node.type) {
      case NodeType.CONSTRUCTOR: return 'initializes instance';
      case NodeType.GETTER: return 'gets property value';
      case NodeType.SETTER: return 'sets property value';
      case NodeType.METHOD: return 'performs class operation';
      default: return 'performs operation';
    }
  }

  /**
   * Extract source snippet with context
   */
  private extractSourceSnippet(node: ASTNode, context: AnnotationContext): string {
    const sourceLines = context.sourceText.split('\n');
    const startLine = Math.max(0, node.start.line - 1 - this.config.snippet.contextBefore);
    const endLine = Math.min(sourceLines.length - 1, node.end.line - 1 + this.config.snippet.contextAfter);

    let snippetLines = sourceLines.slice(startLine, endLine + 1);

    // Limit total lines
    if (snippetLines.length > this.config.snippet.maxLines) {
      const excess = snippetLines.length - this.config.snippet.maxLines;
      snippetLines = snippetLines.slice(0, this.config.snippet.maxLines);
      snippetLines.push(this.config.snippet.truncationIndicator);
    }

    return snippetLines.join('\n');
  }

  /**
   * Calculate quality metrics for the annotation
   */
  private calculateQuality(node: ASTNode, signature: string, summary: string, context: AnnotationContext): QualityMetrics {
    const issues: string[] = [];

    // Check signature quality
    let signatureConfidence = 1.0;
    if (signature.includes('anonymous') || signature.includes('unknown')) {
      signatureConfidence -= 0.3;
      issues.push('Incomplete signature information');
    }

    // Check summary quality
    let summaryConfidence = 1.0;
    if (summary.includes('unknown') || summary.length < 10) {
      summaryConfidence -= 0.2;
      issues.push('Low-quality summary');
    }

    // Check completeness
    const isComplete = node.name !== undefined && 
                      node.start.line < node.end.line && 
                      signature.length > 5;

    return {
      signatureConfidence: Math.max(0, signatureConfidence),
      summaryConfidence: Math.max(0, summaryConfidence),
      isComplete,
      issues
    };
  }

  /**
   * Create annotation metadata
   */
  private createMetadata(node: ASTNode, context: AnnotationContext, quality: QualityMetrics): AnnotationMetadata {
    const sourceLines = context.sourceText.split('\n');
    const nodeLines = sourceLines.slice(node.start.line - 1, node.end.line);
    const nodeText = nodeLines.join('\n');

    return {
      createdAt: new Date().toISOString(),
      toolVersion: '0.1.0', // Would be read from package.json
      quality,
      characterCount: nodeText.length,
      lineCount: nodeLines.length,
      contentHash: createHash('sha256').update(nodeText).digest('hex').substring(0, 12)
    };
  }

  /**
   * Create a fallback annotation when generation fails
   */
  private createFallbackAnnotation(node: ASTNode, context: AnnotationContext, error: any): Annotation {
    return {
      nodeId: node.id,
      filePath: context.filePath,
      signature: node.name || 'unknown',
      summary: `${node.type} (annotation failed)`,
      complexity: 1,
      dependencies: [],
      sourceSnippet: '// Source extraction failed',
      metadata: {
        createdAt: new Date().toISOString(),
        toolVersion: '0.1.0',
        quality: {
          signatureConfidence: 0,
          summaryConfidence: 0,
          isComplete: false,
          issues: [`Annotation generation failed: ${error instanceof Error ? error.message : String(error)}`]
        },
        characterCount: 0,
        lineCount: 0,
        contentHash: 'error'
      },
      languageFeatures: {
        language: context.language,
        decorators: [],
        modifiers: []
      }
    };
  }
}