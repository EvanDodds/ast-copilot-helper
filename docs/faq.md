# Frequently Asked Questions

Get quick answers to common questions about ast-copilot-helper. This FAQ covers installation, usage, configuration, and troubleshooting scenarios.

## General Questions

### What is ast-copilot-helper?

**Q**: What exactly does ast-copilot-helper do?

**A**: ast-copilot-helper is a powerful code analysis and AI integration tool that:

- Parses your codebase to extract functions, classes, interfaces, and other code elements
- Creates searchable semantic embeddings of your code using AI
- Provides intelligent code search and discovery capabilities
- Integrates with VS Code and AI assistants through the Model Context Protocol (MCP)
- Helps AI understand your codebase context for better assistance

### How is this different from other code analysis tools?

**Q**: How does ast-copilot-helper compare to tools like Sourcegraph, grep, or IDE search?

**A**: ast-copilot-helper offers unique advantages:

| Feature                | ast-copilot-helper                | Traditional Search      | IDE Search           |
| ---------------------- | --------------------------------- | ----------------------- | -------------------- |
| Semantic Understanding | ✅ AI-powered semantic search     | ❌ Text-only            | ❌ Limited context   |
| AI Integration         | ✅ MCP protocol support           | ❌ No AI integration    | ❌ No AI integration |
| Cross-language         | ✅ TypeScript, Python, JavaScript | ✅ Language agnostic    | ✅ Language-specific |
| Context Awareness      | ✅ Understands code relationships | ❌ String matching only | ⚠️ Limited context   |
| Offline Usage          | ✅ Local database                 | ✅ Fully offline        | ✅ Fully offline     |

## Installation and Setup

### System Requirements

**Q**: What are the minimum system requirements?

**A**:

- **Node.js**: 18.x or higher
- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18+)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 100MB for tool, additional space for project databases
- **Python**: 3.8+ (optional, for Python parsing support)

### Installation Issues

**Q**: The installation fails with permission errors. What should I do?

**A**: This is typically an npm permissions issue:

```bash
# Best solution: Configure npm to use a different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
source ~/.profile

# Then install normally
npm install -g ast-copilot-helper
```

**Q**: Can I install this without admin/sudo privileges?

**A**: Yes! Use npx for temporary usage or install locally:

```bash
# Use without installation
npx ast-copilot-helper init

# Or install locally in project
npm install ast-copilot-helper
npx ast-copilot-helper init
```

**Q**: The Python dependencies fail to install. Help?

**A**: Python support is optional. If you only need TypeScript/JavaScript:

```bash
# Install without Python support
AST_HELPER_NO_PYTHON=1 npm install -g ast-copilot-helper

# Or skip Python parsing in config
ast-copilot-helper config set parser.languages '["typescript", "javascript"]'
```

## Configuration

### Project Setup

**Q**: Do I need to configure anything for each project?

**A**: Minimal setup required:

```bash
# Navigate to your project
cd my-project

# Initialize (creates .ast-copilot-helper.json)
ast-copilot-helper init

# Parse your code
ast-copilot-helper parse src/

# Start querying
ast-copilot-helper query "authentication functions"
```

**Q**: Can I use this with monorepos?

**A**: Yes! Configure for monorepo structure:

```json
{
  "parser": {
    "includePatterns": [
      "packages/*/src/**/*.{ts,js}",
      "apps/*/src/**/*.{ts,js}"
    ],
    "excludePatterns": ["packages/*/dist/**", "packages/*/node_modules/**"]
  }
}
```

### AI Configuration

**Q**: Do I need an OpenAI API key?

**A**: OpenAI API key is **optional**:

- **Without API key**: Text-based search works perfectly
- **With API key**: Enables semantic search with AI embeddings

```bash
# Enable AI features (optional)
export OPENAI_API_KEY="your-key-here"
ast-copilot-helper config set ai.enableEmbeddings true

# Or use without AI
ast-copilot-helper config set ai.enableEmbeddings false
```

**Q**: How much does AI integration cost?

