#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Prepare symlinks for the project
 * This script ensures that the ast-core-engine is accessible from the root directory
 * for TypeScript compilation. It tries symlink first, then falls back to copying.
 */

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'packages', 'ast-core-engine');
const targetPath = path.join(rootDir, 'ast-core-engine');

function ensureEngineAccessible() {
  // Check if target already exists and points to the right place
  if (fs.existsSync(targetPath)) {
    try {
      const stat = fs.lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(targetPath);
        const resolvedTarget = path.resolve(rootDir, linkTarget);
        if (resolvedTarget === sourceDir) {
          console.log('Symlink already exists and is correct');
          return 'symlink';
        } else {
          console.log('Removing incorrect symlink');
          fs.unlinkSync(targetPath);
        }
      } else if (stat.isDirectory()) {
        // Check if it's a copy that might be stale
        const sourceFiles = ['index.js', 'index.d.ts'];
        let isValid = true;
        
        for (const file of sourceFiles) {
          const sourcePath = path.join(sourceDir, file);
          const targetFilePath = path.join(targetPath, file);
          
          if (!fs.existsSync(sourcePath) || !fs.existsSync(targetFilePath)) {
            isValid = false;
            break;
          }
          
          const sourceStat = fs.statSync(sourcePath);
          const targetStat = fs.statSync(targetFilePath);
          
          // If source is newer, we need to update
          if (sourceStat.mtime > targetStat.mtime) {
            isValid = false;
            break;
          }
        }
        
        if (isValid) {
          console.log('Directory copy is up-to-date');
          return 'copy';
        } else {
          console.log('Removing stale directory copy');
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
      } else {
        console.log('Removing non-directory target');
        fs.unlinkSync(targetPath);
      }
    } catch (error) {
      console.log('Error checking existing target:', error.message);
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } catch {
        // Ignore removal errors
      }
    }
  }

  // In CI environments, prefer directory copy over symlinks for reliability
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' || process.env.RUNNER_OS;
  
  if (!isCI) {
    // Try to create symlink first in local development
    try {
      fs.symlinkSync('packages/ast-core-engine', targetPath);
      console.log('✅ Symlink created successfully');
      return 'symlink';
    } catch (symlinkError) {
      console.log('Symlink failed, trying directory copy:', symlinkError.message);
    }
  } else {
    console.log('CI environment detected, using directory copy for reliability');
  }

  // Fall back to copying the directory
  try {
    // Create target directory
    fs.mkdirSync(targetPath, { recursive: true });
    
    // Copy essential files
    const filesToCopy = ['index.js', 'index.d.ts', 'package.json'];
    
    // Also copy all .node files (binary files)
    const sourceFiles = fs.readdirSync(sourceDir);
    const nodeFiles = sourceFiles.filter(f => f.endsWith('.node'));
    filesToCopy.push(...nodeFiles);
    
    for (const file of filesToCopy) {
      const sourcePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetPath, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetFilePath);
      }
    }
    
    console.log('✅ Directory copy created successfully');
    return 'copy';
  } catch (copyError) {
    console.error('❌ Both symlink and copy failed:', copyError.message);
    return false;
  }
}

// Verify source exists
if (!fs.existsSync(sourceDir)) {
  console.error('❌ Source directory does not exist:', sourceDir);
  process.exit(1);
}

// Ensure the engine is accessible
const result = ensureEngineAccessible();
if (!result) {
  console.error('❌ Failed to make ast-core-engine accessible');
  process.exit(1);
}

// Enhanced verification for CI compatibility
const indexJsPath = path.join(targetPath, 'index.js');
const indexDtsPath = path.join(targetPath, 'index.d.ts');
const packageJsonPath = path.join(targetPath, 'package.json');

console.log('🔍 Verifying ast-core-engine accessibility...');
console.log(`   Target path: ${targetPath}`);
console.log(`   Access type: ${result}`);
console.log(`   Path exists: ${fs.existsSync(targetPath)}`);

// Check if package.json is accessible (should exist immediately)
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json accessible');
} else {
  console.log('⚠️  package.json not yet accessible (will be created by Rust build)');
}

// For directory copies, verify critical files exist
if (result === 'copy') {
  if (fs.existsSync(indexJsPath) && fs.existsSync(indexDtsPath)) {
    console.log('✅ ast-core-engine files accessible from root directory');
    console.log('   - index.js: OK');
    console.log('   - index.d.ts: OK');
  } else {
    console.log('⚠️  ast-core-engine files not yet accessible (will be copied after Rust build)');
    console.log(`   - index.js: ${fs.existsSync(indexJsPath) ? 'OK' : 'PENDING'}`);
    console.log(`   - index.d.ts: ${fs.existsSync(indexDtsPath) ? 'OK' : 'PENDING'}`);
  }
} else if (result === 'symlink') {
  console.log('✅ ast-core-engine symlink created');
  console.log('   - Files will be available after Rust engine build');
}

// Test Node.js module resolution path (this is what TypeScript uses)
console.log('🧪 Testing Node.js module resolution...');
try {
  const resolvedPath = require.resolve('../ast-core-engine', { paths: [__dirname + '/..'] });
  console.log('✅ Node.js can resolve ../ast-core-engine');
  console.log(`   Resolved to: ${resolvedPath}`);
} catch (resolveError) {
  console.log('⚠️  Node.js cannot yet resolve ../ast-core-engine (normal if Rust not built)');
  console.log(`   Error: ${resolveError.message}`);
}