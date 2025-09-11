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
  "parseGlob": ["src/**/*.ts", "src/**/*.js", "src/**/*.py"],
  "watchGlob": ["src/**/*.{ts,js,py}"],
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

---

## 10. Proposed decisions, trade-offs, and defaults

This section records pragmatic choices and trade-offs for the initial implementation. Each item includes options, pros/cons, and the chosen default where applicable.

### 10.1 MVP scope

Options
- Minimal MVP: `parse` + `annotate` only.
- Full local flow MVP: `parse` + `annotate` + `embed` + `query` (no watch/extension).

Pros/Cons
- Minimal MVP: faster to deliver, easier tests, but can't validate search/augmentation UX.
- Full local flow MVP: higher initial engineering cost but enables end-to-end validation and CI flows.

Chosen default
- Implement the full local flow MVP (`parse`, `annotate`, `embed`, `query`) so we can validate retrieval and Copilot augmentation early.

### 10.2 Language support & Tree‑sitter grammars

Options
- Start with TS/JS only.
- Start with TS/JS + Python.
- Polyglot from day one (many grammars bundled or downloaded).

Pros/Cons
- TS/JS only: simplest, matches primary TypeScript implementation and developer needs.
- Adding Python expands reach but increases parser integration tests.
- Polyglot increases maintenance and binary size; some grammars carry license constraints.

Chosen default
- Initial release: TS/JS (covering .ts/.tsx/.js/.jsx). Add Python in the next milestone.
- Tree‑sitter grammars will be downloaded on demand and cached in `.astdb/grammars/` with explicit version pins. We will avoid bundling many grammars in-repo to reduce package size.

### 10.3 Parser runtime & installation

Options
- Use `tree-sitter` native bindings (fast but native build complexity).
- Use `node-tree-sitter` with prebuilt bindings or fallback to WASM JS parser (slower).

Pros/Cons
- Native bindings: best performance but complicates Windows/macOS/Linux CI and releases.
- WASM/JS: simpler distribution, no native compilation, slightly slower but acceptable for many repos.

Chosen default
- Prefer `node-tree-sitter` native when available, but provide a WASM fallback using `tree-sitter-wasm` so installs succeed without native toolchains.

### 10.4 Git changed-file semantics (`--changed`)

Options
- Default: `git diff --name-only HEAD` (changes since last commit).
- Alternative: staged files, or compare to remote branch (e.g., origin/main).

Pros/Cons
- HEAD: sensible for pre-commit/CI; predictable.
- Staged: good for pre-commit workflows.
- Remote diff: useful for large PR checks but heavier to compute.

Chosen default
- Default behavior: `--changed` maps to `git diff --name-only --diff-filter=ACMRT HEAD`.
- Add flags `--staged` and `--base <ref>` to override and support staged or branch comparisons.

### 10.5 Node identity (nodeId)

Options
- UUIDv4 per parse run (non‑stable across parses).
- Deterministic id: hash(file path + start.line + start.column + end.line + end.column + node type).

Pros/Cons
- UUIDv4: simple but prevents stable upsert across re-parses and causes index growth.
- Deterministic hash: stable across small edits, enables upsert and efficient index maintenance.

Chosen default
- Use deterministic node IDs based on a stable canonical key (file path + node span + node type + optional name) hashed (e.g., SHA‑1). This preserves identity across runs unless the node's location changes.

### 10.6 Signature extraction & types

Options
- Best-effort, language-specific extraction (preferred).
- Conservative generic signatures (only param names, no types for untyped languages).

Pros/Cons
- Lang-specific: better quality signatures for typed languages but requires per-language logic.
- Generic: faster to implement, less precise.

Chosen default
- Implement language‑aware signature extraction for TypeScript/JavaScript (leveraging Tree‑sitter/tsserver heuristics where available). For untyped code, fall back to parameter lists without types.

### 10.7 Summary generation strategy

Options
- Template-based summaries (deterministic, fast).
- LLM-assisted summaries (higher quality, requires model/runtime and possible external API).

Pros/Cons
- Template: reproducible and offline; lower semantic quality for complex logic.
- LLM: better natural summaries but increases dependencies and may require large models or external calls.

