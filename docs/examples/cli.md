# CLI Examples - Multi-Language Support

This page provides comprehensive examples of using the ast-copilot-helper CLI tool across all 15 supported languages.

## Multi-Language Overview

AST Copilot Helper supports 15 programming languages organized in 3 performance tiers:

- **Tier 1 (Enterprise)**: TypeScript, JavaScript, Python, Java, C++, C#
- **Tier 2 (Developer)**: Go, Rust, PHP, Ruby, Swift
- **Tier 3 (Specialized)**: Kotlin, Scala, Dart, Lua

## Basic Multi-Language Usage

### Parsing Single Files by Language

```bash
# Enterprise Tier Languages
ast-copilot-helper parse main.ts                    # TypeScript
ast-copilot-helper parse app.js                     # JavaScript
ast-copilot-helper parse main.py                    # Python
ast-copilot-helper parse Main.java                  # Java
ast-copilot-helper parse main.cpp                   # C++
ast-copilot-helper parse Program.cs                 # C#

# Developer Tier Languages
ast-copilot-helper parse main.go                    # Go
ast-copilot-helper parse main.rs                    # Rust
ast-copilot-helper parse index.php                  # PHP
ast-copilot-helper parse app.rb                     # Ruby
ast-copilot-helper parse ViewController.swift       # Swift

# Specialized Tier Languages
ast-copilot-helper parse MainActivity.kt            # Kotlin
ast-copilot-helper parse Main.scala                 # Scala
ast-copilot-helper parse main.dart                  # Dart
ast-copilot-helper parse script.lua                 # Lua
```

### Multi-Language Project Analysis

```bash
# Parse entire polyglot project
ast-copilot-helper parse ./ --languages "typescript,python,go,rust"

# Parse with automatic language detection
ast-copilot-helper parse ./ --auto-detect --exclude "**/node_modules/**,**/.git/**"

# Parse specific language tiers
ast-copilot-helper parse ./ --tier 1                # Enterprise languages only
ast-copilot-helper parse ./ --tier 1,2              # Enterprise + Developer tiers
ast-copilot-helper parse ./ --tier all               # All supported languages

# Parse with language-specific output
ast-copilot-helper parse ./ --output-per-language --format json
```

### Language-Specific File Patterns

```bash
# Parse all supported file types
ast-copilot-helper parse ./ --pattern "**/*.{ts,tsx,js,jsx,py,java,cpp,hpp,cs,go,rs,php,rb,swift,kt,scala,dart,lua}"

# Parse web development stack
ast-copilot-helper parse ./ --pattern "**/*.{ts,tsx,js,jsx,php,py}"

# Parse system programming languages
ast-copilot-helper parse ./ --pattern "**/*.{cpp,hpp,c,h,rs,go,cs}"

# Parse mobile development languages
ast-copilot-helper parse ./ --pattern "**/*.{swift,kt,dart,java}"
```

## Language-Specific Query Examples

### TypeScript/JavaScript Analysis

```bash
# Find React components
ast-copilot-helper query src/ --language typescript --type "FunctionDeclaration" --pattern ".*Component$"

# Find async/await usage
ast-copilot-helper query src/ --language javascript --type "AwaitExpression"

# Find interface definitions
ast-copilot-helper query src/ --language typescript --type "TSInterfaceDeclaration"

# Find import statements
ast-copilot-helper query src/ --language typescript --type "ImportDeclaration" --source "@/*"
```

### Python Analysis

```bash
# Find class definitions with inheritance
ast-copilot-helper query src/ --language python --type "ClassDef" --bases

# Find async functions
ast-copilot-helper query src/ --language python --type "AsyncFunctionDef"

# Find decorator usage
ast-copilot-helper query src/ --language python --type "FunctionDef" --decorator "@*"

# Find exception handling
ast-copilot-helper query src/ --language python --type "Try"
```

### Java Analysis

