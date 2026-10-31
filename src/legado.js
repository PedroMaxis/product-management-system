/** Traz os produtos da versão antiga (tabela "Products", preço em float, renomeada para legacy_products ao abrir o banco)
 *  para o esquema novo. Idempotente: rodar de novo não duplica nada. */
const { transacao } = require("./db");

function migrarLegado(db) {
  const antiga = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'legacy_products'").get();
  if (!antiga) return 0;
  const linhas = db.prepare("SELECT id, name, description, price, quantity FROM legacy_products ORDER BY id").all();
  let importados = 0;
  transacao(db, () => {
    const ja = db.prepare("SELECT 1 FROM products WHERE sku = ?");
    const novo = db.prepare("INSERT INTO products (sku, name, description, price_cents, quantity) VALUES (?, ?, ?, ?, ?)");
    const mov = db.prepare("INSERT INTO movements (product_id, type, delta, balance, note) VALUES (?, 'inicial', ?, ?, 'Migrado da versão anterior')");
    for (const l of linhas) {
      const sku = `LEG-${String(l.id).padStart(4, "0")}`;
      if (ja.get(sku)) continue; // já migrado numa execução anterior
      const qtd = Math.max(0, Number.isInteger(l.quantity) ? l.quantity : 0);
      const { lastInsertRowid } = novo.run(sku, String(l.name ?? "Sem nome").slice(0, 200) || "Sem nome", String(l.description ?? ""), Math.max(0, Math.round((Number(l.price) || 0) * 100)), qtd);
      if (qtd > 0) mov.run(Number(lastInsertRowid), qtd, qtd);
      importados++;
    }
  });
  return importados;
}
module.exports = { migrarLegado };
