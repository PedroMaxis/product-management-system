import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../lib/api";
import { centavosDeTexto, textoDeCentavos } from "../lib/formatos";
import { useAvisos } from "../lib/contextos";

const VAZIO = { sku: "", name: "", category: "", description: "", price: "", cost: "", minQuantity: "0", quantity: "0" };

/** Cria ou edita um produto. A quantidade só entra na criação: depois, o estoque muda por movimentação. */
export default function FormProduto({ produto, aoSalvar, aoFechar }) {
  const editando = !!produto;
  const avisar = useAvisos();
  const [c, setC] = useState(editando ? { sku: produto.sku, name: produto.name, category: produto.category, description: produto.description, price: textoDeCentavos(produto.priceCents), cost: textoDeCentavos(produto.costCents), minQuantity: String(produto.minQuantity), quantity: "0" } : VAZIO);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { api("/categories").then(setCategorias).catch(() => {}); }, []);
  const muda = (k) => (e) => setC((x) => ({ ...x, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const preco = centavosDeTexto(c.price || "0"), custo = centavosDeTexto(c.cost || "0");
    if (preco === null) return setErro("O preço deve ser um valor em reais, como 12,90.");
    if (custo === null) return setErro("O custo deve ser um valor em reais, como 7,50.");
    setErro(""); setEnviando(true);
    const corpo = { name: c.name, category: c.category || "Geral", description: c.description, priceCents: preco, costCents: custo, minQuantity: Number(c.minQuantity || 0), ...(c.sku.trim() ? { sku: c.sku } : {}), ...(editando ? {} : { quantity: Number(c.quantity || 0) }) };
    try {
      const salvo = editando ? await api(`/products/${produto.id}`, { method: "PUT", corpo }) : await api("/products", { method: "POST", corpo });
      avisar(editando ? `${salvo.name} atualizado.` : `${salvo.name} cadastrado (${salvo.sku}).`);
      aoSalvar(salvo);
    } catch (err) { setErro(err.message); } finally { setEnviando(false); }
  };

  const margem = (() => { const p = centavosDeTexto(c.price || ""), k = centavosDeTexto(c.cost || ""); return p && k !== null && p > 0 && k > 0 ? Math.round(((p - k) / p) * 1000) / 10 : null; })();

  return (
    <Modal titulo={editando ? `Editar ${produto.sku}` : "Novo produto"} aoFechar={aoFechar}>
      <form className="form" onSubmit={enviar} noValidate>
        <div className="grade-form">
          <label className="c4">Nome<input value={c.name} onChange={muda("name")} required autoFocus /></label>
          <label className="c2">SKU<input value={c.sku} onChange={muda("sku")} placeholder={editando ? "" : "automático"} /></label>
          <label className="c3">Categoria<input value={c.category} onChange={muda("category")} list="categorias" placeholder="Geral" /></label>
          <datalist id="categorias">{categorias.map((x) => <option key={x} value={x} />)}</datalist>
          <label className="c3">Estoque mínimo<input inputMode="numeric" value={c.minQuantity} onChange={muda("minQuantity")} /><small>Abaixo disso, o produto aparece como “baixo”.</small></label>
          <label className="c6">Descrição<textarea value={c.description} onChange={muda("description")} rows={2} /></label>
          <label className="c2">Preço de venda (R$)<input inputMode="decimal" value={c.price} onChange={muda("price")} placeholder="0,00" /></label>
          <label className="c2">Custo (R$)<input inputMode="decimal" value={c.cost} onChange={muda("cost")} placeholder="0,00" /><small>{margem !== null ? `Margem de ${String(margem).replace(".", ",")}%` : " "}</small></label>
          {!editando && <label className="c2">Estoque inicial<input inputMode="numeric" value={c.quantity} onChange={muda("quantity")} /></label>}
        </div>
        {editando && <p className="nota">Para mudar a quantidade em estoque, registre uma movimentação: assim o histórico fica certo.</p>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes-form"><button type="button" className="btn vazado" onClick={aoFechar}>Cancelar</button><button className="btn" disabled={enviando}>{enviando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar"}</button></div>
      </form>
    </Modal>
  );
}
