# Interactive Tutorials

Step-by-step interactive tutorials to help you learn ast-copilot-helper through hands-on practice.

## Tutorial 1: Getting Started with Code Analysis

### Prerequisites

- Node.js 16+ installed
- A TypeScript or JavaScript project to analyze

### Step 1: Installation

```bash
npm install -g ast-copilot-helper
# Verify installation
ast-copilot-helper --version
```

### Step 2: Basic File Parsing

Create a sample TypeScript file to work with:

```typescript
// sample.ts
export class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  async loadConfig(): Promise<any> {
    const response = await fetch("/config.json");
    return response.json();
  }

  get lastResult(): number {
    return this.history[this.history.length - 1];
  }
}

function createCalculator(): Calculator {
  return new Calculator();
}
```

Parse the file:

```bash
ast-copilot-helper parse sample.ts
```

**Expected Output**: AST structure showing class declaration, methods, and properties.

### Step 3: Query for Specific Elements

Find all methods in the class:

```bash
ast-copilot-helper query sample.ts --type "MethodDefinition"
```

Find async functions:

```bash
ast-copilot-helper query sample.ts --type "MethodDefinition" --async
```

### Step 4: Analysis

Run code analysis:

```bash
ast-copilot-helper analyze sample.ts
```

**What to Look For**:

- Method complexity scores
- Async/sync patterns
- Class structure metrics

---

## Tutorial 2: Project-Wide Analysis

### Step 1: Setup Sample Project

Create a sample project structure:

```
my-app/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Modal.tsx
│   ├── utils/
│   │   ├── helpers.ts
│   │   └── api.ts
│   └── index.ts
├── tests/
│   └── utils.test.ts
└── package.json
```

### Step 2: Recursive Parsing

Parse the entire project:

```bash
cd my-app
ast-copilot-helper parse src/ --recursive
```

### Step 3: Find Dependencies

List all import statements:

```bash
ast-copilot-helper query src/ --type "ImportDeclaration" --format table
```

### Step 4: Component Analysis

Find React components (assuming TSX files):

```bash
ast-copilot-helper query src/components/ --type "FunctionDeclaration,ArrowFunctionExpression" --format json
```

### Step 5: Test Coverage Analysis

Find test files and their targets:

```bash
ast-copilot-helper analyze tests/ --test-coverage --source src/
```

---

## Tutorial 3: MCP Server Integration

### Step 1: Start MCP Server

```bash
ast-copilot-helper server --port 3000 --host localhost
```

### Step 2: Connect from AI Agent

Configure your AI agent (Claude, ChatGPT, etc.) to connect to:

```
ws://localhost:3000/mcp
```

### Step 3: Interactive Queries via MCP

From your AI agent, you can now ask:

- "Show me all functions in the src directory"
- "Find potential performance issues"
- "Analyze the complexity of the main module"

### Step 4: Real-time Code Analysis

Make changes to your code and ask:

- "What changed since the last analysis?"
- "Are there any new issues introduced?"

---

## Tutorial 4: VS Code Extension Usage

### Step 1: Install Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "AST Copilot Helper"
4. Install and reload

### Step 2: Activate Extension

1. Open a TypeScript/JavaScript project
2. Open Command Palette (Ctrl+Shift+P)
3. Type "AST Helper" to see available commands

### Step 3: Interactive Code Analysis

1. Right-click on a function
2. Select "AST Helper: Analyze Function"
3. View results in the sidebar

### Step 4: Query Builder

1. Open Command Palette
2. Select "AST Helper: Open Query Builder"
3. Use the UI to build complex queries
4. Run and export results

---

## Tutorial 5: Advanced Configuration

### Step 1: Create Configuration File

Create `.ast-copilot-helper.json` in your project root:

```json
{
  "parsers": {
    "typescript": {
      "strict": true,
      "experimentalDecorators": true
    },
    "javascript": {
      "ecmaVersion": 2022,
      "sourceType": "module"
    }
  },
  "analysis": {
    "complexity": {
      "threshold": 10
    },
    "security": {
      "enabled": true,
      "rules": ["no-eval", "no-innerHTML"]
    }
  },
  "output": {
    "format": "json",
    "includeMetadata": true
  }
}
```

### Step 2: Custom Rules

Add custom analysis rules:

```json
{
  "customRules": [
    {
      "name": "prefer-const",
      "pattern": "let $var = $value",
      "condition": "never_reassigned",
      "message": "Use const instead of let for variables that are never reassigned"
    }
  ]
}
```

### Step 3: Integration with External Tools

Configure integration with ESLint:

```json
{
  "integrations": {
    "eslint": {
      "enabled": true,
      "configPath": ".eslintrc.json"
    },
    "prettier": {
      "enabled": true
    }
  }
}
```

---

## Tutorial 6: Performance Optimization

### Step 1: Baseline Analysis

Run initial performance analysis:

```bash
ast-copilot-helper analyze src/ --timing --memory-usage
```

### Step 2: Enable Caching

```bash
ast-copilot-helper parse src/ --cache --cache-dir .ast-cache
```

### Step 3: Parallel Processing

```bash
ast-copilot-helper analyze src/ --parallel --workers 4
```

### Step 4: Incremental Analysis

After making changes:

```bash
ast-copilot-helper analyze src/ --incremental --since HEAD~1
```

### Step 5: Monitor Performance

```bash
ast-copilot-helper analyze src/ --profile --output profile.json
```

---

## Tutorial 7: Custom Parser Development

### Step 1: Create Parser Plugin

```typescript
// plugins/custom-parser.ts
import { ParserPlugin } from "ast-copilot-helper";

export class CustomLanguageParser implements ParserPlugin {
  name = "custom-language";
  extensions = [".custom"];

  parse(source: string): AST {
    // Custom parsing logic
    return parseCustomLanguage(source);
  }

  query(ast: AST, pattern: string): Node[] {
    // Custom query implementation
    return findNodesInCustomAST(ast, pattern);
  }
}
```

### Step 2: Register Plugin

```bash
ast-copilot-helper plugin install ./plugins/custom-parser.ts
```

### Step 3: Use Custom Parser

```bash
ast-copilot-helper parse src/ --parser custom-language
```

---

## Interactive Exercises

### Exercise 1: Code Quality Assessment

1. Clone a public GitHub repository
2. Run comprehensive analysis
3. Identify top 5 issues
4. Create improvement plan

### Exercise 2: Refactoring Assistant

1. Find all functions with high complexity
2. Identify refactoring candidates
3. Use queries to find similar patterns
4. Plan modularization strategy

### Exercise 3: Security Audit

1. Run security analysis on a web application
2. Find potential XSS vulnerabilities
3. Identify unsafe API usage
4. Generate security report

### Exercise 4: Performance Analysis

1. Analyze a performance-critical module
2. Find synchronous operations in async contexts
3. Identify potential memory leaks
4. Suggest optimization strategies

## Next Steps

After completing these tutorials, you should be able to:

- Parse and analyze code effectively
- Create custom queries for your specific needs
- Integrate ast-copilot-helper into your development workflow
- Configure advanced settings for your project
- Develop custom extensions and parsers

Continue with:

- [Advanced Configuration Guide](../guide/configuration.md)
- [API Reference](../api/cli.md)
- [Development Guide](../development/contributing.md)
