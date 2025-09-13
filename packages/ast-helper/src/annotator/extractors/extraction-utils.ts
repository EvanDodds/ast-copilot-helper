/**
 * Base utilities and shared functionality for signature extractors
 */

import { ASTNode } from '../../parser/types';
import { Parameter } from '../types';

/**
 * Utility functions for extracting common elements from source text
 */
export class ExtractionUtils {
  /**
   * Extract the source lines for a given node
   */
  static getNodeLines(node: ASTNode, sourceText: string): string[] {
    const lines = sourceText.split('\n');
    const startLine = Math.max(0, node.start.line - 1);
    const endLine = Math.min(lines.length, node.end.line);
    return lines.slice(startLine, endLine);
  }

  /**
   * Clean and normalize a signature string
   */
  static cleanSignature(signature: string): string {
    return signature
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/\s*([{}(),;])\s*/g, '$1') // Remove spaces around punctuation
      .replace(/\s*:\s*/g, ': ')      // Normalize type annotations
      .trim();
  }

  /**
   * Extract parameter information from a parameter string
   */
  static parseParameter(paramStr: string): Parameter {
    // Handle TypeScript/JavaScript parameter patterns
    // Examples: "name", "name: type", "name?: type", "name = defaultValue", "name: type = defaultValue"
    
    const trimmed = paramStr.trim();
    let name = '';
    let type: string | undefined;
    let optional = false;
    let defaultValue: string | undefined;

    // Check for default value (= something)
    const defaultMatch = trimmed.match(/^(.+?)\s*=\s*(.+)$/);
    if (defaultMatch && defaultMatch[1] && defaultMatch[2]) {
      defaultValue = defaultMatch[2];
      const beforeDefault = defaultMatch[1];
      
      // Check for optional marker
      if (beforeDefault.includes('?:')) {
        optional = true;
        const parts = beforeDefault.split('?:').map(s => s.trim());
        name = parts[0] || '';
        type = parts[1];
      } else if (beforeDefault.includes(':')) {
        const parts = beforeDefault.split(':').map(s => s.trim());
        name = parts[0] || '';
        type = parts[1];
      } else {
        name = beforeDefault.trim();
      }
    } else {
      // No default value
      if (trimmed.includes('?:')) {
        optional = true;
        const parts = trimmed.split('?:').map(s => s.trim());
        name = parts[0] || '';
        type = parts[1];
      } else if (trimmed.includes(':')) {
        const parts = trimmed.split(':').map(s => s.trim());
        name = parts[0] || '';
        type = parts[1];
      } else {
        name = trimmed;
      }
    }

    return { name, type, optional, defaultValue };
  }

  /**
   * Extract modifiers from a node's metadata or source
   */
  static extractModifiers(node: ASTNode, sourceLines: string[]): string[] {
    const modifiers: string[] = [];
    
    // Add modifiers from node metadata
    if (node.metadata.modifiers) {
      modifiers.push(...node.metadata.modifiers);
    }

    // Extract additional modifiers from source text
    const sourceText = sourceLines.join(' ').toLowerCase();
    
    const modifierPatterns = [
      'public', 'private', 'protected',
      'static', 'abstract', 'readonly',
      'async', 'export', 'default',
      'const', 'let', 'var'
    ];

    for (const modifier of modifierPatterns) {
      if (sourceText.includes(modifier) && !modifiers.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    return modifiers.sort();
  }

  /**
   * Determine if a string looks like a type annotation
   */
  static looksLikeType(str: string): boolean {
    // Common type patterns
    const typePatterns = [
      /^[A-Z]/,                    // PascalCase types
      /^(string|number|boolean|object|function|void|any|unknown|never)$/i,
      /\[\]$/,                     // Array types
      /^Promise</,                 // Promise types
      /<.*>$/,                     // Generic types
      /\|/,                        // Union types
      /&/,                         // Intersection types
    ];

    return typePatterns.some(pattern => pattern.test(str.trim()));
  }

  /**
   * Find function declaration line in source
   */
  static findDeclarationLine(sourceLines: string[], keywords: string[]): string | null {
    for (const line of sourceLines) {
      const trimmed = line.trim();
      if (keywords.some(keyword => trimmed.includes(keyword))) {
        return trimmed;
      }
    }
    return sourceLines[0] || null;
  }
}