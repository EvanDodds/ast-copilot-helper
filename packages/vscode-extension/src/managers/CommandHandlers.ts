import * as vscode from "vscode";
import type { ServerProcessManager } from "./ServerProcessManager";
import type { MCPClientManager } from "./MCPClientManager";
import {
  runMCPCacheTests,
  showCacheStats,
} from "../test/mcpCacheTestCommand.js";

/**
 * Command Handlers for AST Copilot Helper Extension
 *
 * This class manages all VS Code command handlers for the extension,
 * including server management, GitHub workflow operations, and workspace analysis.
 */
export class CommandHandlers {
  private outputChannel: vscode.OutputChannel;
  private serverProcessManager: ServerProcessManager | null;
  private mcpClientManager: MCPClientManager | null;
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    outputChannel: vscode.OutputChannel,
    serverProcessManager: ServerProcessManager | null,
    mcpClientManager: MCPClientManager | null,
    statusBarItem: vscode.StatusBarItem,
  ) {
    this.outputChannel = outputChannel;
    this.serverProcessManager = serverProcessManager;
    this.mcpClientManager = mcpClientManager;
    this.statusBarItem = statusBarItem;
  }

  /**
   * Register all command handlers
   */
  public registerCommands(
    _context: vscode.ExtensionContext,
  ): vscode.Disposable[] {
    const commands: Array<{
      command: string;
      handler: (...args: any[]) => Promise<void>;
      title: string;
    }> = [
      // Server management commands
      {
        command: "astCopilotHelper.startServer",
        handler: this.handleStartServer.bind(this),
        title: "Start AST MCP Server",
      },
      {
        command: "astCopilotHelper.stopServer",
        handler: this.handleStopServer.bind(this),
        title: "Stop AST MCP Server",
      },
      {
        command: "astCopilotHelper.restartServer",
        handler: this.handleRestartServer.bind(this),
        title: "Restart AST MCP Server",
      },
      {
        command: "astCopilotHelper.showStatus",
        handler: this.handleServerStatus.bind(this),
        title: "Show AST MCP Server Status",
      },

      // Configuration and workspace commands
      {
        command: "astCopilotHelper.openSettings",
        handler: this.handleOpenSettings.bind(this),
        title: "Open AST Helper Settings",
      },
      {
        command: "astCopilotHelper.parseWorkspace",
        handler: this.handleParseWorkspace.bind(this),
        title: "Parse Workspace with AST Helper",
      },
      {
        command: "astCopilotHelper.clearIndex",
        handler: this.handleClearIndex.bind(this),
        title: "Clear AST Index",
      },
      {
        command: "astCopilotHelper.showLogs",
        handler: this.handleShowLogs.bind(this),
        title: "Show AST Helper Logs",
      },

      // GitHub workflow commands
      {
        command: "astCopilotHelper.analyzeIssue",
        handler: this.handleAnalyzeIssue.bind(this),
        title: "Analyze GitHub Issue",
      },
      {
        command: "astCopilotHelper.generateCode",
        handler: this.handleGenerateCode.bind(this),
        title: "Generate Code from Analysis",
      },
      {
        command: "astCopilotHelper.createPullRequest",
        handler: this.handleCreatePullRequest.bind(this),
        title: "Create Pull Request",
      },
      {
        command: "astCopilotHelper.reviewCode",
        handler: this.handleReviewCode.bind(this),
        title: "Review Code Changes",
      },
      {
        command: "astCopilotHelper.validateConfiguration",
        handler: this.handleValidateConfiguration.bind(this),
        title: "Validate Configuration",
      },

      // Cache management commands
      {
        command: "astCopilotHelper.testCache",
        handler: this.handleTestCache.bind(this),
        title: "Test MCP Cache Integration",
      },
      {
        command: "astCopilotHelper.showCacheStats",
        handler: this.handleShowCacheStats.bind(this),
        title: "Show Cache Statistics",
      },
    ];

    // Register each command
    const disposables: vscode.Disposable[] = [];
    commands.forEach(({ command, handler, title }) => {
      const disposable = vscode.commands.registerCommand(
        command,
        async (...args: any[]) => {
          try {
            this.outputChannel.appendLine(`Executing command: ${title}`);
            await handler(...args);
          } catch (error) {
            const errorMessage = `Error executing ${title}: ${error}`;
            this.outputChannel.appendLine(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
          }
        },
      );

      disposables.push(disposable);
      this.outputChannel.appendLine(`Registered command: ${command}`);
    });

    return disposables;
  }

  // ===========================================
  // Server Management Command Handlers
  // ===========================================

  /**
   * Start AST MCP Server
   */
  private async handleStartServer(): Promise<void> {
    this.outputChannel.appendLine("Start server command executed");

    if (!this.serverProcessManager) {
      const message = "Server process manager not initialized";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    if (this.serverProcessManager.isRunning()) {
      const message = "Server is already running";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    try {
      this.updateStatusBar("starting", "AST Server: Starting...");
      await this.serverProcessManager.start();
      this.outputChannel.appendLine("Server started successfully");
    } catch (error: any) {
      const message = `Failed to start server: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      this.updateStatusBar("error", "AST Server: Failed to Start");
    }
  }

  /**
   * Stop AST MCP Server
   */
  private async handleStopServer(): Promise<void> {
    this.outputChannel.appendLine("Stop server command executed");

    if (!this.serverProcessManager) {
      const message = "Server process manager not initialized";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    if (!this.serverProcessManager.isRunning()) {
      const message = "Server is not running";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    try {
      this.updateStatusBar("stopping", "AST Server: Stopping...");
      await this.serverProcessManager.stop();
      this.outputChannel.appendLine("Server stopped successfully");
    } catch (error: any) {
      const message = `Failed to stop server: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      this.updateStatusBar("error", "AST Server: Failed to Stop");
    }
  }

  /**
   * Restart AST MCP Server
   */
  private async handleRestartServer(): Promise<void> {
    this.outputChannel.appendLine("Restart server command executed");

    if (!this.serverProcessManager) {
      const message = "Server process manager not initialized";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    try {
      this.updateStatusBar("restarting", "AST Server: Restarting...");
      await this.serverProcessManager.restart();
      this.outputChannel.appendLine("Server restarted successfully");
    } catch (error: any) {
      const message = `Failed to restart server: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      this.updateStatusBar("error", "AST Server: Failed to Restart");
    }
  }

  /**
   * Show server status
   */
  private async handleServerStatus(): Promise<void> {
    this.outputChannel.appendLine("Server status command executed");

    if (!this.serverProcessManager) {
      vscode.window.showInformationMessage(
        "Server process manager not initialized",
      );
      return;
    }

    const state = this.serverProcessManager.getState();
    const isRunning = this.serverProcessManager.isRunning();
    // const process = this.serverProcessManager.getProcess(); // Method not available

    const statusInfo = [
      `Server State: ${state}`,
      `Running: ${isRunning ? "Yes" : "No"}`,
      // `Process ID: ${process?.pid || 'N/A'}`
    ];

    if (this.mcpClientManager) {
      const clientState = this.mcpClientManager.getState();
      // const stats = this.mcpClientManager.getConnectionStats(); // Method not available
      statusInfo.push(
        `Client State: ${clientState}`,
        // `Connected At: ${stats.connectTime || 'N/A'}`,
        // `Reconnect Attempts: ${stats.reconnectAttempts}`
      );
    }

    const message = statusInfo.join("\n");
    vscode.window.showInformationMessage(message);
    this.outputChannel.appendLine(`Server Status:\n${message}`);
  }

  // ===========================================
  // Configuration & Workspace Command Handlers
  // ===========================================

  /**
   * Open extension settings
   */
  private async handleOpenSettings(): Promise<void> {
    this.outputChannel.appendLine("Open settings command executed");
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "astCopilotHelper",
    );
  }

  /**
   * Parse workspace with AST
   */
  private async handleParseWorkspace(): Promise<void> {
    this.outputChannel.appendLine("Parse workspace command executed");

    if (
      !this.mcpClientManager ||
      this.mcpClientManager.getState() !== "connected"
    ) {
      const message =
        "MCP client not connected. Please start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    try {
      // Show progress indication
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Parsing workspace...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 25,
            message: "Connecting to AST server...",
          });

          // Call AST server to parse workspace
          const result = await this.mcpClientManager!.callTool(
            "parse_workspace",
            {
              workspace_path: vscode.workspace.rootPath || "",
              include_patterns: vscode.workspace
                .getConfiguration("astCopilotHelper")
                .get("includePatterns", ["**/*.ts", "**/*.js", "**/*.py"]),
              exclude_patterns: vscode.workspace
                .getConfiguration("astCopilotHelper")
                .get("excludePatterns", ["**/node_modules/**", "**/dist/**"]),
            },
          );

          progress.report({ increment: 75, message: "Processing results..." });

          this.outputChannel.appendLine(
            `Workspace parsing result: ${JSON.stringify(result, null, 2)}`,
          );
          vscode.window.showInformationMessage(
            "Workspace parsed successfully!",
          );
        },
      );
    } catch (error: any) {
      const message = `Failed to parse workspace: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Clear AST index
   */
  private async handleClearIndex(): Promise<void> {
    this.outputChannel.appendLine("Clear index command executed");

    if (
      !this.mcpClientManager ||
      this.mcpClientManager.getState() !== "connected"
    ) {
      const message =
        "MCP client not connected. Please start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      "Are you sure you want to clear the AST index? This action cannot be undone.",
      "Yes",
      "Cancel",
    );

    if (confirm !== "Yes") {
      this.outputChannel.appendLine("Clear index cancelled by user");
      return;
    }

    try {
      const result = await this.mcpClientManager.callTool("clear_index", {});
      this.outputChannel.appendLine(
        `Clear index result: ${JSON.stringify(result, null, 2)}`,
      );
      vscode.window.showInformationMessage("AST index cleared successfully!");
    } catch (error: any) {
      const message = `Failed to clear index: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Show extension logs
   */
  private async handleShowLogs(): Promise<void> {
    this.outputChannel.appendLine("Show logs command executed");
    this.outputChannel.show();
  }

  // ===========================================
  // GitHub Workflow Command Handlers
  // ===========================================

  /**
   * Analyze GitHub issue
   */
  private async handleAnalyzeIssue(): Promise<void> {
    this.outputChannel.appendLine("Analyze issue command executed");

    // Get issue URL or ID from user
    const issueInput = await vscode.window.showInputBox({
      prompt: "Enter GitHub issue URL or issue number",
      placeHolder: "https://github.com/owner/repo/issues/123 or #123",
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Please enter a valid issue URL or number";
        }
        return null;
      },
    });

    if (!issueInput) {
      this.outputChannel.appendLine("Issue analysis cancelled by user");
      return;
    }

    if (
      !this.mcpClientManager ||
      this.mcpClientManager.getState() !== "connected"
    ) {
      const message =
        "MCP client not connected. Please start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Analyzing GitHub issue...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 25,
            message: "Fetching issue details...",
          });

          const result = await this.mcpClientManager!.callTool(
            "analyze_github_issue",
            {
              issue_reference: issueInput.trim(),
              workspace_path: vscode.workspace.rootPath || "",
              include_context: true,
            },
          );

          progress.report({ increment: 75, message: "Processing analysis..." });

          // Show results in a new document
          await this.showAnalysisResults("GitHub Issue Analysis", result);

          this.outputChannel.appendLine(
            `Issue analysis completed: ${JSON.stringify(result, null, 2)}`,
          );
          vscode.window.showInformationMessage(
            "GitHub issue analyzed successfully!",
          );
        },
      );
    } catch (error: any) {
      const message = `Failed to analyze issue: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Generate code from analysis
   */
  private async handleGenerateCode(): Promise<void> {
    this.outputChannel.appendLine("Generate code command executed");

    if (
      !this.mcpClientManager ||
      this.mcpClientManager.getState() !== "connected"
    ) {
      const message =
        "MCP client not connected. Please start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    // Get generation parameters from user
    const description = await vscode.window.showInputBox({
      prompt: "Describe what code you want to generate",
      placeHolder: "e.g., Create a function to parse JSON files...",
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Please enter a description";
        }
        return null;
      },
    });

    if (!description) {
      this.outputChannel.appendLine("Code generation cancelled by user");
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating code...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 25,
            message: "Analyzing requirements...",
          });

          const result = await this.mcpClientManager!.callTool(
            "generate_code",
            {
              description: description.trim(),
              workspace_path: vscode.workspace.rootPath || "",
              target_language: await this.getTargetLanguage(),
              include_tests: true,
            },
          );

          progress.report({ increment: 75, message: "Generating files..." });

          // Show generated code in new documents
          await this.showGeneratedCode(result);

          this.outputChannel.appendLine(
            `Code generation completed: ${JSON.stringify(result, null, 2)}`,
          );
          vscode.window.showInformationMessage("Code generated successfully!");
        },
      );
    } catch (error: any) {
      const message = `Failed to generate code: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Create pull request
   */
  private async handleCreatePullRequest(): Promise<void> {
    this.outputChannel.appendLine("Create pull request command executed");

    // Check if there are uncommitted changes
    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
    if (!gitExtension) {
      vscode.window.showWarningMessage("Git extension not available");
      return;
    }

    const repo = gitExtension.getRepository(vscode.workspace.rootPath);
    if (!repo) {
      vscode.window.showWarningMessage("No Git repository found in workspace");
      return;
    }

    const changes = repo.state.workingTreeChanges;
    if (changes.length === 0) {
      vscode.window.showInformationMessage("No changes to commit");
      return;
    }

    // Get PR details from user
    const title = await vscode.window.showInputBox({
      prompt: "Enter pull request title",
      placeHolder: "Brief description of changes...",
    });

    if (!title) {
      this.outputChannel.appendLine("Pull request creation cancelled by user");
      return;
    }

    await vscode.window.showInputBox({
      prompt: "Enter pull request description (optional)",
      placeHolder: "Detailed description of changes...",
    });

    try {
      // Commit changes first
      await repo.add(changes.map((change: any) => change.uri.fsPath));
      await repo.commit(title);

      // Push to remote (assumes origin remote exists)
      const branches = await repo.getBranches();
      const currentBranch = branches.find(
        (branch: any) => branch.name === repo.state.HEAD?.name,
      );

      if (currentBranch) {
        await repo.push("origin", currentBranch.name);
      }

      vscode.window.showInformationMessage(
        `Changes committed and pushed. Create pull request manually on GitHub with title: "${title}"`,
      );
      this.outputChannel.appendLine(
        `Pull request preparation completed: ${title}`,
      );
    } catch (error: any) {
      const message = `Failed to prepare pull request: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Review code changes
   */
  private async handleReviewCode(): Promise<void> {
    this.outputChannel.appendLine("Review code command executed");

    if (
      !this.mcpClientManager ||
      this.mcpClientManager.getState() !== "connected"
    ) {
      const message =
        "MCP client not connected. Please start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showWarningMessage(message);
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showInformationMessage("Please open a file to review");
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Reviewing code...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 25,
            message: "Analyzing code structure...",
          });

          const result = await this.mcpClientManager!.callTool("review_code", {
            file_path: activeEditor.document.uri.fsPath,
            content: activeEditor.document.getText(),
            review_type: "comprehensive",
            include_suggestions: true,
          });

          progress.report({ increment: 75, message: "Generating review..." });

          // Show review results
          await this.showAnalysisResults("Code Review Results", result);

          this.outputChannel.appendLine(
            `Code review completed: ${JSON.stringify(result, null, 2)}`,
          );
          vscode.window.showInformationMessage("Code review completed!");
        },
      );
    } catch (error: any) {
      const message = `Failed to review code: ${error.message}`;
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
    }
  }

  // ===========================================
  // Helper Methods
  // ===========================================

  /**
   * Update status bar
   */
  private updateStatusBar(state: string, text: string): void {
    this.statusBarItem.text = text;

    switch (state) {
      case "starting":
      case "stopping":
      case "restarting":
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        break;
      case "error":
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        break;
      default:
        this.statusBarItem.backgroundColor = undefined;
        break;
    }

    this.statusBarItem.show();
  }

  /**
   * Show analysis results in a new document
   */
  private async showAnalysisResults(title: string, result: any): Promise<void> {
    const content =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);
    const doc = await vscode.workspace.openTextDocument({
      content: `# ${title}\n\n${content}`,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Show generated code in new documents
   */
  private async showGeneratedCode(result: any): Promise<void> {
    if (result.files && Array.isArray(result.files)) {
      for (const file of result.files) {
        const doc = await vscode.workspace.openTextDocument({
          content: file.content,
          language: file.language || "plaintext",
        });
        await vscode.window.showTextDocument(doc);
      }
    } else {
      // Show as single document
      const content =
        typeof result === "string" ? result : JSON.stringify(result, null, 2);
      const doc = await vscode.workspace.openTextDocument({
        content,
        language: "typescript",
      });
      await vscode.window.showTextDocument(doc);
    }
  }

  /**
   * Get target programming language
   */
  private async getTargetLanguage(): Promise<string> {
    const languages = [
      "TypeScript",
      "JavaScript",
      "Python",
      "Java",
      "C#",
      "Go",
      "Rust",
    ];

    const selected = await vscode.window.showQuickPick(languages, {
      placeHolder: "Select target programming language",
    });

    return selected?.toLowerCase() || "typescript";
  }

  /**
   * Handle validate configuration command
   */
  private async handleValidateConfiguration(): Promise<void> {
    this.outputChannel.appendLine("Validating extension configuration...");

    try {
      // Get current configuration
      const config = vscode.workspace.getConfiguration("astCopilotHelper");
      const serverPath = config.get<string>("serverPath", "");

      // Validate server path
      if (!serverPath) {
        vscode.window
          .showWarningMessage(
            "Server path is not configured. Please set astCopilotHelper.serverPath in settings.",
            "Open Settings",
          )
          .then((selection) => {
            if (selection === "Open Settings") {
              vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "astCopilotHelper.serverPath",
              );
            }
          });
        return;
      }

      // Check if server executable exists
      const fs = await import("fs");
      if (!fs.existsSync(serverPath)) {
        vscode.window
          .showErrorMessage(
            `Server executable not found at: ${serverPath}`,
            "Update Path",
          )
          .then((selection) => {
            if (selection === "Update Path") {
              vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "astCopilotHelper.serverPath",
              );
            }
          });
        return;
      }

      // Validate timeout values
      const connectionTimeout = config.get<number>(
        "client.connectionTimeout",
        30000,
      );
      const requestTimeout = config.get<number>("client.requestTimeout", 15000);
      const healthCheckInterval = config.get<number>(
        "server.healthCheckInterval",
        30000,
      );

      const issues: string[] = [];

      if (connectionTimeout < 5000) {
        issues.push("Connection timeout should be at least 5000ms");
      }

      if (requestTimeout < 1000) {
        issues.push("Request timeout should be at least 1000ms");
      }

      if (healthCheckInterval < 5000) {
        issues.push("Health check interval should be at least 5000ms");
      }

      if (issues.length > 0) {
        vscode.window
          .showWarningMessage(
            `Configuration issues found: ${issues.join(", ")}`,
            "Fix Configuration",
          )
          .then((selection) => {
            if (selection === "Fix Configuration") {
              vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "astCopilotHelper",
              );
            }
          });
        return;
      }

      // All validations passed
      vscode.window
        .showInformationMessage(
          "Configuration is valid and ready to use!",
          "Start Server",
        )
        .then((selection) => {
          if (selection === "Start Server") {
            vscode.commands.executeCommand("astCopilotHelper.startServer");
          }
        });

      this.outputChannel.appendLine(
        "Configuration validation completed successfully",
      );
    } catch (error) {
      const errorMsg = `Configuration validation failed: ${error}`;
      this.outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    }
  }

  // ===========================================
  // Cache Management Command Handlers
  // ===========================================

  /**
   * Test MCP Cache Integration
   */
  private async handleTestCache(): Promise<void> {
    this.outputChannel.appendLine("Running MCP cache integration tests...");

    if (!this.mcpClientManager) {
      const message = "MCP client manager not initialized";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    if (!this.mcpClientManager.isConnected()) {
      const message = "MCP client not connected. Start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    try {
      await runMCPCacheTests(this.outputChannel, this.mcpClientManager);
      vscode.window.showInformationMessage(
        "Cache integration tests completed!",
      );
    } catch (error) {
      const errorMsg = `Cache tests failed: ${error}`;
      this.outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    }
  }

  /**
   * Show Cache Statistics
   */
  private async handleShowCacheStats(): Promise<void> {
    this.outputChannel.appendLine("Fetching cache statistics...");

    if (!this.mcpClientManager) {
      const message = "MCP client manager not initialized";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    if (!this.mcpClientManager.isConnected()) {
      const message = "MCP client not connected. Start the server first.";
      this.outputChannel.appendLine(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    try {
      await showCacheStats(this.outputChannel, this.mcpClientManager);
    } catch (error) {
      const errorMsg = `Failed to get cache statistics: ${error}`;
      this.outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    }
  }
}
