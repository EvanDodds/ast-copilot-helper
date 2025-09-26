# Multi-Language Integration Examples

This document provides comprehensive examples for integrating AST Copilot Helper's 15-language support into various applications and workflows.

## Basic Usage Examples

### Simple Parser Usage

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-helper";

async function basicParsing() {
  // Create parser instance
  const parser = await ParserFactory.createParser();

  // Parse TypeScript
  const tsCode = `
    interface User {
      id: number;
      name: string;
      email?: string;
    }
    
    function createUser(data: Partial<User>): User {
      return { id: Math.random(), ...data } as User;
    }
  `;

  const result = await parser.parseCode(tsCode, "typescript");
  console.log(`Found ${result.nodes.length} nodes in TypeScript code`);

  // Clean up
  await parser.dispose();
}
```

### Multi-Language File Processing

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-helper";
import { promises as fs } from "fs";
import path from "path";

async function processMultiLanguageProject(projectPath: string) {
  const parser = await ParserFactory.createParser();

  // Language detection mapping
  const languageMap = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".h": "cpp",
    ".cs": "c_sharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".dart": "dart",
    ".lua": "lua",
  };

  // Find all source files
  async function findSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        files.push(...(await findSourceFiles(fullPath)));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (languageMap[ext as keyof typeof languageMap]) {
          files.push(fullPath);
        }
      }
    }
    return files;
  }

  const sourceFiles = await findSourceFiles(projectPath);
  console.log(`Found ${sourceFiles.length} source files`);

  // Group files by language
  const filesByLanguage = new Map<string, string[]>();
  for (const file of sourceFiles) {
    const ext = path.extname(file);
    const language = languageMap[ext as keyof typeof languageMap];
    if (!filesByLanguage.has(language)) {
      filesByLanguage.set(language, []);
    }
    filesByLanguage.get(language)!.push(file);
  }

  // Process each language
  const results = new Map<string, any>();
  for (const [language, files] of filesByLanguage) {
    console.log(`Processing ${files.length} ${language} files...`);

    const languageResults = await parser.batchParseFiles(files, {
      concurrency: 4,
      continueOnError: true,
      onProgress: (completed, total, currentFile) => {
        console.log(
          `  ${language}: ${completed}/${total} - ${path.basename(currentFile)}`,
        );
      },
    });

    results.set(language, languageResults);
  }

  // Generate summary
  let totalNodes = 0;
  let totalErrors = 0;
  for (const [language, languageResults] of results) {
    const nodes = Array.from(languageResults.values()).reduce(
      (sum, result) => sum + result.nodes.length,
      0,
    );
    const errors = Array.from(languageResults.values()).reduce(
      (sum, result) => sum + result.errors.length,
      0,
    );
    totalNodes += nodes;
    totalErrors += errors;
    console.log(`${language}: ${nodes} nodes, ${errors} errors`);
  }

  console.log(
    `Total: ${totalNodes} nodes, ${totalErrors} errors across ${filesByLanguage.size} languages`,
  );

  await parser.dispose();
  return results;
}
```

## Advanced Usage Patterns

### Language-Specific Code Analysis

