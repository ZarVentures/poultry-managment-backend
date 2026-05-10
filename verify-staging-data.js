const { Client } = require('pg');

const stageClient = new Client({
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'poultry_stage',
  user: 'poultry_user',
  password: 'poultry_user1212',
  ssl: { rejectUnauthorized: false }
});

async function verifyData() {
  try {
    await stageClient.connect();
    console.log('✅ Connected to STAGING database\n');
    console.log('📊 Data Verification Report:\n');

    const tables = [
      'users',
      'farmers',
      'retailers',
      'vehicles',
      'settings',
      'purchase_orders',
      'purchase_order_payments',
      'cages',
      'sales',
      'sale_payments',
      'godown_inward_entries',
      'godown_sales',
      'godown_sale_payments',
      'godown_mortality',
      'godown_expenses'
    ];

    for (const table of tables) {
      try {
        const result = await stageClient.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        
        if (count > 0) {
          console.log(`✅ ${table.padEnd(30)} ${count} rows`);
        } else {
          console.log(`⚠️  ${table.padEnd(30)} 0 rows (empty)`);
        }
      } catch (err) {
        console.log(`❌ ${table.padEnd(30)} Error: ${err.message.substring(0, 50)}`);
      }
    }

    console.log('\n📋 Detailed Check:\n');

    // Check sales with details
    const salesCheck = await stageClient.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid,
             COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending,
             COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial
      FROM sales
    `);
    console.log('Sales breakdown:');
    console.log(`  Total: ${salesCheck.rows[0].total}`);
    console.log(`  Paid: ${salesCheck.rows[0].paid}`);
    console.log(`  Pending: ${salesCheck.rows[0].pending}`);
    console.log(`  Partial: ${salesCheck.rows[0].partial}`);

    // Check sale_payments
    const paymentsCheck = await stageClient.query(`
      SELECT COUNT(*) as total,
             SUM(amount) as total_amount
      FROM sale_payments
    `);
    console.log(`\nSale Payments:`);
    console.log(`  Total records: ${paymentsCheck.rows[0].total}`);
    console.log(`  Total amount: ₹${parseFloat(paymentsCheck.rows[0].total_amount || 0).toFixed(2)}`);

    // Check godown_sale_payments
    const godownPaymentsCheck = await stageClient.query(`
      SELECT COUNT(*) as total,
             SUM(amount) as total_amount
      FROM godown_sale_payments
    `);
    console.log(`\nGodown Sale Payments:`);
    console.log(`  Total records: ${godownPaymentsCheck.rows[0].total}`);
    console.log(`  Total amount: ₹${parseFloat(godownPaymentsCheck.rows[0].total_amount || 0).toFixed(2)}`);

    await stageClient.end();
    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await stageClient.end();
    process.exit(1);
  }
}

verifyData();
