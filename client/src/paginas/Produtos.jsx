import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Carregando from "../componentes/Carregando";
import Estado from "../componentes/Estado";
import FormMovimento from "../componentes/FormMovimento";
import FormProduto from "../componentes/FormProduto";
import { IcBusca, IcVazio } from "../componentes/Icones";
import Paginacao from "../componentes/Paginacao";
import { api, query } from "../lib/api";
import { useAvisos } from "../lib/contextos";
import { inteiro, percentual, reais } from "../lib/formatos";

const FILTROS = [{ id: "", nome: "Todos" }, { id: "ok", nome: "Em dia" }, { id: "baixo", nome: "Baixo" }, { id: "zerado", nome: "Zerado" }, { id: "arquivado", nome: "Arquivados" }];
const COLUNAS = [{ id: "sku", nome: "SKU" }, { id: "name", nome: "Produto" }, { id: "price", nome: "Preço", dir: true }, { id: "quantity", nome: "Estoque", dir: true }];

export default function Produtos() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "", status = params.get("status") ?? "", categoria = params.get("category") ?? "";
  const sort = params.get("sort") ?? "name", order = params.get("order") ?? "asc", pagina = Number(params.get("page") ?? 1);
  const [busca, setBusca] = useState(q);
  const [dados, setDados] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(params.get("novo") ? { tipo: "produto" } : null);
  const avisar = useAvisos();
  const raiz = useRef(null);

  const mudar = useCallback((novo) => {
    setParams((atual) => {
      const p = new URLSearchParams(atual);
      for (const [k, v] of Object.entries(novo)) { if (v === "" || v === null || v === undefined) p.delete(k); else p.set(k, v); }
      if (!("page" in novo)) p.delete("page"); // qualquer filtro novo volta para a página 1
      p.delete("novo");
      return p;
    }, { replace: true });
  }, [setParams]);

  // a busca espera a pessoa parar de digitar
  useEffect(() => { const id = setTimeout(() => { if (busca !== q) mudar({ q: busca }); }, 280); return () => clearTimeout(id); }, [busca, q, mudar]);

  const carregar = useCallback(() => {
    setErro("");
    api(`/products${query({ q, status, category: categoria, sort, order, page: pagina, pageSize: 12 })}`).then(setDados).catch((e) => setErro(e.message));
  }, [q, status, categoria, sort, order, pagina]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { api("/categories").then(setCategorias).catch(() => {}); }, [dados?.total]);

  const ordenar = (id) => mudar({ sort: id, order: sort === id && order === "asc" ? "desc" : "asc" });
  const arquivar = async (p) => {
    if (!confirm(`Arquivar “${p.name}”? Ele sai da lista, mas o histórico fica guardado e dá para restaurar.`)) return;
    try { await api(`/products/${p.id}`, { method: "DELETE" }); avisar(`${p.name} arquivado.`); carregar(); } catch (e) { avisar(e.message, "erro"); }
  };
  const restaurar = async (p) => {
    try { await api(`/products/${p.id}`, { method: "PATCH", corpo: { active: true } }); avisar(`${p.name} restaurado.`); carregar(); } catch (e) { avisar(e.message, "erro"); }
  };
  const salvou = () => { setForm(null); carregar(); };
  const filtrado = q || status || categoria;

  return (
    <main className="pagina" ref={raiz}>
      <header className="cabeca"><div><h1 className="titulo">Produtos</h1><p className="subtitulo">{dados ? `${inteiro(dados.total)} ${dados.total === 1 ? "produto" : "produtos"}${q || status || categoria ? " com os filtros aplicados" : " cadastrados"}` : "Carregando…"}</p></div><button className="btn" onClick={() => setForm({ tipo: "produto" })}>+ Novo produto</button></header>

      <div className="barra-filtros">
        <label className="busca"><span className="sr">Buscar</span><IcBusca /><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, SKU ou categoria…" /></label>
        <label><span className="sr">Categoria</span><select value={categoria} onChange={(e) => mudar({ category: e.target.value })}><option value="">Todas as categorias</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
        <div className="chips" role="group" aria-label="Situação do estoque">{FILTROS.map((f) => <button key={f.id} className="chip" aria-pressed={status === f.id} onClick={() => mudar({ status: f.id })}>{f.nome}</button>)}</div>
      </div>

      {erro && <p className="erro" role="alert">{erro} <button className="link" onClick={carregar}>Tentar de novo</button></p>}
      {!dados && !erro && <Carregando />}
      {dados && dados.items.length === 0 && (
        <div className="vazio"><IcVazio className="ic-vazio" /><h2>{filtrado ? "Nada com esses filtros" : "Nenhum produto ainda"}</h2><p>{filtrado ? "Tente outra busca ou limpe os filtros." : "Cadastre o primeiro produto ou importe uma planilha."}</p>{filtrado ? <button className="btn vazado" onClick={() => { setBusca(""); setParams({}); }}>Limpar filtros</button> : <button className="btn" onClick={() => setForm({ tipo: "produto" })}>Cadastrar produto</button>}</div>
      )}
      {dados && dados.items.length > 0 && (
        <>
          <div className="tabela-rolar">
            <table className="tabela">
              <thead>
                <tr>
                  {COLUNAS.map((c) => <th key={c.id} className={c.dir ? "dir" : ""} aria-sort={sort === c.id ? (order === "asc" ? "ascending" : "descending") : "none"}><button onClick={() => ordenar(c.id)}>{c.nome}{sort === c.id ? (order === "asc" ? " ▲" : " ▼") : ""}</button></th>)}
                  <th>Situação</th><th>Margem</th><th className="dir">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.items.map((p) => (
                  <tr key={p.id} className={`linha-${p.status}`}>
                    <td className="mono">{p.sku}</td>
                    <td><Link to={`/produtos/${p.id}`}><strong>{p.name}</strong></Link><small>{p.category}</small></td>
                    <td className="dir mono">{reais(p.priceCents)}</td>
                    <td className="dir"><b className="mono">{inteiro(p.quantity)}</b><small>mín. {p.minQuantity}</small><i className={`medidor medidor-${p.status}`} style={{ "--p": `${p.minQuantity > 0 ? Math.min(100, Math.round((p.quantity / (p.minQuantity * 2)) * 100)) : p.quantity > 0 ? 100 : 0}%` }} aria-hidden="true" /></td>
                    <td><Estado status={p.status} /></td>
                    <td className="mono">{percentual(p.marginPercent)}</td>
                    <td className="dir acoes-tabela">
                      {p.active ? (
                        <>
                          <button className="btn pequeno" onClick={() => setForm({ tipo: "mov", produto: p, mov: "entrada" })} aria-label={`Entrada de ${p.name}`}>+ Entrada</button>
                          <button className="btn pequeno vazado" onClick={() => setForm({ tipo: "mov", produto: p, mov: "saida" })} aria-label={`Saída de ${p.name}`} disabled={p.quantity === 0}>− Saída</button>
                          <button className="link" onClick={() => setForm({ tipo: "produto", produto: p })}>Editar</button>
                          <button className="link perigo" onClick={() => arquivar(p)}>Arquivar</button>
                        </>
                      ) : <button className="btn pequeno" onClick={() => restaurar(p)}>Restaurar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={dados.page} paginas={dados.pages} total={dados.total} tamanho={dados.pageSize} aoMudar={(n) => mudar({ page: n })} />
        </>
      )}

      {form?.tipo === "produto" && <FormProduto produto={form.produto} aoFechar={() => setForm(null)} aoSalvar={salvou} />}
      {form?.tipo === "mov" && <FormMovimento produto={form.produto} tipoInicial={form.mov} aoFechar={() => setForm(null)} aoSalvar={salvou} />}
    </main>
  );
}