Chosen default
- Start with deterministic template-based summaries (e.g., "Function X does Y" using heuristics: name + verb from name + short param list). Reserve LLM‑assisted summaries as an opt‑in feature in a later release.

### 10.8 Cyclomatic complexity definition

Chosen default
- Use classical cyclomatic count: 1 + number of decision points. Count nodes: `if`, `for`, `while`, `case` (each case >1), `catch`, `conditional (?:)`, and boolean operators (`&&`, `||`) incrementally when they form separate decision branches.

Rationale
- This provides a reasonable, defensible complexity metric for prioritizing snippets.

### 10.9 Snippet extraction & truncation

Chosen default
- Extract `snippetLines` lines of source surrounding the node span (configurable; default 10). If the function is longer than that, include the central lines and indicate truncation with a clear marker (e.g., "...snippet truncated..."). Snippets will be plain text; consumers (like VS Code) can re-run highlighting if desired.

### 10.10 Embedding model runtime

Options
- `@xenova/transformers` (pure-JS/WASM) loading ONNX or model weights.
- `onnxruntime-node` for local ONNX inference (native, faster, requires native artifacts).

Pros/Cons
- `@xenova`: no native installers, works in more environments, acceptable CPU performance; smaller friction for consumers.
- `onnxruntime-node`: better performance (and GPU/NNAPI) if user has native support, larger install complexity.

Chosen default
- Default to `@xenova/transformers` (WASM) for offline, zero-native-dependency installs. Provide an option `--runtime onnx` to use `onnxruntime-node` when available for improved performance.
- Store model files under `.astdb/models/` and download on first run if not present (explicit prompt and checksum verification).
- Embedding size: default 768 (match CodeBERT-small), but the code will accept other dims and store embedding-dim in index metadata for compatibility.

### 10.11 Vector index backend

Options
- Native `hnswlib-node` (fast, native deps).
- Pure-JS `hnswlib-js` or `hnswlib-wasm` fallback (portable).

Pros/Cons
- Native `hnswlib-node`: high performance, mature, but native build/release burden across OSes.
- Pure-JS/WASM: slower but much easier to ship and use in CI and user machines without native toolchains.

Chosen default
- Provide dual support: default to a pure‑JS/WASM HNSW implementation so installs succeed everywhere. If `hnswlib-node` is available (prebuilt or CI-launched), prefer it for performance.
- Index metadata (`index.meta.json`) will map nodeId → indexId + vectorHash and include a `version` field. Upserts are implemented as delete+insert using the mapping.

### 10.12 Upsert semantics

Chosen default
- Use mapping file to find existing index entries by nodeId; implement delete + insert to replace vectors. If the backend does not support delete, mark older entries as tombstones in `index.meta.json` and rebuild occasionally.

### 10.13 Index serialization format

Chosen default
- For native `hnswlib-node`: use its binary serialization (`index.bin`) plus `index.meta.json` describing indexId→node mapping and embedding metadata.
- For pure-JS backend: serialize vectors and metadata into a compact JSON + binary blobs (Float32Array dumped to a binary file) with a clear version tag to allow migration.

### 10.14 CLI output formats & logging

Chosen default
- `--format` supports `json` and `plain` (human readable). `json` is machine‑friendly and default for programmatic use; `plain` for the VS Code extension by default.
- Provide `--log-level` (`error|warn|info|debug`) and machine-friendly exit codes.

### 10.15 Watch debounce and scaling

Chosen default
- Debounce 200ms as in spec. Use a queue and batch operations (parse/annotate/embed) to avoid repeatedly rebuilding the entire index for rapid edit bursts.
- Provide `--batch` and `--max-batch-size` options for large repos.

### 10.16 VS Code interception strategy

Options
- Best-effort intercept Copilot internal command (`copilot.chat.send`).
- Provide a user-facing command `ast-copilot-helper.enrichCopilotPrompt` that users can bind, or a small UI button.

Pros/Cons
- Intercepting `copilot.chat.send` is fragile because Copilot internals are private and may change.
- A user-command is stable and avoids relying on internal APIs; requires user action or keybinding.

Chosen default
- Provide both: best-effort interception for convenience (documented as experimental) and a documented explicit command `ast-copilot-helper.enrichAndSend` for reliable use. Extension will be opt‑in and respect user settings.

---

