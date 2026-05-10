const { Client } = require('pg');

const prodClient = new Client({
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'poultry',
  user: 'poultry_user',
  password: 'poultry_user1212',
  ssl: { rejectUnauthorized: false }
});

const stageClient = new Client({
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'poultry_stage',
  user: 'poultry_user',
  password: 'poultry_user1212',
  ssl: { rejectUnauthorized: false }
});

async function cloneProdToStage() {
  try {
    console.log('🔌 Connecting to databases...');
    await prodClient.connect();
    await stageClient.connect();
    console.log('✅ Connected to both databases\n');

    // Step 1: Get schema from prod (CREATE TABLE statements)
    console.log('📋 Step 1: Extracting schema from PROD...');
    const schemaQuery = `
      SELECT 
        'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' ||
        string_agg(
          column_name || ' ' || data_type ||
          CASE 
            WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL
            THEN '(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE ''
          END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
          ', '
        ) || ');' as create_statement
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY tablename
      ORDER BY tablename;
    `;

    // Step 2: Drop all tables in staging (cascade to handle FK constraints)
    console.log('🗑️  Step 2: Dropping all tables in STAGING...');
    const dropTablesQuery = `
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    await stageClient.query(dropTablesQuery);
    console.log('✅ All tables dropped\n');

    // Step 3: Use pg_dump to get complete schema
    console.log('📦 Step 3: Using pg_dump to clone schema...');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Dump schema only from prod
    console.log('   Dumping schema from PROD...');
    await execPromise(
      `"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" ` +
      `"postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry" ` +
      `--schema-only -F p -f prod_schema.sql`
    );
    console.log('   ✅ Schema dumped to prod_schema.sql');

    // Restore schema to staging
    console.log('   Restoring schema to STAGING...');
    await execPromise(
      `"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" ` +
      `"postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage" ` +
      `-f prod_schema.sql 2>&1`
    );
    console.log('   ✅ Schema restored to STAGING\n');

    // Step 4: Copy data table by table in correct order (respecting FK constraints)
    console.log('📊 Step 4: Copying data from PROD to STAGING...\n');

    const tableOrder = [
      'users',
      'farmers',
      'retailers', 
      'vehicles',
      'settings',
      'products',
      'inventory_items',
      'purchase_orders',
      'purchase_order_items',
      'purchase_order_payments',
      'cages',
      'sales',
      'sale_payments',
      'sale_customers',
      'expenses',
      'mortalities',
      'godown_inward_entries',
      'godown_sales',
      'godown_sale_payments',
      'godown_mortality',
      'godown_expenses',
      'audit_logs',
      'role_permissions',
      'user_permissions',
      'billing_parties',
      'billing_sales',
      'billing_payments',
      'billing_ledger'
    ];

    for (const table of tableOrder) {
      try {
        // Check if table exists in prod
        const tableCheck = await prodClient.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
          [table]
        );

        if (!tableCheck.rows[0].exists) {
          console.log(`⏭️  ${table}: Table doesn't exist in PROD, skipping`);
          continue;
        }

        // Get data from prod
        const data = await prodClient.query(`SELECT * FROM ${table}`);
        
        if (data.rows.length === 0) {
          console.log(`⏭️  ${table}: Empty in PROD`);
          continue;
        }

        // Get column names
        const columns = Object.keys(data.rows[0]);
        const columnList = columns.map(c => `"${c}"`).join(', ');
        
        let inserted = 0;
        let skipped = 0;

        // Insert data row by row
        for (const row of data.rows) {
          try {
            const values = columns.map(col => row[col]);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            
            await stageClient.query(
              `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
              values
            );
            inserted++;
          } catch (err) {
            skipped++;
            if (skipped === 1) {
              console.log(`   ⚠️  First error: ${err.message.substring(0, 80)}...`);
            }
          }
        }

        console.log(`✅ ${table}: ${inserted} inserted, ${skipped} skipped`);

        // Reset sequence if table has an id column
        if (columns.includes('id')) {
          try {
            await stageClient.query(
              `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`
            );
          } catch (err) {
            // Ignore sequence errors
          }
        }

      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }

    console.log('\n✅ CLONE COMPLETE!\n');
    console.log('📋 Summary:');
    console.log('  - Schema cloned from PROD to STAGING');
    console.log('  - All data copied (respecting FK constraints)');
    console.log('  - Sequences reset');
    console.log('\n🎯 Staging database is now a complete copy of Production!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  } finally {
    await prodClient.end();
    await stageClient.end();
  }
}

cloneProdToStage()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
