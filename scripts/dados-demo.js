// Dados de DEMONSTRAÇÃO: uma papelaria fictícia, com histórico de movimentações nos últimos 20 dias,
// para o painel e os gráficos não abrirem vazios. Usado pelo script de seed e pelo demo no navegador.
const { transacao } = require("../src/db");

const PRODUTOS = [
  // [sku, nome, categoria, descrição, preço, custo, estoque atual, mínimo]
  ["ESC-001", "Caneta esferográfica azul", "Escrita", "Ponta fina 0,7 mm, tinta azul, corpo transparente", 2.5, 0.9, 180, 60],
  ["ESC-002", "Caneta esferográfica preta", "Escrita", "Ponta fina 0,7 mm, tinta preta", 2.5, 0.9, 140, 60],
  ["ESC-003", "Caneta gel retrátil", "Escrita", "Tinta gel 0,5 mm, sete cores", 6.9, 2.8, 48, 30],
  ["ESC-004", "Lápis preto HB", "Escrita", "Madeira reflorestada, caixa com 12", 14.9, 6.2, 36, 20],
  ["ESC-005", "Lapiseira 0,7 mm", "Escrita", "Corpo de metal, grafite incluso", 12.5, 5.1, 9, 12],
  ["ESC-006", "Marca-texto amarelo", "Escrita", "Ponta chanfrada, tinta fluorescente", 4.9, 1.9, 0, 24],
  ["ESC-007", "Borracha branca macia", "Escrita", "Não mancha, não esfarela", 1.9, 0.6, 95, 40],
  ["PAP-001", "Caderno universitário 96 folhas", "Papelaria", "Capa dura, espiral, 10 matérias", 24.9, 12.4, 42, 25],
  ["PAP-002", "Caderno brochura 48 folhas", "Papelaria", "Capa flexível, pauta simples", 9.9, 4.3, 70, 30],
  ["PAP-003", "Bloco de notas adesivas", "Papelaria", "76 x 76 mm, 100 folhas, amarelo", 7.5, 3.1, 8, 20],
  ["PAP-004", "Papel sulfite A4 (resma 500)", "Papelaria", "75 g/m², branco, certificado FSC", 29.9, 21.5, 64, 40],
  ["PAP-005", "Papel kraft (rolo 5 m)", "Papelaria", "Pardo, 60 g/m², largura 60 cm", 18.9, 9.8, 15, 10],
  ["PAP-006", "Etiqueta adesiva branca (cartela)", "Papelaria", "Cartela com 12, 38 x 21 mm", 5.5, 2.2, 0, 15],
  ["ESR-001", "Grampeador de mesa", "Escritório", "Capacidade para 25 folhas, base antiderrapante", 32.9, 16.7, 14, 8],
  ["ESR-002", "Grampos 26/6 (caixa 5000)", "Escritório", "Aço galvanizado", 8.9, 3.6, 55, 20],
  ["ESR-003", "Clipes niquelados nº 2 (caixa 100)", "Escritório", "Niquelados, anti-ferrugem", 3.9, 1.4, 120, 40],
  ["ESR-004", "Pasta suspensa com grampo", "Escritório", "Kraft, pacote com 10", 27.5, 14.2, 6, 10],
  ["ESR-005", "Fita adesiva transparente 45 mm", "Escritório", "Rolo de 45 metros", 6.5, 2.7, 33, 24],
  ["ESR-006", "Tesoura escolar sem ponta", "Escritório", "Lâmina de aço inox, 13 cm", 11.9, 5.4, 22, 12],
  ["ART-001", "Lápis de cor (caixa 24 cores)", "Arte", "Mina macia, cores vibrantes", 29.9, 14.9, 31, 15],
  ["ART-002", "Tinta guache (kit 6 cores)", "Arte", "Potes de 15 ml, lavável", 17.5, 8.1, 4, 10],
  ["ART-003", "Pincel chato nº 12", "Arte", "Cerdas sintéticas, cabo de madeira", 9.5, 3.9, 25, 10],
  ["ART-004", "Bloco de desenho A3 (50 folhas)", "Arte", "Papel 140 g/m², gramatura alta", 38.9, 22.6, 12, 6],
  ["ART-005", "Cola branca 90 g", "Arte", "Não tóxica, lavável", 4.5, 1.7, 88, 30],
  ["INF-001", "Pen drive 32 GB", "Informática", "USB 3.0, corpo de metal", 42.9, 26.8, 11, 8],
  ["INF-002", "Mouse óptico com fio", "Informática", "USB, 1200 dpi, 1,5 m de cabo", 29.9, 16.4, 3, 6],
  ["INF-003", "Mousepad 22 x 18 cm", "Informática", "Base de borracha antiderrapante", 14.9, 6.3, 40, 12],
];

// gerador pseudoaleatório com semente: o histórico demo é sempre o mesmo
function semente(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function semear(db, hoje = new Date()) {
  const r = semente(2024);
  const iso = (diasAtras, hora) => { const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - diasAtras, hora, Math.floor(r() * 60))); return d.toISOString().replace(/\.\d+Z$/, ".000Z"); };
  transacao(db, () => {
    const novo = db.prepare("INSERT INTO products (sku, name, category, description, price_cents, cost_cents, quantity, min_quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const mov = db.prepare("INSERT INTO movements (product_id, type, delta, balance, note, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const [sku, nome, cat, desc, preco, custo, atual, minimo] of PRODUTOS) {
      // A história é gerada DE TRÁS PARA FRENTE, a partir do estoque de hoje: desfazer uma venda soma unidades e desfazer uma
      // reposição subtrai (só quando sobra saldo). Assim o saldo nunca fica negativo e o último saldo é exatamente o estoque atual.
      const dias = [];
      let saldo = atual;
      for (let dia = 0; dia < 19; dia++) {
        const ev = [];
        let antes = saldo;
        if (r() < 0.55) { const q = 1 + Math.floor(r() * Math.max(2, minimo * 0.35)); ev.push({ tipo: "saida", delta: -q, nota: ["Venda no balcão", "Venda online", "Venda para escola"][Math.floor(r() * 3)], hora: 15 }); antes += q; }
        if (r() < 0.12) { const q = Math.max(5, Math.round(minimo * (1 + r()))); if (antes >= q) { ev.unshift({ tipo: "entrada", delta: q, nota: "Reposição do fornecedor", hora: 9 }); antes -= q; } }
        // `antes` é o saldo no começo deste dia; ev está em ordem cronológica (entrada de manhã, venda à tarde)
        let corrente = antes;
        dias.push({ dia, eventos: ev.map((e) => ({ ...e, saldo: (corrente += e.delta) })) });
        saldo = antes;
      }
      const criado = iso(19, 9);
      const { lastInsertRowid } = novo.run(sku, nome, cat, desc, Math.round(preco * 100), Math.round(custo * 100), atual, minimo, criado, iso(0, 10));
      const id = Number(lastInsertRowid);
      if (saldo > 0) mov.run(id, "entrada", saldo, saldo, "Estoque inicial", criado);
      for (const d of dias.reverse()) for (const e of d.eventos) mov.run(id, e.tipo, e.delta, e.saldo, e.nota, iso(d.dia, e.hora));
    }
  });
  return PRODUTOS.length;
}

module.exports = { semear, PRODUTOS };
