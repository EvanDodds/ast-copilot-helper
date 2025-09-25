/**
 * Enhanced Node Classification System
 *
 * Maps raw Tree-sitter node types to normalized NodeType enum values
 * across different programming languages with extensible architecture.
 * Enhanced with advanced pattern matching, context-aware classification,
 * and performance optimization.
 */

import { NodeType } from "./ast-schema";

/**
 * Raw node data from Tree-sitter or other parsers
 */
export interface RawNodeData {
  /** Raw node type from parser (e.g., 'function_declaration', 'class_definition') */
  type: string;
  /** Node name or identifier if available */
  name?: string;
  /** Language being parsed */
  language: string;
  /** Any additional parser-specific properties */
  properties?: Record<string, unknown>;
  /** Child nodes for context-aware classification */
  children?: RawNodeData[];
  /** Parent node for context */
  parent?: RawNodeData;
  /** Optional position information for advanced context analysis */
  position?: {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  };
  /** Optional text content for semantic analysis */
  text?: string;
  /** Depth in the AST for hierarchical classification */
  depth?: number;
}

/**
 * Enhanced classification result with confidence and metadata
 */
export interface ClassificationResult {
  /** Normalized node type */
  nodeType: NodeType;
  /** Confidence level (0-1) in the classification */
  confidence: number;
  /** Reason for classification choice */
  reason: string;
  /** Alternative classifications considered */
  alternatives?: Array<{
    nodeType: NodeType;
    confidence: number;
    reason: string;
  }>;
  /** Enhanced metadata about the classification process */
  metadata?: {
    /** Time taken for classification (ms) */
    processTime?: number;
    /** Classification method used */
    method: "direct" | "pattern" | "context" | "fuzzy" | "fallback";
    /** Pattern or rule that matched */
    matchedRule?: string;
    /** Context depth analyzed */
    contextDepth?: number;
    /** Whether result was cached */
    cached?: boolean;
  };
  /** Quality score for the classification (0-1) */
  quality?: number;
}

/**
 * Enhanced language-specific mapping configuration
 */
export interface LanguageMapping {
  /** Direct type mappings */
  directMappings: Record<string, NodeType>;
  /** Enhanced pattern-based mappings with advanced features */
  patternMappings: Array<{
    pattern: RegExp;
    nodeType: NodeType;
    priority: number;
    /** Case-insensitive matching */
    caseInsensitive?: boolean;
    /** Require specific context for pattern match */
    contextRequired?: boolean;
    /** Description of the pattern for debugging */
    description?: string;
  }>;
  /** Context-aware classification rules */
  contextRules: Array<ContextRule>;
  /** Fuzzy matching rules for similar node types */
  fuzzyRules?: Array<{
    /** Source node types to match against */
    sourceTypes: string[];
    /** Target node type to classify as */
    nodeType: NodeType;
    /** Similarity threshold (0-1) */
    threshold: number;
    /** Priority for fuzzy matching */
    priority: number;
  }>;
  /** Compound pattern rules for complex node structures */
  compoundRules?: Array<{
    /** Multiple patterns that must all match */
    patterns: RegExp[];
    /** Node type when all patterns match */
    nodeType: NodeType;
    /** Priority for compound matching */
    priority: number;
    /** Description for debugging */
    description: string;
  }>;
  /** Default fallback for unknown types */
  defaultFallback: NodeType;
  /** Cache configuration for this language */
  cacheConfig?: {
    /** Enable caching for this language */
    enabled: boolean;
    /** Cache TTL in milliseconds */
    ttl: number;
  };
}

/**
 * Enhanced context-aware classification rule
 */
export interface ContextRule {
  /** Condition that must be met */
  condition: (node: RawNodeData, context: ClassificationContext) => boolean;
  /** Node type to assign when condition is met */
  nodeType: NodeType;
  /** Priority (higher = applied first) */
  priority: number;
  /** Description of the rule */
  description: string;
  /** Maximum depth to analyze for context (0 = immediate parent only) */
  maxDepth?: number;
  /** Minimum confidence this rule provides */
  minConfidence?: number;
  /** Whether this rule requires sibling analysis */
  requiresSiblings?: boolean;
  /** Cache key generator for this rule */
  cacheKey?: (node: RawNodeData, context: ClassificationContext) => string;
}

/**
 * Enhanced context information for classification
 */
export interface ClassificationContext {
  /** Current node being classified */
  node: RawNodeData;
  /** Parent node if available */
  parent?: RawNodeData;
  /** Sibling nodes */
  siblings: RawNodeData[];
  /** Language being parsed */
  language: string;
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
  /** Ancestor nodes for deep context analysis */
  ancestors?: RawNodeData[];
  /** File path for file-based context */
  filePath?: string;
  /** Scope information (class, function, module, etc.) */
  scope?: {
    type: "global" | "module" | "class" | "function" | "block";
    name?: string;
    depth: number;
  };
  /** Semantic context derived from surrounding code */
  semanticContext?: {
    /** Inside class definition */
    inClass?: boolean;
    /** Inside function definition */
    inFunction?: boolean;
    /** Inside control structure */
    inControl?: boolean;
    /** Variable/parameter context */
    isDeclaration?: boolean;
  };
}

/**
 * Enhanced classification statistics and accuracy metrics
 */
export interface ClassificationStats {
  /** Total nodes classified */
  totalClassified: number;
  /** Classifications by language */
  byLanguage: Record<string, number>;
  /** Classifications by node type */
  byNodeType: Record<string, number>;
  /** Average confidence score */
  averageConfidence: number;
  /** Number of fallback classifications used */
  fallbackUsage: number;
  /** Accuracy metrics (if validation data available) */
  accuracy?: {
    correct: number;
    total: number;
    percentage: number;
  };
  /** Performance metrics */
  performance: {
    /** Average classification time in milliseconds */
    averageTime: number;
    /** Total classification time */
    totalTime: number;
    /** Cache hit ratio (0-1) */
    cacheHitRatio: number;
    /** Peak memory usage during classification */
    peakMemoryUsage?: number;
  };
  /** Method usage statistics */
  methodUsage: {
    direct: number;
    pattern: number;
    context: number;
    fuzzy: number;
    fallback: number;
  };
  /** Error and warning counts */
  issues: {
    errors: number;
    warnings: number;
    lowConfidence: number;
  };
}

/**
 * Node Classifier
 *
 * Provides intelligent classification of raw parser nodes into normalized
 * AST node types with language-specific mappings and extensible architecture.
 */
