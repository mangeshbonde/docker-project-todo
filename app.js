const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB Connection Pool ───────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'todouser',
  password: process.env.DB_PASSWORD || 'todopass',
  database: process.env.DB_NAME || 'tododb',
  waitForConnections: true,
  connectionLimit: 10,
});

// Wait for MySQL to be ready, then start server
async function waitForDB(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log('✅ Connected to MySQL');
      return true;
    } catch (err) {
      console.log(`⏳ Waiting for MySQL... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('❌ Could not connect to MySQL after retries');
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// GET all todos
app.get('/api/todos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create todo
app.post('/api/todos', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO todos (title, completed) VALUES (?, false)',
      [title.trim()]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT toggle complete
app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed, title } = req.body;
  try {
    if (title !== undefined) {
      await pool.query('UPDATE todos SET title = ? WHERE id = ?', [title, id]);
    }
    if (completed !== undefined) {
      await pool.query('UPDATE todos SET completed = ? WHERE id = ?', [completed, id]);
    }
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE todo
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM todos WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

waitForDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 To-Do app running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error(err.message);
  process.exit(1);
});