```typescript
import { ParserFactory, NodeClassifier } from "@ast-copilot-helper/ast-helper";

interface CodeMetrics {
  functions: number;
  classes: number;
  interfaces: number;
  complexity: number;
  language: string;
}

class MultiLanguageAnalyzer {
  private parser: any;
  private classifier: NodeClassifier;

  constructor() {
    this.classifier = new NodeClassifier();
  }

  async initialize() {
    this.parser = await ParserFactory.createParser();
  }

  async analyzeCode(code: string, language: string): Promise<CodeMetrics> {
    const result = await this.parser.parseCode(code, language);

    const metrics: CodeMetrics = {
      functions: 0,
      classes: 0,
      interfaces: 0,
      complexity: 0,
      language,
    };

    for (const node of result.nodes) {
      const classification = this.classifier.classifyNode({
        type: node.type,
        language,
        name: node.name,
      });

      switch (classification.nodeType) {
        case "FUNCTION":
        case "METHOD":
          metrics.functions++;
          break;
        case "CLASS":
          metrics.classes++;
          break;
        case "INTERFACE":
          metrics.interfaces++;
          break;
      }

      if (node.metadata.complexity) {
        metrics.complexity += node.metadata.complexity;
      }
    }

    return metrics;
  }

  async compareLanguages(codeSnippets: { [language: string]: string }) {
    const results: { [language: string]: CodeMetrics } = {};

    for (const [language, code] of Object.entries(codeSnippets)) {
      try {
        results[language] = await this.analyzeCode(code, language);
      } catch (error) {
        console.error(`Error analyzing ${language}:`, error);
      }
    }

    return results;
  }

  async dispose() {
    if (this.parser) {
      await this.parser.dispose();
    }
  }
}

// Usage example
async function compareImplementations() {
  const analyzer = new MultiLanguageAnalyzer();
  await analyzer.initialize();

  const implementations = {
    typescript: `
      interface Calculator {
        add(a: number, b: number): number;
        subtract(a: number, b: number): number;
      }
      
      class BasicCalculator implements Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
        
        subtract(a: number, b: number): number {
          return a - b;
        }
      }
    `,

    python: `
      from abc import ABC, abstractmethod
      
      class Calculator(ABC):
          @abstractmethod
          def add(self, a: float, b: float) -> float:
              pass
              
          @abstractmethod  
          def subtract(self, a: float, b: float) -> float:
              pass
      
      class BasicCalculator(Calculator):
          def add(self, a: float, b: float) -> float:
              return a + b
              
          def subtract(self, a: float, b: float) -> float:
              return a - b
    `,

    java: `
      interface Calculator {
          double add(double a, double b);
          double subtract(double a, double b);
      }
      
      public class BasicCalculator implements Calculator {
          public double add(double a, double b) {
              return a + b;
          }
          
          public double subtract(double a, double b) {
              return a - b;
          }
      }
    `,

    go: `
      type Calculator interface {
          Add(a, b float64) float64
          Subtract(a, b float64) float64
      }
      
      type BasicCalculator struct{}
      
      func (c BasicCalculator) Add(a, b float64) float64 {
          return a + b
      }
      
      func (c BasicCalculator) Subtract(a, b float64) float64 {
          return a - b
      }
    `,

    rust: `
      trait Calculator {
          fn add(&self, a: f64, b: f64) -> f64;
          fn subtract(&self, a: f64, b: f64) -> f64;
      }
      
      struct BasicCalculator;
      
      impl Calculator for BasicCalculator {
          fn add(&self, a: f64, b: f64) -> f64 {
              a + b
          }
          
          fn subtract(&self, a: f64, b: f64) -> f64 {
              a - b
          }
      }
    `,
  };

  const results = await analyzer.compareLanguages(implementations);

  console.log("Language Comparison Results:");
  console.table(results);

  await analyzer.dispose();
}
```

### Performance-Optimized Batch Processing

