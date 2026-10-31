// "Servidor" do demo: roda no navegador as mesmas regras da API (src/estoque.js) sobre um SQLite em memória.
// As rotas espelham src/app.js; o banco nasce com os dados de demonstração a cada visita.
import initSqlJs from "sql.js";
import wasm from "sql.js/dist/sql-wasm.wasm?url";
import { HttpError } from "../../../src/errors.js";
import * as e from "../../../src/estoque.js";
import * as v from "../../../src/validar.js";
import { abrirBanco } from "./db-navegador.cjs";
import { semear } from "../../../scripts/dados-demo.js";

let pronto;
function iniciar() {
  pronto ??= initSqlJs({ locateFile: () => wasm }).then((SQL) => {
    globalThis.__SQLJS__ = SQL;
    const db = abrirBanco();
    semear(db);
    return db;
  });
  return pronto;
}

const ID = /^\/products\/([^/]+)$/;
const MOVS = /^\/products\/([^/]+)\/movements$/;

export async function chamar(caminho, { method = "GET", corpo, texto } = {}) {
  const db = await iniciar();
  const [rota, qs = ""] = caminho.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  try {
    if (method === "GET" && rota === "/summary") return e.resumo(db);
    if (method === "GET" && rota === "/categories") return e.listaDeCategorias(db);
    if (rota === "/products" && method === "GET") return e.listar(db, query);
    if (rota === "/products" && method === "POST") return e.criar(db, corpo);
    if (rota === "/export.csv" && method === "GET") return e.exportarCsv(db);
    if (rota === "/import" && method === "POST") {
      if (typeof texto !== "string" || !texto.trim()) throw new HttpError(400, "Envie o conteúdo do CSV no corpo da requisição.");
      return e.importarCsv(db, texto, { simular: query.simular === "1" });
    }
    let m = rota.match(MOVS);
    if (m) {
      const id = v.idDaRota(m[1]);
      if (method === "GET") return e.historico(db, id);
      if (method === "POST") return e.movimentar(db, id, corpo);
    }
    m = rota.match(ID);
    if (m) {
      const id = v.idDaRota(m[1]);
      if (method === "GET") return e.paraApi(e.buscar(db, id));
      if (method === "PUT" || method === "PATCH") return e.atualizar(db, id, corpo);
      if (method === "DELETE") { e.arquivar(db, id); return null; }
    }
    throw new HttpError(404, "Rota não encontrada.");
  } catch (erro) {
    if (erro instanceof HttpError) { const { ErroApi } = await import("../lib/api.js"); throw new ErroApi(erro.status, erro.message, erro.detalhes); }
    throw erro;
  }
}
