import * as vscode from 'vscode';

/**
 * VS Code Extension for AST MCP Server Management
 * 
 * This extension provides comprehensive management of AST MCP server processes,
 * including server lifecycle, configuration management, workspace integration,
 * and user interface components.
 */

let outputChannel: vscode.OutputChannel;
let serverProcessManager: any; // Will be implemented in Subtask 3
let mcpClient: any; // Will be implemented in Subtask 4
let statusBarItem: vscode.StatusBarItem;
let disposables: vscode.Disposable[] = [];

/**
 * Extension activation entry point
 * Called when VS Code activates the extension
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('AST MCP Helper extension is activating...');
  
  try {
    // Initialize output channel for logging
    initializeOutputChannel();
    
    // Initialize status bar integration
    initializeStatusBar(context);
    
    // Register all extension commands
    registerCommands(context);
    
    // Initialize configuration monitoring
    initializeConfigurationWatcher(context);
    
    // Load initial configuration and start server if auto-start enabled
    initializeExtension();
    
    // Store disposables in context for proper cleanup
    context.subscriptions.push(...disposables);
    
    outputChannel.appendLine('AST MCP Helper extension activated successfully');
    console.log('AST MCP Helper extension activated successfully');
    
  } catch (error) {
    const errorMessage = `Failed to activate AST MCP Helper extension: ${error}`;
    outputChannel?.appendLine(errorMessage);
    console.error(errorMessage, error);
    vscode.window.showErrorMessage(errorMessage);
  }
}

/**
 * Extension deactivation cleanup
 * Called when VS Code deactivates the extension
 */
export function deactivate(): void {
  console.log('AST MCP Helper extension is deactivating...');
  
  try {
    // Stop server if running
    if (serverProcessManager) {
      // Will be implemented in Subtask 3
      outputChannel?.appendLine('Stopping MCP server during extension deactivation...');
    }
    
    // Close MCP client connection
    if (mcpClient) {
      // Will be implemented in Subtask 4
      outputChannel?.appendLine('Closing MCP client connection...');
    }
    
    // Dispose all resources
    disposables.forEach(disposable => {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    });
    
    // Clean up output channel
    if (outputChannel) {
      outputChannel.appendLine('AST MCP Helper extension deactivated');
      outputChannel.dispose();
    }
    
    console.log('AST MCP Helper extension deactivated successfully');
    
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}

/**
 * Initialize output channel for extension logging
 */
function initializeOutputChannel(): void {
  outputChannel = vscode.window.createOutputChannel('AST MCP Helper');
  disposables.push(outputChannel);
  
  outputChannel.appendLine('='.repeat(50));
  outputChannel.appendLine('AST MCP Helper Extension Log');
  outputChannel.appendLine(`Activated at: ${new Date().toISOString()}`);
  outputChannel.appendLine('='.repeat(50));
}

/**
 * Initialize status bar item for server status display
 */
function initializeStatusBar(_context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'astHelper.serverStatus';
  statusBarItem.tooltip = 'Click to view AST MCP server status';
  updateStatusBar('initializing', 'AST Server: Initializing...');
  statusBarItem.show();
  
  disposables.push(statusBarItem);
}

/**
 * Update status bar with current server state
 */
function updateStatusBar(state: string, text: string): void {
  if (!statusBarItem) return;
  
  statusBarItem.text = text;
  
  // Set different colors based on server state
  switch (state) {
    case 'running':
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      break;
    case 'stopped':
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      break;
    case 'error':
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      break;
    default:
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = undefined;
  }
}

/**
 * Register all extension commands
 */
function registerCommands(_context: vscode.ExtensionContext): void {
  const commands: Array<{
    command: string;
    handler: (...args: any[]) => Promise<void>;
    title: string;
  }> = [
    // Server management commands
    {
      command: 'astHelper.startServer',
      handler: handleStartServer,
      title: 'Start AST MCP Server'
    },
    {
      command: 'astHelper.stopServer', 
      handler: handleStopServer,
      title: 'Stop AST MCP Server'
    },
    {
      command: 'astHelper.restartServer',
      handler: handleRestartServer,
      title: 'Restart AST MCP Server'
    },
    {
      command: 'astHelper.serverStatus',
      handler: handleServerStatus,
      title: 'Show AST MCP Server Status'
    },
    
    // Configuration and workspace commands
    {
      command: 'astHelper.openSettings',
      handler: handleOpenSettings,
      title: 'Open AST Helper Settings'
    },
    {
      command: 'astHelper.parseWorkspace',
      handler: handleParseWorkspace,
      title: 'Parse Workspace with AST Helper'
    },
    {
      command: 'astHelper.clearIndex',
      handler: handleClearIndex,
      title: 'Clear AST Index'
    },
    {
      command: 'astHelper.showLogs',
      handler: handleShowLogs,
      title: 'Show AST Helper Logs'
    }
  ];
  
  // Register each command
  commands.forEach(({ command, handler, title }) => {
    const disposable = vscode.commands.registerCommand(command, async (...args: any[]) => {
      try {
        outputChannel.appendLine(`Executing command: ${title}`);
        await handler(...args);
      } catch (error) {
        const errorMessage = `Error executing ${title}: ${error}`;
        outputChannel.appendLine(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
      }
    });
    
    disposables.push(disposable);
    outputChannel.appendLine(`Registered command: ${command}`);
  });
}

/**
 * Initialize configuration change monitoring
 */
function initializeConfigurationWatcher(_context: vscode.ExtensionContext): void {
  const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('astHelper')) {
      outputChannel.appendLine('AST Helper configuration changed, applying updates...');
      handleConfigurationChange();
    }
  });
  
  disposables.push(configWatcher);
  outputChannel.appendLine('Configuration watcher initialized');
}

