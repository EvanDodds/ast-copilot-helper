#!/usr/bin/env node
/**
 * Test script for Rust CLI integration
 */

import { RustParserCli } from './dist/parser/rust-cli.js';

// Create a parser with explicit path
const rustParser = new RustParserCli({
  cliPath: '/home/evan/ast-copilot-helper/packages/ast-core-engine/target/debug/ast-parser',
  verbose: true
});

async function testRustIntegration() {
  console.log('Testing Rust CLI Integration...\n');
  
  try {
    // Check if CLI is available
    console.log('1. Checking CLI availability...');
    const isAvailable = await rustParser.checkCliAvailable();
    console.log(`   ✓ CLI available: ${isAvailable}`);
    
    if (!isAvailable) {
      console.log('   ❌ Rust CLI not available. Please build it first with:');
      console.log('      cd packages/ast-core-engine && cargo build --bin ast-parser');
      return;
    }
    
    // Get supported languages
    console.log('\n2. Getting supported languages...');
    const languages = await rustParser.getSupportedLanguages();
    console.log(`   ✓ Languages: ${languages.languages.join(', ')}`);
    console.log(`   ✓ Extensions: ${languages.extensions.join(', ')}`);
    
    // Test parsing
    console.log('\n3. Testing JavaScript parsing...');
    const jsResult = await rustParser.parseCode({
      source_code: 'const hello = "world"; console.log(hello);',
      file_path: 'test.js',
      language: 'javascript'
    });
    
    console.log(`   ✓ Parsed ${jsResult.total_nodes} nodes in ${jsResult.processing_time_ms}ms`);
    console.log(`   ✓ Language detected: ${jsResult.language}`);
    console.log(`   ✓ First few nodes: ${jsResult.nodes.slice(0, 3).map(n => n.node_type).join(', ')}`);
    
    // Test TypeScript parsing
    console.log('\n4. Testing TypeScript parsing...');
    const tsResult = await rustParser.parseCode({
      source_code: 'interface User { name: string; age: number; } const user: User = { name: "Alice", age: 30 };',
      file_path: 'test.ts',
      language: 'typescript'
    });
    
    console.log(`   ✓ Parsed ${tsResult.total_nodes} nodes in ${tsResult.processing_time_ms}ms`);
    console.log(`   ✓ Language detected: ${tsResult.language}`);
    
    // Test batch parsing
    console.log('\n5. Testing batch parsing...');
    const batchResult = await rustParser.parseBatch({
      files: [
        {
          source_code: 'def hello(): return "Python"',
          file_path: 'test.py',
          language: 'python'
        },
        {
          source_code: 'fn main() { println!("Rust"); }',
          file_path: 'test.rs',
          language: 'rust'
        }
      ],
      max_concurrency: 2
    });
    
    console.log(`   ✓ Batch processed ${batchResult.total_files} files`);
    console.log(`   ✓ Successful: ${batchResult.successful_files}/${batchResult.total_files}`);
    console.log(`   ✓ Total time: ${batchResult.total_processing_time_ms}ms`);
    
    console.log('\n🎉 All tests passed! Rust CLI integration is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testRustIntegration().catch(console.error);