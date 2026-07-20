const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.json');

// Default data structure
const defaultData = {
  users: [],
  orders: [],
  nextUserId: 2,
  nextOrderId: 1
};

let data;

function initDatabase() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      data = JSON.parse(raw);
    } catch (e) {
      data = { ...defaultData };
    }
  } else {
    data = { ...defaultData };
  }

  // Create default admin user if not exists
  const adminExists = data.users.find(u => u.email === 'admin@creatortools.com');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    data.users.push({
      id: 1,
      name: 'Admin',
      email: 'admin@creatortools.com',
      phone: '923126575447',
      password: hashedPassword,
      role: 'admin',
      created_at: new Date().toISOString()
    });
    saveDatabase();
  }

  console.log('  ✅ Database initialized (' + data.users.length + ' users, ' + data.orders.length + ' orders)');
  return data;
}

function saveDatabase() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Helper functions
function getOne(table, filter) {
  return data[table].find(filter) || null;
}

function getAll(table, filter) {
  if (filter) return data[table].filter(filter);
  return [...data[table]];
}

function insertUser(user) {
  user.id = data.nextUserId++;
  user.created_at = new Date().toISOString();
  data.users.push(user);
  saveDatabase();
  return { lastInsertRowid: user.id };
}

function insertOrder(order) {
  order.id = data.nextOrderId++;
  order.created_at = new Date().toISOString();
  order.updated_at = new Date().toISOString();
  data.orders.push(order);
  saveDatabase();
  return { lastInsertRowid: order.id };
}

function updateOrder(orderId, updates) {
  const idx = data.orders.findIndex(o => o.id === parseInt(orderId));
  if (idx === -1) return false;
  Object.assign(data.orders[idx], updates, { updated_at: new Date().toISOString() });
  saveDatabase();
  return true;
}

function deleteOrder(orderId) {
  data.orders = data.orders.filter(o => o.id !== parseInt(orderId));
  saveDatabase();
  return true;
}

function getStats() {
  const totalOrders = data.orders.length;
  const pendingOrders = data.orders.filter(o => o.order_status === 'pending').length;
  const completedOrders = data.orders.filter(o => o.order_status === 'completed').length;
  const totalRevenue = data.orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + (o.price || 0), 0);
  const totalUsers = data.users.filter(u => u.role === 'customer').length;
  return { totalOrders, pendingOrders, completedOrders, totalRevenue, totalUsers };
}

module.exports = { initDatabase, saveDatabase, getOne, getAll, insertUser, insertOrder, updateOrder, deleteOrder, getStats, data: () => data };