```typescript
import {
  ParserFactory,
  TreeSitterGrammarManager,
} from "@ast-copilot-helper/ast-helper";
import { Worker } from "worker_threads";
import { cpus } from "os";

class OptimizedMultiLanguageProcessor {
  private grammarManager: TreeSitterGrammarManager;
  private maxConcurrency: number;

  constructor() {
    this.grammarManager = new TreeSitterGrammarManager();
    this.maxConcurrency = Math.max(2, cpus().length - 1);
  }

  async initialize() {
    // Pre-install commonly used grammars
    const commonLanguages = ["typescript", "javascript", "python", "java"];
    await Promise.all(
      commonLanguages.map((lang) => this.grammarManager.installGrammar(lang)),
    );
  }

  async processLargeCodebase(files: string[]): Promise<Map<string, any>> {
    // Group files by language for optimal processing
    const filesByLanguage = this.groupFilesByLanguage(files);

    // Process each language group separately for better cache utilization
    const results = new Map();

    for (const [language, languageFiles] of filesByLanguage) {
      console.log(`Processing ${languageFiles.length} ${language} files...`);

      // Create dedicated parser for this language
      const parser = await ParserFactory.createParser(this.grammarManager);

      try {
        // Process in batches to manage memory
        const batchSize = 50;
        const batches = this.createBatches(languageFiles, batchSize);

        for (let i = 0; i < batches.length; i++) {
          console.log(
            `  Batch ${i + 1}/${batches.length} (${batches[i].length} files)`,
          );

          const batchResults = await parser.batchParseFiles(batches[i], {
            concurrency: Math.min(this.maxConcurrency, batches[i].length),
            continueOnError: true,
            onProgress: (completed, total, file) => {
              process.stdout.write(`\\r    Progress: ${completed}/${total}`);
            },
          });

          // Merge results
          for (const [file, result] of batchResults) {
            results.set(file, result);
          }

          console.log(); // New line after progress
        }
      } finally {
        await parser.dispose();
      }
    }

    return results;
  }

  private groupFilesByLanguage(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    const languageMap = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".pyi": "python",
      ".java": "java",
      ".cpp": "cpp",
      ".hpp": "cpp",
      ".cc": "cpp",
      ".h": "cpp",
      ".cs": "c_sharp",
      ".go": "go",
      ".rs": "rust",
      ".php": "php",
      ".rb": "ruby",
      ".swift": "swift",
      ".kt": "kotlin",
      ".kts": "kotlin",
      ".scala": "scala",
      ".dart": "dart",
      ".lua": "lua",
    };

    for (const file of files) {
      const ext = path.extname(file);
      const language = languageMap[ext as keyof typeof languageMap];
      if (language) {
        if (!groups.has(language)) {
          groups.set(language, []);
        }
        groups.get(language)!.push(file);
      }
    }

    return groups;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

// Usage for large codebases
async function processLargeProject() {
  const processor = new OptimizedMultiLanguageProcessor();
  await processor.initialize();

  // Find all source files in project
  const files = await findAllSourceFiles("./large-project");
  console.log(`Found ${files.length} source files`);

  const startTime = performance.now();
  const results = await processor.processLargeCodebase(files);
  const duration = performance.now() - startTime;

  console.log(`Processed ${results.size} files in ${duration.toFixed(2)}ms`);
  console.log(`Average: ${(duration / results.size).toFixed(2)}ms per file`);

  // Analyze results
  const summary = new Map<
    string,
    { files: number; nodes: number; errors: number }
  >();
  for (const [file, result] of results) {
    const ext = path.extname(file);
    const language = detectLanguage(file);

    if (!summary.has(language)) {
      summary.set(language, { files: 0, nodes: 0, errors: 0 });
    }

    const stats = summary.get(language)!;
    stats.files++;
    stats.nodes += result.nodes.length;
    stats.errors += result.errors.length;
  }

  console.log("\\nProcessing Summary:");
  console.table(Object.fromEntries(summary));
}
```

## Integration Examples

### Express.js API Server

```typescript
import express from "express";
import { ParserFactory } from "@ast-copilot-helper/ast-helper";
import multer from "multer";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Global parser instance
let parser: any;

async function initializeParser() {
  parser = await ParserFactory.createParser();
}

// Parse code snippet endpoint
app.post("/api/parse", express.json(), async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: "Code and language are required" });
    }

    const result = await parser.parseCode(code, language);

    res.json({
      success: true,
      language,
      nodeCount: result.nodes.length,
      errorCount: result.errors.length,
      parseTime: result.parseTime,
      nodes: result.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        name: node.name,
        line: node.start.line,
        column: node.start.column,
      })),
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({
      error: "Parse error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Upload and parse files endpoint
app.post("/api/parse-files", upload.array("files"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const results = [];
    for (const file of files) {
      const code = file.buffer.toString("utf-8");
      const language = detectLanguageFromFilename(file.originalname);

      if (language) {
        const result = await parser.parseCode(
          code,
          language,
          file.originalname,
        );
        results.push({
          filename: file.originalname,
          language,
          nodeCount: result.nodes.length,
          errorCount: result.errors.length,
          parseTime: result.parseTime,
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({
      error: "Processing error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get supported languages
app.get("/api/languages", (req, res) => {
  const languages = {
    tier1: ["typescript", "javascript", "python", "java", "cpp", "c_sharp"],
    tier2: ["go", "rust", "php", "ruby", "swift"],
    tier3: ["kotlin", "scala", "dart", "lua"],
  };
  res.json(languages);
});

function detectLanguageFromFilename(filename: string): string | null {
  const ext = path.extname(filename);
  const languageMap = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".h": "cpp",
    ".cs": "c_sharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".dart": "dart",
    ".lua": "lua",
  };
  return languageMap[ext as keyof typeof languageMap] || null;
}

// Initialize and start server
initializeParser()
  .then(() => {
    app.listen(3000, () => {
      console.log("Multi-language AST parser API running on port 3000");
    });
  })
  .catch(console.error);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  if (parser) {
    await parser.dispose();
  }
  process.exit(0);
});
```

### CLI Tool Integration

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { ParserFactory } from "@ast-copilot-helper/ast-helper";
import { promises as fs } from "fs";
import path from "path";
import glob from "glob";

const program = new Command();

program
  .name("multi-lang-ast")
  .description("Multi-language AST analysis tool")
  .version("1.0.0");

