# VS Code Extension API

The ast-copilot-helper VS Code extension provides a rich IDE integration for code analysis and AI-assisted development.

## Extension Activation

The extension activates automatically when:

- A workspace contains a `.ast-helper.json` configuration file
- Any supported language file is opened (TypeScript, JavaScript, Python, etc.)
- The command palette command `AST Helper: Activate` is run

## Commands

All commands are accessible via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### Core Commands

#### `ast-helper.parse.workspace`

**Command**: `AST Helper: Parse Workspace`

Parse all files in the current workspace and extract AST annotations.

**Usage:**

- Open Command Palette
- Type "AST Helper: Parse Workspace"
- Select files/directories to parse (or use default patterns)

```typescript
// Extension API
vscode.commands.registerCommand("ast-helper.parse.workspace", async () => {
  const config = await getConfiguration();
  const result = await parseWorkspace(config);
  showParseResults(result);
});
```

#### `ast-helper.parse.file`

**Command**: `AST Helper: Parse Current File`

Parse the currently active file.

```typescript
vscode.commands.registerCommand("ast-helper.parse.file", async () => {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showErrorMessage("No active file to parse");
    return;
  }

  const result = await parseFile(activeEditor.document.fileName);
  showParseResults(result);
});
```

#### `ast-helper.query.interactive`

**Command**: `AST Helper: Interactive Query`

Open an interactive query interface for searching code.

```typescript
vscode.commands.registerCommand("ast-helper.query.interactive", async () => {
  const query = await vscode.window.showInputBox({
    prompt: "Enter natural language query",
    placeHolder: 'e.g., "functions that handle HTTP requests"',
  });

  if (query) {
    const results = await executeQuery(query);
    showQueryResults(results);
  }
});
```

#### `ast-helper.config.open`

**Command**: `AST Helper: Open Configuration`

Open the configuration file for editing.

#### `ast-helper.server.start`

**Command**: `AST Helper: Start MCP Server`

Start the local MCP server for AI agent integration.

#### `ast-helper.server.stop`

**Command**: `AST Helper: Stop MCP Server`

Stop the running MCP server.

## Views and Panels

### AST Explorer View

A tree view showing the parsed AST structure of the current file.

**Location**: Explorer sidebar under "AST Helper" section

**Features**:

- Hierarchical display of code elements
- Click to navigate to code location
- Filter by element type
- Search within AST structure

```typescript
class ASTExplorerProvider implements vscode.TreeDataProvider<ASTNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ASTNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getChildren(element?: ASTNode): ASTNode[] {
    if (!element) {
      return this.getRootNodes();
    }
    return element.children || [];
  }

  getTreeItem(element: ASTNode): vscode.TreeItem {
    return {
      label: element.name,
      description: element.type,
      collapsibleState:
        element.children?.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      command: {
        command: "ast-helper.goToDefinition",
        title: "Go to Definition",
        arguments: [element],
      },
      iconPath: this.getIconForType(element.type),
    };
  }
}
```

### Query Results Panel

A dedicated panel for displaying query results.

**Location**: Panel area (bottom of VS Code)

**Features**:

- Tabular display of search results
- Sortable columns (relevance, file, type)
- Click to navigate to result location
- Export results to various formats

### MCP Server Status Bar

Shows the current status of the MCP server.

**Location**: Status bar (bottom right)

**States**:

- `🟢 MCP: Running` - Server is active
- `🟡 MCP: Starting` - Server is starting up
- `🔴 MCP: Stopped` - Server is not running
- `⚠️ MCP: Error` - Server encountered an error

## Configuration

### Extension Settings

The extension contributes the following settings to VS Code:

```json
{
  "ast-helper.autoParseOnSave": {
    "type": "boolean",
    "default": true,
    "description": "Automatically parse files when they are saved"
  },
  "ast-helper.showDecorations": {
    "type": "boolean",
    "default": true,
    "description": "Show AST annotations as decorations in the editor"
  },
  "ast-helper.server.autoStart": {
    "type": "boolean",
    "default": false,
    "description": "Automatically start MCP server when extension activates"
  },
  "ast-helper.server.port": {
    "type": "number",
    "default": 3001,
    "description": "Port for MCP server"
  },
  "ast-helper.query.maxResults": {
    "type": "number",
    "default": 50,
    "description": "Maximum number of query results to display"
  },
  "ast-helper.diagnostics.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Enable diagnostic messages for code analysis"
  }
}
```

### Configuration Schema

The extension validates `.ast-helper.json` configuration files:

