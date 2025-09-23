// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Base ESLint recommended rules
  js.configs.recommended,
  
  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,
  
  // Global ignores - applies to all configurations
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/docs/.vitepress/dist/**',
      '**/*.d.ts',
      '**/test-output/**',
      '**/test-tmp/**',
      '**/.tmp/**',
      '**/.cache/**',
      '**/ci-artifacts/**',
      '**/licenses.json',
      '**/LICENSE*',
      '**/*.log',
      '**/.eslintcache',
      '**/yarn.lock',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/.yarn/**',
      '**/deployment-*.mjs',
      '**/e2e-testing-*.mjs',
      '**/performance-validation-*.mjs',
      '**/security-compliance-*.mjs',
      '**/*.json',
      '**/tsconfig*.json',
    ],
  },

  // Configuration for TypeScript source files in packages (with project references)
  {
    files: ['packages/**/src/**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports'
      }],
      
      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      
      // Relaxed rules for development
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },

  // Configuration for TypeScript config/test files in packages (without project references)
  {
    files: ['packages/**/*.{ts,tsx,mts,cts}'],
    ignores: ['packages/**/src/**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // No project reference for config/test files
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      
      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      
      // Relaxed rules for test files
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },

  // Configuration for JavaScript files
  // Root and general JavaScript files
  {
    files: ["*.js", "*.mjs", "*.cjs", "scripts/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node,
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      },
    },
    rules: {
      "curly": ["error", "all"],
      "no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "no-console": "warn"
    }
  },

  // TypeScript files outside of packages (config files, tests, scripts)
  {
    files: [
      "*.ts", 
      "scripts/**/*.ts", 
      "tests/**/*.ts", 
      "vitest.*.ts"
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: 2024,
        // Don't use project-based parsing for these files
      },
      globals: {
        ...globals.node,
        console: "readonly",
        process: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      "curly": ["error", "all"],
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "no-console": "warn",
      // Relax some rules for test and config files
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },

  // Relaxed rules for test files
  {
    files: ['**/*.test.{ts,js,mts}', '**/*.spec.{ts,js,mts}', '**/tests/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // Relaxed rules for configuration and script files
  {
    files: [
      '**/vitest.config.ts',
      '**/vite.config.ts', 
      '**/rollup.config.ts',
      '**/webpack.config.ts',
      '**/scripts/**/*',
      '**/*.config.{ts,js,mjs}',
      '**/tsconfig.json',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // VS Code extension specific rules
  {
    files: ['packages/vscode-extension/**/*.ts'],
    rules: {
      'no-console': 'off', // VS Code extensions use console for output
    },
  },

  // Node.js script files - relaxed rules for utility scripts
  {
    files: ['scripts/**/*.{js,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-process-exit': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'curly': 'off', // Allow single-line if statements in scripts
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
    },
  },

  // JSON files should be ignored by TypeScript parser
  {
    files: ['**/*.json'],
    ignores: ['**/*.json'], // Don't lint JSON files with TypeScript rules
  }
);