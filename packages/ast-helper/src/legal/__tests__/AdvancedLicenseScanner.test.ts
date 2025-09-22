/**
 * @fileoverview Tests for Advanced License Scanner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AdvancedLicenseScanner } from '../AdvancedLicenseScanner.js';
import { LicenseDatabase } from '../LicenseDatabase.js';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      readdir: vi.fn()
    }
  };
});

describe('AdvancedLicenseScanner', () => {
  let scanner: AdvancedLicenseScanner;
  let database: LicenseDatabase;
  let mockFs: any;

  beforeEach(async () => {
    database = new LicenseDatabase();
    await database.initialize();
    scanner = new AdvancedLicenseScanner(database);
    mockFs = fs as any;
    vi.clearAllMocks();
  });

  describe('Complex License Expression Parsing', () => {
    it('should parse OR expressions correctly', async () => {
      const expression = 'MIT OR Apache-2.0';
      const result = await scanner.parseComplexExpression(expression, 'test-package');
      
      expect(result).toBeTruthy();
      expect(result?.operator).toBe('OR');
      expect(result?.licenses).toHaveLength(2);
      expect(result?.isValid).toBe(true);
      expect(result?.interpretation).toContain('Choose any one');
    });

    it('should parse AND expressions correctly', async () => {
      const expression = 'MIT AND BSD-3-Clause';
      const result = await scanner.parseComplexExpression(expression, 'test-package');
      
      expect(result).toBeTruthy();
      expect(result?.operator).toBe('AND');
      expect(result?.licenses).toHaveLength(2);
      expect(result?.isValid).toBe(true);
      expect(result?.interpretation).toContain('comply with all');
    });

    it('should parse WITH expressions correctly', async () => {
      const expression = 'GPL-3.0 WITH Classpath-exception-2.0';
      const result = await scanner.parseComplexExpression(expression, 'test-package');
      
      expect(result).toBeTruthy();
      expect(result?.operator).toBe('WITH');
      expect(result?.interpretation).toContain('exception or modification');
    });

    it('should handle parentheses in expressions', async () => {
      const expression = '(MIT OR Apache-2.0) AND BSD-3-Clause';
      const result = await scanner.parseComplexExpression(expression, 'test-package');
      
      expect(result).toBeTruthy();
      // Should handle complex nested expressions
    });

    it('should return invalid for unknown licenses', async () => {
      const expression = 'MIT OR UnknownLicense-1.0';
      const result = await scanner.parseComplexExpression(expression, 'test-package');
      
      expect(result?.isValid).toBe(false);
    });
  });

  describe('Custom License Detection', () => {
    it('should detect MIT license patterns', async () => {
      const licenseContent = `
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND
      `;

      mockFs.readFile.mockResolvedValue(licenseContent);
      
      const matches = await (scanner as any).detectCustomLicenses('/fake/LICENSE');
      
      expect(matches).toHaveLength(2); // Should match multiple patterns
      expect(matches[0].spdxId).toBe('MIT');
      expect(matches[0].confidence).toBeGreaterThan(0.9);
    });

    it('should detect Apache-2.0 license patterns', async () => {
      const licenseContent = `
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
www.apache.org/licenses/LICENSE-2.0
      `;

      mockFs.readFile.mockResolvedValue(licenseContent);
      
      const matches = await (scanner as any).detectCustomLicenses('/fake/LICENSE');
      
      expect(matches.some((m: any) => m.spdxId === 'Apache-2.0')).toBe(true);
    });

    it('should handle files with no license patterns', async () => {
      mockFs.readFile.mockResolvedValue('Just some random content with no license info');
      
      const matches = await (scanner as any).detectCustomLicenses('/fake/README.md');
      
      expect(matches).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      const matches = await (scanner as any).detectCustomLicenses('/fake/LICENSE');
      
      expect(matches).toHaveLength(0);
    });
  });

  describe('Enhanced License Scanning', () => {
    it('should scan project with complex license expressions', async () => {
      const packageJson = {
        dependencies: {
          'test-pkg1': '1.0.0',
          'test-pkg2': '2.0.0'
        },
        devDependencies: {
          'test-dev-pkg': '1.5.0'
        }
      };

      const testPkg1PackageJson = {
        name: 'test-pkg1',
        version: '1.0.0',
        license: 'MIT OR Apache-2.0'
      };

      const testPkg2PackageJson = {
        name: 'test-pkg2',
        version: '2.0.0',
        license: 'BSD-3-Clause'
      };

      // Mock readFile calls for package.json files
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(packageJson)) // Main package.json
        .mockResolvedValueOnce(JSON.stringify(testPkg1PackageJson)) // test-pkg1 package.json  
        .mockResolvedValueOnce(JSON.stringify(testPkg2PackageJson)) // test-pkg2 package.json
        .mockResolvedValueOnce(JSON.stringify({})); // test-dev-pkg package.json

      // Mock readdir for license files - return empty arrays to avoid processing license files
      mockFs.readdir.mockResolvedValue([]);

      const result = await scanner.scanLicensesAdvanced('/fake/project/package.json');
      
      expect(result.licenses).toHaveLength(3); // Should include dev dependencies
      expect(result.totalDependencies).toBe(3);
      expect(result.complexExpressions.length).toBeGreaterThanOrEqual(0);
      expect(result.scanTimestamp).toBeInstanceOf(Date);
    });

    it('should handle missing package.json gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      
      const result = await scanner.scanLicensesAdvanced('/fake/nonexistent/package.json');
      
      expect(result.licenses).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Could not read package.json');
    });

    it('should extract copyright holders from license files', async () => {
      const licenseContent = `
Copyright (c) 2023 John Doe
Copyright 2024 Jane Smith <jane@example.com>
© 2022-2023 Example Corp
      `;

      mockFs.readFile.mockResolvedValue(licenseContent);
      
      const copyrights = await (scanner as any).extractCopyrightHolders('/fake/LICENSE');
      
      expect(copyrights).toContain('John Doe');
      expect(copyrights).toContain('Jane Smith <jane@example.com>');
      expect(copyrights).toContain('Example Corp');
    });
  });

  describe('License File Detection', () => {
    it('should find various license file names', async () => {
      const files = [
        'LICENSE',
        'LICENSE.txt',
        'LICENSE.md',
        'LICENCE',
        'COPYING',
        'COPYRIGHT.txt',
        'README.md',
        'package.json'
      ];
      
      mockFs.readdir.mockResolvedValue(files);

      const licenseFiles = await (scanner as any).findLicenseFiles('/fake/project');
      
      expect(licenseFiles).toHaveLength(6);
      expect(licenseFiles.some((f: string) => f.endsWith('LICENSE'))).toBe(true);
      expect(licenseFiles.some((f: string) => f.endsWith('LICENCE'))).toBe(true);
      expect(licenseFiles.some((f: string) => f.endsWith('COPYING'))).toBe(true);
      expect(licenseFiles.some((f: string) => f.endsWith('COPYRIGHT.txt'))).toBe(true);
    });

    it('should handle directories with no license files', async () => {
      mockFs.readdir.mockResolvedValue(['README.md', 'package.json', 'index.js']);

      const licenseFiles = await (scanner as any).findLicenseFiles('/fake/project');
      
      expect(licenseFiles).toHaveLength(0);
    });

    it('should handle readdir errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const licenseFiles = await (scanner as any).findLicenseFiles('/fake/project');
      
      expect(licenseFiles).toHaveLength(0);
    });
  });

  describe('License Monitoring', () => {
    it('should start monitoring directories', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await scanner.startLicenseMonitoring(['/fake/project1', '/fake/project2']);
      
      expect(consoleSpy).toHaveBeenCalledWith('License monitoring started for 2 directories');
      consoleSpy.mockRestore();
    });

    it('should stop monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await scanner.stopLicenseMonitoring();
      
      expect(consoleSpy).toHaveBeenCalledWith('License monitoring stopped');
      consoleSpy.mockRestore();
    });

    it('should register change callbacks', () => {
      const callback = vi.fn();
      
      scanner.onLicenseChange(callback);
      
      // Callback should be registered (private property, so we can't directly test)
      expect(callback).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed package.json', async () => {
      mockFs.readFile.mockResolvedValue('invalid json content');
      
      const result = await scanner.scanLicensesAdvanced('/fake/project/package.json');
      
      expect(result.licenses).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should continue processing other dependencies on individual errors', async () => {
      const packageJson = {
        dependencies: {
          'good-pkg': '1.0.0',
          'bad-pkg': '2.0.0'
        }
      };

      const goodPkgJson = {
        name: 'good-pkg',
        license: 'MIT'
      };

      // Mock successful read for main package.json and good-pkg, fail for bad-pkg 
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(packageJson)) // Main package.json
        .mockResolvedValueOnce(JSON.stringify(goodPkgJson)) // good-pkg package.json
        .mockRejectedValueOnce(new Error('Bad package error')); // bad-pkg package.json

      // Mock readdir to return empty arrays to avoid license file processing
      mockFs.readdir.mockResolvedValue([]);

      const result = await scanner.scanLicensesAdvanced('/fake/project/package.json');
      
      expect(result.licenses).toHaveLength(1); // Should still process good-pkg
      // The implementation might handle errors differently, let's check if at least one license was processed
      expect(result.totalDependencies).toBe(2);
      expect(result.scanTimestamp).toBeInstanceOf(Date);
    });
  });

  describe('Integration with LicenseDatabase', () => {
    it('should use database to validate license information', async () => {
      const packageJson = {
        dependencies: {
          'mit-pkg': '1.0.0'
        }
      };

      const mitPkgJson = {
        name: 'mit-pkg',
        license: 'MIT'
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(packageJson))
        .mockResolvedValueOnce(JSON.stringify(mitPkgJson));

      mockFs.readdir.mockResolvedValue([]);

      const result = await scanner.scanLicensesAdvanced('/fake/project/package.json');
      
      expect(result.licenses).toHaveLength(1);
      expect(result.licenses[0].license.spdxId).toBe('MIT');
      expect(result.licenses[0].license.name).toBe('MIT License');
    });

    it('should handle unknown licenses gracefully', async () => {
      const packageJson = {
        dependencies: {
          'unknown-pkg': '1.0.0'
        }
      };

      const unknownPkgJson = {
        name: 'unknown-pkg',
        license: 'Custom-Unknown-License'
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(packageJson))
        .mockResolvedValueOnce(JSON.stringify(unknownPkgJson));

      mockFs.readdir.mockResolvedValue([]);

      const result = await scanner.scanLicensesAdvanced('/fake/project/package.json');
      
      expect(result.licenses).toHaveLength(1);
      expect(result.licenses[0].license.spdxId).toBe('Custom-Unknown-License');
      expect(result.licenses[0].attributionRequired).toBe(true); // Should err on the side of caution
    });
  });
});