/**
 * Cross-Reference Analyzer for Advanced Annotation Features
 * Detects and analyzes cross-references between code elements
 * Part of Issue #150 - Advanced Annotation Features
 */

import type { ASTNode } from "../../parser/types.js";
import type { CrossReference, AdvancedAnnotationConfig } from "./types.js";
import { CrossReferenceType } from "./types.js";
import { createLogger } from "../../logging/index.js";

/**
 * Analyzes cross-references between code elements
 */
export class CrossReferenceAnalyzer {
  private logger = createLogger({ operation: "cross-reference-analyzer" });
  private config: AdvancedAnnotationConfig["crossReference"];
  private referenceCache = new Map<string, CrossReference[]>();
  private symbolTable = new Map<string, ASTNode>();

  constructor(config: AdvancedAnnotationConfig["crossReference"]) {
    this.config = config;
  }

  /**
   * Analyze cross-references for a given AST node
   */
  public async analyzeCrossReferences(
    node: ASTNode,
    sourceText: string,
    filePath: string,
    allNodes?: Map<string, ASTNode>,
  ): Promise<CrossReference[]> {
    if (!this.config.enabled) {
      return [];
    }

    const startTime = performance.now();
    const cacheKey = `${node.id}-${filePath}`;

    try {
      // Check cache first
      if (this.referenceCache.has(cacheKey)) {
        const cached = this.referenceCache.get(cacheKey);
        return cached || [];
      }

      // Build symbol table for analysis
      if (allNodes) {
        this.buildSymbolTable(allNodes);
      }

      const references: CrossReference[] = [];

      // Analyze different types of references
      const analysisPromises = [
        this.analyzeFunctionCalls(node, sourceText, filePath),
        this.analyzeVariableReferences(node, sourceText, filePath),
        this.analyzeTypeReferences(node, sourceText, filePath),
        this.analyzeImportExports(node, sourceText, filePath),
      ];

      const analysisResults = await Promise.all(analysisPromises);

      // Combine all reference types
      for (const result of analysisResults) {
        references.push(...result);
      }

      // Filter by confidence threshold
      const filteredReferences = references.filter(
        (ref) => ref.confidence >= this.config.confidenceThreshold,
      );

      // Cache results
      this.referenceCache.set(cacheKey, filteredReferences);

      const processingTime = performance.now() - startTime;
      this.logger.debug("Cross-reference analysis completed", {
        nodeId: node.id,
        filePath,
        referencesFound: filteredReferences.length,
        processingTime: `${processingTime.toFixed(2)}ms`,
      });

      return filteredReferences;
    } catch (error) {
      this.logger.error("Cross-reference analysis failed", {
        nodeId: node.id,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Analyze function and method calls
   */
  private async analyzeFunctionCalls(
    node: ASTNode,
    sourceText: string,
    filePath: string,
  ): Promise<CrossReference[]> {
    const references: CrossReference[] = [];

    // Look for call expressions in the node
    const callNodes = this.findNodesByType(node, [
      "call_expression",
      "method_call",
    ]);

    for (const callNode of callNodes) {
      const functionName = this.extractFunctionName(callNode);
      if (!functionName) {
        continue;
      }

      // Find the target function definition
      const targetNode = this.findFunctionDefinition(functionName);
      if (!targetNode) {
        continue;
      }

      const reference: CrossReference = {
        id: `${node.id}-call-${callNode.id}`,
        sourceNodeId: node.id,
        targetNodeId: targetNode.id,
        sourceFilePath: filePath,
        targetFilePath: targetNode.filePath || filePath,
        referenceType:
          callNode.type === "method_call"
            ? CrossReferenceType.METHOD_CALL
            : CrossReferenceType.FUNCTION_CALL,
        confidence: this.calculateReferenceConfidence(callNode, targetNode),
        location: {
          line: callNode.start?.line || 0,
          column: callNode.start?.column || 0,
          length: functionName.length,
        },
        context: this.extractReferenceContext(callNode, sourceText),
        metadata: {
          isUsage: true,
          accessLevel: this.determineAccessLevel(targetNode),
        },
      };

      references.push(reference);
    }

    return references;
  }

  /**
   * Analyze variable references
   */
  private async analyzeVariableReferences(
    node: ASTNode,
    sourceText: string,
    filePath: string,
  ): Promise<CrossReference[]> {
    const references: CrossReference[] = [];

    // Find variable references (identifiers)
    const identifierNodes = this.findNodesByType(node, ["identifier"]);

    for (const identifierNode of identifierNodes) {
      const variableName = identifierNode.name;
      if (!variableName) {
        continue;
      }

      // Find the variable declaration
      const declarationNode = this.findVariableDeclaration(variableName);
      if (!declarationNode) {
        continue;
      }

      const reference: CrossReference = {
        id: `${node.id}-var-${identifierNode.id}`,
        sourceNodeId: node.id,
        targetNodeId: declarationNode.id,
        sourceFilePath: filePath,
        targetFilePath: declarationNode.filePath || filePath,
        referenceType: CrossReferenceType.VARIABLE_REFERENCE,
        confidence: this.calculateReferenceConfidence(
          identifierNode,
          declarationNode,
        ),
        location: {
          line: identifierNode.start?.line || 0,
          column: identifierNode.start?.column || 0,
          length: variableName.length,
        },
        context: this.extractReferenceContext(identifierNode, sourceText),
        metadata: {
          isUsage: true,
          accessLevel: this.determineAccessLevel(declarationNode),
        },
      };

      references.push(reference);
    }

    return references;
  }

  /**
   * Analyze type references
   */
  private async analyzeTypeReferences(
    node: ASTNode,
    sourceText: string,
    filePath: string,
  ): Promise<CrossReference[]> {
    const references: CrossReference[] = [];

    // Find type annotations and references
    const typeNodes = this.findNodesByType(node, [
      "type_annotation",
      "type_identifier",
      "generic_type",
      "interface_declaration",
      "class_declaration",
    ]);

    for (const typeNode of typeNodes) {
      const typeName = this.extractTypeName(typeNode);
      if (!typeName) {
        continue;
      }

      // Find the type definition
      const definitionNode = this.findTypeDefinition(typeName);
      if (!definitionNode) {
        continue;
      }

      const reference: CrossReference = {
        id: `${node.id}-type-${typeNode.id}`,
        sourceNodeId: node.id,
        targetNodeId: definitionNode.id,
        sourceFilePath: filePath,
        targetFilePath: definitionNode.filePath || filePath,
        referenceType: CrossReferenceType.TYPE_REFERENCE,
        confidence: this.calculateReferenceConfidence(typeNode, definitionNode),
        location: {
          line: typeNode.start?.line || 0,
          column: typeNode.start?.column || 0,
          length: typeName.length,
        },
        context: this.extractReferenceContext(typeNode, sourceText),
        metadata: {
          isTypeReference: true,
          accessLevel: this.determineAccessLevel(definitionNode),
        },
      };

      references.push(reference);
    }

    return references;
  }

  /**
   * Analyze import and export declarations
   */
  private async analyzeImportExports(
    node: ASTNode,
    sourceText: string,
    filePath: string,
  ): Promise<CrossReference[]> {
    const references: CrossReference[] = [];

    if (!this.config.analyzeImports && !this.config.analyzeExports) {
      return references;
    }

    // Find import/export statements
    const importExportNodes = this.findNodesByType(node, [
      "import_statement",
      "import_declaration",
      "export_statement",
      "export_declaration",
    ]);

    for (const ieNode of importExportNodes) {
      const isImport = ieNode.type.includes("import");
      const isExport = ieNode.type.includes("export");

      if (isImport && !this.config.analyzeImports) {
        continue;
      }
      if (isExport && !this.config.analyzeExports) {
        continue;
      }

      // Extract imported/exported symbols
      const symbols = this.extractImportExportSymbols(ieNode);

      for (const symbol of symbols) {
        const targetNode = this.findSymbolDefinition(symbol.name);
        if (!targetNode) {
          continue;
        }

        const reference: CrossReference = {
          id: `${node.id}-${isImport ? "import" : "export"}-${ieNode.id}`,
          sourceNodeId: node.id,
          targetNodeId: targetNode.id,
          sourceFilePath: filePath,
          targetFilePath: targetNode.filePath || symbol.source || filePath,
          referenceType: isImport
            ? CrossReferenceType.IMPORT_DECLARATION
            : CrossReferenceType.EXPORT_DECLARATION,
          confidence: 0.9, // High confidence for explicit import/export
          location: {
            line: ieNode.start?.line || 0,
            column: ieNode.start?.column || 0,
            length: symbol.name.length,
          },
          context: this.extractReferenceContext(ieNode, sourceText),
          metadata: {
            isImport: isImport,
            isExport: isExport,
            accessLevel: "public",
          },
        };

        references.push(reference);
      }
    }

    return references;
  }

  // Helper methods

  private buildSymbolTable(allNodes: Map<string, ASTNode>): void {
    this.symbolTable.clear();
    for (const [_nodeId, node] of allNodes) {
      if (node.name) {
        this.symbolTable.set(node.name, node);
      }
    }
  }

  private findNodesByType(node: ASTNode, types: string[]): ASTNode[] {
    const found: ASTNode[] = [];

    const traverse = (current: ASTNode) => {
      if (types.includes(current.type)) {
        found.push(current);
      }

      if (current.children) {
        for (const child of current.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return found;
  }

  private extractFunctionName(callNode: ASTNode): string | null {
    // Extract function name from call expression
    if (callNode.name) {
      return callNode.name;
    }

    // Look in children for function name
    const nameChild = callNode.children?.find(
      (child) =>
        child.type === "identifier" || child.type === "member_expression",
    );

    return nameChild?.name || null;
  }

  private extractTypeName(typeNode: ASTNode): string | null {
    return typeNode.name || null;
  }

  private extractImportExportSymbols(
    ieNode: ASTNode,
  ): Array<{ name: string; source?: string }> {
    const symbols: Array<{ name: string; source?: string }> = [];

    // This is a simplified extraction - would need language-specific logic
    const traverse = (node: ASTNode) => {
      if (node.type === "identifier" && node.name) {
        symbols.push({ name: node.name });
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(ieNode);
    return symbols;
  }

  private findFunctionDefinition(functionName: string): ASTNode | null {
    return this.symbolTable.get(functionName) || null;
  }

  private findVariableDeclaration(variableName: string): ASTNode | null {
    return this.symbolTable.get(variableName) || null;
  }

  private findTypeDefinition(typeName: string): ASTNode | null {
    return this.symbolTable.get(typeName) || null;
  }

  private findSymbolDefinition(symbolName: string): ASTNode | null {
    return this.symbolTable.get(symbolName) || null;
  }

  private calculateReferenceConfidence(
    sourceNode: ASTNode,
    targetNode: ASTNode,
  ): number {
    // Calculate confidence based on various factors
    let confidence = 0.5; // Base confidence

    // Increase confidence for exact name matches
    if (sourceNode.name === targetNode.name) {
      confidence += 0.3;
    }

    // Increase confidence for same file references
    if (sourceNode.filePath === targetNode.filePath) {
      confidence += 0.2;
    }

    // Increase confidence for explicit declarations
    if (targetNode.type.includes("declaration")) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private determineAccessLevel(
    node: ASTNode,
  ): "public" | "private" | "protected" | "internal" {
    // Determine access level from node metadata
    const metadata = node.metadata;

    // Check for private/protected/internal in modifiers
    if (metadata?.modifiers?.includes("private")) {
      return "private";
    }
    if (metadata?.modifiers?.includes("protected")) {
      return "protected";
    }
    if (metadata?.modifiers?.includes("internal")) {
      return "internal";
    }

    return "public"; // Default to public
  }

  private extractReferenceContext(node: ASTNode, sourceText: string): string {
    // Extract surrounding context for the reference
    const startPos = node.start;
    const endPos = node.end;

    if (!startPos || !endPos) {
      return "";
    }

    // Extract a few lines around the reference
    const lines = sourceText.split("\n");
    const startLine = Math.max(0, startPos.line - 2);
    const endLine = Math.min(lines.length - 1, endPos.line + 2);

    return lines.slice(startLine, endLine + 1).join("\n");
  }

  /**
   * Clear the reference cache
   */
  public clearCache(): void {
    this.referenceCache.clear();
    this.symbolTable.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; symbolTableSize: number } {
    return {
      size: this.referenceCache.size,
      symbolTableSize: this.symbolTable.size,
    };
  }
}
