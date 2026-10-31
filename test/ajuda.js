const request = require("supertest");
const { abrirBanco } = require("../src/db");
const { criarApp } = require("../src/app");

function montar() {
  const db = abrirBanco(":memory:");
  const api = request(criarApp({ db, config: {} }));
  const criar = async (corpo = {}) => {
    const r = await api.post("/api/products").send({ name: "Caneta azul", price: "3,50", cost: "1,20", quantity: 10, minQuantity: 3, category: "Escrita", ...corpo });
    return r.body;
  };
  return { db, api, criar };
}
module.exports = { montar };
