import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

describe('CI/CD Pipeline Configuration', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/ci-cd.yml');
  const quickValidationPath = join(process.cwd(), '.github/workflows/quick-validation.yml');
  
  it('should have CI/CD workflow file', () => {
    expect(existsSync(workflowPath)).toBe(true);
  });
  
  it('should have valid YAML syntax', () => {
    const content = readFileSync(workflowPath, 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });
  
  it('should have all required jobs', () => {
    const content = readFileSync(workflowPath, 'utf8');
    const workflow = yaml.load(content) as any;
    
    const expectedJobs = [
      'lint-and-format',
      'security-audit',
      'unit-tests',
      'integration-tests',
      'performance-tests',
      'build',
      'quality-gates',
      'e2e-tests',
      'prepare-release',
      'deploy-npm',
      'deploy-vscode',
      'notify-completion'
    ];
    
    expectedJobs.forEach(job => {
      expect(workflow.jobs[job]).toBeDefined();
    });
  });
  
  it('should have multi-platform matrix for unit tests', () => {
    const content = readFileSync(workflowPath, 'utf8');
    const workflow = yaml.load(content) as any;
    
    expect(workflow.jobs['unit-tests'].strategy.matrix.os).toEqual([
      'ubuntu-latest',
      'windows-latest',
      'macos-latest'
    ]);
    
    expect(workflow.jobs['unit-tests'].strategy.matrix['node-version']).toEqual([
      18, 20, 22
    ]);
  });
  
  it('should have proper job dependencies', () => {
    const content = readFileSync(workflowPath, 'utf8');
    const workflow = yaml.load(content) as any;
    
    expect(workflow.jobs['unit-tests'].needs).toContain('lint-and-format');
    expect(workflow.jobs['integration-tests'].needs).toContain('unit-tests');
    expect(workflow.jobs['quality-gates'].needs).toContain('unit-tests');
    expect(workflow.jobs['e2e-tests'].needs).toContain('quality-gates');
  });
  
  it('should trigger on correct events', () => {
    const content = readFileSync(workflowPath, 'utf8');
    const workflow = yaml.load(content) as any;
    
    expect(workflow.on.push.branches).toContain('main');
    expect(workflow.on.pull_request.branches).toContain('main');
    expect(workflow.on.release.types).toContain('published');
  });
  
  it('should have quick validation workflow', () => {
    expect(existsSync(quickValidationPath)).toBe(true);
    
    const content = readFileSync(quickValidationPath, 'utf8');
    const workflow = yaml.load(content) as any;
    
    expect(workflow.jobs['quick-check']).toBeDefined();
  });
});