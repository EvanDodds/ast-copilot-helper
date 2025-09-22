# VS Code Extension Guide

Harness the power of ast-copilot-helper directly within Visual Studio Code with our comprehensive extension. This guide covers installation, features, and usage patterns for seamless code analysis and AI integration.

## Overview

The ast-copilot-helper VS Code extension provides:

🎯 **Visual Code Analysis** - Tree view of your codebase structure and annotations  
🔍 **Integrated Search** - Query your code directly from the command palette  
⚡ **Real-time Parsing** - Automatic analysis as you code  
🤖 **AI Integration** - Built-in MCP server for AI agents  
📊 **Rich Visualizations** - Code metrics and relationship diagrams

## Installation

### From VS Code Marketplace

1. **Via VS Code Interface:**

   - Open VS Code
   - Go to Extensions (Ctrl/Cmd+Shift+X)
   - Search for "ast-copilot-helper"
   - Click "Install"

2. **Via Command Line:**

   ```bash
   code --install-extension ast-copilot-helper
   ```

3. **Via Command Palette:**
   - Open Command Palette (Ctrl/Cmd+Shift+P)
   - Type "Extensions: Install Extensions"
   - Search for "ast-copilot-helper"
   - Click "Install"

### Verification

After installation, verify the extension is active:

1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Type "ast-helper" - you should see available commands
3. Check the Activity Bar for the AST Helper icon 🌳

## Getting Started

### Quick Setup

1. **Open a Project:**

   ```
   File → Open Folder → Select your project
   ```

2. **Initialize ast-copilot-helper:**

   - Command Palette → "AST Helper: Initialize Project"
   - Or use the welcome walkthrough

3. **Parse Your Code:**
   - Command Palette → "AST Helper: Parse Workspace"
   - Or click "Parse" in the AST Helper panel

## Interface Overview

### Activity Bar

The AST Helper icon 🌳 in the Activity Bar provides access to:

- **Explorer Panel** - Browse parsed code structure
- **Search Panel** - Query your codebase
- **AI Integration** - MCP server status and controls
- **Settings Panel** - Configuration and preferences

### Tree View Panel

**File Structure View:**

```
📁 src/
├── 🔧 auth/
│   ├── ⚡ login.ts (3 functions, 1 interface)
│   └── ⚡ validation.ts (2 functions)
├── 🎯 api/
│   ├── ⚡ users.ts (5 functions, 2 interfaces)
│   └── ⚡ posts.ts (4 functions, 1 class)
└── 🛠️ utils/
    └── ⚡ helpers.ts (8 functions)
```

**Annotation View:**

- 🟢 Functions - Click to navigate to definition
- 🔵 Classes - Expandable to show methods and properties
- 🟡 Interfaces - Type definitions and structure
- 🟣 Variables - Constants and exported variables

### Search Panel

**Query Interface:**

- Text input for natural language queries
- Filter buttons (Functions, Classes, Interfaces, Variables)
- Results list with relevance scores
- Quick navigation to code locations

### Status Bar

Monitor ast-copilot-helper status:

- 📊 **Parsing Status** - "Parsing... (42/156 files)"
- 🎯 **Index Status** - "Ready (234 annotations)"
- 🤖 **MCP Server** - "Running on port 3001"

## Core Features

### 1. Code Parsing and Analysis

#### Automatic Parsing

The extension automatically parses files when:

- Opening a workspace
- Saving TypeScript/JavaScript files
- Creating new files
- Git branch changes

#### Manual Parsing

**Parse Current File:**

```
Command Palette → "AST Helper: Parse Current File"
```

**Parse Entire Workspace:**

```
Command Palette → "AST Helper: Parse Workspace"
```

**Parse Specific Directory:**

- Right-click folder in Explorer
- Select "Parse with AST Helper"

#### Parsing Indicators

Visual feedback during parsing:

- Progress bar in status bar
- File icons change as they're processed
- Notification on completion

### 2. Semantic Search

#### Natural Language Queries

**From Command Palette:**

```
Command Palette → "AST Helper: Query Codebase"
```

**From Search Panel:**

