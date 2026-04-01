const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/pos-db?schema=public"
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_session'
      ORDER BY ordinal_position
    `);

    console.log('Columns in user_session table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Check for specific columns
    const roleHashExists = result.rows.find(r => r.column_name === 'role_hash');
    const jwtTokenExists = result.rows.find(r => r.column_name === 'jwt_token');

    console.log('\n' + (roleHashExists ? '✅' : '❌') + ' role_hash column exists');
    console.log((jwtTokenExists ? '✅' : '❌') + ' jwt_token column exists');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    await pool.end();
  }
}

checkColumns();
