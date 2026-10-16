# TechRescue Backend API Service (Azure VM & PostgreSQL Flexible Server)

Production REST API service for TechRescue written in Node.js and Express, configured for **Azure VM hosting (systemd)**, **Azure Database for PostgreSQL Flexible Server**, and **Azure Application Gateway** path-based routing.

---

## 1. Tech Stack & Infrastructure
- **Runtime**: Node.js (v20+ LTS)
- **Framework**: Express.js
- **Process Manager**: systemd (`techrescue-backend.service`)
- **Database**: Azure Database for PostgreSQL Flexible Server (with mandatory SSL `sslmode=require`)
- **Gateway**: Azure Application Gateway (Reverse proxy with `trust proxy = 1`)

---

## 2. Azure VM Quick Setup

Run the automated provisioning script on your Ubuntu 22.04 LTS Backend VM:
```bash
sudo bash deploy/scripts/setup-backend-vm.sh
```

### Manual Configuration
1. Edit `/var/www/techrescue/backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=production
   DATABASE_URL=postgresql://techrescue_admin:YourPassword123!@techrescue-psql-prod.postgres.database.azure.com:5432/techrescue_db?sslmode=require
   JWT_SECRET=production_jwt_secret_token_2026
   CORS_ORIGIN=*
   ```
2. Enable and start the systemd unit:
   ```bash
   sudo cp deploy/systemd/techrescue-backend.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable techrescue-backend
   sudo systemctl start techrescue-backend
   ```
3. Check status:
   ```bash
   sudo systemctl status techrescue-backend
   curl -i http://localhost:5000/health
   ```

---

## 3. Azure Application Gateway Integration

The backend is configured with:
- `app.set('trust proxy', 1);` to correctly interpret `X-Forwarded-For` and `X-Forwarded-Proto` sent by Azure Application Gateway.
- Dedicated health check endpoints at `/health`, `/api/health`, and `/api/v1/health` responding with `200 OK` and active database ping telemetry.
