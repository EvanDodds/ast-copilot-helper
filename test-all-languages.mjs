#!/usr/bin/env node

/**
 * Comprehensive test for all 15+ supported languages
 * Tests both native Tree-sitter parsers and WASM fallbacks
 */

import { ASTHelper } from './packages/ast-helper/dist/index.js';

// Test code samples for each language
const TEST_SAMPLES = {
  javascript: `
function hello(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
`,
  typescript: `
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
`,
  tsx: `
import React from 'react';

interface Props {
  name: string;
}

const Component: React.FC<Props> = ({ name }) => {
  return <div>Hello, {name}!</div>;
};
`,
  python: `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

class Calculator:
    def add(self, a, b):
        return a + b
`,
  java: `
public class HelloWorld {
    private String message;
    
    public HelloWorld(String message) {
        this.message = message;
    }
    
    public void sayHello() {
        System.out.println(message);
    }
}
`,
  cpp: `
#include <iostream>
#include <vector>

class Calculator {
private:
    std::vector<int> history;
    
public:
    int add(int a, int b) {
        int result = a + b;
        history.push_back(result);
        return result;
    }
};
`,
  c: `
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int x;
    int y;
} Point;

Point* create_point(int x, int y) {
    Point* p = malloc(sizeof(Point));
    p->x = x;
    p->y = y;
    return p;
}
`,
  rust: `
use std::collections::HashMap;

#[derive(Debug)]
struct User {
    name: String,
    email: String,
}

impl User {
    fn new(name: String, email: String) -> Self {
        User { name, email }
    }
}

fn main() {
    let user = User::new("Alice".to_string(), "alice@example.com".to_string());
    println!("{:?}", user);
}
`,
  go: `
package main

import (
    "fmt"
    "strings"
)

type Person struct {
    Name string
    Age  int
}

func (p Person) Greet() string {
    return fmt.Sprintf("Hello, I'm %s and I'm %d years old", p.Name, p.Age)
}

func main() {
    person := Person{Name: "Alice", Age: 30}
    fmt.Println(person.Greet())
}
`,
  php: `
<?php
class User {
    private $name;
    private $email;
    
    public function __construct($name, $email) {
        $this->name = $name;
        $this->email = $email;
    }
    
    public function getName() {
        return $this->name;
    }
    
    public function getEmail() {
        return $this->email;
    }
}

$user = new User("Alice", "alice@example.com");
echo $user->getName();
?>
`,
  ruby: `
class Person
  attr_accessor :name, :age
  
  def initialize(name, age)
    @name = name
    @age = age
  end
  
  def greet
    "Hello, I'm #{@name} and I'm #{@age} years old"
  end
end

person = Person.new("Alice", 30)
puts person.greet
`,
  swift: `
import Foundation

struct Person {
    let name: String
    let age: Int
    
    func greet() -> String {
        return "Hello, I'm \\(name) and I'm \\(age) years old"
    }
}

let person = Person(name: "Alice", age: 30)
print(person.greet())
`,
  kotlin: `
data class Person(val name: String, val age: Int) {
    fun greet(): String {
        return "Hello, I'm \$name and I'm \$age years old"
    }
}

fun main() {
    val person = Person("Alice", 30)
    println(person.greet())
}
`,
  scala: `
case class Person(name: String, age: Int) {
  def greet(): String = s"Hello, I'm \$name and I'm \$age years old"
}

object Main extends App {
  val person = Person("Alice", 30)
  println(person.greet())
}
`,
  dart: `
class Person {
  final String name;
  final int age;
  
  Person(this.name, this.age);
  
  String greet() {
    return 'Hello, I\\'m \$name and I\\'m \$age years old';
  }
}

void main() {
  final person = Person('Alice', 30);
  print(person.greet());
}
`,
  lua: `
local Person = {}
Person.__index = Person

function Person:new(name, age)
    local obj = {}
    setmetatable(obj, Person)
    obj.name = name
    obj.age = age
    return obj
end

function Person:greet()
    return "Hello, I'm " .. self.name .. " and I'm " .. self.age .. " years old"
end

local person = Person:new("Alice", 30)
print(person:greet())
`,
  bash: `
#!/bin/bash

# Function to greet a person
greet_person() {
    local name=\$1
    local age=\$2
    echo "Hello, I'm \$name and I'm \$age years old"
}

# Variables
NAME="Alice"
AGE=30

# Call function
greet_person "\$NAME" "\$AGE"

# Loop example
for i in {1..5}; do
    echo "Count: \$i"
done
`
};

