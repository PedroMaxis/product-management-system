import { NavLink } from "react-router-dom";
import { IcCaixa, IcImportar, IcPainel } from "./Icones";

export default function Cabecalho() {
  return (
    <aside className="lateral">
      <NavLink to="/" className="marca" aria-label="Almoxarifado, painel">
        <span className="logo" aria-hidden="true"><IcCaixa /></span>
        <span className="nome">Almoxarifado</span>
      </NavLink>
      <nav aria-label="Principal">
        <NavLink to="/" end><IcPainel /><span>Painel</span></NavLink>
        <NavLink to="/produtos"><IcCaixa /><span>Produtos</span></NavLink>
        <NavLink to="/importar"><IcImportar /><span>Importar / exportar</span></NavLink>
      </nav>
      <p className="lateral-rodape">Sem login: use atrás de uma rede confiável.</p>
    </aside>
  );
}
