# CLI Examples

This page provides practical examples of using the ast-copilot-helper CLI tool for various tasks.

## Basic Usage

### Parsing a Single File

```bash
# Parse a TypeScript file and output AST
ast-helper parse src/main.ts

# Parse with specific output format
ast-helper parse src/main.ts --format json

# Parse and save to file
ast-helper parse src/main.ts --output ast-output.json
```

### Parsing Multiple Files

```bash
# Parse all TypeScript files in a directory
ast-helper parse src/ --recursive --include "*.ts"

# Parse specific file types
ast-helper parse src/ --include "*.ts,*.js" --exclude "*.test.ts"

# Parse with glob patterns
ast-helper parse "src/**/*.{ts,js}" --exclude "**/node_modules/**"
```

## Advanced Queries

### Finding Functions

```bash
# Find all function declarations
ast-helper query src/ --type "FunctionDeclaration"

# Find functions with specific names
ast-helper query src/ --type "FunctionDeclaration" --name "handleError"

# Find async functions
ast-helper query src/ --type "FunctionDeclaration" --async
```

### Finding Classes and Methods

```bash
# Find all class declarations
ast-helper query src/ --type "ClassDeclaration"

# Find methods in a specific class
ast-helper query src/ --type "MethodDefinition" --class "DatabaseManager"

# Find private methods
ast-helper query src/ --type "MethodDefinition" --visibility "private"
```

### Finding Imports and Dependencies

```bash
# Find all import statements
ast-helper query src/ --type "ImportDeclaration"

# Find imports from specific modules
ast-helper query src/ --type "ImportDeclaration" --module "lodash"

# Find dynamic imports
ast-helper query src/ --type "ImportExpression"
```

## Code Analysis Examples

### Security Analysis

```bash
# Find potential security issues
ast-helper analyze src/ --security-check

# Find eval usage (potential security risk)
ast-helper query src/ --type "CallExpression" --callee "eval"

# Find direct DOM manipulation
ast-helper query src/ --type "MemberExpression" --property "innerHTML"
```

### Performance Analysis

```bash
# Find performance anti-patterns
ast-helper analyze src/ --performance-check

# Find synchronous operations that could be async
ast-helper query src/ --type "CallExpression" --sync-in-async

# Find potential memory leaks
ast-helper query src/ --type "EventListener" --no-cleanup
```

### Code Quality Checks

```bash
# Find unused variables
ast-helper analyze src/ --unused-vars

# Find complex functions (high cyclomatic complexity)
ast-helper analyze src/ --complexity-threshold 10

# Find long parameter lists
ast-helper query src/ --type "FunctionDeclaration" --param-count ">5"
```

## Integration Examples

### With Git Hooks

```bash
# Pre-commit hook example
#!/bin/bash
# Check staged files for code quality
staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$')
if [ ! -z "$staged_files" ]; then
  ast-helper analyze $staged_files --fail-on-error
fi
```

### With CI/CD Pipeline

```yaml
# GitHub Actions example
name: Code Analysis
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
      - name: Install ast-helper
        run: npm install -g ast-copilot-helper
      - name: Run analysis
        run: ast-helper analyze src/ --format junit --output analysis-results.xml
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: analysis-results
          path: analysis-results.xml
```

## Custom Output Formats

### JSON Output with jq Processing

```bash
# Parse and extract specific data with jq
ast-helper parse src/main.ts --format json | jq '.functions[].name'

# Count functions by type
ast-helper query src/ --type "FunctionDeclaration" --format json | jq 'group_by(.async) | map({async: .[0].async, count: length})'

# Extract complex metrics
ast-helper analyze src/ --format json | jq '.metrics.complexity | sort_by(.score) | reverse'
```

### CSV Export for Spreadsheet Analysis

```bash
# Export function metrics to CSV
ast-helper analyze src/ --format csv --output functions.csv

# Export dependency graph
ast-helper query src/ --type "ImportDeclaration" --format csv --output dependencies.csv
```

