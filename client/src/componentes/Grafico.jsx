import { diaMes } from "../lib/formatos";

/** Entradas (verde) e saídas (laranja) dos últimos 14 dias, em SVG puro */
export default function Grafico({ dados }) {
  const L = 560, A = 190, base = A - 26;
  const maior = Math.max(1, ...dados.flatMap((d) => [d.in, d.out]));
  const largura = L / dados.length;
  const h = (n) => (n / maior) * (base - 14);


  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Entradas e saídas dos últimos 14 dias">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={L} y1={base - f * (base - 14)} y2={base - f * (base - 14)} className="grade-grafico" />)}
        <line x1="0" x2={L} y1={base} y2={base} stroke="#cbd2dd" strokeWidth="1.5" />
        {dados.map((d, i) => {
          const x = i * largura;
          return (
            <g key={d.day}>
              {d.in > 0 && <rect className="barra entrada" rx="2.5" x={x + 4} y={base - h(d.in)} width={largura / 2 - 5} height={h(d.in)}><title>{`${diaMes(d.day)}: ${d.in} entrada(s)`}</title></rect>}
              {d.out > 0 && <rect className="barra saida" rx="2.5" x={x + largura / 2} y={base - h(d.out)} width={largura / 2 - 5} height={h(d.out)}><title>{`${diaMes(d.day)}: ${d.out} saída(s)`}</title></rect>}
              {i % 2 === 0 && <text x={x + largura / 2} y={A - 8} textAnchor="middle" className="eixo">{diaMes(d.day)}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption><i className="leg entrada" /> entradas <i className="leg saida" /> saídas · pico de {maior} un/dia</figcaption>
    </figure>
  );
}
