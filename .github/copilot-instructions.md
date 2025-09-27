# Copilot Instructions for ast-copilot-helper

This project is a polyglot codebase with TypeScript and Rust components, where the Rust core engine uses NAPI bindings to integrate with Node.js.

When working with Rust code in this project, use `cargo check` instead of `cargo test` for validation because NAPI-based tests require Node.js runtime context and will fail as standalone binaries.

For workflow and CI/CD improvements, always check if validation exists for all languages in the project. If TypeScript has comprehensive testing but Rust validation is missing or "skipped for development", proactively suggest implementing complete Rust validation including pre-commit hooks and CI jobs.

When enhancing pre-commit hooks for multi-language projects, implement conditional validation that detects file changes by extension and runs appropriate tooling only when needed to optimize development speed.

For CI/CD enhancements, create dedicated validation jobs for each language that run in parallel with existing jobs, include proper dependency caching, and use stable toolchain versions.

Always update DEVELOPMENT.md or equivalent documentation when implementing workflow changes, including specific command examples and technical constraints like NAPI linking limitations.

Before committing workflow enhancements, test the complete validation pipeline to ensure it catches real issues and works correctly across different development scenarios.

We use Husky for git hooks, Yarn for package management, Vitest for TypeScript testing, and Cargo for Rust toolchain management including clippy for linting and rustfmt for code formatting.

When implementing comprehensive validation systems, follow this pattern: update package.json scripts, enhance pre-commit hooks, add CI workflow jobs, update documentation, and test the complete system before committing.
