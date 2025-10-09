# GitHub Copilot Coding Agent - Enhanced Issue Implementation Workflow

## 🎯 USAGE MODES

### **Mode 1: Direct GitHub Copilot Chat** _(Simplest - Pure Prompt)_

```
@github Use this workflow to implement the next ready issue:

[Paste this entire prompt as context]

Please automatically select the next ready issue and implement it end-to-end.
```

### **Mode 2: Orchestrated Script** _(Advanced - Wrapper Script)_

```bash
# Save this prompt as a template, create wrapper script:
#!/bin/bash
# github-copilot-orchestrator.sh

PROMPT_TEMPLATE="$(cat IssuePrompt.md)"
while true; do
  github-copilot-cli --prompt "$PROMPT_TEMPLATE" --mode autonomous
  if [ $? -eq 42 ]; then break; fi  # Human handoff required
done
```

### **Mode 3: VS Code Extension** _(Future - Full Integration)_

```typescript
// Hypothetical VS Code extension implementation
// Command: "Declutra: Start Autonomous Development"
// Uses GitHub Copilot APIs + this workflow logic
```

---

## 🤖 CURRENT PROMPT DESIGN

_This prompt template provides instructions for GitHub Copilot to follow autonomous issue implementation with reentrant, state-aware, end-to-end orchestration capabilities._

## Variables (auto-detected - no manual input required)

• REPO_OWNER — **AUTO-DETECTED** (from git remote)
• REPO_NAME — **AUTO-DETECTED** (from git remote)  
• MAIN_BRANCH — **AUTO-DETECTED** (defaults to 'main')
• ISSUE_NUMBER — **AUTO-SELECTED** (determined by project analysis)
• EXECUTION_ID — **AUTO-GENERATED** (timestamp-issue-hash format)
• STATE_FILE — `/tmp/copilot-state-${EXECUTION_ID}.json`
• CONTEXT_FILE — `/tmp/copilot-context-${EXECUTION_ID}.md`
• PROJECT_STATE_FILE — `/tmp/copilot-project-state.json`

## 🔄 REENTRANT BEHAVIOR & STATE MANAGEMENT

### State Persistence Strategy

```json
// STATE_FILE format - persisted between tool calls
{
  "executionId": "{{EXECUTION_ID}}",
  "issueNumber": "{{ISSUE_NUMBER}}",
  "currentStep": "0|1|2|3|4|5|6",
  "currentSubtask": 0,
  "totalSubtasks": 0,
  "stepCompletions": {
    "step0": { "completed": false, "timestamp": null },
    "step1": {
      "completed": false,
      "timestamp": null,
      "branchName": "",
      "prNumber": ""
    },
    "step2": { "completed": false, "timestamp": null },
    "step3": { "completed": false, "timestamp": null, "subtasks": [] },
    "step4": {
      "completed": false,
      "timestamp": null,
      "subtaskCompletions": []
    },
    "step5": { "completed": false, "timestamp": null, "criteriaResults": [] },
    "step6": { "completed": false, "timestamp": null }
  },
  "issueData": {
    "title": "",
    "description": "",
    "acceptanceCriteria": [],
    "labels": [],
    "assignee": ""
  },
  "implementationContext": {
    "branchName": "",
    "prNumber": "",
    "prUrl": "",
    "commits": [],
    "testResults": [],
    "errors": []
  }
}
```

### Context Preservation Strategy

```markdown
<!-- CONTEXT_FILE format - maintains extended context -->

# Copilot Execution Context - {{EXECUTION_ID}}

## Issue Context

[Full issue details, acceptance criteria, dependencies]

## Implementation Progress

[Detailed progress tracking, decisions, code snippets]

## Code Context

[Key code patterns, architectural decisions, file relationships]

## Next Actions

[Specific next steps based on current state]

## Error Recovery

[Any error conditions and recovery strategies]
```

## 🎯 ENHANCED ORCHESTRATION FLOW

### INITIALIZATION & STATE RECOVERY WITH AUTONOMOUS ISSUE SELECTION

**ALWAYS START HERE - Auto-detect project state and select optimal next issue**

1. **Project-Wide Analysis**:

   ```bash
   # Autonomous project state analysis - NO MANUAL INPUT REQUIRED
   echo "🔍 ANALYZING PROJECT STATE for autonomous issue selection..."

   # Fetch ALL project issues and build complete context
   ALL_ISSUES=$(gh issue list --state open --json number,title,labels,milestone,assignees,body)
   PROJECT_BOARD=$(gh project list --owner "$REPO_OWNER" --format json)
   CURRENT_PHASE=$(detect_current_development_phase)

   echo "📊 Found $(echo "$ALL_ISSUES" | jq length) open issues in $CURRENT_PHASE"
   ```

2. **Autonomous Issue Selection**:

   ```bash
   # Build complete dependency graph for all issues
   build_project_dependency_graph() {
     local ALL_ISSUES="$1"

     # Extract dependency relationships from issue bodies and project board
     for issue in $(echo "$ALL_ISSUES" | jq -r '.[].number'); do
       ISSUE_BODY=$(echo "$ALL_ISSUES" | jq -r ".[] | select(.number == $issue) | .body")

       # Parse blocked_by relationships
       BLOCKED_BY=$(echo "$ISSUE_BODY" | grep -o "blocked by #[0-9]\+" | grep -o "[0-9]\+")

       # Parse epic relationships
       EPIC_PARENT=$(echo "$ISSUE_BODY" | grep -o "Epic: #[0-9]\+" | grep -o "[0-9]\+")

       # Store in dependency graph
       jq -n --arg issue "$issue" --argjson blocked_by "[$BLOCKED_BY]" \
         '{issue: $issue, dependencies: $blocked_by}' >> /tmp/dependency_graph.json
     done
   }

   # Find next ready issue automatically
   find_next_ready_issue() {
     # Get all issues that have no unsatisfied dependencies
     READY_ISSUES=$(find_issues_with_satisfied_dependencies)

     # Filter by current phase and team assignment
     PHASE_READY=$(filter_by_current_phase "$READY_ISSUES" "$CURRENT_PHASE")

     # Apply priority scoring (epic priority + urgency + complexity)
     PRIORITIZED=$(apply_priority_scoring "$PHASE_READY")

     # Select highest priority ready issue
     NEXT_ISSUE=$(echo "$PRIORITIZED" | jq -r '.[0].number')

     echo "🎯 AUTO-SELECTED: Issue #$NEXT_ISSUE - Highest priority ready issue"
     return $NEXT_ISSUE
   }

   # Execute autonomous selection
   ISSUE_NUMBER=$(find_next_ready_issue)

   if [ -z "$ISSUE_NUMBER" ]; then
     echo "⏳ NO READY ISSUES: All available work is blocked by dependencies"
     echo "🔄 WAIT MODE: Will check again in 30 minutes or after external updates"
     exit 0
   fi
   ```

3. **Continuous Operation Logic**:

   ```bash
   # After completing an issue, automatically find next work
   post_completion_continuous_operation() {
     echo "✅ Issue #$ISSUE_NUMBER completed successfully"

     # Update project state
     update_project_completion_state "$ISSUE_NUMBER"

     # Check if new issues became ready
     NEW_READY_ISSUES=$(find_newly_ready_issues)

     if [ ! -z "$NEW_READY_ISSUES" ]; then
       echo "🚀 CONTINUOUS OPERATION: New issues ready, selecting next..."
       # Recursively start new execution with new issue
       exec "$0" # Restart script for next issue
     else
       echo "🏁 PHASE COMPLETE: No more ready issues in current phase"
       echo "⏳ WAITING: For external dependencies or next phase start"
     fi
   }
   ```

