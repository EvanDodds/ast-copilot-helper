// Generated JavaScript bindings for ast-core-engine
// Auto-generated platform detection based on NAPI-RS template
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);

let nativeBinding = null;
const loadErrors = [];

const isMusl = () => {
  let musl = false;
  if (process.platform === 'linux') {
    musl = isMuslFromFilesystem();
    if (musl === null) {
      musl = isMuslFromReport();
    }
    if (musl === null) {
      musl = isMuslFromChildProcess();
    }
  }
  return musl;
};

const isFileMusl = (f) => f.includes('libc.musl-') || f.includes('ld-musl-');

const isMuslFromFilesystem = () => {
  try {
    return readFileSync('/usr/bin/ldd', 'utf-8').includes('musl');
  } catch {
    return null;
  }
};

const isMuslFromReport = () => {
  let report = null;
  if (typeof process.report?.getReport === 'function') {
    process.report.excludeNetwork = true;
    report = process.report.getReport();
  }
  if (!report) {
    return null;
  }
  if (report.header && report.header.glibcVersionRuntime) {
    return false;
  }
  if (Array.isArray(report.sharedObjects)) {
    if (report.sharedObjects.some(isFileMusl)) {
      return true;
    }
  }
  return false;
};

const isMuslFromChildProcess = () => {
  try {
    return require('child_process').execSync('ldd --version', { encoding: 'utf8' }).includes('musl');
  } catch {
    return false;
  }
};

function requireNative() {
  if (process.env.NAPI_RS_NATIVE_LIBRARY_PATH) {
    try {
      return require(process.env.NAPI_RS_NATIVE_LIBRARY_PATH);
    } catch (err) {
      loadErrors.push(err);
    }
  } else if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      try {
        return require('./ast-core-engine.win32-x64-msvc.node');
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === 'ia32') {
      try {
        return require('./ast-core-engine.win32-ia32-msvc.node');
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === 'arm64') {
      try {
        return require('./ast-core-engine.win32-arm64-msvc.node');
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(new Error(`Unsupported architecture on Windows: ${process.arch}`));
    }
  } else if (process.platform === 'darwin') {
    if (process.arch === 'x64') {
      try {
        return require('./ast-core-engine.darwin-x64.node');
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === 'arm64') {
      try {
        return require('./ast-core-engine.darwin-arm64.node');
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(new Error(`Unsupported architecture on macOS: ${process.arch}`));
    }
  } else if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      if (isMusl()) {
        try {
          return require('./ast-core-engine.linux-x64-musl.node');
        } catch (e) {
          loadErrors.push(e);
        }
      } else {
        try {
          return require('./ast-core-engine.linux-x64-gnu.node');
        } catch (e) {
          loadErrors.push(e);
        }
      }
    } else if (process.arch === 'arm64') {
      if (isMusl()) {
        try {
          return require('./ast-core-engine.linux-arm64-musl.node');
        } catch (e) {
          loadErrors.push(e);
        }
      } else {
        try {
          return require('./ast-core-engine.linux-arm64-gnu.node');
        } catch (e) {
          loadErrors.push(e);
        }
      }
    } else {
      loadErrors.push(new Error(`Unsupported architecture on Linux: ${process.arch}`));
    }
  } else {
    loadErrors.push(new Error(`Unsupported OS: ${process.platform}, architecture: ${process.arch}`));
  }
}

nativeBinding = requireNative();

if (!nativeBinding) {
  if (loadErrors.length > 0) {
    throw new Error(
      `Cannot find native binding for platform ${process.platform}-${process.arch}. ` +
      'Please ensure the native module is built for your platform.',
      {
        cause: loadErrors.reduce((err, cur) => {
          cur.cause = err;
          return cur;
        }),
      },
    );
  }
  throw new Error(`Failed to load native binding`);
}

const loadBinding = () => nativeBinding;

export const createHnswConfig = (...args) => loadBinding().createHnswConfig(...args);
export const createEngineWithConfig = (...args) => loadBinding().createEngineWithConfig(...args);
export const createDefaultEngine = (...args) => loadBinding().createDefaultEngine(...args);
export const loadConfig = (...args) => loadBinding().loadConfig(...args);
export const initVectorDatabase = (...args) => loadBinding().initVectorDatabase(...args);
export const addVectorToDb = (...args) => loadBinding().addVectorToDb(...args);
export const searchVectors = (...args) => loadBinding().searchVectors(...args);
export const getVectorCount = (...args) => loadBinding().getVectorCount(...args);
export const clearVectorDatabase = (...args) => loadBinding().clearVectorDatabase(...args);
export const initEngine = (...args) => loadBinding().initEngine(...args);
export const getEngineVersion = (...args) => loadBinding().getEngineVersion(...args);
export const healthCheck = (...args) => loadBinding().healthCheck(...args);
export const AstCoreEngineApi = loadBinding().AstCoreEngineApi;

export default loadBinding;
