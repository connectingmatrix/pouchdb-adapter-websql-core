var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var import_pouchdb_utils = require("pouchdb-utils");
var import_pouchdb_adapter_utils = require("pouchdb-adapter-utils");
var import_pouchdb_merge = require("pouchdb-merge");
var import_pouchdb_json = require("pouchdb-json");
var import_pouchdb_binary_utils = require("pouchdb-binary-utils");
var import_parseHex = __toESM(require("./parseHex"));
var import_bulkDocs = __toESM(require("./bulkDocs"));
var import_pouchdb_errors = require("pouchdb-errors");
var import_constants = require("./constants");
var import_utils = require("./utils");
var import_openDatabase = __toESM(require("./openDatabase"));
var websqlChanges = new import_pouchdb_utils.changesHandler();
function fetchAttachmentsIfNecessary(doc, opts, api, txn, cb) {
  var attachments = Object.keys(doc._attachments || {});
  if (!attachments.length) {
    return cb && cb();
  }
  var numDone = 0;
  function checkDone() {
    if (++numDone === attachments.length && cb) {
      cb();
    }
  }
  function fetchAttachment(doc2, att) {
    var attObj = doc2._attachments[att];
    var attOpts = { binary: opts.binary, ctx: txn };
    api._getAttachment(doc2._id, att, attObj, attOpts, function(_, data) {
      doc2._attachments[att] = Object.assign((0, import_pouchdb_utils.pick)(attObj, ["digest", "content_type"]), { data });
      checkDone();
    });
  }
  attachments.forEach(function(att) {
    if (opts.attachments && opts.include_docs) {
      fetchAttachment(doc, att);
    } else {
      doc._attachments[att].stub = true;
      checkDone();
    }
  });
}
var POUCH_VERSION = 1;
var BY_SEQ_STORE_DELETED_INDEX_SQL = "CREATE INDEX IF NOT EXISTS 'by-seq-deleted-idx' ON " + import_constants.BY_SEQ_STORE + " (seq, deleted)";
var BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL = "CREATE UNIQUE INDEX IF NOT EXISTS 'by-seq-doc-id-rev' ON " + import_constants.BY_SEQ_STORE + " (doc_id, rev)";
var DOC_STORE_WINNINGSEQ_INDEX_SQL = "CREATE INDEX IF NOT EXISTS 'doc-winningseq-idx' ON " + import_constants.DOC_STORE + " (winningseq)";
var ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL = "CREATE INDEX IF NOT EXISTS 'attach-seq-seq-idx' ON " + import_constants.ATTACH_AND_SEQ_STORE + " (seq)";
var ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL = "CREATE UNIQUE INDEX IF NOT EXISTS 'attach-seq-digest-idx' ON " + import_constants.ATTACH_AND_SEQ_STORE + " (digest, seq)";
var DOC_STORE_AND_BY_SEQ_JOINER = import_constants.BY_SEQ_STORE + ".seq = " + import_constants.DOC_STORE + ".winningseq";
var SELECT_DOCS = import_constants.BY_SEQ_STORE + ".seq AS seq, " + import_constants.BY_SEQ_STORE + ".deleted AS deleted, " + import_constants.BY_SEQ_STORE + ".json AS data, " + import_constants.BY_SEQ_STORE + ".rev AS rev, " + import_constants.DOC_STORE + ".json AS metadata";
function WebSqlPouch(opts, callback) {
  var api = this;
  var instanceId = null;
  var size = (0, import_utils.getSize)(opts);
  var idRequests = [];
  var encoding;
  api._name = opts.name;
  var websqlOpts = Object.assign({}, opts, {
    version: POUCH_VERSION,
    description: opts.name,
    size
  });
  var openDBResult = (0, import_openDatabase.default)(websqlOpts);
  if (openDBResult.error) {
    return (0, import_utils.websqlError)(callback)(openDBResult.error);
  }
  var db = openDBResult.db;
  if (typeof db.readTransaction !== "function") {
    db.readTransaction = db.transaction;
  }
  function dbCreated() {
    if ((0, import_pouchdb_utils.hasLocalStorage)()) {
      window.localStorage["_pouch__websqldb_" + api._name] = true;
    }
    callback(null, api);
  }
  function runMigration2(tx, callback2) {
    tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
    tx.executeSql("ALTER TABLE " + import_constants.BY_SEQ_STORE + " ADD COLUMN deleted TINYINT(1) DEFAULT 0", [], function() {
      tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
      tx.executeSql("ALTER TABLE " + import_constants.DOC_STORE + " ADD COLUMN local TINYINT(1) DEFAULT 0", [], function() {
        tx.executeSql("CREATE INDEX IF NOT EXISTS 'doc-store-local-idx' ON " + import_constants.DOC_STORE + " (local, id)");
        var sql = "SELECT " + import_constants.DOC_STORE + ".winningseq AS seq, " + import_constants.DOC_STORE + ".json AS metadata FROM " + import_constants.BY_SEQ_STORE + " JOIN " + import_constants.DOC_STORE + " ON " + import_constants.BY_SEQ_STORE + ".seq = " + import_constants.DOC_STORE + ".winningseq";
        tx.executeSql(sql, [], function(tx2, result) {
          var deleted = [];
          var local = [];
          for (var i = 0; i < result.rows.length; i++) {
            var item = result.rows.item(i);
            var seq = item.seq;
            var metadata = JSON.parse(item.metadata);
            if ((0, import_pouchdb_adapter_utils.isDeleted)(metadata)) {
              deleted.push(seq);
            }
            if ((0, import_pouchdb_adapter_utils.isLocalId)(metadata.id)) {
              local.push(metadata.id);
            }
          }
          tx2.executeSql("UPDATE " + import_constants.DOC_STORE + "SET local = 1 WHERE id IN " + (0, import_utils.qMarks)(local.length), local, function() {
            tx2.executeSql("UPDATE " + import_constants.BY_SEQ_STORE + " SET deleted = 1 WHERE seq IN " + (0, import_utils.qMarks)(deleted.length), deleted, callback2);
          });
        });
      });
    });
  }
  function runMigration3(tx, callback2) {
    var local = "CREATE TABLE IF NOT EXISTS " + import_constants.LOCAL_STORE + " (id UNIQUE, rev, json)";
    tx.executeSql(local, [], function() {
      var sql = "SELECT " + import_constants.DOC_STORE + ".id AS id, " + import_constants.BY_SEQ_STORE + ".json AS data FROM " + import_constants.BY_SEQ_STORE + " JOIN " + import_constants.DOC_STORE + " ON " + import_constants.BY_SEQ_STORE + ".seq = " + import_constants.DOC_STORE + ".winningseq WHERE local = 1";
      tx.executeSql(sql, [], function(tx2, res) {
        var rows = [];
        for (var i = 0; i < res.rows.length; i++) {
          rows.push(res.rows.item(i));
        }
        function doNext() {
          if (!rows.length) {
            return callback2(tx2);
          }
          var row = rows.shift();
          var rev = JSON.parse(row.data)._rev;
          tx2.executeSql("INSERT INTO " + import_constants.LOCAL_STORE + " (id, rev, json) VALUES (?,?,?)", [row.id, rev, row.data], function(tx3) {
            tx3.executeSql("DELETE FROM " + import_constants.DOC_STORE + " WHERE id=?", [row.id], function(tx4) {
              tx4.executeSql("DELETE FROM " + import_constants.BY_SEQ_STORE + " WHERE seq=?", [row.seq], function() {
                doNext();
              });
            });
          });
        }
        doNext();
      });
    });
  }
  function runMigration4(tx, callback2) {
    function updateRows(rows) {
      function doNext() {
        if (!rows.length) {
          return callback2(tx);
        }
        var row = rows.shift();
        var doc_id_rev = (0, import_parseHex.default)(row.hex, encoding);
        var idx = doc_id_rev.lastIndexOf("::");
        var doc_id = doc_id_rev.substring(0, idx);
        var rev = doc_id_rev.substring(idx + 2);
        var sql2 = "UPDATE " + import_constants.BY_SEQ_STORE + " SET doc_id=?, rev=? WHERE doc_id_rev=?";
        tx.executeSql(sql2, [doc_id, rev, doc_id_rev], function() {
          doNext();
        });
      }
      doNext();
    }
    var sql = "ALTER TABLE " + import_constants.BY_SEQ_STORE + " ADD COLUMN doc_id";
    tx.executeSql(sql, [], function(tx2) {
      var sql2 = "ALTER TABLE " + import_constants.BY_SEQ_STORE + " ADD COLUMN rev";
      tx2.executeSql(sql2, [], function(tx3) {
        tx3.executeSql(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL, [], function(tx4) {
          var sql3 = "SELECT hex(doc_id_rev) as hex FROM " + import_constants.BY_SEQ_STORE;
          tx4.executeSql(sql3, [], function(tx5, res) {
            var rows = [];
            for (var i = 0; i < res.rows.length; i++) {
              rows.push(res.rows.item(i));
            }
            updateRows(rows);
          });
        });
      });
    });
  }
  function runMigration5(tx, callback2) {
    function migrateAttsAndSeqs(tx2) {
      var sql = "SELECT COUNT(*) AS cnt FROM " + import_constants.ATTACH_STORE;
      tx2.executeSql(sql, [], function(tx3, res) {
        var count = res.rows.item(0).cnt;
        if (!count) {
          return callback2(tx3);
        }
        var offset = 0;
        var pageSize = 10;
        function nextPage() {
          var sql2 = (0, import_utils.select)(SELECT_DOCS + ", " + import_constants.DOC_STORE + ".id AS id", [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, null, import_constants.DOC_STORE + ".id ");
          sql2 += " LIMIT " + pageSize + " OFFSET " + offset;
          offset += pageSize;
          tx3.executeSql(sql2, [], function(tx4, res2) {
            if (!res2.rows.length) {
              return callback2(tx4);
            }
            var digestSeqs = {};
            function addDigestSeq(digest, seq) {
              var seqs = digestSeqs[digest] = digestSeqs[digest] || [];
              if (seqs.indexOf(seq) === -1) {
                seqs.push(seq);
              }
            }
            for (var i = 0; i < res2.rows.length; i++) {
              var row = res2.rows.item(i);
              var doc = (0, import_utils.unstringifyDoc)(row.data, row.id, row.rev);
              var atts = Object.keys(doc._attachments || {});
              for (var j = 0; j < atts.length; j++) {
                var att = doc._attachments[atts[j]];
                addDigestSeq(att.digest, row.seq);
              }
            }
            var digestSeqPairs = [];
            Object.keys(digestSeqs).forEach(function(digest) {
              var seqs = digestSeqs[digest];
              seqs.forEach(function(seq) {
                digestSeqPairs.push([digest, seq]);
              });
            });
            if (!digestSeqPairs.length) {
              return nextPage();
            }
            var numDone = 0;
            digestSeqPairs.forEach(function(pair) {
              var sql3 = "INSERT INTO " + import_constants.ATTACH_AND_SEQ_STORE + " (digest, seq) VALUES (?,?)";
              tx4.executeSql(sql3, pair, function() {
                if (++numDone === digestSeqPairs.length) {
                  nextPage();
                }
              });
            });
          });
        }
        nextPage();
      });
    }
    var attachAndRev = "CREATE TABLE IF NOT EXISTS " + import_constants.ATTACH_AND_SEQ_STORE + " (digest, seq INTEGER)";
    tx.executeSql(attachAndRev, [], function(tx2) {
      tx2.executeSql(ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL, [], function(tx3) {
        tx3.executeSql(ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL, [], migrateAttsAndSeqs);
      });
    });
  }
  function runMigration6(tx, callback2) {
    var sql = "ALTER TABLE " + import_constants.ATTACH_STORE + " ADD COLUMN escaped TINYINT(1) DEFAULT 0";
    tx.executeSql(sql, [], callback2);
  }
  function runMigration7(tx, callback2) {
    var sql = "ALTER TABLE " + import_constants.DOC_STORE + " ADD COLUMN max_seq INTEGER";
    tx.executeSql(sql, [], function(tx2) {
      var sql2 = "UPDATE " + import_constants.DOC_STORE + " SET max_seq=(SELECT MAX(seq) FROM " + import_constants.BY_SEQ_STORE + " WHERE doc_id=id)";
      tx2.executeSql(sql2, [], function(tx3) {
        var sql3 = "CREATE UNIQUE INDEX IF NOT EXISTS 'doc-max-seq-idx' ON " + import_constants.DOC_STORE + " (max_seq)";
        tx3.executeSql(sql3, [], callback2);
      });
    });
  }
  function checkEncoding(tx, cb) {
    tx.executeSql('SELECT HEX("a") AS hex', [], function(tx2, res) {
      var hex = res.rows.item(0).hex;
      encoding = hex.length === 2 ? "UTF-8" : "UTF-16";
      cb();
    });
  }
  function onGetInstanceId() {
    while (idRequests.length > 0) {
      var idCallback = idRequests.pop();
      idCallback(null, instanceId);
    }
  }
  function onGetVersion(tx, dbVersion) {
    if (dbVersion === 0) {
      var meta = "CREATE TABLE IF NOT EXISTS " + import_constants.META_STORE + " (dbid, db_version INTEGER)";
      var attach = "CREATE TABLE IF NOT EXISTS " + import_constants.ATTACH_STORE + " (digest UNIQUE, escaped TINYINT(1), body BLOB)";
      var attachAndRev = "CREATE TABLE IF NOT EXISTS " + import_constants.ATTACH_AND_SEQ_STORE + " (digest, seq INTEGER)";
      var doc = "CREATE TABLE IF NOT EXISTS " + import_constants.DOC_STORE + " (id unique, json, winningseq, max_seq INTEGER UNIQUE)";
      var seq = "CREATE TABLE IF NOT EXISTS " + import_constants.BY_SEQ_STORE + " (seq INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, json, deleted TINYINT(1), doc_id, rev)";
      var local = "CREATE TABLE IF NOT EXISTS " + import_constants.LOCAL_STORE + " (id UNIQUE, rev, json)";
      tx.executeSql(attach);
      tx.executeSql(local);
      tx.executeSql(attachAndRev, [], function() {
        tx.executeSql(ATTACH_AND_SEQ_STORE_SEQ_INDEX_SQL);
        tx.executeSql(ATTACH_AND_SEQ_STORE_ATTACH_INDEX_SQL);
      });
      tx.executeSql(doc, [], function() {
        tx.executeSql(DOC_STORE_WINNINGSEQ_INDEX_SQL);
        tx.executeSql(seq, [], function() {
          tx.executeSql(BY_SEQ_STORE_DELETED_INDEX_SQL);
          tx.executeSql(BY_SEQ_STORE_DOC_ID_REV_INDEX_SQL);
          tx.executeSql(meta, [], function() {
            var initSeq = "INSERT INTO " + import_constants.META_STORE + " (db_version, dbid) VALUES (?,?)";
            instanceId = (0, import_pouchdb_utils.uuid)();
            var initSeqArgs = [import_constants.ADAPTER_VERSION, instanceId];
            tx.executeSql(initSeq, initSeqArgs, function() {
              onGetInstanceId();
            });
          });
        });
      });
    } else {
      var setupDone = function() {
        var migrated = dbVersion < import_constants.ADAPTER_VERSION;
        if (migrated) {
          tx.executeSql("UPDATE " + import_constants.META_STORE + " SET db_version = " + import_constants.ADAPTER_VERSION);
        }
        var sql = "SELECT dbid FROM " + import_constants.META_STORE;
        tx.executeSql(sql, [], function(tx2, result) {
          instanceId = result.rows.item(0).dbid;
          onGetInstanceId();
        });
      };
      var tasks = [
        runMigration2,
        runMigration3,
        runMigration4,
        runMigration5,
        runMigration6,
        runMigration7,
        setupDone
      ];
      var i = dbVersion;
      var nextMigration = function(tx2) {
        tasks[i - 1](tx2, nextMigration);
        i++;
      };
      nextMigration(tx);
    }
  }
  function setup() {
    db.transaction(function(tx) {
      checkEncoding(tx, function() {
        fetchVersion(tx);
      });
    }, (0, import_utils.websqlError)(callback), dbCreated);
  }
  function fetchVersion(tx) {
    var sql = "SELECT sql FROM sqlite_master WHERE tbl_name = " + import_constants.META_STORE;
    tx.executeSql(sql, [], function(tx2, result) {
      if (!result.rows.length) {
        onGetVersion(tx2, 0);
      } else if (!/db_version/.test(result.rows.item(0).sql)) {
        tx2.executeSql("ALTER TABLE " + import_constants.META_STORE + " ADD COLUMN db_version INTEGER", [], function() {
          onGetVersion(tx2, 1);
        });
      } else {
        tx2.executeSql("SELECT db_version FROM " + import_constants.META_STORE, [], function(tx3, result2) {
          var dbVersion = result2.rows.item(0).db_version;
          onGetVersion(tx3, dbVersion);
        });
      }
    });
  }
  setup();
  function getMaxSeq(tx, callback2) {
    var sql = "SELECT MAX(seq) AS seq FROM " + import_constants.BY_SEQ_STORE;
    tx.executeSql(sql, [], function(tx2, res) {
      var updateSeq = res.rows.item(0).seq || 0;
      callback2(updateSeq);
    });
  }
  function countDocs(tx, callback2) {
    var sql = (0, import_utils.select)("COUNT(" + import_constants.DOC_STORE + ".id) AS 'num'", [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, import_constants.BY_SEQ_STORE + ".deleted=0");
    tx.executeSql(sql, [], function(tx2, result) {
      callback2(result.rows.item(0).num);
    });
  }
  api._remote = false;
  api.type = function() {
    return "websql";
  };
  api._id = (0, import_pouchdb_utils.toPromise)(function(callback2) {
    callback2(null, instanceId);
  });
  api._info = function(callback2) {
    var seq;
    var docCount;
    db.readTransaction(function(tx) {
      getMaxSeq(tx, function(theSeq) {
        seq = theSeq;
      });
      countDocs(tx, function(theDocCount) {
        docCount = theDocCount;
      });
    }, (0, import_utils.websqlError)(callback2), function() {
      callback2(null, {
        doc_count: docCount,
        update_seq: seq,
        websql_encoding: encoding
      });
    });
  };
  api._bulkDocs = function(req, reqOpts, callback2) {
    (0, import_bulkDocs.default)(opts, req, reqOpts, api, db, websqlChanges, callback2);
  };
  function latest(tx, id, rev, callback2, finish) {
    var sql = (0, import_utils.select)(SELECT_DOCS, [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, import_constants.DOC_STORE + ".id=?");
    var sqlArgs = [id];
    tx.executeSql(sql, sqlArgs, function(a, results) {
      if (!results.rows.length) {
        var err = (0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_DOC, "missing");
        return finish(err);
      }
      var item = results.rows.item(0);
      var metadata = (0, import_pouchdb_json.safeJsonParse)(item.metadata);
      callback2((0, import_pouchdb_merge.latest)(rev, metadata));
    });
  }
  api._get = function(id, opts2, callback2) {
    var doc;
    var metadata;
    var tx = opts2.ctx;
    if (!tx) {
      return db.readTransaction(function(txn) {
        api._get(id, Object.assign({ ctx: txn }, opts2), callback2);
      });
    }
    function finish(err) {
      callback2(err, { doc, metadata, ctx: tx });
    }
    var sql;
    var sqlArgs;
    if (!opts2.rev) {
      sql = (0, import_utils.select)(SELECT_DOCS, [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, import_constants.DOC_STORE + ".id=?");
      sqlArgs = [id];
    } else if (opts2.latest) {
      latest(tx, id, opts2.rev, function(latestRev) {
        opts2.latest = false;
        opts2.rev = latestRev;
        api._get(id, opts2, callback2);
      }, finish);
      return;
    } else {
      sql = (0, import_utils.select)(SELECT_DOCS, [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], import_constants.DOC_STORE + ".id=" + import_constants.BY_SEQ_STORE + ".doc_id", [import_constants.BY_SEQ_STORE + ".doc_id=?", import_constants.BY_SEQ_STORE + ".rev=?"]);
      sqlArgs = [id, opts2.rev];
    }
    tx.executeSql(sql, sqlArgs, function(a, results) {
      if (!results.rows.length) {
        var missingErr = (0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_DOC, "missing");
        return finish(missingErr);
      }
      var item = results.rows.item(0);
      metadata = (0, import_pouchdb_json.safeJsonParse)(item.metadata);
      if (item.deleted && !opts2.rev) {
        var deletedErr = (0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_DOC, "deleted");
        return finish(deletedErr);
      }
      doc = (0, import_utils.unstringifyDoc)(item.data, metadata.id, item.rev);
      finish();
    });
  };
  api._allDocs = function(opts2, callback2) {
    var results = [];
    var totalRows;
    var updateSeq;
    var start = "startkey" in opts2 ? opts2.startkey : false;
    var end = "endkey" in opts2 ? opts2.endkey : false;
    var key = "key" in opts2 ? opts2.key : false;
    var keys = "keys" in opts2 ? opts2.keys : false;
    var descending = "descending" in opts2 ? opts2.descending : false;
    var limit = "limit" in opts2 ? opts2.limit : -1;
    var offset = "skip" in opts2 ? opts2.skip : 0;
    var inclusiveEnd = opts2.inclusive_end !== false;
    var sqlArgs = [];
    var criteria = [];
    var keyChunks = [];
    if (keys) {
      var destinctKeys = [];
      keys.forEach(function(key2) {
        if (destinctKeys.indexOf(key2) === -1) {
          destinctKeys.push(key2);
        }
      });
      for (var index = 0; index < destinctKeys.length; index += 999) {
        var chunk = destinctKeys.slice(index, index + 999);
        if (chunk.length > 0) {
          keyChunks.push(chunk);
        }
      }
    } else if (key !== false) {
      criteria.push(import_constants.DOC_STORE + ".id = ?");
      sqlArgs.push(key);
    } else if (start !== false || end !== false) {
      if (start !== false) {
        criteria.push(import_constants.DOC_STORE + ".id " + (descending ? "<=" : ">=") + " ?");
        sqlArgs.push(start);
      }
      if (end !== false) {
        var comparator = descending ? ">" : "<";
        if (inclusiveEnd) {
          comparator += "=";
        }
        criteria.push(import_constants.DOC_STORE + ".id " + comparator + " ?");
        sqlArgs.push(end);
      }
      if (key !== false) {
        criteria.push(import_constants.DOC_STORE + ".id = ?");
        sqlArgs.push(key);
      }
    }
    if (!keys) {
      criteria.push(import_constants.BY_SEQ_STORE + ".deleted = 0");
    }
    db.readTransaction(function(tx) {
      countDocs(tx, function(docCount) {
        totalRows = docCount;
      });
      if (opts2.update_seq) {
        getMaxSeq(tx, function(theSeq) {
          updateSeq = theSeq;
        });
      }
      if (limit === 0) {
        return;
      }
      if (keys) {
        var finishedCount = 0;
        var allRows = [];
        keyChunks.forEach(function(keyChunk) {
          sqlArgs = [];
          criteria = [];
          var bindingStr = "";
          keyChunk.forEach(function() {
            bindingStr += "?,";
          });
          bindingStr = bindingStr.substring(0, bindingStr.length - 1);
          criteria.push(import_constants.DOC_STORE + ".id IN (" + bindingStr + ")");
          sqlArgs = sqlArgs.concat(keyChunk);
          var sql2 = (0, import_utils.select)(SELECT_DOCS, [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, criteria, import_constants.DOC_STORE + ".id " + (descending ? "DESC" : "ASC"));
          sql2 += " LIMIT " + limit + " OFFSET " + offset;
          tx.executeSql(sql2, sqlArgs, function(tx2, result) {
            finishedCount++;
            for (var index2 = 0; index2 < result.rows.length; index2++) {
              allRows.push(result.rows.item(index2));
            }
            if (finishedCount === keyChunks.length) {
              processResult(allRows);
            }
          });
        });
      } else {
        var sql = (0, import_utils.select)(SELECT_DOCS, [import_constants.DOC_STORE, import_constants.BY_SEQ_STORE], DOC_STORE_AND_BY_SEQ_JOINER, criteria, import_constants.DOC_STORE + ".id " + (descending ? "DESC" : "ASC"));
        sql += " LIMIT " + limit + " OFFSET " + offset;
        tx.executeSql(sql, sqlArgs, function(tx2, result) {
          var rows = [];
          for (var index2 = 0; index2 < result.rows.length; index2++) {
            rows.push(result.rows.item(index2));
          }
          processResult(rows);
        });
      }
      function processResult(rows) {
        for (var i = 0, l = rows.length; i < l; i++) {
          var item = rows[i];
          var metadata = (0, import_pouchdb_json.safeJsonParse)(item.metadata);
          var id = metadata.id;
          var data = (0, import_utils.unstringifyDoc)(item.data, id, item.rev);
          var winningRev = data._rev;
          var doc = {
            id,
            key: id,
            value: { rev: winningRev }
          };
          if (opts2.include_docs) {
            doc.doc = data;
            doc.doc._rev = winningRev;
            if (opts2.conflicts) {
              var conflicts = (0, import_pouchdb_merge.collectConflicts)(metadata);
              if (conflicts.length) {
                doc.doc._conflicts = conflicts;
              }
            }
            fetchAttachmentsIfNecessary(doc.doc, opts2, api, tx);
          }
          if (item.deleted) {
            if (keys) {
              doc.value.deleted = true;
              // doc.doc = data;
            } else {
              continue;
            }
          }
          if (!keys) {
            results.push(doc);
          } else {
            var index2 = keys.indexOf(id, index2);
            do {
              results[index2] = doc;
              index2 = keys.indexOf(id, index2 + 1);
            } while (index2 > -1 && index2 < keys.length);
          }
        }
        if (keys) {
          keys.forEach(function(key2, index3) {
            if (!results[index3]) {
              results[index3] = { key: key2, error: "not_found" };
            }
          });
        }
      }
    }, (0, import_utils.websqlError)(callback2), function() {
      var returnVal = {
        total_rows: totalRows,
        offset: opts2.skip,
        rows: results
      };
      if (opts2.update_seq) {
        returnVal.update_seq = updateSeq;
      }
      callback2(null, returnVal);
    });
  };
  api._changes = function(opts2) {
    opts2 = (0, import_pouchdb_utils.clone)(opts2);
    if (opts2.continuous) {
      var id = api._name + ":" + (0, import_pouchdb_utils.uuid)();
      websqlChanges.addListener(api._name, id, api, opts2);
      websqlChanges.notify(api._name);
      return {
        cancel: function() {
          websqlChanges.removeListener(api._name, id);
        }
      };
    }
    var descending = opts2.descending;
    opts2.since = opts2.since && !descending ? opts2.since : 0;
    var limit = "limit" in opts2 ? opts2.limit : -1;
    if (limit === 0) {
      limit = 1;
    }
    var results = [];
    var numResults = 0;
    function fetchChanges() {
      var selectStmt = import_constants.DOC_STORE + ".json AS metadata, " + import_constants.DOC_STORE + ".max_seq AS maxSeq, " + import_constants.BY_SEQ_STORE + ".json AS winningDoc, " + import_constants.BY_SEQ_STORE + ".rev AS winningRev ";
      var from = import_constants.DOC_STORE + " JOIN " + import_constants.BY_SEQ_STORE;
      var joiner = import_constants.DOC_STORE + ".id=" + import_constants.BY_SEQ_STORE + ".doc_id AND " + import_constants.DOC_STORE + ".winningseq=" + import_constants.BY_SEQ_STORE + ".seq";
      var criteria = ["maxSeq > ?"];
      var sqlArgs = [opts2.since];
      if (opts2.doc_ids) {
        criteria.push(import_constants.DOC_STORE + ".id IN " + (0, import_utils.qMarks)(opts2.doc_ids.length));
        sqlArgs = sqlArgs.concat(opts2.doc_ids);
      }
      var orderBy = "maxSeq " + (descending ? "DESC" : "ASC");
      var sql = (0, import_utils.select)(selectStmt, from, joiner, criteria, orderBy);
      var filter = (0, import_pouchdb_utils.filterChange)(opts2);
      if (!opts2.view && !opts2.filter) {
        sql += " LIMIT " + limit;
      }
      var lastSeq = opts2.since || 0;
      db.readTransaction(function(tx) {
        tx.executeSql(sql, sqlArgs, function(tx2, result) {
          function reportChange(change2) {
            return function() {
              opts2.onChange(change2);
            };
          }
          for (var i = 0, l = result.rows.length; i < l; i++) {
            var item = result.rows.item(i);
            var metadata = (0, import_pouchdb_json.safeJsonParse)(item.metadata);
            lastSeq = item.maxSeq;
            var doc = (0, import_utils.unstringifyDoc)(item.winningDoc, metadata.id, item.winningRev);
            var change = opts2.processChange(doc, metadata, opts2);
            change.seq = item.maxSeq;
            var filtered = filter(change);
            if (typeof filtered === "object") {
              return opts2.complete(filtered);
            }
            if (filtered) {
              numResults++;
              if (opts2.return_docs) {
                results.push(change);
              }
              if (opts2.attachments && opts2.include_docs) {
                fetchAttachmentsIfNecessary(doc, opts2, api, tx2, reportChange(change));
              } else {
                reportChange(change)();
              }
            }
            if (numResults === limit) {
              break;
            }
          }
        });
      }, (0, import_utils.websqlError)(opts2.complete), function() {
        if (!opts2.continuous) {
          opts2.complete(null, {
            results,
            last_seq: lastSeq
          });
        }
      });
    }
    fetchChanges();
  };
  api._close = function(callback2) {
    callback2();
  };
  api._getAttachment = function(docId, attachId, attachment, opts2, callback2) {
    var res;
    var tx = opts2.ctx;
    var digest = attachment.digest;
    var type = attachment.content_type;
    var sql = "SELECT escaped, CASE WHEN escaped = 1 THEN body ELSE HEX(body) END AS body FROM " + import_constants.ATTACH_STORE + " WHERE digest=?";
    tx.executeSql(sql, [digest], function(tx2, result) {
      var item = result.rows.item(0);
      var data = item.escaped ? (0, import_utils.unescapeBlob)(item.body) : (0, import_parseHex.default)(item.body, encoding);
      if (opts2.binary) {
        res = (0, import_pouchdb_binary_utils.binaryStringToBlobOrBuffer)(data, type);
      } else {
        res = (0, import_pouchdb_binary_utils.btoa)(data);
      }
      callback2(null, res);
    });
  };
  api._getRevisionTree = function(docId, callback2) {
    db.readTransaction(function(tx) {
      var sql = "SELECT json AS metadata FROM " + import_constants.DOC_STORE + " WHERE id = ?";
      tx.executeSql(sql, [docId], function(tx2, result) {
        if (!result.rows.length) {
          callback2((0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_DOC));
        } else {
          var data = (0, import_pouchdb_json.safeJsonParse)(result.rows.item(0).metadata);
          callback2(null, data.rev_tree);
        }
      });
    });
  };
  api._doCompaction = function(docId, revs, callback2) {
    if (!revs.length) {
      return callback2();
    }
    db.transaction(function(tx) {
      var sql = "SELECT json AS metadata FROM " + import_constants.DOC_STORE + " WHERE id = ?";
      tx.executeSql(sql, [docId], function(tx2, result) {
        var metadata = (0, import_pouchdb_json.safeJsonParse)(result.rows.item(0).metadata);
        (0, import_pouchdb_merge.traverseRevTree)(metadata.rev_tree, function(isLeaf, pos, revHash, ctx, opts2) {
          var rev = pos + "-" + revHash;
          if (revs.indexOf(rev) !== -1) {
            opts2.status = "missing";
          }
        });
        var sql2 = "UPDATE " + import_constants.DOC_STORE + " SET json = ? WHERE id = ?";
        tx2.executeSql(sql2, [(0, import_pouchdb_json.safeJsonStringify)(metadata), docId]);
      });
      (0, import_utils.compactRevs)(revs, docId, tx);
    }, (0, import_utils.websqlError)(callback2), function() {
      callback2();
    });
  };
  api._getLocal = function(id, callback2) {
    db.readTransaction(function(tx) {
      var sql = "SELECT json, rev FROM " + import_constants.LOCAL_STORE + " WHERE id=?";
      tx.executeSql(sql, [id], function(tx2, res) {
        if (res.rows.length) {
          var item = res.rows.item(0);
          var doc = (0, import_utils.unstringifyDoc)(item.json, id, item.rev);
          callback2(null, doc);
        } else {
          callback2((0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_DOC));
        }
      });
    });
  };
  api._putLocal = function(doc, opts2, callback2) {
    if (typeof opts2 === "function") {
      callback2 = opts2;
      opts2 = {};
    }
    delete doc._revisions;
    var oldRev = doc._rev;
    var id = doc._id;
    var newRev;
    if (!oldRev) {
      newRev = doc._rev = "0-1";
    } else {
      newRev = doc._rev = "0-" + (parseInt(oldRev.split("-")[1], 10) + 1);
    }
    var json = (0, import_utils.stringifyDoc)(doc);
    var ret;
    function putLocal(tx) {
      var sql;
      var values;
      if (oldRev) {
        sql = "UPDATE " + import_constants.LOCAL_STORE + " SET rev=?, json=? WHERE id=? AND rev=?";
        values = [newRev, json, id, oldRev];
      } else {
        sql = "INSERT INTO " + import_constants.LOCAL_STORE + " (id, rev, json) VALUES (?,?,?)";
        values = [id, newRev, json];
      }
      tx.executeSql(sql, values, function(tx2, res) {
        if (res.rowsAffected) {
          ret = { ok: true, id, rev: newRev };
          if (opts2.ctx) {
            callback2(null, ret);
          }
        } else {
          callback2((0, import_pouchdb_errors.createError)(import_pouchdb_errors.REV_CONFLICT));
        }
      }, function() {
        callback2((0, import_pouchdb_errors.createError)(import_pouchdb_errors.REV_CONFLICT));
        return false;
      });
    }
    if (opts2.ctx) {
      putLocal(opts2.ctx);
    } else {
      db.transaction(putLocal, (0, import_utils.websqlError)(callback2), function() {
        if (ret) {
          callback2(null, ret);
        }
      });
    }
  };
  api._removeLocal = function(doc, opts2, callback2) {
    if (typeof opts2 === "function") {
      callback2 = opts2;
      opts2 = {};
    }
    var ret;
    function removeLocal(tx) {
      var sql = "DELETE FROM " + import_constants.LOCAL_STORE + " WHERE id=? AND rev=?";
      var params = [doc._id, doc._rev];
      tx.executeSql(sql, params, function(tx2, res) {
        if (!res.rowsAffected) {
          return callback2((0, import_pouchdb_errors.createError)(import_pouchdb_errors.MISSING_DOC));
        }
        ret = { ok: true, id: doc._id, rev: "0-0" };
        if (opts2.ctx) {
          callback2(null, ret);
        }
      });
    }
    if (opts2.ctx) {
      removeLocal(opts2.ctx);
    } else {
      db.transaction(removeLocal, (0, import_utils.websqlError)(callback2), function() {
        if (ret) {
          callback2(null, ret);
        }
      });
    }
  };
  api._destroy = function(opts2, callback2) {
    websqlChanges.removeAllListeners(api._name);
    db.transaction(function(tx) {
      var stores = [
        import_constants.DOC_STORE,
        import_constants.BY_SEQ_STORE,
        import_constants.ATTACH_STORE,
        import_constants.META_STORE,
        import_constants.LOCAL_STORE,
        import_constants.ATTACH_AND_SEQ_STORE
      ];
      stores.forEach(function(store) {
        tx.executeSql("DROP TABLE IF EXISTS " + store, []);
      });
    }, (0, import_utils.websqlError)(callback2), function() {
      if ((0, import_pouchdb_utils.hasLocalStorage)()) {
        delete window.localStorage["_pouch__websqldb_" + api._name];
        delete window.localStorage[api._name];
      }
      callback2(null, { "ok": true });
    });
  };
}
var src_default = WebSqlPouch;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
