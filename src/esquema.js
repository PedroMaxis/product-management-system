// Esquema do banco, compartilhado pelo servidor (node:sqlite) e pelo demo no navegador (sql.js)
module.exports = `
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
  `;
