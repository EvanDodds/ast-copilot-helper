/**
 * JavaScript signature extractor
 * Handles JavaScript-specific syntax including ES6+ features, arrow functions, and classes
 */

import type { ASTNode } from '../../parser/types';
import type { SignatureExtractor, Parameter } from '../types';
import { ExtractionUtils } from './extraction-utils';

export class JavaScriptExtractor implements SignatureExtractor {
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
        
      case 'arrow_function':
        return this.extractArrowFunctionSignature(node, sourceLines);
        
      case 'variable_declaration':
        return this.extractVariableSignature(node, sourceLines);
        
      case 'constructor':
        return this.extractConstructorSignature(node, sourceLines);
        
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
    
    // Split parameters considering destructuring and default values
    const parameters = this.splitParameters(paramString);
    
    return parameters
      .map(param => this.parseJavaScriptParameter(param))
      .filter(param => param.name.length > 0);
  }

  extractReturnType(_node: ASTNode, _sourceText: string): string | null {
    // JavaScript doesn't have explicit return types
    // We could potentially infer from JSDoc comments in the future
    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const modifiers = ExtractionUtils.extractModifiers(node, sourceLines);
    
    // Add JavaScript-specific modifiers
    const sourceText2 = sourceLines.join(' ').toLowerCase();
    if (sourceText2.includes('get ')) {
      modifiers.push('getter');
    }
    if (sourceText2.includes('set ')) {
      modifiers.push('setter');
    }
    if (sourceText2.includes('*')) {
      modifiers.push('generator');
    }
    
    return modifiers.sort();
  }

  private extractFunctionSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['function']);
    if (!declarationLine) {
      return `function ${node.name || 'anonymous'}()`;
    }
    
    // Extract function signature up to opening brace
    const match = declarationLine.match(/^(.*?)(?:\{|$)/);
    const signature = match?.[1]?.trim() || declarationLine;
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractMethodSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['(', node.name || 'method']);
    if (!declarationLine) {
      return `${node.name || 'method'}()`;
    }
    
    let signature = declarationLine;
    
    // Handle getter/setter methods
    if (signature.includes('get ')) {
      signature = signature.replace(/get\s+/, 'get ');
    } else if (signature.includes('set ')) {
      signature = signature.replace(/set\s+/, 'set ');
    }
    
    // Handle generator methods
    if (signature.includes('*')) {
      signature = signature.replace(/\*\s*/, '* ');
    }
    
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

  private extractArrowFunctionSignature(node: ASTNode, sourceLines: string[]): string {
    const declarationLine = sourceLines[0] || '';
    
    // Handle various arrow function patterns
    // (param1, param2) => expression
    // param => expression
    // async (param) => expression
    
    const arrowMatch = declarationLine.match(/(.*?)=>\s*(.*?)(?:\{|;|$)/);
    if (arrowMatch && arrowMatch[1]) {
      const params = arrowMatch[1].trim();
      const returnPart = arrowMatch[2]?.trim();
      
      if (returnPart && returnPart !== '') {
        return ExtractionUtils.cleanSignature(`${params} => ${returnPart}`);
      } else {
        return ExtractionUtils.cleanSignature(`${params} => {}`);
      }
    }
    
    // Try to find assignment pattern for arrow functions
    const assignmentMatch = declarationLine.match(/(?:const|let|var)\s+(\w+)\s*=\s*(.*?)=>/);
    if (assignmentMatch && assignmentMatch[1] && assignmentMatch[2]) {
      const name = assignmentMatch[1];
      const params = assignmentMatch[2].trim();
      return ExtractionUtils.cleanSignature(`${name} = ${params} => {}`);
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
    let signature = match?.[1]?.trim() || declarationLine;
    
    // Truncate very long initializations
    if (signature.length > 100) {
      const equalIndex = signature.indexOf('=');
      if (equalIndex > 0) {
        signature = signature.substring(0, equalIndex + 1) + ' ...';
      }
    }
    
    return ExtractionUtils.cleanSignature(signature);
  }

  private extractConstructorSignature(_node: ASTNode, sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, ['constructor']);
    if (!declarationLine) {
      return 'constructor()';
    }
    
    // Extract constructor signature up to opening brace
    const match = declarationLine.match(/^(.*?)(?:\{|$)/);
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
   * Parse JavaScript parameter with support for destructuring and default values
   */
  private parseJavaScriptParameter(paramStr: string): Parameter {
    const trimmed = paramStr.trim();
    
    // Handle destructuring patterns
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // Destructuring parameter
      let name = trimmed;
      let defaultValue: string | undefined;
      
      // Check for default value
      const defaultMatch = trimmed.match(/^(.+?)\s*=\s*(.+)$/);
      if (defaultMatch && defaultMatch[1] && defaultMatch[2]) {
        name = defaultMatch[1].trim();
        defaultValue = defaultMatch[2];
      }
      
      return { name, defaultValue };
    }
    
    // Regular parameter
    return ExtractionUtils.parseParameter(paramStr);
  }

  /**
   * Split parameter string by commas, respecting nested brackets and destructuring
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
        // Track nesting depth for objects, arrays, and function calls
        if (char === '(' || char === '[' || char === '{') {
          depth++;
        } else if (char === ')' || char === ']' || char === '}') {
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