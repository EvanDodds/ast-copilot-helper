# Installation Guide

This guide provides detailed installation instructions for ast-copilot-helper across all supported platforms and environments.

## System Requirements

### Minimum Requirements
- **Node.js**: 16.0 or later (18.0+ recommended)
- **npm**: 7.0 or later (comes with Node.js)
- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Memory**: 1GB RAM (2GB+ recommended for large codebases)
- **Storage**: 100MB free space + space for your codebase analysis

### Recommended Requirements
- **Node.js**: 20.0+ (for optimal performance)
- **npm**: 9.0+ (for improved dependency management)
- **Memory**: 4GB+ RAM (for processing large codebases)
- **Storage**: 1GB+ free space (for embeddings and analysis data)

## Installation Methods

### Method 1: NPM Global Installation (Recommended)

The easiest way to install ast-copilot-helper is via npm:

```bash
npm install -g @ast-copilot-helper/cli
```

Verify the installation:

```bash
ast-helper --version
# Output: @ast-copilot-helper/cli v1.0.0
```

#### Troubleshooting NPM Global Installation

**Permission errors on macOS/Linux:**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g @ast-copilot-helper/cli

# Option 2: Configure npm for global installs (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g @ast-copilot-helper/cli
```

**Permission errors on Windows:**
```powershell
# Run PowerShell as Administrator
npm install -g @ast-copilot-helper/cli
```

### Method 2: NPX (No Installation Required)

Use ast-copilot-helper without installing:

```bash
# Run commands with npx
npx @ast-copilot-helper/cli --version
npx @ast-copilot-helper/cli init
npx @ast-copilot-helper/cli parse src/
```

::: tip NPX Benefits
- No global installation required
- Always uses latest version
- Great for CI/CD environments
- Perfect for trying before installing
:::

### Method 3: Local Project Installation

Install as a project dependency:

```bash
# Add to your project
npm install @ast-copilot-helper/cli --save-dev

# Run via npm scripts
echo '{"scripts": {"ast-helper": "ast-helper"}}' >> package.json
npm run ast-helper -- --version
```

## Platform-Specific Installation

### Windows

#### Option 1: Using PowerShell (Recommended)

1. **Install Node.js:**
   ```powershell
   # Using Chocolatey
   choco install nodejs

   # Or download from nodejs.org
   # Visit: https://nodejs.org/en/download/
   ```

2. **Install ast-copilot-helper:**
   ```powershell
   npm install -g @ast-copilot-helper/cli
   ```

3. **Verify installation:**
   ```powershell
   ast-helper --version
   ```

#### Option 2: Using Windows Subsystem for Linux (WSL)

1. **Enable WSL:**
   ```powershell
   # Run as Administrator
   wsl --install
   ```

2. **Install Ubuntu:**
   ```bash
   wsl --install -d Ubuntu
   ```

3. **Follow Linux installation steps in WSL terminal**

### macOS

#### Option 1: Using Homebrew (Recommended)

1. **Install Homebrew (if not installed):**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Node.js:**
   ```bash
   brew install node
   ```

3. **Install ast-copilot-helper:**
   ```bash
   npm install -g @ast-copilot-helper/cli
   ```

#### Option 2: Using Node Version Manager (NVM)

1. **Install NVM:**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   ```

2. **Install and use Node.js:**
   ```bash
   nvm install 20
   nvm use 20
   ```

3. **Install ast-copilot-helper:**
   ```bash
   npm install -g @ast-copilot-helper/cli
   ```

### Linux

#### Ubuntu/Debian

1. **Update package manager:**
   ```bash
   sudo apt update
   ```

2. **Install Node.js:**
   ```bash
   # Option 1: From NodeSource repository (recommended)
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Option 2: From Ubuntu repositories (may be older)
   sudo apt install nodejs npm
   ```

3. **Install ast-copilot-helper:**
   ```bash
   npm install -g @ast-copilot-helper/cli
   ```

#### CentOS/RHEL/Fedora

1. **Install Node.js:**
   ```bash
   # Fedora
   sudo dnf install nodejs npm

   # CentOS/RHEL (with EPEL)
   sudo yum install nodejs npm
   ```

2. **Install ast-copilot-helper:**
   ```bash
   npm install -g @ast-copilot-helper/cli
   ```

#### Arch Linux

```bash
# Install Node.js
sudo pacman -S nodejs npm

# Install ast-copilot-helper
npm install -g @ast-copilot-helper/cli
```

## VS Code Extension

### Install from Marketplace

1. **Via VS Code Interface:**
   - Open VS Code
   - Go to Extensions (Ctrl/Cmd+Shift+X)
   - Search for "ast-copilot-helper"
   - Click Install

2. **Via Command Line:**
   ```bash
   code --install-extension ast-copilot-helper
   ```

### Install from VSIX (Development/Beta)

```bash
# Download VSIX file from releases
wget https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper.vsix

# Install VSIX
code --install-extension ast-copilot-helper.vsix
```

## Docker Installation

For containerized environments:

### Pre-built Docker Image

```bash
# Pull the image
docker pull astcopilothelper/cli:latest

# Run with your project mounted
docker run -v $(pwd):/workspace astcopilothelper/cli:latest ast-helper parse /workspace/src
```

### Build from Source