## 0️⃣ AUTONOMOUS ISSUE CONTEXT ANALYSIS & WORKFLOW INITIALIZATION

**REQUIRED - Issue auto-selected, now analyze context and initialize execution**

### Step 0A: Selected Issue Deep Analysis

1. **REQUIRED**: Analyze the auto-selected issue in full context:

   ```bash
   # Now that we have ISSUE_NUMBER from autonomous selection, analyze deeply
   echo "🔍 ANALYZING auto-selected Issue #$ISSUE_NUMBER..."

   ISSUE_DATA=$(gh issue view $ISSUE_NUMBER --json title,body,labels,milestone,assignees)
   ISSUE_TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')
   ISSUE_BODY=$(echo "$ISSUE_DATA" | jq -r '.body')
   ISSUE_LABELS=$(echo "$ISSUE_DATA" | jq -r '.labels[].name')

   echo "📋 Selected: $ISSUE_TITLE"
   echo "🏷️ Labels: $ISSUE_LABELS"
   ```

2. **REQUIRED**: Generate execution ID now that we have selected issue:

   ```bash
   # Generate unique execution ID for this auto-selected issue
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   REPO_HASH=$(git rev-parse --short HEAD)
   ISSUE_HASH=$(echo "$ISSUE_NUMBER" | md5sum | cut -c1-8)
   EXECUTION_ID="${TIMESTAMP}_issue-${ISSUE_NUMBER}_${REPO_HASH}_${ISSUE_HASH}"

   echo "🆔 Generated Execution ID: $EXECUTION_ID"
   ```

   ```

   ```

3. **REQUIRED**: Determine issue type, phase, and service context:

   ```bash
   # Phase-aware analysis for Declutra context
   CURRENT_PHASE=$(detect_project_phase "$ISSUE_LABELS" "$MILESTONE")

   case "$CURRENT_PHASE" in
     "phase-1"|"foundation")
       # Phase 1: BinBoard Foundation patterns
       case "$ISSUE_TITLE" in
         *"Database Schema"* | *"Prisma"* | *"Migration"*)
           ISSUE_TYPE="database"
           SERVICE_CONTEXT="foundational"
           WORKFLOW="database-first"
           ;;
         *"API"* | *"CRUD"* | *"Endpoint"*)
           ISSUE_TYPE="api"
           SERVICE_CONTEXT="backend"
           WORKFLOW="api-implementation"
           DEPENDENCIES_REQUIRED="database"
           ;;
         *"QR Code"* | *"Generation"*)
           ISSUE_TYPE="feature"
           SERVICE_CONTEXT="core"
           WORKFLOW="feature-implementation"
           ;;
       esac
       ;;

     "phase-2"|"parallel")
       # Phase 2: SnapSort + ScanSell parallel development
       case "$ISSUE_TITLE" in
         *"SnapSort"* | *"AI"* | *"Computer Vision"* | *"Photo Processing"*)
           ISSUE_TYPE="ai-integration"
           SERVICE_CONTEXT="input-processing"
           WORKFLOW="ai-ml-integration"
           DEPENDENCIES_REQUIRED="binboard-apis"
           EXTERNAL_SERVICES="azure-computer-vision"
           ;;
         *"ScanSell"* | *"Payment"* | *"Transaction"* | *"QR Scan"*)
           ISSUE_TYPE="transaction"
           SERVICE_CONTEXT="sales-processing"
           WORKFLOW="payment-integration"
           DEPENDENCIES_REQUIRED="binboard-apis"
           EXTERNAL_SERVICES="stripe-square-paypal"
           ;;
         *"Azure"* | *"Blob Storage"* | *"ML Model"*)
           ISSUE_TYPE="cloud-integration"
           SERVICE_CONTEXT="cloud-services"
           WORKFLOW="cloud-service-integration"
           ;;
       esac
       ;;

     "phase-3"|"integration")
       # Phase 3: MarketMate complex external integrations
       case "$ISSUE_TITLE" in
         *"MarketMate"* | *"Facebook Marketplace"* | *"eBay"* | *"Mercari"*)
           ISSUE_TYPE="marketplace-integration"
           SERVICE_CONTEXT="external-apis"
           WORKFLOW="marketplace-api-integration"
           DEPENDENCIES_REQUIRED="complete-ecosystem"
           EXTERNAL_SERVICES="facebook-ebay-mercari"
           COMPLIANCE_REQUIRED="true"
           ;;
         *"Compliance"* | *"Legal"* | *"Terms"* | *"Privacy"*)
           ISSUE_TYPE="compliance"
           SERVICE_CONTEXT="legal-compliance"
           WORKFLOW="compliance-implementation"
           ;;
         *"Multi-Platform"* | *"Cross-Platform"* | *"Listing Automation"*)
           ISSUE_TYPE="automation"
           SERVICE_CONTEXT="listing-automation"
           WORKFLOW="multi-platform-integration"
           ;;
       esac
       ;;

     "phase-4"|"launch")
       # Phase 4: Production, performance, analytics
       case "$ISSUE_TITLE" in
         *"Performance"* | *"Optimization"* | *"Scale"* | *"Load"*)
           ISSUE_TYPE="performance"
           SERVICE_CONTEXT="production-optimization"
           WORKFLOW="performance-optimization"
           ;;
         *"Analytics"* | *"Monitoring"* | *"Metrics"* | *"Dashboard"*)
           ISSUE_TYPE="analytics"
           SERVICE_CONTEXT="observability"
           WORKFLOW="analytics-implementation"
           ;;
         *"Deployment"* | *"Production"* | *"Launch"* | *"Release"*)
           ISSUE_TYPE="deployment"
           SERVICE_CONTEXT="production-deployment"
           WORKFLOW="production-deployment"
           ;;
       esac
       ;;

     "phase-5"|"mobile-client"|"client-application")
       # Phase 5: Comprehensive Mobile Client Implementation
       case "$ISSUE_TITLE" in
         *"PWA"* | *"Progressive Web App"* | *"Service Worker"* | *"Offline"*)
           ISSUE_TYPE="pwa-development"
           SERVICE_CONTEXT="progressive-web-app"
           WORKFLOW="pwa-implementation"
           DEPENDENCIES_REQUIRED="api-services-complete"
           EXTERNAL_SERVICES="firebase-push-notifications"
           TESTING_REQUIRED="cross-browser-compatibility"
           ;;
         *"React Native"* | *"Mobile App"* | *"iOS"* | *"Android"*)
           ISSUE_TYPE="native-mobile"
           SERVICE_CONTEXT="mobile-native"
           WORKFLOW="react-native-implementation"
           DEPENDENCIES_REQUIRED="api-services-complete"
           EXTERNAL_SERVICES="app-store-google-play"
           TESTING_REQUIRED="device-compatibility"
           ;;
         *"App Store"* | *"TestFlight"* | *"iOS Distribution"*)
           ISSUE_TYPE="ios-deployment"
           SERVICE_CONTEXT="mobile-deployment"
           WORKFLOW="ios-app-store-deployment"
           DEPENDENCIES_REQUIRED="ios-app-complete"
           COMPLIANCE_REQUIRED="app-store-guidelines"
           ;;
         *"Google Play"* | *"Android Distribution"* | *"APK"*)
           ISSUE_TYPE="android-deployment"
           SERVICE_CONTEXT="mobile-deployment"
           WORKFLOW="android-play-store-deployment"
           DEPENDENCIES_REQUIRED="android-app-complete"
           COMPLIANCE_REQUIRED="play-store-policies"
           ;;
         *"Cross-Platform"* | *"State Management"* | *"Redux"* | *"Context"*)
           ISSUE_TYPE="cross-platform-infrastructure"
           SERVICE_CONTEXT="mobile-architecture"
           WORKFLOW="cross-platform-implementation"
           DEPENDENCIES_REQUIRED="pwa-native-foundation"
           ;;
         *"Mobile UX"* | *"Touch"* | *"Gesture"* | *"Responsive"*)
           ISSUE_TYPE="mobile-ux"
           SERVICE_CONTEXT="mobile-experience"
           WORKFLOW="mobile-ux-implementation"
           DEPENDENCIES_REQUIRED="mobile-foundation"
           ;;
         *"Performance"* | *"Mobile Optimization"* | *"Battery"* | *"Memory"*)
           ISSUE_TYPE="mobile-performance"
           SERVICE_CONTEXT="mobile-optimization"
           WORKFLOW="mobile-performance-optimization"
           DEPENDENCIES_REQUIRED="mobile-apps-functional"
           TESTING_REQUIRED="device-performance-testing"
           ;;
         *"Mobile Analytics"* | *"Crash Reporting"* | *"App Metrics"*)
           ISSUE_TYPE="mobile-analytics"
           SERVICE_CONTEXT="mobile-monitoring"
           WORKFLOW="mobile-analytics-implementation"
           DEPENDENCIES_REQUIRED="mobile-apps-deployed"
           ;;
       esac
       ;;
   esac
   ```

