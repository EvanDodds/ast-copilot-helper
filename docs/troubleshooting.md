# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with ast-copilot-helper. Find solutions to problems you might encounter during installation, configuration, and usage.

## Installation Issues

### Node.js and npm Issues

#### Problem: Node.js version compatibility errors

```
Error: ast-copilot-helper requires Node.js version 18.x or higher
```

**Solution:**

```bash
# Check current Node.js version
node --version

# Install/update Node.js using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Or download from nodejs.org
# Visit: https://nodejs.org/
```

#### Problem: npm installation fails with permission errors

```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**

```bash
# Option 1: Use npm's built-in solution (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 2: Change npm's default directory
npm config get prefix  # Check current prefix
npm config set prefix ~/npm-global

# Option 3: Use sudo (NOT recommended)
sudo npm install -g ast-copilot-helper
```

#### Problem: Package installation hangs or fails

```
npm ERR! network timeout
npm ERR! network This is a problem related to network connectivity
```

**Solutions:**

```bash
# Clear npm cache
npm cache clean --force

# Try with different registry
npm install --registry https://registry.npmjs.org/

# Increase timeout
npm install --timeout=60000

# Use yarn as alternative
npm install -g yarn
yarn global add ast-copilot-helper
```

### Python Dependencies (for Python parsing)

#### Problem: Python not found

```
Error: Python executable not found
```

**Solutions:**

```bash
# Install Python (Ubuntu/Debian)
sudo apt update
sudo apt install python3 python3-pip

# Install Python (macOS with Homebrew)
brew install python

# Install Python (Windows)
# Download from python.org and add to PATH

# Verify installation
python3 --version
which python3
```

#### Problem: Tree-sitter compilation errors

```
Error building tree-sitter parsers
```

**Solutions:**

```bash
# Install build tools (Ubuntu/Debian)
sudo apt install build-essential

# Install build tools (macOS)
xcode-select --install

# Install build tools (Windows)
npm install -g windows-build-tools

# Clear and reinstall
rm -rf node_modules
npm install
```

## Configuration Issues

### Project Initialization Problems

#### Problem: `.ast-helper.json` not created

```
Error: Configuration file not found
```

**Solution:**

```bash
# Initialize configuration manually
ast-helper init

# Or create configuration file manually
cat > .ast-helper.json << 'EOF'
{
  "parser": {
    "languages": ["typescript", "javascript", "python"],
    "includePatterns": ["**/*.{ts,js,py}"],
    "excludePatterns": ["node_modules/**", "dist/**", "*.test.*"]
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "enableEmbeddings": true
  },
  "database": {
    "path": "./.ast-helper.db"
  }
}
EOF
```

#### Problem: Invalid configuration format

```
Error: Invalid configuration in .ast-helper.json
```

**Solution:**

```bash
# Validate JSON format
cat .ast-helper.json | python -m json.tool

# Common issues and fixes:
# - Trailing commas (remove them)
# - Missing quotes around keys
# - Incorrect file paths

# Reset to default configuration
rm .ast-helper.json
ast-helper init --reset
```

### AI Integration Issues

#### Problem: OpenAI API key not working

```
Error: OpenAI API request failed: 401 Unauthorized
```

**Solutions:**

```bash
# Check API key format (should start with sk-)
echo $OPENAI_API_KEY

# Set API key in environment
export OPENAI_API_KEY="sk-your-key-here"

# Or set in configuration file
ast-helper config set ai.apiKey "sk-your-key-here"

# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

#### Problem: Rate limiting errors

```
Error: OpenAI API rate limit exceeded
```

**Solutions:**

```bash
# Reduce batch size in configuration
ast-helper config set ai.batchSize 10

# Add delays between requests
ast-helper config set ai.requestDelay 1000

# Use different model tier
ast-helper config set ai.model "gpt-3.5-turbo"
```

#### Problem: Embedding generation fails

```
Error: Failed to generate embeddings
```

**Solutions:**

```bash
# Check if embeddings are enabled
ast-helper config get ai.enableEmbeddings

# Disable embeddings if not needed
ast-helper config set ai.enableEmbeddings false

# Try different embedding model
ast-helper config set ai.embeddingModel "text-embedding-ada-002"
```

## Parsing Issues

### Language Support Problems

#### Problem: TypeScript parsing errors

```
Error: Unexpected token in TypeScript file
```

**Solutions:**

```bash
# Check TypeScript version compatibility
npm list typescript

# Update TypeScript parser
npm update @typescript-eslint/parser

# Configure parser options
cat > .ast-helper.json << 'EOF'
{
  "parser": {
    "typescript": {
      "project": "./tsconfig.json",
      "allowSyntheticDefaultImports": true,
      "experimentalDecorators": true
    }
  }
}
EOF
```

#### Problem: Python parsing fails

```
Error: Python tree-sitter parser not found
```

**Solutions:**

```bash
# Reinstall Python parser
npm uninstall tree-sitter-python
npm install tree-sitter-python

# Check Python parser installation
ast-helper doctor --parsers

# Manual parser rebuild
npx tree-sitter build --wasm
```

