# DayFlow — Production Deployment Guide for AWS Lightsail
## Multi-App Coexistence with HelpFinder4U (`13.200.154.214`)

**Target Server:** AWS Lightsail Instance  
**Public IP:** `13.200.154.214`  
**Region:** `ap-south-1` (Mumbai)  
**OS:** Ubuntu 24.04 LTS (User: `ubuntu`)  
**Target Release:** DayFlow `v2.4.1`  
**Audience:** Deployment Team / DevOps Engineers  

---

## 1. Architecture & Resource Allocation (Zero-Conflict Guarantee)

The server currently runs **HelpFinder4U**. DayFlow is designed to be **100% decoupled and independent**. Neither application shares processes, ports, directories, or database tables.

### Resource & Port Comparison Matrix

| Layer | HelpFinder4U (Existing — DO NOT TOUCH) | DayFlow (New Deployment) | Conflict Status |
| :--- | :--- | :--- | :--- |
| **Filesystem Root** | `/var/www/helpfinder` | `/var/www/dayflow` | ✅ Isolated |
| **Application Web** | Next.js on `localhost:3000` | Static HTML/JS served via Nginx (Port `8080` or Subdomain) | ✅ Distinct |
| **Application API** | NestJS on `localhost:4000` | Node/Express on `localhost:5000` | ✅ Distinct |
| **Process Manager** | PM2: `hf-web`, `hf-api` | PM2: `dayflow-api` | ✅ Distinct |
| **Database Server** | PostgreSQL 16 on `localhost:5432` | PostgreSQL 16 on `localhost:5432` | Shared Engine |
| **Database Name** | `helpfinder_db` | `dayflow_db` | ✅ Dedicated DB |
| **Database User** | `helpfinder_user` | `dayflow_user` | ✅ Dedicated User |
| **Logs** | `~/.pm2/logs/hf-*` | `~/.pm2/logs/dayflow-*` | ✅ Separate logs |

> [!IMPORTANT]
> **Safety Rule for Deployment Team:**
> - Never execute `systemctl restart postgresql` during peak hours; PostgreSQL stays running while creating the new database.
> - Never touch files under `/var/www/helpfinder` or modify existing Nginx configs for HelpFinder.
> - When running PM2 commands, always target DayFlow specifically: `pm2 restart dayflow-api`, never `pm2 restart all`.

---

## 2. Pre-Deployment Preparation

