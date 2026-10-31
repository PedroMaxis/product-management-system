export class ErroApi extends Error {
  constructor(status, mensagem, detalhes) { super(mensagem); this.status = status; this.detalhes = detalhes; }
}

/** fetch com JSON; erros viram ErroApi com a mensagem em português vinda do servidor */
export async function api(caminho, opcoes = {}) {
  // demo publicado no GitHub Pages: as regras rodam no navegador, sem servidor (ver src/demo)
  if (import.meta.env.VITE_DEMO) return (await import("../demo/servidor.js")).chamar(caminho, opcoes);
  const { method = "GET", corpo, texto } = opcoes;
  let resp;
  try {
    resp = await fetch(`/api${caminho}`, {
      method,
      headers: texto !== undefined ? { "Content-Type": "text/csv" } : corpo ? { "Content-Type": "application/json" } : {},
      body: texto !== undefined ? texto : corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor. Confira se a API está no ar.");
  }
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ErroApi(resp.status, dados.error || "Algo deu errado.", dados.details);
  return dados;
}

export const query = (obj) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== "") q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};
