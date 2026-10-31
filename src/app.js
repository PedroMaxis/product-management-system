const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("node:path");
const fs = require("node:fs");
const { HttpError } = require("./errors");
const e = require("./estoque");
const v = require("./validar");

/** Monta a aplicação a partir das dependências (banco e config), o que permite testar sem subir servidor */
function criarApp({ db, config = {} }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.origens?.length ? config.origens : true }));
  app.use(express.json({ limit: "50kb" }));

  const api = express.Router();
  api.get("/health", (_req, res) => res.json({ ok: true }));

  api.get("/summary", (_req, res) => res.json(e.resumo(db)));
  api.get("/categories", (_req, res) => res.json(e.listaDeCategorias(db)));

  api.get("/products", (req, res) => res.json(e.listar(db, req.query)));
  api.post("/products", (req, res) => res.status(201).json(e.criar(db, req.body)));
  api.get("/products/:id", (req, res) => res.json(e.paraApi(e.buscar(db, v.idDaRota(req.params.id)))));
  api.put("/products/:id", (req, res) => res.json(e.atualizar(db, v.idDaRota(req.params.id), req.body)));
  api.patch("/products/:id", (req, res) => res.json(e.atualizar(db, v.idDaRota(req.params.id), req.body)));
  // "excluir" arquiva: o histórico de movimentações continua íntegro e dá para restaurar com PATCH { active: true }
  api.delete("/products/:id", (req, res) => { e.arquivar(db, v.idDaRota(req.params.id)); res.status(204).end(); });

  api.get("/products/:id/movements", (req, res) => res.json(e.historico(db, v.idDaRota(req.params.id))));
  api.post("/products/:id/movements", (req, res) => res.status(201).json(e.movimentar(db, v.idDaRota(req.params.id), req.body)));

  api.get("/export.csv", (_req, res) => {
    res.type("text/csv; charset=utf-8").set("Content-Disposition", 'attachment; filename="estoque.csv"').send(e.exportarCsv(db));
  });
  api.post("/import", express.text({ type: "*/*", limit: "2mb" }), (req, res) => {
    if (typeof req.body !== "string" || !req.body.trim()) throw new HttpError(400, "Envie o conteúdo do CSV no corpo da requisição.");
    res.json(e.importarCsv(db, req.body, { simular: req.query.simular === "1" }));
  });

  app.use("/api", api);
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Rota não encontrada.")));

  // em produção o mesmo servidor entrega o front já compilado
  const dist = path.join(__dirname, "..", "client", "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // express 4 não captura erros assíncronos, mas aqui tudo é síncrono (node:sqlite), então o handler padrão basta
  // eslint-disable-next-line no-unused-vars
  app.use((erro, _req, res, _next) => {
    if (erro instanceof HttpError) return res.status(erro.status).json({ error: erro.message, ...(erro.detalhes ? { details: erro.detalhes } : {}) });
    if (erro.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
    if (erro.type === "entity.too.large") return res.status(413).json({ error: "Requisição grande demais." });
    console.error(erro);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  });
  return app;
}

module.exports = { criarApp };
