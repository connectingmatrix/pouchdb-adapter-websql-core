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
var constants_exports = {};
__export(constants_exports, {
  ADAPTER_VERSION: () => ADAPTER_VERSION,
  ATTACH_AND_SEQ_STORE: () => ATTACH_AND_SEQ_STORE,
  ATTACH_STORE: () => ATTACH_STORE,
  BY_SEQ_STORE: () => BY_SEQ_STORE,
  DOC_STORE: () => DOC_STORE,
  LOCAL_STORE: () => LOCAL_STORE,
  META_STORE: () => META_STORE
});
module.exports = __toCommonJS(constants_exports);
function quote(str) {
  return "'" + str + "'";
}
var ADAPTER_VERSION = 7;
var DOC_STORE = quote("document-store");
var BY_SEQ_STORE = quote("by-sequence");
var ATTACH_STORE = quote("attach-store");
var LOCAL_STORE = quote("local-store");
var META_STORE = quote("metadata-store");
var ATTACH_AND_SEQ_STORE = quote("attach-seq-store");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADAPTER_VERSION,
  ATTACH_AND_SEQ_STORE,
  ATTACH_STORE,
  BY_SEQ_STORE,
  DOC_STORE,
  LOCAL_STORE,
  META_STORE
});
