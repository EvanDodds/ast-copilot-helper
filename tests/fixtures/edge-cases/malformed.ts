// Malformed TypeScript file for testing error handling
export class BrokenClass {
  constructor() {
    // Missing closing brace intentionally
  
  public method1() {
    return "test";
  }

  // Missing method body
  public method2()

  // Syntax error in parameter
  public method3(param: string, : number) {
    return param;
  }
}

// Missing export
class AnotherClass {
  // Incorrect syntax
  private value string = "test";
}