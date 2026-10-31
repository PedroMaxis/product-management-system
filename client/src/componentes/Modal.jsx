import { useEffect, useRef } from "react";

/** Janela por cima da página: fecha com Esc ou clique fora e devolve o foco (a entrada é uma animação CSS) */
export default function Modal({ titulo, aoFechar, children }) {
  const caixa = useRef(null);
  useEffect(() => {
    const anterior = document.activeElement;
    caixa.current?.focus();
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = ""; anterior?.focus?.(); };
  }, [aoFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} ref={caixa} tabIndex={-1}>
        <header><h2>{titulo}</h2><button className="x" onClick={aoFechar} aria-label="Fechar">×</button></header>
        {children}
      </div>
    </div>
  );
}
