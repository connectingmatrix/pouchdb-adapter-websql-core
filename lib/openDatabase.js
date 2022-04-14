"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var openDatabase_exports = {};
__export(openDatabase_exports, {
  default: () => openDatabase_default
});
module.exports = __toCommonJS(openDatabase_exports);
var cachedDatabases = /* @__PURE__ */ new Map();
function openDatabaseWithOpts(opts) {
  return opts.websql(opts.name, opts.version, opts.description, opts.size);
}
function openDBSafely(opts) {
  try {
    const __db = openDatabaseWithOpts(opts);
    // console.log(__db._db)
    if(process.env.parallelize === 'true'){
      __db._db._db.parallelize();
      // __db._db._db.exec('PRAGMA journal_mode = WAL;');  
      console.log('************** setting parallelization');
    }

    // __db._db._db.run('PRAGMA journal_mode = WAL;');
    // __db.run('PRAGMA journal_mode = WAL;');
    return {
      db: __db
    };
  } catch (err) {
    return {
      error: err
    };
  }
}
function openDB(opts) {
  var cachedResult = cachedDatabases.get(opts.name);
  if (!cachedResult) {
    cachedResult = openDBSafely(opts);
    cachedDatabases.set(opts.name, cachedResult);
  }
  return cachedResult;
}
var openDatabase_default = openDB;
"use strict";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
