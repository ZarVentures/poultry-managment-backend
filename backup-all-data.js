const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function backupAllData() {
  console.log('📦 BACKING UP ALL DATABASE DATA');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupDir = path.join(__dirname, `database-backup-${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    console.log(`📁 Backup directory: ${backupDir}\n`);

    // List of all tables to backup
    const tables = [
      'users',
      'farmers',
      'retailers',
      'vehicles',
      'inventory',
      'purchase_orders',
      'purchase_order_items',
      'purchase_order_cages',
      'sales',
      'expenses',
      'mortalities',
      'godown_inward',
      'godown_sales',
      'godown_mortality',
      'godown_expenses',
      'settings'
    ];

    let totalRecords = 0;

    // Backup each table
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT * FROM ${table}`);
        const data = result.rows;
        
        // Save to JSON file
        const filename = path.join(backupDir, `${table}.json`);
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        
        console.log(`✅ ${table.padEnd(25)} - ${data.length} records backed up`);
        totalRecords += data.length;
      } catch (error) {
        console.log(`⚠️  ${table.padEnd(25)} - Table not found or error: ${error.message}`);
      }
    }

    // Create a summary file
    const summary = {
      backupDate: new Date().toISOString(),
      totalTables: tables.length,
      totalRecords: totalRecords,
      tables: tables
    };
    
    fs.writeFileSync(
      path.join(backupDir, '_backup_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n' + '='.repeat(70));
    console.log(`✅ BACKUP COMPLETE`);
    console.log(`📊 Total Records: ${totalRecords}`);
    console.log(`📁 Location: ${backupDir}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

backupAllData();

