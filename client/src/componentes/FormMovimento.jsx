import { useState } from "react";
import Modal from "./Modal";
import { api } from "../lib/api";
import { useAvisos } from "../lib/contextos";

const TIPOS = [{ id: "entrada", nome: "Entrada", dica: "Compra ou reposição" }, { id: "saida", nome: "Saída", dica: "Venda, perda ou consumo" }, { id: "ajuste", nome: "Ajuste", dica: "Contagem de inventário" }];

export default function FormMovimento({ produto, tipoInicial = "entrada", aoSalvar, aoFechar }) {
  const avisar = useAvisos();
  const [tipo, setTipo] = useState(tipoInicial);
  const [qtd, setQtd] = useState(tipoInicial === "ajuste" ? String(produto.quantity) : "");
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const n = Number(qtd);
  const valido = Number.isInteger(n) && qtd !== "" && (tipo === "ajuste" ? n >= 0 : n > 0);
  const resultado = !valido ? null : tipo === "entrada" ? produto.quantity + n : tipo === "saida" ? produto.quantity - n : n;

  const enviar = async (e) => {
    e.preventDefault();
    setErro(""); setEnviando(true);
    try {
      const r = await api(`/products/${produto.id}/movements`, { method: "POST", corpo: { type: tipo, quantity: n, note: nota } });
      avisar(`${produto.name}: estoque em ${r.product.quantity}.`);
      aoSalvar(r.product);
    } catch (err) {
      setErro(err.message);
    } finally { setEnviando(false); }
  };

  return (
    <Modal titulo={`Movimentar ${produto.sku}`} aoFechar={aoFechar}>
      <form className="form" onSubmit={enviar} noValidate>
        <p className="resumo-prod"><strong>{produto.name}</strong><span>em estoque agora: <b>{produto.quantity}</b></span></p>
        <fieldset className="tipos">
          <legend>Tipo</legend>
          {TIPOS.map((t) => (
            <label key={t.id} className={tipo === t.id ? "on" : ""}>
              <input type="radio" name="tipo" checked={tipo === t.id} onChange={() => { setTipo(t.id); setQtd(t.id === "ajuste" ? String(produto.quantity) : ""); setErro(""); }} />
              <strong>{t.nome}</strong><small>{t.dica}</small>
            </label>
          ))}
        </fieldset>
        <label>{tipo === "ajuste" ? "Quantidade contada (novo estoque)" : "Quantidade"}<input inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} autoFocus required /></label>
        <label>Observação <small>(opcional)</small><input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder={tipo === "entrada" ? "Ex.: nota fiscal 4821" : tipo === "saida" ? "Ex.: venda balcão" : "Ex.: inventário de outubro"} /></label>
        <p className={`previa ${resultado !== null && resultado < 0 ? "ruim" : ""}`} aria-live="polite">
          {resultado === null ? "Informe a quantidade." : resultado < 0 ? `Só há ${produto.quantity} em estoque.` : <>Estoque depois: <b>{resultado}</b> {resultado !== produto.quantity && <i>({resultado > produto.quantity ? "+" : "−"}{Math.abs(resultado - produto.quantity)})</i>}</>}
        </p>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes-form"><button type="button" className="btn vazado" onClick={aoFechar}>Cancelar</button><button className="btn" disabled={enviando || !valido || (resultado !== null && resultado < 0)}>{enviando ? "Registrando…" : "Registrar movimentação"}</button></div>
      </form>
    </Modal>
  );
}
