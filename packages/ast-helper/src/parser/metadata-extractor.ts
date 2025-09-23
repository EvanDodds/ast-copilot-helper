/**
 * Metadata Extraction System
 * 
 * Extracts comprehensive metadata from AST nodes including scope chains,
 * modifiers, imports/exports, documentation, and language-specific annotations.
 */

import type { NodeMetadata, Position } from './ast-schema';

/**
 * Raw tree-sitter node interface (minimal definition for metadata extraction)
 */
export interface RawASTNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: RawASTNode[];
  parent?: RawASTNode;
  namedChildren: RawASTNode[];
  fieldName?: string;
}

/**
 * Context for metadata extraction
 */
export interface ExtractionContext {
  /** Source file path */
  filePath: string;
  /** Programming language */
  language: string;
  /** Complete source text */
  sourceText: string;
  /** Current scope stack */
  scopeStack: string[];
  /** Import statements found in file */
  fileImports: Map<string, ImportInfo>;
  /** Export statements found in file */
  fileExports: Set<ExportInfo>;
  /** Current class or namespace context */
  classContext?: ClassContext;
  /** Function or method context */
  functionContext?: FunctionContext;
}

/**
 * Import statement information
 */
export interface ImportInfo {
  /** Source module/file */
  source: string;
  /** Import type (default, named, namespace, etc.) */
  type: 'default' | 'named' | 'namespace' | 'side-effect';
  /** Imported symbol name */
  imported?: string;
  /** Local alias name */
  local?: string;
  /** Position in source */
  position: Position;
}

/**
 * Export statement information
 */
export interface ExportInfo {
  /** Export type */
  type: 'default' | 'named' | 're-export';
  /** Exported symbol name */
  name?: string;
  /** Source module (for re-exports) */
  source?: string;
  /** Position in source */
  position: Position;
}

/**
 * Class or interface context
 */
export interface ClassContext {
  /** Class/interface name */
  name: string;
  /** Access modifiers */
  modifiers: string[];
  /** Extended classes */
  extends?: string[];
  /** Implemented interfaces */
  implements?: string[];
  /** Generic parameters */
  generics?: string[];
}

/**
 * Function or method context
 */
export interface FunctionContext {
  /** Function/method name */
  name?: string;
  /** Parameters */
  parameters: ParameterInfo[];
  /** Return type annotation */
  returnType?: string;
  /** Access modifiers */
  modifiers: string[];
  /** Generic parameters */
  generics?: string[];
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** Type annotation */
  type?: string;
  /** Default value */
  defaultValue?: string;
  /** Is rest parameter */
  isRest: boolean;
  /** Is optional */
  isOptional: boolean;
}

/**
 * Documentation extraction result
 */
export interface DocumentationInfo {
  /** Main description */
  description: string;
  /** Parameter descriptions */
  parameters: Record<string, string>;
  /** Return value description */
  returns?: string;
  /** Examples */
  examples: string[];
  /** Tags (deprecated, since, etc.) */
  tags: Record<string, string>;
  /** Raw text */
  raw: string;
}

/**
 * Language-specific annotation
 */
export interface LanguageAnnotation {
  /** Annotation name */
  name: string;
  /** Annotation arguments */
  arguments: string[];
  /** Raw text */
  raw: string;
  /** Position */
  position: Position;
}

/**
 * Metadata extraction configuration
 */
export interface MetadataConfig {
  /** Extract scope information */
  extractScope: boolean;
  /** Extract modifiers */
  extractModifiers: boolean;
  /** Extract import statements */
  extractImports: boolean;
  /** Extract export statements */
  extractExports: boolean;
  /** Extract documentation */
  extractDocumentation: boolean;
  /** Extract language-specific annotations */
  extractAnnotations: boolean;
  /** Maximum documentation length */
  maxDocumentationLength: number;
  /** Languages to handle */
  supportedLanguages: string[];
}

/**
 * Metadata Extractor
 * 
 * Extracts comprehensive metadata from AST nodes including scope chains,
 * modifiers, imports/exports, documentation, and language-specific annotations.
 */
