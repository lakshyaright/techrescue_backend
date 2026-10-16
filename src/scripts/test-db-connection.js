/**
 * TechRescue Database Connectivity Diagnostic Script
 * Tests connection to PostgreSQL / Azure Database for PostgreSQL Flexible Server
 * Run: npm run db:test
 */

require('dotenv').config();
const { Pool } = require('pg');

console.log('========================================================================');
console.log('>>> TECHRESCUE DATABASE CONNECTION TEST');
console.log('========================================================================');

const isProduction = process.env.NODE_ENV === 'production';
const isAzure = (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres.database.azure.com')) ||
                (process.env.DB_HOST && process.env.DB_HOST.includes('postgres.database.azure.com'));
const useSSL = process.env.DB_SSL === 'true' || isAzure || (isProduction && process.env.DB_SSL !== 'false');

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`SSL Mode: ${useSSL ? 'Enabled (rejectUnauthorized: false)' : 'Disabled'}`);
if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log(`Connection URL: ${masked}`);
} else {
  console.log(`Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
  console.log(`User: ${process.env.DB_USER || 'techrescue_user'}`);
  console.log(`Database: ${process.env.DB_NAME || 'techrescue_db'}`);
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'techrescue_user',
      password: process.env.DB_PASSWORD || 'techrescue_pass',
      database: process.env.DB_NAME || 'techrescue_db',
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

async function runTest() {
  const start = Date.now();
  try {
    console.log('\n[1/3] Attempting TCP handshake and authentication...');
    const client = await pool.connect();
    const duration = Date.now() - start;
    console.log(`✅ Handshake successful in ${duration}ms!`);

    console.log('\n[2/3] Querying PostgreSQL server version & timestamp...');
    const versionRes = await client.query('SELECT version(), NOW() as server_time, current_database() as db_name');
    console.log(`✅ Server Database: ${versionRes.rows[0].db_name}`);
    console.log(`✅ Server Time:     ${versionRes.rows[0].server_time}`);
    console.log(`✅ PostgreSQL:      ${versionRes.rows[0].version.split(' on ')[0]}`);

    console.log('\n[3/3] Inspecting TechRescue database tables...');
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    if (tableRes.rows.length === 0) {
      console.log('⚠️  No tables found in public schema. Run `npm run db:init` to create tables and load seed data.');
    } else {
      console.log(`✅ Found ${tableRes.rows.length} tables in database:`);
      tableRes.rows.forEach(r => console.log(`   - ${r.table_name}`));

      // Check counts of users and queries if they exist
      const userCountRes = await client.query('SELECT count(*) FROM users').catch(() => ({ rows: [{ count: 0 }] }));
      const queryCountRes = await client.query('SELECT count(*) FROM queries').catch(() => ({ rows: [{ count: 0 }] }));
      console.log(`\n📊 Data Summary: ${userCountRes.rows[0].count} users, ${queryCountRes.rows[0].count} incident tickets.`);
    }

    client.release();
    await pool.end();

    console.log('\n========================================================================');
    console.log('🎉 SUCCESS: Backend is fully connected to the PostgreSQL database!');
    console.log('========================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DATABASE CONNECTION FAILED:');
    console.error(err.message);
    console.log('\n🔍 Troubleshooting Tips:');
    console.log('1. If "ETIMEDOUT": Check Azure PostgreSQL firewall rules. Ensure "AllowAllAzureServicesAndVMs" (0.0.0.0) or your VM IP is allowed.');
    console.log('2. If "password authentication failed": Verify DB_USER and DB_PASSWORD in backend/.env.');
    console.log('3. If "SSL/TLS required": Ensure ?sslmode=require is in DATABASE_URL or set DB_SSL=true.');
    console.log('========================================================================\n');
    process.exit(1);
  }
}

runTest();