```bash
# Clone repository
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper

# Build Docker image
docker build -t ast-copilot-helper .

# Run container
docker run -v $(pwd):/workspace ast-copilot-helper ast-helper --version
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  ast-helper:
    image: astcopilothelper/cli:latest
    volumes:
      - .:/workspace
    working_dir: /workspace
    command: ["ast-helper", "server", "--transport", "http", "--port", "3001"]
    ports:
      - "3001:3001"
```

Run with:
```bash
docker-compose up
```

## Development Installation

For contributing to ast-copilot-helper:

### Prerequisites

- **Node.js 18+**
- **Git**
- **Python 3.8+** (for Python language support)

### Setup

```bash
# Clone repository
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper

# Install dependencies
npm install

# Build packages
npm run build

# Link for global usage
npm link

# Run tests
npm test
```

### Development Workflow

```bash
# Start development mode (auto-rebuild)
npm run dev

# Run specific package tests
npm run test:ast-helper
npm run test:mcp-server
npm run test:vscode-extension

# Lint and format code
npm run lint
npm run format

# Build for production
npm run build:prod
```

## Verification and Testing

After installation, verify everything works:

### Basic Verification

```bash
# Check version
ast-helper --version

# Check help
ast-helper --help

# Verify CLI works
ast-helper init --help
```

### Test with Sample Project

```bash
# Create test directory
mkdir ast-helper-test
cd ast-helper-test

# Initialize
ast-helper init

# Create sample file
echo 'function hello() { console.log("Hello!"); }' > test.js

# Parse sample file
ast-helper parse test.js

# Query sample
ast-helper query "console logging functions"
```

Expected output:
```
✅ Successfully parsed 1 file
📊 Extracted 1 annotation (1 function)
🎯 Generated 1 embedding for semantic search
💾 Saved to .ast-helper.db

🔍 Found 1 result for "console logging functions":
1. hello (test.js:1) - [Score: 0.89]
```

### VS Code Extension Verification

1. Open VS Code in a JavaScript/TypeScript project
2. Open Command Palette (Ctrl/Cmd+Shift+P)
3. Type "ast-helper" - you should see commands like:
   - "AST Helper: Parse Current File"
   - "AST Helper: Query Codebase"
   - "AST Helper: Show Tree View"

## Uninstallation

### Remove Global CLI

```bash
npm uninstall -g @ast-copilot-helper/cli
```

### Remove VS Code Extension

```bash
code --uninstall-extension ast-copilot-helper
```

### Clean Project Files

```bash
# Remove configuration and database
rm .ast-helper.json .ast-helper.db

# Remove from .gitignore (if added)
# Edit .gitignore and remove ast-helper entries
```

## Troubleshooting Installation

### Common Issues

#### "Command not found" after installation

**Cause**: PATH not configured correctly

**Solution**:
```bash
# Check npm global path
npm config get prefix

# Add to PATH (add to ~/.bashrc, ~/.zshrc, etc.)
export PATH="$(npm config get prefix)/bin:$PATH"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

#### Permission denied errors

**Cause**: Insufficient permissions for global installation

**Solutions**:
```bash
# Option 1: Configure npm directory (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Option 2: Use npx instead
npx @ast-copilot-helper/cli --version

# Option 3: Use sudo (not recommended)
sudo npm install -g @ast-copilot-helper/cli
```

#### Node.js version compatibility

**Cause**: Old Node.js version

**Solution**:
```bash
# Check current version
node --version

# Update Node.js
# Via package manager (recommended)
# Or download from nodejs.org

# Verify compatibility
ast-helper --version
```

#### Network/proxy issues

**Cause**: Corporate firewall or proxy

**Solutions**:
```bash
# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Or use alternative registry
npm config set registry https://registry.npmjs.org/

# Clear npm cache
npm cache clean --force
```

### Platform-Specific Issues

#### Windows: PowerShell execution policy

```powershell
# Check current policy
Get-ExecutionPolicy

# Set policy (run as Administrator)
Set-ExecutionPolicy RemoteSigned
```

#### macOS: Rosetta 2 (Apple Silicon)

```bash
# Install Rosetta 2 if needed
softwareupdate --install-rosetta

# Use Rosetta Terminal for x86 compatibility if needed
arch -x86_64 zsh
npm install -g @ast-copilot-helper/cli
```

#### Linux: Missing build tools

```bash
# Ubuntu/Debian
sudo apt install build-essential

# CentOS/RHEL
sudo yum groupinstall "Development Tools"

# Fedora
sudo dnf groupinstall "Development Tools"
```

## Next Steps

After successful installation:

1. 📖 **[Getting Started Guide](getting-started)** - Quick start tutorial
2. 🚀 **[CLI Usage Guide](cli-usage)** - Master the command line interface
3. ⚙️ **[Configuration Guide](configuration)** - Customize for your project
4. 🎨 **[VS Code Extension Guide](vscode-extension)** - Visual development experience
5. 🤖 **[AI Integration Guide](ai-integration)** - Connect with AI agents

## Support

Need help with installation?

- 💬 [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions) - Community support
- 🐛 [Report Issues](https://github.com/EvanDodds/ast-copilot-helper/issues) - Installation bugs
- 📖 [Troubleshooting Guide](../troubleshooting.md) - Common problems and solutions