**A**: Very affordable for most projects:

- **Embedding Generation**: ~$0.0001 per 1K tokens
- **Typical Project**: 50K lines = ~$0.50-2.00 one-time
- **Query Searches**: Free (uses cached embeddings)
- **Example**: Medium project (~100K LOC) ≈ $1-4 total

**Q**: Can I use other AI providers besides OpenAI?

**A**: Currently OpenAI only, but we're adding support for:

- Anthropic Claude (coming soon)
- Azure OpenAI (coming soon)
- Local models via Ollama (planned)

## Usage

### Parsing Code

**Q**: How long does parsing take?

**A**: Depends on project size:

- **Small project** (< 1K files): < 30 seconds
- **Medium project** (1K-10K files): 1-5 minutes
- **Large project** (10K+ files): 5-30 minutes

**Optimization tips:**

```bash
# Exclude unnecessary files
echo "*.test.ts" >> .ast-copilot-helper-ignore
echo "node_modules/" >> .ast-copilot-helper-ignore

# Use incremental parsing
ast-copilot-helper parse src/ --incremental
```

**Q**: What file types are supported?

**A**: Currently supported:

| Language   | Extensions            | Status          |
| ---------- | --------------------- | --------------- |
| TypeScript | `.ts`, `.tsx`         | ✅ Full support |
| JavaScript | `.js`, `.jsx`, `.mjs` | ✅ Full support |
| Python     | `.py`                 | ✅ Full support |
| Java       | `.java`               | 🔄 Beta         |
| C/C++      | `.c`, `.cpp`, `.h`    | 📋 Planned      |
| Go         | `.go`                 | 📋 Planned      |

### Searching Code

**Q**: How do I search effectively?

**A**: Use natural language queries:

```bash
# Good queries
ast-copilot-helper query "user authentication functions"
ast-copilot-helper query "database connection setup"
ast-copilot-helper query "error handling utilities"

# Filter by type
ast-copilot-helper query "user" --type class
ast-copilot-helper query "config" --type interface

# Filter by file
ast-copilot-helper query "auth" --file "src/auth/**"
```

**Q**: Why aren't my search results accurate?

**A**: Common issues and solutions:

1. **Database not populated**:

   ```bash
   ast-copilot-helper stats  # Check if files are parsed
   ast-copilot-helper parse src/  # Re-parse if needed
   ```

2. **Search mode mismatch**:

   ```bash
   # Try different search modes
   ast-copilot-helper query "auth" --mode text
   ast-copilot-helper query "auth" --mode semantic
   ```

3. **Query too specific**:
   ```bash
   # Use broader terms
   ast-copilot-helper query "user" instead of "getUserById"
   ```

### VS Code Integration

**Q**: How do I install the VS Code extension?

**A**: Multiple installation methods:

```bash
# Method 1: VS Code Marketplace
# Search "AST Copilot Helper" in VS Code Extensions

# Method 2: Command line
code --install-extension publisher.ast-copilot-helper

# Method 3: Manual installation
# Download .vsix file and install via VS Code
```

**Q**: The VS Code extension isn't working. What should I check?

**A**: Troubleshooting checklist:

1. **Extension enabled**: Check Extensions panel
2. **Project initialized**: Run `ast-copilot-helper init` in your project
3. **Files parsed**: Run `ast-copilot-helper parse src/`
4. **Reload window**: `Cmd/Ctrl + Shift + P` → "Reload Window"

**Q**: What features are available in the VS Code extension?

**A**: Current features:

- **Code Search**: Search your codebase from Command Palette
- **Contextual Hints**: Hover information for functions/classes
- **Quick Navigation**: Jump to definitions across files
- **AI Integration**: Enhanced IntelliSense with codebase context

## AI and MCP Integration

### Model Context Protocol

**Q**: What is MCP and why should I care?

**A**: MCP (Model Context Protocol) allows AI assistants to understand your codebase:

