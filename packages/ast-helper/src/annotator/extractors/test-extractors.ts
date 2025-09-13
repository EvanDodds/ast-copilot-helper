/**
 * Basic test for signature extractors
 */

import { TypeScriptExtractor, JavaScriptExtractor, PythonExtractor } from './index';
import { ASTNode } from '../../parser/types';

// Create a mock AST node for testing
const mockNode: ASTNode = {
  id: 'test-node-id',
  type: 'function',
  name: 'testFunction',
  filePath: '/test/file.ts',
  start: { line: 1, column: 0 },
  end: { line: 5, column: 10 },
  metadata: {
    language: 'typescript',
    scope: [],
    modifiers: ['public']
  }
};

const mockSourceText = `
function testFunction(param1: string, param2?: number): string {
  return param1 + (param2 || 0).toString();
}
`;

// Test TypeScript extractor
const tsExtractor = new TypeScriptExtractor();
const tsSignature = tsExtractor.extractSignature(mockNode, mockSourceText);
const tsParameters = tsExtractor.extractParameters(mockNode, mockSourceText);
const tsReturnType = tsExtractor.extractReturnType(mockNode, mockSourceText);
const tsModifiers = tsExtractor.extractAccessModifiers(mockNode, mockSourceText);

console.log('TypeScript Extractor Results:');
console.log('Signature:', tsSignature);
console.log('Parameters:', tsParameters);
console.log('Return Type:', tsReturnType);
console.log('Modifiers:', tsModifiers);

// Test JavaScript extractor
const jsExtractor = new JavaScriptExtractor();
const jsSignature = jsExtractor.extractSignature(mockNode, mockSourceText);
const jsParameters = jsExtractor.extractParameters(mockNode, mockSourceText);

console.log('\nJavaScript Extractor Results:');
console.log('Signature:', jsSignature);
console.log('Parameters:', jsParameters);

// Test Python extractor
const pyExtractor = new PythonExtractor();
const pySignature = pyExtractor.extractSignature(mockNode, 'def test_function(param1, param2=None):');

console.log('\nPython Extractor Results:');
console.log('Signature:', pySignature);

console.log('\nAll extractors loaded successfully!');