```bash
# Find public classes
ast-copilot-helper query src/ --language java --type "class_declaration" --modifier "public"

# Find annotation usage
ast-copilot-helper query src/ --language java --type "annotation"

# Find interface implementations
ast-copilot-helper query src/ --language java --type "class_declaration" --implements

# Find method overrides
ast-copilot-helper query src/ --language java --type "method_declaration" --annotation "@Override"
```

### C++ Analysis

```bash
# Find template definitions
ast-copilot-helper query src/ --language cpp --type "template_declaration"

# Find namespace usage
ast-copilot-helper query src/ --language cpp --type "namespace_definition"

# Find class inheritance
ast-copilot-helper query src/ --language cpp --type "class_specifier" --base_clause

# Find virtual functions
ast-copilot-helper query src/ --language cpp --type "function_definition" --virtual
```

### Go Analysis

```bash
# Find interface definitions
ast-copilot-helper query src/ --language go --type "interface_type"

# Find goroutine usage
ast-copilot-helper query src/ --language go --type "go_statement"

# Find channel operations
ast-copilot-helper query src/ --language go --type "send_statement,receive_expression"

# Find struct methods
ast-copilot-helper query src/ --language go --type "method_declaration"
```

### Rust Analysis

```bash
# Find trait definitions
ast-copilot-helper query src/ --language rust --type "trait_item"

# Find impl blocks
ast-copilot-helper query src/ --language rust --type "impl_item"

# Find unsafe blocks
ast-copilot-helper query src/ --language rust --type "unsafe_block"

# Find macro usage
ast-copilot-helper query src/ --language rust --type "macro_invocation"
```

## Cross-Language Analysis

### Find Similar Patterns Across Languages

```bash
# Find function definitions across all languages
ast-copilot-helper query ./ --cross-language --pattern "function|def|func|fn" --type "function"

# Find class definitions across OOP languages
ast-copilot-helper query ./ --languages "typescript,python,java,cpp,cs,swift,kotlin,scala,dart" --type "class"

# Find error handling across languages
ast-copilot-helper query ./ --cross-language --pattern "try|catch|except|Result|Error" --type "error_handling"
```

### Compare Implementation Patterns

```bash
# Compare async patterns across languages
ast-copilot-helper compare ./ --pattern "async" --languages "typescript,python,cs,rust,dart"

# Compare interface/trait patterns
ast-copilot-helper compare ./ --pattern "interface|trait|protocol" --languages "typescript,go,rust,swift"

# Compare dependency injection patterns
ast-copilot-helper compare ./ --pattern "inject|dependency" --languages "typescript,java,cs,swift,kotlin"
```

## Performance-Optimized Commands

### Tier-Based Processing

```bash
# Process high-performance languages first
ast-copilot-helper parse ./ --tier-priority --parallel 4

# Process with memory optimization
ast-copilot-helper parse ./ --memory-limit 512MB --batch-size auto

# Process with streaming for large codebases
ast-copilot-helper parse ./ --streaming --progress
```

### Language-Specific Batch Processing

```bash
# Process enterprise languages with larger batches
ast-copilot-helper parse ./ --tier 1 --batch-size 50 --parallel 4

# Process specialized languages with smaller batches
ast-copilot-helper parse ./ --tier 3 --batch-size 10 --parallel 2

# Mixed processing with adaptive batching
ast-copilot-helper parse ./ --adaptive-batching --memory-limit 1GB
```

## Multi-Language Reporting

### Generate Language Statistics

```bash
# Generate comprehensive language report
ast-copilot-helper stats ./ --languages all --output stats-report.json

# Generate tier-based statistics
ast-copilot-helper stats ./ --group-by-tier --format table

# Generate file distribution by language
ast-copilot-helper stats ./ --file-distribution --chart
```

### Language Complexity Analysis

```bash
# Analyze complexity across languages
ast-copilot-helper complexity ./ --languages all --metric cyclomatic

# Compare complexity between languages
ast-copilot-helper complexity ./ --compare-languages --threshold 10

# Generate complexity heatmap
ast-copilot-helper complexity ./ --heatmap --output complexity-map.html
```

## Security Analysis Across Languages

