/**
 * @fileoverview License database with SPDX license information and compatibility rules
 */

import { LicenseInfo, LicenseType } from './types.js';

/**
 * Database of license information with SPDX identifiers and compatibility rules
 */
export class LicenseDatabase {
  private licenses: Map<string, LicenseInfo> = new Map();
  private compatibilityMatrix: Map<string, Map<string, boolean>> = new Map();
  private initialized = false;

  /**
   * Initialize the license database with SPDX data
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing license database with SPDX data...');

    // Populate common licenses
    this.populateCommonLicenses();
    
    // Build compatibility matrix
    this.buildCompatibilityMatrix();
    
    this.initialized = true;
    console.log(`License database initialized with ${this.licenses.size} licenses`);
  }

  /**
   * Get license information by SPDX ID or name
   */
  getLicense(identifier: string): LicenseInfo | null {
    const normalizedId = this.normalizeIdentifier(identifier);
    
    // Try exact match first
    if (this.licenses.has(normalizedId)) {
      return this.licenses.get(normalizedId)!;
    }
    
    // Try case-insensitive search
    for (const [key, license] of this.licenses) {
      if (key.toLowerCase() === normalizedId.toLowerCase() || 
          license.name.toLowerCase() === normalizedId.toLowerCase()) {
        return license;
      }
    }
    
    return null;
  }

  /**
   * Check if two licenses are compatible
   */
  areCompatible(license1: LicenseType, license2: LicenseType): boolean {
    const matrix1 = this.compatibilityMatrix.get(license1);
    if (!matrix1) {
      return false;
    }
    
    return matrix1.get(license2) ?? false;
  }

  /**
   * Get all registered licenses
   */
  getAllLicenses(): LicenseInfo[] {
    return Array.from(this.licenses.values());
  }

  /**
   * Check if license requires attribution
   */
  requiresAttribution(licenseId: string): boolean {
    const license = this.getLicense(licenseId);
    if (!license) {
      return true; // err on the side of caution
    }
    
    return license.compatibility.requiresNotice || 
           license.conditions.includes('include-copyright');
  }

  /**
   * Parse complex license expressions (e.g., "MIT OR Apache-2.0")
   */
  parseLicenseExpression(expression: string): { 
    licenses: LicenseInfo[]; 
    operator: 'AND' | 'OR' | 'WITH' | null;
    valid: boolean;
  } {
    const normalized = expression.trim();
    
    // Handle simple single license
    if (!normalized.includes(' AND ') && !normalized.includes(' OR ') && !normalized.includes(' WITH ')) {
      const license = this.getLicense(normalized);
      return {
        licenses: license ? [license] : [],
        operator: null,
        valid: license !== null
      };
    }
    
    // Handle complex expressions
    let operator: 'AND' | 'OR' | 'WITH' | null = null;
    let parts: string[] = [];
    
    if (normalized.includes(' OR ')) {
      operator = 'OR';
      parts = normalized.split(' OR ').map(p => p.trim());
    } else if (normalized.includes(' AND ')) {
      operator = 'AND';
      parts = normalized.split(' AND ').map(p => p.trim());
    } else if (normalized.includes(' WITH ')) {
      operator = 'WITH';
      parts = normalized.split(' WITH ').map(p => p.trim());
    }
    
    const licenses: LicenseInfo[] = [];
    let valid = true;
    
    for (const part of parts) {
      const license = this.getLicense(part);
      if (license) {
        licenses.push(license);
      } else {
        valid = false;
      }
    }
    
    return { licenses, operator, valid };
  }

  private normalizeIdentifier(identifier: string): string {
    return identifier.trim().replace(/[()]/g, '');
  }