### Step 0B: Dependency Resolution & Sequencing

3. **REQUIRED**: Build dependency map and execution sequence:
   ```json
   // DEPENDENCY_MAP file structure
   {
     "currentIssue": "{{ISSUE_NUMBER}}",
     "issueType": "api|database|ui|feature|infrastructure",
     "serviceContext": "foundational|backend|frontend|core",
     "dependencies": {
       "blockedBy": [2, 35], // Issues that must complete first
       "prerequisiteFiles": ["prisma/schema.prisma"],
       "serviceIntegrations": ["auth-service", "item-service"]
     },
     "workflow": {
       "type": "database-first|api-implementation|ui-implementation",
       "steps": ["schema", "migration", "api", "tests"],
       "estimatedComplexity": "low|medium|high",
       "parallelizable": false
     },
     "nextActions": [
       {
         "step": "validate-dependencies",
         "description": "Check if prerequisite issues #2, #35 are complete",
         "blocking": true
       },
       {
         "step": "analyze-integration-points",
         "description": "Map required service integrations",
         "blocking": false
       }
     ]
   }
   ```

### Step 0C: Smart Workflow Selection

4. **REQUIRED**: Choose execution workflow based on analysis:

   ```bash
   # Phase-aware workflow selection
   select_workflow_pattern() {
     local PHASE="$1"
     local ISSUE_TYPE="$2"

     case "$PHASE:$ISSUE_TYPE" in
       # Phase 1 Workflows
       "phase-1:database")
         WORKFLOW_STEPS=("schema-design" "migration-script" "database-validation")
         ;;
       "phase-1:api")
         WORKFLOW_STEPS=("route-definition" "business-logic" "database-integration" "api-testing")
         ;;

       # Phase 2 Workflows
       "phase-2:ai-integration")
         WORKFLOW_STEPS=("azure-setup" "computer-vision-integration" "ai-processing-pipeline" "binboard-integration" "performance-testing")
         ;;
       "phase-2:transaction")
         WORKFLOW_STEPS=("payment-gateway-setup" "qr-scanning-logic" "transaction-processing" "binboard-integration" "security-validation")
         ;;

       # Phase 3 Workflows
       "phase-3:marketplace-integration")
         WORKFLOW_STEPS=("api-research" "compliance-validation" "authentication-setup" "listing-automation" "error-handling" "integration-testing")
         ;;
       "phase-3:compliance")
         WORKFLOW_STEPS=("legal-review" "privacy-policy" "terms-implementation" "compliance-testing" "documentation")
         ;;

       # Phase 4 Workflows
       "phase-4:performance")
         WORKFLOW_STEPS=("performance-profiling" "bottleneck-analysis" "optimization-implementation" "load-testing" "monitoring-setup")
         ;;
       "phase-4:analytics")
         WORKFLOW_STEPS=("metrics-definition" "analytics-implementation" "dashboard-creation" "alerting-setup" "validation-testing")
         ;;

       # Phase 5 Mobile Client Workflows
       "phase-5:pwa-development")
         WORKFLOW_STEPS=("service-worker-setup" "offline-capability" "push-notifications" "app-manifest" "cross-browser-testing")
         ;;
       "phase-5:native-mobile")
         WORKFLOW_STEPS=("react-native-setup" "navigation-config" "state-management" "native-integrations" "device-testing")
         ;;
       "phase-5:ios-deployment")
         WORKFLOW_STEPS=("xcode-project-config" "certificates-provisioning" "testflight-build" "app-store-metadata" "submission-review")
         ;;
       "phase-5:android-deployment")
         WORKFLOW_STEPS=("gradle-build-config" "signing-setup" "internal-testing" "play-store-metadata" "release-deployment")
         ;;
       "phase-5:cross-platform-infrastructure")
         WORKFLOW_STEPS=("shared-state-architecture" "platform-abstraction" "sync-mechanisms" "conflict-resolution" "cross-platform-testing")
         ;;
       "phase-5:mobile-ux")
         WORKFLOW_STEPS=("touch-optimization" "gesture-handling" "responsive-design" "accessibility-compliance" "ux-testing")
         ;;
       "phase-5:mobile-performance")
         WORKFLOW_STEPS=("performance-profiling" "memory-optimization" "battery-optimization" "network-efficiency" "performance-validation")
         ;;
       "phase-5:mobile-analytics")
         WORKFLOW_STEPS=("analytics-setup" "crash-reporting" "performance-monitoring" "user-tracking" "analytics-validation")
         ;;
     esac
   }
   ```

5. **CHECKPOINT**: Initialize state with smart sequencing

## 1️⃣ BRANCH SETUP & DRAFT PR WITH STATE TRACKING

**Enhanced branch management with recovery capabilities**

### Step 1A: Repository State Validation

1. **REQUIRED**: Validate git repository state:

   ```bash
   # Ensure clean working directory
   git status --porcelain | wc -l  # Should be 0

   # Ensure we're on main branch
   git checkout {{MAIN_BRANCH}}
   git pull origin {{MAIN_BRANCH}}

   # Update state file with repository status
   ```

2. **REQUIRED**: Check for existing implementation branch:

   ```bash
   BRANCH_NAME="issue-{{ISSUE_NUMBER}}/$(echo '{{ISSUE_TITLE}}' | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]')"

   if git show-ref --verify --quiet refs/heads/$BRANCH_NAME; then
     echo "🔄 RESUMING: Branch $BRANCH_NAME already exists"
     git checkout $BRANCH_NAME
     # Update state with existing branch
   else
     echo "🆕 CREATING: New branch $BRANCH_NAME"
     git checkout -b $BRANCH_NAME
   fi
   ```

### Step 1B: Draft PR Creation with State Tracking

3. **REQUIRED**: Create or update Draft PR with complete GitHub workflow integration:
   - Check if PR already exists for this branch
   - If exists: Update PR description with current state
   - If not exists: Create new Draft PR with comprehensive template
   - **NEW**: Set up complete GitHub collaboration workflow
   - Update state file with PR number and URL