- **Better Code Suggestions**: AI knows your existing functions
- **Contextual Help**: AI understands your project structure
- **Intelligent Refactoring**: AI suggests improvements based on your patterns
- **Code Generation**: AI creates code that fits your style

**Q**: How do I set up MCP integration?

**A**: Quick MCP setup:

```bash
# Start MCP server
ast-copilot-helper server

# Configure your AI client (e.g., Claude Desktop)
# Add to ~/.claude/config.json:
{
  "mcp_servers": {
    "ast-copilot-helper": {
      "command": "ast-copilot-helper",
      "args": ["server"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

**Q**: Which AI tools support MCP?

**A**: Growing ecosystem:

- **Anthropic Claude Desktop**: ✅ Full support
- **Continue.dev**: ✅ Full support
- **Cursor**: 🔄 In development
- **GitHub Copilot**: 📋 Planned
- **Custom integrations**: ✅ Via MCP protocol

### Embeddings and Semantic Search

**Q**: What are embeddings and do I need them?

**A**: Embeddings enable semantic understanding:

**Without embeddings** (text search):

- Query: "authentication" → matches "authenticate", "auth", "login"
- Fast and free
- Good for exact matches

**With embeddings** (semantic search):

- Query: "user login" → matches "authenticate", "signIn", "validateCredentials"
- Understands meaning and context
- Better for discovery and exploration

**Q**: How are my embeddings stored and secured?

**A**: Privacy-focused approach:

- **Local Storage**: Embeddings stored in local SQLite database
- **No Cloud Sync**: Your code never leaves your machine
- **API Key Usage**: Only for generating embeddings, not storing code
- **Offline Queries**: Search works without internet connection

## Performance and Troubleshooting

### Performance

**Q**: ast-copilot-helper is using too much memory/CPU. How do I optimize it?

**A**: Performance tuning options:

```bash
# Reduce parsing batch size
ast-copilot-helper config set parser.batchSize 50

# Limit concurrent processing
ast-copilot-helper config set parser.maxConcurrency 2

# Exclude large files
echo "*.min.js" >> .ast-copilot-helper-ignore
echo "*.bundle.js" >> .ast-copilot-helper-ignore

# Use incremental parsing
ast-copilot-helper parse src/ --incremental --watch
```

**Q**: Database is getting large. How do I manage it?

**A**: Database maintenance:

```bash
# Check database size
ls -lh .ast-copilot-helper.db

# Vacuum/optimize database
ast-copilot-helper db --vacuum

# Set retention policy
ast-copilot-helper config set database.retention "30 days"

# Clean old embeddings
ast-copilot-helper embeddings --cleanup
```

### Common Problems

**Q**: "Command not found: ast-copilot-helper"

**A**: Path/installation issue:

```bash
# Check if installed globally
npm list -g ast-copilot-helper

# Check PATH
echo $PATH

# Reinstall if needed
npm uninstall -g ast-copilot-helper
npm install -g ast-copilot-helper

# Or use npx
npx ast-copilot-helper --help
```

**Q**: "Database is locked" error

**A**: Lock file cleanup:

```bash
# Kill any running processes
pkill -f ast-copilot-helper

# Remove lock files
rm -f .ast-copilot-helper.db-wal .ast-copilot-helper.db-shm

# Restart if needed
ast-copilot-helper db --check
```

**Q**: Parsing fails with "Out of memory" error

**A**: Memory optimization:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Process in smaller batches
ast-copilot-helper parse src/ --batch-size 10

# Exclude large files
ast-copilot-helper config set parser.excludePatterns '["**/*.min.*", "**/dist/**", "**/build/**"]'
```

## Advanced Usage

### Custom Configurations

**Q**: Can I customize parsing behavior for different file types?

**A**: Yes, advanced configuration options:

```json
{
  "parser": {
    "typescript": {
      "project": "./tsconfig.json",
      "allowSyntheticDefaultImports": true,
      "experimentalDecorators": true
    },
    "python": {
      "version": "3.9",
      "includePrivateMembers": false
    },
    "javascript": {
      "ecmaVersion": 2022,
      "sourceType": "module"
    }
  }
}
```

