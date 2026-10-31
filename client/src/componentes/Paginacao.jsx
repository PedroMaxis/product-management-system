export default function Paginacao({ pagina, paginas, total, tamanho, aoMudar }) {
  if (total === 0) return null;
  const de = (pagina - 1) * tamanho + 1, ate = Math.min(total, pagina * tamanho);
  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="mono">{de}–{ate} de {total}</span>
      <div>
        <button className="btn pequeno vazado" onClick={() => aoMudar(pagina - 1)} disabled={pagina <= 1}>← Anterior</button>
        <span className="mono">página {pagina} de {paginas}</span>
        <button className="btn pequeno vazado" onClick={() => aoMudar(pagina + 1)} disabled={pagina >= paginas}>Próxima →</button>
      </div>
    </nav>
  );
}
