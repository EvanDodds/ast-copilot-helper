import * as vscode from 'vscode';
import type { ServerProcessManager } from './ServerProcessManager';
import type { MCPClientManager } from './MCPClientManager';

/**
 * User Interface Manager for AST Copilot Helper Extension
 * 
 * This class manages all user interface components including status bar,
 * progress indicators, notifications, and user interactions.
 */
export class UIManager {
  private outputChannel: vscode.OutputChannel;
  private serverProcessManager: ServerProcessManager | null;
  private mcpClientManager: MCPClientManager | null;
  private statusBarItem!: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  // Progress tracking
  private activeProgressToken: vscode.CancellationTokenSource | null = null;

  constructor(
    outputChannel: vscode.OutputChannel,
    serverProcessManager: ServerProcessManager | null,
    mcpClientManager: MCPClientManager | null
  ) {
    this.outputChannel = outputChannel;
    this.serverProcessManager = serverProcessManager;
    this.mcpClientManager = mcpClientManager;

    // Initialize UI components
    this.initializeStatusBar();
    this.setupEventHandlers();
  }

  /**
   * Initialize the status bar item
   */
  private initializeStatusBar(): void {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      100
    );
    
    this.statusBarItem.command = 'astCopilotHelper.showStatus';
    this.statusBarItem.text = '$(circle-slash) AST Server: Stopped';
    this.statusBarItem.tooltip = 'AST MCP Server Status - Click for details';
    this.statusBarItem.show();
    
