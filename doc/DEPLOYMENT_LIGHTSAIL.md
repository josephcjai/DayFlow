# DayFlow — AWS Lightsail Server Deployment Guide

This document outlines the deployment configuration for hosting DayFlow on the production AWS Lightsail server alongside existing services.

---

## 🖥️ Server Environment Details

- **Provider**: AWS Lightsail
- **Region**: `ap-south-1` (Mumbai)
- **Public Static IP**: `13.200.154.214`
- **Private IP**: `172.26.9.232`
- **OS**: Ubuntu 24.04.4 LTS
- **User**: `ubuntu`
- **SSH Key**: `LightsailDefaultKey-ap-south-1.pem`

---

## 📐 System Port & Process Allocations

| Service | Application | Technology | Port / Directory | Process Name |
| :--- | :--- | :--- | :--- | :--- |
| **Existing** | HelpFinder Frontend | Next.js 14 | Port `3000` / `/var/www/helpfinder` | `hf-web` |
| **Existing** | HelpFinder Backend | NestJS | Port `4000` / `/var/www/helpfinder` | `hf-api` |
| **New** | **DayFlow Web App** | Static / Nginx | Port `8080` / `/var/www/dayflow` | Nginx Static |
| **New** | **DayFlow API (Phase 2)** | Node.js / Express | Port `5000` / `/var/www/dayflow/api` | `dayflow-api` |
| **Database** | Shared PostgreSQL | PostgreSQL 16 | `localhost:5432` (`dayflow_db`) | System service |

---

## 🚀 Step-by-Step Deployment Instructions

### 1. Web Application Deployment (Phase 1)

1. **Create Target Directory on Lightsail**:
   ```bash
   ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
   sudo mkdir -p /var/www/dayflow
   sudo chown -R ubuntu:ubuntu /var/www/dayflow
   ```

2. **Deploy Files from Repository**:
   ```bash
   rsync -avz -e "ssh -i LightsailDefaultKey-ap-south-1.pem" \
     --exclude '.git' --exclude 'node_modules' \
     ./ ubuntu@13.200.154.214:/var/www/dayflow/
   ```

3. **Configure Nginx**:
   Create `/etc/nginx/sites-available/dayflow`:
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
           proxy_pass http://localhost:5000/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable & Reload Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/dayflow /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

### 2. PostgreSQL Database Setup (Phase 2)

Connect to the server and create a dedicated database for DayFlow:
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE dayflow_db;
CREATE USER dayflow_user WITH ENCRYPTED PASSWORD 'SelectSecurePasswordHere';
GRANT ALL PRIVILEGES ON DATABASE dayflow_db TO dayflow_user;
\q
```

---

### 3. PM2 Process Manager Configuration (Phase 2 API)

Add DayFlow API service to PM2:
```bash
cd /var/www/dayflow/api
npm install
npm run build
pm2 start dist/main.js --name "dayflow-api"
pm2 save
```
