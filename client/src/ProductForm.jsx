import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

function ProductForm() {
  const [product, setProduct] = useState({
    name: '',
    description: '',
    price: '',
    quantity: ''
  });
  const { id } = useParams(); // Pega o ID da rota
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      // Busca o produto se estiver no modo de edição
      axios.get(`http://localhost:3001/products/${id}`)
        .then(response => setProduct(response.data));
    }
  }, [id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (id) {
      axios.put(`http://localhost:3001/products/${id}`, product)
        .then(() => navigate('/'));
    } else {
      axios.post('http://localhost:3001/products', product)
        .then(() => navigate('/'));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" placeholder="Nome" value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} />
      <textarea placeholder="Descrição" value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} />
      <input type="number" placeholder="Preço" value={product.price} onChange={e => setProduct({ ...product, price: parseFloat(e.target.value) })} />
      <input type="number" placeholder="Quantidade" value={product.quantity} onChange={e => setProduct({ ...product, quantity: parseInt(e.target.value) })} />
      <button type="submit">{id ? 'Atualizar' : 'Adicionar'}</button>
    </form>
  );
}

export default ProductForm;
