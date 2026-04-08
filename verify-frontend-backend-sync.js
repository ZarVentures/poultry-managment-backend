const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyFrontendBackendSync() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 VERIFYING FRONTEND-BACKEND SYNCHRONIZATION\n');
    console.log('=' .repeat(80));

    // Define what frontend expects for each table
    const frontendExpectations = {
      users: ['id', 'name', 'email', 'password', 'phone', 'role', 'status', 'notes', 'lastLogin', 'createdAt', 'updatedAt'],
      farmers: ['id', 'name', 'ownerName', 'phone', 'address', 'status', 'notes', 'createdAt', 'updatedAt'],
      retailers: ['id', 'name', 'ownerName', 'phone', 'address', 'status', 'notes', 'createdAt', 'updatedAt'],
      vehicles: ['id', 'vehicleNumber', 'vehicleType', 'driverName', 'ownerName', 'phone', 'status', 'notes', 'createdAt', 'updatedAt'],
      purchase_orders: ['id', 'orderNumber', 'supplierName', 'orderDate', 'dueDate', 'status', 'totalAmount', 'grossAmount', 'netAmount', 'notes', 'transportCharges', 'loadingCharges', 'commission', 'otherCharges', 'weightShortage', 'mortalityDeduction', 'otherDeduction', 'createdAt', 'updatedAt'],
      purchase_order_items: ['id', 'purchaseOrderId', 'itemName', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'createdAt', 'updatedAt'],
      sales: ['id', 'invoiceNumber', 'customerName', 'saleDate', 'saleMode', 'productType', 'quantity', 'unit', 'unitPrice', 'totalAmount', 'grossAmount', 'netAmount', 'paymentStatus', 'amountReceived', 'notes', 'retailerId', 'transportCharges', 'loadingCharges', 'commission', 'otherCharges', 'weightShortage', 'mortalityDeduction', 'otherDeduction', 'createdAt', 'updatedAt'],
      expenses: ['id', 'expenseDate', 'expenseOwner', 'category', 'description', 'amount', 'paymentMethod', 'notes', 'createdAt', 'updatedAt'],
      inventory_items: ['id', 'itemType', 'itemName', 'quantity', 'unit', 'minimumStockLevel', 'currentStockLevel', 'notes', 'createdAt', 'updatedAt', 'lastUpdated'],
      godown_inward_entries: ['id', 'entryDate', 'purchaseInvoiceNo', 'supplierName', 'numberOfBirds', 'averageWeight', 'totalWeight', 'ratePerKg', 'totalAmount', 'notes', 'createdAt', 'updatedAt'],
      godown_sales: ['id', 'saleDate', 'customerName', 'quantity', 'unit', 'rate', 'totalAmount', 'notes', 'createdAt', 'updatedAt'],
      godown_mortality: ['id', 'mortalityDate', 'quantity', 'unit', 'reason', 'notes', 'createdAt', 'updatedAt'],
      godown_expenses: ['id', 'expenseDate', 'category', 'description', 'amount', 'notes', 'createdAt', 'updatedAt'],
    };

    let allGood = true;

    for (const [tableName, expectedColumns] of Object.entries(frontendExpectations)) {
      console.log(`\n📋 Checking table: ${tableName}`);
      console.log('-'.repeat(80));

      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);

      if (!tableCheck.rows[0].exists) {
        console.log(`❌ TABLE MISSING: ${tableName}`);
        allGood = false;
        continue;
      }

      // Get actual columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      const actualColumns = columnsResult.rows.map(row => row.column_name);
      
      // Check for missing columns
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));

      if (missingColumns.length > 0) {
        console.log(`❌ MISSING COLUMNS in ${tableName}:`);
        missingColumns.forEach(col => console.log(`   - ${col}`));
        allGood = false;
      }

      if (extraColumns.length > 0) {
        console.log(`ℹ️  EXTRA COLUMNS in ${tableName} (not used in frontend):`);
        extraColumns.forEach(col => console.log(`   - ${col}`));
      }

      if (missingColumns.length === 0 && extraColumns.length === 0) {
        console.log(`✅ All columns match (${actualColumns.length} columns)`);
      } else if (missingColumns.length === 0) {
        console.log(`✅ All required columns present`);
      }

      // Show column details
      console.log(`\n   Column Details:`);
      columnsResult.rows.forEach(row => {
        const isMissing = !expectedColumns.includes(row.column_name);
        const prefix = isMissing ? '   [EXTRA]' : '   ';
        console.log(`${prefix} ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    if (allGood) {
      console.log('✅ ALL TABLES AND COLUMNS ARE IN SYNC!');
    } else {
      console.log('❌ SOME TABLES OR COLUMNS ARE MISSING - PLEASE FIX!');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyFrontendBackendSync();

