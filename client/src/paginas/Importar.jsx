import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAvisos } from "../lib/contextos";

export default function Importar() {
  const [arquivo, setArquivo] = useState(null);
  const [texto, setTexto] = useState("");
  const [sim, setSim] = useState(null);
  const [erro, setErro] = useState(null);
  const [feito, setFeito] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const avisar = useAvisos();
  const raiz = useRef(null);


  // no demo não há servidor para entregar o arquivo: gera o CSV no navegador e baixa
  const baixar = async () => {
    const csv = await api("/export.csv");
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: "estoque.csv" });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const escolher = async (e) => {
    const f = e.target.files?.[0];
    setSim(null); setErro(null); setFeito(null);
    if (!f) return;
    setArquivo(f); setTexto(await f.text());
  };
  const rodar = async (simular) => {
    setOcupado(true); setErro(null);
    try {
      const r = await api(`/import${simular ? "?simular=1" : ""}`, { method: "POST", texto });
      if (simular) setSim(r); else { setFeito(r); setSim(null); avisar(`Importação concluída: ${r.created} criados, ${r.updated} atualizados.`); }
    } catch (e) {
      setErro(e);
    } finally { setOcupado(false); }
  };

  return (
    <main className="pagina" ref={raiz}>
      <header className="cabeca"><div><h1 className="titulo">Importar e exportar</h1><p className="subtitulo">Leve o estoque para uma planilha e traga de volta. Produtos são identificados pelo SKU: se existir, é atualizado; se não, é criado.</p></div></header>

      <div className="duas-col">
        <section className="bloco">
          <h2>1. Exportar</h2>
          <p>Baixe o estoque atual em CSV (abre direto no Excel, com acentos e vírgula decimal). Use o arquivo como modelo.</p>
          {import.meta.env.VITE_DEMO
            ? <button className="btn" onClick={baixar}>Baixar estoque.csv</button>
            : <a className="btn" href="/api/export.csv" download>Baixar estoque.csv</a>}
          <p className="nota">Colunas: sku; nome; categoria; descricao; preco; custo; quantidade; estoque_minimo. Só <b>sku</b> e <b>nome</b> são obrigatórias.</p>
        </section>

        <section className="bloco passo-2">
          <h2>2. Importar</h2>
          <label className="arquivo"><span>{arquivo ? arquivo.name : "Escolher arquivo CSV"}</span><input type="file" accept=".csv,text/csv,text/plain" onChange={escolher} /></label>
          {texto && (
            <div className="acoes-linha">
              <button className="btn vazado" onClick={() => rodar(true)} disabled={ocupado}>Simular (não grava)</button>
              <button className="btn" onClick={() => rodar(false)} disabled={ocupado || !sim}>Importar de verdade</button>
            </div>
          )}
          {texto && !sim && !erro && !feito && <p className="nota">Simule primeiro: você vê o que vai acontecer antes de gravar.</p>}
          {sim && <p className="ok-msg" role="status">Simulação ok: <b>{sim.created}</b> produto(s) novo(s) e <b>{sim.updated}</b> atualizado(s). Nada foi gravado ainda.</p>}
          {feito && <p className="ok-msg" role="status">Pronto! {feito.created} criado(s), {feito.updated} atualizado(s). <Link to="/produtos">Ver produtos →</Link></p>}
          {erro && (
            <div className="erro" role="alert">
              <strong>{erro.message}</strong>
              {erro.detalhes && <ul>{erro.detalhes.slice(0, 30).map((d) => <li key={d.line}>Linha {d.line}: {d.message}</li>)}{erro.detalhes.length > 30 && <li>…e mais {erro.detalhes.length - 30}.</li>}</ul>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
