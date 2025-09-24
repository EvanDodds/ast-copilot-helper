import type { ASTNode } from "../../parser/types.js";
import type { SignatureExtractor, Parameter } from "../types.js";
import { ExtractionUtils } from "./extraction-utils.js";

/**
 * Python-specific signature extractor
 * Handles Python function/method/class signatures including decorators
 */
export class PythonExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_definition":
        return this.extractPythonFunction(node, sourceLines);

      case "method":
      case "method_definition":
        return this.extractPythonMethod(node, sourceLines);

      case "class":
      case "class_definition":
        return this.extractPythonClass(node, sourceLines);

      default:
        return this.extractGenericSignature(node, sourceLines);
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(" ");

    // Find parameter list in parentheses
    const paramMatch = signature.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]) {
      return [];
    }

    const paramString = paramMatch[1].trim();
    if (!paramString) {
      return [];
    }

    return this.parseParameters(paramString);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines[0] || "";

    // Look for Python 3.5+ type annotations: def func() -> ReturnType:
    const returnTypeMatch = signature.match(/->\s*([^:]+):/);
    if (returnTypeMatch && returnTypeMatch[1]) {
      return returnTypeMatch[1].trim();
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, _sourceText: string): string[] {
    // Python doesn't have explicit access modifiers like TypeScript
    // but we can infer from naming conventions
    const modifiers: string[] = [];

    if (node.name) {
      // Private convention: __name
      if (node.name.startsWith("__") && node.name.endsWith("__")) {
        modifiers.push("magic");
      } else if (node.name.startsWith("__")) {
        modifiers.push("private");
      } else if (node.name.startsWith("_")) {
        modifiers.push("protected");
      } else {
        modifiers.push("public");
      }
    }

    return modifiers;
  }

  extractDocumentation(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Look for docstrings (first string literal in function/class body)
    for (let i = 1; i < sourceLines.length; i++) {
      const line = sourceLines[i]?.trim();
      if (!line) {
        continue;
      }

      // Triple quoted strings
      if (line.startsWith('"""') || line.startsWith("'''")) {
        const quoteType = line.startsWith('"""') ? '"""' : "'''";
        const docstring = line.substring(3);

        // Single line docstring
        if (line.endsWith(quoteType) && line.length > 6) {
          return docstring.substring(0, docstring.length - 3).trim();
        }

        // Multi-line docstring - simplified for now
        return docstring.trim();
      }

      // Single quoted strings
      if (
        (line.startsWith('"') && line.endsWith('"')) ||
        (line.startsWith("'") && line.endsWith("'"))
      ) {
        return line.substring(1, line.length - 1);
      }

      // If we hit non-string content, stop looking
      if (line && !line.startsWith("#")) {
        break;
      }
    }

    return null;
  }

  canHandle(language: string): boolean {
    return (
      language.toLowerCase() === "python" || language.toLowerCase() === "py"
    );
  }

  private extractPythonFunction(node: ASTNode, sourceLines: string[]): string {
    const line = sourceLines[0] || "";

    // Extract decorators if present
    const decorators = this.extractDecorators(sourceLines);
    const decoratorStr =
      decorators.length > 0 ? decorators.join(" ") + " " : "";

    // Clean up the function signature
    const funcMatch = line.match(
      /(def\s+\w+\s*\([^)]*\)(?:\s*->\s*[^:]+)?)\s*:/,
    );
    if (funcMatch && funcMatch[1]) {
      return decoratorStr + funcMatch[1].trim();
    }

    return decoratorStr + (node.name ? `def ${node.name}()` : "def unnamed()");
  }

  private extractPythonMethod(node: ASTNode, sourceLines: string[]): string {
    // Methods are similar to functions but may have self parameter
    return this.extractPythonFunction(node, sourceLines);
  }

  private extractPythonClass(node: ASTNode, sourceLines: string[]): string {
    const line = sourceLines[0] || "";

    // Extract decorators if present
    const decorators = this.extractDecorators(sourceLines);
    const decoratorStr =
      decorators.length > 0 ? decorators.join(" ") + " " : "";

    // Clean up the class signature
    const classMatch = line.match(/(class\s+\w+(?:\s*\([^)]*\))?)\s*:/);
    if (classMatch && classMatch[1]) {
      return decoratorStr + classMatch[1].trim();
    }

    return decoratorStr + (node.name ? `class ${node.name}` : "class Unnamed");
  }

  private extractGenericSignature(
    node: ASTNode,
    sourceLines: string[],
  ): string {
    const line = sourceLines[0] || "";
    return line.trim() || node.name || node.type;
  }

  private extractDecorators(sourceLines: string[]): string[] {
    const decorators: string[] = [];

    for (const line of sourceLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("@")) {
        decorators.push(trimmed);
      } else if (trimmed.startsWith("def ") || trimmed.startsWith("class ")) {
        break; // Stop at function/class definition
      }
    }

    return decorators;
  }

  private parseParameters(paramString: string): Parameter[] {
    const parameters: Parameter[] = [];
    const params = paramString.split(",");

    for (const param of params) {
      const cleaned = param.trim();
      if (!cleaned || cleaned.startsWith("*")) {
        continue;
      }

      // Parse parameter with type annotation and default value
      const parts = cleaned.split("=");
      const nameTypePart = parts[0]?.trim();
      if (!nameTypePart) {
        continue;
      }

      const defaultValue = parts[1]?.trim();

      // Split name and type annotation
      const typeParts = nameTypePart.split(":");
      const name = typeParts[0]?.trim();
      if (!name) {
        continue;
      }

      const type = typeParts[1]?.trim();

      if (name) {
        parameters.push({
          name,
          type: type || undefined,
          optional: defaultValue !== undefined,
          defaultValue: defaultValue,
        });
      }
    }

    return parameters;
  }
}
