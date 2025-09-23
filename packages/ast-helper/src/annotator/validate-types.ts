/**
 * Simple validation script for annotation types
 * This ensures the types compile correctly and can be used
 */

import type {
  Annotation,
  Parameter,
  AnnotationConfig} from './types';
import {
  SemanticTag,
  DEFAULT_ANNOTATION_CONFIG
} from './types';

// Test that we can create objects with the defined types
const sampleAnnotation: Annotation = {
  nodeId: 'sample-node-id',
  filePath: '/sample/path.ts',
  signature: 'function sample(): void',
  summary: 'Sample function for testing',
  complexity: 1,
  lineCount: 5,
  characterCount: 50,
  dependencies: [],
  exports: [],
  calls: [],
  sourceSnippet: 'function sample() {}',
  contextLines: { before: [], after: [] },
  purpose: 'testing',
  tags: [SemanticTag.UTILITY],
  completeness: 1.0,
  confidence: 1.0,
  language: 'typescript',
  lastUpdated: new Date().toISOString(),
  version: '1.0'
};

const sampleParameter: Parameter = {
  name: 'input',
  type: 'string',
  optional: false
};

// Test configuration
const config: AnnotationConfig = {
  ...DEFAULT_ANNOTATION_CONFIG,
  maxSnippetLines: 25
};

console.log('Annotation types validation successful');
console.log('Sample annotation node ID:', sampleAnnotation.nodeId);
console.log('Sample parameter name:', sampleParameter.name);
console.log('Config max snippet lines:', config.maxSnippetLines);