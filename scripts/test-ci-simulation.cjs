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

// Clean up any existing symlinks to test fresh creation
const targetPath = 'ast-core-engine';
if (fs.existsSync(targetPath)) {
  const stats = fs.lstatSync(targetPath);
  if (stats.isSymbolicLink() || stats.isDirectory()) {
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(targetPath);
      console.log('🧹 Removed existing symlink for fresh test');
    } else {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log('🧹 Removed existing directory for fresh test');
    }
  }
}

console.log();

try {
  // Test symlink preparation in CI mode
  console.log('🔗 Testing symlink preparation in CI mode...');
  execSync('yarn run prepare:symlinks', { 
    stdio: 'inherit', 
    cwd: process.cwd(),
    env: { ...process.env }
  });

  // Verify the result is a directory copy, not symlink
  if (fs.existsSync(targetPath)) {
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      console.log('⚠️  WARNING: Created symlink in CI mode (may cause issues)');
    } else {
      console.log('✅ Created directory copy in CI mode (correct behavior)');
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