4. **REQUIRED**: PR Template with state tracking and collaboration setup:

   ```markdown
   # [DRAFT] Implement #{{ISSUE_NUMBER}} · {{ISSUE_TITLE}}

   🤖 **Copilot Agent Implementation** - Execution ID: `{{EXECUTION_ID}}`

   ## Issue Linkage

   Closes #{{ISSUE_NUMBER}}

   ## Implementation State

   - ⏳ **Current Step**: {{CURRENT_STEP}}
   - 📊 **Progress**: {{COMPLETED_STEPS}}/6 steps complete
   - 🕐 **Started**: {{START_TIME}}
   - 🔄 **Last Update**: {{CURRENT_TIME}}

   ## Acceptance Criteria Progress

   {{#each ACCEPTANCE_CRITERIA}}

   - [ ] {{this}}
         {{/each}}

   ## Implementation Log

   [Auto-updated by Copilot Agent]

   ## Code Review Checklist

   - [ ] Code follows project conventions and patterns
   - [ ] All acceptance criteria implemented and tested
   - [ ] Unit tests written and passing
   - [ ] Integration tests updated if needed
   - [ ] Documentation updated (API docs, README, etc.)
   - [ ] No security vulnerabilities introduced
   - [ ] Performance impact acceptable
   - [ ] Mobile compatibility verified (if applicable)

   ## State Recovery

   **Execution ID**: `{{EXECUTION_ID}}`  
   **State File**: Available for resumption
   ```

5. **REQUIRED**: Enhanced GitHub Collaboration Setup:

   ```bash
   # Set up complete GitHub workflow for team collaboration
   setup_github_collaboration() {
     echo "👥 SETTING UP GITHUB COLLABORATION WORKFLOW..."

     # 1. Issue Assignment Management
     CURRENT_ASSIGNEE=$(gh issue view $ISSUE_NUMBER --json assignees --jq '.assignees[0].login')

     if [ -z "$CURRENT_ASSIGNEE" ]; then
       echo "📝 Assigning issue to current implementer..."
       gh issue edit $ISSUE_NUMBER --add-assignee "@me"
     fi

     # 2. Add implementation tracking labels
     gh issue edit $ISSUE_NUMBER --add-label "in-progress,copilot-agent"

     # 3. Link issue to PR properly
     gh pr edit $PR_NUMBER --body "$(cat <<EOF
   Closes #$ISSUE_NUMBER

   🤖 **Autonomous Implementation**: This PR was created by GitHub Copilot coding agent

   $(gh pr view $PR_NUMBER --json body --jq '.body')
   EOF
   )"

     # 4. Set up PR for proper review workflow
     PR_REVIEWERS=$(determine_pr_reviewers "$ISSUE_TYPE" "$SERVICE_CONTEXT")

     if [ ! -z "$PR_REVIEWERS" ]; then
       echo "👨‍💻 Requesting reviews from: $PR_REVIEWERS"
       gh pr edit $PR_NUMBER --add-reviewer "$PR_REVIEWERS"
     fi

     # 5. Add appropriate PR labels based on issue analysis
     PR_LABELS=$(determine_pr_labels "$ISSUE_TYPE" "$SERVICE_CONTEXT" "$CURRENT_PHASE")
     gh pr edit $PR_NUMBER --add-label "$PR_LABELS"

     # 6. Set up milestone tracking if issue has milestone
     ISSUE_MILESTONE=$(gh issue view $ISSUE_NUMBER --json milestone --jq '.milestone.title')
     if [ ! -z "$ISSUE_MILESTONE" ] && [ "$ISSUE_MILESTONE" != "null" ]; then
       echo "🎯 Linking PR to milestone: $ISSUE_MILESTONE"
       gh pr edit $PR_NUMBER --milestone "$ISSUE_MILESTONE"
     fi

     # 7. Add project board tracking
     PROJECT_BOARDS=$(gh issue view $ISSUE_NUMBER --json projectCards --jq '.projectCards[].project.name')
     for PROJECT in $PROJECT_BOARDS; do
       echo "📋 Linking PR to project: $PROJECT"
       gh pr edit $PR_NUMBER --add-project "$PROJECT"
     done

     echo "✅ GitHub collaboration workflow configured"
   }

   # Execute collaboration setup
   setup_github_collaboration
   ```

6. **REQUIRED**: Smart Reviewer Assignment Logic:

   ```bash
   # Determine appropriate reviewers based on issue context
   determine_pr_reviewers() {
     local ISSUE_TYPE="$1"
     local SERVICE_CONTEXT="$2"

     case "$ISSUE_TYPE" in
       "database"|"migration")
         echo "backend-team,database-expert"
         ;;
       "api"|"backend")
         echo "backend-team,api-reviewer"
         ;;
       "pwa-development"|"native-mobile"|"mobile-*")
         echo "frontend-team,mobile-expert"
         ;;
       "security"|"compliance")
         echo "security-team,lead-developer"
         ;;
       "performance"|"optimization")
         echo "devops-team,performance-expert"
         ;;
       *)
         # Default: assign to team lead or senior developer
         echo "tech-lead"
         ;;
     esac
   }

   # Determine appropriate PR labels
   determine_pr_labels() {
     local ISSUE_TYPE="$1"
     local SERVICE_CONTEXT="$2"
     local CURRENT_PHASE="$3"

     local LABELS="copilot-implementation"

     # Add phase label
     LABELS="$LABELS,$CURRENT_PHASE"

     # Add type-specific labels
     case "$ISSUE_TYPE" in
       "database"|"migration") LABELS="$LABELS,database,backend" ;;
       "api"|"backend") LABELS="$LABELS,api,backend" ;;
       "pwa-development") LABELS="$LABELS,pwa,frontend,mobile" ;;
       "native-mobile") LABELS="$LABELS,react-native,mobile,frontend" ;;
       "ios-deployment") LABELS="$LABELS,ios,deployment,mobile" ;;
       "android-deployment") LABELS="$LABELS,android,deployment,mobile" ;;
       "security") LABELS="$LABELS,security,high-priority" ;;
       "performance") LABELS="$LABELS,performance,optimization" ;;
     esac

     # Add service context labels
     case "$SERVICE_CONTEXT" in
       "binboard"|"foundational") LABELS="$LABELS,binboard-service" ;;
       "snapsort"|"ai-processing") LABELS="$LABELS,snapsort-service" ;;
       "scansell"|"payment") LABELS="$LABELS,scansell-service" ;;
       "marketmate"|"marketplace") LABELS="$LABELS,marketmate-service" ;;
       "mobile-*"|"progressive-web-app") LABELS="$LABELS,mobile-client" ;;
     esac

     echo "$LABELS"
   }
   ```

7. **CHECKPOINT**: Update state and post progress comment

## 2️⃣ ANALYSIS & CONTEXT BUILDING

**Enhanced context building with persistence**

### Step 2A: Deep Issue Analysis

1. **REQUIRED**: Comprehensive requirement analysis:
   - Parse acceptance criteria into testable conditions
   - Identify file dependencies and integration points
   - Analyze repository structure and existing patterns
   - Document architectural decisions needed

### Step 2B: Context File Enhancement

2. **REQUIRED**: Build extended context file:

   ```markdown
   # Extended Implementation Context

   ## Requirements Matrix

   | Criterion | Testable Condition | Target Files | Dependencies |
   | --------- | ------------------ | ------------ | ------------ |
   | ...       | ...                | ...          | ...          |

   ## Code Architecture Analysis

   [Repository structure, patterns, integration points]

   ## Implementation Strategy

   [High-level approach, file changes, testing approach]
   ```

3. **CHECKPOINT**: Update state with analysis complete

## 3️⃣ INTELLIGENT TASK DECOMPOSITION WITH SMART SEQUENCING

**Dynamic task breakdown with dependency-aware execution ordering**

### Step 3A: Context-Aware Task Breakdown

