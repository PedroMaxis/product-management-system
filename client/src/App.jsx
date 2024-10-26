import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import ProductDetails from './ProductDetails'; // Página de detalhes do produto

function App() {
  return (
    <Router>
      <div>
        <h1>Gerenciamento de Produtos</h1>
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/add" element={<ProductForm />} />
          <Route path="/edit/:id" element={<ProductForm />} />
          <Route path="/details/:id" element={<ProductDetails />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
