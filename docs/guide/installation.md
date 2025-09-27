# Installation Guide

This guide provides detailed installation instructions for AST Copilot Helper across all supported platforms and environments.

## System Requirements

### Minimum Requirements

- **Node.js**: 20.0 or later (for ES modules and modern features)
- **npm**: 10.0+ or **pnpm**: 8.0+ (recommended for better performance)
- **Operating System**: Windows 10+, macOS 12+, Linux (Ubuntu 20.04+)
- **Memory**: 2GB RAM (4GB+ recommended for large codebases)
- **Storage**: 200MB free space + space for your codebase analysis and embeddings

### Recommended Requirements

- **Node.js**: 20.0+ LTS (for optimal performance and stability)
- **pnpm**: 9.0+ (for faster dependency management)
- **Memory**: 8GB+ RAM (for processing large monorepos)
- **Storage**: 2GB+ free space (for embeddings cache and analysis data)

## Installation Methods

### Quick Method Comparison

| Method                 | Best For                       | Node.js Required | Update Management          | Performance                     |
| ---------------------- | ------------------------------ | ---------------- | -------------------------- | ------------------------------- |
| **Pre-built Binaries** | End users, CI/CD               | ❌ No            | Package managers or manual | ⚡ Fastest                      |
| **NPM Global**         | Developers, Node.js users      | ✅ Yes           | `npm update -g`            | 🔄 Good                         |
| **PNPM Global**        | Performance-focused developers | ✅ Yes           | `pnpm update -g`           | 🚀 Better                       |
| **NPX**                | One-time usage, testing        | ✅ Yes           | Always latest              | 🐌 Slower (downloads each time) |
| **Local Project**      | Project-specific installs      | ✅ Yes           | `npm update`               | 🔄 Good                         |
| **Docker**             | Containerized environments     | ❌ No            | `docker pull`              | 🔄 Good (after initial pull)    |

### Method 1: Pre-built Binaries (Recommended for End Users)

**Best for**: End users who want a simple, standalone installation without Node.js dependencies.

Download and install pre-built binaries for your platform:

#### Windows

**Option A: Using PowerShell (Automatic)**

```powershell
# Download and install latest version
irm https://raw.githubusercontent.com/EvanDodds/ast-copilot-helper/main/install.ps1 | iex

# Or manually download
$url = "https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper-win-x64.zip"
Invoke-WebRequest -Uri $url -OutFile "ast-copilot-helper-win-x64.zip"
Expand-Archive "ast-copilot-helper-win-x64.zip" -DestinationPath "$env:LOCALAPPDATA\ast-copilot-helper"

# Add to PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$env:LOCALAPPDATA\ast-copilot-helper", "User")
```

**Option B: Manual Installation**

1. Download: [ast-copilot-helper-win-x64.zip](https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper-win-x64.zip)
2. Extract to `C:\Program Files\ast-copilot-helper\`
3. Add `C:\Program Files\ast-copilot-helper\` to your PATH

**Option C: Using Chocolatey**

```powershell
# Install via Chocolatey (if available)
choco install ast-copilot-helper
```

#### macOS

**Option A: Using Homebrew (Recommended)**

```bash
# Add tap and install
brew tap EvanDodds/ast-copilot-helper
brew install ast-copilot-helper

# Or install directly from cask
brew install --cask ast-copilot-helper
```

**Option B: Manual Installation**

```bash
# Download for Intel Macs
curl -L -o ast-copilot-helper-darwin-x64.tar.gz \
  https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper-darwin-x64.tar.gz

# Download for Apple Silicon Macs
curl -L -o ast-copilot-helper-darwin-arm64.tar.gz \
  https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper-darwin-arm64.tar.gz

# Extract and install
tar -xzf ast-copilot-helper-darwin-*.tar.gz
sudo mv ast-copilot-helper /usr/local/bin/
chmod +x /usr/local/bin/ast-copilot-helper
```

**Option C: Using MacPorts**

```bash
# Install via MacPorts (if available)
sudo port install ast-copilot-helper
```

#### Linux

**Option A: Using Package Managers**

```bash
# Ubuntu/Debian - Install .deb package
curl -L -o ast-copilot-helper.deb \
  https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper_amd64.deb
