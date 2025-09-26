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
          return true;
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
          return true;
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

  // Try to create symlink first
  try {
    fs.symlinkSync('packages/ast-core-engine', targetPath);
    console.log('✅ Symlink created successfully');
    return true;
  } catch (symlinkError) {
    console.log('Symlink failed, trying directory copy:', symlinkError.message);
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
    return true;
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
if (!ensureEngineAccessible()) {
  console.error('❌ Failed to make ast-core-engine accessible');
  process.exit(1);
}

// Final verification
const indexJsPath = path.join(targetPath, 'index.js');
const indexDtsPath = path.join(targetPath, 'index.d.ts');

if (!fs.existsSync(indexJsPath)) {
  console.error('❌ Verification failed: index.js not accessible at', indexJsPath);
  process.exit(1);
}

if (!fs.existsSync(indexDtsPath)) {
  console.error('❌ Verification failed: index.d.ts not accessible at', indexDtsPath);
  process.exit(1);
}

console.log('✅ ast-core-engine is accessible from root directory');
console.log('   - index.js:', fs.existsSync(indexJsPath) ? 'OK' : 'MISSING');
console.log('   - index.d.ts:', fs.existsSync(indexDtsPath) ? 'OK' : 'MISSING');