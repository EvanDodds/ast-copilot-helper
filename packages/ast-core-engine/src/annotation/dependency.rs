//! Dependency analysis functionality for AST nodes

use super::types::DependencyInfo;
use crate::types::ASTNode;
use std::collections::HashSet;

/// Analyzes dependencies, imports, exports, and call relationships
pub struct DependencyAnalyzer;

impl DependencyAnalyzer {
    /// Create a new dependency analyzer
    pub fn new() -> Self {
        Self
    }

    /// Analyze dependencies for a single AST node
    pub fn analyze_node(
        &self,
        node: &ASTNode,
        source_text: &str,
        file_path: &str,
    ) -> DependencyInfo {
        DependencyInfo {
            imports: self.extract_imports(node, source_text),
            exports: self.extract_exports(node, source_text),
            calls: self.extract_function_calls(node, source_text),
            external_dependencies: self.extract_external_dependencies(node, source_text),
            internal_dependencies: self.extract_internal_dependencies(node, source_text, file_path),
        }
    }

    /// Extract import statements and dependencies
    fn extract_imports(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let mut imports = HashSet::new();

        self.extract_imports_recursive(node, source_text, &mut imports);

        imports.into_iter().collect()
    }

    /// Extract imports from node (simplified text-based approach)
    fn extract_imports_recursive(
        &self,
        node: &ASTNode,
        source_text: &str,
        imports: &mut HashSet<String>,
    ) {
        match node.node_type.as_str() {
            // JavaScript/TypeScript imports
            "import_statement" | "import_declaration" => {
                // Check if it's a JS/TS style import or Java style import
                if node.text.contains("from") || node.text.contains("require(") {
                    if let Some(import_name) = self.parse_import_statement(&node.text) {
                        imports.insert(import_name);
                    }
                } else if node.text.contains("import ") && node.text.contains(".") {
                    // Java style import
                    if let Some(import_name) = self.parse_java_import(&node.text) {
                        imports.insert(import_name);
                    }
                }
            }
            // Require statements
            "call_expression" => {
                if node.text.contains("require(") {
                    if let Some(required_module) = self.parse_require_statement(&node.text) {
                        imports.insert(required_module);
                    }
                }
            }
            // Python imports
            "import_from_statement" => {
                if let Some(import_name) = self.parse_python_import(&node.text) {
                    imports.insert(import_name);
                }
            }
            // Rust use statements
            "use_declaration" => {
                if let Some(use_name) = self.parse_rust_use(&node.text) {
                    imports.insert(use_name);
                }
            }
            _ => {}
        }

        // Also search in the full source text for imports
        self.extract_imports_from_text(source_text, imports);
    }

    /// Extract imports from text content
    fn extract_imports_from_text(&self, source_text: &str, imports: &mut HashSet<String>) {
        // JavaScript/TypeScript imports
        for line in source_text.lines() {
            let trimmed = line.trim();

            // import { ... } from "module"
            if trimmed.starts_with("import") && trimmed.contains("from") {
                if let Some(module) = self.parse_import_statement(line) {
                    imports.insert(module);
                }
            }
            // const ... = require("module")
            else if trimmed.contains("require(") {
                if let Some(module) = self.parse_require_statement(line) {
                    imports.insert(module);
                }
            }
            // Rust use statements
            else if trimmed.starts_with("use ") {
                if let Some(module) = self.parse_rust_use(line) {
                    imports.insert(module);
                }
            }
            // Python imports
            else if trimmed.starts_with("import ") || trimmed.starts_with("from ") {
                if let Some(module) = self.parse_python_import(line) {
                    imports.insert(module);
                }
            }
            // Java imports
            else if trimmed.starts_with("import ") {
                if let Some(module) = self.parse_java_import(line) {
                    imports.insert(module);
                }
            }
        }
    }

    /// Extract export statements and exported symbols
    fn extract_exports(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let mut exports = HashSet::new();

        self.extract_exports_recursive(node, source_text, &mut exports);

        exports.into_iter().collect()
    }

