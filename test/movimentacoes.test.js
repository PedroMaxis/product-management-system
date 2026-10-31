const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { montar } = require("./ajuda");

let t;
beforeEach(() => { t = montar(); });
const mov = (id, corpo) => t.api.post(`/api/products/${id}/movements`).send(corpo);

test("entrada, saída e ajuste mantêm o saldo e o histórico", async () => {
  const p = await t.criar({ quantity: 10 });
  const e = await mov(p.id, { type: "entrada", quantity: 5, note: "Compra do fornecedor" });
  assert.equal(e.status, 201);
  assert.deepEqual([e.body.movement.delta, e.body.movement.balance, e.body.product.quantity], [5, 15, 15]);
  const s = await mov(p.id, { type: "saida", quantity: "4" });
  assert.equal(s.body.product.quantity, 11);
  const a = await mov(p.id, { type: "ajuste", quantity: 8, note: "Contagem do inventário" });
  assert.deepEqual([a.body.movement.delta, a.body.product.quantity], [-3, 8]);

  const hist = (await t.api.get(`/api/products/${p.id}/movements`)).body;
  assert.deepEqual(hist.map((m) => [m.type, m.delta, m.balance]), [["ajuste", -3, 8], ["saida", -4, 11], ["entrada", 5, 15], ["entrada", 10, 10]], "do mais novo para o mais antigo");
  assert.equal(hist[0].note, "Contagem do inventário");
});

test("saída maior que o estoque é recusada sem alterar nada", async () => {
  const p = await t.criar({ quantity: 3 });
  const r = await mov(p.id, { type: "saida", quantity: 4 });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /3 em estoque/);
  assert.equal((await t.api.get(`/api/products/${p.id}`)).body.quantity, 3);
  assert.equal((await t.api.get(`/api/products/${p.id}/movements`)).body.length, 1, "nenhuma linha extra no histórico");
});

test("valida tipo e quantidades; ajuste para o mesmo valor é recusado; ajuste para zero vale", async () => {
  const p = await t.criar({ quantity: 5 });
  assert.equal((await mov(p.id, { type: "roubo", quantity: 1 })).status, 400);
  assert.equal((await mov(p.id, { type: "entrada", quantity: 0 })).status, 400);
  assert.equal((await mov(p.id, { type: "entrada", quantity: -2 })).status, 400);
  assert.equal((await mov(p.id, { type: "entrada", quantity: 2.5 })).status, 400);
  assert.equal((await mov(p.id, { type: "ajuste", quantity: 5 })).status, 400);
  const zero = await mov(p.id, { type: "ajuste", quantity: 0 });
  assert.equal(zero.body.product.status, "zerado");
  assert.equal((await mov(9999, { type: "entrada", quantity: 1 })).status, 404);
});

test("o estoque cruza o mínimo: ok → baixo → zerado", async () => {
  const p = await t.criar({ quantity: 10, minQuantity: 3 });
  assert.equal(p.status, "ok");
  assert.equal((await mov(p.id, { type: "saida", quantity: 7 })).body.product.status, "baixo");
  assert.equal((await mov(p.id, { type: "saida", quantity: 3 })).body.product.status, "zerado");
  assert.equal((await mov(p.id, { type: "entrada", quantity: 20 })).body.product.status, "ok");
});

test("resumo do painel: totais, valores, alertas, categorias e série de 14 dias", async () => {
  const a = await t.criar({ name: "Caneta", category: "Escrita", quantity: 10, minQuantity: 3, price: 5, cost: 2 });
  await t.criar({ name: "Caderno", category: "Papelaria", quantity: 0, minQuantity: 2, price: 20, cost: 10 });
  const c = await t.criar({ name: "Lápis", category: "Escrita", quantity: 4, minQuantity: 5, price: 1, cost: 0.5 });
  await mov(a.id, { type: "saida", quantity: 2 });

  const r = (await t.api.get("/api/summary")).body;
  assert.deepEqual([r.products, r.units, r.outOfStock, r.lowStock], [3, 12, 1, 1]);
  assert.equal(r.costValueCents, 8 * 200 + 4 * 50);
  assert.equal(r.retailValueCents, 8 * 500 + 4 * 100);
  assert.equal(r.potentialProfitCents, r.retailValueCents - r.costValueCents);
  assert.deepEqual(r.categories.map((x) => x.category), ["Escrita", "Papelaria"]);
  assert.deepEqual(r.attention.map((x) => x.name).sort(), ["Caderno", c.name].sort());
  assert.equal(r.movements.length, 14);
  const hoje = r.movements.at(-1);
  assert.deepEqual([hoje.in, hoje.out], [14, 2], "entradas iniciais (10 + 4) e a saída de hoje");
  assert.equal(r.movements.slice(0, 13).every((d) => d.in === 0 && d.out === 0), true, "dias sem movimento ficam zerados");
  assert.equal(r.recent.length > 0 && r.recent[0].productName === "Caneta", true);
});