sudo dpkg -i ast-copilot-helper.deb

# CentOS/RHEL/Fedora - Install .rpm package
curl -L -o ast-copilot-helper.rpm \
  https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper.x86_64.rpm
sudo rpm -i ast-copilot-helper.rpm

# Arch Linux - Install from AUR
yay -S ast-copilot-helper-bin
# or
pamac install ast-copilot-helper-bin

# Alpine Linux
apk add --no-cache ast-copilot-helper

# Snap package (universal)
sudo snap install ast-copilot-helper

# Flatpak
flatpak install flathub com.github.EvanDodds.ast-copilot-helper
```

**Option B: Universal Linux Binary**

```bash
# Download generic Linux binary
curl -L -o ast-copilot-helper-linux-x64.tar.gz \
  https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper-linux-x64.tar.gz

# Extract and install
tar -xzf ast-copilot-helper-linux-x64.tar.gz
sudo mv ast-copilot-helper /usr/local/bin/
chmod +x /usr/local/bin/ast-copilot-helper

# Verify installation
ast-copilot-helper --version
```

**Option C: AppImage (Portable)**

```bash
# Download AppImage
curl -L -o ast-copilot-helper.AppImage \
  https://github.com/EvanDodds/ast-copilot-helper/releases/latest/download/ast-copilot-helper.AppImage

# Make executable and run
chmod +x ast-copilot-helper.AppImage
./ast-copilot-helper.AppImage --version

# Optional: Integrate with system
./ast-copilot-helper.AppImage --appimage-integrate
```

#### Verification of Binary Installation

After installing via any binary method:

```bash
# Verify installation
ast-copilot-helper --version
# Expected: ast-copilot-helper v1.x.x (binary)

# Test basic functionality
ast-copilot-helper --help
ast-copilot-helper init --dry-run
```

#### Automatic Installation Script

For the quickest setup, use our universal installation script:

```bash
# Unix/Linux/macOS - Universal installer
curl -fsSL https://install.ast-copilot-helper.dev | bash

# Windows PowerShell - Universal installer
irm https://install.ast-copilot-helper.dev/windows | iex

# With custom installation directory
curl -fsSL https://install.ast-copilot-helper.dev | bash -s -- --dir=/opt/ast-copilot-helper

# Install specific version
curl -fsSL https://install.ast-copilot-helper.dev | bash -s -- --version=v1.2.0
```

This script will:

- Detect your operating system and architecture
- Download the appropriate binary
- Install it to the correct system location
- Add it to your PATH
- Verify the installation

#### Binary Installation Benefits

- ✅ **No Node.js required** - Standalone executable
- ✅ **Fast startup** - Pre-compiled binaries
- ✅ **Consistent performance** - No dependency conflicts
- ✅ **Easy distribution** - Single file installation
- ✅ **Offline capable** - No internet required after download
- ✅ **System integration** - Native OS packaging
- ✅ **Package manager support** - Available via Homebrew, Chocolatey, APT, RPM
- ✅ **Automatic updates** - Via package managers

#### Binary Installation Limitations

- ⚠️ **Platform-specific** - Must download correct architecture
- ⚠️ **Update management** - Manual updates (unless using package manager)
- ⚠️ **Plugin limitations** - Some advanced plugins may require Node.js
- ⚠️ **File size** - Larger than npm installation due to bundled runtime
- ⚠️ **Container overhead** - May be larger in containerized environments

### Method 2: NPM Global Installation

Install AST Copilot Helper globally via npm:

```bash
npm install -g ast-copilot-helper
```

Verify the installation:

```bash
ast-copilot-helper --version
# Output: ast-copilot-helper v1.0.0
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
npm install -g ast-copilot-helper
```

**Permission errors on Windows:**

```powershell
# Run PowerShell as Administrator
npm install -g ast-copilot-helper
```

### Method 3: PNPM Global Installation (Recommended for Developers)

Install with pnpm for better performance:

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install AST Copilot Helper with pnpm
pnpm add -g ast-copilot-helper
```

