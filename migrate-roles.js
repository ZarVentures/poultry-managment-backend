const { Client } = require('pg');
require('dotenv').config({ path: '.env.staging' });

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database. Migrating role column...');

        // Change role column from ENUM to VARCHAR to support dynamic roles
        await client.query('ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50)');

        // We can also drop the enum type if it's no longer needed, 
        // but keeping it is safer to avoid breaking other dependencies if they exist.

        console.log('Migration successful: "role" column is now dynamic VARCHAR.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
