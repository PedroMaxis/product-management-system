import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './productlist.css';

function ProductList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:3001/products')
      .then(response => setProducts(response.data));
  }, []);

  const handleDelete = (id) => {
    axios.delete(`http://localhost:3001/products/${id}`)
      .then(() => setProducts(products.filter(p => p.id !== id)));
  };

  return (
    <div>
      <h2>Lista de Produtos</h2>
      <Link to="/add">Adicionar Novo Produto</Link>
      <ul>
        {products.map(product => (
          <li key={product.id}>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <Link to={`/edit/${product.id}`}>Editar</Link>
            <Link to={`/details/${product.id}`}>Detalhes</Link>
            <button id='deletebtn' onClick={() => handleDelete(product.id)}>Excluir</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProductList;
