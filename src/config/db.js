const { Pool } = require('pg');
require('dotenv').config();

// Determine SSL requirements (mandatory for Azure Database for PostgreSQL Flexible Server)
const isProduction = process.env.NODE_ENV === 'production';
const isAzure = (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres.database.azure.com')) ||
                (process.env.DB_HOST && process.env.DB_HOST.includes('postgres.database.azure.com'));
const useSSL = process.env.DB_SSL === 'true' || isAzure || (isProduction && process.env.DB_SSL !== 'false');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'techrescue_user',
      password: process.env.DB_PASSWORD || 'techrescue_pass',
      database: process.env.DB_NAME || 'techrescue_db',
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  // connection established to PostgreSQL
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