1. Click AST Helper icon in Activity Bar
2. Switch to Search tab
3. Enter query in search box
4. View results with scores

#### Query Examples

**Finding Functionality:**

```
"authentication functions"
"database connection setup"
"error handling middleware"
"API endpoint for user data"
```

**Finding Patterns:**

```
"functions with more than 5 parameters"
"classes that implement interface"
"deprecated functions or methods"
"async functions that handle files"
```

#### Search Results

Results show:

- **Function/Class Name** - with type icon
- **File Location** - clickable path
- **Relevance Score** - similarity percentage
- **Description** - extracted comment or inferred purpose
- **Quick Actions** - Go to Definition, Copy Link

### 3. Code Navigation

#### Go to Definition

- Click any item in Tree View
- Click result in Search Panel
- Use "Go to Definition" from context menu

#### Peek Definition

- Hover over search results
- Alt+Click for peek view
- Shows code context without opening file

#### Breadcrumb Navigation

Track your analysis journey:

```
Search: "auth functions" → loginUser() → src/auth/login.ts:23
```

### 4. AI Integration

#### Built-in MCP Server

**Start Server:**

```
Command Palette → "AST Helper: Start MCP Server"
```

**Server Configurations:**

- **STDIO** - For Claude Desktop integration
- **HTTP** - For web-based AI agents
- **SSE** - For real-time streaming

#### AI Agent Setup

**Claude Desktop Integration:**

1. Start MCP server in STDIO mode
2. Add configuration to Claude Desktop
3. Claude can now understand your codebase

**Configuration Example:**

