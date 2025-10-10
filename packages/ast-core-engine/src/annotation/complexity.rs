//! Complexity analysis functionality for annotated AST nodes

use super::types::ComplexityMetrics;
use crate::types::ASTNode;
// HashMap removed - not currently used

/// Analyzes code complexity metrics for AST nodes
pub struct ComplexityAnalyzer;

impl ComplexityAnalyzer {
    /// Create a new complexity analyzer
    pub fn new() -> Self {
        Self
    }

    /// Analyze complexity metrics for a single AST node
    pub fn analyze_node(&self, node: &ASTNode, source_text: &str) -> ComplexityMetrics {
        let cyclomatic = self.calculate_cyclomatic_complexity(node);
        let cognitive = self.calculate_cognitive_complexity(node, source_text);
        let max_nesting = self.calculate_nesting_depth(node);
        let decision_points = self.count_decision_points(node);

        // Create breakdown map
        let mut breakdown = std::collections::HashMap::new();
        breakdown.insert("branches".to_string(), self.count_branches(node));
        breakdown.insert("loops".to_string(), self.count_loops(node));
        breakdown.insert("returns".to_string(), self.count_return_statements(node));

        // Determine category
        let category = match cyclomatic {
            1..=10 => super::types::ComplexityCategory::Low,
            11..=20 => super::types::ComplexityCategory::Medium,
            21..=50 => super::types::ComplexityCategory::High,
            _ => super::types::ComplexityCategory::VeryHigh,
        };

        ComplexityMetrics {
            cyclomatic,
            cognitive,
            max_nesting,
            decision_points,
            breakdown,
            category,
        }
    }

    /// Calculate cyclomatic complexity (number of linearly independent paths)
    fn calculate_cyclomatic_complexity(&self, node: &ASTNode) -> u32 {
        let mut complexity = 1; // Base complexity

        // Count decision points
        complexity += self.count_decision_points(node);

        complexity
    }

    /// Calculate cognitive complexity (how difficult code is to understand)
    fn calculate_cognitive_complexity(&self, node: &ASTNode, _source_text: &str) -> u32 {
        let mut complexity = 0;
        let nesting_level = 0;

        self.calculate_cognitive_complexity_recursive(node, nesting_level, &mut complexity);

        complexity
    }

    /// Recursive helper for cognitive complexity calculation (text-based)
    fn calculate_cognitive_complexity_recursive(
        &self,
        node: &ASTNode,
        nesting_level: u32,
        complexity: &mut u32,
    ) {
        match node.node_type.as_str() {
            // Control flow structures (+1, +nesting)
            "if_statement" | "if_expression" => {
                *complexity += 1 + nesting_level;
            }
            "else_clause" | "else_if_clause" => {
                *complexity += 1;
            }
            "switch_statement" | "match_expression" => {
                *complexity += 1 + nesting_level;
            }
            "for_statement" | "for_in_statement" | "for_of_statement" | "while_statement"
            | "do_statement" | "loop_expression" => {
                *complexity += 1 + nesting_level;
            }
            "try_statement" | "catch_clause" | "finally_clause" => {
                *complexity += 1 + nesting_level;
            }
            // Logical operators (&&, ||) in conditions
            "binary_expression" => {
                if self.is_logical_operator(node) {
                    *complexity += 1;
                }
            }
            _ => {}
        }

        // For nested functions, add to nesting but don't traverse (simplified approach)
        if matches!(
            node.node_type.as_str(),
            "function_declaration"
                | "function_expression"
                | "arrow_function"
                | "method_definition"
                | "function_item"
        ) {
            *complexity += nesting_level;
        }
    }

    /// Calculate maximum nesting depth
    fn calculate_nesting_depth(&self, node: &ASTNode) -> u32 {
        self.calculate_nesting_depth_recursive(node, 0)
    }

    /// Recursive helper for nesting depth calculation (simplified text-based)
    fn calculate_nesting_depth_recursive(&self, node: &ASTNode, current_depth: u32) -> u32 {
        if self.increases_nesting(node) {
            current_depth + 1
        } else {
            current_depth
        }
    }

    /// Calculate line count for a function/method
    #[allow(dead_code)]
    fn calculate_line_count(&self, node: &ASTNode) -> u32 {
        node.end_point.row - node.start_point.row + 1
    }

    /// Calculate parameter count for a function
    #[allow(dead_code)]
    fn calculate_parameter_count(&self, node: &ASTNode) -> u32 {
        match node.node_type.as_str() {
            "function_declaration"
            | "function_expression"
            | "arrow_function"
            | "method_definition"
            | "function_item" => self.count_parameters_in_node(node),
            _ => 0,
        }
    }

