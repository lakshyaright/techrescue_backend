const { Pool } = require('pg');
require('dotenv').config();

// Determine SSL requirements (mandatory for Supabase, Azure Database for PostgreSQL, and Cloud hosts)
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const isSupabase = (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('supabase.co') || process.env.DATABASE_URL.includes('supabase.com') || process.env.DATABASE_URL.includes('pooler.supabase.com'))) ||
                   (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase.co') || process.env.DB_HOST.includes('supabase.com')));
const isAzure = (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres.database.azure.com')) ||
                (process.env.DB_HOST && process.env.DB_HOST.includes('postgres.database.azure.com'));

const useSSL = process.env.DB_SSL === 'true' || isSupabase || isAzure || (isProduction && process.env.DB_SSL !== 'false');

// Serverless environments like Vercel need a lean connection pool (max 3-5) to avoid exhausting Supabase pool limits
const maxConnections = parseInt(process.env.DB_POOL_MAX || (process.env.VERCEL ? '4' : '20'), 10);

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'postgres',
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  // connection established to PostgreSQL / Supabase
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL/Supabase client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