export class NodeClassifier {
  private static readonly LANGUAGE_MAPPINGS: Record<string, LanguageMapping> = {
    typescript: {
      directMappings: {
        // Top-level constructs
        source_file: NodeType.FILE,
        module: NodeType.MODULE,
        namespace_declaration: NodeType.NAMESPACE,

        // Class-related
        class_declaration: NodeType.CLASS,
        interface_declaration: NodeType.INTERFACE,
        enum_declaration: NodeType.ENUM,
        type_alias_declaration: NodeType.TYPE_ALIAS,

        // Function-related
        function_declaration: NodeType.FUNCTION,
        method_definition: NodeType.METHOD,
        constructor_definition: NodeType.CONSTRUCTOR,
        get_accessor: NodeType.GETTER,
        set_accessor: NodeType.SETTER,
        arrow_function: NodeType.ARROW_FUNCTION,
        function_expression: NodeType.FUNCTION,

        // Variable-related
        variable_declarator: NodeType.VARIABLE,
        parameter: NodeType.PARAMETER,
        property_declaration: NodeType.PROPERTY,
        property_signature: NodeType.PROPERTY,
        public_field_definition: NodeType.FIELD,
        private_field_definition: NodeType.FIELD,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        for_in_statement: NodeType.FOR_LOOP,
        for_of_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Imports and exports
        import_statement: NodeType.IMPORT,
        import_declaration: NodeType.IMPORT,
        export_statement: NodeType.EXPORT,
        export_declaration: NodeType.EXPORT,

        // Other constructs
        decorator: NodeType.DECORATOR,
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        template_string: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        {
          pattern: /^.*function.*$/,
          nodeType: NodeType.FUNCTION,
          priority: 2,
          description: "Function-related patterns",
          caseInsensitive: true,
        },
        {
          pattern: /^.*method.*$/,
          nodeType: NodeType.METHOD,
          priority: 2,
          description: "Method-related patterns",
        },
        {
          pattern: /^.*variable.*$/,
          nodeType: NodeType.VARIABLE,
          priority: 1,
          description: "Variable-related patterns",
        },
        {
          pattern: /^.*class.*$/,
          nodeType: NodeType.CLASS,
          priority: 3,
          description: "Class-related patterns",
        },
        {
          pattern: /^.*interface.*$/,
          nodeType: NodeType.INTERFACE,
          priority: 3,
          description: "Interface-related patterns",
        },
        {
          pattern: /^.*enum.*$/,
          nodeType: NodeType.ENUM,
          priority: 2,
          description: "Enum-related patterns",
        },
      ],
      fuzzyRules: [
        {
          sourceTypes: ["func_declaration", "function_def", "func_def"],
          nodeType: NodeType.FUNCTION,
          threshold: 0.7,
          priority: 1,
        },
        {
          sourceTypes: ["class_def", "class_stmt", "class_body"],
          nodeType: NodeType.CLASS,
          threshold: 0.8,
          priority: 2,
        },
        {
          sourceTypes: ["var_declaration", "variable_def", "let_declaration"],
          nodeType: NodeType.VARIABLE,
          threshold: 0.7,
          priority: 1,
        },
      ],
      compoundRules: [
        {
          patterns: [/constructor/, /function/],
          nodeType: NodeType.CONSTRUCTOR,
          priority: 5,
          description: "Constructor function patterns",
        },
        {
          patterns: [/async/, /function/],
          nodeType: NodeType.FUNCTION,
          priority: 4,
          description: "Async function patterns",
        },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "class_declaration",
          nodeType: NodeType.CLASS,
          priority: 10,
          description: "TypeScript class name identifier",
          maxDepth: 2,
          minConfidence: 0.95,
        },
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_declaration",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "TypeScript function name identifier",
          maxDepth: 1,
          minConfidence: 0.9,
        },
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            Boolean(context.semanticContext?.inClass) &&
            Boolean(context.parent?.type?.includes("method")),
          nodeType: NodeType.METHOD,
          priority: 12,
          description: "Method identifier in class context",
          requiresSiblings: true,
        },
      ],
      defaultFallback: NodeType.VARIABLE,
      cacheConfig: {
        enabled: true,
        ttl: 300000, // 5 minutes
      },
    },

    javascript: {
      directMappings: {
        // Top-level constructs
        program: NodeType.FILE,
        module: NodeType.MODULE,

        // Class-related
        class_declaration: NodeType.CLASS,
        class_expression: NodeType.CLASS,

        // Function-related
        function_declaration: NodeType.FUNCTION,
        function_expression: NodeType.FUNCTION,
        method_definition: NodeType.METHOD,
        arrow_function: NodeType.ARROW_FUNCTION,

        // Variable-related
        variable_declarator: NodeType.VARIABLE,
        parameter: NodeType.PARAMETER,
        property_definition: NodeType.PROPERTY,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        for_in_statement: NodeType.FOR_LOOP,
        for_of_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Imports and exports
        import_statement: NodeType.IMPORT,
        export_statement: NodeType.EXPORT,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        template_string: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*variable.*$/, nodeType: NodeType.VARIABLE, priority: 1 },
      ],
      contextRules: [],
      defaultFallback: NodeType.VARIABLE,
    },

    python: {
      directMappings: {
        // Top-level constructs
        module: NodeType.FILE,

        // Class-related
        class_definition: NodeType.CLASS,

        // Function-related
        function_definition: NodeType.FUNCTION,
        lambda: NodeType.ARROW_FUNCTION,

        // Variable-related
        assignment: NodeType.VARIABLE,
        parameter: NodeType.PARAMETER,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        with_statement: NodeType.TRY_CATCH, // Similar resource handling
        try_statement: NodeType.TRY_CATCH,

        // Imports and exports
        import_statement: NodeType.IMPORT,
        import_from_statement: NodeType.IMPORT,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        decorator: NodeType.DECORATOR,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*def.*$/, nodeType: NodeType.FUNCTION, priority: 2 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_definition",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Function name in Python def",
        },
        {
          condition: (node, context) =>
            node.type === "assignment" &&
            context.parent?.type === "class_definition",
          nodeType: NodeType.FIELD,
          priority: 8,
          description: "Class attribute assignment",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    // Tier 1 Enterprise Languages
    java: {
      directMappings: {
        // Top-level constructs
        program: NodeType.FILE,
        compilation_unit: NodeType.FILE,
        package_declaration: NodeType.NAMESPACE,

        // Class-related
        class_declaration: NodeType.CLASS,
        interface_declaration: NodeType.INTERFACE,
        enum_declaration: NodeType.ENUM,
        annotation_type_declaration: NodeType.INTERFACE,

        // Method-related
        method_declaration: NodeType.METHOD,
        constructor_declaration: NodeType.CONSTRUCTOR,

        // Variable-related
        local_variable_declaration: NodeType.VARIABLE,
        field_declaration: NodeType.FIELD,
        formal_parameter: NodeType.PARAMETER,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        enhanced_for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Imports and packages
        import_declaration: NodeType.IMPORT,

        // Other constructs
        annotation: NodeType.DECORATOR,
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        {
          pattern: /^.*interface.*$/,
          nodeType: NodeType.INTERFACE,
          priority: 1,
        },
        { pattern: /^.*field.*$/, nodeType: NodeType.FIELD, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "class_declaration",
          nodeType: NodeType.CLASS,
          priority: 10,
          description: "Java class name identifier",
        },
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "method_declaration",
          nodeType: NodeType.METHOD,
          priority: 10,
          description: "Java method name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    csharp: {
      directMappings: {
        // Top-level constructs
        compilation_unit: NodeType.FILE,
        namespace_declaration: NodeType.NAMESPACE,
        using_directive: NodeType.IMPORT,

        // Class-related
        class_declaration: NodeType.CLASS,
        interface_declaration: NodeType.INTERFACE,
        struct_declaration: NodeType.CLASS,
        enum_declaration: NodeType.ENUM,

        // Method-related
        method_declaration: NodeType.METHOD,
        constructor_declaration: NodeType.CONSTRUCTOR,
        property_declaration: NodeType.PROPERTY,
        accessor_declaration: NodeType.GETTER,

        // Variable-related
        variable_declaration: NodeType.VARIABLE,
        field_declaration: NodeType.FIELD,
        parameter: NodeType.PARAMETER,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        foreach_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Other constructs
        attribute: NodeType.DECORATOR,
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
        interpolated_string_expression: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*property.*$/, nodeType: NodeType.PROPERTY, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "class_declaration",
          nodeType: NodeType.CLASS,
          priority: 10,
          description: "C# class name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    go: {
      directMappings: {
        // Top-level constructs
        source_file: NodeType.FILE,
        package_clause: NodeType.NAMESPACE,

        // Type-related
        type_declaration: NodeType.CLASS,
        struct_type: NodeType.CLASS,
        interface_type: NodeType.INTERFACE,

        // Function-related
        function_declaration: NodeType.FUNCTION,
        method_declaration: NodeType.METHOD,

        // Variable-related
        var_declaration: NodeType.VARIABLE,
        const_declaration: NodeType.VARIABLE,
        parameter_declaration: NodeType.PARAMETER,
        field_declaration: NodeType.FIELD,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        range_clause: NodeType.FOR_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        type_switch_statement: NodeType.SWITCH_STATEMENT,

        // Imports and packages
        import_declaration: NodeType.IMPORT,

        // Other constructs
        comment: NodeType.COMMENT,
        raw_string_literal: NodeType.STRING_LITERAL,
        interpreted_string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*func.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*struct.*$/, nodeType: NodeType.CLASS, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_declaration",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Go function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    // Tier 2 Developer Priority Languages
    rust: {
      directMappings: {
        // Top-level constructs
        source_file: NodeType.FILE,
        mod_item: NodeType.MODULE,
        use_declaration: NodeType.IMPORT,

        // Type-related
        struct_item: NodeType.CLASS,
        union_item: NodeType.CLASS,
        enum_item: NodeType.ENUM,
        trait_item: NodeType.INTERFACE,
        impl_item: NodeType.CLASS,
        type_item: NodeType.TYPE_ALIAS,

        // Function-related
        function_item: NodeType.FUNCTION,
        closure_expression: NodeType.ARROW_FUNCTION,

        // Variable-related
        let_declaration: NodeType.VARIABLE,
        const_item: NodeType.VARIABLE,
        static_item: NodeType.VARIABLE,
        parameter: NodeType.PARAMETER,
        field_declaration: NodeType.FIELD,

        // Control flow
        if_expression: NodeType.IF_STATEMENT,
        for_expression: NodeType.FOR_LOOP,
        while_expression: NodeType.WHILE_LOOP,
        loop_expression: NodeType.WHILE_LOOP,
        match_expression: NodeType.SWITCH_STATEMENT,

        // Other constructs
        attribute_item: NodeType.DECORATOR,
        macro_invocation: NodeType.FUNCTION,
        line_comment: NodeType.COMMENT,
        block_comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
        raw_string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*fn.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*struct.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*enum.*$/, nodeType: NodeType.ENUM, priority: 1 },
        { pattern: /^.*trait.*$/, nodeType: NodeType.INTERFACE, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_item",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Rust function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    c: {
      directMappings: {
        // Top-level constructs
        translation_unit: NodeType.FILE,
        preproc_include: NodeType.IMPORT,
        preproc_define: NodeType.VARIABLE,

        // Type-related
        struct_specifier: NodeType.CLASS,
        union_specifier: NodeType.CLASS,
        enum_specifier: NodeType.ENUM,
        typedef_statement: NodeType.TYPE_ALIAS,

        // Function-related
        function_definition: NodeType.FUNCTION,
        function_declarator: NodeType.FUNCTION,

        // Variable-related
        declaration: NodeType.VARIABLE,
        parameter_declaration: NodeType.PARAMETER,
        field_declaration: NodeType.FIELD,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,

        // Other constructs
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*struct.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*enum.*$/, nodeType: NodeType.ENUM, priority: 1 },
      ],
      contextRules: [],
      defaultFallback: NodeType.VARIABLE,
    },

    cpp: {
      directMappings: {
        // Top-level constructs
        translation_unit: NodeType.FILE,
        preproc_include: NodeType.IMPORT,
        preproc_define: NodeType.VARIABLE,
        namespace_definition: NodeType.NAMESPACE,
        using_declaration: NodeType.IMPORT,

        // Class-related
        class_specifier: NodeType.CLASS,
        struct_specifier: NodeType.CLASS,
        union_specifier: NodeType.CLASS,
        enum_specifier: NodeType.ENUM,

        // Function-related
        function_definition: NodeType.FUNCTION,
        function_declarator: NodeType.FUNCTION,
        template_function: NodeType.FUNCTION,

        // Variable-related
        declaration: NodeType.VARIABLE,
        parameter_declaration: NodeType.PARAMETER,
        field_declaration: NodeType.FIELD,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        for_range_loop: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Other constructs
        template_declaration: NodeType.INTERFACE,
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
        raw_string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        {
          pattern: /^.*template.*$/,
          nodeType: NodeType.INTERFACE,
          priority: 1,
        },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "class_specifier",
          nodeType: NodeType.CLASS,
          priority: 10,
          description: "C++ class name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    php: {
      directMappings: {
        // Top-level constructs
        program: NodeType.FILE,
        namespace_definition: NodeType.NAMESPACE,
        namespace_use_declaration: NodeType.IMPORT,

        // Class-related
        class_declaration: NodeType.CLASS,
        interface_declaration: NodeType.INTERFACE,
        trait_declaration: NodeType.INTERFACE,
        enum_declaration: NodeType.ENUM,

        // Function-related
        function_definition: NodeType.FUNCTION,
        method_declaration: NodeType.METHOD,
        anonymous_function_creation_expression: NodeType.ARROW_FUNCTION,

        // Variable-related
        simple_parameter: NodeType.PARAMETER,
        property_declaration: NodeType.PROPERTY,
        class_constant_declaration: NodeType.FIELD,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        foreach_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        heredoc: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
      ],
      contextRules: [],
      defaultFallback: NodeType.VARIABLE,
    },

    ruby: {
      directMappings: {
        // Top-level constructs
        program: NodeType.FILE,

        // Class-related
        class: NodeType.CLASS,
        singleton_class: NodeType.CLASS,
        module: NodeType.MODULE,

        // Function-related
        method: NodeType.METHOD,
        singleton_method: NodeType.METHOD,
        lambda: NodeType.ARROW_FUNCTION,
        block: NodeType.ARROW_FUNCTION,

        // Variable-related
        assignment: NodeType.VARIABLE,
        instance_variable: NodeType.FIELD,
        class_variable: NodeType.FIELD,
        global_variable: NodeType.VARIABLE,
        constant: NodeType.VARIABLE,

        // Control flow
        if: NodeType.IF_STATEMENT,
        unless: NodeType.IF_STATEMENT,
        for: NodeType.FOR_LOOP,
        while: NodeType.WHILE_LOOP,
        until: NodeType.WHILE_LOOP,
        case: NodeType.SWITCH_STATEMENT,
        begin: NodeType.TRY_CATCH,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        symbol: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*module.*$/, nodeType: NodeType.MODULE, priority: 1 },
      ],
      contextRules: [],
      defaultFallback: NodeType.VARIABLE,
    },

    kotlin: {
      directMappings: {
        // Top-level constructs
        source_file: NodeType.FILE,
        package_header: NodeType.NAMESPACE,
        import_header: NodeType.IMPORT,

        // Class-related
        class_declaration: NodeType.CLASS,
        interface_declaration: NodeType.INTERFACE,
        object_declaration: NodeType.CLASS,
        enum_class_declaration: NodeType.ENUM,

        // Function-related
        function_declaration: NodeType.FUNCTION,
        anonymous_function: NodeType.ARROW_FUNCTION,
        lambda_literal: NodeType.ARROW_FUNCTION,

        // Variable-related
        property_declaration: NodeType.PROPERTY,
        parameter: NodeType.PARAMETER,

        // Control flow
        if_expression: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        do_while_statement: NodeType.WHILE_LOOP,
        when_expression: NodeType.SWITCH_STATEMENT,
        try_expression: NodeType.TRY_CATCH,

        // Other constructs
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
        character_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*fun.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        {
          pattern: /^.*interface.*$/,
          nodeType: NodeType.INTERFACE,
          priority: 1,
        },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_declaration",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Kotlin function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    // Tier 3 Languages
    swift: {
      directMappings: {
        // Top-level constructs
        source_file: NodeType.FILE,
        import_declaration: NodeType.IMPORT,

        // Class-related
        class_declaration: NodeType.CLASS,
        struct_declaration: NodeType.CLASS,
        protocol_declaration: NodeType.INTERFACE,
        enum_declaration: NodeType.ENUM,
        extension_declaration: NodeType.CLASS,

        // Function-related
        function_declaration: NodeType.FUNCTION,
        init_declaration: NodeType.CONSTRUCTOR,
        closure_expression: NodeType.ARROW_FUNCTION,

        // Variable-related
        property_declaration: NodeType.PROPERTY,
        parameter: NodeType.PARAMETER,
        variable_declaration: NodeType.VARIABLE,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        guard_statement: NodeType.IF_STATEMENT,
        do_statement: NodeType.TRY_CATCH,

        // Other constructs
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*func.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*struct.*$/, nodeType: NodeType.CLASS, priority: 1 },
        {
          pattern: /^.*protocol.*$/,
          nodeType: NodeType.INTERFACE,
          priority: 1,
        },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "simple_identifier" &&
            context.parent?.type === "function_declaration",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Swift function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    dart: {
      directMappings: {
        // Top-level constructs
        program: NodeType.FILE,
        import_specification: NodeType.IMPORT,
        library_name: NodeType.NAMESPACE,

        // Class-related
        class_definition: NodeType.CLASS,
        mixin_declaration: NodeType.CLASS,
        enum_declaration: NodeType.ENUM,
        extension_declaration: NodeType.CLASS,

        // Function-related
        function_signature: NodeType.FUNCTION,
        method_signature: NodeType.METHOD,
        getter_signature: NodeType.PROPERTY,
        setter_signature: NodeType.PROPERTY,
        constructor_signature: NodeType.CONSTRUCTOR,

        // Variable-related
        initialized_variable_definition: NodeType.VARIABLE,
        final_variable_declaration: NodeType.VARIABLE,
        formal_parameter: NodeType.PARAMETER,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        switch_statement: NodeType.SWITCH_STATEMENT,
        try_statement: NodeType.TRY_CATCH,

        // Other constructs
        comment: NodeType.COMMENT,
        string_literal: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*method.*$/, nodeType: NodeType.METHOD, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_signature",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Dart function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    scala: {
      directMappings: {
        // Top-level constructs
        compilation_unit: NodeType.FILE,
        package_clause: NodeType.NAMESPACE,
        import_declaration: NodeType.IMPORT,

        // Class-related
        class_definition: NodeType.CLASS,
        object_definition: NodeType.CLASS,
        trait_definition: NodeType.INTERFACE,
        case_class_definition: NodeType.CLASS,

        // Function-related
        function_definition: NodeType.FUNCTION,
        function_declaration: NodeType.FUNCTION,
        lambda_expression: NodeType.ARROW_FUNCTION,

        // Variable-related
        val_definition: NodeType.VARIABLE,
        var_definition: NodeType.VARIABLE,
        parameter: NodeType.PARAMETER,

        // Control flow
        if_expression: NodeType.IF_STATEMENT,
        for_expression: NodeType.FOR_LOOP,
        while_expression: NodeType.WHILE_LOOP,
        match_expression: NodeType.SWITCH_STATEMENT,
        try_expression: NodeType.TRY_CATCH,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*def.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*class.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*object.*$/, nodeType: NodeType.CLASS, priority: 1 },
        { pattern: /^.*trait.*$/, nodeType: NodeType.INTERFACE, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_definition",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Scala function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    lua: {
      directMappings: {
        // Top-level constructs
        chunk: NodeType.FILE,

        // Function-related
        function_statement: NodeType.FUNCTION,
        local_function: NodeType.FUNCTION,
        function_call: NodeType.FUNCTION,

        // Variable-related
        local_variable: NodeType.VARIABLE,
        variable_list: NodeType.VARIABLE,
        parameter_list: NodeType.PARAMETER,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        repeat_statement: NodeType.WHILE_LOOP,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        number: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*local.*$/, nodeType: NodeType.VARIABLE, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "identifier" &&
            context.parent?.type === "function_statement",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Lua function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },

    bash: {
      directMappings: {
        // Top-level constructs
        program: NodeType.FILE,

        // Function-related
        function_definition: NodeType.FUNCTION,
        command: NodeType.FUNCTION,

        // Variable-related
        variable_assignment: NodeType.VARIABLE,
        variable_name: NodeType.VARIABLE,

        // Control flow
        if_statement: NodeType.IF_STATEMENT,
        for_statement: NodeType.FOR_LOOP,
        while_statement: NodeType.WHILE_LOOP,
        case_statement: NodeType.SWITCH_STATEMENT,

        // Other constructs
        comment: NodeType.COMMENT,
        string: NodeType.STRING_LITERAL,
        raw_string: NodeType.STRING_LITERAL,
      },
      patternMappings: [
        { pattern: /^.*function.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
        { pattern: /^.*command.*$/, nodeType: NodeType.FUNCTION, priority: 1 },
      ],
      contextRules: [
        {
          condition: (node, context) =>
            node.type === "word" &&
            context.parent?.type === "function_definition",
          nodeType: NodeType.FUNCTION,
          priority: 10,
          description: "Bash function name identifier",
        },
      ],
      defaultFallback: NodeType.VARIABLE,
    },
  };

  private stats: ClassificationStats = {
    totalClassified: 0,
    byLanguage: {},
    byNodeType: {},
    averageConfidence: 0,
    fallbackUsage: 0,
    performance: {
      averageTime: 0,
      totalTime: 0,
      cacheHitRatio: 0,
    },
    methodUsage: {
      direct: 0,
      pattern: 0,
      context: 0,
      fuzzy: 0,
      fallback: 0,
    },
    issues: {
      errors: 0,
      warnings: 0,
      lowConfidence: 0,
    },
  };

  private confidenceScores: number[] = [];

  // Enhanced performance features
  private classificationCache = new Map<
    string,
    { result: ClassificationResult; timestamp: number }
  >();
  private patternCache = new Map<string, RegExp>();
  private cacheHits = 0;
  private totalClassifications = 0;

  /**
   * Enhanced classify a raw node into a normalized NodeType with caching and performance optimization
   *
   * @param rawNode - Raw node data from parser
   * @param context - Optional classification context
   * @returns Classification result with confidence and metadata
   */
  classifyNode(
    rawNode: RawNodeData,
    context?: Partial<ClassificationContext>,
  ): ClassificationResult {
    const startTime = performance.now();
    this.totalClassifications++;

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(rawNode, context);

      // Check cache first
      const cached = this.classificationCache.get(cacheKey);
      if (cached && this.isCacheValid(cached.timestamp)) {
        this.cacheHits++;
        const cachedResult = { ...cached.result };
        cachedResult.metadata = {
          ...cachedResult.metadata,
          processTime: performance.now() - startTime,
          method: cachedResult.metadata?.method || "direct",
          cached: true,
        };
        return cachedResult;
      }

      // Build enhanced context with semantic analysis
      const fullContext: ClassificationContext = {
        node: rawNode,
        parent: context?.parent,
        siblings: context?.siblings || [],
        language: rawNode.language,
        metadata: context?.metadata || {},
        ancestors: this.buildAncestorChain(rawNode),
        filePath: context?.filePath,
        scope: this.analyzeScopeContext(rawNode),
        semanticContext: this.analyzeSemanticContext(rawNode, context),
      };

      const mapping = this.getLanguageMapping(rawNode.language);
      const result = this.performEnhancedClassification(
        rawNode,
        mapping,
        fullContext,
      );

      // Add performance metadata
      const processTime = performance.now() - startTime;
      result.metadata = {
        ...result.metadata,
        processTime,
        method: result.metadata?.method || "fallback",
        cached: false,
      };

      // Cache the result
      this.cacheResult(cacheKey, result);

      // Update enhanced statistics
      this.updateEnhancedStats(result, rawNode.language, processTime);

      return result;
    } catch (error) {
      // Enhanced fallback classification with better error handling
      const processTime = performance.now() - startTime;
      const fallbackResult: ClassificationResult = {
        nodeType: NodeType.VARIABLE,
        confidence: 0.1,
        reason: `Classification error: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          processTime,
          method: "fallback",
          cached: false,
        },
      };

      this.stats.issues.errors++;
      this.updateEnhancedStats(fallbackResult, rawNode.language, processTime);
      return fallbackResult;
    }
  }

  /**
   * Generate cache key for classification result
   */
  private generateCacheKey(
    rawNode: RawNodeData,
    context?: Partial<ClassificationContext>,
  ): string {
    const contextKey = context?.parent?.type || "no-parent";
    const siblingsKey = context?.siblings?.length || 0;
    return `${rawNode.language}:${rawNode.type}:${contextKey}:${siblingsKey}`;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    const TTL = 300000; // 5 minutes
    return Date.now() - timestamp < TTL;
  }

  /**
   * Cache classification result
   */
  private cacheResult(key: string, result: ClassificationResult): void {
    this.classificationCache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });

    // Limit cache size
    if (this.classificationCache.size > 10000) {
      const oldestKey = this.classificationCache.keys().next().value;
      if (oldestKey) {
        this.classificationCache.delete(oldestKey);
      }
    }
  }

  /**
   * Build ancestor chain for deep context analysis
   */
  private buildAncestorChain(node: RawNodeData): RawNodeData[] {
    const ancestors: RawNodeData[] = [];
    let current = node.parent;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (current && depth < maxDepth) {
      ancestors.push(current);
      current = current.parent;
      depth++;
    }

    return ancestors;
  }

  /**
   * Analyze scope context from node hierarchy
   */
  private analyzeScopeContext(
    node: RawNodeData,
  ): ClassificationContext["scope"] {
    let current = node.parent;
    let depth = 0;

    while (current) {
      // Check for various scope types based on node type
      if (current.type.includes("class") || current.type.includes("struct")) {
        return { type: "class", name: current.name, depth };
      }
      if (
        current.type.includes("function") ||
        current.type.includes("method")
      ) {
        return { type: "function", name: current.name, depth };
      }
      if (
        current.type.includes("module") ||
        current.type.includes("namespace")
      ) {
        return { type: "module", name: current.name, depth };
      }
      if (current.type.includes("block")) {
        return { type: "block", depth };
      }

      current = current.parent;
      depth++;
    }

    return { type: "global", depth: 0 };
  }

  /**
   * Analyze semantic context from surrounding nodes
   */
  private analyzeSemanticContext(
    node: RawNodeData,
    _context?: Partial<ClassificationContext>,
  ): ClassificationContext["semanticContext"] {
    const semantic: ClassificationContext["semanticContext"] = {};

    // Analyze parent nodes for context
    let current = node.parent;
    while (current) {
      if (current.type.includes("class")) {
        semantic.inClass = true;
      }
      if (
        current.type.includes("function") ||
        current.type.includes("method")
      ) {
        semantic.inFunction = true;
      }
      if (
        current.type.includes("if") ||
        current.type.includes("for") ||
        current.type.includes("while") ||
        current.type.includes("switch")
      ) {
        semantic.inControl = true;
      }
      current = current.parent;
    }

    // Check if this is a declaration
    semantic.isDeclaration =
      node.type.includes("declaration") ||
      node.type.includes("definition") ||
      node.type.includes("assignment");

    return semantic;
  }

  /**
   * Enhanced classification with advanced pattern matching and context analysis
   */
  private performEnhancedClassification(
    rawNode: RawNodeData,
    mapping: LanguageMapping,
    context: ClassificationContext,
  ): ClassificationResult {
    const alternatives: Array<{
      nodeType: NodeType;
      confidence: number;
      reason: string;
    }> = [];

    // 1. Enhanced context rules with depth analysis
    const contextRules = mapping.contextRules.sort(
      (a, b) => b.priority - a.priority,
    );
    for (const rule of contextRules) {
      if (rule.condition(rawNode, context)) {
        const confidence = rule.minConfidence || 0.95;
        return {
          nodeType: rule.nodeType,
          confidence,
          reason: `Enhanced context rule: ${rule.description}`,
          alternatives,
          metadata: {
            method: "context",
            matchedRule: rule.description,
            contextDepth: context.ancestors?.length || 0,
          },
          quality: this.calculateQuality(confidence, "context"),
        };
      }
    }

    // 2. Direct mappings (highest confidence)
    const directMapping = mapping.directMappings[rawNode.type];
    if (directMapping) {
      return {
        nodeType: directMapping,
        confidence: 0.9,
        reason: `Direct mapping for '${rawNode.type}'`,
        alternatives,
        metadata: {
          method: "direct",
          matchedRule: rawNode.type,
        },
        quality: this.calculateQuality(0.9, "direct"),
      };
    }

    // 3. Enhanced pattern matching with caching
    const patternMappings = mapping.patternMappings.sort(
      (a, b) => b.priority - a.priority,
    );
    for (const pattern of patternMappings) {
      let regex = this.patternCache.get(pattern.pattern.source);
      if (!regex) {
        regex = pattern.caseInsensitive
          ? new RegExp(pattern.pattern.source, "i")
          : pattern.pattern;
        this.patternCache.set(pattern.pattern.source, regex);
      }

      if (regex.test(rawNode.type)) {
        const confidence =
          pattern.contextRequired && !context.semanticContext ? 0.6 : 0.75;
        alternatives.push({
          nodeType: pattern.nodeType,
          confidence,
          reason: `Pattern match: ${pattern.description || pattern.pattern.source}`,
        });

        if (!pattern.contextRequired || context.semanticContext) {
          return {
            nodeType: pattern.nodeType,
            confidence,
            reason: `Enhanced pattern match: ${pattern.description || pattern.pattern.source}`,
            alternatives,
            metadata: {
              method: "pattern",
              matchedRule: pattern.description || pattern.pattern.source,
            },
            quality: this.calculateQuality(confidence, "pattern"),
          };
        }
      }
    }

    // 4. Fuzzy matching for unknown types
    if (mapping.fuzzyRules) {
      for (const fuzzyRule of mapping.fuzzyRules) {
        for (const sourceType of fuzzyRule.sourceTypes) {
          const similarity = this.calculateSimilarity(rawNode.type, sourceType);
          if (similarity >= fuzzyRule.threshold) {
            const confidence = similarity * 0.8; // Reduce confidence for fuzzy matches
            return {
              nodeType: fuzzyRule.nodeType,
              confidence,
              reason: `Fuzzy match: ${rawNode.type} -> ${sourceType} (${Math.round(similarity * 100)}% similar)`,
              alternatives,
              metadata: {
                method: "fuzzy",
                matchedRule: `${sourceType} (${Math.round(similarity * 100)}%)`,
              },
              quality: this.calculateQuality(confidence, "fuzzy"),
            };
          }
        }
      }
    }

    // 5. Fallback with enhanced reasoning
    const fallbackConfidence = 0.3;
    const fallbackResult = {
      nodeType: mapping.defaultFallback,
      confidence: fallbackConfidence,
      reason: `Fallback classification for unknown type '${rawNode.type}' in ${rawNode.language}`,
      alternatives,
      metadata: {
        method: "fallback" as const,
        matchedRule: "default-fallback",
      },
      quality: this.calculateQuality(fallbackConfidence, "fallback"),
    };

    if (fallbackConfidence < 0.5) {
      this.stats.issues.lowConfidence++;
    }

    return fallbackResult;
  }

  /**
   * Calculate quality score based on confidence and method
   */
  private calculateQuality(confidence: number, method: string): number {
    const methodWeights = {
      direct: 1.0,
      context: 0.95,
      pattern: 0.8,
      fuzzy: 0.6,
      fallback: 0.3,
    };

    const methodWeight =
      methodWeights[method as keyof typeof methodWeights] || 0.5;
    return confidence * methodWeight;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) {
      return 1;
    }
    if (str1.length === 0 || str2.length === 0) {
      return 0;
    }

    // Simple similarity check for performance
    const common = str1.split("").filter((char, i) => str2[i] === char).length;
    const maxLen = Math.max(str1.length, str2.length);
    return common / maxLen;
  }

  /**
   * Update enhanced statistics with performance metrics
   */
  private updateEnhancedStats(
    result: ClassificationResult,
    language: string,
    processTime: number,
  ): void {
    // Update existing stats
    this.stats.totalClassified++;
    this.stats.byLanguage[language] =
      (this.stats.byLanguage[language] || 0) + 1;
    this.stats.byNodeType[result.nodeType] =
      (this.stats.byNodeType[result.nodeType] || 0) + 1;

    this.confidenceScores.push(result.confidence);

    if (result.metadata?.method === "fallback") {
      this.stats.fallbackUsage++;
    }

    // Update performance metrics
    this.stats.performance.totalTime += processTime;
    this.stats.performance.averageTime =
      this.stats.performance.totalTime / this.stats.totalClassified;
    this.stats.performance.cacheHitRatio =
      this.totalClassifications > 0
        ? this.cacheHits / this.totalClassifications
        : 0;

    // Update method usage
    const method = result.metadata?.method || "fallback";
    this.stats.methodUsage[method]++;

    // Update quality metrics
    if (result.confidence < 0.5) {
      this.stats.issues.lowConfidence++;
    }
  }

  /**
   * Classify multiple nodes efficiently
   *
   * @param rawNodes - Array of raw node data
   * @returns Array of classification results
   */
  classifyBatch(rawNodes: RawNodeData[]): ClassificationResult[] {
    return rawNodes.map((node) => this.classifyNode(node));
  }

  /**
   * Get supported languages
   *
   * @returns Array of supported language identifiers
   */
  getSupportedLanguages(): string[] {
    return Object.keys(NodeClassifier.LANGUAGE_MAPPINGS);
  }

  /**
   * Add or update language mapping
   *
   * @param language - Language identifier
   * @param mapping - Language mapping configuration
   */
  addLanguageMapping(language: string, mapping: LanguageMapping): void {
    NodeClassifier.LANGUAGE_MAPPINGS[language] = mapping;
  }

  /**
   * Get classification statistics
   *
   * @returns Current statistics
   */
  getStats(): ClassificationStats {
    // Update average confidence
    if (this.confidenceScores.length > 0) {
      this.stats.averageConfidence =
        this.confidenceScores.reduce((sum, score) => sum + score, 0) /
        this.confidenceScores.length;
    }

    return { ...this.stats };
  }

  /**
   * Reset classification statistics
   */
  resetStats(): void {
    this.stats = {
      totalClassified: 0,
      byLanguage: {},
      byNodeType: {},
      averageConfidence: 0,
      fallbackUsage: 0,
      performance: {
        averageTime: 0,
        totalTime: 0,
        cacheHitRatio: 0,
      },
      methodUsage: {
        direct: 0,
        pattern: 0,
        context: 0,
        fuzzy: 0,
        fallback: 0,
      },
      issues: {
        errors: 0,
        warnings: 0,
        lowConfidence: 0,
      },
    };
    this.confidenceScores = [];
  }

  /**
   * Validate classification accuracy against known correct data
   *
   * @param testData - Array of nodes with expected classifications
   * @returns Accuracy metrics
   */
  validateAccuracy(
    testData: Array<{ node: RawNodeData; expected: NodeType }>,
  ): { correct: number; total: number; percentage: number } {
    let correct = 0;
    const total = testData.length;

    for (const { node, expected } of testData) {
      const result = this.classifyNode(node);
      if (result.nodeType === expected) {
        correct++;
      }
    }

    const accuracy = {
      correct,
      total,
      percentage: total > 0 ? (correct / total) * 100 : 0,
    };

    this.stats.accuracy = accuracy;
    return accuracy;
  }

  /**
   * Get language mapping for the specified language
   */
  private getLanguageMapping(language: string): LanguageMapping {
    const mapping = NodeClassifier.LANGUAGE_MAPPINGS[language.toLowerCase()];
    if (!mapping) {
      // Return default mapping for unknown languages
      return {
        directMappings: {},
        patternMappings: [],
        contextRules: [],
        defaultFallback: NodeType.VARIABLE,
      };
    }
    return mapping;
  }

  /**
   * Enhanced debugging: Get detailed classification breakdown for a node
   */
  debugClassification(
    rawNode: RawNodeData,
    context?: Partial<ClassificationContext>,
  ): {
    result: ClassificationResult;
    steps: Array<{ step: string; result: string; confidence?: number }>;
    mapping: LanguageMapping;
    cacheInfo: { hit: boolean; key: string };
  } {
    const steps: Array<{ step: string; result: string; confidence?: number }> =
      [];
    const mapping = this.getLanguageMapping(rawNode.language);
    const cacheKey = this.generateCacheKey(rawNode, context);
    const cached = this.classificationCache.get(cacheKey);
    const cacheHit = cached && this.isCacheValid(cached.timestamp);

    steps.push({ step: "Cache Check", result: cacheHit ? "HIT" : "MISS" });

    if (cacheHit && cached) {
      steps.push({
        step: "Result Source",
        result: "Cache",
        confidence: cached.result.confidence,
      });
      return {
        result: cached.result,
        steps,
        mapping,
        cacheInfo: { hit: true, key: cacheKey },
      };
    }

    steps.push({ step: "Language", result: rawNode.language });
    steps.push({ step: "Node Type", result: rawNode.type });

    // Check direct mappings
    const directMapping = mapping.directMappings[rawNode.type];
    if (directMapping) {
      steps.push({
        step: "Direct Mapping",
        result: `Found: ${directMapping}`,
        confidence: 0.9,
      });
    } else {
      steps.push({ step: "Direct Mapping", result: "Not found" });
    }

    // Check pattern mappings
    let patternFound = false;
    for (const pattern of mapping.patternMappings) {
      if (pattern.pattern.test(rawNode.type)) {
        steps.push({
          step: "Pattern Match",
          result: `${pattern.description || pattern.pattern.source} -> ${pattern.nodeType}`,
          confidence: 0.75,
        });
        patternFound = true;
        break;
      }
    }
    if (!patternFound) {
      steps.push({ step: "Pattern Match", result: "No patterns matched" });
    }

    // Check context rules
    const fullContext: ClassificationContext = {
      node: rawNode,
      parent: context?.parent,
      siblings: context?.siblings || [],
      language: rawNode.language,
      metadata: context?.metadata || {},
      ancestors: this.buildAncestorChain(rawNode),
      scope: this.analyzeScopeContext(rawNode),
      semanticContext: this.analyzeSemanticContext(rawNode, context),
    };

    let contextRuleApplied = false;
    for (const rule of mapping.contextRules) {
      if (rule.condition(rawNode, fullContext)) {
        steps.push({
          step: "Context Rule",
          result: `Applied: ${rule.description}`,
          confidence: rule.minConfidence || 0.95,
        });
        contextRuleApplied = true;
        break;
      }
    }
    if (!contextRuleApplied) {
      steps.push({ step: "Context Rule", result: "No rules applied" });
    }

    const result = this.classifyNode(rawNode, context);
    steps.push({
      step: "Final Classification",
      result: `${result.nodeType} (${result.confidence.toFixed(2)} confidence)`,
    });

    return {
      result,
      steps,
      mapping,
      cacheInfo: { hit: false, key: cacheKey },
    };
  }

  /**
   * Performance optimization: Clear caches and reset performance counters
   */
  optimizePerformance(): {
    cachesCleared: number;
    memoryFreed: number;
    resetCounters: boolean;
  } {
    const cacheSize = this.classificationCache.size;
    const patternCacheSize = this.patternCache.size;

    // Clear caches
    this.classificationCache.clear();
    this.patternCache.clear();

    // Reset performance counters
    this.cacheHits = 0;
    this.totalClassifications = 0;

    return {
      cachesCleared: cacheSize + patternCacheSize,
      memoryFreed: cacheSize * 100 + patternCacheSize * 50, // Estimated bytes
      resetCounters: true,
    };
  }

  /**
   * Advanced validation: Test classification consistency across similar nodes
   */
  validateConsistency(testNodes: RawNodeData[]): {
    consistent: boolean;
    groups: Array<{ nodeType: string; classifications: Set<NodeType> }>;
    inconsistencies: Array<{ nodeType: string; classifications: NodeType[] }>;
  } {
    const groups = new Map<string, Set<NodeType>>();

    // Group nodes by type and collect their classifications
    for (const node of testNodes) {
      if (!groups.has(node.type)) {
        groups.set(node.type, new Set());
      }
      const result = this.classifyNode(node);
      const nodeGroup = groups.get(node.type);
      if (nodeGroup) {
        nodeGroup.add(result.nodeType);
      }
    }

    // Check for inconsistencies
    const inconsistencies: Array<{
      nodeType: string;
      classifications: NodeType[];
    }> = [];
    const groupResults: Array<{
      nodeType: string;
      classifications: Set<NodeType>;
    }> = [];

    for (const [nodeType, classifications] of groups.entries()) {
      groupResults.push({ nodeType, classifications });
      if (classifications.size > 1) {
        inconsistencies.push({
          nodeType,
          classifications: Array.from(classifications),
        });
      }
    }

    return {
      consistent: inconsistencies.length === 0,
      groups: groupResults,
      inconsistencies,
    };
  }

  /**
   * Get enhanced performance metrics
   */
  getPerformanceMetrics(): {
    classification: {
      total: number;
      averageTime: number;
      cacheHitRatio: number;
    };
    memory: {
      cacheSize: number;
      patternCacheSize: number;
      estimatedMemoryUsage: number;
    };
    accuracy: {
      averageConfidence: number;
      lowConfidenceRate: number;
      fallbackRate: number;
    };
  } {
    return {
      classification: {
        total: this.totalClassifications,
        averageTime: this.stats.performance.averageTime,
        cacheHitRatio: this.stats.performance.cacheHitRatio,
      },
      memory: {
        cacheSize: this.classificationCache.size,
        patternCacheSize: this.patternCache.size,
        estimatedMemoryUsage:
          this.classificationCache.size * 100 + this.patternCache.size * 50,
      },
      accuracy: {
        averageConfidence: this.stats.averageConfidence,
        lowConfidenceRate:
          this.stats.issues.lowConfidence /
          Math.max(this.stats.totalClassified, 1),
        fallbackRate:
          this.stats.fallbackUsage / Math.max(this.stats.totalClassified, 1),
      },
    };
  }
}

/**
 * Utility functions for node classification
 */
export class ClassificationUtils {
  /**
   * Check if a node type is likely to be a container (has children)
   *
   * @param nodeType - Node type to check
   * @returns True if typically contains other nodes
   */
  static isContainerType(nodeType: NodeType): boolean {
    return [
      NodeType.FILE,
      NodeType.MODULE,
      NodeType.NAMESPACE,
      NodeType.CLASS,
      NodeType.INTERFACE,
      NodeType.FUNCTION,
      NodeType.METHOD,
      NodeType.CONSTRUCTOR,
      NodeType.IF_STATEMENT,
      NodeType.FOR_LOOP,
      NodeType.WHILE_LOOP,
      NodeType.SWITCH_STATEMENT,
      NodeType.TRY_CATCH,
    ].includes(nodeType);
  }

  /**
   * Check if a node type represents a declaration
   *
   * @param nodeType - Node type to check
   * @returns True if it's a declaration type
   */
  static isDeclarationType(nodeType: NodeType): boolean {
    return [
      NodeType.CLASS,
      NodeType.INTERFACE,
      NodeType.ENUM,
      NodeType.TYPE_ALIAS,
      NodeType.FUNCTION,
      NodeType.METHOD,
      NodeType.CONSTRUCTOR,
      NodeType.VARIABLE,
      NodeType.PARAMETER,
      NodeType.PROPERTY,
      NodeType.FIELD,
    ].includes(nodeType);
  }

  /**
   * Get the hierarchical level of a node type
   *
   * @param nodeType - Node type to evaluate
   * @returns Numeric level (0 = top-level, higher = more nested)
   */
  static getHierarchyLevel(nodeType: NodeType): number {
    const levels: Partial<Record<NodeType, number>> = {
      [NodeType.FILE]: 0,
      [NodeType.MODULE]: 1,
      [NodeType.NAMESPACE]: 2,
      [NodeType.CLASS]: 3,
      [NodeType.INTERFACE]: 3,
      [NodeType.ENUM]: 3,
      [NodeType.FUNCTION]: 4,
      [NodeType.METHOD]: 4,
      [NodeType.CONSTRUCTOR]: 4,
      [NodeType.PROPERTY]: 5,
      [NodeType.FIELD]: 5,
      [NodeType.VARIABLE]: 6,
      [NodeType.PARAMETER]: 7,
    };

    return levels[nodeType] ?? 8; // Default high level for others
  }
}

/**
 * Default singleton instance for common usage
 */
export const defaultNodeClassifier = new NodeClassifier();
