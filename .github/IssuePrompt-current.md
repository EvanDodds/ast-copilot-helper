# GitHub Copilot Coding Agent - Issue Implementation Workflow

**Purpose**: Implement GitHub issues systematically with full traceability, intelligent recovery, and comprehensive validation.

**Core Principle**: Follow steps sequentially. Each step must complete successfully before proceeding to the next. If any step fails, stop and resolve the issue.

---

## Configuration Variables

### Required Inputs

- `ISSUE_NUMBERS` — Comma-separated list of issue numbers to implement
- `REPO_OWNER` — Repository owner/organization
- `REPO_NAME` — Repository name
- `MAIN_BRANCH` — Main branch name (default: main)

### Runtime Generated

- `SESSION_ID` — Unique session identifier: `session-{timestamp}-{random}`
- `TRACKING_FILE` — Session state file: `.github/sessions/{SESSION_ID}.json`

---

## Critical Rules

🚫 **NEVER:**

- Skip steps or checkpoints
- Proceed without verifying previous step completion
- Batch commits across multiple subtasks
- Recreate functionality that already exists
- Assume MCP/GitHub tools are available without verification
- Mark PR ready for review until ALL required criteria pass

✅ **ALWAYS:**

- Update tracking file at major milestones
- Commit after each subtask with descriptive messages
- Reference source issues when addressing acceptance criteria
- Verify existing work before implementing new features
- Maintain issue traceability throughout workflow
- Stop and report errors immediately when encountered

---

## Step 0: Initialize Session & Analyze Issues

**Objective**: Establish session context, fetch all issues, discover relationships, and analyze existing work.

### 0.1 Session Setup & Recovery Check

1. **Initialize tracking system**:

   ```bash
   mkdir -p .github/sessions
   # Create session file: .github/sessions/session-{timestamp}-{random}.json
   ```

2. **Check for existing work on these issues**:
   - Search for branches matching issue number patterns
   - Find existing PRs (open/draft/closed) for these issues
   - Scan for TODO/FIXME comments referencing issue numbers
   - Look for previous session files for same issues

3. **Handle existing work**:
   - **Complete PR exists**: STOP → Report "Already implemented in PR #X"
   - **Draft PR exists**: Ask user to continue or start fresh
   - **Partial implementation**: Load previous session and resume
   - **Previous session**: Resume from last checkpoint

4. **Create initial tracking file**:
   ```json
   {
     "sessionId": "session-20251009-abc123",
     "timestamp": "2025-10-09T10:00:00Z",
     "issues": [123, 456],
     "repoOwner": "owner",
     "repoName": "repo",
     "currentStep": "0.1",
     "status": "initializing"
   }
   ```

### 0.2 Fetch Issues & Discover Relationships

5. **Fetch specified issues using MCP**:
   - If MCP unavailable: STOP → Request user enable GitHub integration
   - If any issue fetch fails: STOP → Report error
   - Extract: title, description, state, labels, comments

6. **Automatically discover ALL related issues**:
   - Parse issue bodies and comments for references:
     - Direct: "fixes #X", "closes #Y", "resolves #Z"
     - Subtasks: "- [ ] #N Task description"
     - Dependencies: "depends on #M", "blocked by #K"
     - Related: "related to #P", "part of #Q"
   - Fetch ALL discovered issues recursively via MCP
   - Continue until no new issues found
   - Build complete relationship map (parents, children, siblings)

### 0.3 Extract Acceptance Criteria

7. **For ALL issues (specified + discovered), extract**:
   - **Acceptance Criteria**: Sections labeled "AC:", "Acceptance Criteria", "Success Criteria"
   - **Definition of Done**: "DoD", "Done when", "Completed when"
   - **Requirements from subtasks**: Checkbox items with acceptance details
   - **Comment additions**: Requirements clarified in issue comments
   - **Label implications**: Requirements from labels (e.g., "security", "breaking-change")

8. **Create master criteria list** with:
   - Criterion text
   - Source issue number
   - Priority: required/enhanced/optional
   - Dependencies between criteria
   - Verification method

### 0.4 Analyze Existing Work

9. **Scan codebase for related work**:
   - Search for files/functions mentioned in issues
   - Find TODOs/FIXMEs with issue references
   - Check commit history for previous attempts
   - Identify partial implementations
   - Locate existing tests for related functionality

