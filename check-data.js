const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage', ssl: { rejectUnauthorized: false } });
(async () => {
  const r = await pool.query("SELECT id, name, opening_balance FROM retailers WHERE name ILIKE '%Mumtaz%'");
  console.log('Retailer:', JSON.stringify(r.rows));
  const bp = await pool.query("SELECT id, name, type, opening_balance, current_balance FROM billing_parties WHERE name ILIKE '%Mumtaz%'");
  console.log('BillingParty:', JSON.stringify(bp.rows));
  if (bp.rows.length > 0) {
    const l = await pool.query("SELECT id, party_id, reference_type, debit, credit, balance FROM billing_ledger WHERE party_id = $1", [bp.rows[0].id]);
    console.log('Ledger entries:', JSON.stringify(l.rows));
  }
  await pool.end();
})();
