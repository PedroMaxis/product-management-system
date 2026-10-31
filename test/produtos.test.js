const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { montar } = require("./ajuda");

let t;
beforeEach(() => { t = montar(); });

test("cria produto: SKU automático, valores em centavos e movimentação inicial", async () => {
  const r = await t.api.post("/api/products").send({ name: "  Caderno   Universitário ", price: "1.234,50", cost: 800, quantity: 12, minQuantity: 4, category: "Papelaria" });
  assert.equal(r.status, 201);
  assert.equal(r.body.sku, "PRD-0001");
  assert.equal(r.body.name, "Caderno Universitário", "espaços extras são limpos");
  assert.equal(r.body.priceCents, 123450);
  assert.equal(r.body.costCents, 80000);
  assert.equal(r.body.quantity, 12);
  assert.equal(r.body.status, "ok");
  assert.equal(r.body.marginPercent, 35.2);
  assert.equal(r.body.stockValueCents, 12 * 80000);
  const hist = (await t.api.get(`/api/products/${r.body.id}/movements`)).body;
  assert.equal(hist.length, 1);
  assert.deepEqual([hist[0].type, hist[0].delta, hist[0].balance], ["entrada", 12, 12]);
});

test("valida entrada: nome, preço, SKU e quantidade", async () => {
  const post = (c) => t.api.post("/api/products").send({ name: "Ok", ...c });
  assert.equal((await post({ name: "" })).status, 400);
  assert.equal((await post({ name: "x" })).status, 400);
  assert.equal((await post({ price: -1 })).status, 400);
  assert.equal((await post({ price: "abc" })).status, 400);
  assert.equal((await post({ quantity: -5 })).status, 400);
  assert.equal((await post({ quantity: 1.5 })).status, 400);
  assert.equal((await post({ sku: "com espaço" })).status, 400);
  assert.equal((await post({ sku: "ok-1" })).body.sku, "OK-1", "SKU vira maiúsculo");
});

test("SKU é único, sem diferenciar maiúsculas", async () => {
  await t.criar({ sku: "CAN-1" });
  const r = await t.api.post("/api/products").send({ name: "Outra caneta", sku: "can-1" });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /CAN-1/);
});

test("SKU automático não colide com SKU manual parecido", async () => {
  await t.criar({ sku: "PRD-0001" });
  assert.equal((await t.criar()).sku, "PRD-0002");
});

test("atualiza dados, mas a quantidade só muda por movimentação", async () => {
  const p = await t.criar();
  const ok = await t.api.put(`/api/products/${p.id}`).send({ name: "Caneta vermelha", price: 4 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "Caneta vermelha");
  assert.equal(ok.body.priceCents, 400);
  assert.equal(ok.body.costCents, 120, "campos não enviados ficam como estavam");
  const bloqueado = await t.api.put(`/api/products/${p.id}`).send({ quantity: 999 });
  assert.equal(bloqueado.status, 400);
  assert.match(bloqueado.body.error, /movimentação/);
  assert.equal((await t.api.get(`/api/products/${p.id}`)).body.quantity, 10);
  assert.equal((await t.api.put("/api/products/9999").send({ name: "Fantasma" })).status, 404);
});

test("excluir arquiva (e esconde da lista); restaurar traz de volta; arquivado não movimenta", async () => {
  const p = await t.criar();
  assert.equal((await t.api.delete(`/api/products/${p.id}`)).status, 204);
  assert.equal((await t.api.get("/api/products")).body.total, 0);
  const arq = (await t.api.get("/api/products?status=arquivado")).body;
  assert.equal(arq.total, 1);
  assert.equal(arq.items[0].status, "arquivado");
  assert.equal((await t.api.post(`/api/products/${p.id}/movements`).send({ type: "entrada", quantity: 1 })).status, 409);
  assert.equal((await t.api.patch(`/api/products/${p.id}`).send({ active: true })).body.active, true);
  assert.equal((await t.api.get("/api/products")).body.total, 1);
  assert.equal((await t.api.get("/api/products/abc")).status, 404);
});

test("lista com busca sem acento, filtros, ordenação e paginação", async () => {
  await t.criar({ name: "Lápis preto HB", category: "Escrita", quantity: 50, minQuantity: 10, price: 1 });
  await t.criar({ name: "Caderno 96 folhas", category: "Papelaria", quantity: 0, price: 18 });
  await t.criar({ name: "Caneta gel", category: "Escrita", quantity: 2, minQuantity: 5, price: 6 });
  await t.criar({ name: "Borracha branca", category: "Escrita", quantity: 30, minQuantity: 0, price: 2 });

  const q = (s) => t.api.get(`/api/products?${s}`).then((r) => r.body);
  assert.deepEqual((await q("q=lapis")).items.map((p) => p.name), ["Lápis preto HB"], "'lapis' acha 'Lápis'");
  assert.equal((await q("q=ESCRITA")).total, 3, "busca na categoria, sem diferenciar maiúsculas");
  assert.equal((await q("q=100%25")).total, 0, "% na busca é texto literal, não curinga");
  assert.deepEqual((await q("status=zerado")).items.map((p) => p.name), ["Caderno 96 folhas"]);
  assert.deepEqual((await q("status=baixo")).items.map((p) => p.name), ["Caneta gel"]);
  assert.equal((await q("status=ok")).total, 2);
  assert.equal((await q("category=Papelaria")).total, 1);
  assert.deepEqual((await q("sort=price&order=desc")).items.map((p) => p.priceCents), [1800, 600, 200, 100]);
  assert.deepEqual((await q("sort=name")).items.map((p) => p.name), ["Borracha branca", "Caderno 96 folhas", "Caneta gel", "Lápis preto HB"]);

  const p1 = await q("pageSize=3&page=1"), p2 = await q("pageSize=3&page=2");
  assert.deepEqual([p1.items.length, p2.items.length, p1.total, p1.pages], [3, 1, 4, 2]);
  assert.equal((await t.api.get("/api/products?sort=senha")).status, 400);
  assert.equal((await t.api.get("/api/products?status=xyz")).status, 400);
  assert.equal((await t.api.get("/api/products?pageSize=9999")).status, 400);
});

test("o seed de demonstração gera um histórico coerente (saldo nunca negativo e fecha com o estoque atual)", () => {
  const { semear, PRODUTOS } = require("../scripts/seed");
  assert.equal(semear(t.db), PRODUTOS.length);
  const ruins = t.db.prepare(`SELECT p.sku FROM products p WHERE p.quantity != COALESCE((SELECT balance FROM movements m WHERE m.product_id = p.id ORDER BY m.id DESC LIMIT 1), 0)`).all();
  assert.deepEqual(ruins, [], "o último saldo do histórico é a quantidade atual");
  assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM movements WHERE balance < 0").get().n, 0);
  // cada saldo = saldo anterior + delta
  for (const { id } of t.db.prepare("SELECT id FROM products").all()) {
    let saldo = 0;
    for (const m of t.db.prepare("SELECT delta, balance FROM movements WHERE product_id = ? ORDER BY id").all(id)) { saldo += m.delta; assert.equal(m.balance, saldo); }
  }
});