    /// Count return statements in the node (text-based)
    fn count_return_statements(&self, node: &ASTNode) -> u32 {
        if node.node_type == "return_statement" {
            1
        } else {
            // Count return keywords in text as approximation
            node.text.matches("return ").count() as u32
        }
    }

    /// Count branch statements (break, continue, goto, etc.) (text-based)
    fn count_branches(&self, node: &ASTNode) -> u32 {
        if matches!(
            node.node_type.as_str(),
            "break_statement" | "continue_statement" | "goto_statement"
        ) {
            1
        } else {
            // Count branch keywords in text as approximation
            let text = &node.text;
            (text.matches("break").count() + text.matches("continue").count()) as u32
        }
    }

    /// Count loop constructs (text-based)
    fn count_loops(&self, node: &ASTNode) -> u32 {
        if matches!(
            node.node_type.as_str(),
            "for_statement"
                | "for_in_statement"
                | "for_of_statement"
                | "while_statement"
                | "do_statement"
                | "loop_expression"
        ) {
            1
        } else {
            // Count loop keywords in text as approximation
            let text = &node.text;
            (text.matches("for ").count()
                + text.matches("while ").count()
                + text.matches("loop ").count()) as u32
        }
    }

    /// Count decision points for cyclomatic complexity (text-based)
    fn count_decision_points(&self, node: &ASTNode) -> u32 {
        let mut count = 0;

        match node.node_type.as_str() {
            "if_statement" | "if_expression" => count += 1,
            "else_if_clause" => count += 1,
            "switch_statement" | "match_expression" => {
                // Count case statements in text
                count += self.count_case_statements(node);
            }
            "for_statement" | "for_in_statement" | "for_of_statement" | "while_statement"
            | "do_statement" | "loop_expression" => count += 1,
            "try_statement" => count += 1,
            "catch_clause" => count += 1,
            "conditional_expression" | "ternary_expression" => count += 1,
            "binary_expression" => {
                if self.is_logical_operator(node) {
                    count += 1;
                }
            }
            _ => {}
        }

        // Add text-based analysis for decision keywords
        let text = &node.text;
        count += (text.matches(" if ").count()
            + text.matches("else if").count()
            + text.matches("&&").count()
            + text.matches("||").count()) as u32;

        count
    }

    /// Count case statements in switch/match expressions (text-based)
    fn count_case_statements(&self, node: &ASTNode) -> u32 {
        // Count case keywords in text
        let text = &node.text;
        let count = (text.matches("case ").count()
            + text.matches("default:").count()
            + text.matches(" => ").count()) as u32;

        // If no cases found, assume at least 1 for the switch itself
        if count == 0 {
            1
        } else {
            count
        }
    }

    /// Check if node represents a logical operator (&&, ||)
    fn is_logical_operator(&self, node: &ASTNode) -> bool {
        node.text.contains("&&")
            || node.text.contains("||")
            || node.text.contains("and")
            || node.text.contains("or")
    }

    /// Check if node type increases nesting level
    fn increases_nesting(&self, node: &ASTNode) -> bool {
        match node.node_type.as_str() {
            // Control flow structures
            "if_statement" | "if_expression" | "else_clause" | "else_if_clause" |
            "switch_statement" | "match_expression" | "case_clause" | "switch_case" | "match_arm" |
            "for_statement" | "for_in_statement" | "for_of_statement" |
            "while_statement" | "do_statement" | "loop_expression" |
            "try_statement" | "catch_clause" | "finally_clause" |
            // Block structures
            "block" | "compound_statement" |
            // Function definitions
            "function_declaration" | "function_expression" | "arrow_function" |
            "method_definition" | "function_item" |
            // Class and other structured definitions
            "class_declaration" | "struct_item" | "enum_item" | "trait_item" | "impl_item" => true,
            _ => false
        }
    }

    /// Count parameters in a function node (text-based)
    #[allow(dead_code)]
    fn count_parameters_in_node(&self, node: &ASTNode) -> u32 {
        // Extract parameters from function signature in text
        let text = &node.text;

        if let Some(start) = text.find('(') {
            if let Some(end) = text[start..].find(')') {
                let params_str = &text[start + 1..start + end];
                if params_str.trim().is_empty() {
                    return 0;
                }
                // Count commas + 1, but handle edge cases
                let comma_count = params_str.matches(',').count() as u32;
                if comma_count == 0 && !params_str.trim().is_empty() {
                    1 // Single parameter
                } else {
                    comma_count + 1
                }
            } else {
                0
            }
        } else {
            0
        }
    }
}

