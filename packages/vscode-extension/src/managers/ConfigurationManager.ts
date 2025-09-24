import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Configuration Management for AST Copilot Helper Extension
 *
 * This class provides comprehensive configuration management including:
 * - VS Code settings integration
 * - Configuration validation
 * - Dynamic configuration updates
 * - Default value management
 * - Configuration file monitoring
 */

export interface ServerConfiguration {
  serverPath: string;
  args: string[];
  autoRestart: boolean;
  maxRestarts: number;
  restartDelay: number;
  healthCheckInterval: number;
  startupTimeout: number;
  environment?: Record<string, string>;
}

export interface ClientConfiguration {
  connectionTimeout: number;
  requestTimeout: number;
  heartbeatInterval: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  autoConnect: boolean;
  enableHeartbeat: boolean;
}

export interface UIConfiguration {
  showStatusBar: boolean;
  showNotifications: boolean;
  autoHideStatusBar: boolean;
  notificationTimeout: number;
  showProgressIndicators: boolean;
  enableLogging: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
}

export interface GitHubConfiguration {
  enableGitHubIntegration: boolean;
  defaultBranch: string;
  pullRequestTemplate: string;
  reviewers: string[];
  labels: string[];
  autoAssign: boolean;
}

export interface ExtensionConfiguration {
  autoStart: boolean;
  autoUpdate: boolean;
  enableTelemetry: boolean;
  workspaceRoot: string;
  configPath: string;
}

export interface ASTConfiguration {
  server: ServerConfiguration;
  client: ClientConfiguration;
  ui: UIConfiguration;
  github: GitHubConfiguration;
  extension: ExtensionConfiguration;
}

export type ConfigurationChangeHandler = (
  config: ASTConfiguration,
  changes: string[],
) => void;

/**
 * Configuration Manager Class
 * Manages all aspects of extension configuration
 */
