import * as vscode from 'vscode';
import { ServerProcessManager } from './managers/ServerProcessManager';
import { MCPClientManager } from './managers/MCPClientManager';
import { CommandHandlers } from './managers/CommandHandlers';
import { UIManager } from './managers/UIManager';
import { ConfigurationManager } from './managers/ConfigurationManager';

/**
 * VS Code Extension for AST MCP Server Management
 * 
 * This extension provides comprehensive management of AST MCP server processes,
 * including server lifecycle, configuration management, workspace integration,
 * and user interface components.
 */

let outputChannel: vscode.OutputChannel;
let configurationManager: ConfigurationManager | null = null;
let serverProcessManager: ServerProcessManager | null = null;
let mcpClientManager: MCPClientManager | null = null;
let commandHandlers: CommandHandlers | null = null;
let uiManager: UIManager | null = null;
const disposables: vscode.Disposable[] = [];

/**
 * Extension activation entry point
 * Called when VS Code activates the extension
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('AST MCP Helper extension is activating...');
  
  try {
    // Initialize output channel for logging
    initializeOutputChannel();
    
    // Initialize configuration manager
    configurationManager = new ConfigurationManager(outputChannel);
    disposables.push(configurationManager);
    
    // Initialize user interface manager
    uiManager = new UIManager(outputChannel, null, null);
    
    // Initialize server and client managers
    initializeManagers();
    
    // Update UI manager with initialized references
    if (uiManager) {
      uiManager.updateReferences(serverProcessManager, mcpClientManager);
      disposables.push(uiManager);
    }
    
    // Register all extension commands
    commandHandlers = new CommandHandlers(
      outputChannel, 
      serverProcessManager, 
      mcpClientManager, 
      uiManager!.getStatusBarItem()
    );
    const commandDisposables = commandHandlers.registerCommands(context);
    disposables.push(...commandDisposables);
    
    // Initialize configuration monitoring
    initializeConfigurationWatcher(context);
    
    // Auto-start server if enabled
    handleAutoStart();
    
    // Store disposables in context for proper cleanup
    context.subscriptions.push(...disposables);
    
    outputChannel.appendLine('AST MCP Helper extension activated successfully');
  } catch (error) {
    const message = `Failed to activate extension: ${error}`;
    console.error(message);
    
    // Create output channel even if activation fails
    if (!outputChannel) {
      outputChannel = vscode.window.createOutputChannel('AST MCP Helper');
    }
    
    outputChannel.appendLine(message);
    vscode.window.showErrorMessage(`AST MCP Helper activation failed: ${error}`);
  }
}

/**
 * Extension deactivation entry point
 * Called when VS Code deactivates the extension
 */
export async function deactivate(): Promise<void> {
  console.log('AST MCP Helper extension is deactivating...');
  
  try {
    // Stop server process if running
    if (serverProcessManager) {
      try {
        outputChannel?.appendLine('Stopping server during deactivation...');
        await serverProcessManager.stop();
        outputChannel?.appendLine('Server stopped successfully during deactivation');
      } catch (error) {
        outputChannel?.appendLine(`Failed to stop server during deactivation: ${error}`);
      }
    }
    
    // Close MCP client connection
    if (mcpClientManager) {
      try {
        outputChannel?.appendLine('Closing MCP client connection...');
        await mcpClientManager.disconnect();
      } catch (error) {
        outputChannel?.appendLine(`Failed to close MCP client: ${error}`);
      }
    }
    
    // Dispose configuration manager
    if (configurationManager) {
      configurationManager.dispose();
    }
    
    // Dispose UI manager
    if (uiManager) {
      uiManager.dispose();
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
      outputChannel.dispose();
    }
    
    console.log('AST MCP Helper extension deactivated successfully');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}

/**
 * Initialize the output channel for extension logging
 */
function initializeOutputChannel(): void {
  outputChannel = vscode.window.createOutputChannel('AST MCP Helper');
  disposables.push(outputChannel);
  outputChannel.appendLine('AST MCP Helper extension starting...');
}

/**
 * Initialize server and client managers
 */
function initializeManagers(): void {
  outputChannel.appendLine('Initializing server and client managers...');
  
  // Use configuration manager for settings
  const serverConfig = configurationManager?.getServerConfiguration() || {
    serverPath: '',
    args: [],
    autoRestart: true,
    maxRestarts: 3,
    restartDelay: 2000,
    healthCheckInterval: 30000,
    startupTimeout: 10000
  };

  // Initialize server process manager
  serverProcessManager = new ServerProcessManager(serverConfig, outputChannel);
  
  // Use configuration manager for client settings
  const clientConfig = configurationManager?.getClientConfiguration() || {
    connectionTimeout: 30000,
    requestTimeout: 15000,
    heartbeatInterval: 30000,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
    autoConnect: true,
    enableHeartbeat: true
  };
  
  // Initialize MCP client manager
  mcpClientManager = new MCPClientManager(serverProcessManager, clientConfig, outputChannel);
  
  // Add to disposables
  disposables.push(serverProcessManager, mcpClientManager);
  
  outputChannel.appendLine('Server and client managers initialized');
}

/**
 * Initialize configuration change monitoring
 */
function initializeConfigurationWatcher(context: vscode.ExtensionContext): void {
  const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('astCopilotHelper')) {
      outputChannel.appendLine('AST Helper configuration changed, applying updates...');
      handleConfigurationChange();
    }
  });
  
  disposables.push(configWatcher);
  context.subscriptions.push(configWatcher);
}

/**
 * Handle auto-start functionality
 */
function handleAutoStart(): void {
  const extensionConfig = configurationManager?.getExtensionConfiguration();
  const autoStart = extensionConfig?.autoStart ?? true;
  
  if (autoStart) {
    outputChannel.appendLine('Auto-start enabled, starting server...');
    // Start with a small delay to allow extension to fully initialize
    setTimeout(async () => {
      if (serverProcessManager) {
        try {
          await serverProcessManager.start();
        } catch (error) {
          outputChannel.appendLine(`Failed to auto-start server: ${error}`);
          if (uiManager) {
            uiManager.showErrorNotification(`Failed to auto-start server: ${error}`, true);
          }
        }
      }
    }, 1000); // 1 second delay
  } else {
    outputChannel.appendLine('Auto-start disabled');
  }
}

/**
 * Handle configuration changes
 */
function handleConfigurationChange(): void {
  outputChannel.appendLine('Handling configuration change...');
  
  if (configurationManager) {
    const validation = configurationManager.validateConfiguration();
    
    if (!validation.isValid) {
      outputChannel.appendLine(`Configuration validation errors: ${validation.errors.join(', ')}`);
      if (uiManager) {
        uiManager.showErrorNotification(
          `Configuration errors: ${validation.errors.join(', ')}`,
          true
        );
      }
    } else {
      outputChannel.appendLine('Configuration is valid');
      if (uiManager) {
        uiManager.showInfoNotification(
          'Configuration changed and validated successfully.',
          true
        );
      }
    }
  }
}