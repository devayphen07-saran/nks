const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/pos-db?schema=public"
});

async function addRolesColumns() {
  const client = await pool.connect();
  try {
    console.log('Adding user_roles and primary_role columns to user_session table...');

    // Add the columns
    await client.query(`
      ALTER TABLE user_session 
      ADD COLUMN IF NOT EXISTS user_roles text,
      ADD COLUMN IF NOT EXISTS primary_role varchar(50)
    `);

    console.log('✅ Columns added successfully!');
    
    // Verify columns were added
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'user_session'
        AND column_name IN ('user_roles', 'primary_role')
      ORDER BY column_name
    `);
    
    console.log('Verified columns:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

addRolesColumns();
