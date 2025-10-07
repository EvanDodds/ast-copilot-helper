//! Language-specific extractors for signature and metadata generation

use super::types::{Parameter, SemanticTag};
use crate::types::ASTNode;
// HashMap removed - not currently used

/// Trait for language-specific extraction logic
pub trait LanguageExtractor: Send + Sync {
    /// Extract a clean signature from the AST node
    fn extract_signature(&self, node: &ASTNode, source_text: &str) -> String;

    /// Extract function/method parameters
    fn extract_parameters(&self, node: &ASTNode, source_text: &str) -> Vec<Parameter>;

    /// Extract return type information
    fn extract_return_type(&self, node: &ASTNode, source_text: &str) -> Option<String>;

    /// Extract access modifiers (public, private, etc.)
    fn extract_modifiers(&self, node: &ASTNode, source_text: &str) -> Vec<String>;

    /// Extract imported dependencies referenced by this node
    fn extract_dependencies(&self, node: &ASTNode, source_text: &str) -> Vec<String>;

    /// Extract exports defined by this node
    fn extract_exports(&self, node: &ASTNode, source_text: &str) -> Vec<String>;

    /// Extract function/method calls made by this node
    fn extract_calls(&self, node: &ASTNode, source_text: &str) -> Vec<String>;

    /// Generate semantic tags for this node
    fn extract_semantic_tags(&self, node: &ASTNode, source_text: &str) -> Vec<SemanticTag>;

    /// Generate a human-readable summary
    fn generate_summary(&self, node: &ASTNode, signature: &str, source_text: &str) -> String;
}

/// TypeScript/JavaScript extractor implementation
pub struct TypeScriptExtractor;

impl LanguageExtractor for TypeScriptExtractor {
    fn extract_signature(&self, node: &ASTNode, source_text: &str) -> String {
        let lines = get_node_lines(node, source_text);

        match node.node_type.as_str() {
            "function_declaration" | "method_definition" | "arrow_function" => {
                self.extract_function_signature(&lines)
            }
            "class_declaration" => self.extract_class_signature(&lines),
            "interface_declaration" => self.extract_interface_signature(&lines),
            "type_alias_declaration" => self.extract_type_signature(&lines),
            "variable_declaration" => self.extract_variable_signature(&lines),
            _ => lines.first().unwrap_or(&String::new()).trim().to_string(),
        }
    }

    fn extract_parameters(&self, node: &ASTNode, source_text: &str) -> Vec<Parameter> {
        let signature = self.extract_signature(node, source_text);
        self.parse_parameters_from_signature(&signature)
    }

    fn extract_return_type(&self, node: &ASTNode, source_text: &str) -> Option<String> {
        let signature = self.extract_signature(node, source_text);

        // Look for ": ReturnType" pattern
        if let Some(colon_pos) = signature.rfind(':') {
            let return_part = &signature[colon_pos + 1..];
            if let Some(arrow_pos) = return_part.find("=>") {
                return Some(return_part[arrow_pos + 2..].trim().to_string());
            }
            // Handle regular function return type
            Some(return_part.trim().replace("{", "").trim().to_string())
        } else {
            None
        }
    }

    fn extract_modifiers(&self, node: &ASTNode, _source_text: &str) -> Vec<String> {
        let text = &node.text;
        let mut modifiers = Vec::new();

        if text.contains("export") {
            modifiers.push("export".to_string());
        }
        if text.contains("default") {
            modifiers.push("default".to_string());
        }
        if text.contains("async") {
            modifiers.push("async".to_string());
        }
        if text.contains("static") {
            modifiers.push("static".to_string());
        }
        if text.contains("private") {
            modifiers.push("private".to_string());
        }
        if text.contains("protected") {
            modifiers.push("protected".to_string());
        }
        if text.contains("public") {
            modifiers.push("public".to_string());
        }
        if text.contains("readonly") {
            modifiers.push("readonly".to_string());
        }

        modifiers
    }

    fn extract_dependencies(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        // TODO: Implement dependency extraction by analyzing imports and usage
        Vec::new()
    }