## 11. Resolved items (defaults applied)

- MVP: full local flow MVP (`parse`, `annotate`, `embed`, `query`).
- Languages: TS/JS/Python initial support (Python included in initial rollout per stakeholder response).
- Tree‑sitter grammars: downloaded on demand to `.astdb/grammars/` and cached; include Python grammar by default.
- Parsers: prefer native `node-tree-sitter` with WASM fallback.
- `--changed` default: `git diff --name-only --diff-filter=ACMRT HEAD`; support `--staged` and `--base` overrides.
- Node IDs: deterministic hash of file+span+type(+name) for stability.
- Signature extraction: language-aware for TS/JS/Python, fallback generic for other languages.
- Summaries: template-based initial implementation; LLMs reserved for later opt‑in.
- Complexity: 1 + count(decision points) including `if`, `for`, `while`, `case`, `catch`, ternary, boolean ops.
- Snippets: `snippetLines` default 10, truncation markers, plain text.
- Embeddings: default to `@xenova/transformers` WASM runtime; model files cached in `.astdb/models/` and downloaded on first run if missing; embedding dim is configurable (default 768). Option `--runtime onnx` available for onnxruntime-node if user enables native runtime.
- Index backend: pure‑JS/WASM HNSW by default with optional `hnswlib-node` if available.
- Upsert: implemented as delete+insert via `index.meta.json` mapping; tombstones + periodic rebuild for backends without deletions.
- CLI: `--format json|plain`, `--log-level` and stable exit codes.
- Watch: debounce 200 ms with batching.
- VS Code extension: experimental interception + explicit user command; opt‑in.
- Packaging: default functionality with zero native dependencies, plus stakeholder-requested prebuilt native binaries published as optional artifacts for common platforms (Windows x64, macOS arm64/x64, Linux x64). CI will produce and publish these prebuilds if the team confirms the target matrix.
- Telemetry: anonymous opt‑in telemetry is acceptable per stakeholder; implementation must be opt‑in and documented.
- Concurrency: file lock and auto-rebuild option on corruption.

---

## 12. Revisions & remaining open questions (actionable)

Summary of changes from stakeholder answers
- Python is now in the initial language support list and config globs have been updated.
- Stakeholders prefer publishing prebuilt native binaries; the spec now documents CI prebuilds for common platforms as an opt‑in distribution channel.
- Anonymous telemetry is acceptable as opt‑in; privacy policy and opt‑in UX must be added to README and extension settings.
- Stakeholders want direct Copilot integration if feasible; extension will default to opt‑in and provide an explicit command fallback.
- The target scale was increased: support for repositories up to at least ~100k LOC should be planned and validated.

New decisions & recommended plan (answers to previously listed open questions)

1. Model redistribution license — recommended approach
- Recommendation: Do NOT bundle model binaries directly inside the NPM package. Instead host model artifacts on GitHub Releases (or other approved host) and download on first run with an explicit notice and license link. Include the model license text and attribution in the repo (README + LICENSES.md/NOTICE).
- Pros: avoids accidentally redistributing a model with restricted license or large binary blobs; keeps npm package small and fast to install.
- Cons: requires a one-time download step and a network dependency on first run.
- Action: Legal to confirm the model license and provide the exact license file / attribution string and whether redistribution is permitted. Engineering to implement a verified downloader (HTTPS + checksum + optional signature check) and to cache models in `.astdb/models/`.

2. Prebuild publishing strategy — recommended approach
- Recommendation: Publish prebuilt native artifacts for the chosen native backends (hnswlib-node, onnxruntime-node) via GitHub Releases and provide a small optional install-time downloader. Expose them as optional platform-specific artifacts rather than forcing them as required npm deps. Provide a pure-JS/WASM fallback so users without native installs still work.
- Target platforms (proposed): Windows x64, macOS arm64, macOS x64, Linux x64. Confirm matrix with maintainers.
- Pros: users who want max performance get prebuilt binaries; users who prefer zero-native installs use the default pure-JS path.
- Cons: extra CI complexity to build/publish prebuilds.
- Action: Engineering to add CI jobs to build/test/publish prebuilds for approved platforms; Product to confirm exact matrix.