### Language-Specific Security Checks

```bash
# JavaScript/TypeScript security checks
ast-copilot-helper security ./ --languages "typescript,javascript" --check "xss,injection,eval"

# Python security analysis
ast-copilot-helper security ./ --language python --check "injection,pickle,yaml"

# Java security scanning
ast-copilot-helper security ./ --language java --check "deserialization,injection,path_traversal"

# C++ vulnerability detection
ast-copilot-helper security ./ --language cpp --check "buffer_overflow,memory_leak,null_pointer"

# Cross-language security report
ast-copilot-helper security ./ --cross-language --severity high --report security-audit.html
```

## Migration and Refactoring

### Cross-Language Code Migration

```bash
# Analyze migration from JavaScript to TypeScript
ast-copilot-helper migrate ./ --from javascript --to typescript --dry-run

# Find Python 2 to 3 migration issues
ast-copilot-helper migrate ./ --language python --version-upgrade "2->3" --report

# Analyze Java version compatibility
ast-copilot-helper migrate ./ --language java --target-version 17 --compatibility-check
```

### API Usage Analysis

```bash
# Find deprecated API usage across languages
ast-copilot-helper api-usage ./ --deprecated --languages all

# Track library dependency versions
ast-copilot-helper dependencies ./ --outdated --security-check

# Analyze breaking changes impact
ast-copilot-helper breaking-changes ./ --from-version "1.0" --to-version "2.0"
```

## Advanced Multi-Language Examples

### Microservices Analysis

```bash
# Analyze polyglot microservices
ast-copilot-helper microservices ./ --services-config services.yml --cross-service-calls

# Find inter-service dependencies
ast-copilot-helper dependencies ./ --cross-language --service-boundaries

# Generate architecture diagram
ast-copilot-helper architecture ./ --polyglot --output architecture.svg
```

### Code Quality Metrics

```bash
# Multi-language quality assessment
ast-copilot-helper quality ./ --languages all --metrics "complexity,maintainability,testability"

# Generate quality report
ast-copilot-helper quality ./ --report --format html --output quality-report.html

# Compare quality between language implementations
ast-copilot-helper quality ./ --compare-implementations --pattern ".*Service$"
```

### Documentation Generation

```bash
# Generate API documentation for all languages
ast-copilot-helper docs ./ --api --languages all --format markdown

# Create cross-reference documentation
ast-copilot-helper docs ./ --cross-references --output docs/

# Generate language-specific style guides
ast-copilot-helper style-guide ./ --per-language --output style-guides/
```

### Code Quality Checks

```bash
# Find unused variables
ast-copilot-helper analyze src/ --unused-vars

# Find complex functions (high cyclomatic complexity)
ast-copilot-helper analyze src/ --complexity-threshold 10

# Find long parameter lists
ast-copilot-helper query src/ --type "FunctionDeclaration" --param-count ">5"
```

## Integration Examples

### With Git Hooks

```bash
# Pre-commit hook example
#!/bin/bash
# Check staged files for code quality
staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$')
if [ ! -z "$staged_files" ]; then
  ast-copilot-helper analyze $staged_files --fail-on-error
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
          node-version: "24"
      - name: Install ast-copilot-helper
        run: npm install -g ast-copilot-helper
      - name: Run analysis
        run: ast-copilot-helper analyze src/ --format junit --output analysis-results.xml
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
ast-copilot-helper parse src/main.ts --format json | jq '.functions[].name'

# Count functions by type
ast-copilot-helper query src/ --type "FunctionDeclaration" --format json | jq 'group_by(.async) | map({async: .[0].async, count: length})'

# Extract complex metrics
ast-copilot-helper analyze src/ --format json | jq '.metrics.complexity | sort_by(.score) | reverse'
```

### CSV Export for Spreadsheet Analysis

```bash
# Export function metrics to CSV
ast-copilot-helper analyze src/ --format csv --output functions.csv

# Export dependency graph
ast-copilot-helper query src/ --type "ImportDeclaration" --format csv --output dependencies.csv
```

