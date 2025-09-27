#!/usr/bin/env node

/**
 * Post-build verification for ast-core-engine accessibility
 * This script verifies that the ast-core-engine is properly accessible after Rust build
 */

const fs = require('fs');
const path = require('path');

const targetPath = 'ast-core-engine';
const indexJsPath = path.join(targetPath, 'index.js');
const indexDtsPath = path.join(targetPath, 'index.d.ts');
const packageJsonPath = path.join(targetPath, 'package.json');

console.log('🔍 Post-build verification of ast-core-engine accessibility...');

// Check if the target path exists
if (!fs.existsSync(targetPath)) {
  console.error('❌ CRITICAL: ast-core-engine path does not exist');
  process.exit(1);
}

// Check file accessibility
const files = [
  { path: packageJsonPath, name: 'package.json', critical: true },
  { path: indexJsPath, name: 'index.js', critical: true },
  { path: indexDtsPath, name: 'index.d.ts', critical: true }
];

let allCriticalFilesExist = true;

for (const file of files) {
  const exists = fs.existsSync(file.path);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file.name}: ${exists ? 'OK' : 'MISSING'}`);
  
  if (file.critical && !exists) {
    allCriticalFilesExist = false;
  }
}

if (!allCriticalFilesExist) {
  console.error('❌ CRITICAL FILES MISSING - TypeScript compilation will fail');
  process.exit(1);
}

// Test Node.js module resolution using absolute path
console.log('🧪 Testing Node.js module resolution...');
try {
  const absoluteTargetPath = path.resolve(targetPath);
  const resolvedPath = require.resolve(absoluteTargetPath);
  console.log('✅ Node.js can resolve ast-core-engine');
  console.log(`   Resolved to: ${resolvedPath}`);
  
  // Test actual module loading
  console.log('🧪 Testing module loading...');
  try {
    const module = require(absoluteTargetPath);
    console.log('✅ ast-core-engine module loads successfully');
    console.log(`   Module type: ${typeof module}`);
    
    if (module && typeof module === 'object') {
      const exports = Object.keys(module);
      console.log(`   Available exports: ${exports.length > 0 ? exports.join(', ') : 'none (module may export default or be function)'}`);
      
      // Test if this is a stub (expected in CI environments without native binaries)
      if (exports.includes('AstCoreEngineApi')) {
        try {
          // Try to create an instance - if it's a stub, this will throw with our specific message
          new module.AstCoreEngineApi();
        } catch (stubError) {
          if (stubError.message.includes('Native binding not available')) {
            console.log('⚠️  Module is using runtime stub (normal for CI without native binaries)');
            console.log('   TypeScript compilation will work, but runtime usage requires: cargo build --release');
          } else {
            throw stubError; // Re-throw if it's a different error
          }
        }
      }
    }
  } catch (moduleError) {
    // If module loading fails, it might be due to native binding issues
    if (moduleError.message.includes('Failed to load native binding')) {
      console.error('❌ CRITICAL: ast-core-engine module cannot be resolved or loaded');
      console.error(`   Error: ${moduleError.message}`);
      
      // Additional debugging information
      console.log('🔍 Debug information:');
      console.log(`   Target path: ${path.resolve(targetPath)}`);
      console.log(`   Current working directory: ${process.cwd()}`);
      console.log(`   Files in target directory: ${fs.readdirSync(targetPath).join(', ')}`);
      
      process.exit(1);
    } else {
      throw moduleError; // Re-throw if it's a different error
    }
  }
  
} catch (resolveError) {
  console.error('❌ CRITICAL: ast-core-engine module cannot be resolved or loaded');
  console.error(`   Error: ${resolveError.message}`);
  
  // Additional debugging information
  console.log('🔍 Debug information:');
  console.log(`   Target path: ${path.resolve(targetPath)}`);
  console.log(`   Current working directory: ${process.cwd()}`);
  console.log(`   Files in target directory: ${fs.readdirSync(targetPath).join(', ')}`);
  
  process.exit(1);
}

console.log('🎉 All verifications passed! ast-core-engine is properly accessible.');