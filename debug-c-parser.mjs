console.log('=== Testing exact grammar manager loading logic ===');

async function testGrammarManagerLogic() {
  try {
    // Step 1: Dynamic import of tree-sitter
    console.log('1. Loading Tree-sitter...');
    const TreeSitter = (await import('tree-sitter')).default;
    const parser = new TreeSitter();
    console.log('   ✅ Tree-sitter loaded');

    // Step 2: Load language config (simulate)
    const language = 'c';
    const moduleName = 'tree-sitter-c';
    console.log('2. Language config - moduleName:', moduleName);

    let languageModule;

    // Step 3: Try CommonJS loading first (this is what our code does for non-TypeScript)
    console.log('3. Attempting CommonJS loading...');
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    try {
      const nativeModule = require(moduleName);
      console.log('   - CommonJS module loaded:', typeof nativeModule);
      console.log('   - Module keys:', Object.keys(nativeModule));
      languageModule = nativeModule;
      console.log('   ✅ CommonJS loading successful');
    } catch (requireError) {
      console.log('   ❌ CommonJS failed:', requireError.message);
      
      // Step 4: ES modules fallback
      console.log('4. Attempting ES modules fallback...');
      try {
        const module = await import(moduleName);
        languageModule = module.default || module[language] || module['module.exports'] || module;
        console.log('   ✅ ES modules fallback successful');
      } catch (importError) {
        console.log('   ❌ ES modules failed:', importError.message);
        throw importError;
      }
    }

    // Step 5: Check if languageModule is valid
    console.log('5. Validating language module...');
    if (!languageModule) {
      throw new Error('Language module not found or has no default export');
    }
    console.log('   - Language module type:', typeof languageModule);
    console.log('   - Language module keys:', Object.keys(languageModule));

    // Step 6: Set the language
    console.log('6. Setting parser language...');
    parser.setLanguage(languageModule);
    console.log('   ✅ Parser language set successfully');

    // Step 7: Test parsing
    console.log('7. Testing parsing...');
    const code = 'int main() { return 0; }';
    const tree = parser.parse(code);
    console.log('   ✅ Parsing successful, root node type:', tree.rootNode.type);

    return parser;
  } catch (error) {
    console.log('❌ FAILED at step:', error.message);
    console.log('Stack:', error.stack);
    throw error;
  }
}

testGrammarManagerLogic()
  .then(() => console.log('✅ All steps completed successfully'))
  .catch(() => console.log('❌ Test failed'));