## Workspace Analysis

### Multi-Package Repository

```bash
# Analyze entire monorepo
ast-copilot-helper analyze . --recursive --exclude "**/node_modules/**" --exclude "**/dist/**"

# Package-specific analysis
ast-copilot-helper analyze packages/core/ --context workspace
ast-copilot-helper analyze packages/cli/ --context workspace

# Cross-package dependency analysis
ast-copilot-helper query . --type "ImportDeclaration" --cross-package --format graph
```

### Framework-Specific Analysis

```bash
# React component analysis
ast-copilot-helper query src/ --type "FunctionDeclaration,ArrowFunctionExpression" --react-component

# Express route analysis
ast-copilot-helper query src/ --type "CallExpression" --callee "app.get,app.post,app.put,app.delete"

# Database query analysis
ast-copilot-helper query src/ --type "CallExpression" --callee "query,execute" --context database
```

## Troubleshooting Examples

### Debug Mode

```bash
# Enable verbose logging
ast-copilot-helper parse src/main.ts --verbose --debug

# Show timing information
ast-copilot-helper analyze src/ --timing

# Validate parser output
ast-copilot-helper parse src/main.ts --validate --strict
```

### Error Handling

```bash
# Continue on parse errors
ast-copilot-helper parse src/ --continue-on-error

# Set custom error handling
ast-copilot-helper parse src/ --error-handler warn

# Export error report
ast-copilot-helper parse src/ --error-report errors.json
```

## Performance Tips

### Optimizing Large Codebases

```bash
# Use parallel processing
ast-copilot-helper parse src/ --parallel --workers 4

# Cache results for repeated analysis
ast-copilot-helper parse src/ --cache --cache-dir .ast-cache

# Incremental analysis (only changed files)
ast-copilot-helper parse src/ --incremental --since HEAD~1
```

### Memory Management

```bash
# Set memory limits
ast-copilot-helper parse large-project/ --max-memory 2GB

# Process in chunks
ast-copilot-helper parse src/ --chunk-size 100

# Stream processing for very large files
ast-copilot-helper parse huge-file.js --stream
```

## See Also

- [CLI API Reference](../api/cli.md) - Complete command reference
- [Configuration Guide](../guide/configuration.md) - Configuration options
- [Troubleshooting](../troubleshooting.md) - Common issues and solutions
- [Advanced Tutorials](../examples/index.md) - Step-by-step tutorials

# Simple text search

ast-copilot-helper query "user authentication"

# Search by type

ast-copilot-helper query "config" --type interface
ast-copilot-helper query "helper" --type function  
ast-copilot-helper query "manager" --type class

# Search in specific files/directories

ast-copilot-helper query "validation" --file "src/utils/\*\*"
ast-copilot-helper query "api" --file "src/api/routes.ts"

# Limit and format results

ast-copilot-helper query "error" --limit 5 --format table
ast-copilot-helper query "user" --format json --output results.json

````

#### Advanced Queries

```bash
# Semantic search with AI
ast-copilot-helper query "database connection management" --mode semantic
ast-copilot-helper query "user input sanitization" --mode semantic

# Complex filtering
ast-copilot-helper query "auth" \
  --type function \
  --file "src/auth/**" \
  --min-score 0.8 \
  --limit 10

# Multi-type search
ast-copilot-helper query "user" --type "function,class,interface"

# Export queries
ast-copilot-helper query "*" --type function --format csv > functions.csv
ast-copilot-helper query "*" --format json | jq '.[] | select(.type == "class")'
````

## Real-World Use Cases

### Use Case 1: Code Review Preparation

**Scenario**: Preparing for a code review by analyzing recent changes.

```bash
# Get list of changed files from git
CHANGED_FILES=$(git diff --name-only HEAD~5 HEAD | grep -E '\.(ts|js|py)$')

# Parse only changed files
echo "$CHANGED_FILES" | xargs ast-copilot-helper parse