10. **Categorize existing work**:
    - **Complete**: Verify functionality exists and works
    - **Partial**: Identify what's done and what's missing
    - **Conflicting**: Note code that may need refactoring
    - **Related**: Document adjacent functionality to consider

### 0.5 Finalize Strategy

11. **Determine implementation approach**:
    - **Simple**: Single issue or small set, straightforward implementation
    - **Network**: Multiple interconnected issues with dependencies
    - **Hybrid**: Mix of independent and dependent work streams

12. **Update tracking file** with complete analysis:
    ```json
    {
      "currentStep": "0.complete",
      "status": "analysis-complete",
      "issueNetwork": {
        "primary": [123],
        "related": [456, 789],
        "relationships": { "456": "child-of-123", "789": "sibling-of-123" }
      },
      "acceptanceCriteria": [
        {
          "id": 1,
          "text": "Must support feature X",
          "source": 123,
          "priority": "required",
          "existingStatus": "not-started"
        }
      ],
      "existingWork": {
        "partial": ["src/feature.ts: Base structure exists"],
        "complete": ["tests/unit/feature.test.ts: Unit tests present"]
      },
      "strategy": "network"
    }
    ```

**✅ Checkpoint**: Display summary:

- All discovered issues (count primary + related)
- Master acceptance criteria (numbered list with priorities)
- Existing work summary
- Implementation strategy
- Tracking file path

---

## Step 1: Create Branch & Draft PR

**Objective**: Set up development branch and draft PR for tracking.

### 1.1 Branch Setup

1. **Determine branch name**:
   - Single issue: `issue-{num}/{slug-title}`
   - Multiple issues: `issues-{primary-num}-etc/{slug-title}`
   - Complex network: `network-{primary-num}/{slug-title}`

2. **Create and push branch**:
   ```bash
   git checkout -b {branch-name}
   git add .github/sessions/{SESSION_ID}.json
   git commit -m "chore(issue-{nums}): initialize implementation session"
   git push -u origin {branch-name}
   ```

### 1.2 Draft PR Creation

3. **Create draft PR**:
   - **Title**: `[Draft] Implement #{primary} · {title} [+ {N} related]`
   - **Body**:

     ```markdown
     ## Issues Addressed

     ### Primary

     - #{primary}: {title}

     ### Related (Auto-Discovered)

     - #{related}: {title} ({relationship})

     ## Acceptance Criteria

     ### Required

     - [ ] {criterion} (#{source})

     ### Enhanced

     - [ ] {criterion} (#{source}) - _Enhanced_

     ## Implementation Plan

     {High-level plan - will be updated as work progresses}

     ## Status

     🚧 DRAFT - Implementation in progress

     **Session**: `.github/sessions/{SESSION_ID}.json`
     ```

4. **Update tracking file**:
   ```json
   {
     "currentStep": "1.complete",
     "status": "branch-created",
     "branchName": "issue-123/feature-implementation",
     "prUrl": "https://github.com/owner/repo/pull/999",
     "prNumber": 999
   }
   ```

**✅ Checkpoint**: Report draft PR URL and branch name.

---

## Step 2: Clarify Requirements

**Objective**: Restate understanding and confirm scope.

1. **Summarize all issues** in your own words

2. **List master acceptance criteria** with:
   - Clear pass/fail conditions
   - Source issue reference
   - Priority classification
   - Existing work status

3. **Identify constraints**:
   - Dependencies between issues
   - Implementation order requirements
   - Scope boundaries (what's in/out)

4. **Update tracking file**:
   ```json
   {
     "currentStep": "2.complete",
     "status": "requirements-confirmed",
     "scope": {
       "mustComplete": [123, 456],
       "mayDefer": [789],
       "outOfScope": []
     }
   }
   ```

**✅ Checkpoint**: Confirm understanding of requirements and scope.

---

## Step 3: Plan Implementation

**Objective**: Break work into executable subtasks.

1. **Create 3-12 subtasks** covering:
   - All required acceptance criteria
   - Proper dependency ordering
   - Integration of existing work
   - Testing requirements

2. **For each subtask specify**:
   - Objective and success criteria
   - Target files/modules
   - Work type: `create-new` | `update-existing` | `verify-complete` | `integrate`
   - Acceptance criteria addressed (with issue refs)
   - Dependencies on other subtasks
   - Estimated complexity: `low` | `medium` | `high`

3. **Validate coverage**:
   - Every required criterion has assigned subtask(s)
   - Subtask order respects dependencies
   - No redundant work (don't recreate existing functionality)

4. **Update tracking file**:
   ```json
   {
     "currentStep": "3.complete",
     "status": "tasks-planned",
     "subtasks": [
       {
         "id": 1,
         "title": "Implement feature X core logic",
         "workType": "create-new",
         "criteria": [1, 2],
         "files": ["src/feature.ts"],
         "complexity": "medium",
         "status": "not-started"
       }
     ]
   }
   ```

**✅ Checkpoint**: Display subtask list with work types and criteria coverage.

---

## Step 4: Implement Subtasks

**Objective**: Execute each subtask with full verification and commit.

### For EACH subtask:

1. **Verify current state**: Check if target area already has relevant code

2. **Present approach**: Outline changes or verification steps for this subtask

3. **Generate code**: Create/update code OR verify existing implementation

4. **Write/update tests**: Ensure test coverage for new behavior

5. **Validate criteria**: Confirm which acceptance criteria are now satisfied

6. **Run tests**: Execute tests and report results

7. **Update tracking file**:

   ```json
   {
     "subtasks": [
       { "id": 1, "status": "in-progress" },
       { "id": 2, "status": "not-started" }
     ]
   }
   ```

8. **Commit and push**:

   ```bash
   git add {changed-files} .github/sessions/{SESSION_ID}.json
   git commit -m "{type}(#{issues}): {description}"
   git push
   ```

9. **Update PR description**: Add progress note if significant milestone

**✅ Checkpoint**: State "Subtask {N} complete - {work-type} for criteria from #{issues}"

### Mid-Implementation Review

After every 3rd subtask or when complexity increases:

- Reload tracking file context
- Verify alignment with original requirements
- Check for newly emerged related issues
- Confirm existing work assumptions still valid
- Update strategy if needed

---

## Step 5: Verify Implementation

**Objective**: Systematically validate all acceptance criteria.

1. **Run full test suite**: Report pass/fail results

2. **Verify each criterion**:
   - Test each acceptance criterion individually
   - Mark: ✅ PASS | ❌ FAIL | ⚪ DEFERRED
   - Include source issue reference
   - For existing work: ✅ VERIFIED | ❌ NEEDS_UPDATE

3. **Cross-issue validation**:
   - Check for conflicts between features from different issues
   - Verify parent-child relationships satisfied
   - Confirm all dependencies met
   - Test integration between new and existing work

4. **Fix any failures**:
   - If any required criterion fails: identify gap, fix code, retest
   - Continue until ALL required criteria pass

5. **Update tracking file**:
   ```json
   {
     "currentStep": "5.complete",
     "status": "verification-complete",
     "verificationResults": [
       { "criterion": "Supports feature X", "status": "PASS", "source": 123 }
     ],
     "testResults": { "total": 45, "passed": 45, "failed": 0 }
   }
   ```

**✅ Checkpoint**: "All required criteria verified" with summary by issue.

---

## Step 6: Finalize PR

**Objective**: Prepare PR for review and update all related issues.

1. **Update PR title**:
   - All complete: `Implement #{nums} · {title} ✅`
   - Partial: `Implement #{completed} · {title} ✅ (Part 1 of {N})`

2. **Mark PR ready for review** (remove draft status)

3. **Post completion comment on PR**:

   ```markdown
   ## ✅ Implementation Complete - Ready for Review

   ### Issues Addressed

   - ✅ #{num}: {title}

   ### Acceptance Criteria

   - ✅ {criterion} (#{source})

   ### Testing

   - ✅ All tests passing ({passed}/{total})
   - ✅ Manual validation complete
   - ✅ Cross-issue compatibility verified

   Ready for code review.
   ```

4. **Comment on each implemented issue**:

   ```markdown
   Implementation complete in PR #{pr-num}

   ✅ All acceptance criteria met:

   - ✅ {criterion}

   [Related issues: #{others}]

   PR ready for review: {pr-url}
   ```

5. **Update tracking file** (final):

   ```json
   {
     "currentStep": "6.complete",
     "status": "ready-for-review",
     "completedAt": "2025-10-09T15:30:00Z",
     "finalPrUrl": "https://github.com/owner/repo/pull/999",
     "summary": {
       "issuesCompleted": [123, 456],
       "criteriaVerified": 15,
       "newWork": ["src/feature.ts", "src/helper.ts"],
       "existingWorkVerified": ["tests/unit/feature.test.ts"],
       "existingWorkUpdated": ["src/config.ts"]
     }
   }
   ```

6. **Final commit**:
   ```bash
   git add .github/sessions/{SESSION_ID}.json
   git commit -m "chore: finalize implementation tracking for #{issues}"
   git push
   ```

**✅ Checkpoint**: "PR ready for review" with tracking summary.

---

## Workflow Behaviors

### Issue Network Discovery

- Related issues are NEVER manually specified beyond initial set
- ANY issue triggers recursive relationship scanning
- All connected issues found via: descriptions, comments, relationships, cross-refs
- Complete relationship map built automatically

### Session Tracking

- Every session creates persistent state in `.github/sessions/`
- Tracking files committed to git for full traceability
- All decisions, progress, and state recorded for recovery
- Enables resuming from any interruption point

### Existing Work Integration

- Comprehensive analysis before any implementation
- Existing partial work extended, not replaced
- Complete existing work verified, not recreated
- TODOs and partial implementations identified and leveraged

### Reentrant & Restartable

- Can resume from any interruption using tracking file
- Detects previous work on same issues
- Handles duplicate runs intelligently
- Validates previous state before proceeding

### Work Type Classification

- **create-new**: Build new functionality from scratch
- **update-existing**: Modify existing code
- **verify-complete**: Confirm existing work meets criteria
- **integrate**: Connect new and existing components

---

## Implementation Modes

### Simple Implementation

- Single issue or small related set
- Straightforward requirements
- Unified acceptance criteria
- Single linear workflow

### Complex Network

- Multiple interconnected issues
- Hierarchical dependencies
- Requires careful sequencing
- Comprehensive planning needed

### Hybrid Network

- Mix of simple and complex relationships
- Some parallel work possible
- Adaptive strategy based on dependencies
- Flexible implementation approach

---

## Recovery Scenarios

### Interrupted Workflow

1. Load tracking file from `.github/sessions/`
2. Verify last completed step
3. Validate previous work still current
4. Resume from next step in sequence

### Duplicate Run Detection

1. Find existing session for same issues
2. Offer to: continue previous session | start fresh | abort
3. If continuing: reload context and proceed
4. If fresh: archive old session and start new

### Partial Implementation Found

1. Analyze existing partial work
2. Determine what's complete vs incomplete
3. Update tracking file with current state
4. Continue implementation from gaps

---

## Error Handling

### MCP/GitHub Tools Unavailable

- STOP immediately
- Report: "GitHub integration required. Please enable MCP tools."
- Do not proceed without tool access

### Issue Fetch Failure

- STOP immediately
- Report which issue(s) failed to fetch
- Provide error details
- Do not proceed with incomplete issue data

### Test Failures During Verification

- Do not mark PR ready
- Identify failing tests
- Fix implementation
- Rerun verification
- Continue until all pass

### Acceptance Criteria Not Met

- Do not proceed to next step
- Identify which criteria failed
- Determine gap in implementation
- Fix and revalidate
- Continue until all required criteria pass

---

## Best Practices

### Commit Messages

- Format: `{type}(#{issue}): {description}`
- Types: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`
- Include issue numbers for traceability
- Be specific and descriptive

### Testing

- Write tests for all new functionality
- Update tests when modifying existing code
- Verify existing tests still pass
- Include integration tests for cross-issue features

### Code Quality

- Follow existing codebase patterns
- Maintain consistent style
- Add comments for complex logic
- Update documentation as needed

### Communication

- Keep PR description current
- Post progress updates on complex work
- Comment on issues with implementation details
- Be transparent about deferred work

---

**Begin with Step 0. Do not proceed to Step 1 until Step 0 checkpoint is reached and confirmed.**
