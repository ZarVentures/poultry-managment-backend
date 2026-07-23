require('dotenv').config();
const { Client } = require('pg');
const c = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});
c.connect()
  .then(() => c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'weight_shortage_kg'"))
  .then(r => {
    if (r.rows.length === 0) {
      return c.query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS weight_shortage_kg NUMERIC(10,2) DEFAULT 0")
        .then(() => console.log('Column added successfully'));
    }
    console.log('Column already exists');
  })
  .then(() => c.end())
  .catch(e => { console.error('Error:', e.message); c.end(); });
