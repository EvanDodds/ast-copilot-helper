"use strict";
/**
 * Configuration Loader
 * Loads and merges configuration from multiple sources
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
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
exports.createConfigManager = createConfigManager;
exports.loadConfig = loadConfig;
const fs_1 = require("fs");
const fsSync = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
const defaults_js_1 = require("./defaults.js");
const validator_js_1 = require("./validator.js");
/**
 * Configuration Manager
 * Handles loading, validation, and management of server configuration
 */
class ConfigManager extends events_1.EventEmitter {
  config;
  sources = [];
  watchers = new Map();
  constructor() {
    super();
    this.config = { ...defaults_js_1.DEFAULT_MCP_SERVER_CONFIG };
  }
  /**
   * Load configuration from multiple sources
   */
  async loadConfig(options = {}) {
    try {
      // Start with defaults
      let config = { ...defaults_js_1.DEFAULT_MCP_SERVER_CONFIG };
      this.addSource({ type: "default", priority: 0 });
      // Apply environment-specific configuration
      const nodeEnv = process.env.NODE_ENV || "production";
      const envConfig = (0, defaults_js_1.getEnvironmentConfig)(nodeEnv);
      if (Object.keys(envConfig).length > 0) {
        config = this.mergeConfigs(config, envConfig);
        this.addSource({ type: "environment", priority: 1 });
      }
      // Apply environment variable overrides first (lower priority)
      if (options.allowEnvironmentOverrides !== false) {
        const envOverrides = this.loadEnvironmentOverrides();
        config = this.mergeConfigs(config, envOverrides);
        if (Object.keys(envOverrides).length > 0) {
          this.addSource({ type: "environment", priority: 2 });
        }
      }
      // Load from configuration file (higher priority - overrides environment)
      if (options.configFile || this.findConfigFile()) {
        const configFile = options.configFile || this.findConfigFile();
        if (configFile) {
          const fileConfig = await this.loadConfigFile(configFile);
          config = this.mergeConfigs(config, fileConfig);
          this.addSource({ type: "file", path: configFile, priority: 3 });
        }
      }
      // Validate configuration
      if (options.validateConfig !== false) {
        const validationResult = (0, validator_js_1.validateConfig)(config);
        this.emit("config:validated", validationResult);
        if (!validationResult.isValid) {
          const error = new Error(
            `Configuration validation failed: ${validationResult.errors.join(", ")}`,
          );
          this.emit("config:error", error);
          if (options.strictMode) {
            throw error;
          }
        }
      }
      this.config = config;
      this.emit("config:loaded", config);
      return config;
    } catch (error) {
      const configError =
        error instanceof Error ? error : new Error(String(error));
      this.emit("config:error", configError);
      throw configError;
    }
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update configuration programmatically
   */
  updateConfig(updates) {
    const oldConfig = { ...this.config };
    const newConfig = this.mergeConfigs(this.config, updates);
    // Validate updated configuration
    const validationResult = (0, validator_js_1.validateConfig)(newConfig);
    if (!validationResult.isValid) {
      throw new Error(
        `Configuration update failed validation: ${validationResult.errors.join(", ")}`,
      );
    }
    this.config = newConfig;
    this.addSource({ type: "programmatic", priority: 4 });
    this.emit("config:updated", newConfig, oldConfig);
    return { ...newConfig };
  }
  /**
   * Watch configuration file for changes
   */
  async watchConfigFile(filePath) {
    if (this.watchers.has(filePath)) {
      return; // Already watching
    }
    try {
      const watcher = fsSync.watch(filePath, async (eventType) => {
        if (eventType === "change") {
          try {
            const fileConfig = await this.loadConfigFile(filePath);
            const newConfig = this.mergeConfigs(this.config, fileConfig);
            const validationResult = (0, validator_js_1.validateConfig)(
              newConfig,
            );
            if (validationResult.isValid) {
              this.config = newConfig;
              this.emit("config:changed", newConfig, {
                type: "file",
                path: filePath,
                priority: 2,
              });
            } else {
              this.emit(
                "config:error",
                new Error(
                  `Invalid config in ${filePath}: ${validationResult.errors.join(", ")}`,
                ),
              );
            }
          } catch (error) {
            this.emit("config:error", error);
          }
        }
      });
      this.watchers.set(filePath, watcher);
    } catch (error) {
      throw new Error(`Failed to watch config file ${filePath}: ${error}`);
    }
  }
  /**
   * Stop watching configuration files
   */
  stopWatching() {
    for (const [filePath, watcher] of this.watchers) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }
  /**
   * Get configuration sources
   */
  getSources() {
    return [...this.sources];
  }
  /**
   * Load configuration from file
   */
  async loadConfigFile(filePath) {
    try {
      const absolutePath = path_1.default.resolve(filePath);
      const content = await fs_1.promises.readFile(absolutePath, "utf-8");
      let config;
      if (filePath.endsWith(".json")) {
        config = JSON.parse(content);
      } else if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
        // Dynamic import for JS files
        const module = await Promise.resolve(
          `${`file://${absolutePath}`}`,
        ).then((s) => __importStar(require(s)));
        config = module.default || module;
      } else {
        throw new Error(`Unsupported config file format: ${filePath}`);
      }
      return config;
    } catch (error) {
      // Provide more specific error messages
      if (error instanceof Error) {
        if (
          error.message.includes("ENOENT") ||
          error.message.includes("no such file or directory")
        ) {
          throw new Error(`Configuration file not found: ${filePath}`);
        } else if (
          error instanceof SyntaxError ||
          error.message.includes("Unexpected token") ||
          error.message.includes("JSON")
        ) {
          throw new Error(`Invalid JSON in configuration file: ${filePath}`);
        } else if (
          error.message.includes("Permission denied") ||
          error.message.includes("EACCES")
        ) {
          throw new Error(
            `Permission denied reading configuration file: ${filePath}`,
          );
        }
      }
      throw new Error(`Failed to load config file ${filePath}: ${error}`);
    }
  }
  /**
   * Find configuration file in common locations
   */
  findConfigFile() {
    const configFiles = [
      "mcp-server.config.js",
      "mcp-server.config.json",
      "mcp-server.config.mjs",
      ".astdb/config.json",
      ".astdb/mcp-server.config.json",
      "config/mcp-server.json",
      "config/mcp-server.config.json",
    ];
    for (const file of configFiles) {
      try {
        const fullPath = path_1.default.resolve(file);
        if (require("fs").existsSync(fullPath)) {
          return fullPath;
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  /**
   * Load environment variable overrides
   */
  loadEnvironmentOverrides() {
    const config = {};
    // Server identity
    if (process.env.MCP_SERVER_NAME) {
      config.name = process.env.MCP_SERVER_NAME;
    }
    if (process.env.MCP_SERVER_VERSION) {
      config.version = process.env.MCP_SERVER_VERSION;
    }
    if (process.env.MCP_SERVER_DESCRIPTION) {
      config.description = process.env.MCP_SERVER_DESCRIPTION;
    }
    // Transport overrides
    const transport = {};
    if (process.env.MCP_SERVER_TRANSPORT_TYPE) {
      transport.type = process.env.MCP_SERVER_TRANSPORT_TYPE;
    }
    if (process.env.MCP_SERVER_PORT) {
      transport.port = parseInt(process.env.MCP_SERVER_PORT, 10);
    }
    if (process.env.MCP_SERVER_HOST) {
      transport.host = process.env.MCP_SERVER_HOST;
    }
    if (process.env.MCP_SERVER_MAX_CONNECTIONS) {
      transport.maxConnections = parseInt(
        process.env.MCP_SERVER_MAX_CONNECTIONS,
        10,
      );
    }
    if (Object.keys(transport).length > 0) {
      config.transport = transport;
    }
    // Performance configuration
    const performance = {};
    if (process.env.MCP_SERVER_MAX_CONCURRENT_REQUESTS) {
      performance.maxConcurrentRequests = parseInt(
        process.env.MCP_SERVER_MAX_CONCURRENT_REQUESTS,
        10,
      );
    }
    if (process.env.MCP_REQUEST_TIMEOUT) {
      performance.requestTimeout = parseInt(
        process.env.MCP_REQUEST_TIMEOUT,
        10,
      );
    }
    if (process.env.MCP_MAX_QUERY_RESULTS) {
      performance.maxQueryResults = parseInt(
        process.env.MCP_MAX_QUERY_RESULTS,
        10,
      );
    }
    if (process.env.MCP_SERVER_CACHE_SIZE) {
      performance.cacheSize = parseInt(process.env.MCP_SERVER_CACHE_SIZE, 10);
    }
    if (process.env.MCP_SERVER_CACHE_ENABLED) {
      performance.cacheEnabled =
        process.env.MCP_SERVER_CACHE_ENABLED === "true";
    }
    if (process.env.MCP_SERVER_GC_THRESHOLD) {
      performance.gcThreshold = parseFloat(process.env.MCP_SERVER_GC_THRESHOLD);
    }
    if (Object.keys(performance).length > 0) {
      config.performance = performance;
    }
    // Logging configuration
    const logging = {};
    if (process.env.MCP_SERVER_LOG_LEVEL) {
      logging.level = process.env.MCP_SERVER_LOG_LEVEL;
    }
    if (process.env.MCP_LOG_FILE) {
      logging.enableFile = true;
      logging.filePath = process.env.MCP_LOG_FILE;
    }
    if (process.env.MCP_ENABLE_REQUEST_LOGGING) {
      logging.enableRequestLogging =
        process.env.MCP_ENABLE_REQUEST_LOGGING === "true";
    }
    if (process.env.MCP_SERVER_LOG_REQUEST_BODY) {
      logging.logRequestBody =
        process.env.MCP_SERVER_LOG_REQUEST_BODY === "true" ||
        process.env.MCP_SERVER_LOG_REQUEST_BODY === "1";
    }
    if (Object.keys(logging).length > 0) {
      config.logging = logging;
    }
    // Security configuration
    const security = {};
    if (process.env.MCP_ENABLE_AUTH) {
      security.enableAuthentication = process.env.MCP_ENABLE_AUTH === "true";
    }
    if (process.env.MCP_ENABLE_RATE_LIMIT) {
      security.enableRateLimit = process.env.MCP_ENABLE_RATE_LIMIT === "true";
    }
    if (process.env.MCP_SERVER_RATE_LIMIT_REQUESTS) {
      security.rateLimitRequests = parseInt(
        process.env.MCP_SERVER_RATE_LIMIT_REQUESTS,
        10,
      );
    }
    if (process.env.MCP_SERVER_ENABLE_CORS) {
      security.enableCors = process.env.MCP_SERVER_ENABLE_CORS === "true";
    }
    if (process.env.MCP_SERVER_ENABLE_TLS) {
      security.enableTls =
        process.env.MCP_SERVER_ENABLE_TLS === "true" ||
        process.env.MCP_SERVER_ENABLE_TLS === "1";
    }
    if (Object.keys(security).length > 0) {
      config.security = security;
    }
    // Feature configuration
    const features = {};
    if (process.env.MCP_ENABLE_TOOLS) {
      features.enableTools = process.env.MCP_ENABLE_TOOLS === "true";
    }
    if (process.env.MCP_ENABLE_RESOURCES) {
      features.enableResources = process.env.MCP_ENABLE_RESOURCES === "true";
    }
    if (process.env.MCP_ENABLE_HOT_RELOAD) {
      features.enableHotReload = process.env.MCP_ENABLE_HOT_RELOAD === "true";
    }
    if (Object.keys(features).length > 0) {
      config.features = features;
    }
    // Database configuration
    const database = {};
    if (process.env.MCP_SERVER_DATABASE_PATH) {
      database.path = process.env.MCP_SERVER_DATABASE_PATH;
    }
    if (process.env.MCP_DATABASE_HOT_RELOAD) {
      database.hotReload = process.env.MCP_DATABASE_HOT_RELOAD === "true";
    }
    if (Object.keys(database).length > 0) {
      config.database = database;
    }
    // Environment configuration
    const environment = {};
    if (process.env.NODE_ENV) {
      environment.nodeEnv = process.env.NODE_ENV;
    }
    if (Object.keys(environment).length > 0) {
      config.environment = environment;
    }
    return config;
  }
  /**
   * Deep merge configuration objects
   */
  mergeConfigs(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.mergeConfigs(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  /**
   * Add configuration source
   */
  addSource(source) {
    const existingIndex = this.sources.findIndex(
      (s) => s.type === source.type && s.path === source.path,
    );
    if (existingIndex >= 0) {
      this.sources[existingIndex] = source;
    } else {
      this.sources.push(source);
    }
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.stopWatching();
    this.removeAllListeners();
  }
}
exports.ConfigManager = ConfigManager;
/**
 * Create and configure a config manager
 */
async function createConfigManager(options = {}) {
  const manager = new ConfigManager();
  await manager.loadConfig(options);
  return manager;
}
/**
 * Load configuration with default options
 */
async function loadConfig(options = {}) {
  const manager = new ConfigManager();
  return await manager.loadConfig(options);
}
//# sourceMappingURL=loader.js.map
