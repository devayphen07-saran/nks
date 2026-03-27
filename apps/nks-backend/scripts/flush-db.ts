import 'dotenv/config';
import { Client } from 'pg';

async function flush() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🗑️  Performing deep flush of database...');
    
    // Drop schemas if they exist
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
    
    // Recreate public schema
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;'); // Just in case
    await client.query('COMMENT ON SCHEMA public IS \'standard public schema\';');
    
    // Verify it's empty
    const relRes = await client.query(`
      SELECT n.nspname as schema, c.relname as relation
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema');
    `);
    
    if (relRes.rows.length === 0) {
      console.log('✅ Database is completely empty.');
    } else {
      console.log('⚠️  Warning: Database still has relations:');
      relRes.rows.forEach(row => console.log(`  - ${row.schema}.${row.relation}`));
    }
    
  } catch (err: any) {
    console.error('❌ Flush failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

flush();