```json
{
  "mcpServers": {
    "ast-copilot-helper": {
      "command": "ast-helper",
      "args": ["server", "--transport", "stdio"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### 5. Code Metrics and Visualization

#### Metrics Dashboard

Access via Command Palette → "AST Helper: Show Metrics Dashboard"

**Code Statistics:**

- Total files analyzed
- Functions, classes, interfaces count
- Lines of code and complexity metrics
- Documentation coverage

**Visual Charts:**

- File size distribution
- Complexity heatmap
- Dependency graph
- Code growth over time

#### Complexity Analysis

**Function Complexity:**

- Cyclomatic complexity scoring
- Parameter count analysis
- Nesting depth indicators
- Maintainability index

**Code Hotspots:**

```
🔥 High Complexity:
├── calculateTax() - Complexity: 15
├── processPayment() - Complexity: 12
└── validateInput() - Complexity: 10
```

### 6. Real-time Analysis

#### Live Parsing

As you type, the extension:

- Analyzes current file syntax
- Updates annotations in real-time
- Refreshes search index
- Updates Tree View

#### Change Detection

Visual indicators for:

- 🟢 **New** - Recently added functions/classes
- 🟡 **Modified** - Changed since last parse
- 🔴 **Deleted** - Removed from codebase
- ⚪ **Unchanged** - No recent changes

### 7. Context Menus and Quick Actions

#### File Explorer Integration

Right-click context menus:

- **"Parse with AST Helper"** - Parse selected files/folders
- **"Query Similar Code"** - Find related functionality
- **"Show in AST Helper"** - Open in Tree View
- **"Generate Documentation"** - Create docs for selection

#### Editor Integration

Right-click in editor:

- **"Add to AST Index"** - Force re-index current function
- **"Find Related Code"** - Semantic search for similar functions
- **"Explain with AI"** - Send to connected AI agent
- **"Generate Tests"** - Create test templates

## Configuration

### Extension Settings

Access via File → Preferences → Settings → Extensions → AST Helper

#### Parsing Settings

```json
{
  "ast-helper.parser.autoParseOnSave": true,
  "ast-helper.parser.includePatterns": ["**/*.{ts,js,tsx,jsx}"],
  "ast-helper.parser.excludePatterns": ["node_modules/**", "dist/**"],
  "ast-helper.parser.maxFileSize": "1MB",
  "ast-helper.parser.enableProgressNotifications": true
}
```

#### Search Settings

```json
{
  "ast-helper.search.defaultSimilarityThreshold": 0.7,
  "ast-helper.search.maxResults": 20,
  "ast-helper.search.enableSemanticSearch": true,
  "ast-helper.search.highlightMatches": true
}
```

#### AI Integration Settings

```json
{
  "ast-helper.ai.autoStartMCPServer": false,
  "ast-helper.ai.mcpServerPort": 3001,
  "ast-helper.ai.enableCORS": true,
  "ast-helper.ai.authToken": "",
  "ast-helper.ai.maxContextSize": 8192
}
```

#### UI Settings

```json
{
  "ast-helper.ui.showTreeView": true,
  "ast-helper.ui.showStatusBar": true,
  "ast-helper.ui.enableHoverInfo": true,
  "ast-helper.ui.showComplexityMetrics": true,
  "ast-helper.ui.colorTheme": "auto"
}
```

### Workspace Configuration

Create `.vscode/settings.json` in your project:

```json
{
  "ast-helper.parser.includePatterns": [
    "src/**/*.ts",
    "lib/**/*.js",
    "**/*.tsx"
  ],
  "ast-helper.parser.excludePatterns": [
    "**/*.test.*",
    "**/*.spec.*",
    "dist/**",
    "build/**"
  ],
  "ast-helper.search.defaultSimilarityThreshold": 0.75,
  "ast-helper.ai.autoStartMCPServer": true
}
```

## Keyboard Shortcuts

Default shortcuts (customizable via Keyboard Shortcuts settings):

| Action             | Shortcut     | Description                 |
| ------------------ | ------------ | --------------------------- |
| Parse Current File | `Ctrl+Alt+P` | Parse currently open file   |
| Query Codebase     | `Ctrl+Alt+Q` | Open search dialog          |
| Toggle Tree View   | `Ctrl+Alt+T` | Show/hide AST Helper panel  |
| Go to Definition   | `F12`        | Navigate to selected item   |
| Peek Definition    | `Alt+F12`    | Preview code in popup       |
| Start MCP Server   | `Ctrl+Alt+M` | Start AI integration server |

### Custom Shortcuts

Add to `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+f",
    "command": "ast-helper.searchSimilarCode",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+shift+a",
    "command": "ast-helper.analyzeComplexity",
    "when": "editorTextFocus"
  }
]
```

## Workflow Examples

### 1. Daily Development Workflow

```
1. Open VS Code → AST Helper automatically parses workspace
2. Start coding → Real-time analysis updates as you type
3. Need to find existing function → Use semantic search
4. Found similar code → Navigate with one click
5. Enable AI integration → Start MCP server for AI assistance
```

### 2. Code Review Workflow

```
1. Checkout review branch → AST Helper detects changes
2. View modified files → Tree view shows updates
3. Search for related code → "functions handling similar data"
4. Analyze complexity → Check metrics dashboard
5. Generate documentation → Use AI integration
```

### 3. Refactoring Workflow

```
1. Identify code to refactor → Search for duplication patterns
2. Find all usages → "functions that call updateUser"
3. Analyze dependencies → View relationship graph
4. Plan changes → Export analysis for documentation
5. Implement changes → Real-time validation
```

### 4. Debugging Workflow

```
1. Encounter bug → Search for error handling patterns
2. Find related code → "exception handling in payment flow"
3. Trace data flow → Navigate through function calls
4. Check complexity → Identify problematic areas
5. Collaborate with AI → Send context to AI agent
```

## Troubleshooting

### Common Issues

#### Extension Not Loading

**Symptoms:** No AST Helper icon in Activity Bar

**Solutions:**

```
1. Check if extension is enabled:
   Extensions → Search "ast-copilot-helper" → Ensure enabled

2. Reload VS Code:
   Command Palette → "Developer: Reload Window"

3. Check VS Code version:
   Minimum required: VS Code 1.80+
```

#### Parsing Issues

**Symptoms:** Files not appearing in Tree View

**Solutions:**

```
1. Check file patterns:
   Settings → ast-helper.parser.includePatterns

2. Manually trigger parse:
   Command Palette → "AST Helper: Parse Workspace"

3. Check output log:
   Output Panel → Select "AST Helper" from dropdown
