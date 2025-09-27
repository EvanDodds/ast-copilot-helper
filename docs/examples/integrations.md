# Integration Examples

Real-world examples of integrating ast-copilot-helper with popular tools and workflows.

## AI Agent Integrations

### Claude Integration via MCP

Setup MCP server and connect Claude:

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "ast-copilot-helper": {
      "command": "npx",
      "args": ["ast-copilot-helper", "server"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```

Example Claude conversation:

```
Human: Analyze the complexity of functions in my src directory

Claude: I'll analyze the function complexity in your src directory using the AST helper.

[Uses MCP to query functions and analyze complexity]

Found 23 functions with the following complexity distribution:
- Low complexity (1-5): 15 functions
- Medium complexity (6-10): 6 functions
- High complexity (11+): 2 functions

High complexity functions that may need refactoring:
1. `processUserData()` - Complexity: 14
2. `validateInput()` - Complexity: 12
```

### ChatGPT Integration

Setup custom GPT with ast-copilot-helper:

```yaml
# Custom GPT Configuration
name: Code Analyzer Assistant
description: Analyzes code using AST parsing
instructions: |
  You are a code analysis assistant that uses ast-copilot-helper to analyze codebases.
  When users ask about code analysis, use the MCP server connection to query their code.

  Always:
  - Provide specific examples from their codebase
  - Suggest concrete improvements
  - Explain the reasoning behind your analysis

actions:
  - name: analyze_code
    url: http://localhost:3000/mcp
    method: POST
```

### GitHub Copilot Chat Integration

Create a Copilot Chat extension:

```typescript
// copilot-chat-extension.ts
import { CopilotChat } from "@vscode/copilot-chat";
import { ASTHelper } from "ast-copilot-helper";

export class ASTCopilotChat {
  @CopilotChat.command("analyze")
  async analyzeCode(request: ChatRequest): Promise<ChatResponse> {
    const activeFile = vscode.window.activeTextEditor?.document;
    if (!activeFile) return { content: "No file selected" };

    const ast = await ASTHelper.parse(activeFile.getText());
    const analysis = await ASTHelper.analyze(ast);

    return {
      content: `Code Analysis Results:
      
**Complexity**: ${analysis.complexity}
**Issues Found**: ${analysis.issues.length}
**Suggestions**: ${analysis.suggestions.join(", ")}

Would you like me to explain any specific findings?`,
    };
  }
}
```

## Development Tool Integrations

### ESLint Plugin Integration

Create custom ESLint rules using AST data:

```typescript
// eslint-plugin-ast-copilot-helper.js
const { ASTHelper } = require("ast-copilot-helper");

module.exports = {
  rules: {
    "complexity-threshold": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Enforce complexity threshold using AST analysis",
        },
      },
      create(context) {
        return {
          FunctionDeclaration(node) {
            const complexity = ASTHelper.calculateComplexity(node);
            if (complexity > 10) {
              context.report({
                node,
                message: `Function complexity (${complexity}) exceeds threshold (10)`,
              });
            }
          },
        };
      },
    },
  },
};
```

### Webpack Plugin Integration

Analyze code during build process:

```javascript
// webpack-ast-analyzer-plugin.js
const { ASTHelper } = require("ast-copilot-helper");

class ASTAnalyzerPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("ASTAnalyzerPlugin", (compilation) => {
      compilation.hooks.optimize.tapAsync(
        "ASTAnalyzerPlugin",
        async (callback) => {
          const modules = Array.from(compilation.modules);

          for (const module of modules) {
            if (module.resource && module.resource.endsWith(".ts")) {
              const source = module._source.source();
              const analysis = await ASTHelper.analyze(source);

              if (analysis.complexity > 15) {
                compilation.warnings.push(
                  new Error(
                    `High complexity in ${module.resource}: ${analysis.complexity}`,
                  ),
                );
              }
            }
          }

          callback();
        },
      );
    });
  }
}

module.exports = ASTAnalyzerPlugin;
```

### Vite Plugin Integration

```typescript
// vite-ast-analyzer.ts
import { Plugin } from "vite";
import { ASTHelper } from "ast-copilot-helper";

