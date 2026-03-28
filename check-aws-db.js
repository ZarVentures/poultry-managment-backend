const { Client } = require('pg');

const config = {
  host: 'poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com',
  port: 5432,
  user: 'poultry_user',
  password: 'poultry_user1212',
  database: 'poultry',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

async function checkConnection() {
  const client = new Client(config);
  console.log('Connecting to AWS RDS...');
  console.log(`Host: ${config.host}`);
  console.log(`Database: ${config.database}`);
  console.log('');

  try {
    await client.connect();
    const res = await client.query('SELECT version(), current_database(), now()');
    const row = res.rows[0];
    console.log('✅ Connected successfully!');
    console.log(`   PostgreSQL: ${row.version.split(' ').slice(0, 2).join(' ')}`);
    console.log(`   Database:   ${row.current_database}`);
    console.log(`   Server time:${row.now}`);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('');
    console.error('Common causes:');
    console.error('  - RDS Security Group does not allow inbound on port 5432');
    console.error('  - RDS is not publicly accessible (set Publicly Accessible = Yes)');
    console.error('  - Wrong credentials');
    process.exit(1);
  }
}

checkConnection();
