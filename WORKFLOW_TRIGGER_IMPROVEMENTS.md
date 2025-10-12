# GitHub Actions Workflow Trigger Improvements

**Date:** October 11, 2025  
**Purpose:** Ensure all workflows trigger at appropriate times based on their purpose

## Summary of Changes

This document outlines the improvements made to GitHub Actions workflow triggers to ensure they run at the proper times and don't waste CI resources on draft PRs or inappropriate events.

---

## Issues Fixed

### 1. CI/CD Pipeline (`ci.yml`)

**Problem:**

- Only triggered on `ready_for_review` and `synchronize` events
- Would NOT trigger when a non-draft PR was first opened
- Would NOT trigger when a PR was reopened

**Fix:**

- Added `opened` and `reopened` to the `types` list
- Now triggers on: `[opened, synchronize, reopened, ready_for_review]`
- The existing job-level condition `if: github.event.pull_request.draft == false` properly filters out draft PRs

**Impact:** ✅ CI now runs on all non-draft PR events as expected

---

### 2. Performance Validation (`performance-validation.yml`)

**Problem:**

- No PR event type filtering
- No draft PR exclusion
- Would run on ALL PR events including draft PRs, causing unnecessary performance test runs

**Fix:**

- Added `types: [opened, synchronize, reopened, ready_for_review]` to filter PR events
- Added job-level condition `if: github.event.pull_request.draft == false || github.event_name != 'pull_request'`
- Now skips draft PRs entirely

**Impact:** ✅ Performance tests only run on non-draft PRs, saving CI resources (performance tests take ~30 minutes)

---

### 3. Documentation Build (`docs.yml`)

**Problem:**

- No PR event type filtering
- No draft PR exclusion
- Would run on ALL PR events including draft PRs

**Fix:**

- Added `types: [opened, synchronize, reopened, ready_for_review]` to filter PR events
- Added job-level condition `if: github.event.pull_request.draft == false || github.event_name != 'pull_request'`
- Now skips draft PRs

**Impact:** ✅ Documentation builds only run on non-draft PRs with doc changes

---

### 4. Quick Validation (`quick-validation.yml`)

**Status:** ✅ Already properly configured

- Has correct event types: `[opened, synchronize, reopened, ready_for_review]`
- Has draft check: `if: github.event.pull_request.draft == false`
- No changes needed

---

## Workflows Verified as Correct

The following workflows were reviewed and confirmed to have appropriate triggers:

### ✅ Maintenance and Security (`maintenance.yml`)

- **Triggers:** Schedule (weekly/monthly) + workflow_dispatch
- **Purpose:** Dependency checks and security audits
- **Appropriate:** Does not need PR triggers, only scheduled maintenance

### ✅ Release Pipeline (`release-pipeline.yml`)

- **Triggers:** `release: types: [published]` + workflow_dispatch
- **Purpose:** Publish releases to npm, GitHub, Docker, etc.
- **Appropriate:** Only runs on actual published releases, not drafts

### ✅ Performance Baseline Management (`performance-baseline-management.yml`)

- **Triggers:** `push: branches: [main]` + schedule + workflow_dispatch
- **Purpose:** Update performance baselines after main branch changes
- **Appropriate:** Only runs on main branch pushes (merged PRs), not on PRs themselves

### ✅ Snapshot Automation (`snapshot-automation.yml`)

- **Triggers:** `push: branches: [main]` + `release: types: [published]` + schedule
- **Purpose:** Create .astdb snapshots for distribution
- **Appropriate:** Only creates snapshots for main branch or releases, not PRs

### ✅ Community Analytics (`community-analytics.yml`)

- **Triggers:** Schedule (daily) + workflow_dispatch
- **Purpose:** Generate community contribution analytics
- **Appropriate:** Does not need PR triggers, only scheduled reports

---

## Best Practices Applied

1. **PR Event Type Filtering**
   - All PR workflows now specify explicit event types: `[opened, synchronize, reopened, ready_for_review]`
   - This ensures workflows trigger on all relevant PR lifecycle events

2. **Draft PR Exclusion**
   - All PR workflows that shouldn't run on drafts now have: `if: github.event.pull_request.draft == false || github.event_name != 'pull_request'`
   - This saves CI resources by skipping expensive operations for draft PRs

3. **Main Branch Protection**
   - Workflows that modify state (baselines, snapshots, releases) only trigger on main branch pushes or releases
   - This prevents accidental modifications from PRs

4. **Scheduled Jobs**
   - Long-running or maintenance tasks use schedule triggers instead of PR triggers
   - Examples: dependency updates, security audits, nightly benchmarks

---

## CI Resource Impact

These changes significantly reduce unnecessary CI usage:

| Workflow               | Avg Duration | Draft PR Runs (Before) | Draft PR Runs (After) | Savings per Draft PR |
| ---------------------- | ------------ | ---------------------- | --------------------- | -------------------- |
| CI/CD Pipeline         | ~15 min      | ✅ Already filtered    | ✅ Already filtered   | -                    |
| Performance Validation | ~30 min      | ❌ Ran on all events   | ✅ Skips drafts       | ~30 min              |
| Documentation Build    | ~2 min       | ❌ Ran on all events   | ✅ Skips drafts       | ~2 min               |
| Quick Validation       | ~5 min       | ✅ Already filtered    | ✅ Already filtered   | -                    |

**Total Savings:** ~32 minutes of CI time per draft PR update

For a project with frequent draft PRs (e.g., 10 draft updates per PR × 5 PRs per week):

- **Weekly savings:** ~26 hours of CI time
- **Monthly savings:** ~107 hours of CI time

---

## Testing Recommendations

To verify these changes work as expected:

1. **Test Draft PR Behavior:**

   ```bash
   # Create a draft PR with changes to packages/
   # Verify that performance-validation and docs workflows do NOT run
   # Mark PR as ready for review
   # Verify that workflows now run
   ```

2. **Test Non-Draft PR Behavior:**

   ```bash
   # Create a non-draft PR
   # Verify that ci.yml now triggers on "opened" event
   # Push additional commits
   # Verify workflows trigger on "synchronize" event
   ```

3. **Test Main Branch Behavior:**
   ```bash
   # Merge a PR to main with package changes
   # Verify that performance-baseline-management runs
   # Verify that snapshot-automation runs
   ```

---

## Future Improvements

Consider these additional optimizations:

1. **Path-Based Filtering:**
   - Further optimize by adding more specific path filters to workflows
   - Example: Only run Rust validation when `*.rs` files change

2. **Conditional Job Execution:**
   - Use job outputs to conditionally run expensive jobs
   - Example: Only run benchmarks if performance-critical files changed

3. **Workflow Monitoring:**
   - Track workflow execution times and costs
   - Identify opportunities for further optimization

---

## Related Documentation

- [GitHub Actions: Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- [GitHub Actions: Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- Project documentation: `DEVELOPMENT.md`

---

## Questions or Issues?

If you notice any workflows triggering at inappropriate times, please:

1. Check the workflow file in `.github/workflows/`
2. Review this document for best practices
3. Create an issue with details about the unexpected behavior