Verify the installation:

```bash
ast-copilot-helper --version
```

### Method 4: NPX (No Installation Required)

Use AST Copilot Helper without installing:

```bash
# Run commands with npx
npx ast-copilot-helper --version
npx ast-copilot-helper init
npx ast-copilot-helper parse src/
```

::: tip NPX Benefits

- No global installation required
- Always uses latest version
- Great for CI/CD environments
- Perfect for trying before installing
  :::

### Method 5: Local Project Installation

Install as a project dependency:

```bash
# Add to your project with npm
npm install ast-copilot-helper --save-dev

# Or with pnpm
pnpm add -D ast-copilot-helper

# Run via npm scripts
echo '{"scripts": {"analyze": "ast-copilot-helper"}}' >> package.json
npm run analyze -- --version
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
   ast-copilot-helper --version
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
docker run -v $(pwd):/workspace astcopilothelper/cli:latest ast-copilot-helper parse /workspace/src
```

### Build from Source

```bash
# Clone repository
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper

# Build Docker image
docker build -t ast-copilot-helper .

# Run container
docker run -v $(pwd):/workspace ast-copilot-helper ast-copilot-helper --version
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: "3.8"
services:
  ast-copilot-helper:
    image: astcopilothelper/cli:latest
    volumes:
      - .:/workspace
    working_dir: /workspace
    command:
      ["ast-copilot-helper", "server", "--transport", "http", "--port", "3001"]
    ports:
      - "3001:3001"
```

Run with:

```bash
docker-compose up
```

## Alternative Package Managers

### Nix Package Manager

```bash
# Install via Nix
nix-env -iA nixpkgs.ast-copilot-helper

# Or add to configuration.nix
environment.systemPackages = [ pkgs.ast-copilot-helper ];

# Nix flake usage
nix run github:EvanDodds/ast-copilot-helper
```

### Scoop (Windows)

```powershell
# Add bucket and install
scoop bucket add ast-copilot-helper https://github.com/EvanDodds/scoop-ast-copilot-helper
scoop install ast-copilot-helper
```

### Winget (Windows)

```powershell
# Install via Windows Package Manager
winget install EvanDodds.ast-copilot-helper

# Search for package
winget search ast-copilot-helper
```

### Conda/Mamba

```bash
# Install via conda-forge
conda install -c conda-forge ast-copilot-helper

# Or using mamba (faster)
mamba install -c conda-forge ast-copilot-helper

# In conda environment
conda create -n ast-helper ast-copilot-helper
conda activate ast-helper
```

## Container and Cloud Distributions

### GitHub Codespaces

Create `.devcontainer/devcontainer.json`:

```json
{
  "name": "AST Copilot Helper Development",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "features": {
    "ghcr.io/EvanDodds/devcontainers/ast-copilot-helper:latest": {}
  },
  "postCreateCommand": "ast-copilot-helper --version",
  "customizations": {
    "vscode": {
      "extensions": ["EvanDodds.ast-copilot-helper"]
    }
  }
}
```

### GitPod

Add `.gitpod.yml`:

```yaml
image: gitpod/workspace-node

tasks:
  - name: Install AST Copilot Helper
    init: |
      npm install -g ast-copilot-helper
      ast-copilot-helper --version
    command: |
      echo "AST Copilot Helper ready!"

vscode:
  extensions:
    - EvanDodds.ast-copilot-helper
```

### Kubernetes/Helm

```bash
# Add Helm repository
helm repo add ast-copilot-helper https://charts.ast-copilot-helper.dev
helm repo update

# Install in cluster
helm install ast-helper ast-copilot-helper/ast-copilot-helper \
  --set service.type=LoadBalancer \
  --set persistence.enabled=true

# Install as job runner
helm install ast-analyzer ast-copilot-helper/ast-batch-analyzer \
  --set job.repository="https://github.com/your-org/your-repo"
```

