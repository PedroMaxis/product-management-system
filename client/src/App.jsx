import { Link, Route, Routes } from "react-router-dom";
import Cabecalho from "./componentes/Cabecalho";
import Importar from "./paginas/Importar";
import Painel from "./paginas/Painel";
import Produto from "./paginas/Produto";
import Produtos from "./paginas/Produtos";

export default function App() {
  return (
    <div className="app">
      <a href="#conteudo" className="sr">Pular para o conteúdo</a>
      <Cabecalho />
      <div id="conteudo" className="area">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/produtos/:id" element={<Produto />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="*" element={<main className="pagina"><div className="vazio"><h2>Página não encontrada</h2><p>Essa prateleira não existe.</p><Link to="/" className="btn">Ir ao painel</Link></div></main>} />
        </Routes>
      </div>
    </div>
  );
}
