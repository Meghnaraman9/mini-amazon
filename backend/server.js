// ============================================================
//  server.js  –  Mini Amazon Backend
//  Stack: Express · lowdb (JSON file DB) · bcryptjs · JWT · CORS
//  No native compilation needed — works on all Windows machines!
// ============================================================

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const low     = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mini_amazon_secret_change_in_production';

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Database Setup (lowdb = JSON file, zero compilation) ───────
const adapter = new FileSync(path.join(__dirname, 'shop.json'));
const db = low(adapter);

// ── Default DB structure ───────────────────────────────────────
db.defaults({
  users:       [],
  products:    [],
  cart_items:  [],
  orders:      [],
  order_items: [],
  _counters: { users: 1, products: 1, cart_items: 1, orders: 1, order_items: 1 }
}).write();

// ── Auto-increment helper ──────────────────────────────────────
function nextId(table) {
  const id = db.get(`_counters.${table}`).value();
  db.set(`_counters.${table}`, id + 1).write();
  return id;
}

// ── Seed products once ─────────────────────────────────────────
if (db.get('products').size().value() === 0) {
  const seedProducts = [
    { name: 'Apple MacBook Pro 14"',  description: 'M3 Pro chip, 18GB RAM, 512GB SSD – perfect for developers.', price: 1999.99, image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', category: 'Electronics', stock: 15, rating: 4.8, reviews: 2341 },
    { name: 'Sony WH-1000XM5',        description: 'Industry-leading noise cancelling headphones with 30hr battery.', price: 349.99, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', category: 'Electronics', stock: 42, rating: 4.7, reviews: 8920 },
    { name: 'Nike Air Max 270',        description: 'Breathable mesh upper with Max Air unit for all-day comfort.', price: 129.99, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', category: 'Footwear',    stock: 88, rating: 4.5, reviews: 3201 },
    { name: 'The Pragmatic Programmer',description: 'Your journey to mastery — 20th anniversary edition.', price: 49.99,  image_url: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400', category: 'Books',       stock: 200, rating: 4.9, reviews: 12045 },
    { name: 'Logitech MX Master 3S',   description: 'Advanced wireless mouse with ultra-fast scrolling.', price: 99.99,  image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400', category: 'Electronics', stock: 60, rating: 4.6, reviews: 5678 },
    { name: 'Samsung 4K Monitor 27"',  description: 'IPS panel, 144Hz, USB-C for productivity and gaming.', price: 449.99, image_url: 'https://images.unsplash.com/photo-1585792180666-f7347c490ee2?w=400', category: 'Electronics', stock: 25, rating: 4.4, reviews: 1890 },
    { name: "Levi's 511 Slim Jeans",   description: 'Classic slim fit denim in stretch comfort fabric.', price: 59.99,  image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400', category: 'Clothing',    stock: 150, rating: 4.3, reviews: 6723 },
    { name: 'Instant Pot Duo 7-in-1',  description: 'Pressure cooker, slow cooker, rice cooker and more.', price: 89.99,  image_url: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400', category: 'Kitchen',     stock: 70, rating: 4.7, reviews: 22410 },
    { name: 'Kindle Paperwhite',        description: 'Waterproof, 300 ppi glare-free display, weeks of battery.', price: 139.99, image_url: 'https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=400', category: 'Electronics', stock: 95, rating: 4.6, reviews: 9876 },
    { name: 'LEGO Architecture NYC',    description: 'New York City skyline set – 598 pieces.', price: 69.99,  image_url: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400', category: 'Toys',        stock: 40, rating: 4.8, reviews: 3412 },
    { name: 'Yoga Mat Premium',         description: 'Non-slip, eco-friendly, 6mm thick with alignment lines.', price: 39.99,  image_url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400', category: 'Sports',      stock: 120, rating: 4.5, reviews: 4501 },
    { name: 'Mechanical Keyboard TKL', description: 'Tenkeyless, Cherry MX Blue switches, RGB backlit.', price: 119.99, image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', category: 'Electronics', stock: 35, rating: 4.4, reviews: 2103 },
  ];
  seedProducts.forEach(p => {
    db.get('products').push({ id: nextId('products'), ...p }).write();
  });
  console.log('✅ Seeded 12 products into shop.json');
}

// ══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = db.get('users').find({ email: email.toLowerCase() }).value();
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  const user = {
    id: nextId('users'), name,
    email: email.toLowerCase(), password: hashed,
    role: 'customer', created_at: new Date().toISOString()
  };
  db.get('users').push(user).write();

  const payload = { id: user.id, name, email: user.email, role: 'customer' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: payload });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.get('users').find({ email: email?.toLowerCase() }).value();
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: payload });
});

// GET /api/auth/me
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

// ══════════════════════════════════════════════════════════════
//  PRODUCT ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/products?category=&search=&sort=
app.get('/api/products', (req, res) => {
  const { category, search, sort } = req.query;
  let products = db.get('products').value();

  if (category && category !== 'All')
    products = products.filter(p => p.category === category);

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }

  if (sort === 'price_asc')  products.sort((a,b) => a.price - b.price);
  if (sort === 'price_desc') products.sort((a,b) => b.price - a.price);
  if (sort === 'rating')     products.sort((a,b) => b.rating - a.rating);
  if (sort === 'newest')     products.sort((a,b) => b.id - a.id);

  res.json(products);
});

// GET /api/products/categories
app.get('/api/products/categories', (req, res) => {
  const cats = [...new Set(db.get('products').map('category').value())].sort();
  res.json(['All', ...cats]);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const product = db.get('products').find({ id: parseInt(req.params.id) }).value();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ══════════════════════════════════════════════════════════════
//  CART ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/cart
app.get('/api/cart', auth, (req, res) => {
  const cartItems = db.get('cart_items').filter({ user_id: req.user.id }).value();
  const enriched = cartItems.map(ci => {
    const product = db.get('products').find({ id: ci.product_id }).value();
    return { ...ci, name: product.name, price: product.price, image_url: product.image_url, stock: product.stock };
  });
  res.json(enriched);
});

// POST /api/cart
app.post('/api/cart', auth, (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  const product = db.get('products').find({ id: parseInt(product_id) }).value();
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = db.get('cart_items').find({ user_id: req.user.id, product_id: parseInt(product_id) }).value();
  if (existing) {
    db.get('cart_items').find({ id: existing.id }).assign({ quantity: existing.quantity + quantity }).write();
  } else {
    db.get('cart_items').push({
      id: nextId('cart_items'), user_id: req.user.id,
      product_id: parseInt(product_id), quantity
    }).write();
  }
  res.json({ message: 'Added to cart' });
});

// PUT /api/cart/:id
app.put('/api/cart/:id', auth, (req, res) => {
  const { quantity } = req.body;
  if (quantity < 1) {
    db.get('cart_items').remove({ id: parseInt(req.params.id), user_id: req.user.id }).write();
  } else {
    db.get('cart_items').find({ id: parseInt(req.params.id), user_id: req.user.id }).assign({ quantity }).write();
  }
  res.json({ message: 'Cart updated' });
});

// DELETE /api/cart/:id
app.delete('/api/cart/:id', auth, (req, res) => {
  db.get('cart_items').remove({ id: parseInt(req.params.id), user_id: req.user.id }).write();
  res.json({ message: 'Item removed' });
});

// DELETE /api/cart (clear all)
app.delete('/api/cart', auth, (req, res) => {
  db.get('cart_items').remove({ user_id: req.user.id }).write();
  res.json({ message: 'Cart cleared' });
});

// ══════════════════════════════════════════════════════════════
//  ORDER ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/orders
app.post('/api/orders', auth, (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Delivery address is required' });

  const cartItems = db.get('cart_items').filter({ user_id: req.user.id }).value();
  if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

  const enriched = cartItems.map(ci => {
    const p = db.get('products').find({ id: ci.product_id }).value();
    return { ...ci, product: p };
  });

  // Check stock
  for (const item of enriched) {
    if (item.product.stock < item.quantity)
      return res.status(400).json({ error: `Insufficient stock for "${item.product.name}"` });
  }

  const total = enriched.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const orderId = nextId('orders');

  // Create order
  db.get('orders').push({
    id: orderId, user_id: req.user.id,
    total, status: 'processing', address,
    created_at: new Date().toISOString()
  }).write();

  // Create order items + decrement stock
  enriched.forEach(item => {
    db.get('order_items').push({
      id: nextId('order_items'), order_id: orderId,
      product_id: item.product_id,
      name: item.product.name, price: item.product.price,
      quantity: item.quantity, image_url: item.product.image_url
    }).write();
    db.get('products').find({ id: item.product_id })
      .assign({ stock: item.product.stock - item.quantity }).write();
  });

  // Clear cart
  db.get('cart_items').remove({ user_id: req.user.id }).write();

  res.status(201).json({ message: 'Order placed successfully', order_id: orderId });
});

// GET /api/orders
app.get('/api/orders', auth, (req, res) => {
  const orders = db.get('orders').filter({ user_id: req.user.id })
    .sortBy(o => -new Date(o.created_at)).value();
  const withItems = orders.map(o => ({
    ...o,
    items: db.get('order_items').filter({ order_id: o.id }).value()
  }));
  res.json(withItems);
});

// GET /api/orders/:id
app.get('/api/orders/:id', auth, (req, res) => {
  const order = db.get('orders').find({ id: parseInt(req.params.id), user_id: req.user.id }).value();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.items = db.get('order_items').filter({ order_id: order.id }).value();
  res.json(order);
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Mini Amazon API running → http://localhost:${PORT}`);
  console.log(`   Database file: shop.json (created automatically)\n`);
});
