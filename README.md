# ⏱️ DayFlow — Daily Focus & 30-Minute Schedule Flow

> A focus-driven daily scheduler, habit enforcement ledger, multi-sheet developer scratchpad, and productivity analytics application.

---

## 📚 Technical Documentation Index

| Document | Purpose |
| :--- | :--- |
| 🗄️ [**Database Architecture & Relations**](docs/DATABASE_SCHEMA.md) | Full PostgreSQL ER diagram, table schemas, data dictionary, foreign keys, and cascade strategies. |
| 📡 [**API Documentation**](docs/API_DOCUMENTATION.md) | REST API endpoints, JWT authentication contracts, and Swagger UI specifications. |
| 📋 [**Notes & Todo Roadmap**](docs/NOTES_TODO_ROADMAP.md) | Detailed feature roadmap and completed milestones (Phases 1 through 6). |
| 📅 [**Day Templates Roadmap**](docs/DAY_TEMPLATES_ROADMAP.md) | Future roadmap & cloud sync architecture for Day Templates (v2.7.0). |
| 🏷️ [**Custom Categories Roadmap**](docs/CUSTOM_CATEGORIES_ROADMAP.md) | Architecture specification & soft-deletion strategy for Custom Categories (v2.9.0). |
| ⚙️ [**Technical Specification**](docs/TECHNICAL_SPECIFICATION.md) | System architecture, planned vs. actual time-lock mechanics, and design tokens. |
| 🚀 [**Production Deployment Guide**](docs/DEPLOYMENT_LIGHTSAIL.md) | AWS Lightsail / Docker deployment guide with Nginx reverse proxy. |
| 🚢 [**v2.9.0 Production Deployment Runbook**](docs/DEPLOYMENT_v2.9.0_PRODUCTION.md) | Step-by-step production runbook, DB migration ordering, execution log & sign-off for `v2.9.0`. |
| 🚢 [**v2.8.0 Production Deployment Runbook**](docs/DEPLOYMENT_v2.8.0_PRODUCTION.md) | Step-by-step production runbook, DB migration ordering, and rollback instructions for `v2.8.0`. |
| 📋 [**v2.8.0 Deployment Execution Log**](docs/DEPLOYMENT_v2.8.0_EXECUTION_LOG.md) | DevOps execution log template, pre-flight checks, and verification smoke tests. |
| 📜 [**v2.8.0 Production Execution Record**](docs/DEPLOYMENT_v2.8.0_EXECUTION_RECORD.md) | Live execution record from production deployment on AWS Lightsail (`v2.8.0` / 2026-10-06). |

---

## 🏗️ Quick Start (Local Development)

### 1. Start PostgreSQL (Docker)
```bash
docker run --name dayflow-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dayflow_db -p 5433:5432 -d postgres:16-alpine
```

### 2. Start Express API Server
```bash
cd server
npm install
npm run dev
# Server runs on http://localhost:5000 (Swagger docs at http://localhost:5000/api/docs)
```

### 3. Start Frontend Client
```bash
# In project root:
python -m http.server 8080
# Open http://localhost:8080
```
