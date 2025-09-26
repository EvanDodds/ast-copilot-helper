---
layout: home

hero:
  name: "AST Copilot Helper"
  text: "AI-Powered Code Understanding"
  tagline: "Transform your codebase into an AI-accessible knowledge base with semantic parsing, natural language queries, and MCP integration"
  image:
    src: /logo.svg
    alt: AST Copilot Helper
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/EvanDodds/ast-copilot-helper

features:
  - icon: 🔍
    title: Semantic Code Search
    details: Query your codebase with natural language. Find functions, patterns, and logic using AI-powered semantic understanding across 15 programming languages.

  - icon: 🤖
    title: MCP Server Integration
    details: Enable AI agents to understand your code via Model Context Protocol. Provides structured access to AST data and semantic queries.

  - icon: ⚡
    title: High Performance
    details: Fast parsing with intelligent caching and incremental updates. Process large codebases efficiently with multi-language support.

  - icon: 🛠️
    title: Complete Toolkit
    details: CLI tool, MCP server, and VS Code extension. Integrate seamlessly into your existing development workflow.

  - icon: 🌐
    title: 15 Languages Supported
    details: Enterprise tier (TypeScript, Python, Java, C++), Developer tier (Go, Rust, PHP, Ruby), and Specialized languages (Kotlin, Scala, Dart).

  - icon: 🚀
    title: Production Ready
    details: Comprehensive security framework, 573+ passing tests, automated CI/CD pipeline, and enterprise-grade reliability.
---

## Quick Start

Get up and running in minutes:

::: code-group

```bash [Development Setup]
# Clone and setup
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper
yarn install && yarn build

# Initialize in your project
yarn ast-copilot-helper init

# Parse your codebase
yarn ast-copilot-helper parse src/

# Query with natural language
yarn ast-copilot-helper query "functions that handle authentication"
```

```bash [VS Code Extension]
# Install from VS Code marketplace
code --install-extension ast-copilot-helper

# Or search in Extensions: "ast-copilot-helper"
```

```bash [MCP Server]
# Start MCP server for AI integration
yarn ast-mcp-server --port 3000

# Configure AI agent to connect to localhost:3000
```

:::

## Use Cases

### 🔍 **Code Discovery & Navigation**

Find specific functionality across large, multi-language codebases using natural language queries instead of grep or IDE search.

### 🤖 **AI Agent Enhancement**

Provide AI coding assistants with rich contextual understanding of your codebase structure, patterns, and semantic relationships.

### 📚 **Automated Documentation**

Generate intelligent documentation from AST analysis, code comments, and semantic understanding across all supported languages.

### 🧪 **Code Analysis & Refactoring**

Perform sophisticated code analysis, pattern detection, and refactoring guidance with deep semantic insights.

### 🔗 **CI/CD Integration**

Integrate semantic code analysis into build pipelines for automated code quality checks and documentation updates.

## Resources

**📖 Documentation**

- [Getting Started Guide](/guide/getting-started) - Complete setup walkthrough
- [CLI Usage](/guide/cli-usage) - Command-line interface
- [API Reference](/api/) - Programmatic integration

**🤝 Community**

- [GitHub Repository](https://github.com/EvanDodds/ast-copilot-helper) - Source & issues
- [Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions) - Q&A & ideas
- [Contributing Guide](/development/contributing) - How to contribute

**⚖️ License**  
Released under the [MIT License](https://github.com/EvanDodds/ast-copilot-helper/blob/main/LICENSE)
