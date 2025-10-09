# Copilot Instructions for ast-copilot-helper

This project is a polyglot codebase with TypeScript and Rust components, where the Rust core engine uses WebAssembly (WASM) bindings to integrate with Node.js and browsers.

When working with Rust code in this project, use `cargo check` instead of `cargo test` for validation because the WASM target requires specific build tooling (wasm-pack) for comprehensive testing.

For workflow and CI/CD improvements, always check if validation exists for all languages in the project. If TypeScript has comprehensive testing but Rust validation is missing or "skipped for development", proactively suggest implementing complete Rust validation including pre-commit hooks and CI jobs.

When enhancing pre-commit hooks for multi-language projects, implement conditional validation that detects file changes by extension and runs appropriate tooling only when needed to optimize development speed.

For CI/CD enhancements, create dedicated validation jobs for each language that run in parallel with existing jobs, include proper dependency caching, and use stable toolchain versions.

Always update DEVELOPMENT.md or equivalent documentation when implementing workflow changes, including specific command examples and technical constraints like WASM compilation requirements.

Before committing workflow enhancements, test the complete validation pipeline to ensure it catches real issues and works correctly across different development scenarios.

We use Husky for git hooks, Yarn for package management, Vitest for TypeScript testing, and Cargo for Rust toolchain management including clippy for linting and rustfmt for code formatting.

When implementing comprehensive validation systems, follow this pattern: update package.json scripts, enhance pre-commit hooks, add CI workflow jobs, update documentation, and test the complete system before committing.

## Process Improvements for Code Quality

Following the October 2025 comprehensive verification that identified 19% false positives in incomplete features, adhere to these standards:

### Code Organization Standards

**Avoid Misleading Stubs:**

- Never leave stub files with TODO comments when implementations exist elsewhere
- Replace stubs with re-exports or clear documentation pointing to actual implementations
- Delete stub files that serve no purpose

**Handler Pattern:**
When creating CLI handlers or similar integration points that delegate to actual implementations:

```typescript
// ✅ Good: Clear documentation
/**
 * CLI handler for watch command
 * Implementation: src/commands/watch.ts (WatchCommand class)
 */
class WatchCommandHandler {
  async execute() {
    const command = new WatchCommand(config);
    return command.start();
  }
}

// ❌ Bad: Misleading TODO
class WatchCommandHandler {
  async execute() {
    // TODO: Implement watch logic
    console.log("Not implemented");
  }
}
```

**Module Organization:**

- Keep related functionality in dedicated modules (e.g., `watch.ts` for WatchCommand, not in `cli.ts`)
- Use clear re-exports in index files
- Add comments in core/main files pointing to actual implementations

### Documentation Synchronization

**Before Updating Documentation:**

1. Verify current implementation state with semantic search
2. Check for recent changes in related modules
3. Run tests to confirm functionality
4. Include file locations and line numbers
5. Add "last verified" dates

**Regular Audits:**

- Monthly review of TODO comments vs actual implementations
- Verify feature status reports match code state
- Check for outdated "placeholder" or "not implemented" warnings
- Update completion percentages based on actual code

**Automated Checks:**
Consider implementing pre-commit hooks that flag potential false positives when TODO comments are added.

### Verification Before Flagging

**Multi-Step Verification Process:**
When finding a TODO or potential gap, always:

1. **Context Analysis:** Read 20-30 lines around the TODO to understand if it's a stub vs integration point
2. **Semantic Search:** Search for related class/function names using multiple patterns:
   - Class/struct definitions: `rg "class WatchCommand|struct WatchCommand"`
   - Exports: `rg "export.*WatchCommand"`
   - Imports: `rg "import.*WatchCommand"`
3. **Test Coverage Check:** Look for test files: `find . -name "*watch*.test.*"`
4. **Common Patterns Check:**
   - Handler + Implementation split (handler in `cli.ts`, impl in `commands/watch.ts`)
   - Core + Separate module (stub in `core.rs`, impl in `vector_db.rs`)
   - Registration + Handler class (registration with comment, actual handler below)

**Never flag as incomplete based solely on:**

- A single TODO comment without verification
- Grep results without context
- Missing exports without checking implementations

**Required for Flagging:**

- Document all verification steps taken
- Include negative evidence (what was searched and not found)
- Verify no implementations exist in sibling modules
- Check test files for passing tests
- Review recent git history for implementations

### Examples from Past False Positives

**MCP Resources (False Positive):**

- Found: TODO-like comments in registration code
- Reality: Full implementations existed in same file (handleNodesResource, handleFilesResource, handleSearchResource)
- Lesson: Read more context, check for handler methods below registration

**Rust Core Engine (False Positive):**

- Found: `// TODO: Implement vector database` in core.rs
- Reality: Full implementation in vector_db.rs (186 lines)
- Lesson: Check sibling modules, look for re-exports

**Cache Commands (False Positive):**

- Found: "Placeholder Command" warnings in documentation
- Reality: Complete implementations in cache.ts (warmCache, pruneCache, analyzeCache)
- Lesson: Verify documentation matches code, check for outdated warnings

**Watch Command (False Positive):**

- Found: Stub handler with TODO in cli.ts
- Reality: Full implementation in commands/watch.ts (945 lines)
- Lesson: Distinguish integration points from missing implementations

For complete details, see PROCESS_IMPROVEMENTS.md.
