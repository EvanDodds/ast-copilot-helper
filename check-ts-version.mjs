import Parser from 'tree-sitter';
console.log('Parser version:', Parser.version || 'unknown');
console.log('Parser constructor:', Parser.constructor.name);
console.log('Parser prototype:', Object.getPrototypeOf(Parser));
