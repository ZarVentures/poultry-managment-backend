const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createPermissionsTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating user_permissions table...\n');

    // Create the user_permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_name VARCHAR(100) NOT NULL,
        resource VARCHAR(50) NOT NULL,
        can_create BOOLEAN DEFAULT FALSE,
        can_read BOOLEAN DEFAULT TRUE,
        can_update BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, resource)
      );
    `);

    console.log('✅ user_permissions table created successfully!');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_permissions_resource ON user_permissions(resource);
    `);

    console.log('✅ Indexes created successfully!');

    // Create role_permissions table for default role-based permissions
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id BIGSERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL,
        resource VARCHAR(50) NOT NULL,
        can_create BOOLEAN DEFAULT FALSE,
        can_read BOOLEAN DEFAULT TRUE,
        can_update BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE(role, resource)
      );
    `);

    console.log('✅ role_permissions table created successfully!');

    // Insert default role permissions
    await client.query(`
      INSERT INTO role_permissions (role, resource, can_create, can_read, can_update, can_delete)
      VALUES 
        -- Admin has full access to everything
        ('admin', 'users', true, true, true, true),
        ('admin', 'farmers', true, true, true, true),
        ('admin', 'retailers', true, true, true, true),
        ('admin', 'vehicles', true, true, true, true),
        ('admin', 'purchases', true, true, true, true),
        ('admin', 'sales', true, true, true, true),
        ('admin', 'expenses', true, true, true, true),
        ('admin', 'inventory', true, true, true, true),
        ('admin', 'godown', true, true, true, true),
        ('admin', 'godowns', true, true, true, true),
        ('admin', 'settings', true, true, true, true),
        
        -- Manager has most access except user management
        ('manager', 'users', false, true, false, false),
        ('manager', 'farmers', true, true, true, true),
        ('manager', 'retailers', true, true, true, true),
        ('manager', 'vehicles', true, true, true, true),
        ('manager', 'purchases', true, true, true, true),
        ('manager', 'sales', true, true, true, true),
        ('manager', 'expenses', true, true, true, true),
        ('manager', 'inventory', true, true, true, true),
        ('manager', 'godown', true, true, true, true),
        ('manager', 'godowns', true, true, true, true),
        ('manager', 'settings', false, true, false, false),
        
        -- Staff has limited access
        ('staff', 'users', false, true, false, false),
        ('staff', 'farmers', false, true, true, false),
        ('staff', 'retailers', false, true, true, false),
        ('staff', 'vehicles', false, true, false, false),
        ('staff', 'purchases', true, true, true, false),
        ('staff', 'sales', true, true, true, false),
        ('staff', 'expenses', true, true, true, false),
        ('staff', 'inventory', false, true, true, false),
        ('staff', 'godown', true, true, true, false),
        ('staff', 'godowns', false, true, false, false),
        ('staff', 'settings', false, true, false, false)
      ON CONFLICT (role, resource) DO NOTHING;
    `);

    console.log('✅ Default role permissions inserted!');

    // Show permissions summary
    const permissionsSummary = await client.query(`
      SELECT 
        role,
        COUNT(*) as total_resources,
        SUM(CASE WHEN can_create THEN 1 ELSE 0 END) as can_create_count,
        SUM(CASE WHEN can_update THEN 1 ELSE 0 END) as can_update_count,
        SUM(CASE WHEN can_delete THEN 1 ELSE 0 END) as can_delete_count
      FROM role_permissions
      GROUP BY role
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'manager' THEN 2 
          WHEN 'staff' THEN 3 
        END;
    `);

    console.log('\n📊 Permissions Summary by Role:');
    console.log('─'.repeat(80));
    console.log('Role'.padEnd(15) + 'Resources'.padEnd(15) + 'Create'.padEnd(15) + 'Update'.padEnd(15) + 'Delete');
    console.log('─'.repeat(80));
    permissionsSummary.rows.forEach(row => {
      console.log(
        row.role.padEnd(15) + 
        row.total_resources.toString().padEnd(15) + 
        row.can_create_count.toString().padEnd(15) + 
        row.can_update_count.toString().padEnd(15) + 
        row.can_delete_count.toString()
      );
    });

    // Show detailed permissions for each role
    console.log('\n📋 Detailed Permissions:');
    const detailedPerms = await client.query(`
      SELECT role, resource, can_create, can_read, can_update, can_delete
      FROM role_permissions
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'manager' THEN 2 
          WHEN 'staff' THEN 3 
        END,
        resource;
    `);

    let currentRole = '';
    detailedPerms.rows.forEach(row => {
      if (row.role !== currentRole) {
        currentRole = row.role;
        console.log(`\n${row.role.toUpperCase()}:`);
        console.log('─'.repeat(80));
      }
      const perms = [];
      if (row.can_create) perms.push('CREATE');
      if (row.can_read) perms.push('READ');
      if (row.can_update) perms.push('UPDATE');
      if (row.can_delete) perms.push('DELETE');
      console.log(`  ${row.resource.padEnd(20)} → ${perms.join(', ')}`);
    });

    console.log('\n✅ Permissions system setup complete!');

  } catch (error) {
    console.error('❌ Error creating permissions tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createPermissionsTable();

