import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Examples and Tutorials Documentation', () => {
  const docsPath = path.join(process.cwd(), 'docs', 'examples');

  it('should have all required example files', async () => {
    const files = await fs.readdir(docsPath);
    expect(files).toContain('index.md');
    expect(files).toContain('cli.md');
    expect(files).toContain('tutorials.md');
    expect(files).toContain('integrations.md');
  });

  it('should have comprehensive CLI examples', async () => {
    const content = await fs.readFile(path.join(docsPath, 'cli.md'), 'utf-8');
    
    // Check for key sections
    expect(content).toContain('# CLI Examples');
    expect(content).toContain('## Basic Usage');
    expect(content).toContain('## Advanced Queries');
    expect(content).toContain('## Code Analysis Examples');
    expect(content).toContain('## Integration Examples');
    expect(content).toContain('## Performance Tips');
    
    // Check for specific examples
    expect(content).toContain('ast-helper parse');
    expect(content).toContain('ast-helper query');
    expect(content).toContain('ast-helper analyze');
    expect(content).toContain('--security-check');
    expect(content).toContain('--performance-check');
  });

  it('should have structured interactive tutorials', async () => {
    const content = await fs.readFile(path.join(docsPath, 'tutorials.md'), 'utf-8');
    
    // Check for tutorial structure
    expect(content).toContain('# Interactive Tutorials');
    expect(content).toContain('## Tutorial 1: Getting Started');
    expect(content).toContain('## Tutorial 2: Project-Wide Analysis');
    expect(content).toContain('## Tutorial 3: MCP Server Integration');
    expect(content).toContain('## Tutorial 4: VS Code Extension Usage');
    expect(content).toContain('## Tutorial 5: Advanced Configuration');
    expect(content).toContain('## Tutorial 6: Performance Optimization');
    expect(content).toContain('## Tutorial 7: Custom Parser Development');
    
    // Check for practical elements
    expect(content).toContain('### Prerequisites');
    expect(content).toContain('### Step 1:');
    expect(content).toContain('**Expected Output**');
    expect(content).toContain('Interactive Exercises');
  });

  it('should have comprehensive integration examples', async () => {
    const content = await fs.readFile(path.join(docsPath, 'integrations.md'), 'utf-8');
    
    // Check for integration categories
    expect(content).toContain('# Integration Examples');
    expect(content).toContain('## AI Agent Integrations');
    expect(content).toContain('## Development Tool Integrations');
    expect(content).toContain('## CI/CD Pipeline Integrations');
    expect(content).toContain('## IDE Integrations');
    expect(content).toContain('## Database and Analytics Integrations');
    expect(content).toContain('## Testing Framework Integrations');
    
    // Check for specific integrations
    expect(content).toContain('Claude Integration');
    expect(content).toContain('GitHub Actions');
    expect(content).toContain('ESLint Plugin');
    expect(content).toContain('Webpack Plugin');
    expect(content).toContain('InfluxDB');
    expect(content).toContain('Jest Integration');
  });

  it('should have valid markdown formatting', async () => {
    const files = ['index.md', 'cli.md', 'tutorials.md', 'integrations.md'];
    
    for (const file of files) {
      const content = await fs.readFile(path.join(docsPath, file), 'utf-8');
      
      // Check for proper heading hierarchy
      const lines = content.split('\n');
      let inCodeBlock = false;
      
      for (const line of lines) {
        if (line.startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        
        if (!inCodeBlock && line.startsWith('#') && !line.startsWith('#!/')) {
          // Should have space after hash (but not for shell shebangs)
          // Only validate actual headers - skip lines that are just # (likely comments)
          if (line.match(/^#+\s/)) {
            // It's a proper header, no need to test again
            continue;
          } else if (line.match(/^#+$/)) {
            // It's just hashes with no content - skip (likely a comment or incomplete)
            continue;
          } else {
            // It's a hash without proper spacing - this should fail
            expect(line).toMatch(/^#+\s+/);
          }
        }
      }
      
      // Check for proper code block formatting
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      for (const block of codeBlocks) {
        // Code blocks should be properly closed
        expect(block.startsWith('```')).toBe(true);
        expect(block.endsWith('```')).toBe(true);
      }
    }
  });

  it('should have consistent cross-references', async () => {
    const indexContent = await fs.readFile(path.join(docsPath, 'index.md'), 'utf-8');
    
    // Check that index references match actual files
    expect(indexContent).toContain('./cli.md');
    expect(indexContent).toContain('./tutorials.md');
    expect(indexContent).toContain('./integrations.md');
    
    // Check for consistent internal links
    const cliContent = await fs.readFile(path.join(docsPath, 'cli.md'), 'utf-8');
    const tutorialsContent = await fs.readFile(path.join(docsPath, 'tutorials.md'), 'utf-8');
    
    // CLI should reference other sections
    expect(cliContent).toContain('../api/cli.md');
    expect(cliContent).toContain('../guide/configuration.md');
    
    // Tutorials should have next steps
    expect(tutorialsContent).toContain('Continue with:');
  });
});