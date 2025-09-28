// Generated JavaScript bindings for ast-core-engine
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let nativeBinding;

const loadBinding = () => {
  if (!nativeBinding) {
    nativeBinding = require('./ast-core-engine.linux-x64-gnu.node');
  }
  return nativeBinding;
};

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