# Find all functions in changed files
for file in $CHANGED_FILES; do
  echo "=== $file ==="
  ast-copilot-helper query "*" --type function --file "$file" --format table
done

# Look for potential issues
ast-copilot-helper query "TODO|FIXME|HACK" --file "$CHANGED_FILES"
ast-copilot-helper query "deprecated" --file "$CHANGED_FILES"

# Find complex functions (by description patterns)
ast-copilot-helper query "complex|complicated|refactor" --type function
```

### Use Case 2: API Documentation Generation

**Scenario**: Automatically generating API documentation from code.

````bash
# Parse API routes
ast-copilot-helper parse src/api/ src/routes/ src/controllers/

# Extract API endpoints
ast-copilot-helper query "route|endpoint|controller" --type function --format json > api-endpoints.json

# Generate markdown documentation
ast-copilot-helper export --type function --file "src/api/**" --format markdown > API.md

# Create API reference with specific format
cat > generate-api-docs.sh << 'EOF'
#!/bin/bash

echo "# API Documentation" > API-Reference.md
echo "" >> API-Reference.md

# Get all route handlers
ast-copilot-helper query "route|endpoint" --type function --format json | \
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
ast-copilot-helper parse . --recursive --exclude "node_modules/**" --exclude "dist/**"

# Generate project overview
ast-copilot-helper stats --detailed > project-overview.txt

# Find deprecated patterns
ast-copilot-helper query "deprecated|legacy|old|outdated" --format json > deprecated-code.json

# Find large/complex functions (heuristic based on description keywords)
ast-copilot-helper query "complex|large|refactor|cleanup" --type function --format table

# Find potential security issues
ast-copilot-helper query "password|token|secret|auth|security" --format json > security-review.json

# Find database-related code for migration planning
ast-copilot-helper query "database|db|sql|query|connection" --format table

# Generate migration report
cat > legacy-analysis.sh << 'EOF'
#!/bin/bash

echo "# Legacy Code Analysis Report" > legacy-report.md
echo "Generated: $(date)" >> legacy-report.md
echo "" >> legacy-report.md

echo "## Project Statistics" >> legacy-report.md
ast-copilot-helper stats --format markdown >> legacy-report.md

echo "## Deprecated Code" >> legacy-report.md
ast-copilot-helper query "deprecated|legacy|fixme" --format markdown >> legacy-report.md

echo "## Database Code" >> legacy-report.md
ast-copilot-helper query "database|sql|query" --format markdown >> legacy-report.md

echo "Report generated: legacy-report.md"
EOF

chmod +x legacy-analysis.sh
./legacy-analysis.sh
```

### Use Case 4: Refactoring Assistant

**Scenario**: Finding related code for refactoring operations.

```bash
# Find all usages of a specific pattern
ast-copilot-helper query "UserManager" --type class
ast-copilot-helper query "user management" --format json

# Find similar functions for consistent refactoring
ast-copilot-helper query "validation" --type function --format json | \
  jq '.[] | select(.name | contains("validate"))'

# Find duplicate or similar logic
ast-copilot-helper query "duplicate|similar|copy" --format table

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
ast-copilot-helper query "$COMPONENT" --type function --format markdown >> refactor-$COMPONENT.md

echo "## Related Classes" >> refactor-$COMPONENT.md
ast-copilot-helper query "$COMPONENT" --type class --format markdown >> refactor-$COMPONENT.md

echo "## Related Interfaces" >> refactor-$COMPONENT.md
ast-copilot-helper query "$COMPONENT" --type interface --format markdown >> refactor-$COMPONENT.md

echo "Refactoring plan generated: refactor-$COMPONENT.md"
EOF

chmod +x refactoring-plan.sh
./refactoring-plan.sh "authentication"
```

### Use Case 5: Testing Coverage Analysis

**Scenario**: Finding untested code and understanding test coverage gaps.

