# AST Copilot Helper - VS Code Extension

A comprehensive VS Code extension for managing AST-based code analysis with MCP (Model Context Protocol) server integration and GitHub workflow automation.

## Features

### 🚀 Server Management

- **Automatic Server Lifecycle**: Start, stop, and restart AST MCP server processes
- **Health Monitoring**: Continuous health checks and automatic restart on failures
- **Process Control**: Full control over server processes with configurable timeouts
- **Status Tracking**: Real-time server status in VS Code status bar

### 🔄 MCP Protocol Integration

- **MCP Client**: Full MCP protocol support for communication with AST servers
- **Heartbeat Monitoring**: Connection health monitoring with automatic reconnection
- **Request Management**: Timeout handling and request queue management
- **Error Recovery**: Automatic reconnection with configurable retry policies

### 🎯 GitHub Workflow Automation

- **Issue Analysis**: AI-powered analysis of GitHub issues with code context
- **Code Generation**: Automated code generation based on issue requirements
- **Pull Request Creation**: Automated PR creation with generated code changes
- **Code Review**: AI-assisted code review with improvement suggestions

### ⚙️ Configuration Management

- **Comprehensive Settings**: Over 30 configurable options for all aspects
- **Validation**: Real-time configuration validation with helpful error messages
- **Dynamic Updates**: Hot-reloading of configuration changes without restart
- **Schema Support**: Full VS Code settings schema with IntelliSense

### 🎨 User Interface

- **Status Bar Integration**: Server status and quick actions
- **Progress Indicators**: Visual feedback for long-running operations
- **Notifications**: Contextual notifications with action buttons
- **WebView Panels**: Rich UI panels for complex interactions

## Installation

### Prerequisites

- VS Code 1.80.0 or higher
- Node.js 20.0.0 or higher
- AST MCP Server binary

### From Source

