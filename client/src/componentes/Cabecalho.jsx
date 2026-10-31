import { NavLink } from "react-router-dom";

export default function Cabecalho() {
  return (
    <header className="cabecalho">
      <div className="faixa-perigo" aria-hidden="true" />
      <div className="cab-in">
        <NavLink to="/" className="marca" aria-label="Almoxarifado, painel">
          <span className="codigo" aria-hidden="true" />
          <span className="nome">ALMOXARIFADO</span>
        </NavLink>
        <nav aria-label="Principal">
          <NavLink to="/" end>Painel</NavLink>
          <NavLink to="/produtos">Produtos</NavLink>
          <NavLink to="/importar">Importar / exportar</NavLink>
        </nav>
      </div>
    </header>
  );
}