#### Problem: Large files cause memory issues

```
Error: JavaScript heap out of memory
```

**Solutions:**

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Process files in smaller chunks
ast-helper parse src/ --batch-size 10

# Exclude large files
echo "*.min.js" >> .ast-helper-ignore
echo "*.bundle.js" >> .ast-helper-ignore
```

### File Processing Issues

#### Problem: Files not being parsed

```
Warning: No files found matching pattern
```

**Solutions:**

```bash
# Check file patterns
ast-helper config get parser.includePatterns

# List files that would be parsed
ast-helper parse --dry-run src/

# Update include patterns
ast-helper config set parser.includePatterns '["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]'

# Check for ignore files
ls -la .ast-helper-ignore
ls -la .gitignore
```

#### Problem: Permission denied errors

```
Error: EACCES: permission denied, open 'file.ts'
```

**Solutions:**

```bash
# Check file permissions
ls -la src/

# Fix permissions
chmod -R 644 src/
find src/ -type d -exec chmod 755 {} \;

# Run with appropriate user
sudo chown -R $USER:$USER src/
```

## Database Issues

### SQLite Database Problems

#### Problem: Database corruption

```
Error: database disk image is malformed
```

**Solutions:**

```bash
# Backup existing database
cp .ast-helper.db .ast-helper.db.backup

# Recreate database
rm .ast-helper.db
ast-helper init

# Re-parse project
ast-helper parse src/

# If backup needed, try recovery
sqlite3 .ast-helper.db.backup ".dump" | sqlite3 .ast-helper.db.recovered
```

#### Problem: Database locking issues

```
Error: database is locked
```

**Solutions:**

```bash
# Check for running processes
ps aux | grep ast-helper

# Kill hanging processes
pkill -f ast-helper

# Remove lock files
rm -f .ast-helper.db-wal .ast-helper.db-shm

# Restart database
ast-helper db --rebuild
```

#### Problem: Disk space issues

```
Error: database or disk is full
```

**Solutions:**

```bash
# Check disk space
df -h

# Check database size
ls -lh .ast-helper.db

# Clean up database
ast-helper db --vacuum

# Reduce stored data
ast-helper config set database.retention "30 days"
```

## Query Issues

### Search Problems

#### Problem: No search results found

```
No results found for query: "function authentication"
```

**Solutions:**

```bash
# Check if database is populated
ast-helper stats

# Re-index database
ast-helper db --reindex

# Try broader search terms
ast-helper query "auth"

# Use different search modes
ast-helper query "auth" --mode text
ast-helper query "auth" --mode semantic
```

#### Problem: Slow search performance

```
Search taking longer than expected
```

**Solutions:**

```bash
# Check database statistics
ast-helper stats --verbose

# Optimize database
ast-helper db --optimize

# Reduce search scope
ast-helper query "auth" --type function
ast-helper query "auth" --file "src/**"

# Disable embeddings for faster text search
ast-helper config set ai.enableEmbeddings false
```

#### Problem: Semantic search not working

```
Error: Semantic search requires embeddings
```

**Solutions:**

```bash
# Enable embeddings
ast-helper config set ai.enableEmbeddings true

# Generate embeddings for existing data
ast-helper embeddings --generate

# Check embedding status
ast-helper embeddings --status

# Test with simpler query
ast-helper query "hello" --mode semantic
```

## MCP Server Issues

### Server Startup Problems

#### Problem: Server fails to start

```
Error: Failed to start MCP server on port 3001
```

**Solutions:**

```bash
# Check port availability
lsof -ti:3001
netstat -tlnp | grep 3001

# Use different port
ast-helper server --port 3002

# Check for permission issues
ast-helper server --port 8080

# Debug server startup
DEBUG=ast-mcp-server* ast-helper server
```

#### Problem: Client connection refused

```
Error: Connection refused when connecting to MCP server
```

**Solutions:**

```bash
# Verify server is running
ps aux | grep mcp-server

# Check server logs
tail -f ~/.ast-helper/logs/mcp-server.log

# Test server connectivity
curl http://localhost:3001/health

# Restart server
ast-helper server --restart
```

### Protocol Issues

#### Problem: Invalid MCP messages

```
Error: Invalid JSON-RPC message format
```

**Solutions:**

```bash
# Check MCP client compatibility
ast-helper server --version

# Update MCP protocol version
ast-helper config set mcp.protocolVersion "2024-11-05"

# Test with simple request
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | \
  nc localhost 3001
```

#### Problem: Tool execution failures

```
Error: Tool 'query_codebase' execution failed
```

**Solutions:**

```bash
# List available tools
ast-helper tools list

# Test tool directly
ast-helper tools test query_codebase '{"query": "test"}'

# Check tool configuration
ast-helper config get mcp.tools

# Reset tool configuration
ast-helper tools --reset
```

## VS Code Extension Issues

### Extension Installation Problems

#### Problem: Extension not installing

```
Error: Extension 'ast-copilot-helper' not found
```

**Solutions:**

```bash
# Install from VSIX file
code --install-extension ast-copilot-helper.vsix

