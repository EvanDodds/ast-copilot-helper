# Getting Started

Welcome to AST Copilot Helper! This guide will get you up and running with AI-powered code analysis in just a few minutes.

## What is AST Copilot Helper?

AST Copilot Helper transforms your codebase into an AI-accessible knowledge base by:

🔍 **Semantic Code Analysis**  
Parse and understand code across 15 programming languages using Abstract Syntax Tree analysis with intelligent annotations

🤖 **AI Agent Integration**  
Enable AI agents to query and understand your codebase via Model Context Protocol (MCP) server integration

⚡ **Natural Language Queries**  
Search your code using plain English instead of complex regex patterns or manual file browsing

🛠️ **Multi-Interface Access**  
Use via CLI, VS Code extension, MCP server, or programmatic API - whatever fits your workflow

## Quick Start (5 minutes)

### 1. Install AST Copilot Helper

Choose your preferred installation method:

::: code-group

```bash [npm Global Install]
npm install -g ast-copilot-helper
```

```bash [pnpm (Recommended)]
pnpm add -g ast-copilot-helper
```

```bash [Development Install]
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper
pnpm install
pnpm build
```

:::

### 2. Initialize Your Project

Navigate to your project directory and set up AST Copilot Helper:

```bash
cd your-project
ast-copilot-helper init
```

This command:
- Creates configuration files (`.ast-copilot-helper.json`)
- Analyzes your project structure across supported languages
- Sets up appropriate language parsers for your codebase
- Generates semantic embeddings for intelligent search

### 3. Start Exploring

Once initialized, explore your code with natural language queries:

```bash
# Search for specific functionality
ast-copilot-helper query "authentication functions"

# Find code patterns
ast-copilot-helper query "error handling patterns"

# Discover API endpoints
ast-copilot-helper query "REST API endpoints and routes"
```

### 5. Enable AI Agent Integration

To use with AI agents via Model Context Protocol (MCP):

```bash
# Start MCP server with stdio transport (for Claude Desktop)
ast-copilot-helper server --transport stdio

# Or start HTTP server for web-based AI agents
ast-copilot-helper server --transport sse --port 3001 --cors
```

Then configure your AI agent to connect to the MCP server for intelligent code assistance.

## Core Concepts

### AST Annotations

AST Copilot Helper extracts structured information from your code:

```typescript
// Original code
async function getUserById(id: string): Promise<User | null> {
  // Retrieves user by ID from database with error handling
  try {
    return await database.users.findById(id);
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

// Extracted annotation
{
  "id": "func_getUserById_abc123",
  "type": "function", 
  "name": "getUserById",
  "description": "Retrieves user by ID from database with error handling",
  "parameters": [{"name": "id", "type": "string"}],
  "returnType": "Promise<User | null>",
  "async": true,
  "file": "src/users.ts",
  "startLine": 15,
  "endLine": 23,
  "complexity": "medium"
}
```

### Semantic Search

The tool creates embeddings that enable natural language queries:

- **Query**: `"database operations"`
- **Matches**: Functions with names like `findById`, `updateUser`, `deleteRecord`
- **Reason**: Semantic understanding connects the query to database-related functionality

### Model Context Protocol (MCP)

MCP allows AI agents to:

- Understand your code structure
- Query specific functionality
- Get context-aware suggestions
- Navigate code relationships

## Project Structure

After initialization, your project will contain:

```
your-project/
├── .ast-copilot-helper.json    # Configuration file
├── .ast-copilot-helper.db      # Parsed annotations database
├── ast-embeddings/             # Semantic embedding cache
├── .gitignore                  # Updated with tool entries
└── your existing code...
```

## Configuration Overview

The `.ast-copilot-helper.json` file controls behavior:

```json
{
  "parser": {
    "includePatterns": ["**/*.{ts,js,py,rs,go,java,cpp,c,rb,php,cs,kt,scala,swift}"],
    "excludePatterns": ["node_modules/**", "dist/**", "build/**", "target/**"],
    "languages": ["typescript", "javascript", "python", "rust", "go"],
    "maxFileSize": "1MB"
  },
  "embeddings": {
    "model": "text-embedding-3-small", 
    "similarityThreshold": 0.75,
    "batchSize": 100
  },
  "mcp": {
    "port": 3001,
    "enableCors": true
  }
}
```

## Common Use Cases

### 1. Code Discovery

Find specific functionality in large codebases:

```bash
ast-copilot-helper query "password validation logic"
ast-copilot-helper query "file upload handlers" 
ast-copilot-helper query "caching mechanisms"
```

### 2. AI-Assisted Development

Enable AI agents to understand your codebase:

```bash
# Start MCP server for Claude Desktop
ast-copilot-helper server --transport stdio

# Configure Claude to use the server
# Now Claude can answer questions about your code!
```

### 3. Documentation Generation

Extract information for documentation:

```bash
# Query for API endpoints  
ast-copilot-helper query "public API methods" --format json > api-endpoints.json

# Find all interfaces and types
ast-copilot-helper query "type definitions and interfaces" --filter "type=interface"
```

### 4. Code Analysis & Insights

Understand code patterns and architecture:

```bash
# Find complex functions
ast-copilot-helper query "functions with high cyclomatic complexity"

# Locate deprecated code
ast-copilot-helper query "deprecated methods or legacy code patterns"

# Identify potential refactoring opportunities
ast-copilot-helper query "duplicate code patterns that could be refactored"
```

## Next Steps

Now that you're up and running, explore these guides:

📖 **[Installation Guide](installation)** - Detailed setup for all platforms  
🚀 **[CLI Usage Guide](cli-usage)** - Master the command-line interface  
⚙️ **[Configuration Guide](configuration)** - Customize parsing and behavior  
🤖 **[MCP Integration](mcp-integration)** - Connect with AI agents via Model Context Protocol  
🔍 **[API Reference](../api/)** - Programmatic usage and API documentation

## Troubleshooting

### Common Issues

**Command not found:**

```bash
# Check if installed correctly
npm list -g | grep ast-copilot-helper

# Or try with npx
npx ast-copilot-helper --version

# Verify PATH includes npm global bin
echo $PATH | grep npm
```

**Parse errors:**

```bash
# Check configuration
ast-copilot-helper config validate

# Parse with debug output
ast-copilot-helper parse --verbose

# Test parsing specific files
ast-copilot-helper parse src/specific-file.ts --debug
```

**No query results:**

```bash
# Lower similarity threshold
ast-copilot-helper query "your query" --threshold 0.5

# Check what was parsed
ast-copilot-helper list --limit 10

# Verify embeddings were created
ast-copilot-helper status
```

### Getting Help

- 📖 [Troubleshooting Guide](../troubleshooting.md) - Comprehensive problem solving
- 💬 [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions) - Community support
- 🐛 [Report Issues](https://github.com/EvanDodds/ast-copilot-helper/issues) - Bug reports and feature requests

## What's Next?

Congratulations! You now have AST Copilot Helper working with your project. Here are your next steps:

1. **Customize Configuration** - Tailor parsing behavior for your codebase
2. **Integrate with AI Agents** - Connect Claude Desktop, Cursor, or other MCP-compatible tools
3. **Master Advanced Queries** - Learn sophisticated semantic search patterns
4. **Automate Workflows** - Set up continuous parsing and CI/CD integration
5. **Contribute** - Help improve the project for the community

Ready to dive deeper? Choose your path:

::: tip For Beginners
Start with the [CLI Usage Guide](cli-usage) to learn all available commands and options.
:::

::: tip For AI Enthusiasts
Jump to the [MCP Integration Guide](mcp-integration) to connect with Claude Desktop and other AI agents.
:::

::: tip For Developers
Check out the [Configuration Guide](configuration) to fine-tune AST Copilot Helper for your specific needs.
:::

::: tip For Contributors
Visit the [Contributing Guide](../../CONTRIBUTING.md) to help improve the project.
:::
