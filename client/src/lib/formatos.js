const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR");
/** Valores trafegam em centavos inteiros e só viram texto na hora de exibir */
export const reais = (centavos) => brl.format(centavos / 100);
export const inteiro = (n) => num.format(n);
export const percentual = (n) => (n === null || n === undefined ? "—" : `${String(n).replace(".", ",")}%`);

export const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const dataCurta = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
/** "2024-10-25" → "25/10" (a data já vem em UTC do servidor; não passa por fuso) */
export const diaMes = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

export const ROTULO_STATUS = { ok: "Em dia", baixo: "Baixo", zerado: "Zerado", arquivado: "Arquivado" };
export const ROTULO_TIPO = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };

/** Texto do campo de dinheiro ("1.234,50" ou "12,9") → centavos; null se inválido */
export function centavosDeTexto(texto) {
  const limpo = String(texto).trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!limpo) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const textoDeCentavos = (c) => (c / 100).toFixed(2).replace(".", ",");

/** Linhas de histórico (mais novas primeiro) → pontos do gráfico de saldo, do mais antigo ao mais novo */
export const serieDeSaldo = (historico) => [...historico].reverse().map((m) => ({ x: m.createdAt, y: m.balance }));