1. Clone the repository:

   ```bash
   git clone https://github.com/EvanDodds/ast-copilot-helper.git
   cd ast-copilot-helper/packages/vscode-extension
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Package the extension:

   ```bash
   npm run package
   ```

5. Install the generated `.vsix` file in VS Code

### From Marketplace

_(Coming soon)_

## Configuration

### Server Configuration

Configure the AST MCP server settings:

```json
{
  "astCopilotHelper.serverPath": "/path/to/ast-mcp-server",
  "astCopilotHelper.server.args": ["--port", "3000"],
  "astCopilotHelper.server.autoRestart": true,
  "astCopilotHelper.server.maxRestarts": 3,
  "astCopilotHelper.server.restartDelay": 2000,
  "astCopilotHelper.server.healthCheckInterval": 30000,
  "astCopilotHelper.server.startupTimeout": 10000
}
```

### Client Configuration

Configure MCP client behavior:

```json
{
  "astCopilotHelper.client.connectionTimeout": 30000,
  "astCopilotHelper.client.requestTimeout": 15000,
  "astCopilotHelper.client.heartbeatInterval": 30000,
  "astCopilotHelper.client.maxReconnectAttempts": 5,
  "astCopilotHelper.client.reconnectDelay": 2000,
  "astCopilotHelper.client.autoConnect": true,
  "astCopilotHelper.client.enableHeartbeat": true
}
```

### UI Configuration

Customize the user interface:

```json
{
  "astCopilotHelper.ui.showStatusBar": true,
  "astCopilotHelper.ui.showNotifications": true,
  "astCopilotHelper.ui.autoHideStatusBar": false,
  "astCopilotHelper.ui.notificationTimeout": 5000,
  "astCopilotHelper.ui.showProgressIndicators": true,
  "astCopilotHelper.ui.enableLogging": true,
  "astCopilotHelper.ui.logLevel": "info"
}
```

### GitHub Integration

Enable GitHub workflow features:

```json
{
  "astCopilotHelper.github.enableGitHubIntegration": true,
  "astCopilotHelper.github.defaultBranch": "main",
  "astCopilotHelper.github.pullRequestTemplate": "",
  "astCopilotHelper.github.reviewers": ["@reviewer1", "@reviewer2"],
  "astCopilotHelper.github.labels": ["enhancement", "ai-generated"],
  "astCopilotHelper.github.autoAssign": true
}
```

### Extension Settings

Global extension behavior:

```json
{
  "astCopilotHelper.autoStart": true,
  "astCopilotHelper.autoUpdate": true,
  "astCopilotHelper.enableTelemetry": false
}
```

## Commands

### Server Management

- **AST Helper: Start Server** - Start the AST MCP server
- **AST Helper: Stop Server** - Stop the AST MCP server
- **AST Helper: Restart Server** - Restart the AST MCP server
- **AST Helper: Show Server Status** - Display detailed server status
- **AST Helper: Validate Configuration** - Validate current settings

### GitHub Workflow

- **GitHub Workflow: Analyze Issue** - Analyze GitHub issue with AI
- **GitHub Workflow: Generate Code** - Generate code for issue resolution
- **GitHub Workflow: Create Pull Request** - Create PR with generated changes
- **GitHub Workflow: Review Code** - AI-assisted code review

### Utilities

- **AST Helper: Parse Workspace** - Parse current workspace files
- **AST Helper: Clear Index** - Clear AST index cache
- **AST Helper: Show Logs** - Display extension logs
- **AST Helper: Open Settings** - Open extension settings

## Usage

### Quick Start

1. **Configure Server Path**: Set `astCopilotHelper.serverPath` to your AST MCP server binary
2. **Start Server**: Use Command Palette (`Ctrl+Shift+P`) → "AST Helper: Start Server"
3. **Verify Status**: Check the status bar for server status indicator
4. **Parse Workspace**: Use "AST Helper: Parse Workspace" to index your code

### GitHub Workflow

1. **Enable Integration**: Set `astCopilotHelper.github.enableGitHubIntegration` to `true`
2. **Analyze Issue**: Use "GitHub Workflow: Analyze Issue" to analyze a GitHub issue
3. **Generate Code**: Use "GitHub Workflow: Generate Code" to create solution code
4. **Create PR**: Use "GitHub Workflow: Create Pull Request" to submit changes

### Server Management

The extension automatically manages the AST MCP server lifecycle:

- **Auto-start**: Server starts automatically when VS Code opens (configurable)
- **Health Monitoring**: Continuous health checks ensure server stability
- **Auto-restart**: Server restarts automatically on crashes (with limits)
- **Status Updates**: Real-time status updates in the status bar

### Configuration Validation

Use the configuration validation feature to ensure your settings are correct:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "AST Helper: Validate Configuration"
3. Fix any reported issues
4. Restart the server if needed

## Troubleshooting

### Server Won't Start

1. **Check Server Path**: Ensure `astCopilotHelper.serverPath` points to a valid executable
2. **Verify Permissions**: Make sure the server binary has execute permissions
3. **Check Logs**: Use "AST Helper: Show Logs" to see detailed error messages
4. **Validate Configuration**: Run "AST Helper: Validate Configuration"

### Connection Issues

1. **Check Server Status**: Verify the server is running
2. **Review Timeout Settings**: Increase timeout values if needed
3. **Check Network**: Ensure no firewall blocking communication
4. **Restart Connection**: Stop and start the server to reset connections

### GitHub Integration Issues

1. **Enable Integration**: Ensure `github.enableGitHubIntegration` is enabled
2. **Check Authentication**: Verify GitHub authentication in VS Code
3. **Validate Repository**: Ensure you're in a Git repository
4. **Check Permissions**: Verify GitHub repository permissions

### Performance Issues

1. **Adjust Memory Limits**: Increase server memory limits if needed
2. **Reduce Health Check Frequency**: Increase health check intervals
3. **Disable Features**: Turn off unused features like telemetry
4. **Clear Cache**: Use "AST Helper: Clear Index" to reset cache

### Common Error Messages

#### "Server path is not configured"

- **Solution**: Set `astCopilotHelper.serverPath` in VS Code settings

#### "Server executable not found"

- **Solution**: Verify the server path and file permissions

#### "Connection timeout"

- **Solution**: Increase `client.connectionTimeout` setting

#### "Health check failed"

- **Solution**: Check server status and restart if needed

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper/packages/vscode-extension

# Install dependencies
yarn install

# Build extension
npm run build

# Run tests
npm test

# Package extension
npm run package
```

### Project Structure

```
src/
├── extension.ts                 # Main extension entry point
├── managers/
│   ├── ServerProcessManager.ts  # Server lifecycle management
│   ├── MCPClientManager.ts      # MCP protocol client
│   ├── CommandHandlers.ts       # Command implementations
│   ├── UIManager.ts             # User interface management
│   └── ConfigurationManager.ts  # Configuration management
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run type checking
npm run typecheck
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and type checking
6. Submit a pull request

## API Reference

### Extension API

The extension exposes several APIs for integration:

#### Server Management API

```typescript
// Start server
await vscode.commands.executeCommand("astCopilotHelper.startServer");

// Stop server
await vscode.commands.executeCommand("astCopilotHelper.stopServer");

// Get server status
const status = await vscode.commands.executeCommand(
  "astCopilotHelper.getServerStatus",
);
```

#### Configuration API

```typescript
// Validate configuration
const validation = await vscode.commands.executeCommand(
  "astCopilotHelper.validateConfiguration",
);

// Get configuration
const config = vscode.workspace.getConfiguration("astCopilotHelper");
```

### Events

The extension emits several events that other extensions can listen to:

- `astCopilotHelper.serverStarted` - Server started successfully
- `astCopilotHelper.serverStopped` - Server stopped
- `astCopilotHelper.serverError` - Server encountered an error
- `astCopilotHelper.configurationChanged` - Configuration updated

## License

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions)
- **Documentation**: [Project Wiki](https://github.com/EvanDodds/ast-copilot-helper/wiki)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

---

**Made with ❤️ for the VS Code community**
