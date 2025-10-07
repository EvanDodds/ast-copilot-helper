#!/usr/bin/env node

/**
 * Enhanced Error Message Demo
 * Demonstrates the improved error handling system for Tree-sitter parsers
 */

import { TreeSitterGrammarManager } from "../src/parser/grammar-manager.js";

async function demonstrateEnhancedErrors() {
  console.log("=== Enhanced Error Handling Demo ===\n");
  
  const grammarManager = new TreeSitterGrammarManager("test-tmp/error-demo");
  
  // Test 1: Parser not available (will show structured error)
  console.log("1. Testing unsupported language (will show enhanced error):");
  try {
    await grammarManager.loadParser("cobol");
  } catch (error) {
    console.log("✓ Caught enhanced error:");
    if (error.toDetailedString) {
      console.log(error.toDetailedString());
    } else {
      console.log(error.message);
    }
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
  
  // Test 2: Native module error (for installed languages that might fail)
  console.log("2. Testing native module loading (TypeScript should work):");
  try {
    const parser = await grammarManager.loadParser("typescript");
    console.log("✓ TypeScript parser loaded successfully");
    console.log("✓ Enhanced error handling works - no errors for working parsers");
  } catch (error) {
    console.log("✓ Caught enhanced error for TypeScript:");
    if (error.toDetailedString) {
      console.log(error.toDetailedString());
    } else {
      console.log(error.message);
    }
  }
  
  console.log("\n=== Demo Complete ===");
}

// Run the demo
demonstrateEnhancedErrors().catch(console.error);