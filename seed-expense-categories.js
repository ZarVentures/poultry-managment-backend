const { Client } = require('pg');
require('dotenv').config({ path: 'BackEnd/.env.staging' });

const categories = [
    { name: 'Diesel (For Big Vehicle)', icon: 'fuel', description: 'Fuel expenses for large farm vehicles' },
    { name: 'Feed', icon: 'wheat', description: 'Poultry feed and supplements' },
    { name: 'Worker Salary', icon: 'banknote', description: 'Monthly salaries for farm workers' },
    { name: 'Shop Rent', icon: 'building', description: 'Monthly rent for retail shops/outlets' },
    { name: 'Electricity Bill', icon: 'zap', description: 'Utility bills for electricity' },
    { name: 'Petrol (For Two Wheelers)', icon: 'droplet', description: 'Fuel expenses for small delivery vehicles/bikes' },
    { name: 'Worker Incentive', icon: 'gift', description: 'Bonuses and incentives for workers' },
    { name: 'Stationary', icon: 'pen-tool', description: 'Office supplies and stationary' },
    { name: 'Cleaning', icon: 'brush', description: 'Cleaning supplies and services' },
    { name: 'Snacks (Chai, Samosa, etc.)', icon: 'coffee', description: 'Refreshments for staff and guests' },
    { name: 'Misc Expenses (Everything Else)', icon: 'more-horizontal', description: 'Other miscellaneous expenses' }
];

async function seed() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database. Seeding expense categories...');

        // Clear existing categories (optional, but ensures clean slate based on user request)
        // Check if we should delete or just merge. Given the request, let's ensure these are present.

        for (const cat of categories) {
            await client.query(
                `INSERT INTO expense_categories (name, icon, description, is_active, is_system) 
                 VALUES ($1, $2, $3, true, true) 
                 ON CONFLICT (name) DO UPDATE SET icon = $2, description = $3`,
                [cat.name, cat.icon, cat.description]
            );
            console.log(`Upserted category: ${cat.name}`);
        }

        console.log('Seeding successful.');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await client.end();
    }
}

seed();
