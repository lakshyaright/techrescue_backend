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
- Firewall rule allowing internal Azure VNet traffic (or Azure services flag set to ON).
- Connection string with mandatory SSL parameter (`?sslmode=require`).

---

## 🛠 2. Step-by-Step Manual Deployment on Backend VM

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
# Add NodeSource official repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js and NPM
sudo apt install -y nodejs

# Verify versions
node -v   # Should output v20.x.x
npm -v    # Should output 10.x.x
```

### Step 4: Clone Repository & Setup Permissions
```bash
# Create application root directory
sudo mkdir -p /var/www/techrescue-backend
sudo chown -R $USER:$USER /var/www/techrescue-backend

# Clone backend repository
git clone https://github.com/lakshyaright/techrescue_backend.git /var/www/techrescue-backend
cd /var/www/techrescue-backend
```

### Step 5: Install Production Dependencies
```bash
npm install --production
```

### Step 6: Configure Environment Variables
```bash
# Copy template environment file
cp .env.example .env

# Edit configuration file
nano .env
```

Configure your production environment variables in `.env`:
```env
# Server Port & Mode
PORT=5000
NODE_ENV=production

# Azure Database for PostgreSQL Flexible Server Connection
# Format: postgresql://<user>:<password>@<server-name>.postgres.database.azure.com:5432/<dbname>?sslmode=require
DATABASE_URL=postgresql://techrescue_admin:YourStrongPassword123!@techrescue-psql-prod.postgres.database.azure.com:5432/techrescue_db?sslmode=require

# Individual Connection Parameters (alternative to DATABASE_URL)
DB_HOST=techrescue-psql-prod.postgres.database.azure.com
DB_PORT=5432
DB_USER=techrescue_admin
DB_PASSWORD=YourStrongPassword123!
DB_NAME=techrescue_db
DB_SSL=true
DB_POOL_MAX=25

# Security & Authentication
JWT_SECRET=super_secret_techrescue_enterprise_jwt_key_2026_change_in_production
JWT_EXPIRES_IN=7d

# CORS Allowed Origin (Set to your Application Gateway domain / IP or *)
CORS_ORIGIN=*
```

### Step 7: Test Database Connectivity
Verify the backend VM can communicate with Azure PostgreSQL:
```bash
pg_isready -h techrescue-psql-prod.postgres.database.azure.com -p 5432 -U techrescue_admin
# Expected: techrescue-psql-prod.postgres.database.azure.com:5432 - accepting connections
```

### Step 8: Configure systemd Service for Node.js
Create the systemd service unit:
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
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start automatically on system boot
sudo systemctl enable techrescue-backend

# Start the service
sudo systemctl start techrescue-backend

# Verify status
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

## 🔍 3. Verification & Health Checks

Test the API locally on the Backend VM:
```bash
# 1. Base API Status
curl -i http://localhost:5000/
# Expected: HTTP/1.1 200 OK, {"name":"TechRescue Enterprise IT Support & Marketplace API","status":"ONLINE"}

# 2. Azure Application Gateway Health Probe check
curl -i http://localhost:5000/health
# Expected: HTTP/1.1 200 OK, {"status":"OK","database":"connected"}

# 3. Test Auth Endpoint
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahul.sharma@cloudarchitects.io","password":"password123"}'
```

---

## 🔄 4. How to Update Backend Code (CI/CD / Manual Pull)

When new commits are pushed:
```bash
cd /var/www/techrescue-backend
git pull origin main
npm install --production
sudo systemctl restart techrescue-backend
```

---

## 🛠 5. Service Management & Log Monitoring

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

---

## 🚨 6. Troubleshooting

| Symptom | Diagnostic Command | Solution |
| :--- | :--- | :--- |
| **Status: activating / failed** | `sudo journalctl -u techrescue-backend -n 50` | Check for syntax errors or invalid node path (`which node`). |
| **`database: reconnecting` on `/health`** | `psql "<DATABASE_URL>"` | Check Azure PostgreSQL firewall rules; ensure `sslmode=require` is present in the connection string. |
| **Gateway 502 Bad Gateway** | `curl -i http://localhost:5000/health` | Ensure Backend VM port 5000 is open in Azure NSG and UFW firewall. |
| **Port 5000 already in use** | `sudo lsof -i :5000` | Terminate any lingering orphaned node process via `sudo kill -9 <PID>`. |
