#!/usr/bin/env bash
# ==============================================================================
# TECHRESCUE BACKEND VM PROVISIONING SCRIPT (UBUNTU 22.04 / 24.04 LTS)
# Run as root or with sudo: sudo bash setup-backend-vm.sh
# ==============================================================================

set -e

echo ">>> [1/6] Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl git build-essential ufw postgresql-client

echo ">>> [2/6] Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

echo ">>> [3/6] Setting up application directory..."
mkdir -p /var/www/techrescue/backend
chown -R azureuser:azureuser /var/www/techrescue

echo ">>> [4/6] Cloning / copying backend repository..."
cd /var/www/techrescue
if [ ! -d "/var/www/techrescue/.git" ]; then
    git clone https://github.com/lakshyaright/Techrescue_project.git .
fi

git pull origin main

cd /var/www/techrescue/backend
npm install --production

echo ">>> [5/6] Configuring Environment File..."
if [ ! -f "/var/www/techrescue/backend/.env" ]; then
    cp .env.example .env
    echo "NOTICE: Please edit /var/www/techrescue/backend/.env with your Azure PostgreSQL credentials!"
fi

echo ">>> [6/6] Installing and starting systemd service..."
cp /var/www/techrescue/deploy/systemd/techrescue-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable techrescue-backend
systemctl restart techrescue-backend

# Configure internal firewall (allow port 5000 from VNet)
ufw allow 22/tcp
ufw allow 5000/tcp
ufw --force enable

echo "========================================================================"
echo "TECHRESCUE BACKEND SERVICE RUNNING!"
echo "Status check: sudo systemctl status techrescue-backend"
echo "Health check: curl -i http://localhost:5000/health"
echo "========================================================================"
