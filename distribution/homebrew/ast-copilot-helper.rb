class AstCopilotHelper < Formula
  desc "Advanced AST-powered development assistant for intelligent code analysis"
  homepage "https://github.com/your-org/ast-copilot-helper"
  version "1.0.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/your-org/ast-copilot-helper/releases/download/v#{version}/ast-copilot-helper-darwin-x64.zip"
      sha256 "PLACEHOLDER_INTEL_SHA256"
    end
    
    if Hardware::CPU.arm?
      url "https://github.com/your-org/ast-copilot-helper/releases/download/v#{version}/ast-copilot-helper-darwin-arm64.zip"
      sha256 "PLACEHOLDER_ARM_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/your-org/ast-copilot-helper/releases/download/v#{version}/ast-copilot-helper-linux-x64.tar.gz"
      sha256 "PLACEHOLDER_LINUX_SHA256"
    end
    
    if Hardware::CPU.arm? && Hardware::CPU.is_64_bit?
      url "https://github.com/your-org/ast-copilot-helper/releases/download/v#{version}/ast-copilot-helper-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER_LINUX_ARM_SHA256"
    end
  end

  depends_on "node" => :test

  def install
    bin.install "ast-copilot-helper"
    
    # Install shell completions if they exist
    if (buildpath/"completions").exist?
      bash_completion.install "completions/ast-copilot-helper.bash" => "ast-copilot-helper"
      zsh_completion.install "completions/_ast-copilot-helper"
      fish_completion.install "completions/ast-copilot-helper.fish"
    end
    
    # Install man page if it exists
    if (buildpath/"man").exist?
      man1.install "man/ast-copilot-helper.1"
    end
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/ast-copilot-helper --version")
    
    # Test basic functionality
    (testpath/"test.js").write("console.log('hello world');")
    assert_match "hello world", shell_output("#{bin}/ast-copilot-helper analyze #{testpath}/test.js")
  end

  def caveats
    <<~EOS
      AST Copilot Helper has been installed!
      
      To get started:
        1. Initialize in your project: ast-copilot-helper init
        2. Run analysis: ast-copilot-helper analyze
        3. View help: ast-copilot-helper --help
      
      For VS Code integration, install the companion extension:
        code --install-extension ast-copilot-helper
    EOS
  end
end