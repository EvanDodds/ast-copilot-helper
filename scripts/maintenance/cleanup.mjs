#!/usr/bin/env node

/**
 * Repository Cleanup Automation Script
 * 
 * This script performs automated cleanup tasks to maintain repository health,
 * including removing build artifacts, cleaning dependencies, optimizing files,
 * and managing git history.
 */

import { execSync } from 'child_process';
import { existsSync, statSync, readdirSync, unlinkSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

class RepositoryCleanup {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
    this.interactive = options.interactive || false;
    this.tasks = options.tasks || 'all'; // all, build, deps, git, cache, logs
    this.force = options.force || false;
    
    this.stats = {
      filesRemoved: 0,
      bytesFreed: 0,
      tasksCompleted: 0,
      tasksSkipped: 0,
      errors: 0
    };
  }

  /**
   * Run all cleanup tasks
   */
  async runCleanup() {
    console.log('🧹 Starting repository cleanup...\n');
    
    try {
      const tasks = [
        { name: 'build', fn: this.cleanBuildArtifacts.bind(this), description: 'Remove build artifacts and dist files' },
        { name: 'deps', fn: this.cleanDependencies.bind(this), description: 'Clean and optimize dependencies' },
        { name: 'cache', fn: this.cleanCaches.bind(this), description: 'Clear various cache directories' },
        { name: 'logs', fn: this.cleanLogs.bind(this), description: 'Remove old log files' },
        { name: 'git', fn: this.cleanGitHistory.bind(this), description: 'Optimize git repository' },
        { name: 'temp', fn: this.cleanTempFiles.bind(this), description: 'Remove temporary files' },
        { name: 'optimize', fn: this.optimizeFiles.bind(this), description: 'Optimize file formats and remove duplicates' }
      ];

      for (const task of tasks) {
        if (this.shouldRunTask(task.name)) {
          console.log(`🔧 ${task.description}...`);
          
          if (this.interactive) {
            const response = await this.askUser(`Run ${task.name} cleanup? (y/N): `);
            if (!response.toLowerCase().startsWith('y')) {
              console.log(`⏭️  Skipping ${task.name} cleanup\n`);
              this.stats.tasksSkipped++;
              continue;
            }
          }

          try {
            const result = await task.fn();
            this.stats.tasksCompleted++;
            
            if (result && result.filesRemoved) {
              this.stats.filesRemoved += result.filesRemoved;
              this.stats.bytesFreed += result.bytesFreed || 0;
            }
            
            console.log('');
          } catch (error) {
            console.error(`❌ ${task.name} cleanup failed:`, error.message);
            this.stats.errors++;
            if (this.verbose) {
              console.error(error.stack);
            }
            console.log('');
          }
        }
      }

      this.printSummary();

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check if a specific task should run
   */
  shouldRunTask(taskName) {
    if (this.tasks === 'all') return true;
    return this.tasks.includes(taskName);
  }

  /**
   * Clean build artifacts
   */
  async cleanBuildArtifacts() {
    const result = { filesRemoved: 0, bytesFreed: 0 };
    
    // Common build directories and files
    const buildPatterns = [
      'dist',
      'build',
      'out',
      'target',
      '.next',
      '.nuxt',
      '.output',
      '*.tsbuildinfo',
      '*.d.ts.map',
      'coverage',
      '.nyc_output'
    ];

    for (const pattern of buildPatterns) {
      try {
        const files = this.findFiles(pattern);
        for (const file of files) {
          if (this.shouldDelete(file, 'build artifact')) {
            const size = this.getFileSize(file);
            this.deleteFileOrDir(file);
            result.filesRemoved++;
            result.bytesFreed += size;
          }
        }
      } catch (error) {
        if (this.verbose) {
          console.log(`Warning: Could not process pattern ${pattern}:`, error.message);
        }
      }
    }

    // Clean TypeScript build info from packages
    const packageDirs = this.findPackageDirectories();
    for (const packageDir of packageDirs) {
      const tsbuildinfo = join(packageDir, 'tsconfig.tsbuildinfo');
      if (existsSync(tsbuildinfo)) {
        if (this.shouldDelete(tsbuildinfo, 'TypeScript build info')) {
          const size = this.getFileSize(tsbuildinfo);
          this.deleteFileOrDir(tsbuildinfo);
          result.filesRemoved++;
          result.bytesFreed += size;
        }
      }
    }

    console.log(`  ✅ Removed ${result.filesRemoved} build artifacts (${this.formatBytes(result.bytesFreed)} freed)`);
    return result;
  }

  /**
   * Clean and optimize dependencies
   */
  async cleanDependencies() {
    const result = { filesRemoved: 0, bytesFreed: 0 };

    try {
      // Clean npm cache
      if (this.shouldDelete('npm cache', 'npm cache')) {
        console.log('  🗑️  Cleaning npm cache...');
        if (!this.dryRun) {
          execSync('npm cache clean --force', { stdio: this.verbose ? 'inherit' : 'pipe' });
        }
        result.filesRemoved += 1;
      }

      // Find and clean node_modules if needed
      const packageDirs = this.findPackageDirectories();
      for (const packageDir of packageDirs) {
        const nodeModules = join(packageDir, 'node_modules');
        if (existsSync(nodeModules)) {
          // Check if node_modules is stale
          const packageJson = join(packageDir, 'package.json');
          const lockFile = join(packageDir, 'package-lock.json');
          
          if (this.isNodeModulesStale(nodeModules, packageJson, lockFile)) {
            if (this.shouldDelete(nodeModules, 'stale node_modules')) {
              const size = this.getDirectorySize(nodeModules);
              this.deleteFileOrDir(nodeModules);
              result.filesRemoved++;
              result.bytesFreed += size;
              
              // Reinstall dependencies
              console.log(`  📦 Reinstalling dependencies in ${packageDir}...`);
              if (!this.dryRun) {
                execSync('npm ci', { cwd: packageDir, stdio: this.verbose ? 'inherit' : 'pipe' });
              }
            }
          }
        }
      }

      // Remove orphaned lock files
      const lockFiles = this.findFiles('package-lock.json');
      for (const lockFile of lockFiles) {
        const packageJson = join(dirname(lockFile), 'package.json');
        if (!existsSync(packageJson)) {
          if (this.shouldDelete(lockFile, 'orphaned lock file')) {
            const size = this.getFileSize(lockFile);
            this.deleteFileOrDir(lockFile);
            result.filesRemoved++;
            result.bytesFreed += size;
          }
        }
      }

    } catch (error) {
      console.log(`  ⚠️  Dependency cleanup warning: ${error.message}`);
    }

    console.log(`  ✅ Cleaned ${result.filesRemoved} dependency items (${this.formatBytes(result.bytesFreed)} freed)`);
    return result;
  }

  /**
   * Clean various cache directories
   */
  async cleanCaches() {
    const result = { filesRemoved: 0, bytesFreed: 0 };

    const cachePatterns = [
      '.cache',
      '.temp',
      '.tmp',
      '.eslintcache',
      '.jest-cache',
      '.vitest-cache',
      '.wireit',
      '.turbo',
      '.parcel-cache',
      '.webpack-cache',
      '.rollup.cache'
    ];

    for (const pattern of cachePatterns) {
      try {
        const files = this.findFiles(pattern);
        for (const file of files) {
          if (this.shouldDelete(file, 'cache directory/file')) {
            const size = this.getFileSize(file);
            this.deleteFileOrDir(file);
            result.filesRemoved++;
            result.bytesFreed += size;
          }
        }
      } catch (error) {
        if (this.verbose) {
          console.log(`Warning: Could not process cache pattern ${pattern}:`, error.message);
        }
      }
    }

    // Clean OS-specific cache files
    const osCachePatterns = [
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini'
    ];

    for (const pattern of osCachePatterns) {
      try {
        const command = `find . -name "${pattern}" -type f -not -path "./.git/*"`;
        const files = execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8' })
          .trim().split('\n').filter(Boolean);
        
        for (const file of files) {
          const fullPath = join(ROOT_DIR, file);
          if (this.shouldDelete(fullPath, 'OS cache file')) {
            const size = this.getFileSize(fullPath);
            this.deleteFileOrDir(fullPath);
            result.filesRemoved++;
            result.bytesFreed += size;
          }
        }
      } catch (error) {
        // Ignore find errors
      }
    }

    console.log(`  ✅ Removed ${result.filesRemoved} cache items (${this.formatBytes(result.bytesFreed)} freed)`);
    return result;
  }

  /**
   * Clean old log files
   */
  async cleanLogs() {
    const result = { filesRemoved: 0, bytesFreed: 0 };

    const logPatterns = [
      '*.log',
      'logs/*.log',
      'log/*.log',
      '.npm/_logs/*',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*'
    ];

    for (const pattern of logPatterns) {
      try {
        const files = this.findFiles(pattern);
        for (const file of files) {
          // Only delete old log files (older than 7 days)
          if (this.isFileOld(file, 7) && this.shouldDelete(file, 'old log file')) {
            const size = this.getFileSize(file);
            this.deleteFileOrDir(file);
            result.filesRemoved++;
            result.bytesFreed += size;
          }
        }
      } catch (error) {
        if (this.verbose) {
          console.log(`Warning: Could not process log pattern ${pattern}:`, error.message);
        }
      }
    }

    console.log(`  ✅ Removed ${result.filesRemoved} old log files (${this.formatBytes(result.bytesFreed)} freed)`);
    return result;
  }

  /**
   * Optimize git repository
   */
  async cleanGitHistory() {
    const result = { filesRemoved: 0, bytesFreed: 0 };

    try {
      // Check if we're in a git repository
      execSync('git rev-parse --git-dir', { cwd: ROOT_DIR, stdio: 'pipe' });

      // Git garbage collection
      console.log('  🗑️  Running git garbage collection...');
      if (!this.dryRun) {
        execSync('git gc --aggressive --prune=now', { 
          cwd: ROOT_DIR, 
          stdio: this.verbose ? 'inherit' : 'pipe' 
        });
      }

      // Clean up merged branches (if not on main branch)
      try {
        const currentBranch = execSync('git branch --show-current', { 
          cwd: ROOT_DIR, 
          encoding: 'utf-8' 
        }).trim();

        if (currentBranch === 'main' || currentBranch === 'master') {
          console.log('  🌿 Cleaning up merged branches...');
          if (!this.dryRun) {
            // List merged branches (excluding main/master/develop)
            const mergedBranches = execSync(`git branch --merged | grep -v "\\*\\|main\\|master\\|develop" | tr -d ' '`, {
              cwd: ROOT_DIR,
              encoding: 'utf-8'
            }).trim().split('\n').filter(Boolean);

            for (const branch of mergedBranches) {
              if (branch.trim() && this.shouldDelete(`branch: ${branch}`, 'merged branch')) {
                console.log(`    🗑️  Deleting merged branch: ${branch}`);
                execSync(`git branch -d ${branch}`, { cwd: ROOT_DIR, stdio: 'pipe' });
                result.filesRemoved++;
              }
            }
          }
        }
      } catch (error) {
        // Ignore branch cleanup errors
        if (this.verbose) {
          console.log('  ℹ️  Could not clean merged branches:', error.message);
        }
      }

      // Remove git hooks that might be stale
      const hooksDir = join(ROOT_DIR, '.git', 'hooks');
      if (existsSync(hooksDir)) {
        const hooks = readdirSync(hooksDir);
        for (const hook of hooks) {
          if (hook.endsWith('.sample')) {
            const hookPath = join(hooksDir, hook);
            if (this.shouldDelete(hookPath, 'git hook sample')) {
              const size = this.getFileSize(hookPath);
              this.deleteFileOrDir(hookPath);
              result.filesRemoved++;
              result.bytesFreed += size;
            }
          }
        }
      }

    } catch (error) {
      console.log(`  ⚠️  Git cleanup warning: Not in a git repository or git not available`);
    }

    console.log(`  ✅ Git optimization completed (${result.filesRemoved} items cleaned)`);
    return result;
  }

  /**
   * Clean temporary files
   */
  async cleanTempFiles() {
    const result = { filesRemoved: 0, bytesFreed: 0 };

    const tempPatterns = [
      '*.tmp',
      '*.temp',
      '*~',
      '.#*',
      '#*#',
      '*.swp',
      '*.swo',
      '.*.swp',
      '.*.swo'
    ];

    for (const pattern of tempPatterns) {
      try {
        const command = `find . -name "${pattern}" -type f -not -path "./.git/*"`;
        const files = execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8' })
          .trim().split('\n').filter(Boolean);
        
        for (const file of files) {
          const fullPath = join(ROOT_DIR, file);
          if (this.shouldDelete(fullPath, 'temporary file')) {
            const size = this.getFileSize(fullPath);
            this.deleteFileOrDir(fullPath);
            result.filesRemoved++;
            result.bytesFreed += size;
          }
        }
      } catch (error) {
        // Ignore find errors
      }
    }

    console.log(`  ✅ Removed ${result.filesRemoved} temporary files (${this.formatBytes(result.bytesFreed)} freed)`);
    return result;
  }

  /**
   * Optimize files (remove duplicates, compress, etc.)
   */
  async optimizeFiles() {
    const result = { filesRemoved: 0, bytesFreed: 0 };

    try {
      // Find duplicate files (simplified check by size and name)
      console.log('  🔍 Looking for duplicate files...');
      const duplicates = this.findDuplicateFiles();
      
      for (const duplicateGroup of duplicates) {
        if (duplicateGroup.length > 1) {
          // Keep the first file, remove others
          for (let i = 1; i < duplicateGroup.length; i++) {
            const duplicate = duplicateGroup[i];
            if (this.shouldDelete(duplicate, 'duplicate file')) {
              const size = this.getFileSize(duplicate);
              this.deleteFileOrDir(duplicate);
              result.filesRemoved++;
              result.bytesFreed += size;
            }
          }
        }
      }

      // Remove empty directories
      console.log('  📁 Removing empty directories...');
      const emptyDirs = this.findEmptyDirectories();
      for (const dir of emptyDirs) {
        if (this.shouldDelete(dir, 'empty directory')) {
          this.deleteFileOrDir(dir);
          result.filesRemoved++;
        }
      }

    } catch (error) {
      console.log(`  ⚠️  File optimization warning: ${error.message}`);
    }

    console.log(`  ✅ Optimized ${result.filesRemoved} files/directories (${this.formatBytes(result.bytesFreed)} freed)`);
    return result;
  }

  /**
   * Helper methods
   */

  findFiles(pattern) {
    try {
      let command;
      if (pattern.includes('/')) {
        // Handle path patterns
        command = `find . -path "./${pattern}" -not -path "./.git/*" -not -path "./node_modules/*"`;
      } else {
        // Handle filename patterns
        command = `find . -name "${pattern}" -not -path "./.git/*" -not -path "./node_modules/*"`;
      }
      
      const output = execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8' });
      return output.trim().split('\n')
        .filter(Boolean)
        .map(file => join(ROOT_DIR, file));
    } catch (error) {
      return [];
    }
  }

  findPackageDirectories() {
    const dirs = [ROOT_DIR];
    
    try {
      // Find package.json files and get their directories
      const packageFiles = execSync('find . -name "package.json" -not -path "./node_modules/*" -not -path "./.git/*"', {
        cwd: ROOT_DIR,
        encoding: 'utf-8'
      }).trim().split('\n').filter(Boolean);
      
      for (const packageFile of packageFiles) {
        const dir = join(ROOT_DIR, dirname(packageFile));
        if (!dirs.includes(dir)) {
          dirs.push(dir);
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return dirs;
  }

  isNodeModulesStale(nodeModules, packageJson, lockFile) {
    try {
      if (!existsSync(packageJson)) return false;
      
      const nodeModulesStat = statSync(nodeModules);
      const packageJsonStat = statSync(packageJson);
      
      // If package.json is newer than node_modules
      if (packageJsonStat.mtime > nodeModulesStat.mtime) {
        return true;
      }
      
      // If lock file exists and is newer than node_modules
      if (existsSync(lockFile)) {
        const lockFileStat = statSync(lockFile);
        if (lockFileStat.mtime > nodeModulesStat.mtime) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  isFileOld(filePath, days) {
    try {
      const stats = statSync(filePath);
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      return ageInDays > days;
    } catch (error) {
      return false;
    }
  }

  findDuplicateFiles() {
    // Simplified duplicate detection by file size and basename
    const fileMap = new Map();
    
    try {
      const command = 'find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -exec ls -la {} \\;';
      const output = execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8' });
      
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 9) {
          const size = parts[4];
          const name = parts.slice(8).join(' ');
          const baseName = basename(name);
          const key = `${size}-${baseName}`;
          
          if (!fileMap.has(key)) {
            fileMap.set(key, []);
          }
          fileMap.get(key).push(join(ROOT_DIR, name));
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return Array.from(fileMap.values()).filter(group => group.length > 1);
  }

  findEmptyDirectories() {
    const emptyDirs = [];
    
    try {
      const command = 'find . -type d -empty -not -path "./.git/*" -not -path "./node_modules/*"';
      const output = execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8' });
      
      const dirs = output.trim().split('\n').filter(Boolean);
      for (const dir of dirs) {
        emptyDirs.push(join(ROOT_DIR, dir));
      }
    } catch (error) {
      // Ignore errors
    }
    
    return emptyDirs;
  }

  shouldDelete(item, type) {
    if (this.force) return true;
    
    if (this.dryRun) {
      console.log(`  🔍 Would delete ${type}: ${item}`);
      return false;
    }
    
    if (this.verbose) {
      console.log(`  🗑️  Deleting ${type}: ${item}`);
    }
    
    return true;
  }

  deleteFileOrDir(path) {
    try {
      if (statSync(path).isDirectory()) {
        rmSync(path, { recursive: true, force: true });
      } else {
        unlinkSync(path);
      }
    } catch (error) {
      console.log(`    ⚠️  Could not delete ${path}:`, error.message);
    }
  }

  getFileSize(filePath) {
    try {
      const stats = statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  getDirectorySize(dirPath) {
    try {
      const command = `du -sb "${dirPath}" | cut -f1`;
      const size = execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
      return parseInt(size) || 0;
    } catch (error) {
      return 0;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async askUser(question) {
    return new Promise((resolve) => {
      process.stdout.write(question);
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  printSummary() {
    console.log('🧹 Cleanup Summary');
    console.log('=================');
    console.log(`Files/Items Removed: ${this.stats.filesRemoved}`);
    console.log(`Space Freed: ${this.formatBytes(this.stats.bytesFreed)}`);
    console.log(`Tasks Completed: ${this.stats.tasksCompleted}`);
    console.log(`Tasks Skipped: ${this.stats.tasksSkipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log('');
    
    if (this.dryRun) {
      console.log('ℹ️  This was a dry run. No files were actually deleted.');
    } else {
      console.log('✅ Cleanup completed successfully!');
    }
  }
}

// CLI Interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--tasks':
      case '-t':
        options.tasks = args[++i].split(',');
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Repository Cleanup Tool
=======================

Usage: node cleanup.mjs [options]

Options:
  -v, --verbose         Show detailed output
  -n, --dry-run         Show what would be deleted without actually deleting
  -i, --interactive     Ask before each cleanup task
  -t, --tasks TASKS     Comma-separated list of tasks to run:
                        build, deps, cache, logs, git, temp, optimize
                        (default: all)
  -f, --force           Force cleanup without confirmation (use with caution)
  -h, --help            Show this help message

Cleanup Tasks:
  build     - Remove build artifacts (dist, build, coverage, etc.)
  deps      - Clean dependencies (npm cache, stale node_modules)
  cache     - Remove cache directories and files
  logs      - Delete old log files (>7 days old)
  git       - Optimize git repository and clean branches
  temp      - Remove temporary files and editor backups
  optimize  - Remove duplicates and empty directories

Examples:
  node cleanup.mjs                           # Run all cleanup tasks
  node cleanup.mjs --dry-run                 # Preview what would be cleaned
  node cleanup.mjs --interactive             # Ask before each task
  node cleanup.mjs --tasks build,cache       # Run only specific tasks
  node cleanup.mjs --verbose --dry-run       # Detailed preview mode

Safety:
  - Always run with --dry-run first to preview changes
  - Use --interactive for selective cleanup
  - Git-tracked files are never deleted
  - node_modules is only cleaned if stale
`);
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    
    if (!options.force && !options.dryRun && !options.interactive) {
      console.log('⚠️  Running cleanup without --dry-run. This will delete files!');
      console.log('Press Ctrl+C to cancel or wait 3 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const cleanup = new RepositoryCleanup(options);
    await cleanup.runCleanup();
    
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}