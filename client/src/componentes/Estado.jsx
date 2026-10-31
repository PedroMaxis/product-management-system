import { ROTULO_STATUS } from "../lib/formatos";

/** Selo de situação do estoque (cor + texto, nunca só cor) */
export default function Estado({ status }) {
  return <span className={`estado estado-${status}`}>{ROTULO_STATUS[status]}</span>;
}