### Cloud Run / Lambda Deployment

**Google Cloud Run:**

```bash
# Deploy pre-built container
gcloud run deploy ast-copilot-helper \
  --image gcr.io/ast-copilot-helper/server:latest \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1

# Use in Cloud Build
echo "steps:
- name: 'gcr.io/ast-copilot-helper/cli:latest'
  args: ['parse', 'src/', '--format', 'json']
  dir: '/workspace'" > cloudbuild.yaml
```

**AWS Lambda:**

```bash
# Deploy serverless function
npm install -g serverless
serverless create --template aws-nodejs --path ast-copilot-helper-lambda
cd ast-copilot-helper-lambda

# Install layer
serverless plugin install -n serverless-ast-copilot-helper
serverless deploy
```

## Development Installation

For contributing to ast-copilot-helper:

### Prerequisites

- **Node.js 20+** (24+ recommended)
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
npm run test:ast-copilot-helper
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
# Check version and installation method
ast-copilot-helper --version
# Expected outputs:
# - "ast-copilot-helper v1.x.x (npm)" - for npm installation
# - "ast-copilot-helper v1.x.x (binary)" - for binary installation
# - "ast-copilot-helper v1.x.x (source)" - for development installation

# Check help
ast-copilot-helper --help

# Verify CLI works
ast-copilot-helper init --help

# Check installation info
ast-copilot-helper doctor
```

### Installation Method Verification

```bash
# Check how ast-copilot-helper was installed
ast-copilot-helper --version --verbose

# For binary installations
which ast-copilot-helper
file $(which ast-copilot-helper)  # Shows if it's a binary or script

# For npm installations
npm list -g ast-copilot-helper

# For development installations
ast-copilot-helper --build-info
```

### Test with Sample Project

```bash
# Create test directory
mkdir ast-copilot-helper-test
cd ast-copilot-helper-test

# Initialize
ast-copilot-helper init

# Create sample file
echo 'function hello() { console.log("Hello!"); }' > test.js

# Parse sample file
ast-copilot-helper parse test.js

# Query sample
ast-copilot-helper query "console logging functions"
```

Expected output:

```
✅ Successfully parsed 1 file
📊 Extracted 1 annotation (1 function)
🎯 Generated 1 embedding for semantic search
💾 Saved to .ast-copilot-helper.db

🔍 Found 1 result for "console logging functions":
1. hello (test.js:1) - [Score: 0.89]
```

### VS Code Extension Verification

1. Open VS Code in a JavaScript/TypeScript project
2. Open Command Palette (Ctrl/Cmd+Shift+P)
3. Type "ast-copilot-helper" - you should see commands like:
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
rm .ast-copilot-helper.json .ast-copilot-helper.db

# Remove from .gitignore (if added)
# Edit .gitignore and remove ast-copilot-helper entries
```

## Troubleshooting Installation

### Common Issues

#### Binary installation issues

**Binary not executable on Linux/macOS:**

```bash
# Make binary executable
chmod +x /usr/local/bin/ast-copilot-helper

# Check file permissions
ls -la $(which ast-copilot-helper)
```

**Architecture mismatch:**

```bash
# Check your system architecture
uname -m
# x86_64 = download x64 version
# arm64/aarch64 = download arm64 version

# Verify binary architecture
file $(which ast-copilot-helper)
```

**macOS Gatekeeper blocking unsigned binary:**

```bash
# Allow unsigned binary (not recommended for production)
sudo spctl --master-disable

# Or allow specific binary
sudo spctl --add /usr/local/bin/ast-copilot-helper

# Re-enable Gatekeeper
sudo spctl --master-enable
```

**Windows SmartScreen blocking download:**

1. Click "More info" in SmartScreen dialog
2. Click "Run anyway"
3. Or download from GitHub releases directly

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
ast-copilot-helper --version
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
