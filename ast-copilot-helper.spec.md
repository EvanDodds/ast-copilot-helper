# Project Specification: ast-copilot-helper

## 1. Overview  

ast-copilot-helper is a self-contained, filesystem-only toolkit that continuously extracts, annotates, embeds, indexes, and retrieves AST fragments from your codebase. It ships as a single NPM package with a CLI (`ast-helper`) and an optional VS Code extension that intercepts Copilot prompts, prepending precisely the AST-derived context you need. There are no external services or databases—just files under `.astdb/`.  

This design dramatically cuts Copilot’s token usage, improves suggestion relevance, and slots seamlessly into existing git workflows and CI pipelines.  

---  

## 2. Design Decisions  

- **File-only datastore**  
  All data—raw ASTs, annotations, vector index—lives under `.astdb/`. No Docker, no remote DB, no long-running MCP server.  

- **Modular CLI**  
  One entrypoint (`ast-helper`) with subcommands (`parse`, `annotate`, `embed`, `query`, `watch`). Each subcommand can be invoked in isolation, in CI steps, or chained via git hooks.  

- **Local embeddings + vector search**  
  Leverage an embedded JS/Node embedding model (e.g. `@xenova/transformers`) and `hnswlib-node` (with a pure-JS fallback) to build and query a nearest-neighbor index on disk (`.astdb/index.*`).  

- **TypeScript implementation**  
  Provides strong types for AST schemas, annotation metadata, and index records. Distributes as a transpiled NPM module.  

- **Copilot prompt augmentation**  
  A lightweight VS Code extension intercepts Copilot Chat or “Ask Copilot” events, runs `ast-helper query`, and merges in the top-K AST snippets before sending to GitHub’s endpoint.  

---  

## 3. High-Level Architecture  

```txt
Your Repo/
├─ src/…                     # Your code
├─ .astdb/
│  ├─ asts/                  # raw AST JSON per file
│  ├─ annots/                # annotated metadata JSON per node
│  ├─ index.bin              # HNSW binary index
│  ├─ index.meta.json        # mapping from index IDs → file + node
│  └─ config.json            # user overrides (patterns, thresholds)
├─ node_modules/
├─ package.json
└─ .husky/                   # Git hooks for parse/annotate/embed
```

1. **parse** reads only git-changed files, emits normalized AST JSON under `asts/`.  
2. **annotate** consumes those ASTs, computes signatures, summaries, cyclomatic complexity, dependency lists, and writes to `annots/`.  
3. **embed** loads annotations, runs each summary+signature through the embedding model, upserts vectors into `index.*`.  
4. **query** embeds a natural-language intent, fetches top-K nearest neighbors, and returns the node summaries plus code snippets.  
5. **watch** runs `parse→annotate→embed` on file changes in real time.  
6. **VS Code Extension** intercepts Copilot commands, injects `query` results into the prompt.  

---  

## 4. Module Specifications  

### 4.1 CLI Entrypoint (`ast-helper`)  

