Name: ast-copilot-helper
Version: 1.0.0
Release: 1%{?dist}
Summary: Advanced AST-powered development assistant for intelligent code analysis
Group: Development/Tools
License: MIT
URL: https://github.com/your-org/ast-copilot-helper
Source0: ast-copilot-helper-%{version}.tar.gz
BuildArch: x86_64
Requires: glibc >= 2.17

%description
AST Copilot Helper is a powerful command-line tool that provides advanced
Abstract Syntax Tree (AST) analysis and intelligent code insights for multiple
programming languages. It helps developers understand code structure, identify
patterns, and improve code quality through sophisticated static analysis.

Key Features:
* Multi-language Support: Supports 15+ programming languages including
  JavaScript, TypeScript, Python, Go, Rust, and more
* AST Analysis: Deep structural code analysis using native parsers
* Intelligent Insights: AI-powered code suggestions and improvements
* VS Code Integration: Seamless integration with Visual Studio Code
* Performance Optimized: Built with Rust for maximum performance
* Cross-platform: Works on Windows, macOS, and Linux

%prep
%setup -q

%build
# Nothing to build, using pre-compiled binary

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/usr/local/bin
install -m 755 ast-copilot-helper %{buildroot}/usr/local/bin/ast-copilot-helper

# Create symlink in /usr/bin for easier access
mkdir -p %{buildroot}/usr/bin
ln -sf /usr/local/bin/ast-copilot-helper %{buildroot}/usr/bin/ast-copilot-helper

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
/usr/local/bin/ast-copilot-helper
/usr/bin/ast-copilot-helper

%post
echo "AST Copilot Helper has been installed successfully!"
echo ""
echo "To get started:"
echo "  1. Navigate to your project directory"
echo "  2. Run: ast-copilot-helper init"
echo "  3. Run: ast-copilot-helper analyze"
echo ""
echo "For help: ast-copilot-helper --help"

%postun
if [ $1 -eq 0 ]; then
    echo "AST Copilot Helper has been uninstalled."
fi

%changelog
* Mon Jan 01 2024 AST Copilot Helper Team <support@example.com> - 1.0.0-1
- Initial RPM package release
- Complete AST analysis engine
- Multi-language parser support
- VS Code extension integration
- Cross-platform binary distribution