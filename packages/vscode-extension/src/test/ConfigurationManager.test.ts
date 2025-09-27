import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { ConfigurationManager } from "../managers/ConfigurationManager";

// Mock filesystem
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true), // Mock filesystem to return true for all paths
}));

// Mock VS Code API
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
    onDidChangeConfiguration: vi.fn(),
    workspaceFolders: [],
    createFileSystemWatcher: vi.fn(),
  },
  ConfigurationTarget: {
    Workspace: 1,
    Global: 2,
  },
  Disposable: vi.fn().mockImplementation((callback: () => void) => ({
    dispose: callback,
  })),
}));

describe("ConfigurationManager", () => {
  let configManager: ConfigurationManager;
  let mockOutputChannel: vscode.OutputChannel;
  let mockConfig: any;

  beforeEach(() => {
    // Setup mocks
    mockOutputChannel = {
      appendLine: vi.fn(),
      dispose: vi.fn(),
    } as any;

    mockConfig = {
      get: vi.fn(),
      update: vi.fn(),
      inspect: vi.fn(),
    };

    (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);
    (vscode.workspace.onDidChangeConfiguration as any).mockReturnValue({
      dispose: vi.fn(),
    });
    (vscode.workspace.createFileSystemWatcher as any).mockReturnValue({
      onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      dispose: vi.fn(),
    });

    // Setup default configuration values
    mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
      const configMap: Record<string, any> = {
        serverPath: "/test/server/path",
        "server.args": [],
        "server.autoRestart": true,
        "server.maxRestarts": 3,
        "server.restartDelay": 2000,
        "server.healthCheckInterval": 30000,
        "server.startupTimeout": 10000,
        "server.environment": {},
        "client.connectionTimeout": 30000,
        "client.requestTimeout": 15000,
        "client.heartbeatInterval": 30000,
        "client.maxReconnectAttempts": 5,
        "client.reconnectDelay": 2000,
        "client.autoConnect": true,
        "client.enableHeartbeat": true,
        "ui.showStatusBar": true,
        "ui.showNotifications": true,
        "ui.autoHideStatusBar": false,
        "ui.notificationTimeout": 5000,
        "ui.showProgressIndicators": true,
        "ui.enableLogging": true,
        "ui.logLevel": "info",
        "github.enableGitHubIntegration": false,
        "github.defaultBranch": "main",
        "github.pullRequestTemplate": "",
        "github.reviewers": [],
        "github.labels": [],
        "github.autoAssign": false,
        autoStart: true,
        autoUpdate: true,
        enableTelemetry: false,
      };
      return configMap[key] ?? defaultValue;
    });

    configManager = new ConfigurationManager(mockOutputChannel);
  });

  afterEach(() => {
    configManager.dispose();
    vi.clearAllMocks();
  });

  describe("Configuration Loading", () => {
    it("should load default configuration", () => {
      const config = configManager.getConfiguration();

      expect(config).toBeDefined();
      expect(config.server.serverPath).toBe("/test/server/path");
      expect(config.server.autoRestart).toBe(true);
      expect(config.client.connectionTimeout).toBe(30000);
      expect(config.ui.showStatusBar).toBe(true);
      expect(config.github.enableGitHubIntegration).toBe(false);
      expect(config.extension.autoStart).toBe(true);
    });

    it("should get server configuration", () => {
      const serverConfig = configManager.getServerConfiguration();

      expect(serverConfig.serverPath).toBe("/test/server/path");
      expect(serverConfig.autoRestart).toBe(true);
      expect(serverConfig.maxRestarts).toBe(3);
      expect(serverConfig.restartDelay).toBe(2000);
    });

    it("should get client configuration", () => {
      const clientConfig = configManager.getClientConfiguration();

      expect(clientConfig.connectionTimeout).toBe(30000);
      expect(clientConfig.requestTimeout).toBe(15000);
      expect(clientConfig.autoConnect).toBe(true);
      expect(clientConfig.enableHeartbeat).toBe(true);
    });

    it("should get UI configuration", () => {
      const uiConfig = configManager.getUIConfiguration();

      expect(uiConfig.showStatusBar).toBe(true);
      expect(uiConfig.showNotifications).toBe(true);
      expect(uiConfig.logLevel).toBe("info");
    });

    it("should get GitHub configuration", () => {
      const githubConfig = configManager.getGitHubConfiguration();

      expect(githubConfig.enableGitHubIntegration).toBe(false);
      expect(githubConfig.defaultBranch).toBe("main");
      expect(githubConfig.reviewers).toEqual([]);
    });

    it("should get extension configuration", () => {
      const extensionConfig = configManager.getExtensionConfiguration();

      expect(extensionConfig.autoStart).toBe(true);
      expect(extensionConfig.autoUpdate).toBe(true);
      expect(extensionConfig.enableTelemetry).toBe(false);
    });
  });

  describe("Configuration Validation", () => {
    it("should validate valid configuration", () => {
      const validation = configManager.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it("should detect invalid server path", async () => {
      const { existsSync } = await import("fs");
      vi.mocked(existsSync).mockReturnValue(false); // Mock path as non-existent

      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        const configMap: Record<string, any> = {
          serverPath: "", // Invalid empty path
          "server.args": [],
          "server.autoRestart": true,
          "server.maxRestarts": 3,
          "server.restartDelay": 2000,
          "server.healthCheckInterval": 30000,
          "server.startupTimeout": 10000,
          "server.environment": {},
          "client.connectionTimeout": 30000,
          "client.requestTimeout": 15000,
          "client.heartbeatInterval": 30000,
          "client.maxReconnectAttempts": 5,
          "client.reconnectDelay": 2000,
          "client.autoConnect": true,
          "client.enableHeartbeat": true,
          "ui.showStatusBar": true,
          "ui.showNotifications": true,
          "ui.autoHideStatusBar": false,
          "ui.notificationTimeout": 5000,
          "ui.showProgressIndicators": true,
          "ui.enableLogging": true,
          "ui.logLevel": "info",
          "github.enableGitHubIntegration": false,
          "github.defaultBranch": "main",
          "github.pullRequestTemplate": "",
          "github.reviewers": [],
          "github.labels": [],
          "github.autoAssign": false,
          autoStart: true,
          autoUpdate: true,
          enableTelemetry: false,
        };
        return configMap[key] ?? defaultValue;
      });

      configManager = new ConfigurationManager(mockOutputChannel);
      const validation = configManager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Server path is not set or does not exist",
      );
    });

    it("should detect invalid timeout values", () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        const configMap: Record<string, any> = {
          serverPath: "/test/server/path",
          "server.args": [],
          "server.autoRestart": true,
          "server.maxRestarts": 3,
          "server.restartDelay": 2000,
          "server.healthCheckInterval": 30000,
          "server.startupTimeout": 10000,
          "server.environment": {},
          "client.connectionTimeout": 1000, // Too low
          "client.requestTimeout": 500, // Too low
          "client.heartbeatInterval": 30000,
          "client.maxReconnectAttempts": 5,
          "client.reconnectDelay": 2000,
          "client.autoConnect": true,
          "client.enableHeartbeat": true,
          "ui.showStatusBar": true,
          "ui.showNotifications": true,
          "ui.autoHideStatusBar": false,
          "ui.notificationTimeout": 5000,
          "ui.showProgressIndicators": true,
          "ui.enableLogging": true,
          "ui.logLevel": "info",
          "github.enableGitHubIntegration": false,
          "github.defaultBranch": "main",
          "github.pullRequestTemplate": "",
          "github.reviewers": [],
          "github.labels": [],
          "github.autoAssign": false,
          autoStart: true,
          autoUpdate: true,
          enableTelemetry: false,
        };
        return configMap[key] ?? defaultValue;
      });

      configManager = new ConfigurationManager(mockOutputChannel);
      const validation = configManager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Connection timeout should be at least 5000ms",
      );
      expect(validation.errors).toContain(
        "Request timeout should be at least 1000ms",
      );
    });

    it("should detect invalid log level", () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        const configMap: Record<string, any> = {
          serverPath: "/test/server/path",
          "server.args": [],
          "server.autoRestart": true,
          "server.maxRestarts": 3,
          "server.restartDelay": 2000,
          "server.healthCheckInterval": 30000,
          "server.startupTimeout": 10000,
          "server.environment": {},
          "client.connectionTimeout": 30000,
          "client.requestTimeout": 15000,
          "client.heartbeatInterval": 30000,
          "client.maxReconnectAttempts": 5,
          "client.reconnectDelay": 2000,
          "client.autoConnect": true,
          "client.enableHeartbeat": true,
          "ui.showStatusBar": true,
          "ui.showNotifications": true,
          "ui.autoHideStatusBar": false,
          "ui.notificationTimeout": 5000,
          "ui.showProgressIndicators": true,
          "ui.enableLogging": true,
          "ui.logLevel": "invalid", // Invalid log level
          "github.enableGitHubIntegration": false,
          "github.defaultBranch": "main",
          "github.pullRequestTemplate": "",
          "github.reviewers": [],
          "github.labels": [],
          "github.autoAssign": false,
          autoStart: true,
          autoUpdate: true,
          enableTelemetry: false,
        };
        return configMap[key] ?? defaultValue;
      });

      configManager = new ConfigurationManager(mockOutputChannel);
      const validation = configManager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Log level must be one of: error, warn, info, debug",
      );
    });
  });

  describe("Configuration Updates", () => {
    it("should update configuration", async () => {
      await configManager.updateConfiguration("server", "autoRestart", false);

      expect(mockConfig.update).toHaveBeenCalledWith(
        "server.autoRestart",
        false,
        vscode.ConfigurationTarget.Workspace,
      );
    });

    it("should handle update errors", async () => {
      mockConfig.update.mockRejectedValue(new Error("Update failed"));

      await expect(
        configManager.updateConfiguration("server", "autoRestart", false),
      ).rejects.toThrow("Failed to update configuration: Error: Update failed");
    });

    it("should reset configuration", async () => {
      mockConfig.inspect.mockReturnValue({ workspaceValue: "test" });

      await configManager.resetConfiguration();

      expect(mockConfig.update).toHaveBeenCalledWith(
        "serverPath",
        undefined,
        vscode.ConfigurationTarget.Workspace,
      );
    });
  });

  describe("Configuration Schema", () => {
    it("should provide configuration schema", () => {
      const schema = ConfigurationManager.getConfigurationSchema();

      expect(schema).toBeDefined();
      expect(schema["astCopilotHelper.serverPath"]).toBeDefined();
      expect(schema["astCopilotHelper.serverPath"].type).toBe("string");
      expect(schema["astCopilotHelper.server.autoRestart"]).toBeDefined();
      expect(schema["astCopilotHelper.server.autoRestart"].type).toBe(
        "boolean",
      );
    });

    it("should have proper schema structure", () => {
      const schema = ConfigurationManager.getConfigurationSchema();

      // Check server settings
      expect(schema["astCopilotHelper.server.maxRestarts"].minimum).toBe(0);
      expect(schema["astCopilotHelper.server.restartDelay"].minimum).toBe(1000);

      // Check client settings
      expect(schema["astCopilotHelper.client.connectionTimeout"].minimum).toBe(
        5000,
      );

      // Check UI settings
      expect(schema["astCopilotHelper.ui.logLevel"].enum).toEqual([
        "error",
        "warn",
        "info",
        "debug",
      ]);

      // Check boolean settings
      expect(schema["astCopilotHelper.autoStart"].type).toBe("boolean");
    });
  });

  describe("Change Handlers", () => {
    it("should register change handler", () => {
      const handler = vi.fn();
      const disposable = configManager.onConfigurationChange(handler);

      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe("function");
    });

    it("should call change handlers", () => {
      const handler = vi.fn();
      configManager.onConfigurationChange(handler);

      // Trigger configuration change
      const mockEvent = { affectsConfiguration: vi.fn().mockReturnValue(true) };
      const onConfigChange = (vscode.workspace.onDidChangeConfiguration as any)
        .mock.calls[0][0];
      onConfigChange(mockEvent);

      expect(handler).toHaveBeenCalled();
    });

    it("should remove change handler on dispose", () => {
      const handler = vi.fn();
      const disposable = configManager.onConfigurationChange(handler);

      disposable.dispose();

      // Trigger configuration change
      const mockEvent = { affectsConfiguration: vi.fn().mockReturnValue(true) };
      const onConfigChange = (vscode.workspace.onDidChangeConfiguration as any)
        .mock.calls[0][0];
      onConfigChange(mockEvent);

      // Handler should not be called after disposal
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Resource Management", () => {
    it("should dispose properly", () => {
      const disposeSpy = vi.fn();
      (vscode.workspace.onDidChangeConfiguration as any).mockReturnValue({
        dispose: disposeSpy,
      });

      const manager = new ConfigurationManager(mockOutputChannel);
      manager.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it("should handle disposal errors gracefully", () => {
      const disposeSpy = vi.fn().mockImplementation(() => {
        throw new Error("Disposal error");
      });
      (vscode.workspace.onDidChangeConfiguration as any).mockReturnValue({
        dispose: disposeSpy,
      });

      const manager = new ConfigurationManager(mockOutputChannel);

      // Should not throw
      expect(() => manager.dispose()).not.toThrow();
    });
  });
});