- **Language**: TypeScript, compiled to JS.  
- **Dispatch**: uses [commander.js](https://github.com/tj/commander.js).  
- **Subcommands**:  
  - `parse [--changed] [--glob <pattern>]`  
  - `annotate [--changed]`  
  - `embed [--changed] [--model <path>]`  
  - `query --intent "<text>" [--top <N>]`  
  - `watch [--glob <pattern>]`  

**Configuration** lives in `.astdb/config.json`, merging CLI flags with defaults.

### 4.2 AST Extractor (parse)  

- **Parser**: [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) for polyglot support.  
- **Input**: All files matching `config.parseGlob` or `--glob`, filtered by `git diff --name-only HEAD`.  
- **Output**: One JSON file per source file under `.astdb/asts/`.  
- **AST Schema**:  
  ```ts
  interface ASTNode {
    id: string;               // uuid4
    type: string;             // node type
    name?: string;            // identifier if present
    start: { line, column };
    end:   { line, column };
    parentId?: string;
    children: string[];       // child node IDs
  }
  ```
- **Normalization**: strip comments, include only function/class/module definitions plus control-flow nodes.

### 4.3 Annotator (annotate)  

- **Input**: `.astdb/asts/*.json`  
- **Metadata Computation**:  
  - **Signature**: `(params) => returnType` string from node.  
  - **Summary**: `Function X does Y` via template.  
  - **Cyclomatic Complexity**: count of `if`, `for`, `case`, `catch`.  
  - **Dependencies**: list of imported symbols used in node.  
- **Output**: `.astdb/annots/{nodeId}.json`  
  ```ts
  interface Annot {
    nodeId: string;
    file: string;
    signature: string;
    summary: string;
    complexity: number;
    deps: string[];
    sourceSnippet: string;    // up to N lines around node
  }
  ```

### 4.4 Embedder (embed)  

- **Model**: integrate `@xenova/transformers` with a bundled CodeBERT-small ONNX.  
- **Index**: `hnswlib-node` building an HNSW graph in memory, serialized to `index.bin`.  
- **Metadata**: map internal index IDs → `{ nodeId, file }` in `index.meta.json`.  
- **Process**:  
  1. Load all new/updated `annots/*.json`.  
  2. For each, concatenate `summary + signature`.  
  3. Compute embedding vector (`768` dims).  
  4. Upsert or insert into HNSW.  
  5. Serialize index and metadata on disk.

### 4.5 Retriever (query)  

- **CLI**:  
  ```
  ast-helper query \
    --intent "refactor payment module logging" \
    --top 5 \
    --format json
  ```
- **Steps**:  
  1. Embed intent text.  
  2. Load `index.bin` + `index.meta.json`.  
  3. Perform K-NN search, retrieve top-K index IDs.  
  4. Load corresponding `annots/{nodeId}.json`.  
  5. Print array of `{ summary, signature, complexity, deps, sourceSnippet }`.

### 4.6 Watcher (watch)  

- **Library**: [chokidar](https://github.com/paulmillr/chokidar).  
- **Behavior**: on file add/change/delete under `config.watchGlob`:  
  1. Debounce 200 ms.  
  2. Run `parse --changed`, `annotate --changed`, `embed --changed`.  
- **Use Case**: live prompt enrichment during edit sessions.

### 4.7 VS Code Extension  

- **Language**: TypeScript, VS Code Extension API.  
- **Activation**: on Copilot Chat activation (`onCommand: "copilot.chat.send"`).  
- **Logic**:  
  1. Intercept user prompt.  
  2. Spawn `ast-helper query --intent "<prompt>" --top 3 --format plain`.  
  3. Prepend returned snippets to prompt.  
  4. Call original Copilot command with enriched prompt.  
- **Packaging**: include under `.vscode/extensions/ast-copilot-helper` or publish to private registry.  
- **Settings**: allow user to configure `topK`, snippet length, and enable/disable augmentation.

---  

## 5. File Structure  

```txt
ast-copilot-helper/
├─ src/
│  ├─ cli/
│  │  └─ index.ts            # commander setup
│  ├─ modules/
│  │  ├─ parser.ts
│  │  ├─ annotator.ts
│  │  ├─ embedder.ts
│  │  ├─ retriever.ts
│  │  └─ watcher.ts
│  ├─ types.ts               # ASTNode, Annot, config interfaces
│  └─ util/
│     ├─ fs.ts
│     └─ git.ts
├─ extension/                # VS Code extension
│  ├─ src/activate.ts
│  └─ package.json
├─ bin/ast-helper.js         # CLI shim
├─ .astdb/                   # created at runtime
├─ package.json
├─ README.md
└─ tsconfig.json
```

---  

## 6. Configuration  

`.astdb/config.json` (auto-generated on first run, mergeable):  
```json
{
  "parseGlob": ["src/**/*.ts", "src/**/*.js"],
  "watchGlob": ["src/**/*.{ts,js}"],
  "reuseIndex": true,
  "embedModelPath": "./models/codebert-small.onnx",
  "topK": 5,
  "snippetLines": 10,
  "indexParams": {
    "efConstruction": 200,
    "M": 16
  }
}
```

---  

## 7. Implementation Roadmap  

1. Scaffold CLI project, implement `parse`.  
2. Build simple `annotate` with templated summaries.  
3. Integrate `@xenova/transformers` + HNSW for `embed`.  
4. Wire up `query`, test vector searches end-to-end.  
5. Add `watch` mode and Husky git hooks.  
6. Develop VS Code extension and test Copilot prompt augmentation.  
7. Publish to NPM and optionally private VS Code gallery.  

---  

## 8. Testing & Validation  

- **Unit tests** for each module using Jest.  
- **Integration tests** against a sample repo fixture: verify AST JSON, annotation schema, index build, query results.  
- **Performance benchmarks**: index 10k nodes, measure embed and query latency.  
- **End-to-end workflow**: commit → pre-commit hooks update `.astdb/` → VS Code Copilot suggestions include correct snippets.  

---  

## 9. Example Usage  

```bash
npm install -D ast-copilot-helper husky
npx husky install
npx husky add .husky/pre-commit "ast-helper parse --changed && ast-helper annotate --changed"
npx husky add .husky/pre-push   "ast-helper embed --changed"

# Developer flow
ast-helper watch                  # live DB updates
# In VS Code, invoke Copilot Chat, prompts auto-enriched

# CI flow
ast-helper parse --changed
ast-helper annotate --changed
ast-helper embed --changed
```

This specification provides a concrete blueprint for implementing a fully self-contained AST-to-Copilot augmentation module. By following the roadmap and module definitions, you can deliver a drop-in dev dependency that transforms your Copilot experience without spinning up any external infrastructure.  