```

#### Search Not Working

**Symptoms:** No results from queries

**Solutions:**

```
1. Ensure files are parsed:
   Check Tree View for content

2. Lower similarity threshold:
   Settings → ast-helper.search.defaultSimilarityThreshold

3. Try exact text search:
   Disable semantic search temporarily
```

#### MCP Server Issues

**Symptoms:** AI agents can't connect

**Solutions:**

```
1. Check server status:
   Status Bar → Look for "MCP Server" indicator

2. Verify port availability:
   Command Palette → "AST Helper: Show MCP Status"

3. Check firewall settings:
   Ensure port 3001 (or configured port) is accessible
```

### Performance Optimization

#### Large Codebases

```json
{
  "ast-helper.parser.maxFileSize": "500KB",
  "ast-helper.parser.excludePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "**/*.min.js",
    "**/vendor/**"
  ],
  "ast-helper.search.maxResults": 10
}
```

#### Memory Usage

```json
{
  "ast-helper.parser.enableParallelProcessing": false,
  "ast-helper.search.enableSemanticSearch": false,
  "ast-helper.ui.showComplexityMetrics": false
}
```

## Advanced Features

### Custom Language Support

Extend support for additional languages:

```json
{
  "ast-helper.parser.customLanguages": [
    {
      "id": "rust",
      "extensions": [".rs"],
      "parser": "tree-sitter-rust",
      "patterns": {
        "function": "function_item",
        "struct": "struct_item"
      }
    }
  ]
}
```

### Plugin Development

Create custom analyzers:

```typescript
// extension.ts
import { ASTHelperAPI } from "ast-copilot-helper";

export function activate(context: vscode.ExtensionContext) {
  const astHelper = vscode.extensions.getExtension("ast-copilot-helper")
    ?.exports as ASTHelperAPI;

  // Register custom analyzer
  astHelper.registerAnalyzer("security", {
    analyze: (annotations) => {
      // Custom security analysis
      return findings;
    },
  });
}
```

### Webhooks and Automation

Set up automated workflows:

```json
{
  "ast-helper.automation.webhooks": [
    {
      "event": "parse-complete",
      "url": "https://your-server.com/webhook",
      "payload": {
        "project": "${workspaceName}",
        "timestamp": "${timestamp}",
        "stats": "${parseStats}"
      }
    }
  ]
}
```

## Integration with Other Extensions

### Popular Combinations

**With ESLint:**

- AST Helper finds functions
- ESLint provides style feedback
- Combined analysis for code quality

**With GitLens:**

- GitLens shows git history
- AST Helper shows code structure
- Track code evolution over time

**With Thunder Client:**

- Test API endpoints found by AST Helper
- Generate test cases from function annotations
- Document API behavior

**With Prettier:**

- AST Helper maintains code structure awareness
- Prettier handles formatting
- Seamless code quality pipeline

## Next Steps

Master the VS Code extension and explore:

- ⚙️ **[Configuration Guide](configuration)** - Advanced customization options
- 🤖 **[AI Integration Guide](ai-integration)** - Connect with AI agents and workflows
- 🛠️ **[Developer Guide](../development)** - Contributing and extending functionality
- 🚀 **[CLI Usage Guide](cli-usage)** - Command-line power user techniques

## Extension Quick Reference

### Essential Commands

```
AST Helper: Initialize Project    - Set up ast-helper in workspace
AST Helper: Parse Workspace      - Analyze all project files
AST Helper: Query Codebase       - Search with natural language
AST Helper: Start MCP Server     - Enable AI integration
AST Helper: Show Tree View       - Browse code structure
AST Helper: Show Metrics         - View analysis dashboard
```

### Key Shortcuts

```
Ctrl+Alt+P    - Parse current file
Ctrl+Alt+Q    - Query codebase
Ctrl+Alt+T    - Toggle tree view
Ctrl+Alt+M    - Start MCP server
F12           - Go to definition
Alt+F12       - Peek definition
```

### Settings Locations

```
File → Preferences → Settings → Extensions → AST Helper
.vscode/settings.json (workspace-specific)
Command Palette → "Preferences: Open Settings (JSON)"
```