1. **REQUIRED**: Generate tasks based on issue type and dependencies:
   ```json
   // State update: intelligent subtasks with smart sequencing
   "subtasks": [
     {
       "id": 1,
       "title": "Dependency validation and setup",
       "type": "prerequisite",
       "dependencies": [],
       "targetFiles": ["package.json", "prisma/schema.prisma"],
       "acceptanceCriteria": ["all_dependencies_available"],
       "estimatedComplexity": "low",
       "testingStrategy": "validation",
       "blockingForNext": true,
       "serviceContext": "foundational"
     },
     {
       "id": 2,
       "title": "Core implementation",
       "type": "implementation",
       "dependencies": [1],
       "targetFiles": ["src/services/item-service.ts"],
       "acceptanceCriteria": [1, 2, 3],
       "estimatedComplexity": "high",
       "testingStrategy": "unit",
       "blockingForNext": false,
       "serviceContext": "backend",
       "integrationPoints": ["auth-service", "database"]
     },
     {
       "id": 3,
       "title": "Integration layer updates",
       "type": "integration",
       "dependencies": [2],
       "targetFiles": ["src/api-gateway/routes.ts"],
       "acceptanceCriteria": [4, 5],
       "estimatedComplexity": "medium",
       "testingStrategy": "integration",
       "blockingForNext": false,
       "serviceContext": "integration"
     }
   ]
   ```

### Step 3B: Smart Execution Order Resolution

2. **REQUIRED**: Resolve optimal execution sequence:

   ```bash
   # Dependency resolution algorithm
   resolve_execution_order() {
     # Build dependency graph
     DEPENDENCY_GRAPH=$(build_task_graph "$SUBTASKS")

     # Topological sort for optimal order
     EXECUTION_ORDER=$(topological_sort "$DEPENDENCY_GRAPH")

     # Identify parallel opportunities
     PARALLEL_GROUPS=$(find_parallelizable_tasks "$EXECUTION_ORDER")

     echo "📋 EXECUTION PLAN:"
     echo "Sequential: $EXECUTION_ORDER"
     echo "Parallel opportunities: $PARALLEL_GROUPS"
   }
   ```

### Step 3C: Next Action Determination Logic

3. **REQUIRED**: Implement smart "what's next" logic:

   ```bash
   # Determine next action based on current state
   determine_next_action() {
     local CURRENT_STATE="$1"

     # Check for completed tasks
     COMPLETED_TASKS=$(jq '.stepCompletions.step4.subtaskCompletions[] | select(.status == "completed") | .id' "$STATE_FILE")

     # Find next available task
     for task_id in $EXECUTION_ORDER; do
       TASK_DEPS=$(jq ".subtasks[] | select(.id == $task_id) | .dependencies[]" "$STATE_FILE")

       # Check if all dependencies are satisfied
       DEPS_SATISFIED=true
       for dep in $TASK_DEPS; do
         if ! echo "$COMPLETED_TASKS" | grep -q "$dep"; then
           DEPS_SATISFIED=false
           break
         fi
       done

       if [ "$DEPS_SATISFIED" = "true" ]; then
         echo "🎯 NEXT ACTION: Execute subtask $task_id"
         return $task_id
       fi
     done

     echo "✅ ALL TASKS COMPLETE: Ready for validation"
     return 0
   }
   ```

4. **CHECKPOINT**: State updated with intelligent execution plan

## 4️⃣ ADAPTIVE IMPLEMENTATION WITH SMART SEQUENCING

**Dynamic implementation loop with intelligent next-action determination**

### Step 4A: Smart Subtask Execution Engine

**ADAPTIVE LOOP: Execute tasks in optimal order based on dependency resolution**

```bash
# Intelligent subtask execution with auto-sequencing
execute_next_available_subtask() {
  # Determine what can be executed now
  NEXT_TASK_ID=$(determine_next_action "$CURRENT_STATE")

  if [ "$NEXT_TASK_ID" = "0" ]; then
    echo "✅ All subtasks complete, advancing to validation"
    return 0
  fi

  # Load task context
  TASK_DATA=$(jq ".subtasks[] | select(.id == $NEXT_TASK_ID)" "$STATE_FILE")
  TASK_TYPE=$(echo "$TASK_DATA" | jq -r '.type')
  SERVICE_CONTEXT=$(echo "$TASK_DATA" | jq -r '.serviceContext')

  echo "🔨 Executing Task $NEXT_TASK_ID: $TASK_TYPE in $SERVICE_CONTEXT context"

  # Execute task with appropriate workflow
  case "$TASK_TYPE" in
    "prerequisite")
      execute_prerequisite_task "$TASK_DATA"
      ;;
    "implementation")
      execute_implementation_task "$TASK_DATA"
      ;;
    "integration")
      execute_integration_task "$TASK_DATA"
      ;;
    "testing")
      execute_testing_task "$TASK_DATA"
      ;;
  esac

  # Update state and determine next action
  mark_subtask_complete "$NEXT_TASK_ID"

  # Recursive call to continue with next available task
  execute_next_available_subtask
}
```

### Step 4B: Context-Aware Task Execution

**Each task type has specialized execution logic:**

```bash
# Specialized execution functions
execute_implementation_task() {
  local TASK_DATA="$1"

  # Load service-specific context
  load_service_context "$SERVICE_CONTEXT"

  # Implementation steps adapted to task
  analyze_target_files
  implement_with_patterns
  write_contextual_tests
  validate_integration_points

  # Service-specific validations
  if [ "$SERVICE_CONTEXT" = "backend" ]; then
    validate_api_contracts
    test_database_integration
  elif [ "$SERVICE_CONTEXT" = "integration" ]; then
    validate_cross_service_communication
    test_authentication_flow
  fi
}

execute_integration_task() {
  local TASK_DATA="$1"

  # Integration-specific logic
  validate_service_interfaces
  implement_integration_layer
  test_cross_service_functionality
  validate_data_flow
}
```

### Step 4C: Automatic Next-Action Determination

**Smart progression logic eliminates manual sequencing:**

```bash
# After each task completion, automatically determine next steps
post_task_completion_logic() {
  local COMPLETED_TASK_ID="$1"

  # Update dependency satisfaction for waiting tasks
  update_dependency_status "$COMPLETED_TASK_ID"

  # Check if any blocked tasks are now unblocked
  NEWLY_AVAILABLE=$(find_newly_available_tasks)

  if [ ! -z "$NEWLY_AVAILABLE" ]; then
    echo "🚀 New tasks available: $NEWLY_AVAILABLE"
    # Automatically continue execution
    execute_next_available_subtask
  else
    echo "⏳ Waiting for other dependencies..."
    # Save state and exit gracefully
    save_execution_state "waiting_dependencies"
  fi
}
```

### Step 4D: Error Recovery with Smart Rollback

- **Dependency-Aware Recovery**: Understand which tasks are affected by failures
- **Service Context Recovery**: Restore appropriate service state
- **Smart Resume**: Automatically determine best resume point after error resolution

## 5️⃣ COMPREHENSIVE VERIFICATION WITH STATE TRACKING

**Complete validation with persistent results**

### Step 5A: Multi-Phase Validation

1. **Unit Test Validation**: Run all unit tests, record results
2. **Integration Testing**: Run integration test suite
3. **Acceptance Criteria Testing**: Systematically test each criterion
4. **Performance Validation**: Run performance benchmarks if applicable
5. **Security Validation**: Run security scans if applicable

### Step 5B: Results Documentation

2. **REQUIRED**: Document all validation results:

   ```json
   // State update: validation results
   "validationResults": {
     "unitTests": { "passed": 25, "failed": 0, "coverage": 95.2 },
     "integrationTests": { "passed": 8, "failed": 0 },
     "acceptanceCriteria": [
       { "criterion": "...", "status": "PASS", "evidence": "..." }
     ],
     "overallStatus": "PASS"
   }
   ```