```typescript
const configurationSchema: vscode.JSONSchemaContribution = {
  fileMatch: [".ast-helper.json"],
  schema: {
    type: "object",
    properties: {
      parser: {
        type: "object",
        properties: {
          includePatterns: {
            type: "array",
            items: { type: "string" },
            description: "File patterns to include",
          },
          excludePatterns: {
            type: "array",
            items: { type: "string" },
            description: "File patterns to exclude",
          },
        },
      },
    },
  },
};
```

## Language Features

### Hover Provider

Shows AST information when hovering over code elements.

```typescript
class ASTHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const annotation = await getAnnotationAtPosition(document, position);

    if (annotation) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(
        `**${annotation.name}** (${annotation.type})\n\n`
      );

      if (annotation.description) {
        markdown.appendMarkdown(`${annotation.description}\n\n`);
      }

      if (annotation.parameters?.length > 0) {
        markdown.appendMarkdown("**Parameters:**\n");
        annotation.parameters.forEach((param) => {
          markdown.appendMarkdown(`- \`${param.name}: ${param.type}\`\n`);
        });
      }

      return new vscode.Hover(markdown);
    }
  }
}
```

### Completion Provider

Provides intelligent completions based on AST analysis.

```typescript
class ASTCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    const context = await getCompletionContext(document, position);
    const suggestions = await getSuggestions(context);

    return suggestions.map((suggestion) => {
      const item = new vscode.CompletionItem(
        suggestion.label,
        vscode.CompletionItemKind.Function
      );

      item.detail = suggestion.detail;
      item.documentation = suggestion.documentation;
      item.insertText = new vscode.SnippetString(suggestion.insertText);

      return item;
    });
  }
}
```

### Definition Provider

Navigate to definitions using AST annotations.

```typescript
class ASTDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Definition | undefined> {
    const symbol = getSymbolAtPosition(document, position);
    const definition = await findDefinition(symbol);

    if (definition) {
      return new vscode.Location(
        vscode.Uri.file(definition.file),
        new vscode.Position(definition.line - 1, definition.column)
      );
    }
  }
}
```

### Reference Provider

Find all references to a symbol using AST data.

```typescript
class ASTReferenceProvider implements vscode.ReferenceProvider {
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext
  ): Promise<vscode.Location[]> {
    const symbol = getSymbolAtPosition(document, position);
    const references = await findReferences(symbol);

    return references.map(
      (ref) =>
        new vscode.Location(
          vscode.Uri.file(ref.file),
          new vscode.Position(ref.line - 1, ref.column)
        )
    );
  }
}
```

## Decorations

### AST Decorations

Visual indicators for parsed AST elements.

```typescript
const functionDecoration = vscode.window.createTextEditorDecorationType({
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: new vscode.ThemeColor("editorInfo.foreground"),
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  overviewRulerColor: new vscode.ThemeColor("editorInfo.foreground"),
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

function updateDecorations(editor: vscode.TextEditor) {
  const annotations = getAnnotationsForFile(editor.document.fileName);
  const decorations: vscode.DecorationOptions[] = [];

  annotations.forEach((annotation) => {
    if (annotation.type === "function") {
      decorations.push({
        range: new vscode.Range(
          annotation.line - 1,
          annotation.column,
          annotation.line - 1,
          annotation.column + annotation.name.length
        ),
        hoverMessage: `Function: ${annotation.name}`,
      });
    }
  });

  editor.setDecorations(functionDecoration, decorations);
}
```

## Diagnostics

### Code Analysis Diagnostics

Provide diagnostic information based on AST analysis.

```typescript
class ASTDiagnosticsProvider {
  private diagnosticCollection =
    vscode.languages.createDiagnosticCollection("ast-helper");

  updateDiagnostics(document: vscode.TextDocument) {
    const diagnostics: vscode.Diagnostic[] = [];
    const analysis = analyzeDocument(document);

    analysis.issues.forEach((issue) => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(
          issue.line - 1,
          issue.column,
          issue.line - 1,
          issue.column + issue.length
        ),
        issue.message,
        this.getSeverity(issue.severity)
      );

      diagnostic.code = issue.code;
      diagnostic.source = "ast-helper";

      diagnostics.push(diagnostic);
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private getSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case "error":
        return vscode.DiagnosticSeverity.Error;
      case "warning":
        return vscode.DiagnosticSeverity.Warning;
      case "info":
        return vscode.DiagnosticSeverity.Information;
      case "hint":
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }
}
```

## Code Actions

### Quick Fixes and Refactoring

Provide code actions based on AST analysis.

```typescript
class ASTCodeActionProvider implements vscode.CodeActionProvider {
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];
    const annotation = await getAnnotationAtRange(document, range);

    if (annotation) {
      // Add documentation action
      const addDocAction = new vscode.CodeAction(
        "Add JSDoc documentation",
        vscode.CodeActionKind.QuickFix
      );

      addDocAction.edit = new vscode.WorkspaceEdit();
      addDocAction.edit.insert(
        document.uri,
        new vscode.Position(annotation.line - 1, 0),
        generateJSDoc(annotation)
      );

      actions.push(addDocAction);

      // Add refactor actions
      if (annotation.type === "function") {
        const extractAction = new vscode.CodeAction(
          "Extract to separate file",
          vscode.CodeActionKind.Refactor
        );

        extractAction.command = {
          command: "ast-helper.refactor.extractToFile",
          title: "Extract to file",
          arguments: [annotation],
        };

        actions.push(extractAction);
      }
    }

    return actions;
  }
}
```

## Webview Panels

### Query Interface Panel

Interactive query interface in a webview.

```typescript
class QueryPanel {
  public static createOrShow(extensionUri: vscode.Uri) {
    const panel = vscode.window.createWebviewPanel(
      "astHelperQuery",
      "AST Helper Query",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.getHtmlForWebview(panel.webview, extensionUri);

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "query":
          const results = await executeQuery(message.query);
          panel.webview.postMessage({
            command: "queryResults",
            results: results,
          });
          break;
      }
    });
  }

  private static getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "media", "query.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "media", "query.css")
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>AST Helper Query</title>
    </head>
    <body>
        <div class="query-container">
            <input type="text" id="queryInput" placeholder="Enter natural language query...">
            <button id="queryButton">Search</button>
        </div>
        <div id="results"></div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}
