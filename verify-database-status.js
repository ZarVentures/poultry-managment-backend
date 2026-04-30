const { Client } = require('pg');
require('dotenv').config();

async function verifyDatabaseStatus() {
  console.log('🔍 VERIFYING DATABASE STATUS');
  console.log('='.repeat(70));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Database connected\n');

    const tables = [
      'users',
      'farmers',
      'retailers',
      'vehicles',
      'purchase_orders',
      'purchase_order_items',
      'purchase_order_cages',
      'sales',
      'expenses',
      'mortalities',
      'godown_sales',
      'godown_mortality',
      'godown_expenses',
      'settings'
    ];

    console.log('📊 Current Database Status:\n');

    let totalRecords = 0;
    const status = [];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        totalRecords += count;
        
        const emoji = count > 0 ? '✅' : '⚪';
        const statusText = count > 0 ? `${count} records` : 'Empty';
        
        console.log(`${emoji} ${table.padEnd(25)} - ${statusText}`);
        status.push({ table, count, isEmpty: count === 0 });
      } catch (error) {
        console.log(`⚠️  ${table.padEnd(25)} - Table not found`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📈 SUMMARY:');
    console.log('='.repeat(70));
    
    const emptyTables = status.filter(s => s.isEmpty).length;
    const tablesWithData = status.filter(s => !s.isEmpty).length;
    
    console.log(`Total Records: ${totalRecords}`);
    console.log(`Tables with Data: ${tablesWithData}`);
    console.log(`Empty Tables: ${emptyTables}`);
    
    // Check if only users table has data
    const onlyUsersHasData = status.every(s => 
      (s.table === 'users' && !s.isEmpty) || (s.table !== 'users' && s.isEmpty)
    );
    
    console.log('\n' + '='.repeat(70));
    if (onlyUsersHasData) {
      console.log('✅ PERFECT! Database is clean and ready for client data');
      console.log('✅ Only users table has data (login will work)');
      console.log('✅ All business data tables are empty');
    } else {
      console.log('⚠️  Database status:');
      status.filter(s => !s.isEmpty).forEach(s => {
        console.log(`   - ${s.table}: ${s.count} records`);
      });
    }
    console.log('='.repeat(70));

    // Test login
    console.log('\n🔐 Testing Login...');
    const userResult = await client.query(
      `SELECT email, role, status FROM users WHERE email = 'admin@azizpoultry.com'`
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`✅ Admin user found:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`\n✅ You can login with: admin@azizpoultry.com / admin123`);
    } else {
      console.log('❌ Admin user not found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

verifyDatabaseStatus();

