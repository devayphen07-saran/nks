const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/pos-db?schema=public"
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    const migrationFile = path.join(__dirname, 'src/core/database/migrations/005_add_jwt_and_role_hash_to_session.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Applying migration: 005_add_jwt_and_role_hash_to_session.sql');
    await client.query(sql);
    console.log('✅ Migration applied successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

applyMigration();
