const { DatabaseSync } = require("node:sqlite");
const ESQUEMA = require("./esquema");

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A versão antiga tinha uma tabela "Products". O SQLite não diferencia maiúsculas em nomes de tabela, então ela
 *  ocuparia o lugar da nova "products": antes de criar o esquema, a antiga é renomeada (os dados ficam intactos). */
function guardarTabelaAntiga(db) {
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Products' COLLATE NOCASE").get();
  if (!t || t.name !== "Products") return;
  const colunas = db.prepare("PRAGMA table_info(Products)").all().map((c) => c.name);
  if (colunas.includes("price") && !colunas.includes("price_cents")) db.exec("ALTER TABLE Products RENAME TO legacy_products");
}

/** Abre o banco (SQLite embutido no Node: nada para compilar) e garante o esquema. Dinheiro sempre em centavos inteiros. */
function abrirBanco(arquivo = ":memory:") {
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  // busca sem acento nem maiúsculas: "lapis" encontra "Lápis"
  db.function("sem_acento", { deterministic: true }, (v) => semAcento(v));
  guardarTabelaAntiga(db);
  db.exec(ESQUEMA);
  return db;
}

/** Executa `fn` numa transação: tudo acontece ou nada acontece */
function transacao(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

module.exports = { abrirBanco, transacao, semAcento };