program
  .command("parse")
  .description("Parse files and analyze AST")
  .option(
    "-p, --pattern <pattern>",
    "File pattern to match",
    "**/*.{ts,js,py,java,cpp,cs,go,rs,php,rb,swift,kt,scala,dart,lua}",
  )
  .option("-o, --output <file>", "Output file for results")
  .option("-f, --format <format>", "Output format (json|csv|table)", "table")
  .option(
    "-l, --languages <languages>",
    "Comma-separated list of languages to include",
  )
  .option("--stats-only", "Show only statistics")
  .argument("<directory>", "Directory to analyze")
  .action(async (directory, options) => {
    try {
      const parser = await ParserFactory.createParser();

      // Find matching files
      const files = glob.sync(options.pattern, {
        cwd: directory,
        absolute: true,
        nodir: true,
      });

      console.log(`Found ${files.length} files to analyze`);

      // Filter by languages if specified
      let filteredFiles = files;
      if (options.languages) {
        const allowedLanguages = options.languages.split(",");
        filteredFiles = files.filter((file) => {
          const lang = detectLanguage(file);
          return allowedLanguages.includes(lang);
        });
        console.log(
          `Filtered to ${filteredFiles.length} files for languages: ${options.languages}`,
        );
      }

      // Process files
      const results = await parser.batchParseFiles(filteredFiles, {
        concurrency: 4,
        continueOnError: true,
        onProgress: (completed, total, file) => {
          process.stdout.write(
            `\\rProgress: ${completed}/${total} - ${path.basename(file)}`,
          );
        },
      });

      console.log(); // New line after progress

      // Generate output
      const output = generateOutput(results, options.format, options.statsOnly);

      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(`Results written to ${options.output}`);
      } else {
        console.log(output);
      }

      await parser.dispose();
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("languages")
  .description("List all supported languages")
  .option("-t, --tier <tier>", "Show only specific tier (1|2|3)")
  .action((options) => {
    const languages = {
      1: {
        name: "Enterprise",
        languages: [
          "typescript",
          "javascript",
          "python",
          "java",
          "cpp",
          "c_sharp",
        ],
      },
      2: {
        name: "Developer",
        languages: ["go", "rust", "php", "ruby", "swift"],
      },
      3: { name: "Specialized", languages: ["kotlin", "scala", "dart", "lua"] },
    };

    if (options.tier) {
      const tier = languages[options.tier as keyof typeof languages];
      if (tier) {
        console.log(`Tier ${options.tier}: ${tier.name}`);
        tier.languages.forEach((lang) => console.log(`  - ${lang}`));
      }
    } else {
      Object.entries(languages).forEach(([tier, info]) => {
        console.log(`Tier ${tier}: ${info.name}`);
        info.languages.forEach((lang) => console.log(`  - ${lang}`));
      });
    }
  });

function generateOutput(
  results: Map<string, any>,
  format: string,
  statsOnly: boolean,
): string {
  // Calculate statistics
  const stats = new Map<
    string,
    { files: number; nodes: number; errors: number; parseTime: number }
  >();

  for (const [file, result] of results) {
    const language = detectLanguage(file);
    if (!stats.has(language)) {
      stats.set(language, { files: 0, nodes: 0, errors: 0, parseTime: 0 });
    }

    const stat = stats.get(language)!;
    stat.files++;
    stat.nodes += result.nodes.length;
    stat.errors += result.errors.length;
    stat.parseTime += result.parseTime;
  }

  if (statsOnly) {
    if (format === "json") {
      return JSON.stringify(Object.fromEntries(stats), null, 2);
    } else if (format === "csv") {
      let csv = "Language,Files,Nodes,Errors,TotalParseTime,AvgParseTime\\n";
      for (const [lang, stat] of stats) {
        csv += `${lang},${stat.files},${stat.nodes},${stat.errors},${stat.parseTime},${(stat.parseTime / stat.files).toFixed(2)}\\n`;
      }
      return csv;
    } else {
      // Table format
      console.table(
        Object.fromEntries(
          Array.from(stats.entries()).map(([lang, stat]) => [
            lang,
            {
              Files: stat.files,
              Nodes: stat.nodes,
              Errors: stat.errors,
              "Avg Parse Time (ms)": (stat.parseTime / stat.files).toFixed(2),
            },
          ]),
        ),
      );
      return "";
    }
  }

  // Full results
  if (format === "json") {
    const output = {
      summary: Object.fromEntries(stats),
      files: Object.fromEntries(
        Array.from(results.entries()).map(([file, result]) => [
          path.relative(process.cwd(), file),
          {
            language: detectLanguage(file),
            nodeCount: result.nodes.length,
            errorCount: result.errors.length,
            parseTime: result.parseTime,
            nodes: result.nodes,
            errors: result.errors,
          },
        ]),
      ),
    };
    return JSON.stringify(output, null, 2);
  }

  // Default: summary + file list
  let output = "Summary:\\n";
  output += "--------\\n";
  console.table(Object.fromEntries(stats));

  output += "\\nFiles:\\n";
  output += "------\\n";
  for (const [file, result] of results) {
    output += `${path.relative(process.cwd(), file)}: ${result.nodes.length} nodes, ${result.errors.length} errors (${result.parseTime}ms)\\n`;
  }

  return output;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath);
  const languageMap = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".pyi": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".h": "cpp",
    ".cs": "c_sharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".dart": "dart",
    ".lua": "lua",
  };
  return languageMap[ext as keyof typeof languageMap] || "unknown";
}

