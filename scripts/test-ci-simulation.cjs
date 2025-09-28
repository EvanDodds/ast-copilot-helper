#!/usr/bin/env node

/**
 * CI Simulation Test
 * Simulates CI environment behavior to verify our symlink/copy solutions work correctly
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🧪 CI Environment Simulation Test');
console.log('================================');

// Simulate CI environment
process.env.CI = 'true';
process.env.GITHUB_ACTIONS = 'true';
process.env.RUNNER_OS = 'Linux';

console.log('✅ CI environment variables set');

// TypeScript path mapping eliminates the need for symlink cleanup
console.log('✅ Using TypeScript path mapping instead of symlinks - no cleanup needed');

console.log();

try {
  // TypeScript path mapping replaces symlinks - no need for symlink preparation
  console.log('🔗 Skipping symlink preparation (replaced by TypeScript path mapping)...');
  
  // Verify the source packages directory exists for TypeScript path mapping
  const packagesPath = 'packages/ast-core-engine';
  if (fs.existsSync(packagesPath)) {
    const stats = fs.lstatSync(packagesPath);
    if (stats.isDirectory()) {
      console.log('✅ Source directory exists for TypeScript path mapping');
    } else {
      console.log('⚠️  WARNING: Source directory is not a directory');
    }
  }

  console.log();

  // Test Rust engine preparation
  console.log('🦀 Testing Rust engine preparation...');
  execSync('yarn run prepare:rust-engine', { 
    stdio: 'inherit', 
    cwd: process.cwd(),
    env: { ...process.env }
  });

  console.log();

  // Test post-build verification
  console.log('🔍 Testing post-build verification...');
  execSync('yarn run verify:engine-access', { 
    stdio: 'inherit', 
    cwd: process.cwd(),
    env: { ...process.env }
  });

  console.log();

  // Test TypeScript compilation (using yarn since tsc may not be globally available)
  console.log('📝 Testing TypeScript compilation...');
  execSync('yarn tsc --build --verbose', { 
    stdio: 'inherit', 
    cwd: process.cwd(),
    env: { ...process.env }
  });

  console.log();
  console.log('🎉 ALL CI SIMULATION TESTS PASSED!');
  console.log('✅ The build system is CI-compatible');
  
} catch (error) {
  console.error();
  console.error('❌ CI SIMULATION TEST FAILED');
  console.error(`Error: ${error.message}`);
  console.error();
  console.error('This indicates potential CI compatibility issues.');
  process.exit(1);
}