    /// Extract exports from node (simplified text-based approach)
    fn extract_exports_recursive(
        &self,
        node: &ASTNode,
        _source_text: &str,
        exports: &mut HashSet<String>,
    ) {
        match node.node_type.as_str() {
            // JavaScript/TypeScript exports
            "export_statement" | "export_declaration" => {
                if let Some(export_name) = self.parse_export_statement(&node.text) {
                    exports.insert(export_name);
                }
            }
            // Function/class declarations with export modifier
            "function_declaration"
            | "class_declaration"
            | "interface_declaration"
            | "type_alias_declaration"
            | "variable_declaration" => {
                if node.text.contains("export") {
                    if let Some(export_name) = self.extract_declaration_name(&node.text) {
                        exports.insert(export_name);
                    }
                }
            }
            // Rust pub items
            "function_item" | "struct_item" | "enum_item" | "trait_item" | "mod_item" => {
                if node.text.contains("pub ") {
                    if let Some(export_name) = self.extract_declaration_name(&node.text) {
                        exports.insert(export_name);
                    }
                }
            }
            // Python __all__ exports
            "assignment" => {
                if node.text.contains("__all__") {
                    let all_exports = self.parse_python_all_exports(&node.text);
                    for export in all_exports {
                        exports.insert(export);
                    }
                }
            }
            // Java public declarations (excluding class_declaration which is handled above)
            "method_declaration" | "field_declaration" => {
                if node.text.contains("public") {
                    if let Some(export_name) = self.extract_declaration_name(&node.text) {
                        exports.insert(export_name);
                    }
                }
            }
            _ => {}
        }
    }

    /// Extract function and method calls
    fn extract_function_calls(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let mut calls = HashSet::new();

        self.extract_calls_recursive(node, source_text, &mut calls);

        calls.into_iter().collect()
    }

    /// Recursively extract function calls from node tree
    fn extract_calls_recursive(
        &self,
        node: &ASTNode,
        _source_text: &str,
        calls: &mut HashSet<String>,
    ) {
        match node.node_type.as_str() {
            "call_expression" | "function_call" | "method_invocation" => {
                if let Some(call_name) = self.parse_function_call(&node.text) {
                    calls.insert(call_name);
                }
            }
            "member_expression" | "field_access" => {
                if let Some(member_name) = self.parse_member_access(&node.text) {
                    calls.insert(member_name);
                }
            }
            _ => {}
        }
    }

    /// Extract external library dependencies
    fn extract_external_dependencies(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let imports = self.extract_imports(node, source_text);
        let mut external_deps = HashSet::new();

        for import in imports {
            if self.is_external_dependency(&import) {
                external_deps.insert(import);
            }
        }

        external_deps.into_iter().collect()
    }

    /// Extract internal project dependencies
    fn extract_internal_dependencies(
        &self,
        node: &ASTNode,
        source_text: &str,
        file_path: &str,
    ) -> Vec<String> {
        let imports = self.extract_imports(node, source_text);
        let mut internal_deps = HashSet::new();

        for import in imports {
            if self.is_internal_dependency(&import, file_path) {
                internal_deps.insert(import);
            }
        }

        internal_deps.into_iter().collect()
    }

    // Parser methods for different languages and constructs

    fn parse_import_statement(&self, text: &str) -> Option<String> {
        // Parse "import { foo } from 'module'" or "import * as foo from 'module'"
        if let Some(from_pos) = text.rfind("from") {
            let from_part = &text[from_pos + 4..].trim();
            if let Some(quote_start) = from_part.find(['\'', '"']) {
                let quote_char = from_part.chars().nth(quote_start).unwrap();
                if let Some(quote_end) = from_part[quote_start + 1..].find(quote_char) {
                    return Some(
                        from_part[quote_start + 1..quote_start + 1 + quote_end].to_string(),
                    );
                }
            }
        }
        None
    }

