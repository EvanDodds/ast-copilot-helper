"use strict";
/**
 * Configuration System Entry Point
 * Provides unified access to MCP server configuration
 */
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) {
          k2 = k;
        }
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) {
          k2 = k;
        }
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
const __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (const p in m) {
      if (
        p !== "default" &&
        !Object.prototype.hasOwnProperty.call(exports, p)
      ) {
        __createBinding(exports, m, p);
      }
    }
  };
const __importStar =
  (this && this.__importStar) ||
  (function () {
    let ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          const ar = [];
          for (const k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
              ar[ar.length] = k;
            }
          }
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) {
        return mod;
      }
      const result = {};
      if (mod != null) {
        for (let k = ownKeys(mod), i = 0; i < k.length; i++) {
          if (k[i] !== "default") {
            __createBinding(result, mod, k[i]);
          }
        }
      }
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentConfig =
  exports.TEST_CONFIG =
  exports.PRODUCTION_CONFIG =
  exports.DEVELOPMENT_CONFIG =
  exports.DEFAULT_MCP_SERVER_CONFIG =
  exports.validateConfigConstraints =
  exports.validateConfig =
  exports.loadConfig =
  exports.createConfigManager =
  exports.ConfigManager =
    void 0;
exports.createDevelopmentConfig = createDevelopmentConfig;
exports.createProductionConfig = createProductionConfig;
exports.createTestConfig = createTestConfig;
__exportStar(require("./types.js"), exports);
__exportStar(require("./defaults.js"), exports);
__exportStar(require("./validator.js"), exports);
__exportStar(require("./loader.js"), exports);
// Re-export commonly used functions and classes
const loader_js_1 = require("./loader.js");
Object.defineProperty(exports, "ConfigManager", {
  enumerable: true,
  get: function () {
    return loader_js_1.ConfigManager;
  },
});
Object.defineProperty(exports, "createConfigManager", {
  enumerable: true,
  get: function () {
    return loader_js_1.createConfigManager;
  },
});
Object.defineProperty(exports, "loadConfig", {
  enumerable: true,
  get: function () {
    return loader_js_1.loadConfig;
  },
});
const validator_js_1 = require("./validator.js");
Object.defineProperty(exports, "validateConfig", {
  enumerable: true,
  get: function () {
    return validator_js_1.validateConfig;
  },
});
Object.defineProperty(exports, "validateConfigConstraints", {
  enumerable: true,
  get: function () {
    return validator_js_1.validateConfigConstraints;
  },
});
const defaults_js_1 = require("./defaults.js");
Object.defineProperty(exports, "DEFAULT_MCP_SERVER_CONFIG", {
  enumerable: true,
  get: function () {
    return defaults_js_1.DEFAULT_MCP_SERVER_CONFIG;
  },
});
Object.defineProperty(exports, "DEVELOPMENT_CONFIG", {
  enumerable: true,
  get: function () {
    return defaults_js_1.DEVELOPMENT_CONFIG;
  },
});
Object.defineProperty(exports, "PRODUCTION_CONFIG", {
  enumerable: true,
  get: function () {
    return defaults_js_1.PRODUCTION_CONFIG;
  },
});
Object.defineProperty(exports, "TEST_CONFIG", {
  enumerable: true,
  get: function () {
    return defaults_js_1.TEST_CONFIG;
  },
});
Object.defineProperty(exports, "getEnvironmentConfig", {
  enumerable: true,
  get: function () {
    return defaults_js_1.getEnvironmentConfig;
  },
});
/**
 * Quick configuration factory functions
 */
/**
 * Create configuration for development environment
 */
async function createDevelopmentConfig() {
  const { ConfigManager } = await Promise.resolve().then(() =>
    __importStar(require("./loader.js")),
  );
  const { DEVELOPMENT_CONFIG } = await Promise.resolve().then(() =>
    __importStar(require("./defaults.js")),
  );
  const configManager = new ConfigManager();
  // Temporarily set NODE_ENV for this config creation
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    // Load config without environment overrides first
    await configManager.loadConfig({
      validateConfig: true,
      allowEnvironmentOverrides: false,
      enableDefaults: true,
    });
    // Apply development-specific configuration first
    const baseConfig = configManager.getConfig();
    const withDevConfig = configManager.mergeConfigs(
      baseConfig,
      DEVELOPMENT_CONFIG,
    );
    // Then apply environment overrides on top
    const envOverrides = configManager.loadEnvironmentOverrides();
    const finalConfig = configManager.mergeConfigs(withDevConfig, envOverrides);
    // Set the final merged config
    configManager.config = finalConfig;
    return configManager.getConfig();
  } finally {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  }
}
/**
 * Create configuration for production environment
 */
async function createProductionConfig() {
  const { ConfigManager } = await Promise.resolve().then(() =>
    __importStar(require("./loader.js")),
  );
  const { PRODUCTION_CONFIG } = await Promise.resolve().then(() =>
    __importStar(require("./defaults.js")),
  );
  const configManager = new ConfigManager();
  // Load base config and merge with production overrides
  const config = await configManager.loadConfig({
    validateConfig: true,
    allowEnvironmentOverrides: true,
    strictMode: true,
    enableDefaults: true,
  });
  // Apply production-specific configuration
  return configManager.mergeConfigs(config, PRODUCTION_CONFIG);
}
/**
 * Create configuration for test environment
 */
async function createTestConfig() {
  const { ConfigManager } = await Promise.resolve().then(() =>
    __importStar(require("./loader.js")),
  );
  const { TEST_CONFIG } = await Promise.resolve().then(() =>
    __importStar(require("./defaults.js")),
  );
  const configManager = new ConfigManager();
  // Load base config and merge with test overrides
  const config = await configManager.loadConfig({
    validateConfig: true,
    allowEnvironmentOverrides: true,
    enableDefaults: true,
  });
  // Apply test-specific configuration
  return configManager.mergeConfigs(config, TEST_CONFIG);
}
//# sourceMappingURL=index.js.map