# Install from marketplace
code --install-extension publisher.ast-copilot-helper

# Manual installation
cp -r vscode-extension ~/.vscode/extensions/

# Check VS Code version compatibility
code --version
```

#### Problem: Extension not loading

```
Extension 'ast-copilot-helper' failed to activate
```

**Solutions:**

```bash
# Check extension logs
# View -> Output -> Extensions (Host)

# Reload VS Code window
# Cmd/Ctrl + Shift + P -> "Developer: Reload Window"

# Disable conflicting extensions
# File -> Preferences -> Extensions

# Reset extension settings
# Cmd/Ctrl + , -> Search "ast-copilot-helper"
```

### Functionality Issues

#### Problem: Commands not working

```
Command 'ast-copilot-helper.query' not found
```

**Solutions:**

```bash
# Reload VS Code window
# Cmd/Ctrl + Shift + P -> "Developer: Reload Window"

# Check command palette
# Cmd/Ctrl + Shift + P -> Search "AST Copilot Helper"

# Verify extension is enabled
# File -> Preferences -> Extensions -> AST Copilot Helper

# Check for workspace-specific settings
cat .vscode/settings.json
```

#### Problem: No IntelliSense suggestions

```
Extension not providing code suggestions
```

**Solutions:**

```bash
# Initialize project for extension
ast-helper init

# Verify language server is running
# Output panel -> Language Servers

# Check file associations
# File -> Preferences -> Settings -> Files: Associations

# Restart TypeScript service
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"
```

## Performance Issues

### Memory Usage Problems

#### Problem: High memory consumption

```
Process using excessive memory (>2GB)
```

**Solutions:**

```bash
# Monitor memory usage
top -p $(pgrep ast-helper)
htop -p $(pgrep ast-helper)

# Reduce batch size
ast-helper config set parser.batchSize 50

# Process files incrementally
ast-helper parse src/ --incremental

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Problem: CPU usage too high

```
Process using 100% CPU for extended periods
```

**Solutions:**

```bash
# Check for infinite loops
strace -p $(pgrep ast-helper)

# Reduce concurrency
ast-helper config set parser.maxConcurrency 2

# Profile performance
ast-helper --profile parse src/

# Use incremental parsing
ast-helper parse src/ --watch --debounce 5000
```

### Disk I/O Issues

#### Problem: Slow file operations

```
File parsing taking longer than expected
```

**Solutions:**

```bash
# Check disk usage
iostat -x 1 5

# Monitor file operations
lsof | grep ast-helper

# Optimize file patterns
ast-helper config set parser.excludePatterns '["**/node_modules/**", "**/dist/**", "**/*.min.*"]'

# Use SSD if available
mv .ast-helper.db /path/to/ssd/
ln -s /path/to/ssd/.ast-helper.db .ast-helper.db
```

## Diagnostic Tools

### Built-in Diagnostics

#### Doctor Command

```bash
# Run comprehensive diagnostics
ast-helper doctor

# Check specific components
ast-helper doctor --parsers
ast-helper doctor --database
ast-helper doctor --ai
ast-helper doctor --mcp
```

#### Statistics and Status

```bash
# Project statistics
ast-helper stats

# Database status
ast-helper db --status

# Configuration status
ast-helper config --list

# Server status
ast-helper server --status
```

### Debug Modes

#### Verbose Logging

```bash
# Enable debug logging
export DEBUG=ast-helper:*
ast-helper parse src/

# Component-specific logging
export DEBUG=ast-helper:parser
export DEBUG=ast-helper:database
export DEBUG=ast-helper:ai
```

#### Performance Profiling

```bash
# Profile parsing performance
ast-helper parse src/ --profile

# Profile query performance
ast-helper query "function" --profile

# Memory profiling
node --inspect-brk $(which ast-helper) parse src/
# Open chrome://inspect
```

## Getting Help

### Log Files

Check these locations for log files:

- `~/.ast-helper/logs/` (main logs)
- `~/.vscode/logs/` (VS Code extension logs)
- Project root: `.ast-helper.log`

### Issue Reporting

When reporting issues, include:

1. **System Information:**

   ```bash
   uname -a
   node --version
   npm --version
   ast-helper --version
   ```

2. **Configuration:**

   ```bash
   ast-helper config --export
   ```

3. **Logs:**

   ```bash
   tail -n 100 ~/.ast-helper/logs/error.log
   ```

4. **Reproduction Steps:**
   - Minimal example
   - Commands that trigger the issue
   - Expected vs actual behavior

### Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/yourusername/ast-copilot-helper/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/yourusername/ast-copilot-helper/discussions)
- **Documentation**: [Browse comprehensive docs](https://yourusername.github.io/ast-copilot-helper/)

### Emergency Recovery

If everything breaks:

```bash
# Nuclear option - complete reset
rm -rf .ast-helper*
rm -rf node_modules
npm cache clean --force
npm install ast-copilot-helper@latest
ast-helper init
ast-helper parse src/
```

Remember: Most issues have simple solutions. Check this troubleshooting guide first, then reach out to the community if needed!