impl Default for ComplexityAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

/// Complexity classification utilities
pub struct ComplexityClassifier;

impl ComplexityClassifier {
    /// Classify cyclomatic complexity level
    pub fn classify_cyclomatic(complexity: u32) -> &'static str {
        match complexity {
            1..=10 => "Low",
            11..=20 => "Moderate",
            21..=50 => "High",
            _ => "Very High",
        }
    }

    /// Classify cognitive complexity level
    pub fn classify_cognitive(complexity: u32) -> &'static str {
        match complexity {
            0..=5 => "Low",
            6..=15 => "Moderate",
            16..=30 => "High",
            _ => "Very High",
        }
    }

    /// Classify nesting depth level
    pub fn classify_nesting_depth(depth: u32) -> &'static str {
        match depth {
            0..=3 => "Low",
            4..=6 => "Moderate",
            7..=10 => "High",
            _ => "Very High",
        }
    }

    /// Classify line count level
    pub fn classify_line_count(lines: u32) -> &'static str {
        match lines {
            1..=20 => "Small",
            21..=50 => "Medium",
            51..=100 => "Large",
            _ => "Very Large",
        }
    }

    /// Classify parameter count level
    pub fn classify_parameter_count(count: u32) -> &'static str {
        match count {
            0..=3 => "Low",
            4..=7 => "Moderate",
            8..=12 => "High",
            _ => "Very High",
        }
    }

    /// Get overall complexity assessment
    pub fn assess_overall_complexity(metrics: &ComplexityMetrics) -> &'static str {
        let cyclomatic_score = match metrics.cyclomatic {
            1..=10 => 1,
            11..=20 => 2,
            21..=50 => 3,
            _ => 4,
        };

        let cognitive_score = match metrics.cognitive {
            0..=5 => 1,
            6..=15 => 2,
            16..=30 => 3,
            _ => 4,
        };

        let nesting_score = match metrics.max_nesting {
            0..=3 => 1,
            4..=6 => 2,
            7..=10 => 3,
            _ => 4,
        };

        let avg_score = (cyclomatic_score + cognitive_score + nesting_score) as f32 / 3.0;

        match avg_score {
            x if x <= 1.5 => "Low Complexity",
            x if x <= 2.5 => "Moderate Complexity",
            x if x <= 3.5 => "High Complexity",
            _ => "Very High Complexity",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Point;

    fn create_test_node(node_type: &str, text: &str, children: Vec<String>) -> ASTNode {
        ASTNode {
            id: format!("test-{}-{}", node_type, text),
            node_type: node_type.to_string(),
            start_byte: 0,
            end_byte: text.len() as u32,
            text: text.to_string(),
            language: "test".to_string(),
            complexity: 1,
            parent_id: None,
            start_point: Point { row: 0, column: 0 },
            end_point: Point {
                row: 0,
                column: text.len() as u32,
            },
            children_ids: children,
        }
    }

    #[test]
    fn test_simple_function_complexity() {
        let analyzer = ComplexityAnalyzer::new();

        let node = create_test_node(
            "function_declaration",
            "function simple() { return 42; }",
            vec![],
        );

        let metrics = analyzer.analyze_node(&node, "function simple() { return 42; }");

        assert_eq!(metrics.cyclomatic, 1);
        assert_eq!(metrics.decision_points, 0); // No children parsed in this test
                                                // breakdown is always a valid Vec, no need to assert >= 0
    }

    #[test]
    fn test_if_statement_complexity() {
        let analyzer = ComplexityAnalyzer::new();

        let if_child = create_test_node("if_statement", "if (x > 0)", vec![]);
        let if_child_id = if_child.id.clone();
        let node = create_test_node(
            "function_declaration",
            "function test() { if (x > 0) return x; }",
            vec![if_child_id],
        );

        let metrics = analyzer.analyze_node(&node, "");

        assert!(metrics.cyclomatic > 1);
    }

    #[test]
    fn test_complexity_classification() {
        assert_eq!(ComplexityClassifier::classify_cyclomatic(5), "Low");
        assert_eq!(ComplexityClassifier::classify_cyclomatic(15), "Moderate");
        assert_eq!(ComplexityClassifier::classify_cyclomatic(25), "High");
        assert_eq!(ComplexityClassifier::classify_cyclomatic(55), "Very High");
    }
}
