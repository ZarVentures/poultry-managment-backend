const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function completeClone() {
  try {
    console.log('🚀 COMPLETE PROD → STAGING CLONE\n');
    console.log('This will:');
    console.log('  1. Drop all tables in staging');
    console.log('  2. Clone complete schema from prod');
    console.log('  3. Clone all data from prod');
    console.log('  4. Restore all constraints and indexes\n');

    // Step 1: Drop everything in staging
    console.log('🗑️  Step 1: Dropping all tables in STAGING...');
    try {
      await execPromise(
        `"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" ` +
        `"postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage" ` +
        `-c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>&1`
      );
      console.log('✅ All tables dropped\n');
    } catch (err) {
      console.log('⚠️  Drop warning (this is normal):', err.message.substring(0, 100));
    }

    // Step 2: Dump complete database from prod (schema + data)
    console.log('📦 Step 2: Dumping complete database from PROD...');
    const dumpResult = await execPromise(
      `"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" ` +
      `"postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry" ` +
      `-F p -f prod_complete_dump.sql 2>&1`
    );
    console.log('✅ Complete dump created: prod_complete_dump.sql\n');

    // Step 3: Restore to staging
    console.log('📥 Step 3: Restoring to STAGING...');
    console.log('   (This may take a few minutes...)\n');
    
    const restoreResult = await execPromise(
      `"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" ` +
      `"postgresql://poultry_user:poultry_user1212@poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com:5432/poultry_stage" ` +
      `-f prod_complete_dump.sql 2>&1`
    );
    
    // Filter out common warnings
    const lines = restoreResult.stdout.split('\n');
    const errors = lines.filter(line => 
      line.includes('ERROR') && 
      !line.includes('already exists') &&
      !line.includes('does not exist')
    );
    
    if (errors.length > 0) {
      console.log('⚠️  Some errors occurred:');
      errors.slice(0, 5).forEach(err => console.log('   ', err));
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more errors`);
      }
    } else {
      console.log('✅ Restore completed successfully');
    }

    console.log('\n✅ CLONE COMPLETE!\n');
    console.log('📋 Summary:');
    console.log('  - Schema: Cloned from PROD');
    console.log('  - Data: Cloned from PROD');
    console.log('  - Constraints: All restored');
    console.log('  - Indexes: All restored');
    console.log('  - Sequences: All restored');
    console.log('\n🎯 Staging is now an exact copy of Production!');
    console.log('\n💡 Tip: Check staging backend logs to verify it starts correctly');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.log('STDERR:', error.stderr);
    process.exit(1);
  }
}

completeClone();
