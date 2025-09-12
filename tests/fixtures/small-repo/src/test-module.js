// Sample JavaScript module for testing
class JavaScriptTestClass {
  constructor(name) {
    this.name = name;
    this.items = [];
  }

  addItem(item) {
    this.items.push(item);
    return this.items.length;
  }

  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      return this.items.splice(index, 1)[0];
    }
    return null;
  }

  findItem(predicate) {
    return this.items.find(predicate);
  }

  // Async method for testing
  async fetchData(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return null;
    }
  }

  // Method with complex control flow
  processItems(processor) {
    const results = [];
    
    for (let i = 0; i < this.items.length; i++) {
      try {
        const result = processor(this.items[i], i);
        if (result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        console.warn(`Processing item ${i} failed:`, error);
      }
    }
    
    return results;
  }
}

// Utility functions
function createProcessor(multiplier = 1) {
  return (value, index) => {
    if (typeof value === 'number') {
      return value * multiplier;
    }
    if (typeof value === 'string') {
      return value.repeat(multiplier);
    }
    return undefined;
  };
}

module.exports = {
  JavaScriptTestClass,
  createProcessor,
};