export function astAnalyzer(): Plugin {
  return {
    name: "ast-analyzer",
    buildStart() {
      console.log("Starting AST analysis...");
    },
    transform(code, id) {
      if (id.endsWith(".ts") || id.endsWith(".js")) {
        ASTHelper.analyze(code).then((analysis) => {
          if (analysis.issues.length > 0) {
            console.warn(`Issues found in ${id}:`, analysis.issues);
          }
        });
      }
      return null;
    },
  };
}

// vite.config.ts
import { defineConfig } from "vite";
import { astAnalyzer } from "./plugins/vite-ast-analyzer";

export default defineConfig({
  plugins: [astAnalyzer()],
});
```

## CI/CD Pipeline Integrations

### GitHub Actions

```yaml
# .github/workflows/code-analysis.yml
name: Code Analysis with AST Helper

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Install AST Helper
        run: npm install -g ast-copilot-helper

      - name: Run AST Analysis
        run: |
          ast-copilot-helper analyze src/ \
            --format json \
            --output analysis-results.json \
            --fail-on-issues

      - name: Generate Report
        run: |
          ast-copilot-helper report analysis-results.json \
            --format html \
            --output analysis-report.html

      - name: Upload Analysis Results
        uses: actions/upload-artifact@v3
        with:
          name: analysis-results
          path: |
            analysis-results.json
            analysis-report.html

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const analysis = JSON.parse(fs.readFileSync('analysis-results.json', 'utf8'));

            const comment = `## 🔍 Code Analysis Results

            **Complexity Score**: ${analysis.overallComplexity}
            **Issues Found**: ${analysis.totalIssues}
            **Files Analyzed**: ${analysis.filesAnalyzed}

            ### Top Issues:
            ${analysis.topIssues.map(issue => `- ${issue.type}: ${issue.message}`).join('\n')}

            [View Full Report](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - analysis
  - report

ast-analysis:
  stage: analysis
  image: node:18
  script:
    - npm install -g ast-copilot-helper
    - ast-copilot-helper analyze src/ --format json --output analysis.json
  artifacts:
    reports:
      junit: analysis.json
    paths:
      - analysis.json
    expire_in: 1 week

quality-report:
  stage: report
  image: node:18
  dependencies:
    - ast-analysis
  script:
    - ast-copilot-helper report analysis.json --format gitlab --output quality-report.json
  artifacts:
    reports:
      codequality: quality-report.json
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                sh 'npm install -g ast-copilot-helper'
            }
        }

        stage('AST Analysis') {
            steps {
                sh '''
                    ast-copilot-helper analyze src/ \
                        --format json \
                        --output analysis-results.json \
                        --complexity-threshold 10 \
                        --security-check
                '''
            }
        }

        stage('Generate Reports') {
            steps {
                sh '''
                    ast-copilot-helper report analysis-results.json \
                        --format html \
                        --output analysis-report.html

                    ast-copilot-helper report analysis-results.json \
                        --format junit \
                        --output test-results.xml
                '''
            }
        }

        stage('Quality Gate') {
            steps {
                script {
                    def analysis = readJSON file: 'analysis-results.json'
                    if (analysis.overallComplexity > 15) {
                        error "Code complexity (${analysis.overallComplexity}) exceeds threshold (15)"
                    }
                    if (analysis.securityIssues > 0) {
                        error "Security issues found: ${analysis.securityIssues}"
                    }
                }
            }
        }
    }

    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.',
                reportFiles: 'analysis-report.html',
                reportName: 'AST Analysis Report'
            ])

            publishTestResults testResultsPattern: 'test-results.xml'
        }
    }
}
```

## IDE Integrations

### IntelliJ IDEA Plugin

```kotlin
// ASTHelperPlugin.kt
class ASTHelperPlugin : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        val project = event.project ?: return
        val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val document = editor.document

        val analysisTask = object : Task.Backgroundable(project, "Analyzing Code", false) {
            override fun run(indicator: ProgressIndicator) {
                val result = runASTAnalysis(document.text)

                ApplicationManager.getApplication().invokeLater {
                    showAnalysisResults(result, project)
                }
            }
        }

        ProgressManager.getInstance().run(analysisTask)
    }

    private fun runASTAnalysis(code: String): AnalysisResult {
        // Call ast-copilot-helper via CLI or API
        val process = ProcessBuilder("ast-copilot-helper", "analyze", "--stdin")
            .start()

        process.outputStream.use { output ->
            output.write(code.toByteArray())
        }

        val result = process.inputStream.bufferedReader().readText()
        return gson.fromJson(result, AnalysisResult::class.java)
    }
}
```

