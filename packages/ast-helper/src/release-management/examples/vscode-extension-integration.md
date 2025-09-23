# VS Code Extension Integration

This guide demonstrates how to integrate the release management system into VS Code extensions, providing developers with a seamless release experience directly in their editor.

## Table of Contents

1. [Extension Setup](#extension-setup)
2. [Commands and UI](#commands-and-ui)
3. [Configuration Management](#configuration-management)
4. [Webview Interfaces](#webview-interfaces)
5. [Status Bar Integration](#status-bar-integration)
6. [Tree View Provider](#tree-view-provider)
7. [Complete Example](#complete-example)

## Extension Setup

### Package.json Configuration

```json
{
  "name": "release-manager-extension",
  "displayName": "Release Manager",
  "description": "Comprehensive release management directly in VS Code",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "workspaceContains:package.json",
    "workspaceContains:.releaserc.json"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "releaseManager.planRelease",
        "title": "Plan Release",
        "category": "Release Manager",
        "icon": "$(rocket)"
      },
      {
        "command": "releaseManager.executeRelease",
        "title": "Execute Release",
        "category": "Release Manager",
        "icon": "$(play)"
      },
      {
        "command": "releaseManager.generateChangelog",
        "title": "Generate Changelog",
        "category": "Release Manager",
        "icon": "$(file-text)"
      },
      {
        "command": "releaseManager.checkCompatibility",
        "title": "Check Compatibility",
        "category": "Release Manager",
        "icon": "$(shield)"
      },
      {
        "command": "releaseManager.rollbackRelease",
        "title": "Rollback Release",
        "category": "Release Manager",
        "icon": "$(history)"
      },
      {
        "command": "releaseManager.openConfiguration",
        "title": "Open Configuration",
        "category": "Release Manager",
        "icon": "$(settings-gear)"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "releaseManager.planRelease",
          "when": "releaseManager.isReleaseProject"
        },
        {
          "command": "releaseManager.executeRelease",
          "when": "releaseManager.hasReleasePlan"
        }
      ],
      "editor/context": [
        {
          "command": "releaseManager.generateChangelog",
          "when": "resourceFilename == CHANGELOG.md",
          "group": "releaseManager"
        }
      ],
      "view/title": [
        {
          "command": "releaseManager.planRelease",
          "when": "view == releaseManagerView",
          "group": "navigation"
        }
      ]
    },
    "views": {
      "explorer": [
        {
          "id": "releaseManagerView",
          "name": "Release Manager",
          "when": "releaseManager.isReleaseProject",
          "type": "tree"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "releaseManager",
          "title": "Release Manager",
          "icon": "$(rocket)"
        }
      ]
    },
    "configuration": {
      "title": "Release Manager",
      "properties": {
        "releaseManager.enableAutoDetection": {
          "type": "boolean",
          "default": true,
          "description": "Automatically detect release-capable projects"
        },
        "releaseManager.defaultReleaseType": {
          "type": "string",
          "enum": ["patch", "minor", "major", "prerelease"],
          "default": "patch",
          "description": "Default release type for quick releases"
        },
        "releaseManager.showStatusBarItem": {
          "type": "boolean",
          "default": true,
          "description": "Show release status in status bar"
        },
        "releaseManager.autoGenerateChangelog": {
          "type": "boolean",
          "default": true,
          "description": "Automatically generate changelog on release"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "typescript": "^4.9.4"
  },
  "dependencies": {
    "@ast-copilot-helper/release-management": "^1.0.0"
  }
}
```

### Extension Activation

```typescript
// src/extension.ts
import * as vscode from "vscode";
import { ReleaseManagerProvider } from "./providers/releaseManagerProvider";
import { ReleaseStatusBarManager } from "./statusBar/releaseStatusBar";
import { ReleaseCommands } from "./commands/releaseCommands";
import { ReleaseWebviewProvider } from "./webview/releaseWebviewProvider";
import { ComprehensiveReleaseManager } from "@ast-copilot-helper/release-management";

let releaseManager: ComprehensiveReleaseManager;
let releaseProvider: ReleaseManagerProvider;
let statusBarManager: ReleaseStatusBarManager;
let releaseCommands: ReleaseCommands;

export async function activate(context: vscode.ExtensionContext) {
  console.log("Release Manager extension is now active");

  // Initialize release manager
  releaseManager = new ComprehensiveReleaseManager();

  // Check if current workspace has release configuration
  const isReleaseProject = await checkReleaseProject();
  vscode.commands.executeCommand(
    "setContext",
    "releaseManager.isReleaseProject",
    isReleaseProject
  );

  if (isReleaseProject) {
    await initializeReleaseManager(context);
  }

  // Set up workspace change detection
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(
    async () => {
      const hasReleaseConfig = await checkReleaseProject();
      vscode.commands.executeCommand(
        "setContext",
        "releaseManager.isReleaseProject",
        hasReleaseConfig
      );

      if (hasReleaseConfig && !releaseProvider) {
        await initializeReleaseManager(context);
      }
    }
  );

  context.subscriptions.push(workspaceWatcher);
}

async function initializeReleaseManager(context: vscode.ExtensionContext) {
  try {
    // Load configuration and initialize
    const config = await loadReleaseConfiguration();
    await releaseManager.initialize(config);

    // Create providers
    releaseProvider = new ReleaseManagerProvider(releaseManager);
    statusBarManager = new ReleaseStatusBarManager(releaseManager);
    releaseCommands = new ReleaseCommands(releaseManager);

    // Register tree view
    vscode.window.registerTreeDataProvider(
      "releaseManagerView",
      releaseProvider
    );

    // Register webview provider
    const webviewProvider = new ReleaseWebviewProvider(
      context.extensionUri,
      releaseManager
    );
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "releaseManagerWebview",
        webviewProvider
      )
    );

    // Register commands
    registerCommands(context);

    // Initialize status bar
    statusBarManager.initialize();

    console.log("Release Manager initialized successfully");
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to initialize Release Manager: ${error.message}`
    );
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    vscode.commands.registerCommand("releaseManager.planRelease", () =>
      releaseCommands.planRelease()
    ),
    vscode.commands.registerCommand("releaseManager.executeRelease", (plan?) =>
      releaseCommands.executeRelease(plan)
    ),
    vscode.commands.registerCommand("releaseManager.generateChangelog", () =>
      releaseCommands.generateChangelog()
    ),
    vscode.commands.registerCommand("releaseManager.checkCompatibility", () =>
      releaseCommands.checkCompatibility()
    ),
    vscode.commands.registerCommand("releaseManager.rollbackRelease", () =>
      releaseCommands.rollbackRelease()
    ),
    vscode.commands.registerCommand("releaseManager.openConfiguration", () =>
      releaseCommands.openConfiguration()
    ),
    vscode.commands.registerCommand("releaseManager.refreshView", () =>
      releaseProvider.refresh()
    ),
  ];

  context.subscriptions.push(...commands);
}

async function checkReleaseProject(): Promise<boolean> {
  if (!vscode.workspace.workspaceFolders) {
    return false;
  }

  for (const folder of vscode.workspace.workspaceFolders) {
    const packageJson = vscode.Uri.joinPath(folder.uri, "package.json");
    const releaseConfig = vscode.Uri.joinPath(folder.uri, ".releaserc.json");

    try {
      await vscode.workspace.fs.stat(packageJson);
      return true;
    } catch {
      try {
        await vscode.workspace.fs.stat(releaseConfig);
        return true;
      } catch {
        // Continue to next folder
      }
    }
  }

  return false;
}

async function loadReleaseConfiguration() {
  const workspaceFolder = vscode.workspace.workspaceFolders![0];
  const configPath = vscode.Uri.joinPath(
    workspaceFolder.uri,
    ".releaserc.json"
  );

  try {
    const configData = await vscode.workspace.fs.readFile(configPath);
    return JSON.parse(configData.toString());
  } catch {
    // Use default configuration
    return getDefaultConfiguration();
  }
}

function getDefaultConfiguration() {
  const workspaceFolder = vscode.workspace.workspaceFolders![0];
  const folderName = workspaceFolder.name;

  return {
    repository: {
      owner: "unknown",
      name: folderName,
      defaultBranch: "main",
      releaseBranches: ["main"],
      protectedBranches: ["main"],
      monorepo: false,
    },
    versioning: {
      scheme: "semver",
      initialVersion: "1.0.0",
      channels: [],
      allowPrereleasePromotion: true,
      strictMode: false,
    },
  };
}

export function deactivate() {
  statusBarManager?.dispose();
}
```

## Commands and UI

### Release Commands Implementation

```typescript
// src/commands/releaseCommands.ts
import * as vscode from "vscode";
import {
  ComprehensiveReleaseManager,
  ReleaseType,
  ReleasePlan,
} from "@ast-copilot-helper/release-management";
import { ReleaseQuickPickProvider } from "./releaseQuickPick";

export class ReleaseCommands {
  private quickPickProvider: ReleaseQuickPickProvider;

  constructor(private releaseManager: ComprehensiveReleaseManager) {
    this.quickPickProvider = new ReleaseQuickPickProvider(releaseManager);
  }

  async planRelease(): Promise<void> {
    try {
      const releaseType = await this.quickPickProvider.selectReleaseType();
      if (!releaseType) return;

      const version = await this.quickPickProvider.selectOrEnterVersion(
        releaseType
      );
      if (!version) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Planning Release",
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            message: `Planning ${releaseType} release ${version}...`,
          });

          const plan = await this.releaseManager.planRelease(
            version,
            releaseType
          );

          progress.report({ message: "Validating release plan..." });
          const validation = await this.releaseManager.validateRelease(plan);

          if (validation.success) {
            this.showReleasePlan(plan);
          } else {
            this.showValidationErrors(validation.errors);
          }
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to plan release: ${error.message}`
      );
    }
  }

  async executeRelease(plan?: ReleasePlan): Promise<void> {
    if (!plan) {
      vscode.window.showErrorMessage("No release plan provided");
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `Execute release ${plan.version}?`,
      { modal: true },
      "Yes, Execute Release"
    );

    if (confirmation) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Executing Release",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: `Releasing ${plan.version}...` });

          const result = await this.releaseManager.executeRelease(plan);

          if (result.success) {
            vscode.window
              .showInformationMessage(
                `✅ Release ${result.version} completed successfully!`,
                "View Release Notes"
              )
              .then((selection) => {
                if (selection === "View Release Notes") {
                  this.openReleaseNotes(result.version);
                }
              });
          } else {
            vscode.window.showErrorMessage(
              `❌ Release failed: ${result.error}`
            );
          }
        }
      );
    }
  }

  async generateChangelog(): Promise<void> {
    try {
      const fromVersion = await this.quickPickProvider.selectFromVersion();
      if (!fromVersion) return;

      const toVersion = await this.quickPickProvider.selectToVersion();
      if (!toVersion) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Changelog",
          cancellable: false,
        },
        async (progress) => {
          const changelog = await this.releaseManager.generateChangelog(
            fromVersion,
            toVersion
          );
          await this.showChangelogInEditor(changelog);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate changelog: ${error.message}`
      );
    }
  }

  async checkCompatibility(): Promise<void> {
    try {
      const baseVersion = await this.quickPickProvider.selectBaseVersion();
      if (!baseVersion) return;

      const newVersion = await this.quickPickProvider.selectNewVersion();
      if (!newVersion) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Checking Compatibility",
          cancellable: false,
        },
        async (progress) => {
          const report = await this.releaseManager.checkBackwardCompatibility(
            newVersion,
            baseVersion
          );
          await this.showCompatibilityReport(report);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to check compatibility: ${error.message}`
      );
    }
  }

  async rollbackRelease(): Promise<void> {
    try {
      const version = await this.quickPickProvider.selectVersionToRollback();
      if (!version) return;

      const reason = await vscode.window.showInputBox({
        prompt: "Enter rollback reason",
        placeHolder: "e.g., Critical bug detected",
      });

      if (!reason) return;

      const confirmation = await vscode.window.showWarningMessage(
        `Rollback release ${version}?`,
        { modal: true },
        "Yes, Rollback"
      );

      if (confirmation) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Rolling Back Release",
            cancellable: false,
          },
          async (progress) => {
            const result = await this.releaseManager.rollbackRelease(
              version,
              reason
            );

            if (result.success) {
              vscode.window.showInformationMessage(
                `✅ Rolled back to version ${result.rolledBackVersion}`
              );
            } else {
              vscode.window.showErrorMessage(
                `❌ Rollback failed: ${result.error}`
              );
            }
          }
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to rollback release: ${error.message}`
      );
    }
  }

  async openConfiguration(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders![0];
    const configPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      ".releaserc.json"
    );

    try {
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
    } catch {
      // Create new configuration file
      const createConfig = await vscode.window.showInformationMessage(
        "No release configuration found. Create one?",
        "Create Configuration"
      );

      if (createConfig) {
        await this.createDefaultConfiguration(configPath);
      }
    }
  }

  private async showReleasePlan(plan: ReleasePlan): Promise<void> {
    const planSummary = `
Release Plan: ${plan.version}
Type: ${plan.type}
Changes: ${plan.changes?.length || 0} commits
Platforms: ${plan.platforms?.map((p) => p.name).join(", ") || "None"}

Would you like to execute this release?
    `;

    const action = await vscode.window.showInformationMessage(
      planSummary,
      "Execute Release",
      "View Details",
      "Cancel"
    );

    switch (action) {
      case "Execute Release":
        await this.executeRelease(plan);
        break;
      case "View Details":
        await this.showReleasePlanDetails(plan);
        break;
    }
  }

  private async showValidationErrors(errors: string[]): Promise<void> {
    const errorMessage = `Validation failed:\n${errors.join("\n")}`;
    vscode.window.showErrorMessage(errorMessage);
  }

  private async showChangelogInEditor(changelog: any): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
      content: changelog.content,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  private async showCompatibilityReport(report: any): Promise<void> {
    const reportContent = `
# Compatibility Report

## Summary
- Compatible: ${report.compatible ? "✅" : "❌"}
- Base Version: ${report.baseVersion}
- New Version: ${report.newVersion}

## Breaking Changes
${report.breakingChanges.map((c) => `- ${c.description}`).join("\n")}

## Migration Required
${report.migrationRequired ? "Yes" : "No"}
    `;

    const doc = await vscode.workspace.openTextDocument({
      content: reportContent,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  private async showReleasePlanDetails(plan: ReleasePlan): Promise<void> {
    const details = `
# Release Plan Details

## Version: ${plan.version}
## Type: ${plan.type}

## Changes
${plan.changes?.map((c) => `- ${c.description}`).join("\n") || "No changes"}

## Platforms
${
  plan.platforms
    ?.map((p) => `- ${p.name} (${p.enabled ? "enabled" : "disabled"})`)
    .join("\n") || "No platforms"
}
    `;

    const doc = await vscode.workspace.openTextDocument({
      content: details,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  private async createDefaultConfiguration(
    configPath: vscode.Uri
  ): Promise<void> {
    const defaultConfig = {
      repository: {
        owner: "your-username",
        name: "your-project",
        defaultBranch: "main",
        releaseBranches: ["main"],
        protectedBranches: ["main"],
        monorepo: false,
      },
      versioning: {
        scheme: "semver",
        initialVersion: "1.0.0",
        channels: [],
        allowPrereleasePromotion: true,
        strictMode: false,
      },
    };

    await vscode.workspace.fs.writeFile(
      configPath,
      Buffer.from(JSON.stringify(defaultConfig, null, 2))
    );

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  }

  private async openReleaseNotes(version: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders![0];
    const notesPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      `releases/v${version}.md`
    );

    try {
      const doc = await vscode.workspace.openTextDocument(notesPath);
      await vscode.window.showTextDocument(doc);
    } catch {
      vscode.window.showErrorMessage("Release notes file not found");
    }
  }
}
```

### Quick Pick Provider

```typescript
// src/commands/releaseQuickPick.ts
import * as vscode from "vscode";
import {
  ComprehensiveReleaseManager,
  ReleaseType,
} from "@ast-copilot-helper/release-management";

interface ReleaseTypeQuickPickItem extends vscode.QuickPickItem {
  releaseType: ReleaseType;
}

export class ReleaseQuickPickProvider {
  constructor(private releaseManager: ComprehensiveReleaseManager) {}

  async selectReleaseType(): Promise<ReleaseType | undefined> {
    const items: ReleaseTypeQuickPickItem[] = [
      {
        label: "$(tag) Patch",
        description: "0.0.1 - Bug fixes and small changes",
        detail: "Backward compatible bug fixes",
        releaseType: ReleaseType.PATCH,
      },
      {
        label: "$(symbol-method) Minor",
        description: "0.1.0 - New features",
        detail: "Backward compatible functionality",
        releaseType: ReleaseType.MINOR,
      },
      {
        label: "$(warning) Major",
        description: "1.0.0 - Breaking changes",
        detail: "Incompatible API changes",
        releaseType: ReleaseType.MAJOR,
      },
      {
        label: "$(beaker) Prerelease",
        description: "1.0.0-alpha.1 - Alpha/Beta",
        detail: "Testing and feedback versions",
        releaseType: ReleaseType.PRERELEASE,
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select release type",
      matchOnDescription: true,
    });

    return selected?.releaseType;
  }

  async selectOrEnterVersion(
    releaseType: ReleaseType
  ): Promise<string | undefined> {
    // Calculate suggested version
    const currentVersion = await this.releaseManager.getLatestVersion("stable");
    const versionManager = this.releaseManager["versionManager"];
    const suggestedVersion = await versionManager.calculateNextVersion(
      currentVersion,
      releaseType
    );

    const items = [
      {
        label: "$(check) Use Calculated Version",
        description: suggestedVersion,
        detail: "Automatically calculated based on current version and type",
      },
      {
        label: "$(edit) Enter Custom Version",
        description: "Specify your own version",
        detail: "Enter a custom semantic version",
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Current version: ${currentVersion}`,
      matchOnDescription: true,
    });

    if (!selected) return undefined;

    if (selected.label.includes("Calculated")) {
      return suggestedVersion;
    } else {
      return await vscode.window.showInputBox({
        prompt: "Enter version (e.g., 1.2.3)",
        value: suggestedVersion,
        validateInput: (value) => {
          if (!value.match(/^\d+\.\d+\.\d+/)) {
            return "Please enter a valid semantic version";
          }
          return undefined;
        },
      });
    }
  }

  async selectFromVersion(): Promise<string | undefined> {
    const releases = await this.releaseManager.listReleases();
    const items = releases.map((release) => ({
      label: release.version,
      description: release.date?.toDateString(),
      detail: release.type,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select starting version for changelog",
    });

    return selected?.label;
  }

  async selectToVersion(): Promise<string | undefined> {
    const items = [
      {
        label: "HEAD",
        description: "Current changes",
        detail: "All changes since last release",
      },
      {
        label: "Latest Release",
        description: await this.releaseManager.getLatestVersion("stable"),
        detail: "Most recent release",
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select ending point for changelog",
    });

    return selected?.label === "Latest Release"
      ? selected.description
      : selected?.label;
  }

  async selectBaseVersion(): Promise<string | undefined> {
    return this.selectFromVersion();
  }

  async selectNewVersion(): Promise<string | undefined> {
    return this.selectToVersion();
  }

  async selectVersionToRollback(): Promise<string | undefined> {
    const releases = await this.releaseManager.listReleases();
    const items = releases
      .filter((r) => r.status === "published")
      .map((release) => ({
        label: release.version,
        description: release.date?.toDateString(),
        detail: `${release.type} - ${release.status}`,
      }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select version to rollback",
    });

    return selected?.label;
  }
}
```

## Tree View Provider

```typescript
// src/providers/releaseManagerProvider.ts
import * as vscode from "vscode";
import { ComprehensiveReleaseManager } from "@ast-copilot-helper/release-management";

export class ReleaseManagerProvider
  implements vscode.TreeDataProvider<ReleaseTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ReleaseTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ReleaseTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ReleaseTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private releaseManager: ComprehensiveReleaseManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ReleaseTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ReleaseTreeItem): Promise<ReleaseTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    } else {
      return this.getChildItems(element);
    }
  }

  private async getRootItems(): Promise<ReleaseTreeItem[]> {
    const items: ReleaseTreeItem[] = [];

    try {
      // Current version
      const currentVersion = await this.releaseManager.getLatestVersion(
        "stable"
      );
      items.push(
        new ReleaseTreeItem(
          `Current Version: ${currentVersion}`,
          vscode.TreeItemCollapsibleState.None,
          "version",
          {
            command: "releaseManager.showVersionDetails",
            title: "Show Version Details",
            arguments: [currentVersion],
          }
        )
      );

      // Pending changes
      const changes = await this.releaseManager.generateChangelog(
        currentVersion,
        "HEAD"
      );
      items.push(
        new ReleaseTreeItem(
          `Pending Changes: ${changes.entries.length}`,
          vscode.TreeItemCollapsibleState.Collapsible,
          "changes",
          changes.entries.length > 0
            ? {
                command: "releaseManager.showPendingChanges",
                title: "Show Pending Changes",
              }
            : undefined
        )
      );

      // Recent releases
      items.push(
        new ReleaseTreeItem(
          "Recent Releases",
          vscode.TreeItemCollapsibleState.Collapsible,
          "releases"
        )
      );

      // Platforms
      items.push(
        new ReleaseTreeItem(
          "Platforms",
          vscode.TreeItemCollapsibleState.Collapsible,
          "platforms"
        )
      );
    } catch (error) {
      items.push(
        new ReleaseTreeItem(
          "Error loading release information",
          vscode.TreeItemCollapsibleState.None,
          "error"
        )
      );
    }

    return items;
  }

  private async getChildItems(
    element: ReleaseTreeItem
  ): Promise<ReleaseTreeItem[]> {
    const items: ReleaseTreeItem[] = [];

    switch (element.contextValue) {
      case "changes":
        const currentVersion = await this.releaseManager.getLatestVersion(
          "stable"
        );
        const changes = await this.releaseManager.generateChangelog(
          currentVersion,
          "HEAD"
        );

        // Group by type
        const features = changes.newFeatures || [];
        const fixes = changes.bugFixes || [];
        const breaking = changes.breakingChanges || [];

        if (features.length > 0) {
          items.push(
            new ReleaseTreeItem(
              `✨ Features: ${features.length}`,
              vscode.TreeItemCollapsibleState.None,
              "feature-group"
            )
          );
        }

        if (fixes.length > 0) {
          items.push(
            new ReleaseTreeItem(
              `🐛 Bug Fixes: ${fixes.length}`,
              vscode.TreeItemCollapsibleState.None,
              "fix-group"
            )
          );
        }

        if (breaking.length > 0) {
          items.push(
            new ReleaseTreeItem(
              `💥 Breaking: ${breaking.length}`,
              vscode.TreeItemCollapsibleState.None,
              "breaking-group"
            )
          );
        }
        break;

      case "releases":
        const releases = await this.releaseManager.listReleases();
        const recentReleases = releases.slice(0, 10);

        for (const release of recentReleases) {
          items.push(
            new ReleaseTreeItem(
              `${release.version} (${release.type})`,
              vscode.TreeItemCollapsibleState.None,
              "release",
              {
                command: "releaseManager.showReleaseDetails",
                title: "Show Release Details",
                arguments: [release],
              }
            )
          );
        }
        break;

      case "platforms":
        // This would need access to the config
        const platformNames = ["npm", "github-releases", "docker"];

        for (const platform of platformNames) {
          items.push(
            new ReleaseTreeItem(
              platform,
              vscode.TreeItemCollapsibleState.None,
              "platform",
              {
                command: "releaseManager.showPlatformStatus",
                title: "Show Platform Status",
                arguments: [platform],
              }
            )
          );
        }
        break;
    }

    return items;
  }
}

class ReleaseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
    this.contextValue = contextValue;

    // Set icons based on context
    switch (contextValue) {
      case "version":
        this.iconPath = new vscode.ThemeIcon("tag");
        break;
      case "changes":
        this.iconPath = new vscode.ThemeIcon("git-commit");
        break;
      case "releases":
        this.iconPath = new vscode.ThemeIcon("package");
        break;
      case "platforms":
        this.iconPath = new vscode.ThemeIcon("cloud");
        break;
      case "feature-group":
        this.iconPath = new vscode.ThemeIcon("star");
        break;
      case "fix-group":
        this.iconPath = new vscode.ThemeIcon("bug");
        break;
      case "breaking-group":
        this.iconPath = new vscode.ThemeIcon("warning");
        break;
      case "release":
        this.iconPath = new vscode.ThemeIcon("tag");
        break;
      case "platform":
        this.iconPath = new vscode.ThemeIcon("server");
        break;
      case "error":
        this.iconPath = new vscode.ThemeIcon("error");
        break;
    }
  }
}
```

## Status Bar Integration

```typescript
// src/statusBar/releaseStatusBar.ts
import * as vscode from "vscode";
import { ComprehensiveReleaseManager } from "@ast-copilot-helper/release-management";

export class ReleaseStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private updateTimer?: NodeJS.Timer;

  constructor(private releaseManager: ComprehensiveReleaseManager) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10
    );
  }

  initialize(): void {
    this.updateStatusBar();

    // Update every 30 seconds
    this.updateTimer = setInterval(() => {
      this.updateStatusBar();
    }, 30000);

    this.statusBarItem.show();
  }

  private async updateStatusBar(): Promise<void> {
    try {
      const currentVersion = await this.releaseManager.getLatestVersion(
        "stable"
      );
      const changes = await this.releaseManager.generateChangelog(
        currentVersion,
        "HEAD"
      );
      const pendingCount = changes.entries.length;

      this.statusBarItem.text = `$(rocket) v${currentVersion}`;
      this.statusBarItem.tooltip = `Current version: ${currentVersion}`;

      if (pendingCount > 0) {
        this.statusBarItem.text += ` (${pendingCount})`;
        this.statusBarItem.tooltip += `\n${pendingCount} pending changes`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
      } else {
        this.statusBarItem.backgroundColor = undefined;
      }

      this.statusBarItem.command = "releaseManager.planRelease";
    } catch (error) {
      this.statusBarItem.text = "$(error) Release Error";
      this.statusBarItem.tooltip = `Release Manager error: ${error.message}`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
    }
  }

  dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.statusBarItem.dispose();
  }
}
```

This comprehensive VS Code extension integration provides developers with a complete release management experience directly within their editor, including commands, UI components, tree views, and status bar integration.
