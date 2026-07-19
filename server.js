const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDatabase, getOne, getAll, runQuery, getCount } = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'creator-tools-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ==================
// AUTH ROUTES
// ==================

app.post('/api/register', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    
    const existing = getOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    
    const hashed = bcrypt.hashSync(password, 10);
    const result = runQuery('INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)', [name, email, phone || '', hashed]);
    
    const token = jwt.sign({ id: result.lastInsertRowid, email, name, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: result.lastInsertRowid, name, email, role: 'customer' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const user = getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user', authMiddleware, (req, res) => {
  const user = getOne('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ==================
// ORDER ROUTES
// ==================

app.post('/api/orders', (req, res) => {
  try {
    const { user_name, user_email, user_phone, product_name, plan_name, price, payment_method, notes } = req.body;
    if (!user_name || !user_email || !product_name || !plan_name || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    let userId = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try { userId = jwt.verify(token, JWT_SECRET).id; } catch(e) {}
    }
    
    const result = runQuery(
      'INSERT INTO orders (user_id, user_name, user_email, user_phone, product_name, plan_name, price, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, user_name, user_email, user_phone || '', product_name, plan_name, price, payment_method || 'pending', notes || '']
    );
    
    res.json({ success: true, orderId: result.lastInsertRowid, message: 'Order placed successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = getAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ orders });
});

// ==================
// ADMIN ROUTES
// ==================

app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const totalOrders = getCount('SELECT COUNT(*) as count FROM orders');
  const pendingOrders = getCount("SELECT COUNT(*) as count FROM orders WHERE order_status = 'pending'");
  const completedOrders = getCount("SELECT COUNT(*) as count FROM orders WHERE order_status = 'completed'");
  const totalRevenue = getCount("SELECT COALESCE(SUM(price), 0) as total FROM orders WHERE payment_status = 'paid'");
  const totalUsers = getCount("SELECT COUNT(*) as count FROM users WHERE role = 'customer'");
  const recentOrders = getAll('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');
  
  res.json({
    stats: { totalOrders, pendingOrders, completedOrders, totalRevenue, totalUsers },
    recentOrders
  });
});

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => {
  const orders = getAll('SELECT * FROM orders ORDER BY created_at DESC');
  res.json({ orders });
});

app.put('/api/admin/orders/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { order_status, payment_status, payment_method, notes } = req.body;
  const orderId = req.params.id;
  
  const order = getOne('SELECT * FROM orders WHERE id = ?', [parseInt(orderId)]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  runQuery(
    'UPDATE orders SET order_status = ?, payment_status = ?, payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [
      order_status || order.order_status,
      payment_status || order.payment_status,
      payment_method || order.payment_method,
      notes !== undefined ? notes : order.notes,
      parseInt(orderId)
    ]
  );
  
  res.json({ success: true, message: 'Order updated!' });
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = getAll('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
  res.json({ users });
});

app.delete('/api/admin/orders/:id', authMiddleware, adminMiddleware, (req, res) => {
  runQuery('DELETE FROM orders WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ success: true, message: 'Order deleted' });
});

// ==================
// START SERVER
// ==================
async function start() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  ⚡ Creator Tools Server is RUNNING!');
    console.log('========================================');
    console.log('');
    console.log(`  🌐 Website:  http://localhost:${PORT}`);
    console.log(`  👨‍💼 Admin:    http://localhost:${PORT}/admin.html`);
    console.log('');
    console.log('  🔐 Admin Login:');
    console.log('     Email:    admin@creatortools.com');
    console.log('     Password: admin123');
    console.log('');
    console.log('========================================');
    console.log('');
  });
}

start();
