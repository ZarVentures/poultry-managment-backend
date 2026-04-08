require('dotenv').config();
const { Client } = require('pg');

async function checkGodownTables() {
  const databaseUrl = process.env.DATABASE_URL;
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }, // AWS RDS requires SSL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if godown tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'godown%'
      ORDER BY table_name;
    `);

    console.log('📋 Godown Tables:');
    if (tableCheck.rows.length === 0) {
      console.log('   ❌ No godown tables found!');
      console.log('\n   Creating godown tables...\n');
      
      // Create godown tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS godown_inward_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "entryDate" DATE NOT NULL,
          "farmerName" VARCHAR(255) NOT NULL,
          "vehicleNumber" VARCHAR(100),
          quantity DECIMAL(10,2) NOT NULL,
          unit VARCHAR(50) NOT NULL DEFAULT 'kg',
          rate DECIMAL(10,2) NOT NULL,
          "totalAmount" DECIMAL(10,2) NOT NULL,
          notes TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('   ✅ Created godown_inward_entries');

      await client.query(`
        CREATE TABLE IF NOT EXISTS godown_sales (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "saleDate" DATE NOT NULL,
          "customerName" VARCHAR(255) NOT NULL,
          quantity DECIMAL(10,2) NOT NULL,
          unit VARCHAR(50) NOT NULL DEFAULT 'kg',
          rate DECIMAL(10,2) NOT NULL,
          "totalAmount" DECIMAL(10,2) NOT NULL,
          notes TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('   ✅ Created godown_sales');

      await client.query(`
        CREATE TABLE IF NOT EXISTS godown_mortality (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "mortalityDate" DATE NOT NULL,
          quantity DECIMAL(10,2) NOT NULL,
          unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
          reason VARCHAR(255),
          notes TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('   ✅ Created godown_mortality');

      await client.query(`
        CREATE TABLE IF NOT EXISTS godown_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "expenseDate" DATE NOT NULL,
          category VARCHAR(100),
          description VARCHAR(255) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          notes TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('   ✅ Created godown_expenses');

      console.log('\n✅ All godown tables created successfully!');
    } else {
      tableCheck.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
      
      // Check row counts
      console.log('\n📊 Row Counts:');
      for (const row of tableCheck.rows) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
        console.log(`   ${row.table_name}: ${countResult.rows[0].count} rows`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkGodownTables();