```bash
# Parse both source and test files
ast-copilot-helper parse src/ test/ --recursive

# Find all test functions
ast-copilot-helper query "test|spec|describe|it" --type function --format json > tests.json

# Find source functions that might need tests
ast-copilot-helper query "*" --type function --file "src/**" --format json > source-functions.json

# Create coverage analysis script
cat > test-coverage-analysis.sh << 'EOF'
#!/bin/bash

echo "# Test Coverage Analysis" > coverage-analysis.md
echo "" >> coverage-analysis.md

# Get all source functions
SOURCE_FUNCTIONS=$(ast-copilot-helper query "*" --type function --file "src/**" --format json | jq -r '.[].name')

echo "## Potentially Untested Functions" >> coverage-analysis.md
echo "" >> coverage-analysis.md

for func in $SOURCE_FUNCTIONS; do
  # Check if function name appears in test files
  if ! ast-copilot-helper query "$func" --file "test/**" --format json | grep -q "$func"; then
    echo "- \`$func\`" >> coverage-analysis.md
  fi
done

echo "" >> coverage-analysis.md
echo "## Test Statistics" >> coverage-analysis.md
echo "- Total source functions: $(echo "$SOURCE_FUNCTIONS" | wc -l)" >> coverage-analysis.md
echo "- Total test functions: $(ast-copilot-helper query "test|it|describe" --type function --format json | jq length)" >> coverage-analysis.md

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
  echo "$CHANGED_FILES" | xargs ast-copilot-helper parse

  # Check for issues in changed files
  for file in $CHANGED_FILES; do
    issues=$(ast-copilot-helper query "TODO|FIXME|HACK" --file "$file" --format json)
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
ast-copilot-helper init --yes
ast-copilot-helper parse src/ --recursive

# Generate reports
mkdir -p reports

# Project statistics
ast-copilot-helper stats --format json > reports/project-stats.json

# Export function list
ast-copilot-helper query "*" --type function --format json > reports/functions.json

# Export class list
ast-copilot-helper query "*" --type class --format json > reports/classes.json

# Check for issues
ast-copilot-helper query "TODO|FIXME|HACK|DEPRECATED" --format json > reports/issues.json

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
  ast-copilot-helper init --yes
  ast-copilot-helper parse src/ --recursive

  # Generate project report
  ast-copilot-helper stats --format json > "../reports/$project-stats.json"
  ast-copilot-helper query "*" --format json > "../reports/$project-all.json"

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
ast-copilot-helper query "*" --type function --format json | \
jq -r '.[] | "- **\(.name)** (\(.filePath):\(.lineNumber))\n  \(.description // "No description")\n"'

# Function complexity heuristic
ast-copilot-helper query "*" --type function --format json | \
jq -r '.[] | select(.description | test("complex|large|refactor")) |
  "🔴 \(.name) - \(.filePath) - \(.description)"'

# Generate function index
ast-copilot-helper query "*" --type function --format json | \
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
ast-copilot-helper parse src/ --incremental --watch

# Use appropriate batch sizes
ast-copilot-helper parse src/ --batch-size 100 --max-concurrent 2

# Parse only changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
echo "$CHANGED_FILES" | grep -E '\.(ts|js|py)$' | xargs ast-copilot-helper parse

# Profile parsing performance
ast-copilot-helper parse src/ --profile --output parsing-performance.json
```

### Query Optimization

```bash
# Use specific file patterns to limit search scope
ast-copilot-helper query "auth" --file "src/auth/**" --file "src/security/**"

# Limit results for better performance
ast-copilot-helper query "function" --limit 50 --min-score 0.7

# Cache frequent queries
CACHE_DIR=".ast-copilot-helper-cache"
mkdir -p "$CACHE_DIR"

query_with_cache() {
  local query_hash=$(echo "$1" | md5sum | cut -d' ' -f1)
  local cache_file="$CACHE_DIR/$query_hash.json"

  if [ -f "$cache_file" ] && [ "$cache_file" -nt ".ast-copilot-helper.db" ]; then
    cat "$cache_file"
  else
    ast-copilot-helper query "$1" --format json | tee "$cache_file"
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
ast-copilot-helper parse src/ --progress 2>&1 | tee parsing.log
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