3. Telemetry backend and data retention — recommended approach
- Recommendation: Implement telemetry as strictly opt‑in. Provide a default telemetry stub that is disabled by default; when enabled, send only anonymized diagnostics (error counts, stack traces truncated, environment metadata like OS and package version, and an opt‑in id) to a configurable endpoint. Keep retention limited (e.g., 90 days) and provide a documented opt‑out and data deletion process.
- Pros: allows collecting useful diagnostics while respecting privacy and legal constraints.
- Cons: requires hosting/operational overhead if telemetry is enabled.
- Action: Product to decide whether to operate a telemetry endpoint (or use a third‑party vendor) and specify retention policy. Engineering to implement opt‑in flow and configuration for endpoint URL.

4. Model delivery & verification — recommended approach
- Recommendation: Host models on GitHub Releases (or identical trusted host) and publish SHA256 checksums alongside each artifact. Optionally sign artifacts (GPG or Sigstore) for higher assurance. On download, verify checksum (and signature if present) before use.
- Pros: secure delivery and verifiable authenticity.
- Cons: additional release and signing steps in CI.
- Action: Engineering to add release artifacts + checksums to CI; Security/DevOps to configure signing keys and verification instructions.

5. Native runtime expectations — recommended approach
- Recommendation: Support two modes: (A) default zero-native mode (pure-JS/WASM runtimes), and (B) optional native mode (onnxruntime-node/hnswlib-node). Provide prebuilt artifacts (CI) and a user opt‑in install path (postinstall flag or explicit `--use-native` CLI switch) that downloads and installs prebuilt native runtime. Do not require native builds on first install.
- Pros: minimal friction for most users, and native performance available for power users.
- Cons: maintenance effort for prebuilds.
- Action: CI to produce prebuilds; packaging docs to explain how to opt into native mode.

6. Integration test scale targets — recommended approach
- Recommendation: Create a synthetic fixture repository that approximates the target scale (100k LOC) by combining real small open-source projects or generating many small files programmatically. Define measurable targets: full parse→annotate→embed→index build should finish within a CI runner budget (e.g., <10 minutes on a 2‑CPU 8GB runner for baseline) and query latency for top‑5 should be <200ms on average.
- Pros: provides repeatable performance baselines.
- Cons: synthetic fixtures may not reflect all real-world code patterns; real-repo testing should be added later.
- Action: QA/Engineering to create the fixture and add CI jobs to run performance benchmarks and record results.

7. Copilot interception risk acceptance — recommended approach
- Recommendation: Ship only explicit command integration by default (opt‑in) and provide an experimental interception path behind a clearly labeled flag. Do not enable interception by default. Document the experimental nature and fallback.
- Pros: avoids surprising behavior and reduces breakage risk while giving power users an option.
- Cons: slightly less seamless UX for users who want automatic augmentation.
- Action: Extension to expose `ast-copilot-helper.enrichAndSend` command, and an `enableExperimentalCopilotIntercept` setting for users to opt in.

8. Model license sources and attribution — recommended approach
- Recommendation: Create a `LICENSES.md` and `NOTICE` file in repo root that lists model license(s) and attribution, with links to upstream license documents. Include a short note in README and in the extension manifest stating the model origin and license.
- Action: Legal to supply license files and attribution text. Engineering to add files and references to README.

9. Security & supply chain — recommended approach
- Recommendation: Sign all downloadable artifacts (models and native prebuilds) using Sigstore/cosign or GPG and publish SHA256 checksums. Store public verification keys in the repo and document the verification steps. Automate signing in CI.
- Pros: improves supply-chain security and user trust.
- Cons: requires key management and CI integration.
- Action: DevOps/Security to pick a signing toolchain (Sigstore recommended) and configure CI to sign artifacts and publish verification metadata.


Next actions (updated)
- Legal: confirm redistribution rights and provide model license files and attribution text.
- Engineering: implement model downloader with checksum & optional signature verification; add CI tasks to build and publish prebuilt native artifacts; add opt‑in native install flow and telemetry stub.
- DevOps/Security: configure signing (Sigstore/cosign or GPG) in CI and store public keys in repo.
- QA: create a 100k LOC fixture for CI benchmarking and publish baseline metrics.
- Product: confirm platform matrix for prebuilds and decide telemetry endpoint/retention or keep telemetry disabled until an endpoint is available.
