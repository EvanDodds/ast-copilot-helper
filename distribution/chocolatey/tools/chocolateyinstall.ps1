# Chocolatey Install Script for AST Copilot Helper

$ErrorActionPreference = 'Stop'

$packageName = 'ast-copilot-helper'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$version = $env:ChocolateyPackageVersion

# Determine architecture
$architecture = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }

# Download URL - this will be updated by the build process
$url64 = "https://github.com/your-org/ast-copilot-helper/releases/download/v$version/ast-copilot-helper-win32-x64.zip"

$packageArgs = @{
    packageName    = $packageName
    unzipLocation  = $toolsDir
    url64bit       = $url64
    checksum64     = 'PLACEHOLDER_CHECKSUM'
    checksumType64 = 'sha256'
    
    validExitCodes = @(0)
}

# Download and extract the binary
Install-ChocolateyZipPackage @packageArgs

# Create shim for the binary
$binaryPath = Join-Path $toolsDir "ast-copilot-helper.exe"

# Verify the binary exists
if (-not (Test-Path $binaryPath)) {
    throw "Binary not found at expected location: $binaryPath"
}

# Install the binary to PATH via Chocolatey shim
Install-BinFile -Name "ast-copilot-helper" -Path $binaryPath

Write-Host "AST Copilot Helper has been installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To get started:" -ForegroundColor Yellow
Write-Host "  1. Open a new command prompt or PowerShell window"
Write-Host "  2. Navigate to your project directory"
Write-Host "  3. Run: ast-copilot-helper init"
Write-Host "  4. Run: ast-copilot-helper analyze"
Write-Host ""
Write-Host "For help: ast-copilot-helper --help" -ForegroundColor Cyan