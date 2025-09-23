#!/usr/bin/env tsx
/**
 * Version Update Script
 * Updates version numbers across the monorepo
 */

import { promises as fs } from 'fs';
import { join } from 'path';

async function updateVersion() {
  console.log('🔄 Updating version numbers...');

  try {
    const args = process.argv.slice(2);
    const versionType = args[0] || 'patch'; // major, minor, patch
    
    // Read root package.json
    const rootPackagePath = './package.json';
    const rootPackageJson = JSON.parse(await fs.readFile(rootPackagePath, 'utf-8'));
    const currentVersion = rootPackageJson.version;
    
    // Calculate new version
    const newVersion = calculateNextVersion(currentVersion, versionType);
    console.log(`📊 Updating version: ${currentVersion} → ${newVersion}`);
    
    // Update root package.json
    rootPackageJson.version = newVersion;
    await fs.writeFile(rootPackagePath, JSON.stringify(rootPackageJson, null, 2) + '\n');
    console.log('✅ Updated root package.json');
    
    // Update workspace packages
    const workspaces = ['packages/ast-helper', 'packages/ast-mcp-server', 'packages/vscode-extension'];
    
    for (const workspace of workspaces) {
      const packagePath = join(workspace, 'package.json');
      
      try {
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
        packageJson.version = newVersion;
        
        // Update internal dependencies
        if (packageJson.dependencies) {
          for (const [depName, depVersion] of Object.entries(packageJson.dependencies)) {
            if (depName.startsWith('@ast-copilot-helper/')) {
              packageJson.dependencies[depName] = newVersion;
            }
          }
        }
        
        if (packageJson.devDependencies) {
          for (const [depName, depVersion] of Object.entries(packageJson.devDependencies)) {
            if (depName.startsWith('@ast-copilot-helper/')) {
              packageJson.devDependencies[depName] = newVersion;
            }
          }
        }
        
        await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`✅ Updated ${workspace}/package.json`);
        
      } catch (error) {
        console.warn(`⚠️ Could not update ${packagePath}:`, (error as Error).message);
      }
    }
    
    console.log(`🎉 Version update completed: ${newVersion}`);
    console.log('💡 Next steps:');
    console.log('  1. Review the changes');
    console.log('  2. Run: git add -A && git commit -m "chore: bump version to ' + newVersion + '"');
    console.log('  3. Run: git tag v' + newVersion);
    console.log('  4. Run: git push origin main --tags');
    
  } catch (error) {
    console.error('❌ Error updating version:', error);
    process.exit(1);
  }
}

function calculateNextVersion(currentVersion: string, type: string): string {
  const parts = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
    default:
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateVersion().catch(console.error);
}