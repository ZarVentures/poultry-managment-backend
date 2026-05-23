const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM godown_expense LIMIT 10');
    console.log('Rows:', res.rows);
    const count = await client.query('SELECT COUNT(*) FROM godown_expense');
    console.log('Total count:', count.rows[0].count);
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await client.end();
  }
}

run();
