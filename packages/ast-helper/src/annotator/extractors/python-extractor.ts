import { ASTNode } from '../../parser/types';
import { SignatureExtractor, Parameter } from '../types';
import { ExtractionUtils } from './extraction-utils';

export class PythonExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const line = sourceLines[0] || '';
    return line.includes('def ') || line.includes('class ') ? line.trim() + ':' : node.name || node.type;
  }

  extractParameters(_node: ASTNode, _sourceText: string): Parameter[] {
    return [];
  }

  extractReturnType(_node: ASTNode, _sourceText: string): string | null {
    return null;
  }

  extractAccessModifiers(_node: ASTNode, _sourceText: string): string[] {
    return [];
  }
}