```

## Extension API

### Public API

The extension exposes a public API for other extensions to use.

```typescript
interface ASTHelperAPI {
  /** Parse a file and return annotations */
  parseFile(filePath: string): Promise<ASTAnnotation[]>;

  /** Execute a semantic query */
  query(query: string, options?: QueryOptions): Promise<QueryResult>;

  /** Get configuration */
  getConfiguration(): Configuration;

  /** Start MCP server */
  startServer(): Promise<void>;

  /** Stop MCP server */
  stopServer(): Promise<void>;

  /** Register custom parser */
  registerParser(language: string, parser: CustomParser): void;
}

// Export API
export function activate(context: vscode.ExtensionContext): ASTHelperAPI {
  // Extension activation logic

  return {
    parseFile: async (filePath: string) => {
      return await parseFile(filePath);
    },
    query: async (query: string, options?: QueryOptions) => {
      return await executeQuery(query, options);
    },
    getConfiguration: () => {
      return getCurrentConfiguration();
    },
    startServer: async () => {
      await startMCPServer();
    },
    stopServer: async () => {
      await stopMCPServer();
    },
    registerParser: (language: string, parser: CustomParser) => {
      registerCustomParser(language, parser);
    },
  };
}
```

## Testing

### Extension Tests

The extension includes comprehensive test suites.

```typescript
import * as assert from "assert";
import * as vscode from "vscode";
import { getExtensionAPI } from "../extension";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Parse file command", async () => {
    const api = getExtensionAPI();
    const testFile = vscode.Uri.file("/test/sample.ts");

    // Create test document
    const document = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(document);

    // Execute parse command
    await vscode.commands.executeCommand("ast-helper.parse.file");

    // Verify results
    const annotations = await api.parseFile(testFile.fsPath);
    assert(annotations.length > 0, "Should parse annotations from file");
  });

  test("Query command", async () => {
    const api = getExtensionAPI();
    const result = await api.query("test functions");

    assert(result.totalResults >= 0, "Should return query results");
    assert(Array.isArray(result.results), "Results should be an array");
  });
});
```

## Troubleshooting

### Common Issues

1. **Extension not activating**

   - Check if workspace contains supported file types
   - Verify `.ast-helper.json` configuration is valid
   - Check Output panel for error messages

2. **MCP server won't start**

   - Ensure port is not already in use
   - Check firewall settings
   - Verify CLI is properly installed

3. **Parse errors**
   - Check file permissions
   - Verify file syntax is valid
   - Check include/exclude patterns in configuration

### Debug Mode

Enable debug logging by setting:

```json
{
  "ast-helper.logging.level": "debug"
}
```

View logs in VS Code Output panel under "AST Helper" channel.
