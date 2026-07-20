const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDatabase, getOne, getAll, insertUser, insertOrder, updateOrder, deleteOrder, getStats } = require('./database');

// Setup uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer config for screenshot upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'payment-' + Date.now() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
}});

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'creator-tools-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

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
    
    const existing = getOne('users', u => u.email === email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    
    const hashed = bcrypt.hashSync(password, 10);
    const result = insertUser({ name, email, phone: phone || '', password: hashed, role: 'customer' });
    
    const token = jwt.sign({ id: result.lastInsertRowid, email, name, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: result.lastInsertRowid, name, email, role: 'customer' } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const user = getOne('users', u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user', authMiddleware, (req, res) => {
  const user = getOne('users', u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ==================
// ORDER ROUTES
// ==================

app.post('/api/orders', upload.single('screenshot'), (req, res) => {
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
    
    const screenshotPath = req.file ? '/uploads/' + req.file.filename : '';
    
    const result = insertOrder({
      user_id: userId, user_name, user_email, user_phone: user_phone || '',
      product_name, plan_name, price: parseInt(price), payment_method: payment_method || 'pending',
      payment_status: 'pending', order_status: 'pending', notes: notes || '',
      screenshot: screenshotPath
    });
    
    // Log order for admin notification
    console.log('\n🔔 NEW ORDER RECEIVED!');
    console.log('   Product:', product_name, '-', plan_name);
    console.log('   Customer:', user_name, '|', user_email, '|', user_phone);
    console.log('   Amount: Rs.', price);
    console.log('   Payment:', payment_method);
    if (screenshotPath) console.log('   Screenshot:', screenshotPath);
    console.log('');
    
    res.json({ success: true, orderId: result.lastInsertRowid, message: 'Order placed successfully!' });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = getAll('orders', o => o.user_id === req.user.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ orders });
});

// ==================
// ADMIN ROUTES
// ==================

app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const stats = getStats();
  const recentOrders = getAll('orders').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  res.json({ stats, recentOrders });
});

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => {
  const orders = getAll('orders').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ orders });
});

app.put('/api/admin/orders/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { order_status, payment_status, payment_method, notes } = req.body;
  const success = updateOrder(req.params.id, { order_status, payment_status, payment_method, notes });
  if (!success) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true, message: 'Order updated!' });
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = getAll('users').map(({ password, ...u }) => u).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ users });
});

app.delete('/api/admin/orders/:id', authMiddleware, adminMiddleware, (req, res) => {
  deleteOrder(req.params.id);
  res.json({ success: true, message: 'Order deleted' });
});

// ==================
// START SERVER
// ==================
initDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('========================================');
  console.log('  ⚡ Creator Tools Server is RUNNING!');
  console.log('========================================');
  console.log('');
  console.log(`  🌐 Port: ${PORT}`);
  console.log('');
  console.log('========================================');
  console.log('');
});