    fn parse_require_statement(&self, text: &str) -> Option<String> {
        // Parse "require('module')" or "require("module")"
        if let Some(require_pos) = text.find("require(") {
            let require_part = &text[require_pos + 8..];
            if let Some(quote_start) = require_part.find(['\'', '"']) {
                let quote_char = require_part.chars().nth(quote_start).unwrap();
                if let Some(quote_end) = require_part[quote_start + 1..].find(quote_char) {
                    return Some(
                        require_part[quote_start + 1..quote_start + 1 + quote_end].to_string(),
                    );
                }
            }
        }
        None
    }

    fn parse_python_import(&self, text: &str) -> Option<String> {
        let trimmed = text.trim();

        if trimmed.starts_with("import ") {
            // "import module" or "import module as alias"
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                return Some(parts[1].split('.').next().unwrap_or(parts[1]).to_string());
            }
        } else if trimmed.starts_with("from ") {
            // "from module import ..."
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                return Some(parts[1].to_string());
            }
        }

        None
    }

    fn parse_rust_use(&self, text: &str) -> Option<String> {
        let trimmed = text.trim();

        if let Some(use_part) = trimmed.strip_prefix("use ") {
            // Extract the crate/module name (first part before ::)
            let module = use_part.split("::").next().unwrap_or(use_part);
            let module = module.split('{').next().unwrap_or(module);
            let module = module.trim().trim_matches(';');
            return Some(module.to_string());
        }

        None
    }

    fn parse_java_import(&self, text: &str) -> Option<String> {
        let trimmed = text.trim();

        if let Some(import_part) = trimmed.strip_prefix("import ") {
            let import_part = import_part.trim_matches(';').trim();

            // Extract package name (before the last dot)
            if let Some(dot_pos) = import_part.rfind('.') {
                return Some(import_part[..dot_pos].to_string());
            } else {
                return Some(import_part.to_string());
            }
        }

        None
    }

    fn parse_export_statement(&self, text: &str) -> Option<String> {
        let trimmed = text.trim();

        if let Some(export_part) = trimmed.strip_prefix("export ") {
            if export_part.starts_with("default ") {
                return Some("default".to_string());
            } else if export_part.starts_with("{") {
                // Named exports: export { foo, bar }
                if let Some(end_brace) = export_part.find('}') {
                    let names_part = &export_part[1..end_brace];
                    let names: Vec<String> = names_part
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    return names.first().cloned(); // Return first export for simplicity
                }
            } else {
                // Direct export: export function foo() {}
                if let Some(name) = self.extract_declaration_name(export_part) {
                    return Some(name);
                }
            }
        }

        None
    }

    fn parse_python_all_exports(&self, text: &str) -> Vec<String> {
        let mut exports = Vec::new();

        if let Some(all_pos) = text.find("__all__") {
            let all_part = &text[all_pos..];
            if let Some(bracket_start) = all_part.find('[') {
                if let Some(bracket_end) = all_part.find(']') {
                    let list_part = &all_part[bracket_start + 1..bracket_end];
                    for item in list_part.split(',') {
                        let item = item.trim().trim_matches(['\'', '"']);
                        if !item.is_empty() {
                            exports.push(item.to_string());
                        }
                    }
                }
            }
        }

        exports
    }

    fn extract_declaration_name(&self, text: &str) -> Option<String> {
        let keywords = [
            "function",
            "class",
            "interface",
            "type",
            "const",
            "let",
            "var",
            "def",
            "fn",
            "struct",
            "enum",
            "trait",
            "mod",
            "public class",
            "public",
        ];

        for keyword in &keywords {
            if let Some(pos) = text.find(keyword) {
                let after_keyword = &text[pos + keyword.len()..].trim_start();
                if let Some(name) = after_keyword.split_whitespace().next() {
                    let clean_name = name
                        .trim_matches(['(', ':', '<', '{', '=', ';'])
                        .to_string();
                    if !clean_name.is_empty() {
                        return Some(clean_name);
                    }
                }
            }
        }

        None
    }

    fn parse_function_call(&self, text: &str) -> Option<String> {
        // Extract function name from call expression
        let text = text.trim();

        if let Some(paren_pos) = text.find('(') {
            let func_part = &text[..paren_pos];
            let func_name = func_part.split('.').next_back().unwrap_or(func_part);
            return Some(func_name.trim().to_string());
        }

        None
    }

    fn parse_member_access(&self, text: &str) -> Option<String> {
        // Extract member name from member access
        let text = text.trim();

        if let Some(dot_pos) = text.rfind('.') {
            let member = &text[dot_pos + 1..];
            return Some(member.trim().to_string());
        }

        None
    }

    fn is_external_dependency(&self, import: &str) -> bool {
        // Heuristics to determine if a dependency is external
        !import.starts_with('.') &&  // Not relative imports
        !import.starts_with('/') &&  // Not absolute file paths
        !import.contains("src/") &&  // Not internal src references
        !import.contains("lib/") &&  // Not internal lib references
        !import.starts_with("super::") && // Not Rust parent module
        !import.starts_with("crate::") && // Not Rust crate-local
        !import.starts_with("std::") &&   // Standard library (could be considered internal)
        !import.is_empty()
    }

    fn is_internal_dependency(&self, import: &str, _file_path: &str) -> bool {
        // Heuristics to determine if a dependency is internal to the project
        import.starts_with('.') ||    // Relative imports
        import.starts_with('/') ||    // Absolute file paths
        import.contains("src/") ||    // Internal src references
        import.contains("lib/") ||    // Internal lib references
        import.starts_with("super::") || // Rust parent module
        import.starts_with("crate::") // Rust crate-local
    }
}

