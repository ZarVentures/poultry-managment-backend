const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const partyName = "Salim Bhai ";
  console.log(`Querying sales with party name: "${partyName}"`);

  // Simulate TRIM(LOWER(sale.customerName)) = TRIM(LOWER(:name))
  const res = await client.query(
    `SELECT id, sale_no, customer_name, total_amount 
     FROM sales 
     WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER($1))`, 
    [partyName]
  );
  console.log('Query result count:', res.rowCount);
  console.table(res.rows);

  await client.end();
}

run().catch(console.error);
