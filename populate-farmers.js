const { Client } = require('pg');
require('dotenv').config();

async function populateFarmers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Sample farmers data
    const farmers = [
      {
        name: 'Usman Tariq',
        phone: '+92-300-1234567',
        email: 'usman.tariq@example.com',
        address: 'Farm House, Village Chak 123, Faisalabad',
        status: 'active',
        notes: 'Regular supplier, good quality birds'
      },
      {
        name: 'Ahmed Ali',
        phone: '+92-301-9876543',
        email: 'ahmed.ali@example.com',
        address: 'Poultry Farm, Jhang Road, Faisalabad',
        status: 'active',
        notes: 'Large scale farmer'
      },
      {
        name: 'Muhammad Hassan',
        phone: '+92-302-5551234',
        email: 'hassan@example.com',
        address: 'Village Samundri, District Faisalabad',
        status: 'active',
        notes: 'Broiler specialist'
      },
      {
        name: 'Bilal Khan',
        phone: '+92-303-7778888',
        email: 'bilal.khan@example.com',
        address: 'Chak 456, Jaranwala Road',
        status: 'active',
        notes: 'New supplier'
      },
      {
        name: 'Imran Malik',
        phone: '+92-304-9991111',
        email: 'imran.malik@example.com',
        address: 'Farm 789, Satiana Road, Faisalabad',
        status: 'active',
        notes: 'Premium quality birds'
      },
      {
        name: 'Kashif Mehmood',
        phone: '+92-305-2223333',
        email: 'kashif@example.com',
        address: 'Village Tandlianwala, Faisalabad',
        status: 'active',
        notes: 'Reliable supplier'
      },
      {
        name: 'Tariq Hussain',
        phone: '+92-306-4445555',
        email: 'tariq.hussain@example.com',
        address: 'Poultry Complex, Sargodha Road',
        status: 'active',
        notes: 'Bulk supplier'
      },
      {
        name: 'Nadeem Abbas',
        phone: '+92-307-6667777',
        email: 'nadeem@example.com',
        address: 'Farm House, Gojra Road, Faisalabad',
        status: 'active',
        notes: 'Good payment history'
      }
    ];

    console.log('\n📝 Inserting farmers...\n');

    for (const farmer of farmers) {
      // Check if farmer already exists
      const checkResult = await client.query(
        'SELECT id FROM farmers WHERE phone = $1',
        [farmer.phone]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⚠️  Farmer ${farmer.name} already exists (phone: ${farmer.phone})`);
        continue;
      }

      // Insert farmer
      const result = await client.query(
        `INSERT INTO farmers (name, phone, email, address, status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, name`,
        [farmer.name, farmer.phone, farmer.email, farmer.address, farmer.status, farmer.notes]
      );

      console.log(`✅ Added: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    }

    // Show total count
    const countResult = await client.query('SELECT COUNT(*) FROM farmers');
    console.log(`\n✅ Total farmers in database: ${countResult.rows[0].count}`);

    // Show all farmers
    const allFarmers = await client.query('SELECT id, name, phone, address, status FROM farmers ORDER BY name');
    console.log('\n📋 All Farmers:');
    console.log('─'.repeat(80));
    allFarmers.rows.forEach(f => {
      console.log(`${f.id.padEnd(5)} | ${f.name.padEnd(20)} | ${f.phone.padEnd(18)} | ${f.status}`);
    });
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

populateFarmers().catch(console.error);

