const pool = require('../config/db');

async function categories(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
}

async function banks(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM banks ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { categories, banks };
