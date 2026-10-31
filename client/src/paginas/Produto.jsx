import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Carregando from "../componentes/Carregando";
import Estado from "../componentes/Estado";
import FormMovimento from "../componentes/FormMovimento";
import FormProduto from "../componentes/FormProduto";
import Numero from "../componentes/Numero";
import { api } from "../lib/api";
import { useAvisos } from "../lib/contextos";
import { dataHora, inteiro, percentual, reais, ROTULO_TIPO, serieDeSaldo } from "../lib/formatos";

/** Saldo ao longo do tempo: degraus, porque o estoque só muda quando há movimentação */
function GraficoSaldo({ historico, minimo }) {
  const pontos = serieDeSaldo(historico);
  if (pontos.length < 2) return <p className="mono">O gráfico aparece a partir da segunda movimentação.</p>;
  const L = 560, A = 150, pad = 8;
  const maior = Math.max(1, minimo, ...pontos.map((p) => p.y));
  const t0 = new Date(pontos[0].x).getTime(), t1 = new Date(pontos.at(-1).x).getTime() || t0 + 1;
  const px = (x) => pad + ((new Date(x).getTime() - t0) / Math.max(1, t1 - t0)) * (L - pad * 2);
  const py = (y) => A - pad - (y / maior) * (A - pad * 2);
  let d = `M${px(pontos[0].x)} ${py(pontos[0].y)}`;
  for (let i = 1; i < pontos.length; i++) d += ` H${px(pontos[i].x)} V${py(pontos[i].y)}`;
  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Saldo de estoque ao longo do tempo">
        {minimo > 0 && <><line x1="0" x2={L} y1={py(minimo)} y2={py(minimo)} className="linha-minimo" /><text x={L - 4} y={py(minimo) - 5} textAnchor="end" className="eixo">mínimo {minimo}</text></>}
        <path d={`${d} V${A - pad} H${px(pontos[0].x)} Z`} className="area-saldo" />
        <path d={d} className="linha-saldo" />
        {pontos.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" className="ponto-saldo" />)}
      </svg>
      <figcaption>saldo após cada movimentação</figcaption>
    </figure>
  );
}

export default function Produto() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [hist, setHist] = useState([]);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(null);
  const avisar = useAvisos();
  const ir = useNavigate();
  const raiz = useRef(null);

  const carregar = useCallback(() => Promise.all([api(`/products/${id}`), api(`/products/${id}/movements`)]).then(([prod, h]) => { setP(prod); setHist(h); }).catch((e) => setErro(e.status === 404 ? "Produto não encontrado." : e.message)), [id]);
  useEffect(() => { setP(null); setErro(""); carregar(); }, [carregar]);


  if (erro) return <main className="pagina"><div className="vazio"><h2>{erro}</h2><Link className="btn" to="/produtos">Voltar aos produtos</Link></div></main>;
  if (!p) return <Carregando />;

  const alternarArquivo = async () => {
    try {
      if (p.active) { if (!confirm(`Arquivar “${p.name}”?`)) return; await api(`/products/${p.id}`, { method: "DELETE" }); avisar("Produto arquivado."); }
      else { await api(`/products/${p.id}`, { method: "PATCH", corpo: { active: true } }); avisar("Produto restaurado."); }
      carregar();
    } catch (e) { avisar(e.message, "erro"); }
  };
  const salvou = () => { setForm(null); carregar(); };

  return (
    <main className="pagina" ref={raiz}>
      <button className="link voltar" onClick={() => ir(-1)}>← Voltar</button>
      <header className="cabeca">
        <div><span className="mono sku-grande">{p.sku} · {p.category}</span><h1 className="titulo">{p.name}</h1>{p.description && <p className="descricao">{p.description}</p>}</div>
        <div className="acoes-linha"><Estado status={p.status} />{p.active && <button className="btn vazado" onClick={() => setForm({ tipo: "produto" })}>Editar</button>}<button className="btn vazado" onClick={alternarArquivo}>{p.active ? "Arquivar" : "Restaurar"}</button></div>
      </header>

      <div className="etiquetas">
        <div className="etiqueta destaque"><span className="rotulo">Em estoque</span><Numero valor={p.quantity} className="valor" formatar={inteiro} /><small>mínimo {p.minQuantity}</small></div>
        <div className="etiqueta"><span className="rotulo">Preço de venda</span><span className="valor">{reais(p.priceCents)}</span></div>
        <div className="etiqueta"><span className="rotulo">Custo</span><span className="valor">{reais(p.costCents)}</span><small>margem {percentual(p.marginPercent)}</small></div>
        <div className="etiqueta"><span className="rotulo">Valor parado</span><span className="valor">{reais(p.stockValueCents)}</span><small>quantidade × custo</small></div>
      </div>

      <div className="duas-col">
        <section className="bloco"><h2>Saldo no tempo</h2><GraficoSaldo historico={hist} minimo={p.minQuantity} /></section>
        <section className="bloco acao-rapida">
          <h2>Movimentar</h2>
          {p.active ? (
            <div className="acoes-linha">
              <button className="btn" onClick={() => setForm({ tipo: "mov", mov: "entrada" })}>+ Entrada</button>
              <button className="btn vazado" onClick={() => setForm({ tipo: "mov", mov: "saida" })} disabled={p.quantity === 0}>− Saída</button>
              <button className="btn vazado" onClick={() => setForm({ tipo: "mov", mov: "ajuste" })}>Ajustar contagem</button>
            </div>
          ) : <p className="mono">Restaure o produto para movimentar o estoque.</p>}
          <p className="nota">Toda mudança de quantidade vira uma linha no histórico, com o saldo depois dela.</p>
        </section>
      </div>

      <section className="bloco">
        <h2>Histórico de movimentações</h2>
        <div className="tabela-rolar"><table className="tabela">
          <thead><tr><th>Quando</th><th>Tipo</th><th className="dir">Variação</th><th className="dir">Saldo</th><th>Observação</th></tr></thead>
          <tbody>{hist.map((m) => (
            <tr key={m.id}><td className="mono">{dataHora(m.createdAt)}</td><td><span className={`mov mov-${m.type}`}>{ROTULO_TIPO[m.type]}</span></td><td className={`dir mono ${m.delta > 0 ? "mais" : "menos"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</td><td className="dir mono">{m.balance}</td><td>{m.note || <span className="mudo">—</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </section>

      {form?.tipo === "produto" && <FormProduto produto={p} aoFechar={() => setForm(null)} aoSalvar={salvou} />}
      {form?.tipo === "mov" && <FormMovimento produto={p} tipoInicial={form.mov} aoFechar={() => setForm(null)} aoSalvar={salvou} />}
    </main>
  );
}