/**
 * Initialize extension with current configuration
 */
function initializeExtension(): void {
  const config = vscode.workspace.getConfiguration('astHelper');
  const autoStart = config.get<boolean>('server.autoStart', false);
  
  outputChannel.appendLine(`Auto-start server: ${autoStart}`);
  
  if (autoStart) {
    outputChannel.appendLine('Auto-start enabled, starting server...');
    // Will trigger handleStartServer when ServerProcessManager is implemented
    updateStatusBar('starting', 'AST Server: Starting...');
  } else {
    updateStatusBar('stopped', 'AST Server: Stopped');
  }
}

/**
 * Handle configuration changes
 */
function handleConfigurationChange(): void {
  // Will be implemented in Subtask 6: Configuration Management System
  outputChannel.appendLine('Configuration change handler called (implementation pending)');
}

// =============================================================================
// COMMAND HANDLERS (Will be fully implemented in Subtask 5)
// =============================================================================

/**
 * Start MCP Server command handler
 */
async function handleStartServer(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Start server command executed');
  updateStatusBar('starting', 'AST Server: Starting...');
  
  // Implementation pending - Subtask 3: Server Process Manager
  vscode.window.showInformationMessage('Start server functionality will be implemented in Subtask 3');
  updateStatusBar('stopped', 'AST Server: Implementation Pending');
}

/**
 * Stop MCP Server command handler
 */
async function handleStopServer(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Stop server command executed');
  updateStatusBar('stopping', 'AST Server: Stopping...');
  
  // Implementation pending - Subtask 3: Server Process Manager
  vscode.window.showInformationMessage('Stop server functionality will be implemented in Subtask 3');
  updateStatusBar('stopped', 'AST Server: Stopped');
}

/**
 * Restart MCP Server command handler
 */
async function handleRestartServer(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Restart server command executed');
  
  // Implementation pending - Subtask 3: Server Process Manager
  vscode.window.showInformationMessage('Restart server functionality will be implemented in Subtask 3');
}

/**
 * Show server status command handler
 */
async function handleServerStatus(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Server status command executed');
  
  // Implementation pending - Subtask 3: Server Process Manager
  const status = 'Implementation Pending';
  vscode.window.showInformationMessage(`AST MCP Server Status: ${status}`);
}

/**
 * Open extension settings command handler
 */
async function handleOpenSettings(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Open settings command executed');
  
  // Open VS Code settings focused on AST Helper extension
  await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:ast-copilot-helper.vscode-extension');
}

/**
 * Parse workspace command handler
 */
async function handleParseWorkspace(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Parse workspace command executed');
  
  // Implementation pending - Subtask 7: Workspace Integration Features
  vscode.window.showInformationMessage('Parse workspace functionality will be implemented in Subtask 7');
}

/**
 * Clear AST index command handler
 */
async function handleClearIndex(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Clear index command executed');
  
  // Implementation pending - Subtask 7: Workspace Integration Features
  vscode.window.showInformationMessage('Clear index functionality will be implemented in Subtask 7');
}

/**
 * Show logs command handler
 */
async function handleShowLogs(..._args: any[]): Promise<void> {
  outputChannel.appendLine('Show logs command executed');
  
  // Show the output channel
  outputChannel.show();
}