## Workspace Analysis

### Multi-Package Repository

```bash
# Analyze entire monorepo
ast-helper analyze . --recursive --exclude "**/node_modules/**" --exclude "**/dist/**"

# Package-specific analysis
ast-helper analyze packages/core/ --context workspace
ast-helper analyze packages/cli/ --context workspace

# Cross-package dependency analysis
ast-helper query . --type "ImportDeclaration" --cross-package --format graph
```

### Framework-Specific Analysis

```bash
# React component analysis
ast-helper query src/ --type "FunctionDeclaration,ArrowFunctionExpression" --react-component

# Express route analysis
ast-helper query src/ --type "CallExpression" --callee "app.get,app.post,app.put,app.delete"

# Database query analysis
ast-helper query src/ --type "CallExpression" --callee "query,execute" --context database
```

## Troubleshooting Examples

### Debug Mode

```bash
# Enable verbose logging
ast-helper parse src/main.ts --verbose --debug

# Show timing information
ast-helper analyze src/ --timing

# Validate parser output
ast-helper parse src/main.ts --validate --strict
```

### Error Handling

```bash
# Continue on parse errors
ast-helper parse src/ --continue-on-error

# Set custom error handling
ast-helper parse src/ --error-handler warn

# Export error report
ast-helper parse src/ --error-report errors.json
```

## Performance Tips

### Optimizing Large Codebases

```bash
# Use parallel processing
ast-helper parse src/ --parallel --workers 4

# Cache results for repeated analysis
ast-helper parse src/ --cache --cache-dir .ast-cache

# Incremental analysis (only changed files)
ast-helper parse src/ --incremental --since HEAD~1
```

### Memory Management

```bash
# Set memory limits
ast-helper parse large-project/ --max-memory 2GB

# Process in chunks
ast-helper parse src/ --chunk-size 100

# Stream processing for very large files
ast-helper parse huge-file.js --stream
```

## See Also

- [CLI API Reference](../api/cli.md) - Complete command reference
- [Configuration Guide](../guide/configuration.md) - Configuration options
- [Troubleshooting](../troubleshooting.md) - Common issues and solutions
- [Advanced Tutorials](../examples/index.md) - Step-by-step tutorials

# Simple text search

ast-helper query "user authentication"

# Search by type

ast-helper query "config" --type interface
ast-helper query "helper" --type function  
ast-helper query "manager" --type class

# Search in specific files/directories

ast-helper query "validation" --file "src/utils/\*\*"
ast-helper query "api" --file "src/api/routes.ts"

# Limit and format results

ast-helper query "error" --limit 5 --format table
ast-helper query "user" --format json --output results.json

````

#### Advanced Queries

```bash
# Semantic search with AI
ast-helper query "database connection management" --mode semantic
ast-helper query "user input sanitization" --mode semantic

# Complex filtering
ast-helper query "auth" \
  --type function \
  --file "src/auth/**" \
  --min-score 0.8 \
  --limit 10

# Multi-type search
ast-helper query "user" --type "function,class,interface"

# Export queries
ast-helper query "*" --type function --format csv > functions.csv
ast-helper query "*" --format json | jq '.[] | select(.type == "class")'
````

## Real-World Use Cases

### Use Case 1: Code Review Preparation

**Scenario**: Preparing for a code review by analyzing recent changes.

```bash
# Get list of changed files from git
CHANGED_FILES=$(git diff --name-only HEAD~5 HEAD | grep -E '\.(ts|js|py)$')

# Parse only changed files
echo "$CHANGED_FILES" | xargs ast-helper parse

# Find all functions in changed files
for file in $CHANGED_FILES; do
  echo "=== $file ==="
  ast-helper query "*" --type function --file "$file" --format table
done

# Look for potential issues
ast-helper query "TODO|FIXME|HACK" --file "$CHANGED_FILES"
ast-helper query "deprecated" --file "$CHANGED_FILES"

