/** Valor formatado. (Já foi um contador animado; num painel de estoque o número certo, na hora, vale mais.) */
export default function Numero({ valor, formatar = (n) => String(n), className }) {
  return <span className={className}>{formatar(valor)}</span>;
}