### Sublime Text Plugin

```python
# ast_helper.py
import sublime
import sublime_plugin
import subprocess
import json

class AstHelperAnalyzeCommand(sublime_plugin.TextCommand):
    def run(self, edit):
        # Get current file content
        region = sublime.Region(0, self.view.size())
        content = self.view.substr(region)

        # Run AST analysis
        try:
            result = subprocess.run(
                ['ast-copilot-helper', 'analyze', '--stdin', '--format', 'json'],
                input=content,
                text=True,
                capture_output=True,
                check=True
            )

            analysis = json.loads(result.stdout)
            self.show_results(analysis)

        except subprocess.CalledProcessError as e:
            sublime.error_message(f"AST analysis failed: {e}")

    def show_results(self, analysis):
        # Create results panel
        window = sublime.active_window()
        panel = window.create_output_panel('ast_analysis')

        # Format results
        output = f"""AST Analysis Results:

Complexity: {analysis.get('complexity', 'N/A')}
Issues: {len(analysis.get('issues', []))}

Issues Found:
"""

        for issue in analysis.get('issues', []):
            output += f"- Line {issue.get('line', '?')}: {issue.get('message', '')}\n"

        panel.run_command('append', {'characters': output})
        window.run_command('show_panel', {'panel': 'output.ast_analysis'})
```

## Database and Analytics Integrations

### InfluxDB Integration

Store analysis metrics over time:

```typescript
// influx-integration.ts
import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { ASTHelper } from "ast-copilot-helper";

export class ASTMetricsCollector {
  private influx: InfluxDB;

  constructor(url: string, token: string, org: string) {
    this.influx = new InfluxDB({ url, token });
  }

  async collectAndStoreMetrics(projectPath: string) {
    const analysis = await ASTHelper.analyze(projectPath);
    const writeApi = this.influx.getWriteApi("my-org", "code-metrics");

    const point = new Point("code_analysis")
      .tag("project", projectPath)
      .intField("complexity", analysis.overallComplexity)
      .intField("issues_count", analysis.totalIssues)
      .intField("files_count", analysis.filesAnalyzed)
      .intField("lines_of_code", analysis.linesOfCode)
      .timestamp(new Date());

    writeApi.writePoint(point);
    await writeApi.close();
  }
}

// Usage in CI
const collector = new ASTMetricsCollector(
  process.env.INFLUX_URL!,
  process.env.INFLUX_TOKEN!,
  "my-org",
);

await collector.collectAndStoreMetrics("./src");
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Code Quality Metrics",
    "panels": [
      {
        "title": "Code Complexity Over Time",
        "type": "graph",
        "targets": [
          {
            "query": "SELECT mean(complexity) FROM code_analysis WHERE $timeFilter GROUP BY time($interval)"
          }
        ]
      },
      {
        "title": "Issues by Type",
        "type": "piechart",
        "targets": [
          {
            "query": "SELECT last(issues_count) FROM code_analysis GROUP BY issue_type"
          }
        ]
      }
    ]
  }
}
```

## Testing Framework Integrations

### Jest Integration

```javascript
// jest-ast-copilot-helper.js
const { ASTHelper } = require("ast-copilot-helper");

class ASTHelperReporter {
  onRunComplete(contexts, results) {
    const testFiles = results.testResults.map((result) => result.testFilePath);

    Promise.all(
      testFiles.map(async (file) => {
        const analysis = await ASTHelper.analyze(file);
        if (analysis.complexity > 10) {
          console.warn(`High complexity in test file: ${file}`);
        }
      }),
    );
  }
}

module.exports = ASTHelperReporter;
```

### Vitest Integration

```typescript
// vitest-ast-plugin.ts
import { defineConfig } from "vitest/config";
import { ASTHelper } from "ast-copilot-helper";

export default defineConfig({
  test: {
    reporters: [
      "default",
      {
        onFinished: async (files) => {
          for (const file of files) {
            const analysis = await ASTHelper.analyze(file);
            if (analysis.issues.length > 0) {
              console.log(`Issues in ${file}:`, analysis.issues);
            }
          }
        },
      },
    ],
  },
});
```

These integration examples show how ast-copilot-helper can be seamlessly integrated into existing development workflows, providing continuous code analysis and quality monitoring across different tools and platforms.
