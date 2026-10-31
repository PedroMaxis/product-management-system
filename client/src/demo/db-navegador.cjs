// Substitui src/db.js no demo do navegador: mesma interface do node:sqlite (prepare/get/all/run/exec/function),
// mas sobre o SQLite em WebAssembly (sql.js). O SQL e as regras de src/estoque.js rodam sem mudança.
const ESQUEMA = require("../../../src/esquema");

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

class Banco {
  constructor(sqljs) { this.raw = new sqljs.Database(); }
  prepare(sql) {
    const raw = this.raw;
    const linhas = (params) => {
      const st = raw.prepare(sql);
      try { st.bind(params); const r = []; while (st.step()) r.push(st.getAsObject()); return r; } finally { st.free(); }
    };
    return {
      all: (...p) => linhas(p),
      get: (...p) => linhas(p)[0],
      run: (...p) => {
        raw.run(sql, p);
        return { lastInsertRowid: raw.exec("SELECT last_insert_rowid()")[0].values[0][0], changes: raw.getRowsModified() };
      },
    };
  }
  exec(sql) { this.raw.exec(sql); }
  function(nome, _opcoes, fn) { this.raw.create_function(nome, fn); }
}

function abrirBanco() {
  const db = new Banco(globalThis.__SQLJS__);
  db.exec("PRAGMA foreign_keys = ON");
  db.function("sem_acento", {}, (v) => semAcento(v));
  db.exec(ESQUEMA);
  return db;
}

function transacao(db, fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

module.exports = { abrirBanco, transacao, semAcento };
