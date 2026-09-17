require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const c = process.env.DATABASE_URL
    ? new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      })
    : new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });
  await c.connect();
  const stmts = [
    `ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'upi'`,
    `ALTER TABLE expenses ALTER COLUMN payment_method TYPE varchar(30) USING payment_method::text`,
    `ALTER TABLE godown_expenses ALTER COLUMN payment_method TYPE varchar(30) USING payment_method::text`,
  ];
  for (const s of stmts) {
    try {
      await c.query(s);
      console.log('OK', s);
    } catch (e) {
      console.log('SKIP', e.message);
    }
  }
  await c.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
