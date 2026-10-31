import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// No demo (modo "demo", publicado no GitHub Pages) o código CommonJS do servidor roda no navegador:
// o módulo de banco é trocado por um adaptador sobre sql.js (ver src/demo).
const bancoNoNavegador = () => ({
  name: "banco-no-navegador",
  enforce: "pre",
  resolveId(origem, importador) {
    const doServidor = importador && /[\\/](src|scripts)[\\/][^\\/]+\.js$/.test(importador) && importador.startsWith(raiz) && !importador.includes("client");
    if (doServidor && /(^|\/)db$/.test(origem)) return path.resolve(raiz, "client/src/demo/db-navegador.cjs");
    return null;
  },
});

// em desenvolvimento, /api vai para o Express (porta 3001): mesmo domínio, sem CORS
export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    base: demo ? "./" : "/",
    plugins: [react(), demo && bancoNoNavegador()],
    build: demo ? { commonjsOptions: { include: [/node_modules/, new RegExp(escapar(raiz) + "/(src|scripts)/"), /db-navegador\.cjs$/] } } : {},
    server: { port: 5176, proxy: { "/api": "http://localhost:3001" } },
    test: { environment: "node" },
  };
});