3. **CHECKPOINT**: All validation must PASS to proceed

## 6️⃣ FINALIZATION WITH STATE CLEANUP

**Complete finalization with proper state management**

### Step 6A: PR Finalization with Complete Team Workflow

1. **REQUIRED**: Update PR to production-ready state with full team collaboration:

   ```bash
   # Complete PR finalization for team review
   finalize_pr_for_team_review() {
     echo "🎯 FINALIZING PR FOR TEAM REVIEW..."

     # 1. Remove DRAFT status and update title
     NEW_TITLE="✅ Implement #${ISSUE_NUMBER} · ${ISSUE_TITLE}"
     gh pr ready $PR_NUMBER
     gh pr edit $PR_NUMBER --title "$NEW_TITLE"

     # 2. Update PR description with completion status
     gh pr edit $PR_NUMBER --body "$(cat <<EOF
   # ✅ COMPLETED: Implement #${ISSUE_NUMBER} · ${ISSUE_TITLE}

   🤖 **Copilot Agent Implementation COMPLETE** - Execution ID: \`${EXECUTION_ID}\`

   ## ✅ Final Implementation State
   - ✅ **All Steps Complete**: 6/6 steps successfully executed
   - ✅ **All Acceptance Criteria Met**: $(count_completed_criteria)
   - ✅ **All Tests Passing**: $(get_test_status)
   - ✅ **Code Review Ready**: Full implementation complete

   ## 🔗 Issue Resolution
   Closes #${ISSUE_NUMBER}

   ## ✅ Completed Acceptance Criteria
   $(format_completed_acceptance_criteria)

   ## 🧪 Testing Summary
   - **Unit Tests**: $(get_unit_test_summary)
   - **Integration Tests**: $(get_integration_test_summary)
   - **Acceptance Tests**: $(get_acceptance_test_summary)

   ## 📁 Files Changed
   $(gh pr diff --name-only | sed 's/^/- /')

   ## 🔧 Implementation Details
   $(get_implementation_summary)

   ## 👥 Review Checklist
   - [x] Code follows project conventions and patterns
   - [x] All acceptance criteria implemented and tested
   - [x] Unit tests written and passing
   - [x] Integration tests updated if needed
   - [x] Documentation updated (API docs, README, etc.)
   - [x] No security vulnerabilities introduced
   - [x] Performance impact acceptable
   - [x] Mobile compatibility verified (Phase 5 only)

   ## 🤖 Autonomous Implementation Summary
   This PR was autonomously implemented by GitHub Copilot coding agent:
   - **Total Time**: $(calculate_total_implementation_time)
   - **State Management**: Full execution state preserved throughout
   - **Error Recovery**: $(count_recovered_errors) errors handled and recovered
   - **Context Management**: $(get_context_efficiency_stats)

   **Ready for human review and merge approval** 🚀
   EOF
   )"

     # 3. Ensure proper reviewer assignment (refresh/validate)
     CURRENT_REVIEWERS=$(gh pr view $PR_NUMBER --json reviewRequests --jq '.reviewRequests[].login')
     REQUIRED_REVIEWERS=$(determine_pr_reviewers "$ISSUE_TYPE" "$SERVICE_CONTEXT")

     for REVIEWER in $(echo $REQUIRED_REVIEWERS | tr ',' ' '); do
       if ! echo "$CURRENT_REVIEWERS" | grep -q "$REVIEWER"; then
         echo "➕ Adding reviewer: $REVIEWER"
         gh pr edit $PR_NUMBER --add-reviewer "$REVIEWER"
       fi
     done

     # 4. Add final status labels
     gh pr edit $PR_NUMBER --add-label "ready-for-review,copilot-complete,needs-approval"
     gh pr edit $PR_NUMBER --remove-label "draft,in-progress"

     # 5. Request specific review from team leads for critical changes
     if [[ "$ISSUE_TYPE" == *"security"* ]] || [[ "$ISSUE_TYPE" == *"database"* ]] || [[ "$SERVICE_CONTEXT" == *"foundational"* ]]; then
       echo "🔐 High-impact change detected - requesting tech lead review"
       gh pr edit $PR_NUMBER --add-reviewer "tech-lead,security-reviewer"
       gh pr edit $PR_NUMBER --add-label "high-impact,requires-lead-approval"
     fi

     # 6. Add PR to appropriate review queue/project board
     add_pr_to_review_queue "$PR_NUMBER" "$ISSUE_TYPE" "$SERVICE_CONTEXT"

     echo "✅ PR finalized and ready for team review"
   }

   finalize_pr_for_team_review
   ```

### Step 6B: Enhanced Issue State Management with Team Workflow

2. **REQUIRED**: Update issue state with complete team collaboration tracking:

   ```bash
   # Enhanced issue finalization with team workflow
   finalize_issue_for_team_review() {
     echo "📋 FINALIZING ISSUE FOR TEAM REVIEW..."

     # 1. Post comprehensive completion comment
     gh issue comment $ISSUE_NUMBER --body "## 🤖 AUTONOMOUS IMPLEMENTATION COMPLETE

   ✅ **Implementation Status**: All acceptance criteria met and validated
   🔗 **Pull Request**: #$PR_NUMBER - Ready for human review
   ⏱️ **Implementation Time**: $(calculate_total_implementation_time)
   🧪 **Test Results**: All tests passing
   📁 **Files Changed**: $(gh pr diff --name-only $PR_NUMBER | wc -l) files modified

   ### ✅ Completed Acceptance Criteria
   $(format_completed_acceptance_criteria)

   ### 🔄 Next Steps
   1. **Code Review**: PR #$PR_NUMBER requires human review
   2. **Approval**: Team lead approval needed for merge
   3. **Merge**: Once approved, PR can be merged to complete issue
   4. **Verification**: Post-merge verification of functionality

   **State**: Implementation complete, awaiting human review and approval"

     # 2. Update issue labels for team workflow
     gh issue edit $ISSUE_NUMBER --remove-label "in-progress,copilot-agent"
     gh issue edit $ISSUE_NUMBER --add-label "implemented,awaiting-review,copilot-complete"

     # 3. Assign to appropriate reviewer/maintainer for final approval
     ISSUE_REVIEWER=$(determine_issue_reviewer "$ISSUE_TYPE" "$SERVICE_CONTEXT")
     if [ ! -z "$ISSUE_REVIEWER" ]; then
       echo "👤 Assigning issue to reviewer: $ISSUE_REVIEWER"
       gh issue edit $ISSUE_NUMBER --add-assignee "$ISSUE_REVIEWER"
     fi

     # 4. Link to milestone completion tracking
     update_milestone_progress "$ISSUE_NUMBER"

     # 5. Update project board status
     update_project_board_status "$ISSUE_NUMBER" "Ready for Review"

     echo "✅ Issue finalized and assigned for team review"
   }

   finalize_issue_for_team_review
   ```

### Step 6C: Complete Development Lifecycle Management

