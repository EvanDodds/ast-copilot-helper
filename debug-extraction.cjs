/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const C = require('tree-sitter-c');
console.log('tree-sitter-c module structure:');
console.log('  typeof C:', typeof C);
console.log('  C.language:', typeof C.language);
console.log('  C has language property:', 'language' in C);

// Simulate extractLanguageObject behavior
function extractLanguageObject(moduleExport, language) {
  if (!moduleExport) {
    throw new Error(`Module export is null or undefined for ${language}`);
  }
  console.log('  extractLanguageObject input type:', typeof moduleExport);
  
  // Check for function export (common pattern)
  if (typeof moduleExport === 'function') {
    console.log('  → Returning as function');
    return moduleExport;
  }
  
  // Check for object with language property
  if (typeof moduleExport === 'object' && 
      moduleExport !== null && 
      'language' in moduleExport) {
    console.log('  → Returning .language property');
    return moduleExport.language;
  }
  
  console.log('  → Returning module itself');
  return moduleExport;
}

console.log('\nTesting extractLanguageObject:');
const extracted = extractLanguageObject(C, 'c');
console.log('  extracted type:', typeof extracted);
console.log('  same as original?', extracted === C);
console.log('  same as C.language?', extracted === C.language);

// Test if the extracted version works with tree-sitter
try {
  const Parser = require('tree-sitter');
  const parser = new Parser();
  parser.setLanguage(extracted);
  console.log('✅ Extracted language works with tree-sitter');
} catch (err) {
  console.log('❌ Extracted language failed:', err.message);
}

// Test the original module
try {
  const Parser = require('tree-sitter');
  const parser2 = new Parser();
  parser2.setLanguage(C);
  console.log('✅ Original module works with tree-sitter');
} catch (err) {
  console.log('❌ Original module failed:', err.message);
}