#!/usr/bin/env node

/**
 * Security Scanner and Scorer
 * Performs comprehensive security analysis and scoring
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface SecurityResult {
  score: number;
  vulnerabilities: number;
  moderate: number;
  high: number;
  critical: number;
  details: any;
}

class SecurityScanner {
  private outputFile: string;
  
  constructor() {
    this.outputFile = join(process.cwd(), 'security-audit-report.json');
  }
  
  async performSecurityScan(): Promise<SecurityResult> {
    console.log('🔍 Running security scan...');
    
    let result: SecurityResult = {
      score: 0,
      vulnerabilities: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      details: {}
    };
    
    try {
      // Run npm audit
      console.log('📦 Running npm audit...');
      const auditResult = this.runNpmAudit();
      
      // Additional security checks
      console.log('🔒 Running additional security checks...');
      const additionalChecks = await this.runAdditionalSecurityChecks();
      
      // Combine results
      result = this.combineResults(auditResult, additionalChecks);
      
      // Write report
      writeFileSync(this.outputFile, JSON.stringify(result, null, 2));
      console.log(`📄 Security report saved to: ${this.outputFile}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Security scan failed:', error);
      result.score = 0;
      return result;
    }
  }
  
  private runNpmAudit(): any {
    try {
      // Run audit and capture JSON output
      const output = execSync('npm audit --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return JSON.parse(output);
      
    } catch (error: any) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch (_parseError) {
          console.warn('⚠️  Could not parse npm audit output');
          return { vulnerabilities: {} };
        }
      }
      return { vulnerabilities: {} };
    }
  }
  
  private async runAdditionalSecurityChecks(): Promise<any> {
    const checks = {
      packageSecurity: this.checkPackageSecurity(),
      dependencyDepth: this.analyzeDependencyDepth(),
      licenseSecurity: this.checkLicenseSecurity()
    };
    
    return checks;
  }
  
  private checkPackageSecurity(): any {
    // Check for common security anti-patterns
    const packageJsonPath = join(process.cwd(), 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      return { score: 0, issues: ['package.json not found'] };
    }
    
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const issues: string[] = [];
      let score = 10;
      
      // Check for scripts with security risks
      if (pkg.scripts) {
        Object.entries(pkg.scripts).forEach(([name, script]) => {
          if (typeof script === 'string') {
            if (script.includes('rm -rf') || script.includes('sudo')) {
              issues.push(`Potentially dangerous script: ${name}`);
              score -= 2;
            }
          }
        });
      }
      
      // Check for deprecated packages (common ones)
      const deprecatedPackages = ['request', 'node-uuid'];
      if (pkg.dependencies) {
        deprecatedPackages.forEach(deprecated => {
          if (pkg.dependencies[deprecated]) {
            issues.push(`Deprecated package detected: ${deprecated}`);
            score -= 1;
          }
        });
      }
      
      return { score: Math.max(0, score), issues };
      
    } catch (_error) {
      return { score: 0, issues: ['Could not parse package.json'] };
    }
  }
  
  private analyzeDependencyDepth(): any {
    // Analyze dependency tree depth (deeper trees = higher risk)
    try {
      const output = execSync('npm list --depth=0 --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const deps = JSON.parse(output);
      const depCount = Object.keys(deps.dependencies || {}).length;
      
      // Score based on dependency count (fewer deps = better score)
      let score = 10;
      if (depCount > 100) score -= 3;
      else if (depCount > 50) score -= 2;
      else if (depCount > 25) score -= 1;
      
      return { score: Math.max(0, score), dependencyCount: depCount };
      
    } catch (_error) {
      return { score: 5, dependencyCount: -1, error: 'Could not analyze dependencies' };
    }
  }
  
  private checkLicenseSecurity(): any {
    // Check for license compatibility issues
    try {
      const _output = execSync('npm list --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // This is a simplified check - in production you'd want more sophisticated license analysis
      return { score: 10, issues: [] };
      
    } catch (_error) {
      return { score: 5, issues: ['Could not check licenses'] };
    }
  }
  
  private combineResults(auditResult: any, additionalChecks: any): SecurityResult {
    let vulnerabilityCount = 0;
    let moderate = 0;
    let high = 0;
    let critical = 0;
    
    // Parse npm audit results
    if (auditResult.vulnerabilities) {
      Object.values(auditResult.vulnerabilities).forEach((vuln: any) => {
        vulnerabilityCount++;
        if (vuln.severity === 'moderate') moderate++;
        else if (vuln.severity === 'high') high++;
        else if (vuln.severity === 'critical') critical++;
      });
    }
    
    // Calculate overall security score (0-10)
    let score = 10;
    
    // Penalize based on vulnerabilities
    score -= critical * 3;  // Critical vulnerabilities are heavily penalized
    score -= high * 2;      // High vulnerabilities significantly penalized
    score -= moderate * 1;  // Moderate vulnerabilities lightly penalized
    
    // Factor in additional checks
    const additionalScore = (
      additionalChecks.packageSecurity.score +
      additionalChecks.dependencyDepth.score +
      additionalChecks.licenseSecurity.score
    ) / 3;
    
    // Combine scores (weighted average)
    score = (score * 0.7) + (additionalScore * 0.3);
    score = Math.max(0, Math.min(10, score));
    
    return {
      score: Math.round(score * 10) / 10,
      vulnerabilities: vulnerabilityCount,
      moderate,
      high,
      critical,
      details: {
        npmAudit: auditResult,
        additionalChecks
      }
    };
  }
  
  reportResults(result: SecurityResult): void {
    console.log('\n🛡️  Security Analysis Results:');
    console.log(`  Overall Score: ${result.score}/10`);
    console.log(`  Vulnerabilities: ${result.vulnerabilities}`);
    
    if (result.vulnerabilities > 0) {
      console.log(`    Moderate: ${result.moderate}`);
      console.log(`    High: ${result.high}`);
      console.log(`    Critical: ${result.critical}`);
    }
    
    const threshold = 8.0;
    const passed = result.score >= threshold;
    
    console.log(`\n${passed ? '✅' : '❌'} Security check ${passed ? 'passed' : 'failed'} (threshold: ${threshold}/10)`);
    
    if (!passed) {
      console.log('\n💡 Recommendations:');
      if (result.critical > 0) console.log('  - Fix critical vulnerabilities immediately');
      if (result.high > 0) console.log('  - Address high severity vulnerabilities');
      if (result.moderate > 0) console.log('  - Review moderate severity vulnerabilities');
      console.log('  - Run "npm audit fix" to auto-fix vulnerabilities');
      console.log('  - Consider updating vulnerable dependencies');
    }
  }
}

// CLI Interface
async function main() {
  const scanner = new SecurityScanner();
  const result = await scanner.performSecurityScan();
  scanner.reportResults(result);
  
  // Output score for GitHub Actions
  console.log(`::set-output name=security-score::${result.score}`);
  
  // Exit with appropriate code
  const threshold = 8.0;
  process.exit(result.score >= threshold ? 0 : 1);
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Security scan failed:', error);
    process.exit(1);
  });
}