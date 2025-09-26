#!/bin/bash

# AST Copilot Helper Universal Installation Script
# Usage: curl -fsSL https://install.ast-copilot-helper.dev | bash
# Or: bash install.sh [options]

set -e

# Configuration
REPO="EvanDodds/ast-copilot-helper"
BINARY_NAME="ast-copilot-helper"
DEFAULT_INSTALL_DIR="/usr/local/bin"
VERSION="latest"
FORCE_INSTALL=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
AST Copilot Helper Installation Script

Usage: $0 [OPTIONS]

OPTIONS:
    --dir DIR           Installation directory (default: $DEFAULT_INSTALL_DIR)
    --version VERSION   Version to install (default: latest)
    --force            Force installation even if already installed
    --verbose          Enable verbose output
    --help             Show this help message

Examples:
    $0                                    # Install latest to /usr/local/bin
    $0 --dir ~/.local/bin                # Install to user directory  
    $0 --version v1.2.0                  # Install specific version
    $0 --force --verbose                 # Force reinstall with verbose output

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dir)
            DEFAULT_INSTALL_DIR="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --force)
            FORCE_INSTALL=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Detect operating system and architecture
detect_platform() {
    local os arch
    
    case "$(uname -s)" in
        Linux*)
            os="linux"
            ;;
        Darwin*)
            os="darwin"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            os="win"
            ;;
        *)
            log_error "Unsupported operating system: $(uname -s)"
            exit 1
            ;;
    esac
    
    case "$(uname -m)" in
        x86_64|amd64)
            arch="x64"
            ;;
        arm64|aarch64)
            arch="arm64"
            ;;
        armv7l)
            arch="arm"
            ;;
        *)
            log_error "Unsupported architecture: $(uname -m)"
            exit 1
            ;;
    esac
    
    echo "${os}-${arch}"
}

# Get latest version from GitHub API
get_latest_version() {
    if command -v curl >/dev/null 2>&1; then
        curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep -o '"tag_name": "[^"]*' | sed 's/"tag_name": "//'
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep -o '"tag_name": "[^"]*' | sed 's/"tag_name": "//'
    else
        log_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi
}

# Check if binary already exists
check_existing_installation() {
    if command -v "$BINARY_NAME" >/dev/null 2>&1; then
        local existing_version
        existing_version=$($BINARY_NAME --version 2>/dev/null | head -1)
        log_warn "$BINARY_NAME is already installed: $existing_version"
        
        if [ "$FORCE_INSTALL" != "true" ]; then
            echo "Use --force to reinstall"
            exit 0
        fi
    fi
}

# Download and install binary
install_binary() {
    local platform="$1"
    local version="$2"
    local install_dir="$3"
    
    # Determine file extension and binary name based on platform
    local file_ext archive_name binary_path
    case "$platform" in
        win-*)
            file_ext="zip"
            archive_name="${BINARY_NAME}-${platform}.${file_ext}"
            binary_path="${BINARY_NAME}.exe"
            ;;
        *)
            file_ext="tar.gz"
            archive_name="${BINARY_NAME}-${platform}.${file_ext}"
            binary_path="${BINARY_NAME}"
            ;;
    esac
    
    # Construct download URL
    local download_url="https://github.com/${REPO}/releases/download/${version}/${archive_name}"
    
    log_info "Downloading $BINARY_NAME $version for $platform..."
    log_info "URL: $download_url"
    
    # Create temporary directory
    local temp_dir
    temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT
    
    # Download archive
    local archive_path="$temp_dir/$archive_name"
    if command -v curl >/dev/null 2>&1; then
        if ! curl -fsSL -o "$archive_path" "$download_url"; then
            log_error "Failed to download $archive_name"
            exit 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -q -O "$archive_path" "$download_url"; then
            log_error "Failed to download $archive_name"
            exit 1
        fi
    else
        log_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi
    
    log_info "Extracting archive..."
    
    # Extract archive
    case "$file_ext" in
        "tar.gz")
            tar -xzf "$archive_path" -C "$temp_dir"
            ;;
        "zip")
            if command -v unzip >/dev/null 2>&1; then
                unzip -q "$archive_path" -d "$temp_dir"
            else
                log_error "unzip command not found. Please install unzip."
                exit 1
            fi
            ;;
    esac
    
    # Find extracted binary
    local extracted_binary="$temp_dir/$binary_path"
    if [ ! -f "$extracted_binary" ]; then
        # Try to find binary in subdirectory
        extracted_binary=$(find "$temp_dir" -name "$binary_path" -type f | head -1)
        if [ -z "$extracted_binary" ]; then
            log_error "Binary not found in extracted archive"
            exit 1
        fi
    fi
    
    # Create install directory if it doesn't exist
    if [ ! -d "$install_dir" ]; then
        log_info "Creating install directory: $install_dir"
        mkdir -p "$install_dir" || {
            log_error "Failed to create install directory. You may need to run with sudo."
            exit 1
        }
    fi
    
    # Install binary
    local final_binary_path="$install_dir/$BINARY_NAME"
    if [[ "$platform" == win-* ]]; then
        final_binary_path="${final_binary_path}.exe"
    fi
    
    log_info "Installing binary to $final_binary_path..."
    cp "$extracted_binary" "$final_binary_path" || {
        log_error "Failed to install binary. You may need to run with sudo."
        exit 1
    }
    
    # Make executable (Unix-like systems)
    if [[ "$platform" != win-* ]]; then
        chmod +x "$final_binary_path"
    fi
    
    log_success "$BINARY_NAME installed successfully!"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    if command -v "$BINARY_NAME" >/dev/null 2>&1; then
        local version_output
        version_output=$($BINARY_NAME --version)
        log_success "Verification successful: $version_output"
        
        # Quick functionality test
        if $BINARY_NAME --help >/dev/null 2>&1; then
            log_success "Basic functionality test passed"
        else
            log_warn "Binary installed but help command failed"
        fi
    else
        log_warn "Binary installed but not in PATH. You may need to:"
        echo "  - Add $DEFAULT_INSTALL_DIR to your PATH"
        echo "  - Run: export PATH=\"$DEFAULT_INSTALL_DIR:\$PATH\""
        echo "  - Add the above line to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
    fi
}

# Main installation process
main() {
    log_info "Starting AST Copilot Helper installation..."
    
    # Detect platform
    local platform
    platform=$(detect_platform)
    log_info "Detected platform: $platform"
    
    # Get version to install
    if [ "$VERSION" = "latest" ]; then
        VERSION=$(get_latest_version)
        log_info "Latest version: $VERSION"
    else
        log_info "Installing version: $VERSION"
    fi
    
    # Check existing installation
    check_existing_installation
    
    # Install binary
    install_binary "$platform" "$VERSION" "$DEFAULT_INSTALL_DIR"
    
    # Verify installation
    verify_installation
    
    log_success "Installation complete!"
    echo
    echo "You can now use $BINARY_NAME by running:"
    echo "  $BINARY_NAME --version"
    echo "  $BINARY_NAME --help"
    echo
    echo "For getting started, see:"
    echo "  https://github.com/$REPO/blob/main/docs/guide/getting-started.md"
}

# Run main function
main "$@"