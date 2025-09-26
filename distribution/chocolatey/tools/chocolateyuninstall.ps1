# Chocolatey Uninstall Script for AST Copilot Helper

$ErrorActionPreference = 'Stop'

$packageName = 'ast-copilot-helper'

# Remove the binary shim
Uninstall-BinFile -Name "ast-copilot-helper"

Write-Host "AST Copilot Helper has been uninstalled successfully!" -ForegroundColor Green