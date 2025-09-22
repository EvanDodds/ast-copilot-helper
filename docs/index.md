---
layout: home

hero:
  name: "ast-copilot-helper"
  text: "AI-powered code understanding"
  tagline: "Parse, analyze, and query your codebase with natural language using AST annotations and semantic search"
  image:
    src: /logo.svg
    alt: ast-copilot-helper
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
    details: Query your codebase using natural language. Find functions, patterns, and logic with AI-powered semantic understanding.

  - icon: 🤖
    title: AI Agent Integration
    details: Connect with AI agents via Model Context Protocol (MCP). Enable agents to understand and navigate your code automatically.

  - icon: ⚡
    title: High Performance
    details: Fast parsing and indexing with intelligent caching. Process large codebases efficiently with incremental updates.

  - icon: 🛠️
    title: Developer Tools
    details: CLI interface, VS Code extension, and programmatic API. Integrate into your existing development workflow seamlessly.

  - icon: 🌐
    title: Multi-Language Support
    details: Support for TypeScript, JavaScript, Python, and more. Extensible parser architecture for additional languages.

  - icon: 📊
    title: Rich Annotations
    details: Extract meaningful metadata from your code. Generate embeddings and structured data for enhanced AI understanding.
---

## Quick Start

Get up and running in minutes:

::: code-group

```bash [npm]
# Install the CLI
npm install -g @ast-copilot-helper/cli

# Initialize in your project
cd your-project
ast-helper init

# Parse your code
ast-helper parse src/

# Query with natural language
ast-helper query "functions that handle user authentication"
```

```bash [VS Code]
# Install the extension
code --install-extension ast-copilot-helper

# Or install from the marketplace:
# Extensions → Search "ast-copilot-helper" → Install
```

:::

## Use Cases

### 🔍 **Code Discovery**

Find specific functionality in large codebases using natural language queries.

### 🤖 **AI Agent Enhancement**

Provide AI agents with rich context about your code structure and semantics.

### 📚 **Documentation Generation**

Auto-generate documentation from code annotations and semantic understanding.

### 🧪 **Code Analysis**

Perform complex code analysis and refactoring with semantic insights.

## Community

- [GitHub Repository](https://github.com/EvanDodds/ast-copilot-helper) - Source code and issues
- [Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions) - Community discussions
- [Contributing Guide](/development/contributing) - How to contribute

## License

Released under the [MIT License](https://github.com/EvanDodds/ast-copilot-helper/blob/main/LICENSE).
