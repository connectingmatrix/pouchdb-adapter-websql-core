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
var bulkDocs_exports = {};
__export(bulkDocs_exports, {
  default: () => bulkDocs_default
});
module.exports = __toCommonJS(bulkDocs_exports);
var import_pouchdb_adapter_utils = require("pouchdb-adapter-utils");
var import_pouchdb_merge = require("pouchdb-merge");
var import_pouchdb_json = require("pouchdb-json");
var import_pouchdb_errors = require("pouchdb-errors");
var import_constants = require("./constants");
var import_utils = require("./utils");
function websqlBulkDocs(dbOpts, req, opts, api, db, websqlChanges, callback) {
  var newEdits = opts.new_edits;
  var userDocs = req.docs;
  var docInfos = userDocs.map(function(doc) {
    if (doc._id && (0, import_pouchdb_adapter_utils.isLocalId)(doc._id)) {
      return doc;
    }
    var newDoc = (0, import_pouchdb_adapter_utils.parseDoc)(doc, newEdits, dbOpts);
    return newDoc;
  });
  var docInfoErrors = docInfos.filter(function(docInfo) {
    return docInfo.error;
  });
  if (docInfoErrors.length) {
    return callback(docInfoErrors[0]);
  }
  var tx;
  var results = new Array(docInfos.length);
  var fetchedDocs = /* @__PURE__ */ new Map();
  var preconditionErrored;
  function complete() {
    if (preconditionErrored) {
      return callback(preconditionErrored);
    }
    websqlChanges.notify(api._name);
    callback(null, results);
  }
  function verifyAttachment(digest, callback2) {
    var sql = "SELECT count(*) as cnt FROM " + import_constants.ATTACH_STORE + " WHERE digest=?";
    tx.executeSql(sql, [digest], function(tx2, result) {
      if (result.rows.item(0).cnt === 0) {
        var err = (0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_STUB, "unknown stub attachment with digest " + digest);
        callback2(err);
      } else {
        callback2();
      }
    });
  }
  function verifyAttachments(finish) {
    var digests = [];
    docInfos.forEach(function(docInfo) {
      if (docInfo.data && docInfo.data._attachments) {
        Object.keys(docInfo.data._attachments).forEach(function(filename) {
          var att = docInfo.data._attachments[filename];
          if (att.stub) {
            digests.push(att.digest);
          }
        });
      }
    });
    if (!digests.length) {
      return finish();
    }
    var numDone = 0;
    var err;
    function checkDone() {
      if (++numDone === digests.length) {
        finish(err);
      }
    }
    digests.forEach(function(digest) {
      verifyAttachment(digest, function(attErr) {
        if (attErr && !err) {
          err = attErr;
        }
        checkDone();
      });
    });
  }
  function writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted, isUpdate, delta, resultsIdx, callback2) {
    function finish() {
      var data = docInfo.data;
      var deletedInt = newRevIsDeleted ? 1 : 0;
      var id = data._id;
      var rev = data._rev;
      var json = (0, import_utils.stringifyDoc)(data);
      var sql = "INSERT INTO " + import_constants.BY_SEQ_STORE + " (doc_id, rev, json, deleted) VALUES (?, ?, ?, ?);";
      var sqlArgs = [id, rev, json, deletedInt];
      function insertAttachmentMappings(seq, callback3) {
        var attsAdded = 0;
        var attsToAdd = Object.keys(data._attachments || {});
        if (!attsToAdd.length) {
          return callback3();
        }
        function checkDone() {
          if (++attsAdded === attsToAdd.length) {
            callback3();
          }
          return false;
        }
        function add(att) {
          var sql2 = "INSERT INTO " + import_constants.ATTACH_AND_SEQ_STORE + " (digest, seq) VALUES (?,?)";
          var sqlArgs2 = [data._attachments[att].digest, seq];
          tx.executeSql(sql2, sqlArgs2, checkDone, checkDone);
        }
        for (var i = 0; i < attsToAdd.length; i++) {
          add(attsToAdd[i]);
        }
      }
      tx.executeSql(sql, sqlArgs, function(tx2, result) {
        var seq = result.insertId;
        insertAttachmentMappings(seq, function() {
          dataWritten(tx2, seq);
        });
      }, function() {
        var fetchSql = (0, import_utils.select)("seq", import_constants.BY_SEQ_STORE, null, "doc_id=? AND rev=?");
        tx.executeSql(fetchSql, [id, rev], function(tx2, res) {
          var seq = res.rows && res.rows.length > 0 && res.rows.item(0).seq || 0;
          var sql2 = "UPDATE " + import_constants.BY_SEQ_STORE + " SET json=?, deleted=? WHERE doc_id=? AND rev=?;";
          var sqlArgs2 = [json, deletedInt, id, rev];
          tx2.executeSql(sql2, sqlArgs2, function(tx3) {
            insertAttachmentMappings(seq, function() {
              dataWritten(tx3, seq);
            });
          });
        });
        return false;
      });
    }
    function collectResults(attachmentErr) {
      if (!err) {
        if (attachmentErr) {
          err = attachmentErr;
          callback2(err);
        } else if (recv === attachments.length) {
          finish();
        }
      }
    }
    var err = null;
    var recv = 0;
    docInfo.data._id = docInfo.metadata.id;
    docInfo.data._rev = docInfo.metadata.rev;
    var attachments = Object.keys(docInfo.data._attachments || {});
    if (newRevIsDeleted) {
      docInfo.data._deleted = true;
    }
    function attachmentSaved(err2) {
      recv++;
      collectResults(err2);
    }
    attachments.forEach(function(key) {
      var att = docInfo.data._attachments[key];
      if (!att.stub) {
        var data = att.data;
        delete att.data;
        att.revpos = parseInt(winningRev, 10);
        var digest = att.digest;
        saveAttachment(digest, data, attachmentSaved);
      } else {
        recv++;
        collectResults();
      }
    });
    if (!attachments.length) {
      finish();
    }
    function dataWritten(tx2, seq) {
      var id = docInfo.metadata.id;
      var revsToCompact = docInfo.stemmedRevs || [];
      if (isUpdate && api.auto_compaction) {
        revsToCompact = (0, import_pouchdb_merge.compactTree)(docInfo.metadata).concat(revsToCompact);
      }
      if (revsToCompact.length) {
        (0, import_utils.compactRevs)(revsToCompact, id, tx2);
      }
      docInfo.metadata.seq = seq;
      var rev = docInfo.metadata.rev;
      delete docInfo.metadata.rev;
      var sql = isUpdate ? "UPDATE " + import_constants.DOC_STORE + " SET json=?, max_seq=?, winningseq=(SELECT seq FROM " + import_constants.BY_SEQ_STORE + " WHERE doc_id=" + import_constants.DOC_STORE + ".id AND rev=?) WHERE id=?" : "INSERT INTO " + import_constants.DOC_STORE + " (id, winningseq, max_seq, json) VALUES (?,?,?,?);";
      var metadataStr = (0, import_pouchdb_json.safeJsonStringify)(docInfo.metadata);
      var params = isUpdate ? [metadataStr, seq, winningRev, id] : [id, seq, seq, metadataStr];
      tx2.executeSql(sql, params, function() {
        results[resultsIdx] = {
          ok: true,
          id: docInfo.metadata.id,
          rev
        };
        fetchedDocs.set(id, docInfo.metadata);
        callback2();
      });
    }
  }
  function websqlProcessDocs() {
    (0, import_pouchdb_adapter_utils.processDocs)(dbOpts.revs_limit, docInfos, api, fetchedDocs, tx, results, writeDoc, opts);
  }
  function fetchExistingDocs(callback2) {
    if (!docInfos.length) {
      return callback2();
    }
    var numFetched = 0;
    function checkDone() {
      if (++numFetched === docInfos.length) {
        callback2();
      }
    }
    docInfos.forEach(function(docInfo) {
      if (docInfo._id && (0, import_pouchdb_adapter_utils.isLocalId)(docInfo._id)) {
        return checkDone();
      }
      var id = docInfo.metadata.id;
      tx.executeSql("SELECT json FROM " + import_constants.DOC_STORE + " WHERE id = ?", [id], function(tx2, result) {
        if (result.rows.length) {
          var metadata = (0, import_pouchdb_json.safeJsonParse)(result.rows.item(0).json);
          fetchedDocs.set(id, metadata);
        }
        checkDone();
      });
    });
  }
  function saveAttachment(digest, data, callback2) {
    var sql = "SELECT digest FROM " + import_constants.ATTACH_STORE + " WHERE digest=?";
    tx.executeSql(sql, [digest], function(tx2, result) {
      if (result.rows.length) {
        return callback2();
      }
      sql = "INSERT INTO " + import_constants.ATTACH_STORE + " (digest, body, escaped) VALUES (?,?,1)";
      tx2.executeSql(sql, [digest, (0, import_utils.escapeBlob)(data)], function() {
        callback2();
      }, function() {
        callback2();
        return false;
      });
    });
  }
  (0, import_pouchdb_adapter_utils.preprocessAttachments)(docInfos, "binary", function(err) {
    if (err) {
      return callback(err);
    }
    db.transaction(function(txn) {
      tx = txn;
      verifyAttachments(function(err2) {
        if (err2) {
          preconditionErrored = err2;
        } else {
          fetchExistingDocs(websqlProcessDocs);
        }
      });
    }, (0, import_utils.websqlError)(callback), complete);
  });
}
var bulkDocs_default = websqlBulkDocs;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
