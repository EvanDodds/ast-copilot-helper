#!/bin/bash
# Script to post validation summary comment to PR #138
# This script requires GitHub CLI (gh) to be installed and authenticated

set -e

REPO="EvanDodds/ast-copilot-helper"
PR_NUMBER=138
VALIDATION_FILE="PR-138-VALIDATION-SUMMARY.md"

echo "📝 Posting validation summary to PR #${PR_NUMBER}..."

if [ ! -f "$VALIDATION_FILE" ]; then
    echo "❌ Error: Validation summary file not found: $VALIDATION_FILE"
    exit 1
fi

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Error: GitHub CLI is not authenticated"
    echo "Please run: gh auth login"
    exit 1
fi

# Post the comment
echo "Posting comment to PR #${PR_NUMBER}..."
gh pr comment "$PR_NUMBER" --repo "$REPO" --body-file "$VALIDATION_FILE"

echo "✅ Validation summary posted successfully!"
echo "View at: https://github.com/${REPO}/pull/${PR_NUMBER}"