**Q**: How do I set up different configurations for different projects?

**A**: Project-specific configurations:

```bash
# Project-specific config
cd project-a
ast-copilot-helper init
ast-copilot-helper config set parser.languages '["typescript"]'

cd ../project-b
ast-copilot-helper init
ast-copilot-helper config set parser.languages '["python"]'

# Global defaults
ast-copilot-helper config set --global parser.batchSize 100
```

### Integration with Other Tools

**Q**: Can I integrate with my existing CI/CD pipeline?

**A**: Yes, several integration options:

```yaml
# GitHub Actions example
- name: Update Code Index
  run: |
    npm install -g ast-copilot-helper
    ast-copilot-helper init
    ast-copilot-helper parse src/
    ast-copilot-helper stats
```

**Q**: How do I export data for other tools?

**A**: Export options:

```bash
# Export to JSON
ast-copilot-helper export --format json > codebase.json

# Export specific data
ast-copilot-helper export --type functions --format csv > functions.csv

# Export for documentation tools
ast-copilot-helper export --format markdown > API.md
```

## Getting Support

### Self-Service Resources

**Q**: Where can I find more help?

**A**: Comprehensive resources available:

- **📖 Documentation**: [Complete guides and API reference](https://yourusername.github.io/ast-copilot-helper/)
- **🐛 Troubleshooting**: [Common problems and solutions](./troubleshooting.md)
- **🔧 Examples**: [Real-world usage examples](./examples/)
- **🏗️ Architecture**: [Technical deep-dive](./development/architecture.md)

### Community Support

**Q**: How do I report bugs or request features?

**A**: Multiple channels:

- **GitHub Issues**: [Bug reports and feature requests](https://github.com/EvanDodds/ast-copilot-helper/issues)
- **GitHub Discussions**: [Questions and community help](https://github.com/EvanDodds/ast-copilot-helper/discussions)
- **Discord/Slack**: [Real-time community chat] (link when available)

### Diagnostic Information

**Q**: What information should I include when asking for help?

**A**: Helpful diagnostic info:

```bash
# System information
ast-copilot-helper doctor

# Configuration dump
ast-copilot-helper config --export

# Project statistics
ast-copilot-helper stats --verbose

# Recent logs
tail -n 50 ~/.ast-copilot-helper/logs/error.log
```

### Contributing

**Q**: How can I contribute to the project?

**A**: Many ways to help:

- **🐛 Report Bugs**: Use GitHub Issues
- **💡 Suggest Features**: Use GitHub Discussions
- **📝 Improve Docs**: Submit PR with documentation improvements
- **🔧 Submit Code**: Check [Contributing Guide](./development/contributing.md)
- **🌟 Share**: Tell others about the project

**Q**: I want to add support for a new programming language. How?

**A**: Language support contributions welcome:

1. **Check existing issues**: See if someone is already working on it
2. **Create issue**: Propose the new language support
3. **Follow guide**: See [Adding Language Support](./development/contributing.md)
4. **Submit PR**: Include parser, tests, and documentation

## Roadmap and Future

**Q**: What features are planned for the future?

**A**: Exciting developments ahead:

**Near-term** (next 3 months):

- Support for more AI providers (Anthropic, Azure)
- Java and C++ language support
- Enhanced VS Code integration
- Performance optimizations

**Medium-term** (6 months):

- Web-based dashboard
- Team collaboration features
- Plugin system for custom parsers
- Integration with more IDEs

**Long-term** (1 year):

- Local AI model support
- Advanced code analytics
- Automated refactoring suggestions
- Enterprise features

**Q**: Is this project actively maintained?

**A**: Yes! Active development with:

- Regular releases (monthly)
- Responsive issue handling (< 48 hours)
- Active community engagement
- Continuous improvement based on user feedback

Have more questions? Check our [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions) or [create a new issue](https://github.com/EvanDodds/ast-copilot-helper/issues/new)!
