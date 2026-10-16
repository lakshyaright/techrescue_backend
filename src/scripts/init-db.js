/**
 * TechRescue Database Schema & Seed Initializer
 * Automatically applies DDL tables and seed data to the configured PostgreSQL instance.
 * Run: npm run db:init
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const isAzure = (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres.database.azure.com')) ||
                (process.env.DB_HOST && process.env.DB_HOST.includes('postgres.database.azure.com'));
const useSSL = process.env.DB_SSL === 'true' || isAzure || (isProduction && process.env.DB_SSL !== 'false');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'techrescue_user',
        password: process.env.DB_PASSWORD || 'techrescue_pass',
        database: process.env.DB_NAME || 'techrescue_db',
        ssl: useSSL ? { rejectUnauthorized: false } : false,
      }
);

// Fallback embedded SQL if external files are not in folder
const DDL_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CLIENT', 'EXPERT', 'ENGINEER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM (
        'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'TRAVELING', 
        'ON_SITE', 'WAITING_FOR_CLIENT', 'RESOLVED', 
        'CLIENT_CONFIRMED', 'CLOSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE escrow_status AS ENUM ('ESCROW_HELD', 'RELEASED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    company VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    title VARCHAR(255),
    bio TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    reviews_count INT DEFAULT 0,
    hourly_rate NUMERIC(10, 2) DEFAULT 0,
    experience_years INT DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    completed_jobs_count INT DEFAULT 0,
    total_earnings NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_skills (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    CONSTRAINT unique_user_skill UNIQUE(user_id, skill)
);

CREATE TABLE IF NOT EXISTS queries (
    id VARCHAR(64) PRIMARY KEY,
    ticket_number VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100) NOT NULL,
    impact VARCHAR(50) NOT NULL,
    urgency VARCHAR(50) NOT NULL,
    priority ticket_priority NOT NULL,
    status ticket_status NOT NULL DEFAULT 'OPEN',
    client_id VARCHAR(64) REFERENCES users(id) ON DELETE RESTRICT,
    assigned_expert_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    assigned_engineer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    short_description TEXT NOT NULL,
    detailed_description TEXT NOT NULL,
    environment VARCHAR(100) NOT NULL,
    assignment_group VARCHAR(100) NOT NULL,
    engineer_location VARCHAR(255),
    estimated_cost NUMERIC(10, 2) NOT NULL,
    actual_cost NUMERIC(10, 2),
    is_escrow_funded BOOLEAN DEFAULT false,
    is_payment_released BOOLEAN DEFAULT false,
    sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    sla_breached BOOLEAN DEFAULT false,
    resolution_summary TEXT,
    preventive_measures TEXT,
    client_rating INT,
    client_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_client ON queries(client_id);
CREATE INDEX IF NOT EXISTS idx_queries_expert ON queries(assigned_expert_id);
CREATE INDEX IF NOT EXISTS idx_queries_engineer ON queries(assigned_engineer_id);

CREATE TABLE IF NOT EXISTS work_logs (
    id VARCHAR(64) PRIMARY KEY,
    query_id VARCHAR(64) REFERENCES queries(id) ON DELETE CASCADE,
    author_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    hours_spent NUMERIC(5, 2) NOT NULL,
    notes TEXT NOT NULL,
    is_diagnostic BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    query_id VARCHAR(64) REFERENCES queries(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    attachment_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_query ON chat_messages(query_id);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(64) REFERENCES queries(id) ON DELETE CASCADE,
    client_id VARCHAR(64) REFERENCES users(id) ON DELETE RESTRICT,
    payee_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    platform_fee NUMERIC(10, 2) NOT NULL,
    net_payout NUMERIC(10, 2) NOT NULL,
    status escrow_status NOT NULL DEFAULT 'ESCROW_HELD',
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(64) PRIMARY KEY,
    query_id VARCHAR(64) REFERENCES queries(id) ON DELETE SET NULL,
    ticket_number VARCHAR(64),
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role user_role NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const SEED_SQL = `
INSERT INTO users (id, name, email, password_hash, role, company, phone, location, title, bio, rating, reviews_count, hourly_rate, experience_years, verified, is_available, completed_jobs_count, total_earnings)
VALUES 
('usr-client-1', 'Sonu Patel', 'sonu.patel@fintechglobal.com', '$2a$10$abcdefghijklmnopqrstuvwxy12345678901234567890123456789012', 'CLIENT', 'FinTech Global Systems', '+91 98201 44521', 'Gurgaon, Haryana', 'Director of IT & Enterprise Infrastructure', 'VP of Infrastructure overseeing core banking gateways and hybrid multicloud environments.', 5.0, 0, 0, 15, true, true, 0, 0),
('usr-expert-1', 'Rahul Sharma', 'rahul.sharma@cloudarchitects.io', '$2a$10$abcdefghijklmnopqrstuvwxy12345678901234567890123456789012', 'EXPERT', 'Independent Cloud Consulting', '+91 99100 88231', 'Gurgaon, NCR', 'Principal Cloud & Network Architect', 'Former Tier-3 Data Center Architect specializing in enterprise hybrid cloud, Azure ExpressRoute migrations, and distributed zero-trust network design.', 4.8, 84, 1500.00, 12, true, true, 127, 85000.00),
('usr-expert-2', 'Priya Venkatesh', 'priya.v@securesolutions.org', '$2a$10$abcdefghijklmnopqrstuvwxy12345678901234567890123456789012', 'EXPERT', 'CyberDefense Partners', '+91 98450 77123', 'Bangalore, Karnataka', 'Enterprise Security & Compliance Lead', 'Lead security investigator specializing in rapid incident triage, ransomware mitigation, and corporate firewall policy audits.', 4.9, 62, 1800.00, 10, true, true, 96, 112000.00),
('usr-eng-1', 'Rajesh Kumar', 'rajesh.k@fieldtechrescue.in', '$2a$10$abcdefghijklmnopqrstuvwxy12345678901234567890123456789012', 'ENGINEER', 'Metro Field Engineering Network', '+91 97690 12345', 'Mumbai, Maharashtra', 'Senior On-Site Hardware & Cabling Engineer', 'Rapid dispatch field technician equipped with optical OTDR tester, Fluke Versiv certifier, and standard replacement power supplies/optics.', 4.8, 127, 850.00, 6, true, true, 127, 68500.00),
('usr-admin-1', 'Lakshya System Admin', 'admin@techrescue.io', '$2a$10$abcdefghijklmnopqrstuvwxy12345678901234567890123456789012', 'ADMIN', 'TechRescue Global Ops', '+91 11 4500 9000', 'Cyber City HQ, India', 'Operations Director & Super Admin', 'Global platform supervisor directing incident response protocols and escrow ledgers.', 5.0, 0, 0, 14, true, true, 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_skills (user_id, skill) VALUES
('usr-expert-1', 'Azure Infrastructure'),
('usr-expert-1', 'AWS Solutions'),
('usr-expert-1', 'Terraform'),
('usr-expert-1', 'Kubernetes'),
('usr-expert-1', 'Palo Alto Firewall'),
('usr-expert-1', 'BGP Routing'),
('usr-eng-1', 'Structured Cabling (Cat6a/Fiber)'),
('usr-eng-1', 'Cisco Catalyst 9300/9500'),
('usr-eng-1', 'Server Rack Integration'),
('usr-eng-1', 'Fluke Networks Certification')
ON CONFLICT DO NOTHING;

INSERT INTO queries (
    id, ticket_number, title, category, subcategory, impact, urgency, priority, status,
    client_id, assigned_expert_id, assigned_engineer_id,
    short_description, detailed_description, environment, assignment_group,
    estimated_cost, actual_cost, is_escrow_funded, is_payment_released,
    sla_deadline, sla_breached
) VALUES
('tkt-10231', 'INC-20261008-0001', 'Azure VM Connectivity & ExpressRoute Gateway Packet Drop', 'Cloud Infrastructure', 'Virtual Network & Peering', 'HIGH', 'HIGH', 'HIGH', 'IN_PROGRESS', 'usr-client-1', 'usr-expert-1', NULL, 'Core transaction cluster VMs in Azure Central India losing peer route packets intermittently through ExpressRoute gateway.', '4 production API worker nodes in vnet-fintech-prod encountering TCP resets when communicating with on-prem core SQL ledger. Ping drop rate is ~18% through ER circuit.', 'Azure Cloud', 'Cloud Operations', 4500.00, 4500.00, true, false, NOW() + INTERVAL '4 hours', false),
('tkt-10230', 'INC-20261008-0002', 'Core Cisco Catalyst 9300 Switch Stack Port Flapping in Mumbai DC', 'Hardware & Servers', 'Switching & Physical Cabling', 'ENTERPRISE', 'HIGH', 'CRITICAL', 'ON_SITE', 'usr-client-1', NULL, 'usr-eng-1', 'Stack cable on switch member #2 failing, causing flapping of uplinks to secondary core.', 'Physical StackWise-480 cable on Member 2 in Rack B-04 is showing CRC errors. Requires on-site replacement of stack jumper cable and inspection with optical power meter.', 'On-Premises Datacenter', 'Desktop & Hardware Engineering', 3800.00, 3800.00, true, false, NOW() + INTERVAL '2 hours', false),
('tkt-10232', 'INC-20261008-0004', 'Branch Office SD-WAN Edge Gateway Total Disconnect in Pune', 'Network & Firewall', 'SD-WAN & Edge Tunneling', 'HIGH', 'HIGH', 'HIGH', 'OPEN', 'usr-client-1', NULL, NULL, 'Fortinet FortiGate 60F lost IPsec tunnel to headquarters after primary ISP optical cut.', 'Failover LTE SIM card on WAN2 is not registering with local telecom APN. 45 employees at Pune branch office unable to access SAP or intranet banking applications.', 'Corporate Office LAN', 'Core Networking', 3500.00, NULL, true, false, NOW() + INTERVAL '4 hours', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, ticket_id, client_id, payee_id, amount, platform_fee, net_payout, status, invoice_number)
VALUES
('pay-101', 'tkt-10231', 'usr-client-1', 'usr-expert-1', 4500.00, 450.00, 4050.00, 'ESCROW_HELD', 'INV-TR-2026-0940'),
('pay-102', 'tkt-10230', 'usr-client-1', 'usr-eng-1', 3800.00, 380.00, 3420.00, 'ESCROW_HELD', 'INV-TR-2026-0938')
ON CONFLICT (id) DO NOTHING;
`;

async function initDatabase() {
  console.log('>>> Initializing TechRescue Database...');
  const client = await pool.connect();
  try {
    console.log('[1/2] Applying DDL Schema (Tables, Enums, Indexes)...');
    await client.query(DDL_SQL);
    console.log('✅ Schema tables created successfully!');

    console.log('[2/2] Loading Enterprise Seed Data...');
    await client.query(SEED_SQL);
    console.log('✅ Seed data inserted successfully!');

    const res = await client.query('SELECT count(*) as user_count FROM users');
    const qRes = await client.query('SELECT count(*) as query_count FROM queries');
    console.log(`\n🎉 Database initialized! Users: ${res.rows[0].user_count}, Queries: ${qRes.rows[0].query_count}`);
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
