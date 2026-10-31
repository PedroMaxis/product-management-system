const fs = require("node:fs");
const path = require("node:path");
const { abrirBanco } = require("./db");
const { criarApp } = require("./app");
const { migrarLegado } = require("./legado");

const config = {
  porta: Number(process.env.PORT) || 3001,
  banco: process.env.DATABASE_FILE || "data/almoxarifado.sqlite",
  origens: (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
};

fs.mkdirSync(path.dirname(config.banco), { recursive: true });
const db = abrirBanco(config.banco);
const migrados = migrarLegado(db);
if (migrados) console.log(`${migrados} produto(s) migrado(s) da versão anterior.`);

criarApp({ db, config }).listen(config.porta, () => console.log(`Almoxarifado em http://localhost:${config.porta}`));
