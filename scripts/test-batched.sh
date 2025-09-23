#!/bin/bash
# Batched test execution script to work around memory limitations
# This allows running the full test suite in memory-safe chunks

set -e

echo "🧪 Running batched test execution to avoid memory limits"
echo "⚡ Each batch runs independently to prevent memory accumulation"
echo ""

# Set memory options
export NODE_OPTIONS="--max-old-space-size=4096"

# Test batch categories
BATCHES=(
    "packages/ast-helper/src/**/*.test.ts"
    "packages/ast-mcp-server/**/*.test.ts"
    "packages/vscode-extension/**/*.test.ts"
    "tests/unit/**/*.test.ts"
    "tests/integration/**/*.test.ts"
)

TOTAL_PASSED=0
TOTAL_SKIPPED=0
TOTAL_FAILED=0
FAILED_BATCHES=()

echo "📊 Test Batch Execution Results:"
echo "================================"

for i in "${!BATCHES[@]}"; do
    BATCH="${BATCHES[$i]}"
    echo ""
    echo "🔄 Running batch $((i+1))/${#BATCHES[@]}: $BATCH"
    
    if yarn vitest run "$BATCH" --reporter=basic --no-coverage 2>/dev/null; then
        echo "✅ Batch $((i+1)) completed successfully"
        
        # Extract test counts (simplified for demo)
        BATCH_RESULT=$(yarn vitest run "$BATCH" --reporter=basic --no-coverage 2>&1 | grep -E "Tests|passed|skipped" | tail -1 || echo "")
        if [[ $BATCH_RESULT =~ ([0-9]+)\ passed ]]; then
            TOTAL_PASSED=$((TOTAL_PASSED + ${BASH_REMATCH[1]}))
        fi
        if [[ $BATCH_RESULT =~ ([0-9]+)\ skipped ]]; then
            TOTAL_SKIPPED=$((TOTAL_SKIPPED + ${BASH_REMATCH[1]}))
        fi
    else
        echo "❌ Batch $((i+1)) had issues"
        FAILED_BATCHES+=("Batch $((i+1)): $BATCH")
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
    fi
done

echo ""
echo "📈 Final Batched Test Results:"
echo "=============================="
echo "✅ Total Passed: $TOTAL_PASSED tests"
echo "⏭️ Total Skipped: $TOTAL_SKIPPED tests"
echo "❌ Failed Batches: ${#FAILED_BATCHES[@]}"
echo ""

if [ ${#FAILED_BATCHES[@]} -eq 0 ]; then
    echo "🎉 All test batches completed successfully!"
    echo "💡 This approach avoids memory limits while maintaining full coverage"
    exit 0
else
    echo "⚠️ Some batches had issues:"
    for failed in "${FAILED_BATCHES[@]}"; do
        echo "  - $failed"
    done
    exit 1
fi