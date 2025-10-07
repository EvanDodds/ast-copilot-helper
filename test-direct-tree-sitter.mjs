#!/usr/bin/env node

async function testDirectTreeSitter() {
  try {
    console.log('Testing direct tree-sitter usage...');
    
    // Import tree-sitter
    const TreeSitter = (await import('tree-sitter')).default;
    console.log('✓ TreeSitter imported:', typeof TreeSitter);
    
    // Import TypeScript parser
    const tsModule = await import('tree-sitter-typescript');
    console.log('✓ TypeScript module imported');
    console.log('  - Module keys:', Object.keys(tsModule));
    console.log('  - Default keys:', tsModule.default ? Object.keys(tsModule.default) : 'No default');
    
    // Create parser
    const parser = new TreeSitter();
    console.log('✓ Parser created');
    
    // Set language
    const language = tsModule.default.typescript;
    console.log('✓ Language module:', typeof language);
    console.log('  - Language properties:', Object.getOwnPropertyNames(language || {}));
    
    parser.setLanguage(language);
    console.log('✓ Language set');
    
    // Parse code
    const code = 'const hello = "world";';
    console.log('✓ Parsing code:', code);
    
    const tree = parser.parse(code);
    console.log('✓ Parse complete');
    console.log('  - Tree type:', typeof tree);
    console.log('  - Tree constructor:', tree?.constructor?.name);
    console.log('  - Tree properties:', Object.getOwnPropertyNames(tree || {}));
    
    if (tree && tree.rootNode) {
      console.log('✓ Root node exists');
      console.log('  - Root node type:', tree.rootNode.type);
      console.log('  - Root node child count:', tree.rootNode.childCount);
    } else {
      console.log('✗ Root node missing');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDirectTreeSitter();