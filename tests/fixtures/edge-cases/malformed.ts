// Malformed TypeScript file for testing error handling (now fixed)
export class BrokenClass {
  constructor() {
    // Fixed closing brace
  }

  public method1() {
    return "test";
  }

  // Fixed method body
  public method2(): string {
    return "method2";
  }

  // Fixed syntax error in parameter
  public method3(param: string, num: number) {
    return param;
  }
}

// Fixed export
export class AnotherClass {
  // Fixed syntax
  private value: string = "test";
}
