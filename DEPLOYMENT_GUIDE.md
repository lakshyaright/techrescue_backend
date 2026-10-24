# TechRescue Three-Tier Deployment Guide (Supabase + Vercel + Vercel)

Complete production deployment guide for running **TechRescue** in a clean **Three-Tier Architecture** using a **Single Monorepo**:

```
┌──────────────────────────────────────────┐
│      TIER 1: FRONTEND (React / Vite)     │  --> Deployed on Vercel
│      Subfolder: /frontend                │      Domain: https://techrescue.vercel.app
└────────────────────┬─────────────────────┘
                     │ (REST API calls / JWT Auth)
┌────────────────────▼─────────────────────┐
│      TIER 2: BACKEND (Node / Express)    │  --> Deployed on Vercel Serverless
│      Subfolder: /backend                 │      Domain: https://techrescue-api.vercel.app
└────────────────────┬─────────────────────┘
                     │ (Connection Pooler / SSL)
┌────────────────────▼─────────────────────┐
│      TIER 3: DATABASE (PostgreSQL)       │  --> Hosted on Supabase
│      Schema: /database/supabase_schema.sql│     Port 6543 (Transaction Pooler)
└──────────────────────────────────────────┘
```

---

## 📋 PRE-REQUISITES

1. **GitHub Account**: A single repository containing the `/database`, `/backend`, and `/frontend` folders.
2. **Supabase Account**: Free account at [https://supabase.com](https://supabase.com).
3. **Vercel Account**: Free account at [https://vercel.com](https://vercel.com) (connected with your GitHub).

---

## 🚀 STEP 1: DEPLOY THE DATABASE (Supabase)

*Always deploy the Database first, because the Backend needs its connection string.*

### 1.1 Create a new Supabase Project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and log in.
2. Click **"New Project"**.
3. Fill in the details:
   - **Name**: `techrescue-db`
   - **Database Password**: Set a strong password (save this, you will need it!).
   - **Region**: Choose a region close to your users (e.g., `Singapore (ap-southeast-1)` or `Mumbai (ap-south-1)`).
4. Click **"Create new project"** and wait ~1-2 minutes for provisioning.

### 1.2 Run the SQL Schema Script
1. In the left navigation menu of your Supabase dashboard, click **"SQL Editor"** (the icon with `>_`).
2. Click **"New Query"**.
3. Open the file `database/supabase_schema.sql` from your repository, copy all contents, and paste it into the editor.
4. Click the green **"Run"** button (or press `Ctrl+Enter`).
5. You will see `Success. No rows returned`.
6. Verify: Click **"Table Editor"** on the left menu. You will see all 8 tables created:
   - `users` (seeded with initial Admin, Client, Expert, Field Tech)
   - `queries`
   - `work_logs`
   - `chat_messages`
   - `payments`
   - `activity_logs`
   - `user_skills`
   - `user_certifications`

### 1.3 Get the Database Connection String
1. In the left menu, click **Project Settings** (gear icon) -> **Database**.
2. Scroll down to **"Connection string"** section.
3. Select **"URI"** tab and choose **"Transaction"** mode (Port `6543`) or **"Session"** mode (Port `5432`).
4. Copy the URI. It looks like:
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual Supabase database password you set in Step 1.1.
   *(Note: If your password has special characters like `@` or `#`, URL-encode them, e.g. `@` -> `%40`).*

---

## ⚙️ STEP 2: DEPLOY THE BACKEND (Vercel)

*Deploy the Backend next to get its live API URL for the frontend.*

### 2.1 Import the Repository into Vercel
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** -> **"Project"**.
3. Select your GitHub repository (`techrescue`).
4. Click **"Import"**.

### 2.2 Configure Backend Project Settings in Vercel
1. **Project Name**: `techrescue-backend` (or your preferred name).
2. **Framework Preset**: Select **"Other"**.
3. **Root Directory**: Click **"Edit"**, select the `backend` folder, and click **"Continue"**.
4. **Build & Development Settings**: Leave as default (Build Command: empty, Output Directory: empty).
5. **Environment Variables**: Add the following variables:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres` | Your Supabase connection string from Step 1.3 |
| `NODE_ENV` | `production` | Production mode |
| `JWT_SECRET` | `super_secret_techrescue_enterprise_jwt_key_2026_change_in_production` | Random secret key for JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `CORS_ORIGIN` | `*` | Allows cross-origin requests from frontend |
| `DB_SSL` | `true` | Enables SSL for Supabase |
| `DB_POOL_MAX` | `4` | Lean connection pool for serverless |

6. Click **"Deploy"**.
7. Wait ~45 seconds. Once finished, Vercel gives you your live Backend domain:
   ```text
   https://techrescue-backend.vercel.app
   ```

### 2.3 Verify Backend Deployment
Open in your browser:
- `https://techrescue-backend.vercel.app/health`
You should see:
```json
{
  "status": "OK",
  "service": "techrescue-backend-api",
  "database": "connected"
}
```
If `"database": "connected"` appears, your Backend is successfully talking to Supabase!

---

## 💻 STEP 3: DEPLOY THE FRONTEND (Vercel)

*Now deploy the React SPA and connect it to your live backend.*

### 3.1 Create a Second Project in Vercel
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** -> **"Project"**.
3. Select the **same** GitHub repository (`techrescue`).
4. Click **"Import"**.

### 3.2 Configure Frontend Project Settings in Vercel
1. **Project Name**: `techrescue-frontend` (or `techrescue`).
2. **Framework Preset**: Select **"Vite"** (Vercel will usually auto-detect this).
3. **Root Directory**: Click **"Edit"**, select the `frontend` folder, and click **"Continue"**.
4. **Build Settings**:
   - Build Command: `npm run build` (or `vite build`)
   - Output Directory: `dist`
   - Install Command: `npm install`
5. **Environment Variables**: Add this single variable:

| Variable Name | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://techrescue-backend.vercel.app/api/v1` |

*(Replace `techrescue-backend.vercel.app` with your actual Backend URL from Step 2.2! Make sure to include `/api/v1` at the end).*

6. Click **"Deploy"**.
7. In ~1 minute, your Frontend is live:
   ```text
   https://techrescue-frontend.vercel.app
   ```

---

## 🎯 STEP 4: VERIFY END-TO-END FLOW

1. Open your live frontend URL (`https://techrescue-frontend.vercel.app`).
2. Go to **Sign In** (`/auth/login`).
3. You will see the green indicator: **"PostgreSQL Database Connected"**.
4. Test Admin Login:
   - Click the **"Admin Console"** quick-login button (`admin@techrescue.io` / `password123`).
   - Click **Sign In**.
   - You will land on the **Operations & Enterprise Control Center**.
5. Test Live User Directory:
   - Click **"User Directory"** (`/admin/users`).
   - You will see the seeded Supabase users.
   - Click **"Create User"** -> fill out a new Client or Expert -> click **"Create & Insert into Database"**.
   - Open your Supabase Dashboard -> Table Editor -> `users`. The new user is immediately present!
6. Test Client Ticket Creation:
   - Sign out, log in as `sonu.patel@fintechglobal.com` (`password123`).
   - Click **"Raise Technical Query"** -> fill the 3-step incident protocol -> submit.
   - The ticket is inserted into Supabase `queries` table!
7. Check Operations Center Graphs:
   - Log back into Admin Console. The 7-Day Influx Trend, Incident Distribution, and MTTR graphs update live based on your newly created tickets!

---

## 🛠️ LOCAL DEVELOPMENT (Optional)

If you want to run everything locally against your Supabase database:

1. **Backend**:
   ```bash
   cd backend
   cp .env.example .env
   # Set your DATABASE_URL in .env
   npm install
   npm run dev
   # Runs on http://localhost:5000
   ```

2. **Frontend**:
   ```bash
   cd frontend
   cp .env.example .env
   # Set VITE_API_URL=http://localhost:5000/api/v1
   npm install
   npm run dev
   # Runs on http://localhost:3000
   ```
