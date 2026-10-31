const { HttpError } = require("./errors");

const invalido = (m) => new HttpError(400, m);

const texto = (v, { campo, min = 1, max = 200 }) => {
  if (typeof v !== "string") throw invalido(`O campo "${campo}" é obrigatório.`);
  const limpo = v.trim().replace(/\s+/g, " ");
  if (limpo.length < min || limpo.length > max) throw invalido(`O campo "${campo}" deve ter de ${min} a ${max} caracteres.`);
  return limpo;
};

/** Texto opcional: vazio vira "" */
const textoOpcional = (v, { campo, max = 1000 }) => (v === undefined || v === null || v === "" ? "" : texto(String(v), { campo, min: 0, max }));

/** Inteiro (aceita "12" também) dentro de uma faixa */
const inteiro = (v, { campo, min = 0, max = 100_000_000 }) => {
  const n = typeof v === "string" && /^-?\d+$/.test(v.trim()) ? Number(v) : v;
  if (!Number.isInteger(n) || n < min || n > max) throw invalido(`O campo "${campo}" deve ser um número inteiro entre ${min} e ${max}.`);
  return n;
};

/** Dinheiro em centavos: aceita centavos inteiros ou reais ("12,90", "12.9", 12.9) e devolve centavos */
const dinheiroEmCentavos = (v, { campo, max = 100_000_000 }) => {
  let reais;
  if (typeof v === "number") reais = v;
  else if (typeof v === "string") reais = Number(v.trim().replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", "."));
  if (!Number.isFinite(reais)) throw invalido(`O campo "${campo}" deve ser um valor em reais, como 12,90.`);
  const cents = Math.round(reais * 100);
  if (cents < 0 || cents > max) throw invalido(`O campo "${campo}" deve estar entre 0 e ${(max / 100).toLocaleString("pt-BR")}.`);
  return cents;
};

const sku = (v) => {
  const s = texto(v, { campo: "SKU", min: 2, max: 40 }).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(s)) throw invalido("O SKU deve ter só letras, números, ponto, hífen ou sublinhado.");
  return s;
};

const idDaRota = (v) => {
  if (!/^\d{1,12}$/.test(String(v))) throw new HttpError(404, "Não encontrado.");
  return Number(v);
};

module.exports = { texto, textoOpcional, inteiro, dinheiroEmCentavos, sku, idDaRota };