### 2.1 Required Credentials & Information
Before beginning, ensure you have:
1. SSH Private Key (`LightsailDefaultKey-ap-south-1.pem`).
2. Brevo API Key & Verified Sender Email (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`).
3. Google OAuth 2.0 Client ID (if enabling Google Sign-In).
4. Domain name (e.g. `dayflow.yourdomain.com`) pointing to `13.200.154.214`, OR use dedicated port `8080`.

### 2.2 SSH into the Lightsail Server
From your local terminal:
```bash
chmod 400 LightsailDefaultKey-ap-south-1.pem
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
```

Verify existing HelpFinder services are running smoothly before touching anything:
```bash
pm2 status
sudo systemctl status nginx --no-pager
```

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Create Dedicated Database & User in PostgreSQL
DayFlow uses its own database (`dayflow_db`) and role (`dayflow_user`). This prevents any interaction with HelpFinder's database.

1. Open PostgreSQL CLI as `postgres` superuser:
   ```bash
   sudo -u postgres psql
   ```

2. Run the following SQL statements (replace `YourSecureDbPasswordHere123!` with a strong password):
   ```sql
   -- 1. Create isolated user
   CREATE USER dayflow_user WITH ENCRYPTED PASSWORD 'YourSecureDbPasswordHere123!';

   -- 2. Create isolated database
   CREATE DATABASE dayflow_db OWNER dayflow_user;

   -- 3. Grant schema permissions
   GRANT ALL PRIVILEGES ON DATABASE dayflow_db TO dayflow_user;
   \c dayflow_db
   GRANT ALL ON SCHEMA public TO dayflow_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dayflow_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dayflow_user;

   -- 4. Verify HelpFinder database is untouched
   \l
   \q
   ```

---

### Step 2: Create DayFlow Directory Structure
Create the dedicated application directory:
```bash
sudo mkdir -p /var/www/dayflow
sudo chown -R ubuntu:ubuntu /var/www/dayflow
```

---

### Step 3: Deploy Application Code
Choose **Method A** (Git Clone) or **Method B** (Rsync from local):

#### Method A: Git Clone (Recommended)
```bash
cd /var/www/dayflow
git clone https://github.com/josephcjai/DayFlow.git .
git checkout v2.4.1
```

#### Method B: Rsync from Local Machine
From your local DayFlow repository directory:
```bash
rsync -avz -e "ssh -i LightsailDefaultKey-ap-south-1.pem" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'temp' \
  ./ ubuntu@13.200.154.214:/var/www/dayflow/
```

---

### Step 4: Configure Production Environment Variables
Create `/var/www/dayflow/server/.env`:
```bash
nano /var/www/dayflow/server/.env
```

Paste the following production configuration, updating values accordingly:
```ini
# ==============================================================================
# DayFlow Production Environment Configuration
# ==============================================================================
NODE_ENV=production
PORT=5000

# Public application URL (Crucial for password reset links)
# If using a domain: https://dayflow.yourdomain.com
# If using IP + Port: http://13.200.154.214:8080
APP_URL=https://dayflow.yourdomain.com

# Allowed CORS origins
ALLOWED_ORIGINS=https://dayflow.yourdomain.com,http://13.200.154.214:8080

# Secure 64-character JWT secret (Generate using: openssl rand -hex 32)
JWT_SECRET=generate_and_insert_secure_64_character_secret_here

# PostgreSQL Database Configuration (Connecting to local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dayflow_db
DB_USER=dayflow_user
DB_PASSWORD=YourSecureDbPasswordHere123!
DB_POOL_MAX=20
DB_SSL=false

# Brevo Transactional Email Service (Password Reset)
BREVO_API_KEY=xkeysib-your-actual-brevo-api-key
BREVO_SENDER_EMAIL=admin@annode.net
BREVO_SENDER_NAME=DayFlow

# Google OAuth 2.0 (Optional)
GOOGLE_CLIENT_ID=1033021313424-jm6ke98n03tjl3ti7gndk10fv2pphq8p.apps.googleusercontent.com
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`). Set secure file permissions:
```bash
chmod 600 /var/www/dayflow/server/.env
```

---

### Step 5: Install Dependencies, Build API, & Run Database Migrations
Run the build and migration commands on the server:
```bash
cd /var/www/dayflow/server

# 1. Install dependencies
npm ci --production=false

# 2. Compile TypeScript
npm run build

# 3. Run database migrations to create schema & token tables
npm run migrate
```

Verify database tables were created:
```bash
PGPASSWORD='YourSecureDbPasswordHere123!' psql -h localhost -U dayflow_user -d dayflow_db -c "\dt"
```
*(You should see: `users`, `schedule_weeks`, `schedule_slots`, `todos`, `todo_items`, `habit_logs`, `password_reset_tokens`).*

---

### Step 6: Start API Process with PM2
Add `dayflow-api` to PM2 so it runs continuously in the background and restarts automatically on server reboot:
```bash
cd /var/www/dayflow/server

# Start process
pm2 start dist/server.js --name "dayflow-api"

# Save PM2 process list
pm2 save

# Verify PM2 status (Notice HelpFinder processes remain untouched!)
pm2 status
```

Verify DayFlow API is healthy and responding locally:
```bash
curl -I http://localhost:5000/api/auth/config
```
*(Expected response: `HTTP/1.1 200 OK`)*

---

### Step 7: Configure Nginx Virtual Host
We create an isolated Nginx configuration file in `/etc/nginx/sites-available/dayflow.conf`. This will not affect `/etc/nginx/sites-available/helpfinder` or default configurations.

#### Option A: Dedicated Subdomain (Recommended — e.g. `dayflow.yourdomain.com`)
```bash
sudo nano /etc/nginx/sites-available/dayflow.conf
```
Paste:
```nginx
server {
    listen 80;
    server_name dayflow.yourdomain.com;

    # Frontend static files
    root /var/www/dayflow;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Frontend SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

Enable SSL via Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/dayflow.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d dayflow.yourdomain.com
```

---

#### Option B: Port-Based Routing (If using IP directly: `http://13.200.154.214:8080`)
If a domain is not yet pointed, serve DayFlow on dedicated port `8080`:
```bash
sudo nano /etc/nginx/sites-available/dayflow.conf
```
Paste:
```nginx
server {
    listen 8080;
    server_name 13.200.154.214;

    root /var/www/dayflow;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/dayflow.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> [!NOTE]
> If using Port `8080`, open port 8080 in AWS Lightsail Console:  
> **Lightsail Dashboard** → **Networking** → **IPv4 Firewall** → **Add rule** → **Custom TCP** → Port `8080`.

---

## 4. Post-Deployment Verification Checklist

Run through these checks to ensure complete system health:

### 4.1 HelpFinder4U Integrity Verification (Zero Regression)
Verify the existing application is completely unaffected:
- [ ] Run `pm2 status` — check `hf-web` and `hf-api` are `online`.
- [ ] Visit HelpFinder URL / endpoints to verify normal operation.
- [ ] Verify `helpfinder_db` tables are untouched:
  ```bash
  sudo -u postgres psql -d helpfinder_db -c "\dt"
  ```

### 4.2 DayFlow Functionality Verification
- [ ] **Frontend Load:** Open `https://dayflow.yourdomain.com` (or `http://13.200.154.214:8080`). The landing page loads with CSS, icons, and fonts intact.
- [ ] **API Documentation:** Visit `https://dayflow.yourdomain.com/api-docs` to view Swagger UI.
- [ ] **Registration:** Register a test account (`test@yourdomain.com`).
- [ ] **Login & Session:** Sign in and verify token is stored and schedule grid displays.
- [ ] **Password Reset (Live Brevo Test):**
  1. Click "Forgot Password" on sign-in modal.
  2. Submit your email address.
  3. Verify email arrives in inbox from "DayFlow".
  4. Click link, enter new password, and verify you can sign in.
- [ ] **PM2 Logs Check:** Check for clean logs with no unhandled errors:
  ```bash
  pm2 logs dayflow-api --lines 50
  ```

---

## 5. Maintenance, Updates, & Rollback

### How to Update DayFlow to a Newer Version
```bash
cd /var/www/dayflow
git fetch --tags
git checkout <new_tag>

cd server
npm ci --production=false
npm run build
npm run migrate

pm2 restart dayflow-api
sudo systemctl reload nginx
```

### How to Rollback if Needed
```bash
cd /var/www/dayflow
git checkout v2.4.0

cd server
npm run build
pm2 restart dayflow-api
```

### Useful Monitoring Commands
```bash
# Check PM2 processes
pm2 status

# Real-time logs for DayFlow API only
pm2 logs dayflow-api

# Check PostgreSQL connection count
sudo -u postgres psql -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```