impl Default for DependencyAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Point;

    #[allow(dead_code)]
    fn create_test_node(node_type: &str, text: &str, children_ids: Vec<String>) -> ASTNode {
        ASTNode {
            id: format!("test_{}_{}", node_type, text.len()),
            node_type: node_type.to_string(),
            start_byte: 0,
            end_byte: text.len() as u32,
            start_point: Point { row: 0, column: 0 },
            end_point: Point {
                row: 0,
                column: text.len() as u32,
            },
            text: text.to_string(),
            language: "test".to_string(),
            complexity: 1,
            parent_id: None,
            children_ids,
        }
    }

    #[test]
    fn test_parse_import_statement() {
        let analyzer = DependencyAnalyzer::new();

        assert_eq!(
            analyzer.parse_import_statement("import { foo } from 'module'"),
            Some("module".to_string())
        );

        assert_eq!(
            analyzer.parse_import_statement("import * as bar from \"another-module\""),
            Some("another-module".to_string())
        );
    }

    #[test]
    fn test_parse_require_statement() {
        let analyzer = DependencyAnalyzer::new();

        assert_eq!(
            analyzer.parse_require_statement("const fs = require('fs')"),
            Some("fs".to_string())
        );
    }

    #[test]
    fn test_external_dependency_detection() {
        let analyzer = DependencyAnalyzer::new();

        assert!(analyzer.is_external_dependency("lodash"));
        assert!(analyzer.is_external_dependency("react"));
        assert!(!analyzer.is_external_dependency("./local-file"));
        assert!(!analyzer.is_external_dependency("../parent-file"));
        assert!(!analyzer.is_external_dependency("src/utils"));
    }

    #[test]
    fn test_internal_dependency_detection() {
        let analyzer = DependencyAnalyzer::new();

        assert!(analyzer.is_internal_dependency("./local-file", ""));
        assert!(analyzer.is_internal_dependency("../parent-file", ""));
        assert!(analyzer.is_internal_dependency("src/utils", ""));
        assert!(!analyzer.is_internal_dependency("lodash", ""));
    }
}
