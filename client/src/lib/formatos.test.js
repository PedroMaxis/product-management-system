import { describe, expect, it } from "vitest";
import { centavosDeTexto, diaMes, percentual, reais, serieDeSaldo, textoDeCentavos } from "./formatos";

const normal = (s) => s.replace(/\s/g, " "); // o Intl usa espaço sem quebra entre R$ e o valor

describe("formatos", () => {
  it("formata centavos em reais", () => {
    expect(normal(reais(4990))).toBe("R$ 49,90");
    expect(normal(reais(123456))).toBe("R$ 1.234,56");
    expect(normal(reais(0))).toBe("R$ 0,00");
  });
  it("entende o texto do campo de dinheiro", () => {
    expect(centavosDeTexto("12,90")).toBe(1290);
    expect(centavosDeTexto("1.234,50")).toBe(123450);
    expect(centavosDeTexto("R$ 3,5")).toBe(350);
    expect(centavosDeTexto("7")).toBe(700);
    expect(centavosDeTexto("")).toBeNull();
    expect(centavosDeTexto("abc")).toBeNull();
    expect(centavosDeTexto("-4")).toBeNull();
  });
  it("faz a viagem de ida e volta sem perder centavos", () => {
    for (const c of [0, 1, 99, 100, 1999, 123456]) expect(centavosDeTexto(textoDeCentavos(c))).toBe(c);
  });
  it("percentual e data", () => {
    expect(percentual(35.2)).toBe("35,2%");
    expect(percentual(null)).toBe("—");
    expect(diaMes("2024-10-25")).toBe("25/10");
  });
  it("série de saldo vai do mais antigo ao mais novo", () => {
    expect(serieDeSaldo([{ createdAt: "b", balance: 5 }, { createdAt: "a", balance: 10 }])).toEqual([{ x: "a", y: 10 }, { x: "b", y: 5 }]);
  });
});
