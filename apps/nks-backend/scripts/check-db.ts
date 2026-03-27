import 'dotenv/config';
import { Client } from 'pg';

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
    // List all non-system schemas
    const schemaRes = await client.query(`
      SELECT nspname AS schema_name
      FROM pg_catalog.pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema';
    `);
    console.log('User schemas in database:');
    schemaRes.rows.forEach(row => console.log(`  - ${row.schema_name}`));
    
    // List all tables across these schemas
    const tableRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    console.log('\nTables across all schemas:');
    tableRes.rows.forEach(row => console.log(`  - ${row.table_schema}.${row.table_name}`));

    // Check for the conflicting relation specifically
    const relRes = await client.query(`
      SELECT n.nspname as schema, c.relname as relation
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'users_guuid_unique';
    `);
    if (relRes.rows.length > 0) {
      console.log('\n✅ Verified Unique Indexes:');
      relRes.rows.forEach(row => console.log(`  - ${row.schema}.${row.relation}`));
    } else {
      console.log('\n⚠️  Caution: Legitimate unique index "users_guuid_unique" missing from users table.');
    }

    // List all custom enums
    const enumRes = await client.query(`
      SELECT n.nspname as schema, t.typname as name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e';
    `);
    console.log('\nCustom Enums:');
    enumRes.rows.forEach(row => console.log(`  - ${row.schema}.${row.name}`));

  } catch (err: any) {
    console.error('❌ Check failed:', err.message);
  } finally {
    await client.end();
  }
}

check();