export class ConfigurationManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private changeHandlers: ConfigurationChangeHandler[] = [];
  private currentConfiguration: ASTConfiguration;
  private configurationWatcher: vscode.FileSystemWatcher | null = null;

  constructor(private readonly outputChannel: vscode.OutputChannel) {
    this.currentConfiguration = this.loadConfiguration();
    this.initializeConfigurationWatcher();
    this.outputChannel.appendLine("Configuration Manager initialized");
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): ASTConfiguration {
    return { ...this.currentConfiguration };
  }

  /**
   * Get server configuration
   */
  public getServerConfiguration(): ServerConfiguration {
    return { ...this.currentConfiguration.server };
  }

  /**
   * Get client configuration
   */
  public getClientConfiguration(): ClientConfiguration {
    return { ...this.currentConfiguration.client };
  }

  /**
   * Get UI configuration
   */
  public getUIConfiguration(): UIConfiguration {
    return { ...this.currentConfiguration.ui };
  }

  /**
   * Get GitHub configuration
   */
  public getGitHubConfiguration(): GitHubConfiguration {
    return { ...this.currentConfiguration.github };
  }

  /**
   * Get extension configuration
   */
  public getExtensionConfiguration(): ExtensionConfiguration {
    return { ...this.currentConfiguration.extension };
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(
    section: keyof ASTConfiguration,
    key: string,
    value: any,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("astCopilotHelper");
      await config.update(`${section}.${key}`, value, target);
      this.outputChannel.appendLine(
        `Updated configuration: ${section}.${key} = ${JSON.stringify(value)}`,
      );
    } catch (error) {
      const errorMsg = `Failed to update configuration: ${error}`;
      this.outputChannel.appendLine(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Reset configuration to defaults
   */
  public async resetConfiguration(
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration("astCopilotHelper");
      const inspection = config.inspect("");

      if (inspection) {
        // Reset all configuration keys
        const keys = [
          "serverPath",
          "server",
          "client",
          "ui",
          "github",
          "extension",
          "autoStart",
          "autoUpdate",
          "enableTelemetry",
        ];

        for (const key of keys) {
          await config.update(key, undefined, target);
        }
      }

      // Reload configuration
      this.currentConfiguration = this.loadConfiguration();
      this.notifyConfigurationChange([]);

      this.outputChannel.appendLine("Configuration reset to defaults");
    } catch (error) {
      const errorMsg = `Failed to reset configuration: ${error}`;
      this.outputChannel.appendLine(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Validate configuration
   */
  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.currentConfiguration;

    // Validate server configuration
    if (!config.server.serverPath || !fs.existsSync(config.server.serverPath)) {
      errors.push("Server path is not set or does not exist");
    }

    if (config.server.maxRestarts < 0) {
      errors.push("Max restarts must be non-negative");
    }

    if (config.server.restartDelay < 1000) {
      errors.push("Restart delay should be at least 1000ms");
    }

    if (config.server.healthCheckInterval < 5000) {
      errors.push("Health check interval should be at least 5000ms");
    }

    if (config.server.startupTimeout < 5000) {
      errors.push("Startup timeout should be at least 5000ms");
    }

    // Validate client configuration
    if (config.client.connectionTimeout < 5000) {
      errors.push("Connection timeout should be at least 5000ms");
    }

    if (config.client.requestTimeout < 1000) {
      errors.push("Request timeout should be at least 1000ms");
    }

    if (config.client.maxReconnectAttempts < 0) {
      errors.push("Max reconnect attempts must be non-negative");
    }

    if (config.client.reconnectDelay < 1000) {
      errors.push("Reconnect delay should be at least 1000ms");
    }

    // Validate UI configuration
    if (config.ui.notificationTimeout < 1000) {
      errors.push("Notification timeout should be at least 1000ms");
    }

    if (!["error", "warn", "info", "debug"].includes(config.ui.logLevel)) {
      errors.push("Log level must be one of: error, warn, info, debug");
    }

    // Validate GitHub configuration
    if (config.github.enableGitHubIntegration && !config.github.defaultBranch) {
      errors.push(
        "Default branch must be set when GitHub integration is enabled",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Register configuration change handler
   */
  public onConfigurationChange(
    handler: ConfigurationChangeHandler,
  ): vscode.Disposable {
    this.changeHandlers.push(handler);

    return new vscode.Disposable(() => {
      const index = this.changeHandlers.indexOf(handler);
      if (index !== -1) {
        this.changeHandlers.splice(index, 1);
      }
    });
  }

  /**
   * Get configuration schema for VS Code settings
   */
  public static getConfigurationSchema(): any {
    return {
      "astCopilotHelper.serverPath": {
        type: "string",
        default: "",
        description: "Path to the AST MCP server executable",
        scope: "workspace",
      },
      "astCopilotHelper.server.args": {
        type: "array",
        items: { type: "string" },
        default: [],
        description: "Command line arguments for the server",
        scope: "workspace",
      },
      "astCopilotHelper.server.autoRestart": {
        type: "boolean",
        default: true,
        description: "Automatically restart server on crash",
        scope: "workspace",
      },
      "astCopilotHelper.server.maxRestarts": {
        type: "number",
        default: 3,
        minimum: 0,
        description: "Maximum number of automatic restarts",
        scope: "workspace",
      },
      "astCopilotHelper.server.restartDelay": {
        type: "number",
        default: 2000,
        minimum: 1000,
        description: "Delay between restart attempts (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.server.healthCheckInterval": {
        type: "number",
        default: 30000,
        minimum: 5000,
        description: "Health check interval (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.server.startupTimeout": {
        type: "number",
        default: 10000,
        minimum: 5000,
        description: "Server startup timeout (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.client.connectionTimeout": {
        type: "number",
        default: 30000,
        minimum: 5000,
        description: "MCP client connection timeout (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.client.requestTimeout": {
        type: "number",
        default: 15000,
        minimum: 1000,
        description: "MCP request timeout (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.client.heartbeatInterval": {
        type: "number",
        default: 30000,
        minimum: 5000,
        description: "MCP client heartbeat interval (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.client.maxReconnectAttempts": {
        type: "number",
        default: 5,
        minimum: 0,
        description: "Maximum MCP reconnection attempts",
        scope: "workspace",
      },
      "astCopilotHelper.client.reconnectDelay": {
        type: "number",
        default: 2000,
        minimum: 1000,
        description: "MCP reconnection delay (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.client.autoConnect": {
        type: "boolean",
        default: true,
        description: "Automatically connect MCP client",
        scope: "workspace",
      },
      "astCopilotHelper.client.enableHeartbeat": {
        type: "boolean",
        default: true,
        description: "Enable MCP client heartbeat",
        scope: "workspace",
      },
      "astCopilotHelper.ui.showStatusBar": {
        type: "boolean",
        default: true,
        description: "Show status bar item",
        scope: "workspace",
      },
      "astCopilotHelper.ui.showNotifications": {
        type: "boolean",
        default: true,
        description: "Show notifications",
        scope: "workspace",
      },
      "astCopilotHelper.ui.autoHideStatusBar": {
        type: "boolean",
        default: false,
        description: "Auto-hide status bar when inactive",
        scope: "workspace",
      },
      "astCopilotHelper.ui.notificationTimeout": {
        type: "number",
        default: 5000,
        minimum: 1000,
        description: "Notification timeout (ms)",
        scope: "workspace",
      },
      "astCopilotHelper.ui.showProgressIndicators": {
        type: "boolean",
        default: true,
        description: "Show progress indicators",
        scope: "workspace",
      },
      "astCopilotHelper.ui.enableLogging": {
        type: "boolean",
        default: true,
        description: "Enable extension logging",
        scope: "workspace",
      },
      "astCopilotHelper.ui.logLevel": {
        type: "string",
        enum: ["error", "warn", "info", "debug"],
        default: "info",
        description: "Logging level",
        scope: "workspace",
      },
      "astCopilotHelper.github.enableGitHubIntegration": {
        type: "boolean",
        default: false,
        description: "Enable GitHub workflow integration",
        scope: "workspace",
      },
      "astCopilotHelper.github.defaultBranch": {
        type: "string",
        default: "main",
        description: "Default branch for GitHub operations",
        scope: "workspace",
      },
      "astCopilotHelper.github.pullRequestTemplate": {
        type: "string",
        default: "",
        description: "Pull request template",
        scope: "workspace",
      },
      "astCopilotHelper.github.reviewers": {
        type: "array",
        items: { type: "string" },
        default: [],
        description: "Default reviewers for pull requests",
        scope: "workspace",
      },
      "astCopilotHelper.github.labels": {
        type: "array",
        items: { type: "string" },
        default: [],
        description: "Default labels for issues and pull requests",
        scope: "workspace",
      },
      "astCopilotHelper.github.autoAssign": {
        type: "boolean",
        default: false,
        description: "Auto-assign pull requests to author",
        scope: "workspace",
      },
      "astCopilotHelper.autoStart": {
        type: "boolean",
        default: true,
        description: "Automatically start server on extension activation",
        scope: "workspace",
      },
      "astCopilotHelper.autoUpdate": {
        type: "boolean",
        default: true,
        description: "Automatically update configuration on changes",
        scope: "workspace",
      },
      "astCopilotHelper.enableTelemetry": {
        type: "boolean",
        default: false,
        description: "Enable telemetry reporting",
        scope: "workspace",
      },
    };
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfiguration(): ASTConfiguration {
    const config = vscode.workspace.getConfiguration("astCopilotHelper");
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

    return {
      server: {
        serverPath: config.get<string>("serverPath", ""),
        args: config.get<string[]>("server.args", []),
        autoRestart: config.get<boolean>("server.autoRestart", true),
        maxRestarts: config.get<number>("server.maxRestarts", 3),
        restartDelay: config.get<number>("server.restartDelay", 2000),
        healthCheckInterval: config.get<number>(
          "server.healthCheckInterval",
          30000,
        ),
        startupTimeout: config.get<number>("server.startupTimeout", 10000),
        environment: config.get<Record<string, string>>(
          "server.environment",
          {},
        ),
      },
      client: {
        connectionTimeout: config.get<number>(
          "client.connectionTimeout",
          30000,
        ),
        requestTimeout: config.get<number>("client.requestTimeout", 15000),
        heartbeatInterval: config.get<number>(
          "client.heartbeatInterval",
          30000,
        ),
        maxReconnectAttempts: config.get<number>(
          "client.maxReconnectAttempts",
          5,
        ),
        reconnectDelay: config.get<number>("client.reconnectDelay", 2000),
        autoConnect: config.get<boolean>("client.autoConnect", true),
        enableHeartbeat: config.get<boolean>("client.enableHeartbeat", true),
      },
      ui: {
        showStatusBar: config.get<boolean>("ui.showStatusBar", true),
        showNotifications: config.get<boolean>("ui.showNotifications", true),
        autoHideStatusBar: config.get<boolean>("ui.autoHideStatusBar", false),
        notificationTimeout: config.get<number>("ui.notificationTimeout", 5000),
        showProgressIndicators: config.get<boolean>(
          "ui.showProgressIndicators",
          true,
        ),
        enableLogging: config.get<boolean>("ui.enableLogging", true),
        logLevel: config.get<"error" | "warn" | "info" | "debug">(
          "ui.logLevel",
          "info",
        ),
      },
      github: {
        enableGitHubIntegration: config.get<boolean>(
          "github.enableGitHubIntegration",
          false,
        ),
        defaultBranch: config.get<string>("github.defaultBranch", "main"),
        pullRequestTemplate: config.get<string>(
          "github.pullRequestTemplate",
          "",
        ),
        reviewers: config.get<string[]>("github.reviewers", []),
        labels: config.get<string[]>("github.labels", []),
        autoAssign: config.get<boolean>("github.autoAssign", false),
      },
      extension: {
        autoStart: config.get<boolean>("autoStart", true),
        autoUpdate: config.get<boolean>("autoUpdate", true),
        enableTelemetry: config.get<boolean>("enableTelemetry", false),
        workspaceRoot,
        configPath: path.join(workspaceRoot, ".vscode", "settings.json"),
      },
    };
  }

  /**
   * Initialize configuration watcher
   */
  private initializeConfigurationWatcher(): void {
    // Watch VS Code configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("astCopilotHelper")) {
        this.handleConfigurationChange(event);
      }
    });

    this.disposables.push(configWatcher);

    // Watch configuration file changes
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const configPath = path.join(workspaceRoot, ".vscode", "settings.json");
      this.configurationWatcher =
        vscode.workspace.createFileSystemWatcher(configPath);

      this.configurationWatcher.onDidChange(() => {
        this.outputChannel.appendLine(
          "Configuration file changed, reloading...",
        );
        this.reloadConfiguration();
      });

      this.disposables.push(this.configurationWatcher);
    }
  }

  /**
   * Handle configuration change event
   */
  private handleConfigurationChange(
    event: vscode.ConfigurationChangeEvent,
  ): void {
    this.outputChannel.appendLine("Configuration changed, reloading...");

    const changedSections: string[] = [];
    const sections = ["server", "client", "ui", "github", "extension"];

    for (const section of sections) {
      if (event.affectsConfiguration(`astCopilotHelper.${section}`)) {
        changedSections.push(section);
      }
    }

    if (
      event.affectsConfiguration("astCopilotHelper.autoStart") ||
      event.affectsConfiguration("astCopilotHelper.autoUpdate") ||
      event.affectsConfiguration("astCopilotHelper.enableTelemetry")
    ) {
      changedSections.push("extension");
    }

    this.reloadConfiguration(changedSections);
  }

  /**
   * Reload configuration
   */
  private reloadConfiguration(changedSections?: string[]): void {
    this.currentConfiguration = this.loadConfiguration();

    // Validate new configuration
    const validation = this.validateConfiguration();
    if (!validation.isValid) {
      this.outputChannel.appendLine(
        `Configuration validation errors: ${validation.errors.join(", ")}`,
      );
    }

    this.notifyConfigurationChange(changedSections || []);
  }

  /**
   * Notify configuration change handlers
   */
  private notifyConfigurationChange(changedSections: string[]): void {
    for (const handler of this.changeHandlers) {
      try {
        handler(this.currentConfiguration, changedSections);
      } catch (error) {
        this.outputChannel.appendLine(
          `Error in configuration change handler: ${error}`,
        );
      }
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => {
      try {
        disposable.dispose();
      } catch (error) {
        // Log disposal error but don't throw
        console.error("Error disposing configuration manager resource:", error);
      }
    });
    this.disposables = [];
    this.changeHandlers = [];

    if (this.configurationWatcher) {
      try {
        this.configurationWatcher.dispose();
      } catch (error) {
        // Log disposal error but don't throw
        console.error("Error disposing configuration watcher:", error);
      }
      this.configurationWatcher = null;
    }
  }
}
