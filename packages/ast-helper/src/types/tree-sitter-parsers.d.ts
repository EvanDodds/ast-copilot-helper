/**
 * Type declarations for Tree-sitter parser modules
 * Provides TypeScript support for dynamically imported Tree-sitter parsers
 */

declare module "tree-sitter-javascript" {
  const JavaScript: any;
  export = JavaScript;
}

declare module "tree-sitter-typescript" {
  export const typescript: any;
  export const tsx: any;
}

declare module "tree-sitter-python" {
  const Python: any;
  export = Python;
}

declare module "tree-sitter-java" {
  const Java: any;
  export = Java;
}

declare module "tree-sitter-c-sharp" {
  const CSharp: any;
  export = CSharp;
}

declare module "tree-sitter-go" {
  const Go: any;
  export = Go;
}

declare module "tree-sitter-rust" {
  const Rust: any;
  export = Rust;
}

declare module "tree-sitter-c" {
  const C: any;
  export = C;
}

declare module "tree-sitter-cpp" {
  const Cpp: any;
  export = Cpp;
}
