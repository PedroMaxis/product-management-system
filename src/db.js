const { DatabaseSync } = require("node:sqlite");

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sku          TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      category     TEXT NOT NULL DEFAULT 'Geral',
      price_cents  INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
      cost_cents   INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
      quantity     INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      min_quantity INTEGER NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
      active       INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- livro-razão do estoque: cada mudança de quantidade vira uma linha, com o saldo depois dela
    CREATE TABLE IF NOT EXISTS movements (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK (type IN ('inicial', 'entrada', 'saida', 'ajuste')),
      delta      INTEGER NOT NULL,
      balance    INTEGER NOT NULL CHECK (balance >= 0),
      note       TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
    CREATE INDEX IF NOT EXISTS idx_movements_product ON movements (product_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_movements_data ON movements (created_at);
  `);
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
