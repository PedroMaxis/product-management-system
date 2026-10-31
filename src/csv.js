/** CSV mínimo e correto: aspas, delimitador `;` ou `,` (detectado), quebras de linha dentro de aspas. */


function detectarDelimitador(texto) {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  return (primeira.match(/;/g) ?? []).length >= (primeira.match(/,/g) ?? []).length ? ";" : ",";
}

/** Lê um CSV inteiro e devolve matriz de linhas (arrays de células) */
function lerCsv(bruto) {
  const texto = bruto.replace(/^﻿/, "");
  const delim = detectarDelimitador(texto);
  const linhas = [];
  let linha = [], celula = "", aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { celula += '"'; i++; }
      else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) { linha.push(celula); celula = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(celula); celula = "";
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
    } else celula += c;
  }
  linha.push(celula);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

/** Gera CSV para Excel brasileiro: `;` como separador e BOM para acentos */
function gerarCsv(linhas) {
  const esc = (v) => {
    const s = String(v ?? "");
    // aspas duplicam; e células que começam com = + - @ ganham apóstrofo para não virarem fórmula na planilha
    const seguro = /^[=+\-@]/.test(s) && Number.isNaN(Number(s.replace(",", "."))) ? `'${s}` : s;
    return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  return "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n") + "\r\n";
}

module.exports = { lerCsv, gerarCsv, detectarDelimitador };
