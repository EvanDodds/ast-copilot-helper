#!/usr/bin/env node

/**
 * Coverage Threshold Checker
 * Validates code coverage against specified thresholds
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CoverageReport {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
}

interface CoverageThresholds {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
  global: number;
}

class CoverageChecker {
  private thresholds: CoverageThresholds;
  
  constructor(thresholds: CoverageThresholds) {
    this.thresholds = thresholds;
  }
  
  checkCoverage(): boolean {
    const coverageFile = join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    if (!existsSync(coverageFile)) {
      console.error('❌ Coverage report not found. Run tests with coverage first.');
      return false;
    }
    
    try {
      const coverage = JSON.parse(readFileSync(coverageFile, 'utf8')) as CoverageReport;
      const { total } = coverage;
      
      console.log('📊 Coverage Report:');
      console.log(`  Lines:      ${total.lines.pct.toFixed(2)}%`);
      console.log(`  Statements: ${total.statements.pct.toFixed(2)}%`);
      console.log(`  Functions:  ${total.functions.pct.toFixed(2)}%`);
      console.log(`  Branches:   ${total.branches.pct.toFixed(2)}%`);
      
      const checks = [
        { name: 'Lines', actual: total.lines.pct, threshold: this.thresholds.lines },
        { name: 'Statements', actual: total.statements.pct, threshold: this.thresholds.statements },
        { name: 'Functions', actual: total.functions.pct, threshold: this.thresholds.functions },
        { name: 'Branches', actual: total.branches.pct, threshold: this.thresholds.branches },
      ];
      
      let allPassed = true;
      console.log('\n🎯 Coverage Thresholds:');
      
      for (const check of checks) {
        const passed = check.actual >= check.threshold;
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${check.name}: ${check.actual.toFixed(2)}% (required: ${check.threshold}%)`);
        if (!passed) allPassed = false;
      }
      
      // Global threshold check
      const globalCoverage = (total.lines.pct + total.statements.pct + total.functions.pct + total.branches.pct) / 4;
      const globalPassed = globalCoverage >= this.thresholds.global;
      const globalStatus = globalPassed ? '✅' : '❌';
      console.log(`  ${globalStatus} Global: ${globalCoverage.toFixed(2)}% (required: ${this.thresholds.global}%)`);
      
      if (!globalPassed) allPassed = false;
      
      console.log(`\n${allPassed ? '✅' : '❌'} Coverage check ${allPassed ? 'passed' : 'failed'}`);
      
      return allPassed;
      
    } catch (error) {
      console.error('❌ Error reading coverage report:', error);
      return false;
    }
  }
}

// CLI Interface
const args = process.argv.slice(2);
const thresholdArg = args.find(arg => arg.startsWith('--threshold='));
const globalThreshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 80;

const thresholds: CoverageThresholds = {
  lines: globalThreshold,
  statements: globalThreshold,
  functions: globalThreshold,
  branches: Math.max(globalThreshold - 10, 60), // Branches often harder to achieve
  global: globalThreshold
};

const checker = new CoverageChecker(thresholds);
const passed = checker.checkCoverage();

process.exit(passed ? 0 : 1);