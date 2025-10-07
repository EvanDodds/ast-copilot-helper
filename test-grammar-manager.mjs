#!/usr/bin/env node

// Test our grammar manager to debug the parse issue
import { TreeSitterGrammarManager } from './packages/ast-helper/src/parser/grammar-manager.ts';

async function testGrammarManager() {
  try {
    console.log('Testing TreeSitterGrammarManager...');
    
    const manager = new TreeSitterGrammarManager('.astdb-test');
    
    console.log('Loading parser...');
    const parser = await manager.loadParser('typescript');
    
    console.log('Parser type:', typeof parser);
    console.log('Parser constructor:', parser?.constructor?.name);
    console.log('Parser methods:', Object.getOwnPropertyNames(parser).filter(prop => typeof parser[prop] === 'function'));
    
    const code = 'const hello = "world";';
    console.log('Parsing code:', code);
    
    if (typeof parser.parse === 'function') {
      const tree = parser.parse(code);
      console.log('Tree type:', typeof tree);
      console.log('Tree constructor:', tree?.constructor?.name);
      console.log('Tree properties:', Object.getOwnPropertyNames(tree || {}));
      
      if (tree && tree.rootNode) {
        console.log('✓ Root node exists');
        console.log('  Type:', tree.rootNode.type);
        console.log('  Child count:', tree.rootNode.childCount);
      } else {
        console.log('✗ Root node missing');
        console.log('  Tree object:', tree);
      }
    } else {
      console.log('✗ Parser has no parse method');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testGrammarManager();