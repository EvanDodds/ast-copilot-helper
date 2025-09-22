# Examples and Tutorials

Welcome to the AST Copilot Helper examples and tutorials section! This comprehensive collection provides hands-on examples, step-by-step tutorials, and real-world integration patterns to help you master the tool.

## 🚀 Quick Start Examples

### [CLI Examples](./cli.md)

Comprehensive command-line examples covering:

- **Basic Usage**: Single file parsing, directory analysis, query patterns
- **Advanced Queries**: Finding functions, classes, imports, and dependencies
- **Code Analysis**: Security scanning, performance analysis, quality checks
- **Integration**: Git hooks, CI/CD pipelines, custom output formats
- **Performance**: Parallel processing, caching, incremental analysis

### [Interactive Tutorials](./tutorials.md)

Step-by-step guided tutorials including:

- **Tutorial 1**: Getting Started with Code Analysis
- **Tutorial 2**: Project-Wide Analysis
- **Tutorial 3**: MCP Server Integration with AI Agents
- **Tutorial 4**: VS Code Extension Usage
- **Tutorial 5**: Advanced Configuration
- **Tutorial 6**: Performance Optimization
- **Tutorial 7**: Custom Parser Development

### [Integration Examples](./integrations.md)

Real-world integration patterns with popular tools:

- **AI Agents**: Claude, ChatGPT, GitHub Copilot Chat integration
- **Development Tools**: ESLint, Webpack, Vite plugins
- **CI/CD**: GitHub Actions, GitLab CI, Jenkins pipelines
- **IDEs**: IntelliJ IDEA, Sublime Text plugins
- **Analytics**: InfluxDB metrics, Grafana dashboards
- **Testing**: Jest, Vitest integration

## Quick Start Examples

### Basic Project Setup

**Scenario**: You're starting a new TypeScript project and want to set up ast-copilot-helper for intelligent code analysis.

```bash
# 1. Initialize your project
mkdir my-awesome-project
cd my-awesome-project
npm init -y

# 2. Install ast-copilot-helper
npm install -g ast-copilot-helper

# 3. Create some sample code
mkdir src
cat > src/user.ts << 'EOF'
/**
 * User management functionality
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Creates a new user account
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData,
      createdAt: new Date()
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Finds a user by their ID
   */
  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
EOF

cat > src/auth.ts << 'EOF'
import { User } from './user';

export interface AuthToken {
  token: string;
  expiresAt: Date;
  userId: string;
}

/**
 * Authentication service for user login and token management
 */
export class AuthService {
  private tokens: Map<string, AuthToken> = new Map();

  /**
   * Authenticates user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<AuthToken | null> {
    // Simplified authentication logic
    if (this.isValidCredentials(email, password)) {
      const token = this.generateToken();
      const authToken: AuthToken = {
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        userId: this.getUserIdByEmail(email)
      };

      this.tokens.set(token, authToken);
      return authToken;
    }

    return null;
  }

  /**
   * Validates an authentication token
   */
  validateToken(token: string): boolean {
    const authToken = this.tokens.get(token);
    return authToken ? authToken.expiresAt > new Date() : false;
  }

  private isValidCredentials(email: string, password: string): boolean {
    // Simplified validation
    return email.includes('@') && password.length >= 8;
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2) +
           Math.random().toString(36).substring(2);
  }

  private getUserIdByEmail(email: string): string {
    // Simplified user lookup
    return 'user-' + email.split('@')[0];
  }
}
EOF

# 4. Initialize ast-copilot-helper
ast-helper init

# 5. Parse your code
ast-helper parse src/

# 6. Start exploring!
ast-helper stats
```

**Expected Output:**

```
✅ Initialized ast-copilot-helper in my-awesome-project
📊 Project Statistics:
  - Files parsed: 2
  - Total annotations: 8
  - Functions: 6
  - Classes: 2
  - Interfaces: 2
```

### First Queries

Now let's explore your code with intelligent queries:

```bash
# Find user-related functionality
ast-helper query "user management"

# Look for authentication functions
ast-helper query "authentication and login"

# Search for specific types
ast-helper query "token" --type interface

# Find all classes
ast-helper query "*" --type class

# Search in specific files
ast-helper query "validation" --file "src/auth.ts"
```

**Sample Results:**