async function testLanguage(language, code) {
  console.log(`\n🧪 Testing ${language.toUpperCase()}...`);
  
  try {
    const astHelper = new ASTHelper();
    const result = await astHelper.parseCode(code, language);
    
    // console.log(`  🔍 Debug - Result structure:`, Object.keys(result || {}));
    // console.log(`  🔍 Debug - Result:`, JSON.stringify(result, null, 2).substring(0, 200) + '...');
    
    // Check for ParseResult format (nodes, errors, language, parseTime)
    if (result && result.nodes !== undefined) {
      if (result.errors && result.errors.length > 0) {
        console.log(`  ⚠️  ${language}: Parse had errors - ${result.errors[0].message}`);
        return { language, success: false, error: result.errors[0].message };
      }
      
      if (result.nodes && result.nodes.length > 0) {
        console.log(`  ✅ ${language}: Successfully parsed - ${result.nodes.length} AST nodes`);
        console.log(`  🎯 ${language}: Parser produced meaningful AST structure`);
        return { language, success: true, nodeCount: result.nodes.length };
      } else {
        console.log(`  ⚠️  ${language}: Parse returned no nodes`);
        return { language, success: false, error: 'No nodes returned' };
      }
    } else if (result && result.tree) {
      // Legacy tree format
      console.log(`  ✅ ${language}: Successfully parsed - Root node: ${result.tree.rootNode.type}`);
      console.log(`  📊 Node count: ${result.tree.rootNode.descendantCount}`);
      
      if (result.tree.rootNode.descendantCount > 1) {
        console.log(`  🎯 ${language}: Parser produced meaningful AST structure`);
        return { language, success: true, nodeCount: result.tree.rootNode.descendantCount };
      } else {
        console.log(`  ⚠️  ${language}: Parser produced minimal structure`);
        return { language, success: false, error: 'Minimal AST structure' };
      }
    } else {
      console.log(`  ❌ ${language}: Parse failed - unexpected result format`);
      return { language, success: false, error: 'Unexpected result format' };
    }
  } catch (error) {
    console.log(`  ❌ ${language}: Parse failed - ${error.message}`);
    return { language, success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive language support test...\n');
  console.log('Testing all 15+ configured languages for actual parsing capability\n');
  
  const results = [];
  const languages = Object.keys(TEST_SAMPLES);
  
  // Test each language sequentially to avoid overwhelming output
  for (const language of languages) {
    const result = await testLanguage(language, TEST_SAMPLES[language]);
    results.push(result);
    
    // Small delay to make output readable
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary report
  console.log('\n' + '='.repeat(60));
  console.log('📋 COMPREHENSIVE LANGUAGE SUPPORT TEST RESULTS');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ WORKING LANGUAGES (${successful.length}/${results.length}):`);
  successful.forEach(r => {
    console.log(`  • ${r.language.padEnd(12)} - ${r.nodeCount} AST nodes`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED LANGUAGES (${failed.length}/${results.length}):`);
    failed.forEach(r => {
      console.log(`  • ${r.language.padEnd(12)} - ${r.error}`);
    });
  }
  
  console.log(`\n🎯 SUCCESS RATE: ${Math.round((successful.length / results.length) * 100)}%`);
  
  if (successful.length === results.length) {
    console.log('\n🎉 ALL LANGUAGES WORKING! Full specification compliance achieved.');
  } else {
    console.log(`\n⚠️  ${failed.length} languages need attention for complete specification compliance.`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate: Math.round((successful.length / results.length) * 100),
    details: results
  };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(summary => {
      process.exit(summary.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export { runAllTests, testLanguage, TEST_SAMPLES };