/** Regras do estoque, direto no banco: produtos, movimentações, resumo e CSV. As rotas só traduzem HTTP. */
const { HttpError } = require("./errors");
const { transacao, semAcento } = require("./db");
const v = require("./validar");
const { gerarCsv, lerCsv } = require("./csv");

const TIPOS = ["entrada", "saida", "ajuste"];
const ORDENS = { name: "name", sku: "sku", price: "price_cents", cost: "cost_cents", quantity: "quantity", category: "category", updated: "updated_at" };
const STATUS = ["ok", "baixo", "zerado", "arquivado"];

const statusDe = (r) => (!r.active ? "arquivado" : r.quantity === 0 ? "zerado" : r.min_quantity > 0 && r.quantity <= r.min_quantity ? "baixo" : "ok");

function paraApi(r) {
  const margem = r.price_cents > 0 && r.cost_cents > 0 ? Math.round(((r.price_cents - r.cost_cents) / r.price_cents) * 1000) / 10 : null;
  return {
    id: r.id, sku: r.sku, name: r.name, description: r.description, category: r.category,
    priceCents: r.price_cents, costCents: r.cost_cents, quantity: r.quantity, minQuantity: r.min_quantity,
    status: statusDe(r), active: !!r.active, marginPercent: margem, stockValueCents: r.quantity * r.cost_cents,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const buscar = (db, id) => {
  const r = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!r) throw new HttpError(404, "Produto não encontrado.");
  return r;
};
const registrar = (db, productId, type, delta, balance, note = "") =>
  Number(db.prepare("INSERT INTO movements (product_id, type, delta, balance, note) VALUES (?, ?, ?, ?, ?)").run(productId, type, delta, balance, note).lastInsertRowid);
const movimentoParaApi = (m) => ({ id: m.id, productId: m.product_id, type: m.type, delta: m.delta, balance: m.balance, note: m.note, createdAt: m.created_at });

/* ---------- leitura de campos (criar e atualizar compartilham a validação) ---------- */
function lerCampos(corpo, { parcial }) {
  const c = {};
  const tem = (k) => corpo?.[k] !== undefined;
  if (!parcial || tem("name")) c.name = v.texto(corpo?.name, { campo: "nome", min: 2, max: 120 });
  if (!parcial || tem("description")) c.description = v.textoOpcional(corpo?.description, { campo: "descrição", max: 1000 });
  if (!parcial || tem("category")) c.category = corpo?.category ? v.texto(corpo.category, { campo: "categoria", min: 2, max: 40 }) : "Geral";
  if (!parcial || tem("price") || tem("priceCents")) c.price_cents = tem("priceCents") ? v.inteiro(corpo.priceCents, { campo: "preço", min: 0 }) : v.dinheiroEmCentavos(corpo?.price ?? 0, { campo: "preço" });
  if (!parcial || tem("cost") || tem("costCents")) c.cost_cents = tem("costCents") ? v.inteiro(corpo.costCents, { campo: "custo", min: 0 }) : v.dinheiroEmCentavos(corpo?.cost ?? 0, { campo: "custo" });
  if (!parcial || tem("minQuantity")) c.min_quantity = v.inteiro(corpo?.minQuantity ?? 0, { campo: "estoque mínimo", min: 0, max: 1_000_000 });
  if (tem("sku")) c.sku = v.sku(corpo.sku);
  return c;
}

/** Próximo SKU livre no formato PRD-0001 */
function proximoSku(db) {
  let n = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS n FROM products").get().n;
  for (;;) { const s = `PRD-${String(n).padStart(4, "0")}`; if (!db.prepare("SELECT 1 FROM products WHERE sku = ?").get(s)) return s; n++; }
}

/* ---------- produtos ---------- */
function listar(db, q = {}) {
  const onde = [], args = [];
  const status = q.status ? String(q.status) : "";
  if (status && !STATUS.includes(status)) throw new HttpError(400, `Status inválido. Use: ${STATUS.join(", ")}.`);
  if (status === "arquivado") onde.push("active = 0"); else onde.push("active = 1");
  if (status === "zerado") onde.push("quantity = 0");
  if (status === "baixo") onde.push("quantity > 0 AND min_quantity > 0 AND quantity <= min_quantity");
  if (status === "ok") onde.push("quantity > 0 AND (min_quantity = 0 OR quantity > min_quantity)");
  if (q.category) { onde.push("category = ?"); args.push(String(q.category)); }
  if (q.q && String(q.q).trim()) {
    onde.push("sem_acento(sku || ' ' || name || ' ' || category || ' ' || description) LIKE ? ESCAPE '\\'");
    args.push(`%${semAcento(String(q.q).trim()).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const coluna = ORDENS[q.sort ?? "name"];
  if (!coluna) throw new HttpError(400, `Ordenação inválida. Use: ${Object.keys(ORDENS).join(", ")}.`);
  const sentido = q.order === "desc" ? "DESC" : "ASC";
  const tamanho = Math.min(100, v.inteiro(q.pageSize ?? 20, { campo: "pageSize", min: 1, max: 100 }));
  const pagina = v.inteiro(q.page ?? 1, { campo: "page", min: 1, max: 100000 });
  const filtro = onde.length ? `WHERE ${onde.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products ${filtro}`).get(...args).n;
  const linhas = db.prepare(`SELECT * FROM products ${filtro} ORDER BY ${coluna === "name" || coluna === "sku" || coluna === "category" ? `${coluna} COLLATE NOCASE` : coluna} ${sentido}, id ASC LIMIT ? OFFSET ?`).all(...args, tamanho, (pagina - 1) * tamanho);
  return { items: linhas.map(paraApi), total, page: pagina, pageSize: tamanho, pages: Math.max(1, Math.ceil(total / tamanho)) };
}

function criar(db, corpo) {
  const c = lerCampos(corpo, { parcial: false });
  const quantidade = v.inteiro(corpo?.quantity ?? 0, { campo: "quantidade", min: 0, max: 1_000_000 });
  return transacao(db, () => {
    const sku = c.sku ?? proximoSku(db);
    if (db.prepare("SELECT 1 FROM products WHERE sku = ?").get(sku)) throw new HttpError(409, `Já existe um produto com o SKU ${sku}.`);
    const { lastInsertRowid } = db.prepare("INSERT INTO products (sku, name, description, category, price_cents, cost_cents, quantity, min_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(sku, c.name, c.description, c.category, c.price_cents, c.cost_cents, quantidade, c.min_quantity);
    const id = Number(lastInsertRowid);
    if (quantidade > 0) registrar(db, id, "entrada", quantidade, quantidade, "Estoque inicial");
    return paraApi(buscar(db, id));
  });
}

function atualizar(db, id, corpo) {
  if (corpo?.quantity !== undefined) throw new HttpError(400, "A quantidade não se edita direto: registre uma movimentação (entrada, saída ou ajuste) para manter o histórico.");
  const atual = buscar(db, id);
  const c = lerCampos(corpo, { parcial: true });
  if (corpo?.active !== undefined) c.active = corpo.active ? 1 : 0;
  if (c.sku && c.sku !== atual.sku && db.prepare("SELECT 1 FROM products WHERE sku = ? AND id != ?").get(c.sku, id)) throw new HttpError(409, `Já existe um produto com o SKU ${c.sku}.`);
  const colunas = Object.keys(c);
  if (colunas.length) db.prepare(`UPDATE products SET ${colunas.map((k) => `${k} = ?`).join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(...colunas.map((k) => c[k]), id); // colunas vêm de lerCampos, nunca do cliente
  return paraApi(buscar(db, id));
}

const arquivar = (db, id) => { buscar(db, id); db.prepare("UPDATE products SET active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(id); };

/* ---------- movimentações ---------- */
function movimentar(db, id, corpo) {
  const tipo = corpo?.type;
  if (!TIPOS.includes(tipo)) throw new HttpError(400, `Tipo inválido. Use: ${TIPOS.join(", ")}.`);
  const qtd = v.inteiro(corpo?.quantity, { campo: tipo === "ajuste" ? "nova quantidade" : "quantidade", min: tipo === "ajuste" ? 0 : 1, max: 1_000_000 });
  const nota = v.textoOpcional(corpo?.note, { campo: "observação", max: 200 });
  return transacao(db, () => {
    const p = buscar(db, id);
    if (!p.active) throw new HttpError(409, "Este produto está arquivado. Restaure-o antes de movimentar o estoque.");
    let delta;
    if (tipo === "entrada") delta = qtd;
    else if (tipo === "saida") { if (qtd > p.quantity) throw new HttpError(409, `Só há ${p.quantity} em estoque: não dá para sair ${qtd}.`); delta = -qtd; }
    else { delta = qtd - p.quantity; if (delta === 0) throw new HttpError(400, `O estoque já é ${p.quantity}: nada a ajustar.`); }
    const saldo = p.quantity + delta;
    db.prepare("UPDATE products SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(saldo, id);
    const mid = registrar(db, id, tipo, delta, saldo, nota);
    return { product: paraApi(buscar(db, id)), movement: movimentoParaApi(db.prepare("SELECT * FROM movements WHERE id = ?").get(mid)) };
  });
}

function historico(db, id, limite = 100) {
  buscar(db, id);
  return db.prepare("SELECT * FROM movements WHERE product_id = ? ORDER BY id DESC LIMIT ?").all(id, limite).map(movimentoParaApi);
}

/* ---------- resumo do painel ---------- */
function resumo(db, hoje = new Date()) {
  const t = db.prepare(`SELECT COUNT(*) AS produtos, COALESCE(SUM(quantity), 0) AS unidades,
      COALESCE(SUM(quantity * cost_cents), 0) AS custo, COALESCE(SUM(quantity * price_cents), 0) AS venda,
      COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS zerados,
      COALESCE(SUM(CASE WHEN quantity > 0 AND min_quantity > 0 AND quantity <= min_quantity THEN 1 ELSE 0 END), 0) AS baixos
    FROM products WHERE active = 1`).get();
  const categorias = db.prepare(`SELECT category, COUNT(*) AS produtos, SUM(quantity) AS unidades, SUM(quantity * cost_cents) AS valor
    FROM products WHERE active = 1 GROUP BY category ORDER BY valor DESC, category`).all().map((c) => ({ category: c.category, products: c.produtos, units: c.unidades, valueCents: c.valor }));
  // últimos 14 dias (em UTC), com zeros nos dias sem movimento
  const dias = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - (13 - i))); return d.toISOString().slice(0, 10); });
  const porDia = Object.fromEntries(db.prepare(`SELECT substr(created_at, 1, 10) AS dia, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS entradas, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS saidas
    FROM movements WHERE substr(created_at, 1, 10) >= ? GROUP BY dia`).all(dias[0]).map((r) => [r.dia, r]));
  const movimentos = dias.map((dia) => ({ day: dia, in: porDia[dia]?.entradas ?? 0, out: porDia[dia]?.saidas ?? 0 }));
  const atencao = db.prepare(`SELECT * FROM products WHERE active = 1 AND (quantity = 0 OR (min_quantity > 0 AND quantity <= min_quantity)) ORDER BY quantity ASC, name COLLATE NOCASE LIMIT 8`).all().map(paraApi);
  const recentes = db.prepare(`SELECT m.*, p.name AS product_name, p.sku FROM movements m JOIN products p ON p.id = m.product_id ORDER BY m.id DESC LIMIT 8`).all()
    .map((m) => ({ ...movimentoParaApi(m), productName: m.product_name, sku: m.sku }));
  return {
    products: t.produtos, units: t.unidades, costValueCents: t.custo, retailValueCents: t.venda,
    potentialProfitCents: t.venda - t.custo, outOfStock: t.zerados, lowStock: t.baixos,
    categories: categorias, movements: movimentos, attention: atencao, recent: recentes,
  };
}

const listaDeCategorias = (db) => db.prepare("SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category COLLATE NOCASE").all().map((r) => r.category);

/* ---------- CSV ---------- */
const COLUNAS = ["sku", "nome", "categoria", "descricao", "preco", "custo", "quantidade", "estoque_minimo"];
const reais = (c) => (c / 100).toFixed(2).replace(".", ",");

function exportarCsv(db) {
  const linhas = db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY sku").all();
  return gerarCsv([COLUNAS, ...linhas.map((r) => [r.sku, r.name, r.category, r.description, reais(r.price_cents), reais(r.cost_cents), r.quantity, r.min_quantity])]);
}

const ALIAS = { sku: ["sku", "codigo"], nome: ["nome", "name", "produto"], categoria: ["categoria", "category"], descricao: ["descricao", "description"], preco: ["preco", "price", "preco_venda"], custo: ["custo", "cost", "preco_custo"], quantidade: ["quantidade", "quantity", "estoque", "qtd"], estoque_minimo: ["estoque_minimo", "minimo", "min_quantity", "min"] };
const chaveDeColuna = (h) => { const n = semAcento(h).trim().replace(/[\s-]+/g, "_"); return Object.keys(ALIAS).find((k) => ALIAS[k].includes(n)); };

/** Importa produtos de um CSV (por SKU: cria ou atualiza). Tudo ou nada: com qualquer erro, nada é gravado. */
function importarCsv(db, bruto, { simular = false } = {}) {
  const linhas = lerCsv(bruto);
  if (linhas.length < 2) throw new HttpError(400, "O CSV precisa de um cabeçalho e ao menos uma linha de dados.");
  if (linhas.length > 5001) throw new HttpError(413, "Máximo de 5.000 linhas por importação.");
  const mapa = linhas[0].map(chaveDeColuna);
  for (const obrigatoria of ["sku", "nome"]) if (!mapa.includes(obrigatoria)) throw new HttpError(400, `Falta a coluna "${obrigatoria}" no cabeçalho.`);
  const erros = [], itens = [], vistos = new Set();
  linhas.slice(1).forEach((cels, i) => {
    const n = i + 2; // número da linha na planilha (1 = cabeçalho)
    const reg = {};
    mapa.forEach((k, j) => { if (k) reg[k] = (cels[j] ?? "").trim(); });
    try {
      const sku = v.sku(reg.sku);
      if (vistos.has(sku)) throw new HttpError(400, `SKU ${sku} repetido no arquivo.`);
      vistos.add(sku);
      const c = lerCampos({ name: reg.nome, description: reg.descricao, category: reg.categoria || undefined, price: reg.preco || "0", cost: reg.custo || "0", minQuantity: reg.estoque_minimo || "0" }, { parcial: false });
      const quantidade = reg.quantidade === undefined || reg.quantidade === "" ? null : v.inteiro(reg.quantidade, { campo: "quantidade", min: 0, max: 1_000_000 });
      itens.push({ sku, c, quantidade });
    } catch (e) { erros.push({ line: n, message: e.message }); }
  });
  if (erros.length) throw new HttpError(422, `${erros.length} ${erros.length === 1 ? "linha com problema" : "linhas com problemas"}: nada foi importado.`, erros);

  const aplicar = () => {
    let criados = 0, atualizados = 0;
    for (const { sku, c, quantidade } of itens) {
      const existente = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
      if (!existente) {
        const { lastInsertRowid } = db.prepare("INSERT INTO products (sku, name, description, category, price_cents, cost_cents, quantity, min_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(sku, c.name, c.description, c.category, c.price_cents, c.cost_cents, quantidade ?? 0, c.min_quantity);
        if (quantidade > 0) registrar(db, Number(lastInsertRowid), "entrada", quantidade, quantidade, "Importação CSV");
        criados++;
      } else {
        db.prepare("UPDATE products SET name = ?, description = ?, category = ?, price_cents = ?, cost_cents = ?, min_quantity = ?, active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
          .run(c.name, c.description, c.category, c.price_cents, c.cost_cents, c.min_quantity, existente.id);
        if (quantidade !== null && quantidade !== existente.quantity) {
          db.prepare("UPDATE products SET quantity = ? WHERE id = ?").run(quantidade, existente.id);
          registrar(db, existente.id, "ajuste", quantidade - existente.quantity, quantidade, "Importação CSV");
        }
        atualizados++;
      }
    }
    return { created: criados, updated: atualizados };
  };
  if (simular) {
    // roda tudo e desfaz: mostra exatamente o que aconteceria, sem gravar
    db.exec("BEGIN IMMEDIATE");
    try { const r = aplicar(); return { ...r, simulated: true }; } finally { db.exec("ROLLBACK"); }
  }
  return { ...transacao(db, aplicar), simulated: false };
}

module.exports = { listar, criar, atualizar, arquivar, buscar, paraApi, movimentar, historico, resumo, listaDeCategorias, exportarCsv, importarCsv, statusDe, TIPOS, STATUS };
