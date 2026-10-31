/** Erro com status HTTP e (opcionalmente) detalhes para o cliente */
class HttpError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.name = "HttpError";
    this.status = status;
    this.detalhes = detalhes;
  }
}
module.exports = { HttpError };
