const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const assert = require("node:assert/strict");
const { montar } = require("./ajuda");
const { gerarCsv, lerCsv } = require("../src/csv");
const { migrarLegado } = require("../src/legado");
const { abrirBanco } = require("../src/db");

let t;
beforeEach(() => { t = montar(); });
const importar = (csv, q = "") => t.api.post(`/api/import${q}`).set("Content-Type", "text/csv").send(csv);

test("lerCsv e gerarCsv: aspas, delimitador e fórmulas", () => {
  assert.deepEqual(lerCsv('a;b\r\n1;"x; y"\r\n2;"diz ""oi"""\r\n'), [["a", "b"], ["1", "x; y"], ["2", 'diz "oi"']]);
  assert.deepEqual(lerCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]], "detecta vírgula");
  assert.deepEqual(lerCsv("﻿a;b\n\n1;2\n"), [["a", "b"], ["1", "2"]], "ignora BOM e linhas vazias");
  const saida = gerarCsv([["a", "b;c"], ["=SOMA(1;1)", "-5"]]);
  assert.ok(saida.startsWith("﻿"));
  assert.ok(saida.includes('"b;c"'));
  assert.ok(saida.includes("'=SOMA"), "célula que começa com = não vira fórmula na planilha");
  assert.ok(saida.includes(";-5"), "número negativo não é tratado como fórmula");
});

test("exporta o estoque em CSV pronto para o Excel brasileiro", async () => {
  await t.criar({ sku: "CAN-1", name: 'Caneta "premium"', price: "3,5", cost: "1,2", quantity: 10, minQuantity: 3 });
  const r = await t.api.get("/api/export.csv");
  assert.match(r.headers["content-type"], /text\/csv/);
  assert.match(r.headers["content-disposition"], /estoque\.csv/);
  const linhas = lerCsv(r.text);
  assert.deepEqual(linhas[0], ["sku", "nome", "categoria", "descricao", "preco", "custo", "quantidade", "estoque_minimo"]);
  assert.deepEqual(linhas[1], ["CAN-1", 'Caneta "premium"', "Escrita", "", "3,50", "1,20", "10", "3"]);
});

test("importa criando e atualizando por SKU, com ajuste de estoque registrado", async () => {
  const existente = await t.criar({ sku: "CAN-1", quantity: 10 });
  const csv = [
    "sku;nome;categoria;preco;custo;quantidade;estoque_minimo",
    "CAN-1;Caneta azul 2.0;Escrita;4,00;1,50;7;2",
    "LAP-1;Lápis HB;Escrita;1,20;0,40;100;20",
    "",
  ].join("\r\n");
  const r = await importar(csv);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.created, r.body.updated, r.body.simulated], [1, 1, false]);
  const atual = (await t.api.get(`/api/products/${existente.id}`)).body;
  assert.deepEqual([atual.name, atual.priceCents, atual.quantity], ["Caneta azul 2.0", 400, 7]);
  const hist = (await t.api.get(`/api/products/${existente.id}/movements`)).body;
  assert.deepEqual([hist[0].type, hist[0].delta, hist[0].note], ["ajuste", -3, "Importação CSV"]);
  assert.equal((await t.api.get("/api/products?q=LAP-1")).body.items[0].quantity, 100);
});

test("importação aceita vírgula como delimitador, cabeçalhos com acento e colunas em outra ordem", async () => {
  const r = await importar('Nome,SKU,Preço,Quantidade\n"Caderno, 96 folhas",CAD-1,"18,90",5\n');
  assert.equal(r.status, 200);
  const p = (await t.api.get("/api/products?q=CAD-1")).body.items[0];
  assert.deepEqual([p.name, p.priceCents, p.quantity], ["Caderno, 96 folhas", 1890, 5]);
});

test("importação é tudo ou nada: com erro, nada é gravado e as linhas problemáticas são apontadas", async () => {
  const csv = ["sku;nome;preco;quantidade", "OK-1;Bom produto;5;3", "RUIM-1;;5;3", "RUIM-2;Preço torto;abc;1", "OK-1;Repetido;1;1"].join("\n");
  const r = await importar(csv);
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.details.map((d) => d.line), [3, 4, 5]);
  assert.match(r.body.details[2].message, /repetido/i);
  assert.equal((await t.api.get("/api/products")).body.total, 0, "nenhum produto foi criado");
});

test("simular mostra o que aconteceria sem gravar", async () => {
  await t.criar({ sku: "CAN-1", quantity: 10 });
  const r = await importar("sku;nome;quantidade\nCAN-1;Caneta;50\nNOVO-1;Novo;5\n", "?simular=1");
  assert.deepEqual([r.body.created, r.body.updated, r.body.simulated], [1, 1, true]);
  assert.equal((await t.api.get("/api/products?q=NOVO-1")).body.total, 0);
  assert.equal((await t.api.get("/api/products?q=CAN-1")).body.items[0].quantity, 10);
});

test("importação recusa arquivo sem cabeçalho obrigatório ou vazio", async () => {
  assert.equal((await importar("nome;preco\nX;1\n")).status, 400);
  assert.equal((await importar("sku;nome\n")).status, 400);
  assert.equal((await importar("   ")).status, 400);
});

test("migra o banco da versão antiga (tabela Products, preço em float) uma única vez", () => {
  // arquivo SQLite de verdade, no formato que o projeto antigo gravava
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "almox-"));
  const arquivo = path.join(dir, "antigo.sqlite");
  const velho = new DatabaseSync(arquivo);
  velho.exec("CREATE TABLE Products (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255), description TEXT, price FLOAT, quantity INTEGER, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)");
  velho.prepare("INSERT INTO Products (name, description, price, quantity, createdAt, updatedAt) VALUES ('Mouse', 'USB', 49.9, 7, 'x', 'x'), ('Teclado', NULL, 129.99, 0, 'x', 'x')").run();
  velho.close();

  const db = abrirBanco(arquivo); // renomeia a tabela antiga e cria o esquema novo ao lado
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'products'").get().n, 1, "tabela nova existe");
  assert.equal(migrarLegado(db), 2);
  assert.equal(migrarLegado(db), 0, "segunda execução não duplica");
  assert.equal(migrarLegado(abrirBanco(arquivo)), 0, "reabrir o arquivo também não duplica");
  const m = db.prepare("SELECT * FROM products WHERE sku = 'LEG-0001'").get();
  assert.deepEqual([m.name, m.price_cents, m.quantity], ["Mouse", 4990, 7]);
  assert.equal(db.prepare("SELECT price_cents FROM products WHERE sku = 'LEG-0002'").get().price_cents, 12999);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM movements").get().n, 1, "só o produto com estoque ganha movimentação inicial");
  assert.equal(migrarLegado(abrirBanco(":memory:")), 0, "banco sem a tabela antiga não faz nada");
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test("erros de protocolo ficam limpos", async () => {
  assert.equal((await t.api.post("/api/products").set("Content-Type", "application/json").send("{ruim")).body.error, "JSON inválido.");
  assert.equal((await t.api.get("/api/nada")).status, 404);
});
