// Sample TypeScript class for testing
export class TestClass {
  private value: number = 0;

  constructor(initialValue: number = 0) {
    this.value = initialValue;
  }

  public getValue(): number {
    return this.value;
  }

  public setValue(newValue: number): void {
    this.value = newValue;
  }

  public increment(): number {
    return ++this.value;
  }

  public decrement(): number {
    return --this.value;
  }

  // Complex method with nested structures
  public processData(data: Array<{ id: number; value: string }>): Map<number, string> {
    const result = new Map<number, string>();
    
    for (const item of data) {
      if (item.id > 0 && item.value.length > 0) {
        result.set(item.id, item.value.toUpperCase());
      }
    }
    
    return result;
  }
}

export interface TestInterface {
  id: number;
  name: string;
  process(input: string): string;
}

export enum TestEnum {
  OPTION_A = 'A',
  OPTION_B = 'B',  
  OPTION_C = 'C',
}

export function utilityFunction(param1: string, param2: number): boolean {
  return param1.length > param2;
}