# TechRescue Backend API — Production Deployment & Manual VM Setup Guide

This guide provides step-by-step manual deployment instructions for running the **TechRescue Node.js Express REST API** on a dedicated **Azure Linux Virtual Machine (Ubuntu 22.04 LTS)** managed by **systemd**, connected to an **Azure Database for PostgreSQL Flexible Server**, and fronted by an **Azure Application Gateway**.

---

## 📋 1. Prerequisites

### Azure Virtual Machine Sizing
- **VM Name**: `techrescue-vm-backend`
- **Recommended SKU**: `Standard_B2ms` (2 vCPUs, 8 GiB RAM) or `Standard_B2s` (2 vCPUs, 4 GiB RAM)
- **Operating System**: Ubuntu 22.04 LTS (x64)
- **Disk Size**: 30 GiB Standard SSD

### Network Security Group (NSG) Inbound Rules
Configure the following inbound rules on the Backend VM NSG (`techrescue-backend-nsg`):
| Priority | Name | Port | Protocol | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100** | `Allow-SSH` | `22` | TCP | Admin IP / Bastion | Secure SSH Administration |
| **110** | `Allow-API-AppGateway` | `5000` | TCP | `AppGatewaySubnet` (`10.0.0.0/24`) | API Traffic & Health Probes from Gateway |
| **120** | `Allow-API-FrontendVM` | `5000` | TCP | `FrontendSubnet` (`10.0.1.0/24`) | Direct Nginx Proxy calls from Frontend VM |

### Database Requirement
- **Azure Database for PostgreSQL Flexible Server** running version 16.
- Firewall rule allowing internal Azure VNet traffic (`0.0.0.0`).
- Connection string with mandatory SSL parameter (`?sslmode=require`).

---

## 🔌 2. How Backend Connects to Azure PostgreSQL Database

### Step A: Configure the Connection String
Inside `/var/www/techrescue-backend/.env`, set the `DATABASE_URL`:
```env
DATABASE_URL=postgresql://techrescue_admin:YourStrongPassword123!@techrescue-psql-prod.postgres.database.azure.com:5432/techrescue_db?sslmode=require
```

### Step B: Run the Database Connectivity Test
We have provided an automated connectivity test script. Run this on the backend VM:
```bash
npm run db:test
```
**What this script does:**
1. Tests TCP network handshake and TLS/SSL certificate negotiation with Azure PostgreSQL.
2. Checks database latency and fetches server version & current timestamp.
3. Inspects table schemas and outputs current table and record counts.

### Step C: Initialize Tables & Seed Data Automatically
If you haven't created the tables yet via `psql`, initialize the entire database with a single command:
```bash
npm run db:init
```
**What this script does:**
- Creates all required enums (`user_role`, `ticket_status`, `ticket_priority`, `escrow_status`).
- Creates all 8 relational tables (`users`, `user_skills`, `queries`, `work_logs`, `chat_messages`, `payments`, `activity_logs`).
- Creates performance indexes and inserts sample enterprise records (Sonu Patel, Rahul Sharma, Rajesh Kumar, Lakshya).

---

## 🛠 3. Step-by-Step Manual Deployment on Backend VM

### Step 1: Connect to the Backend VM
```bash
ssh azureuser@<BACKEND_VM_PUBLIC_IP_OR_BASTION>
```

### Step 2: Update System & Install Required Utilities
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw postgresql-client
```

### Step 3: Install Node.js 20.x LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # Should output v20.x.x
npm -v    # Should output 10.x.x
```

### Step 4: Clone Repository & Setup Permissions
```bash
sudo mkdir -p /var/www/techrescue-backend
sudo chown -R $USER:$USER /var/www/techrescue-backend

git clone https://github.com/lakshyaright/techrescue_backend.git /var/www/techrescue-backend
cd /var/www/techrescue-backend
```

### Step 5: Install Production Dependencies
```bash
npm install --production
```

### Step 6: Configure Environment Variables
```bash
cp .env.example .env
nano .env
```

Configure `.env`:
```env
PORT=5000
NODE_ENV=production

# Azure Database for PostgreSQL Flexible Server Connection
DATABASE_URL=postgresql://techrescue_admin:YourStrongPassword123!@techrescue-psql-prod.postgres.database.azure.com:5432/techrescue_db?sslmode=require

# Security & Authentication
JWT_SECRET=super_secret_techrescue_enterprise_jwt_key_2026_change_in_production
JWT_EXPIRES_IN=7d

# CORS Allowed Origin
CORS_ORIGIN=*
```

### Step 7: Verify Database Connection & Initialize
```bash
npm run db:test
npm run db:init
```

### Step 8: Configure systemd Service for Node.js
Create the service unit file:
```bash
sudo nano /etc/systemd/system/techrescue-backend.service
```

Paste the following service configuration:
```ini
[Unit]
Description=TechRescue Node.js Express REST API Service
After=network.target

[Service]
Type=simple
User=azureuser
WorkingDirectory=/var/www/techrescue-backend
ExecStart=/usr/bin/node /var/www/techrescue-backend/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=techrescue-backend

# Security Sandbox
NoNewPrivileges=true
ProtectSystem=full

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=5000
EnvironmentFile=-/var/www/techrescue-backend/.env

[Install]
WantedBy=multi-user.target
```

Enable, reload, and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable techrescue-backend
sudo systemctl start techrescue-backend
sudo systemctl status techrescue-backend
```

### Step 9: Configure Local Firewall (UFW)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 5000/tcp
sudo ufw --force enable
sudo ufw status
```

---

## 🔍 4. Verification & Health Checks

Test the API locally on the Backend VM:
```bash
# 1. Base API Status
curl -i http://localhost:5000/
# Expected: HTTP/1.1 200 OK, {"name":"TechRescue Enterprise IT Support & Marketplace API","status":"ONLINE"}

# 2. Azure Application Gateway Health Probe check
curl -i http://localhost:5000/health
# Expected: HTTP/1.1 200 OK, {"status":"OK","database":"connected"}

# 3. Test Queries API Endpoint
curl -i http://localhost:5000/api/v1/queries
# Expected: HTTP/1.1 200 OK with array of incident tickets from PostgreSQL
```

---

## 🌐 5. How Frontend Connects to this Backend

There are two production routing patterns:

### Pattern 1: Via Azure Application Gateway (Recommended)
1. **Application Gateway Listener**: Public IP Port 80/443.
2. **Routing Rule**:
   - `/*` $\rightarrow$ Frontend VM (`10.0.1.4:80`).
   - `/api/*` $\rightarrow$ Backend VM (`10.0.2.4:5000`).
3. **Frontend `.env`**: Set `VITE_API_URL=/api/v1`. The browser sends `/api/v1/...` to the Application Gateway, which transparently routes it to the Backend VM.

### Pattern 2: Via Nginx Reverse Proxy on Frontend VM
If not using path-based gateway routing:
1. In `/etc/nginx/sites-available/techrescue-frontend` on Frontend VM:
   ```nginx
   location /api/ {
       proxy_pass http://10.0.2.4:5000;
   }
   ```
2. Frontend `.env`: `VITE_API_URL=/api/v1`. Nginx on the Frontend VM forwards requests to the Backend VM private IP.

---

## 🛠 6. Service Management & Log Monitoring

```bash
# View live application logs
sudo journalctl -u techrescue-backend -f

# View last 100 log lines
sudo journalctl -u techrescue-backend -n 100 --no-pager

# Restart service
sudo systemctl restart techrescue-backend

# Stop service
sudo systemctl stop techrescue-backend
```
