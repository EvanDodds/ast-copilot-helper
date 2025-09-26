# AST Copilot Helper Windows Installation Script
# Usage: irm https://install.ast-copilot-helper.dev/windows | iex
# Or: .\install.ps1 [parameters]

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\ast-copilot-helper",
    [string]$Version = "latest",
    [switch]$Force,
    [switch]$Verbose,
    [switch]$Help,
    [switch]$AddToPath = $true
)

# Configuration
$ErrorActionPreference = "Stop"
$Repo = "your-org/ast-copilot-helper"
$BinaryName = "ast-copilot-helper"

# Colors for output
$Colors = @{
    Red    = "Red"
    Green  = "Green" 
    Yellow = "Yellow"
    Blue   = "Blue"
    White  = "White"
}

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

# Help function
function Show-Help {
    @"
AST Copilot Helper Windows Installation Script

Usage: .\install.ps1 [PARAMETERS]

PARAMETERS:
    -InstallDir DIR     Installation directory (default: $env:LOCALAPPDATA\ast-copilot-helper)
    -Version VERSION    Version to install (default: latest)
    -Force             Force installation even if already installed
    -Verbose           Enable verbose output
    -AddToPath         Add installation directory to PATH (default: true)
    -Help              Show this help message

Examples:
    .\install.ps1                                   # Install latest to user directory
    .\install.ps1 -InstallDir "C:\Tools"           # Install to custom directory
    .\install.ps1 -Version "v1.2.0"                # Install specific version
    .\install.ps1 -Force -Verbose                  # Force reinstall with verbose output

"@ | Write-Host
}

# Show help if requested
if ($Help) {
    Show-Help
    exit 0
}

# Detect architecture
function Get-Architecture {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "x64" }
        "ARM64" { return "arm64" }
        "x86" { return "x86" }
        default {
            Write-Error "Unsupported architecture: $arch"
            exit 1
        }
    }
}

# Get latest version from GitHub API
function Get-LatestVersion {
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        return $response.tag_name
    }
    catch {
        Write-Error "Failed to get latest version: $_"
        exit 1
    }
}

# Check if binary already exists
function Test-ExistingInstallation {
    try {
        $existingVersion = & $BinaryName --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Warn "$BinaryName is already installed: $existingVersion"
            
            if (-not $Force) {
                Write-Host "Use -Force to reinstall"
                exit 0
            }
        }
    }
    catch {
        # Binary not found or not working, proceed with installation
    }
}

# Download and install binary
function Install-Binary {
    param(
        [string]$Architecture,
        [string]$InstallVersion,
        [string]$TargetDir
    )
    
    # Construct download URL (match our binary builder naming)
    $archiveName = "$BinaryName-win32-$Architecture.zip"
    $downloadUrl = "https://github.com/$Repo/releases/download/$InstallVersion/$archiveName"
    
    Write-Info "Downloading $BinaryName $InstallVersion for Windows $Architecture..."
    Write-Info "URL: $downloadUrl"
    
    # Create temporary directory
    $tempDir = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        # Download archive
        $archivePath = Join-Path $tempDir $archiveName
        Write-Info "Downloading to: $archivePath"
        
        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing
        }
        catch {
            Write-Error "Failed to download $archiveName`: $_"
            exit 1
        }
        
        Write-Info "Extracting archive..."
        
        # Extract archive
        try {
            Expand-Archive -Path $archivePath -DestinationPath $tempDir -Force
        }
        catch {
            Write-Error "Failed to extract archive: $_"
            exit 1
        }
        
        # Find extracted binary
        $extractedBinary = Get-ChildItem -Path $tempDir -Name "$BinaryName.exe" -Recurse | Select-Object -First 1
        if (-not $extractedBinary) {
            Write-Error "Binary not found in extracted archive"
            exit 1
        }
        
        $extractedBinaryPath = Join-Path $tempDir $extractedBinary.Name
        
        # Create install directory if it doesn't exist
        if (-not (Test-Path $TargetDir)) {
            Write-Info "Creating install directory: $TargetDir"
            New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
        }
        
        # Install binary
        $finalBinaryPath = Join-Path $TargetDir "$BinaryName.exe"
        Write-Info "Installing binary to $finalBinaryPath..."
        
        try {
            Copy-Item -Path $extractedBinaryPath -Destination $finalBinaryPath -Force
        }
        catch {
            Write-Error "Failed to install binary: $_"
            exit 1
        }
        
        Write-Success "$BinaryName installed successfully!"
        
        # Add to PATH if requested
        if ($AddToPath) {
            Add-ToPath -Directory $TargetDir
        }
    }
    finally {
        # Clean up temporary directory
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force
        }
    }
}

# Add directory to user PATH
function Add-ToPath {
    param([string]$Directory)
    
    Write-Info "Adding $Directory to user PATH..."
    
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    
    if ($userPath -notlike "*$Directory*") {
        $newPath = if ($userPath) { "$userPath;$Directory" } else { $Directory }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Success "Added to PATH. Please restart your terminal or run: refreshenv"
        
        # Update current session PATH
        $env:Path = "$env:Path;$Directory"
    } else {
        Write-Info "Directory already in PATH"
    }
}

# Verify installation
function Test-Installation {
    Write-Info "Verifying installation..."
    
    # Refresh environment variables for current session
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    
    try {
        $versionOutput = & $BinaryName --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Verification successful: $versionOutput"
            
            # Quick functionality test
            & $BinaryName --help >$null 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Basic functionality test passed"
            } else {
                Write-Warn "Binary installed but help command failed"
            }
        } else {
            throw "Version command failed"
        }
    }
    catch {
        Write-Warn "Binary installed but not accessible. You may need to:"
        Write-Host "  - Restart your terminal"
        Write-Host "  - Run: refreshenv"
        Write-Host "  - Manually add $InstallDir to your PATH"
    }
}

# Main installation process
function Main {
    Write-Info "Starting AST Copilot Helper installation..."
    
    # Check if running as administrator (optional warning)
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if ($isAdmin) {
        Write-Warn "Running as administrator. Consider running as regular user to install to user directory."
    }
    
    # Detect architecture
    $architecture = Get-Architecture
    Write-Info "Detected architecture: Windows $architecture"
    
    # Get version to install
    if ($Version -eq "latest") {
        $Version = Get-LatestVersion
        Write-Info "Latest version: $Version"
    } else {
        Write-Info "Installing version: $Version"
    }
    
    # Check existing installation
    Test-ExistingInstallation
    
    # Install binary
    Install-Binary -Architecture $architecture -InstallVersion $Version -TargetDir $InstallDir
    
    # Verify installation
    Test-Installation
    
    Write-Success "Installation complete!"
    Write-Host ""
    Write-Host "You can now use $BinaryName by running:" -ForegroundColor White
    Write-Host "  $BinaryName --version" -ForegroundColor Gray
    Write-Host "  $BinaryName --help" -ForegroundColor Gray
    Write-Host ""
    Write-Host "For getting started, see:" -ForegroundColor White
    Write-Host "  https://github.com/$Repo/blob/main/docs/guide/getting-started.md" -ForegroundColor Gray
}

# Run main function
try {
    Main
}
catch {
    Write-Error "Installation failed: $_"
    exit 1
}