export class MetadataExtractor {
  private static readonly DEFAULT_CONFIG: MetadataConfig = {
    extractScope: true,
    extractModifiers: true,
    extractImports: true,
    extractExports: true,
    extractDocumentation: true,
    extractAnnotations: true,
    maxDocumentationLength: 2000,
    supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'c', 'cpp'],
  };

  private config: MetadataConfig;

  constructor(config: Partial<MetadataConfig> = {}) {
    this.config = { ...MetadataExtractor.DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract metadata from a raw AST node
   * 
   * @param rawNode - Raw tree-sitter node
   * @param context - Extraction context
   * @returns Complete node metadata
   */
  extractMetadata(rawNode: RawASTNode, context: ExtractionContext): NodeMetadata {
    const metadata: NodeMetadata = {
      language: context.language,
      scope: [],
      modifiers: [],
      imports: [],
      exports: [],
      annotations: [],
    };

    if (this.config.extractScope) {
      metadata.scope = this.extractScope(rawNode, context);
    }

    if (this.config.extractModifiers) {
      metadata.modifiers = this.extractModifiers(rawNode, context);
    }

    if (this.config.extractImports) {
      metadata.imports = this.extractImports(rawNode, context);
    }

    if (this.config.extractExports) {
      metadata.exports = this.extractExports(rawNode, context);
    }

    if (this.config.extractDocumentation) {
      metadata.docstring = this.extractDocumentation(rawNode, context);
    }

    if (this.config.extractAnnotations) {
      metadata.annotations = this.extractAnnotations(rawNode, context);
    }

    // Language-specific processing
    this.extractLanguageSpecific(rawNode, context, metadata);

    return metadata;
  }

  /**
   * Extract scope chain information
   */
  private extractScope(rawNode: RawASTNode, context: ExtractionContext): string[] {
    const scope = [...context.scopeStack];
    
    // Add current node to scope if it creates a new scope
    const scopeCreatingTypes = this.getScopeCreatingTypes(context.language);
    
    if (scopeCreatingTypes.includes(rawNode.type)) {
      const scopeName = this.extractNodeName(rawNode) || rawNode.type;
      scope.push(scopeName);
    }

    return scope;
  }

  /**
   * Extract modifiers (public, private, static, etc.)
   */
  private extractModifiers(rawNode: RawASTNode, context: ExtractionContext): string[] {
    const modifiers: string[] = [];

    // Language-specific modifier extraction
    switch (context.language) {
      case 'typescript':
      case 'javascript':
        modifiers.push(...this.extractTSJSModifiers(rawNode));
        break;
      case 'python':
        modifiers.push(...this.extractPythonModifiers(rawNode));
        break;
      case 'java':
        modifiers.push(...this.extractJavaModifiers(rawNode));
        break;
      case 'c':
      case 'cpp':
        modifiers.push(...this.extractCModifiers(rawNode));
        break;
    }

    return modifiers;
  }

  /**
   * Extract import references for this node
   */
  private extractImports(rawNode: RawASTNode, context: ExtractionContext): string[] {
    const imports: string[] = [];
    
    // Find identifier references in the node
    const identifiers = this.findIdentifiers(rawNode);
    
    for (const identifier of identifiers) {
      const importInfo = context.fileImports.get(identifier);
      if (importInfo) {
        imports.push(importInfo.imported || importInfo.local || identifier);
      }
    }

    return Array.from(new Set(imports)); // Remove duplicates
  }

  /**
   * Extract export information for this node
   */
  private extractExports(rawNode: RawASTNode, context: ExtractionContext): string[] {
    const exports: string[] = [];

    // Check if this node is exported
    const nodeName = this.extractNodeName(rawNode);
    if (!nodeName) {
return exports;
}

    // Check file exports for this name
    const exportsArray = Array.from(context.fileExports);
    for (const exportInfo of exportsArray) {
      if (exportInfo.name === nodeName || exportInfo.type === 'default') {
        exports.push(exportInfo.type === 'default' ? 'default' : exportInfo.name || nodeName);
      }
    }

    // Direct export detection (export function, export class, etc.)
    if (this.isDirectExport(rawNode)) {
      const exportType = this.getDirectExportType(rawNode);
      exports.push(exportType);
    }

    return Array.from(new Set(exports));
  }

  /**
   * Extract documentation from comments
   */
  private extractDocumentation(rawNode: RawASTNode, context: ExtractionContext): string | undefined {
    const docComment = this.findDocumentationComment(rawNode, context);
    
    if (!docComment) {
return undefined;
}

    let docText = this.cleanDocumentationText(docComment, context.language);
    
    // Truncate if too long
    if (docText.length > this.config.maxDocumentationLength) {
      docText = docText.substring(0, this.config.maxDocumentationLength) + '...';
    }

    return docText || undefined;
  }

  /**
   * Extract language-specific annotations
   */
  private extractAnnotations(rawNode: RawASTNode, context: ExtractionContext): string[] {
    const annotations: string[] = [];

    switch (context.language) {
      case 'typescript':
      case 'javascript':
        annotations.push(...this.extractTSJSAnnotations(rawNode));
        break;
      case 'python':
        annotations.push(...this.extractPythonAnnotations(rawNode));
        break;
      case 'java':
        annotations.push(...this.extractJavaAnnotations(rawNode));
        break;
    }

    return annotations;
  }

  /**
   * Extract language-specific metadata
   */
  private extractLanguageSpecific(
    rawNode: RawASTNode,
    context: ExtractionContext,
    metadata: NodeMetadata
  ): void {
    metadata.languageSpecific = metadata.languageSpecific || {};

    switch (context.language) {
      case 'typescript':
        this.extractTypeScriptSpecific(rawNode, context, metadata);
        break;
      case 'python':
        this.extractPythonSpecific(rawNode, context, metadata);
        break;
      case 'java':
        this.extractJavaSpecific(rawNode, context, metadata);
        break;
    }
  }

  /**
   * Get node types that create new scopes for a language
   */
  private getScopeCreatingTypes(language: string): string[] {
    const commonTypes = ['function', 'method', 'class', 'interface', 'namespace'];
    
    switch (language) {
      case 'typescript':
      case 'javascript':
        return [...commonTypes, 'arrow_function', 'function_declaration', 'method_definition', 'class_declaration', 'if_statement', 'for_statement', 'while_statement'];
      case 'python':
        return [...commonTypes, 'function_definition', 'class_definition', 'lambda', 'if_statement', 'for_statement', 'while_statement'];
      case 'java':
        return [...commonTypes, 'method_declaration', 'class_declaration', 'interface_declaration', 'if_statement', 'for_statement', 'while_statement'];
      default:
        return commonTypes;
    }
  }

  /**
   * Extract node name from various node types
   */
  private extractNodeName(rawNode: RawASTNode): string | undefined {
    // Try to find name in common patterns
    const nameFields = ['name', 'identifier', 'id'];
    
    for (const field of nameFields) {
      const nameChild = rawNode.children.find(child => child.fieldName === field);
      if (nameChild) {
        return nameChild.text;
      }
    }

    // Try common child patterns
    const firstNamedChild = rawNode.namedChildren[0];
    if (firstNamedChild && firstNamedChild.type === 'identifier') {
      return firstNamedChild.text;
    }

    return undefined;
  }

  /**
   * Extract TypeScript/JavaScript modifiers
   */
  private extractTSJSModifiers(rawNode: RawASTNode): string[] {
    const modifiers: string[] = [];
    const modifierTypes = ['public', 'private', 'protected', 'static', 'abstract', 'async', 'readonly', 'export'];
    
    for (const child of rawNode.children) {
      if (modifierTypes.includes(child.type) || modifierTypes.includes(child.text)) {
        modifiers.push(child.type === 'keyword' ? child.text : child.type);
      }
    }

    return modifiers;
  }

  /**
   * Extract Python modifiers
   */
  private extractPythonModifiers(rawNode: RawASTNode): string[] {
    const modifiers: string[] = [];
    
    // Python modifiers are mostly naming conventions
    const nodeName = this.extractNodeName(rawNode);
    if (nodeName) {
      if (nodeName.startsWith('__') && nodeName.endsWith('__')) {
        modifiers.push('magic');
      } else if (nodeName.startsWith('_')) {
        modifiers.push('private');
      }
    }

    // Decorators
    const decorators = this.findPythonDecorators(rawNode);
    modifiers.push(...decorators);

    return modifiers;
  }

  /**
   * Extract Java modifiers
   */
  private extractJavaModifiers(rawNode: RawASTNode): string[] {
    const modifiers: string[] = [];
    const javaModifiers = ['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile'];
    
    for (const child of rawNode.children) {
      if (javaModifiers.includes(child.text)) {
        modifiers.push(child.text);
      }
    }

    return modifiers;
  }

  /**
   * Extract C/C++ modifiers
   */
  private extractCModifiers(rawNode: RawASTNode): string[] {
    const modifiers: string[] = [];
    const cModifiers = ['static', 'extern', 'inline', 'const', 'volatile', 'restrict'];
    
    for (const child of rawNode.children) {
      if (cModifiers.includes(child.text)) {
        modifiers.push(child.text);
      }
    }

    return modifiers;
  }

  /**
   * Find all identifier references in a node
   */
  private findIdentifiers(rawNode: RawASTNode): string[] {
    const identifiers: string[] = [];
    
    const traverse = (node: RawASTNode) => {
      if (node.type === 'identifier') {
        identifiers.push(node.text);
      }
      
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(rawNode);
    return Array.from(new Set(identifiers));
  }

  /**
   * Check if node is directly exported
   */
  private isDirectExport(rawNode: RawASTNode): boolean {
    // Check parent or siblings for export keywords
    let current = rawNode.parent;
    while (current) {
      if (current.type.includes('export') || current.text.includes('export')) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Get direct export type
   */
  private getDirectExportType(rawNode: RawASTNode): string {
    let current = rawNode.parent;
    while (current) {
      if (current.text.includes('export default')) {
        return 'default';
      } else if (current.text.includes('export')) {
        return 'named';
      }
      current = current.parent;
    }
    
    return 'named';
  }

  /**
   * Find documentation comment for a node
   */
  private findDocumentationComment(rawNode: RawASTNode, context: ExtractionContext): string | null {
    // Look for comment nodes before this node
    const nodeStart = rawNode.startPosition;
    const lines = context.sourceText.split('\n');
    
    const commentLines: string[] = [];
    let currentLine = nodeStart.row - 1;
    
    // Look backwards for comments
    while (currentLine >= 0) {
      if (currentLine >= 0 && currentLine < lines.length) {
        const line = lines[currentLine];
        if (!line) {
          currentLine--;
          continue;
        }
        const trimmedLine = line.trim();
        
        if (this.isCommentLine(trimmedLine, context.language)) {
          commentLines.unshift(this.stripCommentMarkers(trimmedLine, context.language));
          currentLine--;
        } else if (trimmedLine === '') {
          currentLine--;
        } else if (trimmedLine === '') {
          currentLine--;
        } else {
          break; // Non-comment, non-empty line
        }
      } else {
        break;
      }
    }

    return commentLines.length > 0 ? commentLines.join('\n') : null;
  }

  /**
   * Check if line is a comment
   */
  private isCommentLine(line: string, language: string): boolean {
    switch (language) {
      case 'typescript':
      case 'javascript':
      case 'java':
      case 'c':
      case 'cpp':
        return line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');
      case 'python':
        return line.startsWith('#') || line.startsWith('"""') || line.startsWith("'''");
      default:
        return false;
    }
  }

  /**
   * Strip comment markers from line
   */
  private stripCommentMarkers(line: string, language: string): string {
    switch (language) {
      case 'typescript':
      case 'javascript':
      case 'java':
      case 'c':
      case 'cpp':
        return line.replace(/^\/\/\s?|^\*\s?|^\/\*\*?\s?|\*\/$/g, '').trim();
      case 'python':
        return line.replace(/^#\s?|^"""\s?|^'''\s?/g, '').trim();
      default:
        return line;
    }
  }

  /**
   * Clean documentation text
   */
  private cleanDocumentationText(docText: string, language: string): string {
    // Remove extra whitespace and normalize
    let cleaned = docText.replace(/\s+/g, ' ').trim();
    
    // Language-specific cleaning
    switch (language) {
      case 'typescript':
      case 'javascript':
        // Remove JSDoc tags for simple description
        cleaned = cleaned.replace(/@\w+.*$/gm, '').trim();
        break;
      case 'python':
        // Clean Python docstrings
        cleaned = cleaned.replace(/^"""?|"""?$/g, '').trim();
        break;
    }

    return cleaned;
  }

  /**
   * Extract TypeScript/JavaScript annotations
   */
  private extractTSJSAnnotations(rawNode: RawASTNode): string[] {
    const annotations: string[] = [];
    
    // Look for decorators (@decorator)
    const decorators = this.findDecorators(rawNode);
    annotations.push(...decorators);

    return annotations;
  }

  /**
   * Extract Python annotations
   */
  private extractPythonAnnotations(rawNode: RawASTNode): string[] {
    const annotations: string[] = [];
    
    // Look for decorators (@decorator)
    const decorators = this.findPythonDecorators(rawNode);
    annotations.push(...decorators);

    return annotations;
  }

  /**
   * Extract Java annotations
   */
  private extractJavaAnnotations(rawNode: RawASTNode): string[] {
    const annotations: string[] = [];
    
    // Look for annotations (@Annotation)
    for (const child of rawNode.children) {
      if (child.type === 'annotation' || child.text.startsWith('@')) {
        annotations.push(child.text);
      }
    }

    return annotations;
  }

  /**
   * Find decorators in TypeScript/JavaScript
   */
  private findDecorators(rawNode: RawASTNode): string[] {
    const decorators: string[] = [];
    
    for (const child of rawNode.children) {
      if (child.type === 'decorator' || (child.type === 'identifier' && child.text.startsWith('@'))) {
        decorators.push(child.text);
      }
    }

    return decorators;
  }

  /**
   * Find decorators in Python
   */
  private findPythonDecorators(rawNode: RawASTNode): string[] {
    const decorators: string[] = [];
    
    // Look at parent or siblings for decorators
    let current = rawNode.parent;
    while (current) {
      for (const child of current.children) {
        if (child.type === 'decorator' || child.text.startsWith('@')) {
          decorators.push(child.text);
        }
      }
      current = current.parent;
    }

    return decorators;
  }

  /**
   * Extract TypeScript-specific metadata
   */
  private extractTypeScriptSpecific(
    rawNode: RawASTNode,
    _context: ExtractionContext,
    metadata: NodeMetadata
  ): void {
    const specific = metadata.languageSpecific!;
    
    // Type annotations
    const typeAnnotation = this.findTypeAnnotation(rawNode);
    if (typeAnnotation) {
      specific.typeAnnotation = typeAnnotation;
    }

    // Generic parameters
    const generics = this.findGenerics(rawNode);
    if (generics.length > 0) {
      specific.generics = generics;
    }

    // Interface implementations
    if (rawNode.type === 'class_declaration') {
      const implementsList = this.findImplements(rawNode);
      if (implementsList.length > 0) {
        specific.implements = implementsList;
      }
    }
  }

  /**
   * Extract Python-specific metadata
   */
  private extractPythonSpecific(
    rawNode: RawASTNode,
    _context: ExtractionContext,
    metadata: NodeMetadata
  ): void {
    const specific = metadata.languageSpecific!;
    
    // Type hints
    const typeHint = this.findPythonTypeHint(rawNode);
    if (typeHint) {
      specific.typeHint = typeHint;
    }

    // Class inheritance
    if (rawNode.type === 'class_definition') {
      const baseClasses = this.findPythonBaseClasses(rawNode);
      if (baseClasses.length > 0) {
        specific.baseClasses = baseClasses;
      }
    }
  }

  /**
   * Extract Java-specific metadata
   */
  private extractJavaSpecific(
    rawNode: RawASTNode,
    _context: ExtractionContext,
    metadata: NodeMetadata
  ): void {
    const specific = metadata.languageSpecific!;
    
    // Generic parameters
    const generics = this.findJavaGenerics(rawNode);
    if (generics.length > 0) {
      specific.generics = generics;
    }

    // Interface implementations
    if (rawNode.type === 'class_declaration') {
      const implementsList = this.findJavaImplements(rawNode);
      if (implementsList.length > 0) {
        specific.implements = implementsList;
      }
    }
  }

  /**
   * Find type annotation
   */
  private findTypeAnnotation(rawNode: RawASTNode): string | undefined {
    for (const child of rawNode.children) {
      if (child.type === 'type_annotation' || child.fieldName === 'type') {
        return child.text;
      }
    }
    return undefined;
  }

  /**
   * Find generic parameters
   */
  private findGenerics(rawNode: RawASTNode): string[] {
    const generics: string[] = [];
    
    for (const child of rawNode.children) {
      if (child.type === 'type_parameters') {
        for (const param of child.children) {
          if (param.type === 'type_parameter') {
            generics.push(param.text);
          }
        }
      }
    }

    return generics;
  }

  /**
   * Find interface implementations
   */
  private findImplements(rawNode: RawASTNode): string[] {
    const implementsList: string[] = [];
    
    for (const child of rawNode.children) {
      if (child.type === 'class_heritage' || child.fieldName === 'implements') {
        for (const impl of child.children) {
          if (impl.type === 'identifier') {
            implementsList.push(impl.text);
          }
        }
      }
    }

    return implementsList;
  }

  /**
   * Find Python type hint
   */
  private findPythonTypeHint(rawNode: RawASTNode): string | undefined {
    // Look for type annotations in function definitions
    for (const child of rawNode.children) {
      if (child.fieldName === 'return_type') {
        return child.text;
      }
    }
    return undefined;
  }

  /**
   * Find Python base classes
   */
  private findPythonBaseClasses(rawNode: RawASTNode): string[] {
    const baseClasses: string[] = [];
    
    for (const child of rawNode.children) {
      if (child.fieldName === 'superclasses') {
        for (const base of child.children) {
          if (base.type === 'identifier') {
            baseClasses.push(base.text);
          }
        }
      }
    }

    return baseClasses;
  }

  /**
   * Find Java generic parameters
   */
  private findJavaGenerics(rawNode: RawASTNode): string[] {
    const generics: string[] = [];
    
    for (const child of rawNode.children) {
      if (child.type === 'type_parameters') {
        for (const param of child.children) {
          if (param.type === 'type_parameter') {
            generics.push(param.text);
          }
        }
      }
    }

    return generics;
  }

  /**
   * Find Java interface implementations
   */
  private findJavaImplements(rawNode: RawASTNode): string[] {
    const implementsList: string[] = [];
    
    for (const child of rawNode.children) {
      if (child.fieldName === 'interfaces') {
        for (const impl of child.children) {
          if (impl.type === 'type_identifier') {
            implementsList.push(impl.text);
          }
        }
      }
    }

    return implementsList;
  }
}

/**
 * Utility functions for metadata extraction
 */
export class MetadataUtils {
  /**
   * Create extraction context from file information
   */
  static createContext(
    filePath: string,
    language: string,
    sourceText: string,
    scopeStack: string[] = []
  ): ExtractionContext {
    return {
      filePath,
      language,
      sourceText,
      scopeStack,
      fileImports: new Map(),
      fileExports: new Set(),
    };
  }

  /**
   * Parse import statements from source text
   */
  static parseImports(sourceText: string, language: string): Map<string, ImportInfo> {
    const imports = new Map<string, ImportInfo>();
    const lines = sourceText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) {
continue;
}
      
      const importInfos = MetadataUtils.parseImportLine(line, language, i + 1);
      
      for (const importInfo of importInfos) {
        imports.set(importInfo.local || importInfo.imported || 'default', importInfo);
      }
    }

    return imports;
  }

  /**
   * Parse export statements from source text
   */
  static parseExports(sourceText: string, language: string): Set<ExportInfo> {
    const exports = new Set<ExportInfo>();
    const lines = sourceText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) {
continue;
}
      
      const exportInfo = MetadataUtils.parseExportLine(line, language, i + 1);
      
      if (exportInfo) {
        exports.add(exportInfo);
      }
    }

    return exports;
  }

  /**
   * Parse single import line
   */
  private static parseImportLine(line: string, language: string, lineNumber: number): ImportInfo[] {
    const position: Position = { line: lineNumber, column: 0 };

    switch (language) {
      case 'typescript':
      case 'javascript':
        return MetadataUtils.parseTSJSImport(line, position);
      case 'python':
        const pythonImport = MetadataUtils.parsePythonImport(line, position);
        return pythonImport ? [pythonImport] : [];
      default:
        return [];
    }
  }

  /**
   * Parse single export line
   */
  private static parseExportLine(line: string, language: string, lineNumber: number): ExportInfo | null {
    const position: Position = { line: lineNumber, column: 0 };

    switch (language) {
      case 'typescript':
      case 'javascript':
        return MetadataUtils.parseTSJSExport(line, position);
      case 'python':
        return MetadataUtils.parsePythonExport(line, position);
      default:
        return null;
    }
  }

  /**
   * Parse TypeScript/JavaScript import
   */
  private static parseTSJSImport(line: string, position: Position): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // import { name1, name2, name3 } from 'module'
    const namedMatch = line.match(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/);
    if (namedMatch && namedMatch[1] && namedMatch[2]) {
      const [, importedItems, source] = namedMatch;
      const items = importedItems.split(',').map(item => item.trim()).filter(item => item);
      
      for (const item of items) {
        imports.push({
          type: 'named',
          imported: item,
          local: item,
          source: source.trim(),
          position,
        });
      }
      
      return imports;
    }

    // import name from 'module'
    const defaultMatch = line.match(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
    if (defaultMatch && defaultMatch[1] && defaultMatch[2]) {
      const [, local, source] = defaultMatch;
      imports.push({
        type: 'default',
        imported: 'default',
        local: local.trim(),
        source: source.trim(),
        position,
      });
      
      return imports;
    }

    return imports;
  }

  /**
   * Parse TypeScript/JavaScript export
   */
  private static parseTSJSExport(line: string, position: Position): ExportInfo | null {
    // export default
    if (line.includes('export default')) {
      return {
        type: 'default',
        position,
      };
    }

    // export { name }
    const namedMatch = line.match(/export\s*\{\s*([^}]+)\s*\}/);
    if (namedMatch && namedMatch[1]) {
      const [, name] = namedMatch;
      return {
        type: 'named',
        name: name.trim(),
        position,
      };
    }

    return null;
  }

  /**
   * Parse Python import
   */
  private static parsePythonImport(line: string, position: Position): ImportInfo | null {
    // from module import name
    const fromMatch = line.match(/from\s+([^\s]+)\s+import\s+(.+)/);
    if (fromMatch && fromMatch[1] && fromMatch[2]) {
      const [, source, imported] = fromMatch;
      return {
        type: 'named',
        imported: imported.trim(),
        local: imported.trim(),
        source: source.trim(),
        position,
      };
    }

    // import module
    const importMatch = line.match(/import\s+(\w+)/);
    if (importMatch && importMatch[1]) {
      const [, imported] = importMatch;
      return {
        type: 'namespace',
        imported: imported.trim(),
        local: imported.trim(),
        source: imported.trim(),
        position,
      };
    }

    return null;
  }

  /**
   * Parse Python export (limited - Python doesn't have explicit exports)
   */
  private static parsePythonExport(line: string, position: Position): ExportInfo | null {
    // __all__ = [...]
    if (line.includes('__all__')) {
      return {
        type: 'named',
        name: '__all__',
        position,
      };
    }

    return null;
  }
}

/**
 * Default singleton instance for common usage
 */
export const defaultMetadataExtractor = new MetadataExtractor();