    this.disposables.push(this.statusBarItem);
    this.outputChannel.appendLine('Status bar initialized');
  }

  /**
   * Set up event handlers for server and client state changes
   */
  private setupEventHandlers(): void {
    if (this.serverProcessManager) {
      this.serverProcessManager.on('stateChanged', (newState) => {
        this.updateStatusBar(newState);
      });

      this.serverProcessManager.on('started', (info) => {
        this.showSuccessNotification(`AST MCP Server started (PID: ${info.pid})`);
      });

      this.serverProcessManager.on('stopped', () => {
        this.showInfoNotification('AST MCP Server stopped');
      });

      this.serverProcessManager.on('error', (error) => {
        this.showErrorNotification(`Server error: ${error.message}`);
      });

      this.serverProcessManager.on('crashed', (exitCode, signal) => {
        this.showWarningNotification(`Server crashed (exit code: ${exitCode}, signal: ${signal})`);
      });

      this.serverProcessManager.on('restarting', (attempt, maxAttempts) => {
        this.showInfoNotification(`Restarting server (attempt ${attempt}/${maxAttempts})`);
      });
    }

    if (this.mcpClientManager) {
      this.mcpClientManager.on('connected', () => {
        this.showSuccessNotification('MCP client connected to server');
      });

      this.mcpClientManager.on('disconnected', () => {
        this.showWarningNotification('MCP client disconnected from server');
      });

      this.mcpClientManager.on('error', (error) => {
        this.showErrorNotification(`MCP client error: ${error.message}`);
      });

      this.mcpClientManager.on('reconnecting', (attempt, maxAttempts) => {
        this.showProgressNotification(
          `Reconnecting to server (attempt ${attempt}/${maxAttempts})`,
          false
        );
      });
    }
  }

  /**
   * Update the status bar based on server state
   */
  public updateStatusBar(state?: string): void {
    if (!this.statusBarItem) {
return;
}
    
    try {
      const serverState = state || this.serverProcessManager?.getState() || 'unknown';
      const clientState = this.mcpClientManager?.getState() || 'disconnected';
      
      // Determine overall status
      let text: string;
      let backgroundColor: vscode.ThemeColor | undefined;
      let tooltip: string;

      switch (serverState) {
        case 'starting':
          text = '$(loading~spin) AST Server: Starting';
          backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
          tooltip = 'AST MCP Server is starting up...';
          break;
        case 'running':
          if (clientState === 'connected') {
            text = '$(check) AST Server: Connected';
            backgroundColor = undefined;
            tooltip = 'AST MCP Server is running and connected';
          } else {
            text = '$(warning) AST Server: Running';
            backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            tooltip = 'AST MCP Server is running but client not connected';
          }
          break;
        case 'stopping':
          text = '$(loading~spin) AST Server: Stopping';
          backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
          tooltip = 'AST MCP Server is shutting down...';
          break;
        case 'stopped':
          text = '$(circle-slash) AST Server: Stopped';
          backgroundColor = undefined;
          tooltip = 'AST MCP Server is stopped - Click to view status';
          break;
        case 'error':
          text = '$(error) AST Server: Error';
          backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
          tooltip = 'AST MCP Server encountered an error - Click for details';
          break;
        default:
          text = `AST Server: ${serverState}`;
          backgroundColor = undefined;
          tooltip = `Server state: ${serverState}, Client state: ${clientState}`;
      }
      
      this.statusBarItem.text = text;
      this.statusBarItem.backgroundColor = backgroundColor;
      this.statusBarItem.tooltip = tooltip;
    } catch (error) {
      this.outputChannel.appendLine(`Error updating status bar: ${error}`);
    }
  }

  /**
   * Show a success notification
   */
  public showSuccessNotification(message: string, showActions?: boolean): void {
    this.outputChannel.appendLine(`✓ ${message}`);
    
    if (showActions) {
      vscode.window.showInformationMessage(message, 'Show Logs', 'View Status')
        .then((selection) => {
          switch (selection) {
            case 'Show Logs':
              this.outputChannel.show();
              break;
            case 'View Status':
              vscode.commands.executeCommand('astCopilotHelper.showStatus');
              break;
          }
        });
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  /**
   * Show an info notification
   */
  public showInfoNotification(message: string, showActions?: boolean): void {
    this.outputChannel.appendLine(`ℹ ${message}`);
    
    if (showActions) {
      vscode.window.showInformationMessage(message, 'Show Logs')
        .then((selection) => {
          if (selection === 'Show Logs') {
            this.outputChannel.show();
          }
        });
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  /**
   * Show a warning notification
   */
  public showWarningNotification(message: string, showActions?: boolean): void {
    this.outputChannel.appendLine(`⚠ ${message}`);
    
    if (showActions) {
      vscode.window.showWarningMessage(message, 'Show Logs', 'Retry')
        .then((selection) => {
          switch (selection) {
            case 'Show Logs':
              this.outputChannel.show();
              break;
            case 'Retry':
              // Implement retry logic based on context
              this.handleRetryAction();
              break;
          }
        });
    } else {
      vscode.window.showWarningMessage(message);
    }
  }

  /**
   * Show an error notification
   */
  public showErrorNotification(message: string, showActions?: boolean): void {
    this.outputChannel.appendLine(`✗ ${message}`);
    
    if (showActions) {
      vscode.window.showErrorMessage(message, 'Show Logs', 'Report Issue', 'Open Settings')
        .then((selection) => {
          switch (selection) {
            case 'Show Logs':
              this.outputChannel.show();
              break;
            case 'Report Issue':
              vscode.env.openExternal(vscode.Uri.parse('https://github.com/EvanDodds/ast-copilot-helper/issues'));
              break;
            case 'Open Settings':
              vscode.commands.executeCommand('workbench.action.openSettings', 'astCopilotHelper');
              break;
          }
        });
    } else {
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Show a progress notification
   */
  public showProgressNotification(
    title: string, 
    cancellable = false,
    location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
  ): vscode.Progress<{ message?: string; increment?: number }> | null {
    // Cancel any existing progress
    this.cancelProgress();

    let progressResolver: ((value: vscode.Progress<{ message?: string; increment?: number }>) => void) | null = null;
    
    // Create cancellation token if needed
    if (cancellable) {
      this.activeProgressToken = new vscode.CancellationTokenSource();
    }

    vscode.window.withProgress({
      location,
      title,
      cancellable
    }, (progress, token) => {
      if (progressResolver) {
        progressResolver(progress);
      }

      // Handle cancellation
      if (cancellable && token) {
        token.onCancellationRequested(() => {
          this.outputChannel.appendLine(`Progress cancelled: ${title}`);
          this.activeProgressToken?.cancel();
        });
      }

      // Return a promise that resolves when progress is done
      return new Promise<void>((resolve) => {
        if (this.activeProgressToken) {
          this.activeProgressToken.token.onCancellationRequested(() => {
            resolve();
          });
        }
        
        // Auto-resolve after 30 seconds if not explicitly cancelled
        setTimeout(() => {
          resolve();
        }, 30000);
      });
    });

    // Return progress object via promise
    return new Promise<vscode.Progress<{ message?: string; increment?: number }>>((resolve) => {
      progressResolver = resolve;
    }) as any;
  }

  /**
   * Cancel active progress notification
   */
  public cancelProgress(): void {
    if (this.activeProgressToken) {
      this.activeProgressToken.cancel();
      this.activeProgressToken.dispose();
      this.activeProgressToken = null;
    }
  }

  /**
   * Show a quick pick for user selection
   */
  public async showQuickPick<T>(
    items: (vscode.QuickPickItem & { data: T })[],
    options: vscode.QuickPickOptions
  ): Promise<T | undefined> {
    const selected = await vscode.window.showQuickPick(items, options);
    return selected?.data;
  }

  /**
   * Show an input box for user input
   */
  public async showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined> {
    return await vscode.window.showInputBox(options);
  }

  /**
   * Show a file picker dialog
   */
  public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> {
    return await vscode.window.showOpenDialog(options);
  }

  /**
   * Show a save dialog
   */
  public async showSaveDialog(options: vscode.SaveDialogOptions): Promise<vscode.Uri | undefined> {
    return await vscode.window.showSaveDialog(options);
  }

  /**
   * Create and show a webview panel
   */
  public createWebviewPanel(
    viewType: string,
    title: string,
    showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean },
    options: vscode.WebviewPanelOptions & vscode.WebviewOptions
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(viewType, title, showOptions, options);
    this.disposables.push(panel);
    return panel;
  }

  /**
   * Show server status details
   */
  public async showServerStatusDetails(): Promise<void> {
    const items: { label: string; detail: string; data: string }[] = [];

    // Server information
    if (this.serverProcessManager) {
      const state = this.serverProcessManager.getState();
      const isRunning = this.serverProcessManager.isRunning();
      
      items.push({
        label: '$(server) Server Status',
        detail: `State: ${state}, Running: ${isRunning ? 'Yes' : 'No'}`,
        data: 'server'
      });
    }

    // Client information
    if (this.mcpClientManager) {
      const clientState = this.mcpClientManager.getState();
      
      items.push({
        label: '$(plug) Client Status',
        detail: `State: ${clientState}`,
        data: 'client'
      });
    }

    // Configuration info
    const config = vscode.workspace.getConfiguration('astCopilotHelper');
    items.push({
      label: '$(gear) Configuration',
      detail: `Auto-start: ${config.get('autoStart', true)}`,
      data: 'config'
    });

    // Actions
    items.push(
      {
        label: '$(output) Show Logs',
        detail: 'View extension output logs',
        data: 'logs'
      },
      {
        label: '$(settings-gear) Open Settings',
        detail: 'Open extension settings',
        data: 'settings'
      }
    );

    const selected = await this.showQuickPick(items, {
      placeHolder: 'Select an option to view details or perform an action'
    });

    switch (selected) {
      case 'logs':
        this.outputChannel.show();
        break;
      case 'settings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'astCopilotHelper');
        break;
      default:
        break;
    }
  }

  /**
   * Handle retry action based on current context
   */
  private handleRetryAction(): void {
    if (!this.serverProcessManager) {
return;
}

    const state = this.serverProcessManager.getState();
    switch (state) {
      case 'error':
      case 'stopped':
        vscode.commands.executeCommand('astCopilotHelper.startServer');
        break;
      case 'running':
        if (this.mcpClientManager && this.mcpClientManager.getState() === 'disconnected') {
          this.mcpClientManager.connect();
        }
        break;
      default:
        this.outputChannel.appendLine(`No retry action available for state: ${state}`);
    }
  }

  /**
   * Update server and client references
   */
  public updateReferences(
    serverProcessManager: ServerProcessManager | null,
    mcpClientManager: MCPClientManager | null
  ): void {
    this.serverProcessManager = serverProcessManager;
    this.mcpClientManager = mcpClientManager;
    this.setupEventHandlers();
  }

  /**
   * Get the status bar item (for external access)
   */
  public getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  /**
   * Dispose all UI resources
   */
  public dispose(): void {
    this.cancelProgress();
    
    this.disposables.forEach(disposable => {
      try {
        disposable.dispose();
      } catch (error) {
        this.outputChannel.appendLine(`Error disposing UI resource: ${error}`);
      }
    });
    
    this.disposables = [];
    this.outputChannel.appendLine('UI Manager disposed');
  }
}