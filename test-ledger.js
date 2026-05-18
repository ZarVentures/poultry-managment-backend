const { Client } = require('pg');

async function testLedger(retailerName) {
  // Use database URL from env or fallback to local staging
  const connectionString = process.env.DATABASE_URL || 'postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage';
  
  console.log(`Connecting to: ${connectionString.replace(/:[^:]*@/, ':****@')}`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log(`\n=== STEP 1: Find or Create Billing Party for "${retailerName}" ===`);
    const partyRes = await client.query(
      `SELECT * FROM billing_parties WHERE TRIM(LOWER(name)) = TRIM(LOWER($1))`,
      [retailerName]
    );

    if (partyRes.rows.length === 0) {
      console.log(`❌ No billing party found matching "${retailerName}".`);
      await client.end();
      return;
    }

    const party = partyRes.rows[0];
    console.log(`✅ Found Party: ID = ${party.id}, Name = "${party.name}", Type = ${party.type}`);

    console.log(`\n=== STEP 2: Fetch Direct Ledger Entries from billing_ledger ===`);
    const directRes = await client.query(
      `SELECT * FROM billing_ledger WHERE "party_id" = $1 ORDER BY date ASC`,
      [party.id]
    );
    console.log(`Direct entries found: ${directRes.rows.length}`);
    console.table(directRes.rows);

    console.log(`\n=== STEP 3: Fetch Dynamic Sales from sales table ===`);
    const salesRes = await client.query(
      `SELECT id, sale_no, invoice_number, customer_name, sale_date, total_amount, net_amount 
       FROM sales 
       WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER($1))`,
      [party.name]
    );
    console.log(`Dynamic sales found: ${salesRes.rows.length}`);
    console.table(salesRes.rows);

    console.log(`\n=== STEP 4: Fetch Sale Payments from sale_payments ===`);
    if (salesRes.rows.length > 0) {
      const saleIds = salesRes.rows.map(s => s.id);
      const paymentsRes = await client.query(
        `SELECT id, sale_id, payment_mode, amount, created_at 
         FROM sale_payments 
         WHERE sale_id = ANY($1)`,
        [saleIds]
      );
      console.log(`Sale payments found: ${paymentsRes.rows.length}`);
      console.table(paymentsRes.rows);
    } else {
      console.log(`No sales to look up payments for.`);
    }

  } catch (err) {
    console.error('Error during ledger check:', err);
  } finally {
    await client.end();
  }
}

// Get name from CLI arguments or default to 'Salim Bhai '
const nameArg = process.argv[2] || 'Salim Bhai ';
testLedger(nameArg);