```json
[
  {
    "name": "createUser",
    "type": "method",
    "description": "Creates a new user account",
    "filePath": "src/user.ts",
    "score": 0.92
  },
  {
    "name": "authenticateUser",
    "type": "method",
    "description": "Authenticates user with email and password",
    "filePath": "src/auth.ts",
    "score": 0.89
  }
]
```

## Interactive Tutorials

### Tutorial 1: From Zero to Semantic Search

**Goal**: Set up a project and perform your first semantic search in 10 minutes.

**Step 1: Create Sample Project** (2 minutes)

```bash
mkdir tutorial-project && cd tutorial-project
npm init -y

# Create sample code
mkdir src
cat > src/calculator.ts << 'EOF'
export class Calculator {
  /**
   * Adds two numbers together
   */
  add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Subtracts second number from first
   */
  subtract(a: number, b: number): number {
    return a - b;
  }

  /**
   * Multiplies two numbers
   */
  multiply(a: number, b: number): number {
    return a * b;
  }

  /**
   * Divides first number by second
   */
  divide(a: number, b: number): number {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  }
}
EOF
```

**Step 2: Initialize ast-copilot-helper** (2 minutes)

```bash
# Install globally (skip if already installed)
npm install -g ast-copilot-helper

# Initialize project
ast-helper init

# Parse code
ast-helper parse src/
```

**Step 3: Basic Text Search** (2 minutes)

```bash
# Find all functions
ast-helper query "*" --type method

# Search for specific functionality
ast-helper query "addition"
ast-helper query "math operations"
```

**Step 4: Enable Semantic Search** (2 minutes)

```bash
# Set OpenAI API key (optional but recommended)
export OPENAI_API_KEY="your-key-here"

# Enable embeddings
ast-helper config set ai.enableEmbeddings true

# Generate embeddings
ast-helper embeddings generate src/
```

**Step 5: Try Semantic Search** (2 minutes)

```bash
# These queries understand meaning, not just keywords:
ast-helper query "mathematical operations"
ast-helper query "arithmetic functions"
ast-helper query "number calculations"

# Compare with text search:
ast-helper query "mathematical operations" --mode text
ast-helper query "mathematical operations" --mode semantic
```

**🎉 Success!** You now have semantic search working on your codebase!

### Tutorial 2: VS Code Integration

**Goal**: Set up and use the VS Code extension effectively.

**Prerequisites**: Complete Tutorial 1

**Step 1: Install Extension** (2 minutes)

```bash
# Install extension
code --install-extension ast-copilot-helper

# Open project in VS Code
code .
```

**Step 2: Configure Extension** (3 minutes)
Create `.vscode/settings.json`:

```json
{
  "ast-copilot-helper.enableSemanticSearch": true,
  "ast-copilot-helper.maxResults": 10,
  "ast-copilot-helper.showInlineHints": true
}
```

**Step 3: Use Extension Features** (5 minutes)

1. **Code Search**:

   - Press `Cmd/Ctrl+Shift+P`
   - Type "AST: Search Codebase"
   - Search for "division operations"

2. **Find Similar Code**:

   - Select the `add` method
   - Right-click → "AST: Find Similar Functions"
   - See other mathematical operations

3. **Generate Documentation**:
   - Place cursor in a function
   - `Cmd/Ctrl+Shift+P` → "AST: Generate Documentation"

**Step 4: Verify Integration** (2 minutes)

- Check that status bar shows "AST: Ready"
- Hover over function names to see enhanced information
- Use autocomplete to see context-aware suggestions

### Tutorial 3: MCP Integration with AI

**Goal**: Connect your codebase to an AI assistant via MCP.

**Prerequisites**: Claude Desktop or compatible MCP client

**Step 1: Configure MCP Server** (3 minutes)

```json
// ~/.claude/config.json
{
  "mcp_servers": {
    "tutorial-project": {
      "command": "ast-helper",
      "args": ["server"],
      "cwd": "/path/to/tutorial-project"
    }
  }
}
```

**Step 2: Start Server** (2 minutes)

```bash
cd tutorial-project
ast-helper server --transport stdio
```

**Step 3: Test AI Integration** (5 minutes)

Open Claude Desktop and try these prompts:

```
Human: What mathematical operations are available in my codebase?

Claude: [Uses MCP to query your code]
Based on your codebase, you have a Calculator class with these mathematical operations:
- add(a, b) - Adds two numbers together
- subtract(a, b) - Subtracts second number from first
- multiply(a, b) - Multiplies two numbers
- divide(a, b) - Divides first number by second (with zero-check)
```
