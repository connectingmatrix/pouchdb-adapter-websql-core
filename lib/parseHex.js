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
var parseHex_exports = {};
__export(parseHex_exports, {
  default: () => parseHex_default
});
module.exports = __toCommonJS(parseHex_exports);
function decodeUtf8(str) {
  return decodeURIComponent(escape(str));
}
function hexToInt(charCode) {
  return charCode < 65 ? charCode - 48 : charCode - 55;
}
function parseHexUtf8(str, start, end) {
  var result = "";
  while (start < end) {
    result += String.fromCharCode(hexToInt(str.charCodeAt(start++)) << 4 | hexToInt(str.charCodeAt(start++)));
  }
  return result;
}
function parseHexUtf16(str, start, end) {
  var result = "";
  while (start < end) {
    result += String.fromCharCode(hexToInt(str.charCodeAt(start + 2)) << 12 | hexToInt(str.charCodeAt(start + 3)) << 8 | hexToInt(str.charCodeAt(start)) << 4 | hexToInt(str.charCodeAt(start + 1)));
    start += 4;
  }
  return result;
}
function parseHexString(str, encoding) {
  if (encoding === "UTF-8") {
    return decodeUtf8(parseHexUtf8(str, 0, str.length));
  } else {
    return parseHexUtf16(str, 0, str.length);
  }
}
var parseHex_default = parseHexString;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
