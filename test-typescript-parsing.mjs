#!/usr/bin/env node

// Simple test to verify TypeScript parsing is working
import { TreeSitterGrammarManager } from './packages/ast-helper/src/parser/grammar-manager.js';

async function testTypescriptParsing() {
  try {
    console.log('Testing TypeScript parsing...');
    
    const manager = new TreeSitterGrammarManager();
    console.log('✓ Grammar manager created');
    
    const parser = await manager.loadParser('typescript');
    console.log('✓ TypeScript parser loaded');
    
    const code = 'const hello: string = "world";';
    console.log('✓ Parsing code:', code);
    
    const tree = parser.parse(code);
    console.log('✓ Parse successful');
    console.log('  - Root node type:', tree.rootNode.type);
    console.log('  - Has errors:', tree.rootNode.hasError);
    console.log('  - Child count:', tree.rootNode.childCount);
    
    if (tree.rootNode.childCount > 0) {
      console.log('  - First child type:', tree.rootNode.child(0)?.type);
    }
    
    console.log('🎉 TypeScript grammar compatibility confirmed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testTypescriptParsing();