/**
 * Index file for signature extractors
 * Exports all language-specific signature extractors
 */

// Tier 1 extractors (Enterprise Priority)
export { TypeScriptExtractor } from "./typescript-extractor.js";
export { JavaScriptExtractor } from "./javascript-extractor.js";
export { PythonExtractor } from "./python-extractor.js";
export { JavaExtractor } from "./java-extractor.js";
export { CSharpExtractor } from "./csharp-extractor.js";
export { GoExtractor } from "./go-extractor.js";

// Tier 2 extractors (Developer Priority)
export { RustExtractor } from "./rust-extractor.js";
export { CppExtractor } from "./cpp-extractor.js";
export { PhpExtractor } from "./php-extractor.js";
export { RubyExtractor } from "./ruby-extractor.js";
export { KotlinExtractor } from "./kotlin-extractor.js";

// Tier 3 extractors (Specialized Priority)
export { SwiftExtractor } from "./swift-extractor.js";
export { DartExtractor } from "./dart-extractor.js";
export { ScalaExtractor } from "./scala-extractor.js";
export { LuaExtractor } from "./lua-extractor.js";
export { BashExtractor } from "./bash-extractor.js";

// Utilities
export { ExtractionUtils } from "./extraction-utils.js";
