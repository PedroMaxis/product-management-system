const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Product } = require('./models');

const app = express();
app.use(cors({
     origin: 'http://localhost:5173'
}));
app.use(bodyParser.json());

// Rotas CRUD
// 1. Listar todos os produtos
app.get('/products', async (req, res) => {
  const products = await Product.findAll();
  res.json(products);
});


// 2. Adicionar um novo produto
app.post('/products', async (req, res) => {
  const { name, description, price, quantity } = req.body;
  const newProduct = await Product.create({ name, description, price, quantity });
  res.status(200).send(newProduct);
});

// 3. Editar um produto
app.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findByPk(id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Produto não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar produto' });
  }
});

// 4. Excluir um produto
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByPk(id);
  if (product) {
    await product.destroy();
    res.json({ message: 'Produto excluído com sucesso' });
  } else {
    res.status(404).send('Produto não encontrado');
  }
});
// 5. Atualizar um produto
app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, quantity } = req.body;
  try {
    const product = await Product.findByPk(id);
    if (product) {
      product.name = name;
      product.description = description;
      product.price = price;
      product.quantity = quantity;
      await product.save();
      res.json(product);
    } else {
      res.status(404).json({ message: 'Produto não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar produto' });
  }
});
// Iniciar o servidor
app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});
