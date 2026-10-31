import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Carregando from "../componentes/Carregando";
import Estado from "../componentes/Estado";
import FormMovimento from "../componentes/FormMovimento";
import Grafico from "../componentes/Grafico";
import Numero from "../componentes/Numero";
import { api } from "../lib/api";
import { dataHora, inteiro, reais, ROTULO_TIPO } from "../lib/formatos";

export default function Painel() {
  const [r, setR] = useState(null);
  const [erro, setErro] = useState("");
  const [repor, setRepor] = useState(null);
  const raiz = useRef(null);
  const carregar = useCallback(() => api("/summary").then(setR).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);


  if (erro) return <main className="pagina"><p className="erro">{erro}</p></main>;
  if (!r) return <Carregando texto="Contando o estoque…" />;
  if (r.products === 0) return (
    <main className="pagina" ref={raiz}>
      <h1 className="titulo">Painel</h1>
      <div className="vazio"><h2>O almoxarifado está vazio</h2><p>Cadastre o primeiro produto ou importe uma planilha CSV.</p><div className="acoes-linha"><Link className="btn" to="/produtos?novo=1">Cadastrar produto</Link><Link className="btn vazado" to="/importar">Importar CSV</Link></div></div>
    </main>
  );

  const alertas = r.outOfStock + r.lowStock;
  return (
    <main className="pagina" ref={raiz}>
      <h1 className="titulo">Painel</h1>
      <div className="etiquetas">
        <div className="etiqueta"><span className="rotulo">Produtos ativos</span><Numero valor={r.products} className="valor" formatar={inteiro} /></div>
        <div className="etiqueta"><span className="rotulo">Unidades em estoque</span><Numero valor={r.units} className="valor" formatar={inteiro} /></div>
        <div className="etiqueta"><span className="rotulo">Valor em estoque (custo)</span><Numero valor={r.costValueCents} className="valor" formatar={reais} /></div>
        <div className="etiqueta destaque"><span className="rotulo">Lucro potencial</span><Numero valor={r.potentialProfitCents} className="valor" formatar={reais} /><small>se tudo for vendido ao preço de tabela</small></div>
      </div>

      {alertas > 0 && (
        <Link to="/produtos?status=zerado" className="alerta-faixa">
          <strong>{r.outOfStock > 0 && `${r.outOfStock} ${r.outOfStock === 1 ? "produto zerado" : "produtos zerados"}`}{r.outOfStock > 0 && r.lowStock > 0 && " · "}{r.lowStock > 0 && `${r.lowStock} abaixo do mínimo`}</strong>
          <span>Ver e repor →</span>
        </Link>
      )}

      <div className="duas-col">
        <section className="bloco"><h2>Movimento dos últimos 14 dias</h2><Grafico dados={r.movements} /></section>
        <section className="bloco">
          <h2>Valor por categoria</h2>
          <ul className="categorias">
            {r.categories.map((c) => { const max = Math.max(1, ...r.categories.map((x) => x.valueCents)); return (
              <li key={c.category}><span>{c.category}<small>{c.products} {c.products === 1 ? "produto" : "produtos"} · {inteiro(c.units)} un</small></span><i style={{ "--p": `${(c.valueCents / max) * 100}%` }} /><b>{reais(c.valueCents)}</b></li>
            ); })}
          </ul>
        </section>
      </div>

      <div className="duas-col">
        <section className="bloco">
          <h2>Precisam de atenção</h2>
          {r.attention.length === 0 ? <p className="mono">Tudo acima do mínimo.</p> : (
            <ul className="lista">
              {r.attention.map((p) => (
                <li key={p.id}>
                  <div><Link to={`/produtos/${p.id}`}><strong>{p.name}</strong></Link><small>{p.sku} · mínimo {p.minQuantity}</small></div>
                  <Estado status={p.status} /><b className="mono">{p.quantity}</b>
                  <button className="btn pequeno" onClick={() => setRepor(p)}>Repor</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="bloco">
          <h2>Últimas movimentações</h2>
          <ul className="lista">
            {r.recent.map((m) => (
              <li key={m.id}>
                <div><Link to={`/produtos/${m.productId}`}><strong>{m.productName}</strong></Link><small>{dataHora(m.createdAt)}{m.note ? ` · ${m.note}` : ""}</small></div>
                <span className={`mov mov-${m.type}`}>{ROTULO_TIPO[m.type]}</span>
                <b className={`mono ${m.delta > 0 ? "mais" : "menos"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {repor && <FormMovimento produto={repor} tipoInicial="entrada" aoFechar={() => setRepor(null)} aoSalvar={() => { setRepor(null); carregar(); }} />}
    </main>
  );
}
