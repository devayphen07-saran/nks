const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    'postgresql://postgres:postgres@localhost:5432/pos-db?schema=public',
});

async function rollbackMigration() {
  const client = await pool.connect();
  try {
    console.log(
      'Rolling back migration: removing roleHash and jwtToken columns...',
    );

    await client.query('DROP INDEX IF EXISTS idx_user_session_role_hash');
    await client.query(
      'ALTER TABLE user_session DROP COLUMN IF EXISTS role_hash',
    );
    await client.query(
      'ALTER TABLE user_session DROP COLUMN IF EXISTS jwt_token',
    );

    console.log('✅ Migration rolled back successfully!');
  } catch (err) {
    console.error('❌ Rollback failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

rollbackMigration();
