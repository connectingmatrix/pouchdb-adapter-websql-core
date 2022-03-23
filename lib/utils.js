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
var utils_exports = {};
__export(utils_exports, {
  compactRevs: () => compactRevs,
  escapeBlob: () => escapeBlob,
  getSize: () => getSize,
  qMarks: () => qMarks,
  select: () => select,
  stringifyDoc: () => stringifyDoc,
  unescapeBlob: () => unescapeBlob,
  unstringifyDoc: () => unstringifyDoc,
  websqlError: () => websqlError
});
module.exports = __toCommonJS(utils_exports);
var import_pouchdb_errors = require("pouchdb-errors");
var import_pouchdb_utils = require("pouchdb-utils");
var import_constants = require("./constants");
function escapeBlob(str) {
  return str.replace(/\u0002/g, "").replace(/\u0001/g, "").replace(/\u0000/g, "");
}
function unescapeBlob(str) {
  return str.replace(/\u0001\u0001/g, "\0").replace(/\u0001\u0002/g, "").replace(/\u0002\u0002/g, "");
}
function stringifyDoc(doc) {
  delete doc._id;
  delete doc._rev;
  return JSON.stringify(doc);
}
function unstringifyDoc(doc, id, rev) {
  doc = JSON.parse(doc);
  doc._id = id;
  doc._rev = rev;
  return doc;
}
function qMarks(num) {
  var s = "(";
  while (num--) {
    s += "?";
    if (num) {
      s += ",";
    }
  }
  return s + ")";
}
function select(selector, table, joiner, where, orderBy) {
  return "SELECT " + selector + " FROM " + (typeof table === "string" ? table : table.join(" JOIN ")) + (joiner ? " ON " + joiner : "") + (where ? " WHERE " + (typeof where === "string" ? where : where.join(" AND ")) : "") + (orderBy ? " ORDER BY " + orderBy : "");
}
function compactRevs(revs, docId, tx) {
  if (!revs.length) {
    return;
  }
  var numDone = 0;
  var seqs = [];
  function checkDone() {
    if (++numDone === revs.length) {
      deleteOrphans();
    }
  }
  function deleteOrphans() {
    if (!seqs.length) {
      return;
    }
    var sql = "SELECT DISTINCT digest AS digest FROM " + import_constants.ATTACH_AND_SEQ_STORE + " WHERE seq IN " + qMarks(seqs.length);
    tx.executeSql(sql, seqs, function(tx2, res) {
      var digestsToCheck = [];
      for (var i = 0; i < res.rows.length; i++) {
        digestsToCheck.push(res.rows.item(i).digest);
      }
      if (!digestsToCheck.length) {
        return;
      }
      var sql2 = "DELETE FROM " + import_constants.ATTACH_AND_SEQ_STORE + " WHERE seq IN (" + seqs.map(function() {
        return "?";
      }).join(",") + ")";
      tx2.executeSql(sql2, seqs, function(tx3) {
        var sql3 = "SELECT digest FROM " + import_constants.ATTACH_AND_SEQ_STORE + " WHERE digest IN (" + digestsToCheck.map(function() {
          return "?";
        }).join(",") + ")";
        tx3.executeSql(sql3, digestsToCheck, function(tx4, res2) {
          var nonOrphanedDigests = /* @__PURE__ */ new Set();
          for (var i2 = 0; i2 < res2.rows.length; i2++) {
            nonOrphanedDigests.add(res2.rows.item(i2).digest);
          }
          digestsToCheck.forEach(function(digest) {
            if (nonOrphanedDigests.has(digest)) {
              return;
            }
            tx4.executeSql("DELETE FROM " + import_constants.ATTACH_AND_SEQ_STORE + " WHERE digest=?", [digest]);
            tx4.executeSql("DELETE FROM " + import_constants.ATTACH_STORE + " WHERE digest=?", [digest]);
          });
        });
      });
    });
  }
  revs.forEach(function(rev) {
    var sql = "SELECT seq FROM " + import_constants.BY_SEQ_STORE + " WHERE doc_id=? AND rev=?";
    tx.executeSql(sql, [docId, rev], function(tx2, res) {
      if (!res.rows.length) {
        return checkDone();
      }
      var seq = res.rows.item(0).seq;
      seqs.push(seq);
      tx2.executeSql("DELETE FROM " + import_constants.BY_SEQ_STORE + " WHERE seq=?", [seq], checkDone);
    });
  });
}
function websqlError(callback) {
  return function(event) {
    (0, import_pouchdb_utils.guardedConsole)("error", "WebSQL threw an error", event);
    var errorNameMatch = event && event.constructor.toString().match(/function ([^(]+)/);
    var errorName = errorNameMatch && errorNameMatch[1] || event.type;
    var errorReason = event.target || event.message;
    callback((0, import_pouchdb_errors.createError)(import_pouchdb_errors.WSQ_ERROR, errorReason, errorName));
  };
}
function getSize(opts) {
  if ("size" in opts) {
    return opts.size * 1e6;
  }
  var isAndroid = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
  return isAndroid ? 5e6 : 1;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  compactRevs,
  escapeBlob,
  getSize,
  qMarks,
  select,
  stringifyDoc,
  unescapeBlob,
  unstringifyDoc,
  websqlError
});