    fn extract_exports(&self, node: &ASTNode, _source_text: &str) -> Vec<String> {
        let mut exports = Vec::new();

        if node.text.contains("export") {
            // Extract the exported name based on node type
            match node.node_type.as_str() {
                "function_declaration" | "class_declaration" | "interface_declaration" => {
                    if let Some(name) = extract_name_from_text(&node.text) {
                        exports.push(name);
                    }
                }
                _ => {}
            }
        }

        exports
    }

    fn extract_calls(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        // TODO: Implement call extraction by analyzing function calls
        Vec::new()
    }

    fn extract_semantic_tags(&self, node: &ASTNode, _source_text: &str) -> Vec<SemanticTag> {
        let mut tags = Vec::new();
        let text_lower = node.text.to_lowercase();

        // Detect async patterns
        if text_lower.contains("async") || text_lower.contains("await") {
            tags.push(SemanticTag::Async);
        }

        // Detect generators
        if text_lower.contains("function*") || text_lower.contains("yield") {
            tags.push(SemanticTag::Generator);
        }

        // Detect test patterns
        if text_lower.contains("test")
            || text_lower.contains("spec")
            || text_lower.contains("describe")
            || text_lower.contains("it(")
        {
            tags.push(SemanticTag::Test);
        }

        // Detect utility patterns
        if text_lower.contains("util") || text_lower.contains("helper") {
            tags.push(SemanticTag::Utility);
        }

        // Detect handler patterns
        if text_lower.contains("handler") || text_lower.contains("handle") {
            tags.push(SemanticTag::Handler);
        }

        tags
    }

    fn generate_summary(&self, node: &ASTNode, _signature: &str, _source_text: &str) -> String {
        match node.node_type.as_str() {
            "function_declaration" | "method_definition" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                let params = self.extract_parameters(node, _source_text);
                let param_count = params.len();

                if param_count == 0 {
                    format!("Function {} with no parameters", name)
                } else {
                    format!(
                        "Function {} with {} parameter{}",
                        name,
                        param_count,
                        if param_count == 1 { "" } else { "s" }
                    )
                }
            }
            "class_declaration" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Class {} definition", name)
            }
            "interface_declaration" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Interface {} definition", name)
            }
            "variable_declaration" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Variable {} declaration", name)
            }
            _ => format!("Code element of type {}", node.node_type),
        }
    }
}