3. **REQUIRED**: Full development lifecycle completion with proper handoffs:

   ```bash
   # Complete development lifecycle management
   complete_development_lifecycle() {
     echo "🔄 COMPLETING DEVELOPMENT LIFECYCLE..."

     # 1. Verify Issue/PR linkage is complete and proper
     verify_issue_pr_linkage() {
       PR_CLOSES_ISSUE=$(gh pr view $PR_NUMBER --json body --jq '.body' | grep -i "closes #$ISSUE_NUMBER")
       if [ -z "$PR_CLOSES_ISSUE" ]; then
         echo "⚠️ WARNING: PR does not properly close issue #$ISSUE_NUMBER"
         gh pr edit $PR_NUMBER --body "Closes #$ISSUE_NUMBER\n\n$(gh pr view $PR_NUMBER --json body --jq '.body')"
       fi
       echo "✅ Issue/PR linkage verified"
     }

     # 2. Create comprehensive handoff documentation
     create_handoff_documentation() {
       cat > "/tmp/handoff-${EXECUTION_ID}.md" << EOF
   # Development Handoff Document
   **Execution ID**: ${EXECUTION_ID}
   **Issue**: #${ISSUE_NUMBER} - ${ISSUE_TITLE}
   **Pull Request**: #${PR_NUMBER}
   **Completion Time**: $(date)

   ## Implementation Summary
   $(get_implementation_summary)

   ## Files Modified
   $(gh pr diff --name-only $PR_NUMBER)

   ## Testing Results
   $(get_comprehensive_test_results)

   ## Review Instructions
   1. **Code Review Focus Areas**:
      $(get_review_focus_areas "$ISSUE_TYPE" "$SERVICE_CONTEXT")

   2. **Testing Verification**:
      $(get_testing_verification_instructions)

   3. **Deployment Considerations**:
      $(get_deployment_considerations)

   ## Dependencies & Integration Points
   $(get_dependency_integration_summary)

   ## Post-Merge Actions Required
   $(get_post_merge_actions)

   ## Contact & Support
   - **Implementation State**: Preserved in ${STATE_FILE}
   - **Execution Logs**: Available in ${CONTEXT_FILE}
   - **Recovery Instructions**: Available if re-execution needed
   EOF

       echo "📋 Handoff documentation created: /tmp/handoff-${EXECUTION_ID}.md"
     }

     # 3. Set up post-merge automation triggers
     setup_post_merge_automation() {
       # Add labels that will trigger appropriate automation after merge
       gh pr edit $PR_NUMBER --add-label "auto-deploy-staging,auto-run-integration-tests"

       # If this is a mobile client change, trigger mobile build pipeline
       if [[ "$SERVICE_CONTEXT" == *"mobile"* ]] || [[ "$ISSUE_TYPE" == *"mobile"* ]]; then
         gh pr edit $PR_NUMBER --add-label "trigger-mobile-build"
       fi

       # If this is an API change, trigger API documentation update
       if [[ "$ISSUE_TYPE" == "api"* ]] || [[ "$SERVICE_CONTEXT" == "backend" ]]; then
         gh pr edit $PR_NUMBER --add-label "update-api-docs"
       fi

       echo "🤖 Post-merge automation triggers configured"
     }

     # Execute all lifecycle completion steps
     verify_issue_pr_linkage
     create_handoff_documentation
     setup_post_merge_automation

     echo "✅ Development lifecycle completion configured"
   }

   complete_development_lifecycle
   ```

4. **FINAL CHECKPOINT**:

   ```markdown
   ✅ EXECUTION COMPLETE - {{EXECUTION_ID}}

   📊 **Final State**: All 6 steps completed successfully
   🔗 **PR Ready**: [PR_URL] - Ready for human review
   📋 **Issue Updated**: #{{ISSUE_NUMBER}} marked as implemented
   🧹 **State Cleaned**: Execution artifacts archived

   **Human Review Required**: Code review and merge approval
   ```

5. **CONTINUOUS OPERATION**: Auto-select next issue and continue

   ```bash
   # Execute continuous development cycle
   echo "🔄 CHECKING FOR NEXT READY ISSUE..."

   # Update project state with completed work
   update_project_state_completion "$ISSUE_NUMBER"

   # Check for newly available work
   NEXT_AVAILABLE=$(find_next_ready_issue)

   if [ ! -z "$NEXT_AVAILABLE" ]; then
     echo "🚀 CONTINUOUS OPERATION: Starting Issue #$NEXT_AVAILABLE"

     # Archive current execution state
     mv "$STATE_FILE" "/tmp/completed/state-${EXECUTION_ID}.json"
     mv "$CONTEXT_FILE" "/tmp/completed/context-${EXECUTION_ID}.md"

     # Start new execution with next issue
     export ISSUE_NUMBER="$NEXT_AVAILABLE"
     exec "$0" # Restart entire workflow with new issue
   else
     echo "⏳ NO MORE READY ISSUES: Entering wait mode"
     echo "🎯 NEXT ACTIONS: Waiting for dependencies to be resolved or new issues to be created"
     echo "🔔 MONITOR: Will check again in 30 minutes or on git push events"
   fi
   ```

---

## 🔧 TOOL OPTIMIZATION & CONTEXT EFFICIENCY

### Context Management Strategy

1. **State File Usage**: Maintain minimal state in JSON for quick loading
2. **Context File Usage**: Detailed context in markdown for human readability
3. **Temporary Files**: Use `/tmp` for intermediate results and context
4. **Memory Optimization**: Periodically summarize and compress context

### Tool Usage Optimization

1. **Batch Operations**: Group related GitHub API calls
2. **Local Caching**: Cache repository analysis in temp files
3. **Incremental Updates**: Only update changed state portions
4. **Context Chunking**: Split large contexts into manageable chunks

### Error Handling & Recovery

1. **Graceful Degradation**: Continue with reduced functionality if non-critical tools fail
2. **State Preservation**: Always save state before risky operations
3. **Resume Points**: Multiple resume points within each step
4. **Rollback Capability**: Ability to rollback to previous stable state

### Model Failure Resilience & Auto-Recovery

1. **Token Limit Management**:

   ```bash
   # Automatic context compression when approaching limits
   handle_token_limit_exceeded() {
     echo "⚠️ TOKEN LIMIT EXCEEDED: Compressing context and retrying..."

     # Compress context file to essential information only
     COMPRESSED_CONTEXT=$(summarize_context "$CONTEXT_FILE" --max-tokens 2000)

     # Save full context backup
     cp "$CONTEXT_FILE" "${CONTEXT_FILE}.backup"

     # Replace with compressed version
     echo "$COMPRESSED_CONTEXT" > "$CONTEXT_FILE"

     # Retry operation with compressed context
     retry_last_operation --context-compressed
   }
   ```

2. **Model Timeout & Retry Strategy**:

   ```bash
   # Exponential backoff for model failures
   execute_with_model_resilience() {
     local OPERATION="$1"
     local MAX_RETRIES=5
     local RETRY_COUNT=0
     local BACKOFF_SECONDS=1

     while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
       echo "🤖 Attempting model operation (try $((RETRY_COUNT + 1))/$MAX_RETRIES)..."

       if execute_model_operation "$OPERATION"; then
         echo "✅ Model operation successful"
         return 0
       else
         RETRY_COUNT=$((RETRY_COUNT + 1))
         BACKOFF_SECONDS=$((BACKOFF_SECONDS * 2))

         echo "❌ Model operation failed (try $RETRY_COUNT/$MAX_RETRIES)"

         if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
           echo "⏳ Backing off for $BACKOFF_SECONDS seconds..."
           sleep $BACKOFF_SECONDS

           # Apply resilience strategy
           case "$RETRY_COUNT" in
             1) echo "🔄 Retry 1: Simple retry with same context" ;;
             2) echo "📉 Retry 2: Compressing context size"; compress_context ;;
             3) echo "✂️ Retry 3: Chunking operation"; chunk_operation "$OPERATION" ;;
             4) echo "🛟 Retry 4: Fallback to simpler approach"; use_fallback_strategy ;;
           esac
         fi
       fi
     done

     echo "🚨 MODEL FAILURE: All retries exhausted, triggering recovery mode"
     handle_persistent_model_failure "$OPERATION"
   }
   ```

