#!/usr/bin/env node

/**
 * Repository Health Check Script
 * 
 * This script performs comprehensive health checks on the repository,
 * including code quality, security, performance, and maintenance metrics.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

class RepositoryHealthChecker {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.outputFormat = options.format || 'console'; // console, json, markdown
    this.checks = options.checks || 'all'; // all, security, quality, deps, docs
    this.failOnIssues = options.failOnIssues !== false;
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    console.log('🏥 Starting repository health check...\n');
    
    const results = {
      timestamp: new Date().toISOString(),
      overall: 'unknown',
      score: 0,
      maxScore: 0,
      checks: {}
    };

    try {
      // Run individual checks
      const checks = [
        { name: 'git', fn: this.checkGitHealth.bind(this) },
        { name: 'dependencies', fn: this.checkDependencies.bind(this) },
        { name: 'security', fn: this.checkSecurity.bind(this) },
        { name: 'codeQuality', fn: this.checkCodeQuality.bind(this) },
        { name: 'testing', fn: this.checkTesting.bind(this) },
        { name: 'documentation', fn: this.checkDocumentation.bind(this) },
        { name: 'performance', fn: this.checkPerformance.bind(this) },
        { name: 'maintenance', fn: this.checkMaintenance.bind(this) }
      ];

      for (const check of checks) {
        if (this.shouldRunCheck(check.name)) {
          console.log(`🔍 Running ${check.name} checks...`);
          try {
            const result = await check.fn();
            results.checks[check.name] = result;
            results.score += result.score || 0;
            results.maxScore += result.maxScore || 100;
          } catch (error) {
            console.error(`❌ ${check.name} check failed:`, error.message);
            results.checks[check.name] = {
              status: 'error',
              error: error.message,
              score: 0,
              maxScore: 100
            };
            results.maxScore += 100;
          }
        }
      }

      // Calculate overall status
      const percentage = results.maxScore > 0 ? (results.score / results.maxScore) * 100 : 0;
      results.overall = this.determineOverallStatus(percentage);
      results.percentage = Math.round(percentage);

      // Output results
      this.outputResults(results);

      // Exit with appropriate code
      if (this.failOnIssues && (results.overall === 'critical' || results.overall === 'poor')) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check if a specific check should run
   */
  shouldRunCheck(checkName) {
    if (this.checks === 'all') return true;
    return this.checks.includes(checkName);
  }

  /**
   * Check Git repository health
   */
  async checkGitHealth() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check if we're in a git repository
      execSync('git rev-parse --git-dir', { cwd: ROOT_DIR, stdio: 'pipe' });
      
      // Check for uncommitted changes
      const status = execSync('git status --porcelain', { 
        cwd: ROOT_DIR, 
        encoding: 'utf-8' 
      }).trim();
      
      if (status) {
        result.issues.push(`Uncommitted changes detected (${status.split('\n').length} files)`);
        result.score -= 10;
      } else {
        result.score += 20;
      }

      // Check recent activity
      const recentCommits = execSync('git log --oneline --since="30 days ago" | wc -l', {
        cwd: ROOT_DIR,
        encoding: 'utf-8'
      }).trim();
      
      result.metrics.recentCommits = parseInt(recentCommits);
      
      if (result.metrics.recentCommits > 10) {
        result.score += 20;
      } else if (result.metrics.recentCommits > 0) {
        result.score += 10;
      } else {
        result.issues.push('No recent commits (30 days)');
      }

      // Check branch protection (would need GitHub API in real implementation)
      result.score += 20; // Assume good for now

      // Check for large files
      try {
        const largeFiles = execSync('find . -name ".git" -prune -o -type f -size +10M -print', {
          cwd: ROOT_DIR,
          encoding: 'utf-8'
        }).trim();
        
        if (largeFiles) {
          result.issues.push(`Large files detected: ${largeFiles.split('\n').length}`);
          result.score -= 15;
        } else {
          result.score += 15;
        }
      } catch (error) {
        // Ignore error for large file check
      }

      // Check .gitignore exists
      if (existsSync(join(ROOT_DIR, '.gitignore'))) {
        result.score += 10;
      } else {
        result.issues.push('Missing .gitignore file');
      }

      // Final score and status
      result.score = Math.max(0, result.score);
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Git check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check dependencies health
   */
  async checkDependencies() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Find package.json files
      const packageFiles = this.findPackageJsonFiles();
      result.metrics.packageCount = packageFiles.length;

      let totalDeps = 0;
      let outdatedDeps = 0;
      let securityIssues = 0;

      for (const packageFile of packageFiles) {
        try {
          const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));
          
          // Count dependencies
          const deps = Object.keys(packageJson.dependencies || {});
          const devDeps = Object.keys(packageJson.devDependencies || {});
          totalDeps += deps.length + devDeps.length;

          // Check for outdated packages (simplified)
          try {
            const packageDir = dirname(packageFile);
            const outdated = execSync('npm outdated --json', {
              cwd: packageDir,
              encoding: 'utf-8'
            });
            
            const outdatedPackages = JSON.parse(outdated || '{}');
            outdatedDeps += Object.keys(outdatedPackages).length;
          } catch (error) {
            // npm outdated returns exit code 1 when packages are outdated
            if (error.stdout) {
              try {
                const outdatedPackages = JSON.parse(error.stdout);
                outdatedDeps += Object.keys(outdatedPackages).length;
              } catch {
                // Ignore parsing errors
              }
            }
          }

          // Check for security vulnerabilities
          try {
            const auditOutput = execSync('npm audit --json', {
              cwd: dirname(packageFile),
              encoding: 'utf-8'
            });
            
            const audit = JSON.parse(auditOutput);
            if (audit.metadata?.vulnerabilities) {
              securityIssues += audit.metadata.vulnerabilities.total || 0;
            }
          } catch (error) {
            // npm audit returns exit code when vulnerabilities found
            if (error.stdout) {
              try {
                const audit = JSON.parse(error.stdout);
                if (audit.metadata?.vulnerabilities) {
                  securityIssues += audit.metadata.vulnerabilities.total || 0;
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }

        } catch (error) {
          result.issues.push(`Failed to process ${packageFile}: ${error.message}`);
        }
      }

      result.metrics.totalDependencies = totalDeps;
      result.metrics.outdatedDependencies = outdatedDeps;
      result.metrics.securityVulnerabilities = securityIssues;

      // Score based on dependency health
      if (totalDeps > 0) {
        const outdatedPercentage = (outdatedDeps / totalDeps) * 100;
        
        if (outdatedPercentage === 0) result.score += 40;
        else if (outdatedPercentage < 10) result.score += 30;
        else if (outdatedPercentage < 25) result.score += 20;
        else result.issues.push(`${outdatedPercentage.toFixed(1)}% dependencies are outdated`);

        if (securityIssues === 0) {
          result.score += 40;
        } else {
          result.issues.push(`${securityIssues} security vulnerabilities found`);
          if (securityIssues > 10) result.score -= 20;
          else if (securityIssues > 5) result.score -= 10;
        }
      }

      // Check for package-lock.json files
      let lockFilesFound = 0;
      for (const packageFile of packageFiles) {
        const lockFile = join(dirname(packageFile), 'package-lock.json');
        if (existsSync(lockFile)) lockFilesFound++;
      }

      if (lockFilesFound === packageFiles.length) {
        result.score += 20;
      } else {
        result.issues.push(`Missing lock files for ${packageFiles.length - lockFilesFound} packages`);
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Dependencies check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check security posture
   */
  async checkSecurity() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check for security-sensitive files
      const sensitiveFiles = [
        '.env', '.env.local', '.env.production',
        'id_rsa', 'id_dsa', '*.pem', '*.key',
        'config/database.yml', 'config/secrets.yml'
      ];

      let foundSensitive = 0;
      for (const pattern of sensitiveFiles) {
        try {
          const found = execSync(`find . -name "${pattern}" -not -path "./.git/*" | wc -l`, {
            cwd: ROOT_DIR,
            encoding: 'utf-8'
          }).trim();
          foundSensitive += parseInt(found);
        } catch (error) {
          // Ignore errors for find command
        }
      }

      if (foundSensitive === 0) {
        result.score += 30;
      } else {
        result.issues.push(`${foundSensitive} potentially sensitive files found`);
        result.score -= foundSensitive * 10;
      }

      // Check for SECURITY.md
      if (existsSync(join(ROOT_DIR, 'SECURITY.md'))) {
        result.score += 20;
      } else {
        result.issues.push('Missing SECURITY.md file');
      }

      // Check for dependabot configuration
      const dependabotConfig = join(ROOT_DIR, '.github', 'dependabot.yml');
      if (existsSync(dependabotConfig)) {
        result.score += 15;
      } else {
        result.issues.push('Missing Dependabot configuration');
      }

      // Check for CodeQL or security scanning
      const workflowsDir = join(ROOT_DIR, '.github', 'workflows');
      let hasSecurityWorkflow = false;
      
      if (existsSync(workflowsDir)) {
        const workflows = readdirSync(workflowsDir);
        hasSecurityWorkflow = workflows.some(file => {
          if (extname(file) !== '.yml' && extname(file) !== '.yaml') return false;
          const content = readFileSync(join(workflowsDir, file), 'utf-8');
          return content.includes('github/codeql-action') || 
                 content.includes('security') || 
                 content.includes('snyk');
        });
      }

      if (hasSecurityWorkflow) {
        result.score += 20;
      } else {
        result.issues.push('No security scanning workflows detected');
      }

      // Check permissions in package.json scripts
      const rootPackage = join(ROOT_DIR, 'package.json');
      if (existsSync(rootPackage)) {
        const packageJson = JSON.parse(readFileSync(rootPackage, 'utf-8'));
        const scripts = packageJson.scripts || {};
        
        const dangerousPatterns = ['sudo', 'rm -rf', 'curl | sh', 'wget | sh'];
        let dangerousScripts = 0;
        
        for (const [scriptName, script] of Object.entries(scripts)) {
          for (const pattern of dangerousPatterns) {
            if (script.includes(pattern)) {
              dangerousScripts++;
              break;
            }
          }
        }

        if (dangerousScripts === 0) {
          result.score += 15;
        } else {
          result.issues.push(`${dangerousScripts} potentially dangerous script patterns found`);
          result.score -= dangerousScripts * 5;
        }
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      result.metrics.sensitiveFiles = foundSensitive;
      result.metrics.hasSecurityWorkflow = hasSecurityWorkflow;

      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Security check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check code quality metrics
   */
  async checkCodeQuality() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check for linting configuration
      const lintConfigs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml', 'eslint.config.js'];
      const hasLintConfig = lintConfigs.some(config => existsSync(join(ROOT_DIR, config)));
      
      if (hasLintConfig) {
        result.score += 20;
      } else {
        result.issues.push('No ESLint configuration found');
      }

      // Check for TypeScript configuration
      if (existsSync(join(ROOT_DIR, 'tsconfig.json'))) {
        result.score += 15;
      } else {
        result.issues.push('No TypeScript configuration found');
      }

      // Check for Prettier configuration
      const prettierConfigs = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'];
      const hasPrettierConfig = prettierConfigs.some(config => existsSync(join(ROOT_DIR, config)));
      
      if (hasPrettierConfig) {
        result.score += 10;
      }

      // Count code files and estimate complexity
      const codeStats = this.analyzeCodebase();
      result.metrics = { ...result.metrics, ...codeStats };

      // Score based on code organization
      if (codeStats.totalFiles > 0) {
        const avgLinesPerFile = codeStats.totalLines / codeStats.totalFiles;
        
        if (avgLinesPerFile < 200) {
          result.score += 20;
        } else if (avgLinesPerFile < 400) {
          result.score += 15;
        } else if (avgLinesPerFile < 600) {
          result.score += 10;
        } else {
          result.issues.push(`Large files detected (avg ${Math.round(avgLinesPerFile)} lines/file)`);
        }

        // Check for test coverage
        if (codeStats.testFiles > codeStats.sourceFiles * 0.5) {
          result.score += 20;
        } else if (codeStats.testFiles > codeStats.sourceFiles * 0.25) {
          result.score += 15;
        } else {
          result.issues.push('Low test coverage based on file count');
        }
      }

      // Check for pre-commit hooks
      const preCommitHook = join(ROOT_DIR, '.git', 'hooks', 'pre-commit');
      const huskyDir = join(ROOT_DIR, '.husky');
      
      if (existsSync(preCommitHook) || existsSync(huskyDir)) {
        result.score += 15;
      } else {
        result.issues.push('No pre-commit hooks configured');
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Code quality check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check testing setup and coverage
   */
  async checkTesting() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check for test configuration
      const testConfigs = ['vitest.config.ts', 'jest.config.js', 'test/setup.ts'];
      const hasTestConfig = testConfigs.some(config => existsSync(join(ROOT_DIR, config)));
      
      if (hasTestConfig) {
        result.score += 25;
      } else {
        result.issues.push('No test configuration found');
      }

      // Check for test scripts in package.json
      const rootPackage = join(ROOT_DIR, 'package.json');
      if (existsSync(rootPackage)) {
        const packageJson = JSON.parse(readFileSync(rootPackage, 'utf-8'));
        const scripts = packageJson.scripts || {};
        
        const testScripts = Object.keys(scripts).filter(name => 
          name.includes('test') || name.includes('spec')
        );
        
        if (testScripts.length > 0) {
          result.score += 25;
          result.metrics.testScripts = testScripts.length;
        } else {
          result.issues.push('No test scripts found in package.json');
        }
      }

      // Run tests to check if they pass
      try {
        console.log('  Running tests...');
        execSync('npm test', { 
          cwd: ROOT_DIR, 
          stdio: this.verbose ? 'inherit' : 'pipe',
          timeout: 30000 // 30 second timeout
        });
        result.score += 30;
        result.metrics.testsPass = true;
      } catch (error) {
        result.issues.push('Tests are failing');
        result.metrics.testsPass = false;
      }

      // Check test file coverage
      const codeStats = this.analyzeCodebase();
      if (codeStats.testFiles > 0) {
        result.score += 20;
        result.metrics.testFiles = codeStats.testFiles;
        
        const testCoverage = (codeStats.testFiles / codeStats.sourceFiles) * 100;
        result.metrics.testCoverageByFiles = Math.round(testCoverage);
        
        if (testCoverage < 25) {
          result.issues.push(`Low test file coverage (${Math.round(testCoverage)}%)`);
        }
      } else {
        result.issues.push('No test files found');
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Testing check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check documentation quality
   */
  async checkDocumentation() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check for essential files
      const essentialDocs = [
        { file: 'README.md', points: 30 },
        { file: 'CONTRIBUTING.md', points: 15 },
        { file: 'CODE_OF_CONDUCT.md', points: 10 },
        { file: 'LICENSE', points: 15 },
        { file: 'SECURITY.md', points: 10 }
      ];

      let foundDocs = 0;
      for (const doc of essentialDocs) {
        if (existsSync(join(ROOT_DIR, doc.file))) {
          result.score += doc.points;
          foundDocs++;
        } else {
          result.issues.push(`Missing ${doc.file}`);
        }
      }

      result.metrics.essentialDocsFound = foundDocs;
      result.metrics.essentialDocsTotal = essentialDocs.length;

      // Check README quality
      const readmePath = join(ROOT_DIR, 'README.md');
      if (existsSync(readmePath)) {
        const readme = readFileSync(readmePath, 'utf-8');
        const readmeScore = this.analyzeReadme(readme);
        result.score += readmeScore.score;
        if (readmeScore.issues.length > 0) {
          result.issues.push(...readmeScore.issues);
        }
        result.metrics.readmeAnalysis = readmeScore;
      }

      // Check for docs directory
      const docsDir = join(ROOT_DIR, 'docs');
      if (existsSync(docsDir)) {
        const docFiles = this.countMarkdownFiles(docsDir);
        if (docFiles > 0) {
          result.score += Math.min(10, docFiles * 2);
          result.metrics.additionalDocs = docFiles;
        }
      } else {
        result.issues.push('No docs directory found');
      }

      // Check for inline documentation
      const codeStats = this.analyzeCodebase();
      if (codeStats.commentLines > codeStats.codeLines * 0.1) {
        result.score += 10;
      } else {
        result.issues.push('Low inline documentation coverage');
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Documentation check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check performance-related metrics
   */
  async checkPerformance() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check build performance
      try {
        console.log('  Running build...');
        const buildStart = Date.now();
        execSync('npm run build', { 
          cwd: ROOT_DIR, 
          stdio: this.verbose ? 'inherit' : 'pipe',
          timeout: 120000 // 2 minute timeout
        });
        const buildTime = Date.now() - buildStart;
        result.metrics.buildTimeMs = buildTime;
        
        if (buildTime < 30000) { // < 30 seconds
          result.score += 30;
        } else if (buildTime < 60000) { // < 1 minute
          result.score += 20;
        } else if (buildTime < 120000) { // < 2 minutes
          result.score += 10;
        } else {
          result.issues.push(`Build time is slow (${Math.round(buildTime/1000)}s)`);
        }
      } catch (error) {
        result.issues.push('Build failed');
      }

      // Check test performance
      try {
        const testStart = Date.now();
        execSync('npm test', { 
          cwd: ROOT_DIR, 
          stdio: 'pipe',
          timeout: 60000 // 1 minute timeout
        });
        const testTime = Date.now() - testStart;
        result.metrics.testTimeMs = testTime;
        
        if (testTime < 10000) { // < 10 seconds
          result.score += 25;
        } else if (testTime < 30000) { // < 30 seconds
          result.score += 15;
        } else {
          result.issues.push(`Test suite is slow (${Math.round(testTime/1000)}s)`);
          result.score += 5;
        }
      } catch (error) {
        // Tests might have failed in earlier check, don't penalize again
      }

      // Check repository size
      try {
        const repoSize = execSync('du -sb . | cut -f1', {
          cwd: ROOT_DIR,
          encoding: 'utf-8'
        }).trim();
        
        const sizeInMB = parseInt(repoSize) / (1024 * 1024);
        result.metrics.repositorySizeMB = Math.round(sizeInMB);
        
        if (sizeInMB < 50) {
          result.score += 20;
        } else if (sizeInMB < 100) {
          result.score += 15;
        } else if (sizeInMB < 200) {
          result.score += 10;
        } else {
          result.issues.push(`Repository is large (${Math.round(sizeInMB)}MB)`);
        }
      } catch (error) {
        // Ignore size check errors
      }

      // Check node_modules size
      const nodeModulesDir = join(ROOT_DIR, 'node_modules');
      if (existsSync(nodeModulesDir)) {
        try {
          const nodeModulesSize = execSync(`du -sb "${nodeModulesDir}" | cut -f1`, {
            cwd: ROOT_DIR,
            encoding: 'utf-8'
          }).trim();
          
          const sizeInMB = parseInt(nodeModulesSize) / (1024 * 1024);
          result.metrics.nodeModulesSizeMB = Math.round(sizeInMB);
          
          if (sizeInMB < 200) {
            result.score += 15;
          } else if (sizeInMB > 500) {
            result.issues.push(`node_modules is very large (${Math.round(sizeInMB)}MB)`);
          }
        } catch (error) {
          // Ignore node_modules size check errors
        }
      }

      // Check for performance monitoring
      const rootPackage = join(ROOT_DIR, 'package.json');
      if (existsSync(rootPackage)) {
        const packageJson = JSON.parse(readFileSync(rootPackage, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const perfTools = ['lighthouse', 'web-vitals', 'clinic', 'autocannon', 'benchmark'];
        const hasPerfTools = perfTools.some(tool => deps[tool]);
        
        if (hasPerfTools) {
          result.score += 10;
        }
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Performance check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check maintenance and project health
   */
  async checkMaintenance() {
    const result = {
      status: 'good',
      score: 0,
      maxScore: 100,
      issues: [],
      metrics: {}
    };

    try {
      // Check for CI/CD configuration
      const ciConfigs = [
        '.github/workflows',
        '.gitlab-ci.yml',
        'azure-pipelines.yml',
        '.travis.yml',
        'Jenkinsfile'
      ];
      
      const hasCIConfig = ciConfigs.some(config => existsSync(join(ROOT_DIR, config)));
      if (hasCIConfig) {
        result.score += 25;
      } else {
        result.issues.push('No CI/CD configuration found');
      }

      // Check for automated dependency updates
      const dependabotConfig = join(ROOT_DIR, '.github', 'dependabot.yml');
      const renovateConfig = join(ROOT_DIR, 'renovate.json');
      
      if (existsSync(dependabotConfig) || existsSync(renovateConfig)) {
        result.score += 15;
      } else {
        result.issues.push('No automated dependency updates configured');
      }

      // Check recent activity
      try {
        const lastCommit = execSync('git log -1 --format=%ct', {
          cwd: ROOT_DIR,
          encoding: 'utf-8'
        }).trim();
        
        const daysSinceLastCommit = (Date.now() / 1000 - parseInt(lastCommit)) / (24 * 60 * 60);
        result.metrics.daysSinceLastCommit = Math.round(daysSinceLastCommit);
        
        if (daysSinceLastCommit < 7) {
          result.score += 20;
        } else if (daysSinceLastCommit < 30) {
          result.score += 15;
        } else if (daysSinceLastCommit < 90) {
          result.score += 10;
        } else {
          result.issues.push(`Last commit was ${Math.round(daysSinceLastCommit)} days ago`);
        }
      } catch (error) {
        result.issues.push('Could not determine last commit date');
      }

      // Check for issue and PR templates
      const templateDirs = ['.github/ISSUE_TEMPLATE', '.github/pull_request_template.md'];
      const hasTemplates = templateDirs.some(template => existsSync(join(ROOT_DIR, template)));
      
      if (hasTemplates) {
        result.score += 15;
      } else {
        result.issues.push('No issue or PR templates found');
      }

      // Check for release automation
      const releaseConfigs = [
        '.github/workflows/release.yml',
        '.github/workflows/publish.yml',
        'release.config.js'
      ];
      
      const hasReleaseConfig = releaseConfigs.some(config => existsSync(join(ROOT_DIR, config)));
      if (hasReleaseConfig) {
        result.score += 15;
      }

      // Check package.json maintenance fields
      const rootPackage = join(ROOT_DIR, 'package.json');
      if (existsSync(rootPackage)) {
        const packageJson = JSON.parse(readFileSync(rootPackage, 'utf-8'));
        
        if (packageJson.engines) {
          result.score += 5;
        }
        
        if (packageJson.repository) {
          result.score += 5;
        }
      }

      // Final scoring
      result.score = Math.max(0, result.score);
      
      if (result.score >= 80) result.status = 'excellent';
      else if (result.score >= 60) result.status = 'good';
      else if (result.score >= 40) result.status = 'fair';
      else result.status = 'poor';

    } catch (error) {
      result.status = 'error';
      result.issues.push(`Maintenance check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Helper methods
   */

  findPackageJsonFiles() {
    const packages = [];
    
    // Root package.json
    const rootPackage = join(ROOT_DIR, 'package.json');
    if (existsSync(rootPackage)) {
      packages.push(rootPackage);
    }

    // Packages in packages/ directory
    try {
      const entries = execSync('find packages -name "package.json" -type f 2>/dev/null || true', {
        cwd: ROOT_DIR,
        encoding: 'utf-8'
      }).trim().split('\n').filter(Boolean);
      
      packages.push(...entries.map(entry => join(ROOT_DIR, entry)));
    } catch (error) {
      // Ignore errors
    }

    return packages;
  }

  analyzeCodebase() {
    const stats = {
      totalFiles: 0,
      sourceFiles: 0,
      testFiles: 0,
      totalLines: 0,
      codeLines: 0,
      commentLines: 0
    };

    try {
      const extensions = ['js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs'];
      
      for (const ext of extensions) {
        try {
          const files = execSync(`find . -name "*.${ext}" -not -path "./node_modules/*" -not -path "./.git/*" -type f`, {
            cwd: ROOT_DIR,
            encoding: 'utf-8'
          }).trim().split('\n').filter(Boolean);

          for (const file of files) {
            const filePath = join(ROOT_DIR, file);
            if (existsSync(filePath)) {
              try {
                const content = readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');
                
                stats.totalFiles++;
                stats.totalLines += lines.length;
                
                if (file.includes('test') || file.includes('spec') || file.includes('__tests__')) {
                  stats.testFiles++;
                } else {
                  stats.sourceFiles++;
                }

                // Simple comment and code line counting
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    stats.commentLines++;
                  } else if (trimmed.length > 0) {
                    stats.codeLines++;
                  }
                }
              } catch (error) {
                // Ignore file reading errors
              }
            }
          }
        } catch (error) {
          // Ignore find command errors
        }
      }
    } catch (error) {
      // Ignore general errors
    }

    return stats;
  }

  analyzeReadme(content) {
    const analysis = {
      score: 0,
      issues: []
    };

    const sections = [
      'description',
      'installation',
      'usage',
      'api',
      'contributing',
      'license'
    ];

    const lowerContent = content.toLowerCase();
    
    for (const section of sections) {
      if (lowerContent.includes(section)) {
        analysis.score += 2;
      } else {
        analysis.issues.push(`README missing ${section} section`);
      }
    }

    // Check for badges
    if (content.includes('[![') || content.includes('[!')) {
      analysis.score += 3;
    }

    // Check for code examples
    if (content.includes('```')) {
      analysis.score += 3;
    }

    return analysis;
  }

  countMarkdownFiles(dir) {
    try {
      const files = execSync(`find "${dir}" -name "*.md" -type f | wc -l`, {
        cwd: ROOT_DIR,
        encoding: 'utf-8'
      }).trim();
      return parseInt(files) || 0;
    } catch (error) {
      return 0;
    }
  }

  determineOverallStatus(percentage) {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 60) return 'fair';
    if (percentage >= 40) return 'poor';
    return 'critical';
  }

  outputResults(results) {
    if (this.outputFormat === 'json') {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (this.outputFormat === 'markdown') {
      this.outputMarkdown(results);
      return;
    }

    // Console output
    console.log('\n🏥 Repository Health Check Results');
    console.log('==================================');
    console.log(`Overall Status: ${this.getStatusEmoji(results.overall)} ${results.overall.toUpperCase()}`);
    console.log(`Health Score: ${results.score}/${results.maxScore} (${results.percentage}%)`);
    console.log(`Timestamp: ${results.timestamp}\n`);

    for (const [checkName, result] of Object.entries(results.checks)) {
      console.log(`${this.getStatusEmoji(result.status)} ${checkName}: ${result.status.toUpperCase()} (${result.score || 0}/${result.maxScore || 100})`);
      
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
      }
      
      if (this.verbose && result.metrics) {
        console.log(`   📊 Metrics:`, result.metrics);
      }
      
      console.log('');
    }
  }

  outputMarkdown(results) {
    let md = '# Repository Health Check Results\n\n';
    md += `**Overall Status:** ${results.overall.toUpperCase()}\n`;
    md += `**Health Score:** ${results.score}/${results.maxScore} (${results.percentage}%)\n`;
    md += `**Timestamp:** ${results.timestamp}\n\n`;

    md += '## Check Results\n\n';
    
    for (const [checkName, result] of Object.entries(results.checks)) {
      md += `### ${checkName}\n`;
      md += `**Status:** ${result.status.toUpperCase()}\n`;
      md += `**Score:** ${result.score || 0}/${result.maxScore || 100}\n\n`;
      
      if (result.issues && result.issues.length > 0) {
        md += '**Issues:**\n';
        result.issues.forEach(issue => md += `- ${issue}\n`);
        md += '\n';
      }
      
      if (result.metrics) {
        md += '**Metrics:**\n';
        for (const [key, value] of Object.entries(result.metrics)) {
          md += `- ${key}: ${value}\n`;
        }
        md += '\n';
      }
    }

    console.log(md);
  }

  getStatusEmoji(status) {
    const emojis = {
      excellent: '🟢',
      good: '🟢',
      fair: '🟡',
      poor: '🟠',
      critical: '🔴',
      error: '❌',
      unknown: '⚪'
    };
    return emojis[status] || '⚪';
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
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--checks':
      case '-c':
        options.checks = args[++i].split(',');
        break;
      case '--no-fail':
        options.failOnIssues = false;
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
Repository Health Check Tool
===========================

Usage: node health-check.mjs [options]

Options:
  -v, --verbose         Show detailed output including metrics
  -f, --format FORMAT   Output format: console, json, markdown (default: console)
  -c, --checks CHECKS   Comma-separated list of checks to run:
                        git, dependencies, security, codeQuality, testing,
                        documentation, performance, maintenance
                        (default: all)
  --no-fail             Don't exit with error code on issues
  -h, --help            Show this help message

Examples:
  node health-check.mjs                           # Run all checks
  node health-check.mjs --verbose                 # Run with detailed output
  node health-check.mjs --format json             # Output as JSON
  node health-check.mjs --checks security,deps    # Run only security and dependency checks
  node health-check.mjs --format markdown > report.md  # Generate markdown report

Exit Codes:
  0 - Health check passed or no critical issues
  1 - Critical issues found or health check failed
`);
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    const checker = new RepositoryHealthChecker(options);
    
    await checker.runHealthChecks();
  } catch (error) {
    console.error('Health check failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}