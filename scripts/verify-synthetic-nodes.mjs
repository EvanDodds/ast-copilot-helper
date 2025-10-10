#!/usr/bin/env node
/**
 * Simple node counter for synthetic test repository
 * Counts AST nodes in the three generated files
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';

const fixturesDir = join(process.cwd(), 'tests', 'fixtures', 'synthetic-100k');

function countNodes(node) {
  let count = 1;
  for (let i = 0; i < node.childCount; i++) {
    count += countNodes(node.child(i));
  }
  return count;
}

async function parseFile(filePath, language) {
  const parser = new Parser();
  
  if (language === 'typescript') {
    parser.setLanguage(TypeScript.typescript);
  } else if (language === 'javascript') {
    parser.setLanguage(JavaScript);
  } else if (language === 'python') {
    parser.setLanguage(Python);
  }

  const content = await fs.readFile(filePath, 'utf8');
  const tree = parser.parse(content);
  return countNodes(tree.rootNode);
}

async function main() {
  try {
    const tsNodes = await parseFile(join(fixturesDir, 'typescript-large.ts'), 'typescript');
    const jsNodes = await parseFile(join(fixturesDir, 'javascript-medium.js'), 'javascript');
    const pyNodes = await parseFile(join(fixturesDir, 'python-medium.py'), 'python');
    
    const total = tsNodes + jsNodes + pyNodes;
    
    console.log('AST Node Count Report:');
    console.log('======================');
    console.log(`TypeScript file:  ${tsNodes.toLocaleString()} nodes`);
    console.log(`JavaScript file:  ${jsNodes.toLocaleString()} nodes`);
    console.log(`Python file:      ${pyNodes.toLocaleString()} nodes`);
    console.log('----------------------');
    console.log(`Total:            ${total.toLocaleString()} nodes`);
    console.log('');
    
    const targetNodes = 100000;
    const variance = ((total - targetNodes) / targetNodes) * 100;
    
    if (total >= targetNodes) {
      console.log(`✅ SUCCESS: Target of 100,000 nodes reached!`);
      console.log(`   Actual: ${total.toLocaleString()} nodes (+${variance.toFixed(1)}%)`);
      process.exit(0);
    } else {
      console.log(`❌ FAILED: Target of 100,000 nodes not reached`);
      console.log(`   Actual: ${total.toLocaleString()} nodes (${variance.toFixed(1)}%)`);
      console.log(`   Missing: ${(targetNodes - total).toLocaleString()} nodes`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
