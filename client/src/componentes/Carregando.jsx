export default function Carregando({ texto = "Carregando…" }) {
  return <div className="carregando" role="status"><i className="esteira" aria-hidden="true" /><span className="mono">{texto}</span></div>;
}
