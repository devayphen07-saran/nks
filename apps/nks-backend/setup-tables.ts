import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function setup() {
  try {
    // Create administrative_division table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS administrative_division (
        id bigserial PRIMARY KEY,
        guuid uuid NOT NULL DEFAULT gen_random_uuid(),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp,
        sort_order integer DEFAULT 0,
        is_hidden boolean NOT NULL DEFAULT false,
        is_system boolean NOT NULL DEFAULT false,
        division_name varchar(100) NOT NULL,
        division_code varchar(20),
        division_type varchar(50) NOT NULL DEFAULT 'DISTRICT',
        description varchar(255),
        state_region_province_fk bigint REFERENCES state_region_province(id) ON DELETE RESTRICT,
        country_fk bigint NOT NULL REFERENCES country(id) ON DELETE RESTRICT,
        created_by bigint REFERENCES users(id),
        modified_by bigint REFERENCES users(id),
        deleted_by bigint REFERENCES users(id)
      )
    `);
    
    // Create postal_code table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS postal_code (
        id bigserial PRIMARY KEY,
        guuid uuid NOT NULL DEFAULT gen_random_uuid(),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp,
        sort_order integer DEFAULT 0,
        is_hidden boolean NOT NULL DEFAULT false,
        is_system boolean NOT NULL DEFAULT false,
        code varchar(20) NOT NULL,
        city_name varchar(100),
        administrative_division_fk bigint REFERENCES administrative_division(id),
        state_region_province_fk bigint REFERENCES state_region_province(id),
        country_fk bigint NOT NULL REFERENCES country(id) ON DELETE RESTRICT,
        created_by bigint REFERENCES users(id),
        modified_by bigint REFERENCES users(id),
        deleted_by bigint REFERENCES users(id)
      )
    `);

    // Create indexes
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS admin_div_name_state_idx ON administrative_division (division_name, state_region_province_fk) WHERE state_region_province_fk IS NOT NULL AND deleted_at IS NULL`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS admin_div_name_country_idx ON administrative_division (division_name, country_fk) WHERE state_region_province_fk IS NULL AND deleted_at IS NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS admin_div_state_idx ON administrative_division (state_region_province_fk)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS admin_div_country_idx ON administrative_division (country_fk)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS admin_div_type_idx ON administrative_division (division_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS postal_code_division_idx ON postal_code (administrative_division_fk)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS postal_code_state_idx ON postal_code (state_region_province_fk)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS postal_code_country_idx ON postal_code (country_fk)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS postal_code_code_idx ON postal_code (code) WHERE deleted_at IS NULL`);

    console.log('✅ Tables created successfully');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

setup();