# Find complex functions (by description patterns)
ast-helper query "complex|complicated|refactor" --type function
```

### Use Case 2: API Documentation Generation

**Scenario**: Automatically generating API documentation from code.

````bash
# Parse API routes
ast-helper parse src/api/ src/routes/ src/controllers/

# Extract API endpoints
ast-helper query "route|endpoint|controller" --type function --format json > api-endpoints.json

# Generate markdown documentation
ast-helper export --type function --file "src/api/**" --format markdown > API.md

# Create API reference with specific format
cat > generate-api-docs.sh << 'EOF'
#!/bin/bash

echo "# API Documentation" > API-Reference.md
echo "" >> API-Reference.md

# Get all route handlers
ast-helper query "route|endpoint" --type function --format json | \
jq -r '.[] | "## \(.name)\n\n**File:** \(.filePath)\n\n**Description:** \(.description // "No description")\n\n```typescript\n\(.signature // .name)\n```\n"' >> API-Reference.md

echo "API documentation generated: API-Reference.md"
EOF

chmod +x generate-api-docs.sh
./generate-api-docs.sh
````

### Use Case 3: Legacy Code Analysis

**Scenario**: Analyzing a large legacy codebase to understand structure and find modernization opportunities.

```bash
# Parse entire codebase
ast-helper parse . --recursive --exclude "node_modules/**" --exclude "dist/**"

# Generate project overview
ast-helper stats --detailed > project-overview.txt

# Find deprecated patterns
ast-helper query "deprecated|legacy|old|outdated" --format json > deprecated-code.json

# Find large/complex functions (heuristic based on description keywords)
ast-helper query "complex|large|refactor|cleanup" --type function --format table

# Find potential security issues
ast-helper query "password|token|secret|auth|security" --format json > security-review.json

# Find database-related code for migration planning
ast-helper query "database|db|sql|query|connection" --format table

# Generate migration report
cat > legacy-analysis.sh << 'EOF'
#!/bin/bash

echo "# Legacy Code Analysis Report" > legacy-report.md
echo "Generated: $(date)" >> legacy-report.md
echo "" >> legacy-report.md

echo "## Project Statistics" >> legacy-report.md
ast-helper stats --format markdown >> legacy-report.md

echo "## Deprecated Code" >> legacy-report.md
ast-helper query "deprecated|legacy|fixme" --format markdown >> legacy-report.md

echo "## Database Code" >> legacy-report.md
ast-helper query "database|sql|query" --format markdown >> legacy-report.md

echo "Report generated: legacy-report.md"
EOF

chmod +x legacy-analysis.sh
./legacy-analysis.sh
```

### Use Case 4: Refactoring Assistant

**Scenario**: Finding related code for refactoring operations.

```bash
# Find all usages of a specific pattern
ast-helper query "UserManager" --type class
ast-helper query "user management" --format json

# Find similar functions for consistent refactoring
ast-helper query "validation" --type function --format json | \
  jq '.[] | select(.name | contains("validate"))'

# Find duplicate or similar logic
ast-helper query "duplicate|similar|copy" --format table

# Create refactoring checklist
cat > refactoring-plan.sh << 'EOF'
#!/bin/bash

COMPONENT=$1
if [ -z "$COMPONENT" ]; then
  echo "Usage: ./refactoring-plan.sh <component-name>"
  exit 1
fi

echo "# Refactoring Plan: $COMPONENT" > refactor-$COMPONENT.md
echo "" >> refactor-$COMPONENT.md

echo "## Related Functions" >> refactor-$COMPONENT.md
ast-helper query "$COMPONENT" --type function --format markdown >> refactor-$COMPONENT.md

echo "## Related Classes" >> refactor-$COMPONENT.md
ast-helper query "$COMPONENT" --type class --format markdown >> refactor-$COMPONENT.md

echo "## Related Interfaces" >> refactor-$COMPONENT.md
ast-helper query "$COMPONENT" --type interface --format markdown >> refactor-$COMPONENT.md

echo "Refactoring plan generated: refactor-$COMPONENT.md"
EOF

chmod +x refactoring-plan.sh
./refactoring-plan.sh "authentication"
```

### Use Case 5: Testing Coverage Analysis

**Scenario**: Finding untested code and understanding test coverage gaps.

```bash
# Parse both source and test files
ast-helper parse src/ test/ --recursive

# Find all test functions
ast-helper query "test|spec|describe|it" --type function --format json > tests.json

# Find source functions that might need tests
ast-helper query "*" --type function --file "src/**" --format json > source-functions.json

# Create coverage analysis script
cat > test-coverage-analysis.sh << 'EOF'
#!/bin/bash

echo "# Test Coverage Analysis" > coverage-analysis.md
echo "" >> coverage-analysis.md

# Get all source functions
SOURCE_FUNCTIONS=$(ast-helper query "*" --type function --file "src/**" --format json | jq -r '.[].name')

echo "## Potentially Untested Functions" >> coverage-analysis.md
echo "" >> coverage-analysis.md

for func in $SOURCE_FUNCTIONS; do
  # Check if function name appears in test files
  if ! ast-helper query "$func" --file "test/**" --format json | grep -q "$func"; then
    echo "- \`$func\`" >> coverage-analysis.md
  fi
done

echo "" >> coverage-analysis.md
echo "## Test Statistics" >> coverage-analysis.md
echo "- Total source functions: $(echo "$SOURCE_FUNCTIONS" | wc -l)" >> coverage-analysis.md
echo "- Total test functions: $(ast-helper query "test|it|describe" --type function --format json | jq length)" >> coverage-analysis.md

echo "Coverage analysis generated: coverage-analysis.md"
EOF

chmod +x test-coverage-analysis.sh
./test-coverage-analysis.sh
```

## Advanced CLI Patterns

### Pipeline Integration

```bash
# Use with git hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Parse changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|py)$')

if [ ! -z "$CHANGED_FILES" ]; then
  echo "Analyzing changed files..."
  echo "$CHANGED_FILES" | xargs ast-helper parse

  # Check for issues in changed files
  for file in $CHANGED_FILES; do
    issues=$(ast-helper query "TODO|FIXME|HACK" --file "$file" --format json)
    if [ "$issues" != "[]" ]; then
      echo "Warning: Found issues in $file"
      echo "$issues" | jq -r '.[] | "  - \(.name): \(.description)"'
    fi
  done
fi
EOF

chmod +x .git/hooks/pre-commit
```

### Continuous Integration

```bash
# CI script for code analysis
cat > scripts/ci-code-analysis.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting code analysis..."

# Initialize and parse
ast-helper init --yes
ast-helper parse src/ --recursive

# Generate reports
mkdir -p reports

# Project statistics
ast-helper stats --format json > reports/project-stats.json

# Export function list
ast-helper query "*" --type function --format json > reports/functions.json

# Export class list
ast-helper query "*" --type class --format json > reports/classes.json

# Check for issues
ast-helper query "TODO|FIXME|HACK|DEPRECATED" --format json > reports/issues.json

# Generate summary
FUNCTIONS=$(jq length reports/functions.json)
CLASSES=$(jq length reports/classes.json)
ISSUES=$(jq length reports/issues.json)

echo "Analysis complete:"
echo "- Functions: $FUNCTIONS"
echo "- Classes: $CLASSES"
echo "- Issues found: $ISSUES"

# Fail if too many issues
if [ "$ISSUES" -gt 10 ]; then
  echo "Too many issues found ($ISSUES > 10)"
  exit 1
fi
EOF

chmod +x scripts/ci-code-analysis.sh
```

### Batch Operations

```bash
# Process multiple projects
cat > process-projects.sh << 'EOF'
#!/bin/bash

PROJECTS=(
  "project-a"
  "project-b"
  "project-c"
)

for project in "${PROJECTS[@]}"; do
  echo "Processing $project..."
  cd "$project"

  # Initialize and parse
  ast-helper init --yes
  ast-helper parse src/ --recursive

  # Generate project report
  ast-helper stats --format json > "../reports/$project-stats.json"
  ast-helper query "*" --format json > "../reports/$project-all.json"

  cd ..
done

echo "All projects processed. Reports in ./reports/"
EOF

chmod +x process-projects.sh
./process-projects.sh
```

### Custom Output Processing

```bash
# Create custom formatters
cat > format-functions.sh << 'EOF'
#!/bin/bash

# Custom function list formatter
ast-helper query "*" --type function --format json | \
jq -r '.[] | "- **\(.name)** (\(.filePath):\(.lineNumber))\n  \(.description // "No description")\n"'

# Function complexity heuristic
ast-helper query "*" --type function --format json | \
jq -r '.[] | select(.description | test("complex|large|refactor")) |
  "🔴 \(.name) - \(.filePath) - \(.description)"'

# Generate function index
ast-helper query "*" --type function --format json | \
jq -r 'group_by(.filePath) | .[] |
  "## \(.[0].filePath)\n\n" +
  (map("- \(.name): \(.description // "No description")") | join("\n")) +
  "\n"'
EOF

chmod +x format-functions.sh
./format-functions.sh > function-index.md
```

## Performance Optimization

### Efficient Parsing Strategies

```bash
# Parse incrementally for large projects
ast-helper parse src/ --incremental --watch

# Use appropriate batch sizes
ast-helper parse src/ --batch-size 100 --max-concurrent 2

# Parse only changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
echo "$CHANGED_FILES" | grep -E '\.(ts|js|py)$' | xargs ast-helper parse

# Profile parsing performance
ast-helper parse src/ --profile --output parsing-performance.json
```

### Query Optimization

```bash
# Use specific file patterns to limit search scope
ast-helper query "auth" --file "src/auth/**" --file "src/security/**"

# Limit results for better performance
ast-helper query "function" --limit 50 --min-score 0.7

# Cache frequent queries
CACHE_DIR=".ast-helper-cache"
mkdir -p "$CACHE_DIR"

query_with_cache() {
  local query_hash=$(echo "$1" | md5sum | cut -d' ' -f1)
  local cache_file="$CACHE_DIR/$query_hash.json"

  if [ -f "$cache_file" ] && [ "$cache_file" -nt ".ast-helper.db" ]; then
    cat "$cache_file"
  else
    ast-helper query "$1" --format json | tee "$cache_file"
  fi
}

# Usage
query_with_cache "user authentication"
```

## Integration Examples

### With Build Tools

```bash
# Webpack integration
npm install --save-dev ast-copilot-helper-webpack-plugin

# Add to webpack.config.js:
# const AstCopilotHelperPlugin = require('ast-copilot-helper-webpack-plugin');
#
# module.exports = {
#   plugins: [
#     new AstCopilotHelperPlugin({
#       patterns: ['src/**/*.{ts,js}'],
#       outputPath: './dist/ast-analysis.json'
#     })
#   ]
# };
```

### With Monitoring

```bash
# Monitor parsing performance
cat > monitor-parsing.sh << 'EOF'
#!/bin/bash

start_time=$(date +%s)
ast-helper parse src/ --progress 2>&1 | tee parsing.log
end_time=$(date +%s)
duration=$((end_time - start_time))

echo "Parsing took $duration seconds" >> parsing-performance.log
echo "$(date): $duration seconds" >> parsing-performance.log

# Send to monitoring system (example)
curl -X POST "http://monitoring-system/metrics" \
  -H "Content-Type: application/json" \
  -d "{\"metric\": \"ast_parsing_duration\", \"value\": $duration, \"timestamp\": $(date +%s)}"
EOF
```

These examples demonstrate the flexibility and power of the ast-copilot-helper CLI for various code analysis workflows. Adapt these patterns to your specific needs and integrate them into your development process.
