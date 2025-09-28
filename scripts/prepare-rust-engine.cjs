#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Prepare Rust engine - build only if needed
 * This script checks if the Rust engine needs to be built by comparing
 * modification times of source files vs output files.
 */

const engineDir = path.resolve(__dirname, '..', 'packages', 'ast-core-engine');
const outputFile = path.join(engineDir, 'index.js');
const cargoFile = path.join(engineDir, 'Cargo.toml');

function needsRebuild() {
  // If output files don't exist, we need to build
  if (!fs.existsSync(outputFile)) {
    console.log('JavaScript output file does not exist, building...');
    return true;
  }

  // If Cargo.toml doesn't exist, something is wrong
  if (!fs.existsSync(cargoFile)) {
    console.log('Cargo.toml not found, skipping build');
    return false;
  }

  // Find the most recent output file (JS, binary, or type definitions)
  const outputFiles = [outputFile];
  
  // Add binary file if it exists (platform-specific)
  const possibleBinaries = fs.readdirSync(engineDir).filter(f => f.endsWith('.node'));
  outputFiles.push(...possibleBinaries.map(f => path.join(engineDir, f)));
  
  // Add type definitions
  const typeDefsFile = path.join(engineDir, 'index.d.ts');
  if (fs.existsSync(typeDefsFile)) {
    outputFiles.push(typeDefsFile);
  }

  // Get the newest output time
  let newestOutputTime = new Date(0);
  for (const file of outputFiles) {
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.mtime > newestOutputTime) {
        newestOutputTime = stat.mtime;
      }
    }
  }

  // Check Cargo.toml
  const cargoStat = fs.statSync(cargoFile);
  if (cargoStat.mtime > newestOutputTime) {
    console.log('Cargo.toml is newer than output, rebuilding...');
    return true;
  }

  // Check all Rust source files in src/
  const srcDir = path.join(engineDir, 'src');
  if (fs.existsSync(srcDir)) {
    function checkDirectory(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (checkDirectory(fullPath)) {
            return true;
          }
        } else if (entry.name.endsWith('.rs')) {
          const stat = fs.statSync(fullPath);
          if (stat.mtime > newestOutputTime) {
            console.log(`${fullPath} is newer than output, rebuilding...`);
            return true;
          }
        }
      }
      return false;
    }
    
    if (checkDirectory(srcDir)) {
      return true;
    }
  }

  console.log('Rust engine is up-to-date');
  return false;
}

function updateEngineAccessAfterBuild() {
  // TypeScript path mapping eliminates the need for root-level engine directory
  console.log('✅ Using TypeScript path mapping - no root engine directory update needed');
}

try {
  if (needsRebuild()) {
    console.log('🔧 Building Rust NAPI bindings...');
    
    // Change to the engine directory and build
    process.chdir(engineDir);
    
    // Build the Rust bindings using yarn (which runs the NAPI build)
    console.log('Building native bindings with yarn build...');
    execSync('yarn build', { stdio: 'inherit' });
    
    console.log('✅ Rust NAPI bindings built successfully');
    
    // Update the root directory copy if it exists
    updateEngineAccessAfterBuild();
  }
} catch (error) {
  console.error('❌ Rust binding build failed:', error.message);
  console.error('This likely means Rust toolchain is not available');
  console.error('Please install Rust: https://rustup.rs/');
  
  // For CI environments where Rust isn't installed, fall back to stub generation
  console.log('🔄 Falling back to stub generation for CI compatibility...');
  try {
    const generateScript = path.resolve(__dirname, 'generate-napi-bindings.cjs');
    execSync(`node "${generateScript}"`, { stdio: 'inherit' });
    console.log('✅ Stub bindings generated');
  } catch (stubError) {
    console.error('❌ Even stub generation failed:', stubError.message);
    process.exit(1); // This is a hard failure
  }
}