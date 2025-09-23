/**
 * TypeScript signature extractor
 * Handles TypeScript-specific syntax including generics, decorators, and type annotations
 */

import type { ASTNode } from '../../parser/types';
import type { SignatureExtractor, Parameter } from '../types';
import { ExtractionUtils } from './extraction-utils';

export class TypeScriptExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    
    switch (node.type) {
      case 'function':
      case 'function_declaration':
        return this.extractFunctionSignature(node, sourceLines);
        
      case 'method':
      case 'method_definition':
        return this.extractMethodSignature(node, sourceLines);
        
      case 'class':
      case 'class_declaration':
        return this.extractClassSignature(node, sourceLines);
        
      case 'interface':
      case 'interface_declaration':
        return this.extractInterfaceSignature(node, sourceLines);
        
      case 'arrow_function':
        return this.extractArrowFunctionSignature(node, sourceLines);
        
      case 'variable_declaration':
        return this.extractVariableSignature(node, sourceLines);
        
      default:
        return this.extractGenericSignature(node, sourceLines);
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(' ');
    
    // Find parameter list in parentheses
    const paramMatch = signature.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]) {
      return [];
    }
    
    const paramString = paramMatch[1];
    if (paramString.trim() === '') {
      return [];
    }
    
    // Split by comma, but respect nested brackets and generics
    const parameters = this.splitParameters(paramString);
    
    return parameters
      .map(param => ExtractionUtils.parseParameter(param))
      .filter(param => param.name.length > 0);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(' ');
    
    // TypeScript return type pattern: ): ReturnType
    const returnTypeMatch = signature.match(/\):\s*([^{;=]+)/);
    if (returnTypeMatch && returnTypeMatch[1]) {
      return returnTypeMatch[1].trim();
    }
    
    // Arrow function return type: => ReturnType
    const arrowReturnMatch = signature.match(/=>\s*([^{;=]+)/);
    if (arrowReturnMatch && arrowReturnMatch[1]) {
      return arrowReturnMatch[1].trim();
    }
    
    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    return ExtractionUtils.extractModifiers(node, sourceLines);
  }

  private extractFunctionSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['function']);
    if (!declarationLine) {
      return `function ${node.name || 'anonymous'}()`;
    }
    
    // Extract function signature up to opening brace or semicolon
    const match = declarationLine.match(/^(.*?)(?:\{|;|$)/);
    const signature = match?.[1]?.trim() || declarationLine;
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractMethodSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['(', node.name || 'method']);
    if (!declarationLine) {
      return `${node.name || 'method'}()`;
    }
    
    // Remove class context, keep method signature
    let signature = declarationLine;
    
    // Remove leading visibility modifiers and whitespace
    signature = signature.replace(/^(public|private|protected|static|abstract|async|readonly)\s+/, '');
    
    // Extract up to opening brace
    const match = signature.match(/^(.*?)(?:\{|$)/);
    signature = match?.[1]?.trim() || signature;
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractClassSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['class']);
    if (!declarationLine) {
      return `class ${node.name || 'Anonymous'}`;
    }
    
    // Extract class declaration up to opening brace
    const match = declarationLine.match(/^(.*?)(?:\{|$)/);
    const signature = match?.[1]?.trim() || declarationLine;
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractInterfaceSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['interface']);
    if (!declarationLine) {
      return `interface ${node.name || 'Anonymous'}`;
    }
    
    // Extract interface declaration up to opening brace
    const match = declarationLine.match(/^(.*?)(?:\{|$)/);
    const signature = match?.[1]?.trim() || declarationLine;
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractArrowFunctionSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = sourceLines[0] || '';
    
    // Find arrow function pattern
    const arrowMatch = declarationLine.match(/(.*?)=>\s*(.*?)(?:\{|;|$)/);
    if (arrowMatch && arrowMatch[1] && arrowMatch[2]) {
      const params = arrowMatch[1].trim();
      const returnPart = arrowMatch[2].trim();
      
      if (returnPart) {
        return ExtractionUtils.cleanSignature(`${params} => ${returnPart}`);
      } else {
        return ExtractionUtils.cleanSignature(`${params} => {}`);
      }
    }
    
    return `${node.name || 'anonymous'} => {}`;
  }

  private extractVariableSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['const', 'let', 'var']);
    if (!declarationLine) {
      return `${node.name || 'variable'}`;
    }
    
    // Extract variable declaration up to semicolon or end of line
    const match = declarationLine.match(/^(.*?)(?:;|$)/);
    const signature = match?.[1]?.trim() || declarationLine;
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractGenericSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = sourceLines[0] || '';
    
    if (node.name) {
      return `${node.type} ${node.name}`;
    }
    
    // Try to extract some meaningful part of the first line
    const trimmed = declarationLine.trim();
    if (trimmed.length > 0 && trimmed.length < 100) {
      return ExtractionUtils.cleanSignature(trimmed);
    }
    
    return node.type;
  }

  /**
   * Split parameter string by commas, respecting nested brackets and generics
   */
  private splitParameters(paramString: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];
      const prevChar = i > 0 ? paramString[i - 1] : '';
      
      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
      
      if (!inString) {
        // Track nesting depth
        if (char === '(' || char === '[' || char === '<' || char === '{') {
          depth++;
        } else if (char === ')' || char === ']' || char === '>' || char === '}') {
          depth--;
        } else if (char === ',' && depth === 0) {
          // This comma is at the parameter level, not nested
          params.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    // Add the last parameter
    if (current.trim()) {
      params.push(current.trim());
    }
    
    return params;
  }
}