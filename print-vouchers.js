const { Client } = require('pg');

const SSL = { rejectUnauthorized: false };
const connectionString = "postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage";

async function run() {
  const client = new Client({ connectionString, ssl: SSL });
  await client.connect();
  console.log('Connected to DB');

  const res = await client.query(`
    SELECT bl.id, bl.party_id, bp.name as party_name, bp.type as party_type, bl.reference_id, bl.debit, bl.credit, bl.balance, bl.date
    FROM billing_ledger bl
    JOIN billing_parties bp ON bl.party_id = bp.id
    WHERE bl.reference_type = 'Voucher'
    ORDER BY bl.date DESC;
  `);

  console.table(res.rows);

  await client.end();
}

run().catch(console.error);
