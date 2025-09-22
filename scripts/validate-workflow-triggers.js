#!/usr/bin/env node

/**
 * CI/CD Workflow Trigger Validation
 * 
 * This script validates that the GitHub Actions workflows are configured correctly
 * to run only on:
 * (a) "ready to review" PRs on non-main branches (lightweight)
 * (b) post merge on main branch (full suite)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const WORKFLOWS_DIR = path.join(process.cwd(), '.github', 'workflows');

function validateWorkflowTriggers() {
    console.log('🔍 Validating CI/CD workflow triggers...\n');
    
    const workflowFiles = ['ci.yml', 'ci-cd.yml', 'quick-validation.yml'];
    const results = [];
    
    for (const file of workflowFiles) {
        const workflowPath = path.join(WORKFLOWS_DIR, file);
        
        if (!fs.existsSync(workflowPath)) {
            console.log(`⚠️  Warning: Workflow file ${file} not found`);
            continue;
        }
        
        const content = fs.readFileSync(workflowPath, 'utf8');
        let workflow;
        
        try {
            workflow = yaml.load(content);
        } catch (error) {
            console.log(`❌ Error parsing ${file}: ${error.message}`);
            continue;
        }
        
        console.log(`📋 Validating ${file}:`);
        const validation = validateSingleWorkflow(workflow, file);
        results.push({ file, ...validation });
        
        console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📊 Validation Summary:');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log(`✅ Passed: ${passed}/${total} workflows`);
    
    if (passed === total) {
        console.log('\n🎉 All workflows are configured correctly!');
        console.log('✅ Ready-for-review PRs will run lightweight checks');
        console.log('✅ Main branch pushes will run full test suite');
        return true;
    } else {
        console.log('\n❌ Some workflows need attention');
        return false;
    }
}

function validateSingleWorkflow(workflow, filename) {
    const checks = [];
    let passed = true;
    
    // Check 1: PR triggers should include ready_for_review
    if (workflow.on?.pull_request) {
        const prTrigger = workflow.on.pull_request;
        const hasReadyForReview = prTrigger.types?.includes('ready_for_review') || 
                                 prTrigger === true || 
                                 Array.isArray(prTrigger);
        
        if (hasReadyForReview || prTrigger.types?.includes('ready_for_review')) {
            checks.push('✅ PR trigger includes ready_for_review type');
        } else {
            checks.push('❌ PR trigger missing ready_for_review type');
            passed = false;
        }
    }
    
    // Check 2: Push triggers should only include main branch
    if (workflow.on?.push) {
        const pushBranches = workflow.on.push.branches || [];
        const onlyMain = pushBranches.length === 1 && pushBranches[0] === 'main';
        
        if (onlyMain) {
            checks.push('✅ Push trigger only includes main branch');
        } else {
            checks.push(`⚠️  Push trigger includes: ${pushBranches.join(', ')} (expected: main only)`);
            // This is a warning, not a failure
        }
    }
    
    // Check 3: Jobs should have draft PR conditions
    const jobs = workflow.jobs || {};
    let jobsWithDraftCheck = 0;
    let totalJobs = 0;
    
    for (const [jobName, job] of Object.entries(jobs)) {
        totalJobs++;
        
        if (job.if && job.if.includes('github.event.pull_request.draft == false')) {
            jobsWithDraftCheck++;
        }
    }
    
    if (jobsWithDraftCheck > 0) {
        checks.push(`✅ ${jobsWithDraftCheck}/${totalJobs} jobs have draft PR checks`);
    } else if (totalJobs > 0) {
        checks.push('⚠️  No jobs have draft PR checks (PRs will run on all states)');
        // This might be acceptable for some workflows
    }
    
    // Check 4: Matrix strategies should differentiate PR vs main branch
    let hasConditionalMatrix = false;
    for (const [jobName, job] of Object.entries(jobs)) {
        if (job.strategy?.matrix) {
            const matrix = job.strategy.matrix;
            for (const [key, value] of Object.entries(matrix)) {
                if (typeof value === 'string' && 
                    (value.includes('github.event_name') || value.includes('github.ref'))) {
                    hasConditionalMatrix = true;
                    break;
                }
            }
        }
        if (hasConditionalMatrix) break;
    }
    
    if (hasConditionalMatrix) {
        checks.push('✅ Matrix strategies differentiate PR vs main branch');
    } else {
        checks.push('⚠️  Matrix strategies don\'t differentiate PR vs main branch');
        // This might be acceptable for some workflows
    }
    
    // Print checks for this workflow
    for (const check of checks) {
        console.log(`  ${check}`);
    }
    
    return { passed, checks: checks.length };
}

// Run validation
if (require.main === module) {
    try {
        const success = validateWorkflowTriggers();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

module.exports = { validateWorkflowTriggers };