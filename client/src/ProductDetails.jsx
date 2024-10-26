import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:3001/products/${id}`)
      .then(response => setProduct(response.data));
  }, [id]);

  if (!product) return <p>Carregando...</p>;

  return (
    <div>
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <p>Preço: R${product.price.toFixed(2)}</p>
      <p>Quantidade: {product.quantity}</p>
      <Link to="/">Voltar à lista de produtos</Link>
    </div>
  );
}

export default ProductDetails;