  private populateCommonLicenses(): void {
    // MIT License
    this.licenses.set('MIT', {
      name: 'MIT License',
      spdxId: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
      text: `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: ['include-copyright'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0'],
        incompatibleWith: [],
        requiresNotice: true,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // Apache 2.0
    this.licenses.set('Apache-2.0', {
      name: 'Apache License 2.0',
      spdxId: 'Apache-2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
      text: 'Licensed under the Apache License, Version 2.0...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes'],
      limitations: ['trademark-use', 'liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-3.0'],
        incompatibleWith: ['GPL-2.0'],
        requiresNotice: true,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // GPL-3.0
    this.licenses.set('GPL-3.0', {
      name: 'GNU General Public License v3.0',
      spdxId: 'GPL-3.0',
      url: 'https://www.gnu.org/licenses/gpl-3.0.html',
      text: 'GNU GENERAL PUBLIC LICENSE Version 3...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source', 'same-license'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['LGPL-3.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause'],
        incompatibleWith: ['GPL-2.0'],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: false,
        isCopeyleft: true,
        copyleftScope: 'project'
      }
    });

    // BSD-3-Clause
    this.licenses.set('BSD-3-Clause', {
      name: 'BSD 3-Clause "New" or "Revised" License',
      spdxId: 'BSD-3-Clause',
      url: 'https://opensource.org/licenses/BSD-3-Clause',
      text: 'BSD 3-Clause License...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: ['include-copyright'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0'],
        incompatibleWith: [],
        requiresNotice: true,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // ISC
    this.licenses.set('ISC', {
      name: 'ISC License',
      spdxId: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
      text: 'ISC License...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: ['include-copyright'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'GPL-3.0', 'LGPL-3.0'],
        incompatibleWith: [],
        requiresNotice: true,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // Add more licenses...
    this.addAdditionalLicenses();
  }

  private addAdditionalLicenses(): void {
    // LGPL-3.0
    this.licenses.set('LGPL-3.0', {
      name: 'GNU Lesser General Public License v3.0',
      spdxId: 'LGPL-3.0',
      url: 'https://www.gnu.org/licenses/lgpl-3.0.html',
      text: 'GNU LESSER GENERAL PUBLIC LICENSE Version 3...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source', 'same-license--library'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'GPL-3.0'],
        incompatibleWith: [],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: true,
        isCopeyleft: true,
        copyleftScope: 'library'
      }
    });

    // BSD-2-Clause
    this.licenses.set('BSD-2-Clause', {
      name: 'BSD 2-Clause "Simplified" License',
      spdxId: 'BSD-2-Clause',
      url: 'https://opensource.org/licenses/BSD-2-Clause',
      text: 'BSD 2-Clause License...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: ['include-copyright'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0'],
        incompatibleWith: [],
        requiresNotice: true,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // GPL-2.0
    this.licenses.set('GPL-2.0', {
      name: 'GNU General Public License v2.0',
      spdxId: 'GPL-2.0',
      url: 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html',
      text: 'GNU GENERAL PUBLIC LICENSE Version 2...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source', 'same-license'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['LGPL-2.1'],
        incompatibleWith: ['Apache-2.0', 'GPL-3.0'],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: false,
        isCopeyleft: true,
        copyleftScope: 'project'
      }
    });

    // LGPL-2.1
    this.licenses.set('LGPL-2.1', {
      name: 'GNU Lesser General Public License v2.1',
      spdxId: 'LGPL-2.1',
      url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html',
      text: 'GNU LESSER GENERAL PUBLIC LICENSE Version 2.1...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source', 'same-license--library'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'GPL-2.0'],
        incompatibleWith: [],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: true,
        isCopeyleft: true,
        copyleftScope: 'library'
      }
    });

    // MPL-2.0
    this.licenses.set('MPL-2.0', {
      name: 'Mozilla Public License 2.0',
      spdxId: 'MPL-2.0',
      url: 'https://www.mozilla.org/en-US/MPL/2.0/',
      text: 'Mozilla Public License Version 2.0...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source'],
      limitations: ['liability', 'warranty', 'trademark-use'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
        incompatibleWith: ['GPL-2.0'],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: true,
        isCopeyleft: true,
        copyleftScope: 'file'
      }
    });

    // CC0-1.0
    this.licenses.set('CC0-1.0', {
      name: 'Creative Commons Zero v1.0 Universal',
      spdxId: 'CC0-1.0',
      url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      text: 'Creative Commons Legal Code CC0 1.0 Universal...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: [],
      limitations: ['patent-use', 'trademark-use', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0', 'MPL-2.0', 'Unlicense', '0BSD'],
        incompatibleWith: [],
        requiresNotice: false,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // Unlicense
    this.licenses.set('Unlicense', {
      name: 'The Unlicense',
      spdxId: 'Unlicense',
      url: 'https://unlicense.org/',
      text: 'This is free and unencumbered software released into the public domain...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: [],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0', 'MPL-2.0', 'CC0-1.0', '0BSD'],
        incompatibleWith: [],
        requiresNotice: false,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });

    // AGPL-3.0
    this.licenses.set('AGPL-3.0', {
      name: 'GNU Affero General Public License v3.0',
      spdxId: 'AGPL-3.0',
      url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      text: 'GNU AFFERO GENERAL PUBLIC LICENSE Version 3...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source', 'same-license', 'network-use-disclose'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['GPL-3.0'],
        incompatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MPL-2.0'],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: false,
        isCopeyleft: true,
        copyleftScope: 'network'
      }
    });

    // EPL-2.0
    this.licenses.set('EPL-2.0', {
      name: 'Eclipse Public License 2.0',
      spdxId: 'EPL-2.0',
      url: 'https://www.eclipse.org/legal/epl-2.0/',
      text: 'Eclipse Public License - v 2.0...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source'],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
        incompatibleWith: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: true,
        isCopeyleft: true,
        copyleftScope: 'file'
      }
    });

    // CDDL-1.0
    this.licenses.set('CDDL-1.0', {
      name: 'Common Development and Distribution License 1.0',
      spdxId: 'CDDL-1.0',
      url: 'https://opensource.org/licenses/CDDL-1.0',
      text: 'COMMON DEVELOPMENT AND DISTRIBUTION LICENSE (CDDL) Version 1.0...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use', 'patent-use'],
      conditions: ['include-copyright', 'document-changes', 'disclose-source'],
      limitations: ['liability', 'warranty', 'trademark-use'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
        incompatibleWith: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
        requiresNotice: true,
        requiresSourceDisclosure: true,
        allowsLinking: true,
        isCopeyleft: true,
        copyleftScope: 'file'
      }
    });

    // 0BSD
    this.licenses.set('0BSD', {
      name: 'BSD Zero Clause License',
      spdxId: '0BSD',
      url: 'https://opensource.org/licenses/0BSD',
      text: 'BSD Zero Clause License...',
      permissions: ['commercial-use', 'modifications', 'distribution', 'private-use'],
      conditions: [],
      limitations: ['liability', 'warranty'],
      compatibility: {
        compatibleWith: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0', 'MPL-2.0', 'CC0-1.0', 'Unlicense'],
        incompatibleWith: [],
        requiresNotice: false,
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null
      }
    });
  }

  private buildCompatibilityMatrix(): void {
    const licenses = Array.from(this.licenses.keys());
    
    for (const license1 of licenses) {
      const matrix = new Map<string, boolean>();
      const info1 = this.licenses.get(license1)!;
      
      for (const license2 of licenses) {
        const info2 = this.licenses.get(license2)!;
        
        // Same license is always compatible
        if (license1 === license2) {
          matrix.set(license2, true);
          continue;
        }
        
        // Check explicit compatibility
        const compatible = info1.compatibility.compatibleWith.includes(license2 as LicenseType) &&
                          !info1.compatibility.incompatibleWith.includes(license2 as LicenseType) &&
                          !info2.compatibility.incompatibleWith.includes(license1 as LicenseType);
        
        matrix.set(license2, compatible);
      }
      
      this.compatibilityMatrix.set(license1, matrix);
    }
  }
}