3. **Context Chunking for Large Operations**:

   ```bash
   # Break large operations into smaller chunks
   chunk_operation() {
     local OPERATION="$1"

     echo "✂️ CHUNKING OPERATION: Breaking into smaller pieces..."

     case "$OPERATION" in
       "analyze_codebase")
         # Analyze files in batches of 5
         for file_batch in $(ls src/ | split_into_batches 5); do
           analyze_file_batch "$file_batch"
           save_intermediate_results "$file_batch"
         done
         merge_chunked_results
         ;;
       "implement_large_feature")
         # Break feature into subtasks
         SUBTASKS=$(decompose_feature_into_chunks "$OPERATION")
         for subtask in $SUBTASKS; do
           implement_with_model_resilience "$subtask"
         done
         ;;
       "generate_large_codeblock")
         # Generate code in smaller functions
         generate_function_by_function "$OPERATION"
         ;;
     esac
   }
   ```

4. **Persistent Failure Recovery**:

   ```bash
   # Handle cases where model consistently fails
   handle_persistent_model_failure() {
     local FAILED_OPERATION="$1"

     echo "🆘 PERSISTENT MODEL FAILURE detected"

     # Save current state with failure context
     jq --arg op "$FAILED_OPERATION" --arg timestamp "$(date -Iseconds)" \
       '.modelFailure = {operation: $op, timestamp: $timestamp, retriesExhausted: true}' \
       "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

     # Attempt fallback strategies
     case "$FAILED_OPERATION" in
       "code_generation")
         echo "🛟 FALLBACK: Switching to template-based code generation"
         use_template_based_generation
         ;;
       "code_analysis")
         echo "🛟 FALLBACK: Using static analysis tools instead of AI"
         use_static_analysis_fallback
         ;;
       "test_generation")
         echo "🛟 FALLBACK: Using test templates and patterns"
         use_test_template_generation
         ;;
       *)
         echo "🚨 NO FALLBACK AVAILABLE: Triggering human handoff"
         trigger_human_handoff "$FAILED_OPERATION"
         ;;
     esac
   }
   ```

5. **Human Handoff for Unrecoverable Failures**:

   ```bash
   # Graceful handoff when autonomous recovery fails
   trigger_human_handoff() {
     local FAILED_OPERATION="$1"

     # Create comprehensive handoff document
     cat > "/tmp/handoff-${EXECUTION_ID}.md" << EOF
   # 🆘 HUMAN HANDOFF REQUIRED - ${EXECUTION_ID}

   ## Failure Summary
   - **Failed Operation**: $FAILED_OPERATION
   - **Issue**: #${ISSUE_NUMBER} - $(get_issue_title)
   - **Failure Time**: $(date)
   - **Retries Attempted**: 5 (all exhausted)

   ## Current Progress
   $(summarize_current_progress)

   ## Next Actions Needed
   1. Review model failure logs in ${STATE_FILE}
   2. Consider manual implementation of: $FAILED_OPERATION
   3. Resume execution from checkpoint: $(get_current_checkpoint)

   ## Resume Command
   \`\`\`bash
   # After manual intervention:
   ./resume_execution.sh ${EXECUTION_ID} --checkpoint $(get_current_checkpoint)
   \`\`\`
   EOF

     # Create GitHub issue for human intervention
     gh issue comment $ISSUE_NUMBER --body "🤖 **Autonomous Agent Handoff**

   Model failure encountered during: \`$FAILED_OPERATION\`

   📋 **Handoff Document**: \`/tmp/handoff-${EXECUTION_ID}.md\`
   🔄 **State Preserved**: Ready for manual intervention and resume

   @$(git config user.name) Please review and continue manually."

     echo "👤 HUMAN HANDOFF: Created handoff document and GitHub comment"
     echo "⏸️ PAUSING: Autonomous execution suspended pending human intervention"

     # Exit gracefully, preserving all state
     exit 42 # Special exit code for human handoff required
   }
   ```

6. **Context Reconstruction After Model Failures**:

   ```bash
   # Rebuild context from state files after model failures
   reconstruct_context_from_state() {
     echo "🔧 RECONSTRUCTING CONTEXT from preserved state..."

     # Load essential context from state file
     ISSUE_CONTEXT=$(jq -r '.issueData' "$STATE_FILE")
     PROGRESS_CONTEXT=$(jq -r '.stepCompletions' "$STATE_FILE")
     IMPLEMENTATION_CONTEXT=$(jq -r '.implementationContext' "$STATE_FILE")

     # Rebuild minimal context file
     cat > "$CONTEXT_FILE" << EOF
   # Reconstructed Context - ${EXECUTION_ID}

   ## Issue Context
   $ISSUE_CONTEXT

   ## Progress Summary
   $PROGRESS_CONTEXT

   ## Implementation State
   $IMPLEMENTATION_CONTEXT

   ## Recovery Notes
   - Context reconstructed from state after model failure
   - Previous context backed up to ${CONTEXT_FILE}.backup
   - Ready to resume with compressed context
   EOF

     echo "✅ Context reconstructed successfully"
   }
   ```

---

## ⚠️ ENHANCED EXECUTION RULES

### Non-Interactive Execution Requirements

- **AUTONOMOUS OPERATION**: Run until completion without human intervention
- **STATE PRESERVATION**: Maintain state through all operations
- **REENTRANT BEHAVIOR**: Resume from any interruption point
- **ERROR RESILIENCE**: Handle and recover from all error conditions
- **CONTEXT EFFICIENCY**: Optimize token usage through external storage
- **MODEL FAILURE RESILIENCE**: Automatic retry, context compression, and graceful degradation

### Critical State Management Rules

- **ATOMIC UPDATES**: Update state atomically to prevent corruption
- **CHECKPOINT VALIDATION**: Verify state consistency at each checkpoint
- **RECOVERY PREPARATION**: Always prepare for resumption at current state
- **PROGRESS TRACKING**: Maintain visible progress for external monitoring
- **FAILURE STATE TRACKING**: Record model failures and recovery attempts in state

### Model Operation Best Practices

- **PRE-OPERATION STATE SAVE**: Always save state before model-intensive operations
- **CONTEXT SIZE MONITORING**: Check context size before operations, compress if needed
- **CHUNKED OPERATIONS**: Break large operations into smaller, manageable pieces
- **FALLBACK READINESS**: Prepare simpler alternatives for complex model operations
- **FAILURE LOGGING**: Log all model failures with context for debugging

### Recovery & Resume Capabilities

- **AUTOMATIC RETRY**: Up to 5 retries with exponential backoff for model failures
- **CONTEXT COMPRESSION**: Automatic context reduction when hitting token limits
- **OPERATION CHUNKING**: Break large operations into smaller pieces when needed
- **FALLBACK STRATEGIES**: Use simpler approaches when AI model approaches fail
- **HUMAN HANDOFF**: Graceful handoff with complete state preservation when all else fails

### Completion Criteria

- **ALL STEPS COMPLETE**: Steps 0-6 fully executed and validated
- **ALL CRITERIA MET**: Every acceptance criterion validated and passing
- **PR READY**: Pull request ready for human review and merge
- **STATE CLEAN**: Execution state properly cleaned and archived

**EXECUTION START**:

**Mode 1 (Chat)**: Begin with project analysis and issue selection, then proceed through steps 0-6
**Mode 2 (Script)**: Wrapper script manages continuous execution and state persistence  
**Mode 3 (Extension)**: Full UI integration with progress monitoring and human interaction

Only conclude when STATE="COMPLETE" and all criteria validated, or human handoff triggered (exit 42).