impl TypeScriptExtractor {
    fn extract_function_signature(&self, lines: &[String]) -> String {
        // Find the function declaration line
        for line in lines {
            if line.trim_start().starts_with("function ")
                || line.trim_start().starts_with("export function ")
                || line.trim_start().starts_with("async function ")
                || line.contains("=>")
            {
                return line.trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_class_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("class ")
                || line.trim_start().starts_with("export class ")
            {
                return line.replace("{", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_interface_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("interface ")
                || line.trim_start().starts_with("export interface ")
            {
                return line.replace("{", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_type_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("type ")
                || line.trim_start().starts_with("export type ")
            {
                return line.replace("=", " =").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_variable_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("const ")
                || line.trim_start().starts_with("let ")
                || line.trim_start().starts_with("var ")
                || line.trim_start().starts_with("export const ")
            {
                return line.split('=').next().unwrap_or(line).trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn parse_parameters_from_signature(&self, signature: &str) -> Vec<Parameter> {
        let mut parameters = Vec::new();

        // Extract parameter list between parentheses
        if let Some(start) = signature.find('(') {
            if let Some(end) = signature[start..].find(')') {
                let params_str = &signature[start + 1..start + end];

                for param_str in params_str.split(',') {
                    let param_str = param_str.trim();
                    if param_str.is_empty() {
                        continue;
                    }

                    let optional = param_str.contains('?');
                    let (name, param_type, default_value) = parse_parameter(param_str);

                    parameters.push(Parameter {
                        name,
                        param_type,
                        optional,
                        default_value,
                    });
                }
            }
        }

        parameters
    }
}

/// JavaScript extractor (similar to TypeScript but without type annotations)
pub struct JavaScriptExtractor;

impl LanguageExtractor for JavaScriptExtractor {
    fn extract_signature(&self, node: &ASTNode, source_text: &str) -> String {
        // Similar to TypeScript but simpler
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_signature(node, source_text)
    }

    fn extract_parameters(&self, node: &ASTNode, source_text: &str) -> Vec<Parameter> {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_parameters(node, source_text)
    }

    fn extract_return_type(&self, _node: &ASTNode, _source_text: &str) -> Option<String> {
        None // JavaScript doesn't have explicit return types
    }

    fn extract_modifiers(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_modifiers(node, source_text)
    }

    fn extract_dependencies(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_dependencies(node, source_text)
    }

    fn extract_exports(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_exports(node, source_text)
    }

    fn extract_calls(&self, node: &ASTNode, source_text: &str) -> Vec<String> {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_calls(node, source_text)
    }

    fn extract_semantic_tags(&self, node: &ASTNode, source_text: &str) -> Vec<SemanticTag> {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.extract_semantic_tags(node, source_text)
    }

    fn generate_summary(&self, node: &ASTNode, signature: &str, source_text: &str) -> String {
        let ts_extractor = TypeScriptExtractor;
        ts_extractor.generate_summary(node, signature, source_text)
    }
}

/// Python extractor implementation
pub struct PythonExtractor;

impl LanguageExtractor for PythonExtractor {
    fn extract_signature(&self, node: &ASTNode, source_text: &str) -> String {
        let lines = get_node_lines(node, source_text);

        match node.node_type.as_str() {
            "function_definition" => self.extract_function_signature(&lines),
            "class_definition" => self.extract_class_signature(&lines),
            _ => lines.first().unwrap_or(&String::new()).trim().to_string(),
        }
    }

    fn extract_parameters(&self, node: &ASTNode, source_text: &str) -> Vec<Parameter> {
        let signature = self.extract_signature(node, source_text);
        self.parse_python_parameters(&signature)
    }

    fn extract_return_type(&self, node: &ASTNode, source_text: &str) -> Option<String> {
        let signature = self.extract_signature(node, source_text);

        // Look for "-> ReturnType:" pattern
        if let Some(arrow_pos) = signature.find("->") {
            let return_part = &signature[arrow_pos + 2..];
            if let Some(colon_pos) = return_part.find(':') {
                return Some(return_part[..colon_pos].trim().to_string());
            }
        }
        None
    }

    fn extract_modifiers(&self, node: &ASTNode, _source_text: &str) -> Vec<String> {
        let mut modifiers = Vec::new();

        if node.text.contains("async def") {
            modifiers.push("async".to_string());
        }

        // Check for decorators
        if node.text.contains("@staticmethod") {
            modifiers.push("static".to_string());
        }
        if node.text.contains("@classmethod") {
            modifiers.push("classmethod".to_string());
        }
        if node.text.contains("@property") {
            modifiers.push("property".to_string());
        }

        modifiers
    }

    fn extract_dependencies(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_exports(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_calls(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_semantic_tags(&self, node: &ASTNode, _source_text: &str) -> Vec<SemanticTag> {
        let mut tags = Vec::new();
        let text_lower = node.text.to_lowercase();

        if text_lower.contains("async def") {
            tags.push(SemanticTag::Async);
        }

        if text_lower.contains("test_") || text_lower.contains("def test") {
            tags.push(SemanticTag::Test);
        }

        tags
    }

    fn generate_summary(&self, node: &ASTNode, _signature: &str, _source_text: &str) -> String {
        match node.node_type.as_str() {
            "function_definition" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Python function {}", name)
            }
            "class_definition" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Python class {}", name)
            }
            _ => format!("Python {} element", node.node_type),
        }
    }
}

impl PythonExtractor {
    fn extract_function_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("def ") || line.trim_start().starts_with("async def ")
            {
                return line.replace(":", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_class_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("class ") {
                return line.replace(":", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn parse_python_parameters(&self, signature: &str) -> Vec<Parameter> {
        let mut parameters = Vec::new();

        if let Some(start) = signature.find('(') {
            if let Some(end) = signature[start..].find(')') {
                let params_str = &signature[start + 1..start + end];

                for param_str in params_str.split(',') {
                    let param_str = param_str.trim();
                    if param_str.is_empty() || param_str == "self" {
                        continue;
                    }

                    let (name, param_type, default_value) = parse_python_parameter(param_str);

                    parameters.push(Parameter {
                        name,
                        param_type,
                        optional: default_value.is_some(),
                        default_value,
                    });
                }
            }
        }

        parameters
    }
}

/// Rust extractor implementation
pub struct RustExtractor;

impl LanguageExtractor for RustExtractor {
    fn extract_signature(&self, node: &ASTNode, source_text: &str) -> String {
        let lines = get_node_lines(node, source_text);

        match node.node_type.as_str() {
            "function_item" => self.extract_function_signature(&lines),
            "struct_item" => self.extract_struct_signature(&lines),
            "enum_item" => self.extract_enum_signature(&lines),
            "trait_item" => self.extract_trait_signature(&lines),
            "impl_item" => self.extract_impl_signature(&lines),
            _ => lines.first().unwrap_or(&String::new()).trim().to_string(),
        }
    }

    fn extract_parameters(&self, node: &ASTNode, source_text: &str) -> Vec<Parameter> {
        let signature = self.extract_signature(node, source_text);
        self.parse_rust_parameters(&signature)
    }

    fn extract_return_type(&self, node: &ASTNode, source_text: &str) -> Option<String> {
        let signature = self.extract_signature(node, source_text);

        if let Some(arrow_pos) = signature.find("->") {
            let return_part = &signature[arrow_pos + 2..];
            if let Some(brace_pos) = return_part.find('{') {
                return Some(return_part[..brace_pos].trim().to_string());
            }
            return Some(return_part.trim().to_string());
        }
        None
    }

    fn extract_modifiers(&self, node: &ASTNode, _source_text: &str) -> Vec<String> {
        let mut modifiers = Vec::new();
        let text = &node.text;

        if text.contains("pub ") {
            modifiers.push("pub".to_string());
        }
        if text.contains("async ") {
            modifiers.push("async".to_string());
        }
        if text.contains("unsafe ") {
            modifiers.push("unsafe".to_string());
        }
        if text.contains("const ") {
            modifiers.push("const".to_string());
        }
        if text.contains("static ") {
            modifiers.push("static".to_string());
        }

        modifiers
    }

    fn extract_dependencies(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_exports(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_calls(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_semantic_tags(&self, node: &ASTNode, _source_text: &str) -> Vec<SemanticTag> {
        let mut tags = Vec::new();
        let text_lower = node.text.to_lowercase();

        if text_lower.contains("async") {
            tags.push(SemanticTag::Async);
        }

        if text_lower.contains("#[test]") {
            tags.push(SemanticTag::Test);
        }

        tags
    }

    fn generate_summary(&self, node: &ASTNode, _signature: &str, _source_text: &str) -> String {
        match node.node_type.as_str() {
            "function_item" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Rust function {}", name)
            }
            "struct_item" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Rust struct {}", name)
            }
            "enum_item" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Rust enum {}", name)
            }
            "trait_item" => {
                let name = extract_name_from_text(&node.text).unwrap_or("unnamed".to_string());
                format!("Rust trait {}", name)
            }
            _ => format!("Rust {} element", node.node_type),
        }
    }
}

impl RustExtractor {
    fn extract_function_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("fn ")
                || line.trim_start().starts_with("pub fn ")
                || line.trim_start().starts_with("async fn ")
                || line.trim_start().starts_with("pub async fn ")
            {
                return line.replace(" {", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_struct_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("struct ")
                || line.trim_start().starts_with("pub struct ")
            {
                return line.replace(" {", "").replace(";", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_enum_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("enum ") || line.trim_start().starts_with("pub enum ")
            {
                return line.replace(" {", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_trait_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("trait ")
                || line.trim_start().starts_with("pub trait ")
            {
                return line.replace(" {", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn extract_impl_signature(&self, lines: &[String]) -> String {
        for line in lines {
            if line.trim_start().starts_with("impl ") {
                return line.replace(" {", "").trim().to_string();
            }
        }
        lines.first().unwrap_or(&String::new()).trim().to_string()
    }

    fn parse_rust_parameters(&self, signature: &str) -> Vec<Parameter> {
        let mut parameters = Vec::new();

        if let Some(start) = signature.find('(') {
            if let Some(end) = signature[start..].find(')') {
                let params_str = &signature[start + 1..start + end];

                for param_str in params_str.split(',') {
                    let param_str = param_str.trim();
                    if param_str.is_empty()
                        || param_str == "self"
                        || param_str == "&self"
                        || param_str == "&mut self"
                    {
                        continue;
                    }

                    let (name, param_type, default_value) = parse_rust_parameter(param_str);

                    parameters.push(Parameter {
                        name,
                        param_type,
                        optional: default_value.is_some(),
                        default_value,
                    });
                }
            }
        }

        parameters
    }
}

/// Java extractor (placeholder implementation)
pub struct JavaExtractor;

impl LanguageExtractor for JavaExtractor {
    fn extract_signature(&self, node: &ASTNode, _source_text: &str) -> String {
        // Basic implementation - extract first line
        node.text.lines().next().unwrap_or("").trim().to_string()
    }

    fn extract_parameters(&self, _node: &ASTNode, _source_text: &str) -> Vec<Parameter> {
        Vec::new()
    }

    fn extract_return_type(&self, _node: &ASTNode, _source_text: &str) -> Option<String> {
        None
    }

    fn extract_modifiers(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_dependencies(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_exports(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_calls(&self, _node: &ASTNode, _source_text: &str) -> Vec<String> {
        Vec::new()
    }

    fn extract_semantic_tags(&self, _node: &ASTNode, _source_text: &str) -> Vec<SemanticTag> {
        Vec::new()
    }

    fn generate_summary(&self, node: &ASTNode, _signature: &str, _source_text: &str) -> String {
        format!("Java {} element", node.node_type)
    }
}

// Helper functions

fn get_node_lines(node: &ASTNode, source_text: &str) -> Vec<String> {
    let lines: Vec<&str> = source_text.lines().collect();
    let start_row = node.start_point.row as usize;
    let end_row = (node.end_point.row as usize).min(lines.len());

    lines[start_row..=end_row]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

fn extract_name_from_text(text: &str) -> Option<String> {
    // Simple name extraction - look for identifier after keywords
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
    ];

    for keyword in &keywords {
        if let Some(pos) = text.find(keyword) {
            let after_keyword = &text[pos + keyword.len()..];
            if let Some(name) = after_keyword.split_whitespace().next() {
                return Some(name.trim_matches(['(', ':', '<', '{', '=']).to_string());
            }
        }
    }

    None
}

fn parse_parameter(param_str: &str) -> (String, Option<String>, Option<String>) {
    // Parse TypeScript/JavaScript parameter: "name: type = defaultValue"
    let parts: Vec<&str> = param_str.split('=').collect();
    let (name_type, default_value) = if parts.len() > 1 {
        (parts[0].trim(), Some(parts[1].trim().to_string()))
    } else {
        (param_str.trim(), None)
    };

    let type_parts: Vec<&str> = name_type.split(':').collect();
    let (name, param_type) = if type_parts.len() > 1 {
        (
            type_parts[0].trim().trim_matches('?').to_string(),
            Some(type_parts[1].trim().to_string()),
        )
    } else {
        (name_type.trim().trim_matches('?').to_string(), None)
    };

    (name, param_type, default_value)
}

fn parse_python_parameter(param_str: &str) -> (String, Option<String>, Option<String>) {
    // Parse Python parameter: "name: type = defaultValue" or "name = defaultValue"
    let parts: Vec<&str> = param_str.split('=').collect();
    let (name_type, default_value) = if parts.len() > 1 {
        (parts[0].trim(), Some(parts[1].trim().to_string()))
    } else {
        (param_str.trim(), None)
    };

    let type_parts: Vec<&str> = name_type.split(':').collect();
    let (name, param_type) = if type_parts.len() > 1 {
        (
            type_parts[0].trim().to_string(),
            Some(type_parts[1].trim().to_string()),
        )
    } else {
        (name_type.trim().to_string(), None)
    };

    (name, param_type, default_value)
}

fn parse_rust_parameter(param_str: &str) -> (String, Option<String>, Option<String>) {
    // Parse Rust parameter: "name: type" (no default values in function signatures)
    let type_parts: Vec<&str> = param_str.split(':').collect();
    let (name, param_type) = if type_parts.len() > 1 {
        (
            type_parts[0].trim().to_string(),
            Some(type_parts[1].trim().to_string()),
        )
    } else {
        (param_str.trim().to_string(), None)
    };

    (name, param_type, None)
}
