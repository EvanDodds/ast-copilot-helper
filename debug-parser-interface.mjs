#!/usr/bin/env node

import { TreeSitterGrammarManager } from './packages/ast-helper/src/parser/grammar-manager.js';

async function debugParser() {
  console.log('=== Debugging Parser Interface ===');
  
  const grammarManager = new TreeSitterGrammarManager('.astdb-debug');
  
  try {
    console.log('\n1. Loading TypeScript parser...');
    const parser = await grammarManager.loadParser('typescript');
    
    console.log('2. Parser object info:');
    console.log('  - Type:', typeof parser);
    console.log('  - Constructor:', parser.constructor.name);
    console.log('  - Methods:', Object.getOwnPropertyNames(parser).filter(p => typeof parser[p] === 'function'));
    console.log('  - Properties:', Object.getOwnPropertyNames(parser).filter(p => typeof parser[p] !== 'function'));
    
    console.log('\n3. Testing parse method...');
    const sampleCode = 'const hello = "world";';
    
    if (typeof parser.parse === 'function') {
      console.log('  - parse method exists');
      const result = parser.parse(sampleCode);
      console.log('  - Parse result type:', typeof result);
      console.log('  - Parse result constructor:', result?.constructor?.name);
      console.log('  - Parse result properties:', result ? Object.getOwnPropertyNames(result) : 'null/undefined');
      
      if (result && result.rootNode) {
        console.log('  - rootNode exists:', !!result.rootNode);
        console.log('  - rootNode type:', result.rootNode.type);
      } else {
        console.log('  - rootNode is missing or undefined');
        
        // Check if result itself has tree-like properties
        if (result && typeof result.walk === 'function') {
          console.log('  - Result has walk method (might be the tree node itself)');
        }
        
        // Check for other tree-like properties
        if (result) {
          console.log('  - Result properties:', Object.getOwnPropertyNames(result));
          if (result.type) {
            console.log('  - Result.type:', result.type);
          }
        }
      }
    } else {
      console.log('  - parse method does NOT exist');
      console.log('  - Available methods:', Object.getOwnPropertyNames(parser).filter(p => typeof parser[p] === 'function'));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugParser().catch(console.error);