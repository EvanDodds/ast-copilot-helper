# Getting Started

Welcome to ast-copilot-helper! This comprehensive guide will help you get up and running with our AI-powered code analysis tool.

## What is ast-copilot-helper?

ast-copilot-helper is a powerful toolkit that bridges the gap between your codebase and AI agents by:

🔍 **Parsing and Understanding Code**  
Extracts meaningful annotations from your source code using Abstract Syntax Tree (AST) analysis

🤖 **Enabling AI Integration**  
Provides a Model Context Protocol (MCP) server that allows AI agents to understand your code structure and semantics

⚡ **Powering Semantic Search**  
Creates searchable embeddings that enable natural language queries over your codebase

🛠️ **Offering Multiple Interfaces**  
Available as a CLI tool, VS Code extension, and programmatic API

## Quick Start (5 minutes)

### 1. Install ast-copilot-helper

Choose your preferred installation method:

::: code-group

```bash [npm (Recommended)]
npm install -g @ast-copilot-helper/cli
```

```bash [VS Code Extension]
# Install from marketplace
code --install-extension ast-copilot-helper

# Or install from command palette:
# Extensions → Search "ast-copilot-helper" → Install
```

:::

### 2. Initialize Your Project

Navigate to your project directory and set up ast-copilot-helper:

```bash
cd your-project
ast-helper init
```

This creates a `.ast-helper.json` configuration file with sensible defaults for your project type.

### 3. Parse Your Codebase

Extract semantic information from your code:

```bash
# Parse all supported files in src directory
ast-helper parse src/

# Or parse specific files
ast-helper parse src/index.ts src/utils.ts
```

You'll see output like:
```
✅ Successfully parsed 42 files
📊 Extracted 156 annotations (89 functions, 23 classes, 44 interfaces)
🎯 Generated 156 embeddings for semantic search
💾 Saved to .ast-helper.db
```

### 4. Query Your Code

Now you can search your codebase using natural language:

```bash
# Find authentication-related code
ast-helper query "functions that handle user authentication"

# Find error handling patterns  
ast-helper query "error handling and exception management"

# Find API endpoints
ast-helper query "HTTP request handlers and API routes"
```

Example output:
```
🔍 Found 3 results for "functions that handle user authentication":

1. loginUser (src/auth.ts:23) - Authenticates user with email/password [Score: 0.89]
2. validateToken (src/auth.ts:45) - Validates JWT authentication token [Score: 0.85] 
3. refreshToken (src/auth.ts:67) - Refreshes expired authentication token [Score: 0.82]
```

### 5. Enable AI Integration (Optional)

To use with AI agents, start the MCP server:

```bash
# Start MCP server with stdio transport (for Claude Desktop)
ast-helper server --transport stdio

# Or start HTTP server for web-based agents
ast-helper server --transport sse --port 3001 --cors
```

Then configure your AI agent to connect to the MCP server.

## Core Concepts

### AST Annotations

ast-copilot-helper extracts structured information from your code:

```typescript
// Original code
function getUserById(id: string): Promise<User> {
  // Retrieves user by ID from database
  return database.users.findById(id);
}

// Extracted annotation
{
  "id": "func_getUserById_123",
  "type": "function", 
  "name": "getUserById",
  "description": "Retrieves user by ID from database",
  "parameters": [{"name": "id", "type": "string"}],
  "returnType": "Promise<User>",
  "file": "src/users.ts",
  "line": 15
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
├── .ast-helper.json     # Configuration file
├── .ast-helper.db       # Parsed annotations database
├── .gitignore           # Updated with ast-helper entries
└── your existing code...
```

## Configuration Overview

The `.ast-helper.json` file controls behavior:

```json
{
  "parser": {
    "includePatterns": ["**/*.{ts,js,py}"],
    "excludePatterns": ["node_modules/**", "dist/**"],
    "languages": ["typescript", "javascript", "python"]
  },
  "ai": {
    "embeddingModel": "text-embedding-3-small",
    "similarityThreshold": 0.7
  }
}
```

## Common Use Cases

### 1. Code Discovery
Find specific functionality in large codebases:
```bash
ast-helper query "password validation logic"
ast-helper query "file upload handlers" 
ast-helper query "caching mechanisms"
```

### 2. AI-Assisted Development
Enable AI agents to understand your codebase:
```bash
# Start MCP server for Claude Desktop
ast-helper server --transport stdio

# Configure Claude to use the server
# Now Claude can answer questions about your code!
```

### 3. Documentation Generation
Extract information for documentation:
```bash
# Query for API endpoints
ast-helper query "public API methods" --format json > api-endpoints.json

# Find all interfaces
ast-helper query "type definitions and interfaces" --type interface
```

### 4. Code Analysis
Understand code patterns and structure:
```bash
# Find complex functions
ast-helper query "functions with many parameters"

# Locate deprecated code
ast-helper query "deprecated methods or legacy code"
```

## Next Steps

Now that you're up and running, explore these guides:

📖 **[Installation Guide](installation)** - Detailed setup for all platforms  
🚀 **[CLI Usage Guide](cli-usage)** - Master the command-line interface  
🎨 **[VS Code Extension](vscode-extension)** - Visual Studio Code integration  
⚙️ **[Configuration Guide](configuration)** - Customize for your needs  
🤖 **[AI Integration](ai-integration)** - Connect with AI agents  

## Troubleshooting

### Common Issues

**Command not found:**
```bash
# Reinstall globally
npm install -g @ast-copilot-helper/cli

# Or use npx
npx @ast-copilot-helper/cli --version
```

**Parse errors:**
```bash
# Check configuration
ast-helper config validate

# Parse with debug output
ast-helper parse src/ --verbose
```

**No query results:**
```bash
# Lower similarity threshold
ast-helper query "your query" --similarity 0.5

# Check what was parsed
ast-helper query "*" --limit 5
```

### Getting Help

- 📖 [Troubleshooting Guide](troubleshooting) - Comprehensive problem solving
- 💬 [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions) - Community support
- 🐛 [Report Issues](https://github.com/EvanDodds/ast-copilot-helper/issues) - Bug reports and feature requests

## What's Next?

Congratulations! You now have ast-copilot-helper working with your project. Here are some next steps to explore:

1. **Customize Configuration** - Tailor parsing behavior to your project
2. **Integrate with AI Tools** - Connect Claude, ChatGPT, or other AI agents
3. **Explore Advanced Queries** - Learn sophisticated search patterns
4. **Automate Workflows** - Set up continuous parsing and analysis
5. **Contribute** - Help improve the project for everyone

Ready to dive deeper? Choose your path:

::: tip For Beginners
Start with the [CLI Usage Guide](cli-usage) to learn all available commands and options.
:::

::: tip For VS Code Users  
Install the [VS Code Extension](vscode-extension) for a visual, integrated experience.
:::

::: tip For AI Enthusiasts
Jump to the [AI Integration Guide](ai-integration) to connect with your favorite AI agents.
:::

::: tip For Developers
Check out the [Configuration Guide](configuration) to fine-tune ast-copilot-helper for your specific needs.
:::