program.parse();
```

### VS Code Extension Integration

```typescript
import * as vscode from "vscode";
import { ParserFactory } from "@ast-copilot-helper/ast-helper";

class MultiLanguageASTProvider {
  private parser: any;
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {}

  async initialize() {
    this.parser = await ParserFactory.createParser();

    // Register commands
    this.disposables.push(
      vscode.commands.registerCommand(
        "ast-helper.parseCurrentFile",
        this.parseCurrentFile.bind(this),
      ),
      vscode.commands.registerCommand(
        "ast-helper.parseWorkspace",
        this.parseWorkspace.bind(this),
      ),
      vscode.commands.registerCommand(
        "ast-helper.showLanguageStats",
        this.showLanguageStats.bind(this),
      ),
    );

    // Register document change listener
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(
        this.onDocumentChanged.bind(this),
      ),
    );
  }

  private async parseCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor");
      return;
    }

    const document = editor.document;
    const language = this.detectLanguage(document.fileName);

    if (!language) {
      vscode.window.showWarningMessage(
        `Unsupported file type: ${document.fileName}`,
      );
      return;
    }

    try {
      const code = document.getText();
      const result = await this.parser.parseCode(
        code,
        language,
        document.fileName,
      );

      const panel = vscode.window.createWebviewPanel(
        "astResults",
        `AST: ${path.basename(document.fileName)}`,
        vscode.ViewColumn.Two,
        { enableScripts: true },
      );

      panel.webview.html = this.generateASTWebview(result, language);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Parse error: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async parseWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace open");
      return;
    }

    const files = await vscode.workspace.findFiles(
      "**/*.{ts,tsx,js,jsx,py,java,cpp,hpp,cc,h,cs,go,rs,php,rb,swift,kt,kts,scala,dart,lua}",
      "**/node_modules/**",
    );

    const progress = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Parsing workspace files",
        cancellable: true,
      },
      async (progress, token) => {
        const filePaths = files.map((uri) => uri.fsPath);
        const results = new Map();

        let completed = 0;
        for (const filePath of filePaths) {
          if (token.isCancellationRequested) {
            break;
          }

          const language = this.detectLanguage(filePath);
          if (language) {
            try {
              const result = await this.parser.parseFile(filePath);
              results.set(filePath, result);
            } catch (error) {
              console.error(`Failed to parse ${filePath}:`, error);
            }
          }

          completed++;
          progress.report({
            increment: 100 / filePaths.length,
            message: `${completed}/${filePaths.length} files`,
          });
        }

        return results;
      },
    );

    if (progress) {
      this.showWorkspaceResults(progress);
    }
  }

  private async showLanguageStats() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace open");
      return;
    }

    const files = await vscode.workspace.findFiles(
      "**/*.{ts,tsx,js,jsx,py,java,cpp,hpp,cc,h,cs,go,rs,php,rb,swift,kt,kts,scala,dart,lua}",
      "**/node_modules/**",
    );

    const languageStats = new Map<string, number>();
    for (const file of files) {
      const language = this.detectLanguage(file.fsPath);
      if (language) {
        languageStats.set(language, (languageStats.get(language) || 0) + 1);
      }
    }

    const stats = Array.from(languageStats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => `${lang}: ${count} files`)
      .join("\\n");

    vscode.window.showInformationMessage(`Language Distribution:\\n${stats}`, {
      modal: true,
    });
  }

  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath);
    const languageMap = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".py": "python",
      ".java": "java",
      ".cpp": "cpp",
      ".hpp": "cpp",
      ".cc": "cpp",
      ".h": "cpp",
      ".cs": "c_sharp",
      ".go": "go",
      ".rs": "rust",
      ".php": "php",
      ".rb": "ruby",
      ".swift": "swift",
      ".kt": "kotlin",
      ".kts": "kotlin",
      ".scala": "scala",
      ".dart": "dart",
      ".lua": "lua",
    };
    return languageMap[ext as keyof typeof languageMap] || null;
  }

  private generateASTWebview(result: any, language: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>AST Results - ${language}</title>
        <style>
          body { font-family: var(--vscode-font-family); }
          .node { margin-left: 20px; border-left: 1px solid #ccc; padding-left: 10px; }
          .node-type { color: var(--vscode-symbolIcon-functionForeground); }
          .node-name { color: var(--vscode-symbolIcon-variableForeground); }
          .error { color: var(--vscode-errorForeground); }
        </style>
      </head>
      <body>
        <h2>AST Analysis Results (${language})</h2>
        <p><strong>Nodes:</strong> ${result.nodes.length}</p>
        <p><strong>Errors:</strong> ${result.errors.length}</p>
        <p><strong>Parse Time:</strong> ${result.parseTime}ms</p>
        
        <h3>AST Structure</h3>
        <div id="ast-tree">
          ${this.renderASTNodes(result.nodes)}
        </div>
        
        ${
          result.errors.length > 0
            ? `
          <h3>Errors</h3>
          <div class="errors">
            ${result.errors
              .map(
                (error: any) => `
              <div class="error">
                <strong>${error.type}:</strong> ${error.message}
                ${error.position ? ` at line ${error.position.line}, column ${error.position.column}` : ""}
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
      </body>
      </html>
    `;
  }

  private renderASTNodes(nodes: any[]): string {
    return nodes
      .map(
        (node) => `
      <div class="node">
        <span class="node-type">${node.type}</span>
        ${node.name ? `<span class="node-name">${node.name}</span>` : ""}
        <span class="position">(${node.start.line}:${node.start.column})</span>
        ${node.children ? this.renderASTNodes(node.children) : ""}
      </div>
    `,
      )
      .join("");
  }

  private async onDocumentChanged(event: vscode.TextDocumentChangeEvent) {
    // Optional: Real-time parsing for supported languages
    const language = this.detectLanguage(event.document.fileName);
    if (language) {
      // Debounced parsing could be implemented here
    }
  }

  private showWorkspaceResults(results: Map<string, any>) {
    const panel = vscode.window.createWebviewPanel(
      "workspaceAST",
      "Workspace AST Analysis",
      vscode.ViewColumn.Two,
      { enableScripts: true },
    );

    // Generate summary statistics
    const languageStats = new Map<
      string,
      { files: number; nodes: number; errors: number }
    >();
    for (const [file, result] of results) {
      const language = this.detectLanguage(file);
      if (!languageStats.has(language!)) {
        languageStats.set(language!, { files: 0, nodes: 0, errors: 0 });
      }
      const stats = languageStats.get(language!)!;
      stats.files++;
      stats.nodes += result.nodes.length;
      stats.errors += result.errors.length;
    }

    panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Workspace AST Analysis</title>
        <style>
          body { font-family: var(--vscode-font-family); }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; }
          th { background-color: var(--vscode-editor-background); }
        </style>
      </head>
      <body>
        <h2>Workspace Analysis Summary</h2>
        <p><strong>Total Files:</strong> ${results.size}</p>
        
        <h3>Language Statistics</h3>
        <table>
          <tr><th>Language</th><th>Files</th><th>Nodes</th><th>Errors</th></tr>
          ${Array.from(languageStats.entries())
            .map(
              ([lang, stats]) => `
            <tr>
              <td>${lang}</td>
              <td>${stats.files}</td>
              <td>${stats.nodes}</td>
              <td>${stats.errors}</td>
            </tr>
          `,
            )
            .join("")}
        </table>
      </body>
      </html>
    `;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    if (this.parser) {
      this.parser.dispose();
    }
  }
}

// Extension activation
export function activate(context: vscode.ExtensionContext) {
  const provider = new MultiLanguageASTProvider(context);
  provider.initialize().catch(console.error);

  context.subscriptions.push(provider);
}
```

These examples demonstrate comprehensive integration patterns for the 15-language AST parser across various environments and use cases, from simple scripts to complex applications and VS Code extensions.
