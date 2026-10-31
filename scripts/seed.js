// Cria dados de DEMONSTRAÇÃO no banco em arquivo (ver dados-demo.js). Não use em produção.
const fs = require("node:fs");
const path = require("node:path");
const { abrirBanco } = require("../src/db");
const { semear } = require("./dados-demo");

const arquivo = process.env.DATABASE_FILE || "data/almoxarifado.sqlite";
fs.mkdirSync(path.dirname(arquivo), { recursive: true });
const db = abrirBanco(arquivo);
if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n) console.log("O banco já tem produtos; nada a fazer.");
else console.log(`${semear(db)} produtos de demonstração criados em ${arquivo}.`);
