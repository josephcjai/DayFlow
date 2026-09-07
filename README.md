# ⏱️ DayFlow — Daily Focus & 30-Minute Schedule Flow

> A focus-driven daily scheduler, habit enforcement ledger, multi-sheet developer scratchpad, and productivity analytics application.

---

## 📚 Technical Documentation Index

| Document | Purpose |
| :--- | :--- |
| 🗄️ [**Database Architecture & Relations**](docs/DATABASE_SCHEMA.md) | Full PostgreSQL ER diagram, table schemas, data dictionary, foreign keys, and cascade strategies. |
| 📡 [**API Documentation**](docs/API_DOCUMENTATION.md) | REST API endpoints, JWT authentication contracts, and Swagger UI specifications. |
| 📋 [**Notes & Todo Roadmap**](docs/NOTES_TODO_ROADMAP.md) | Detailed feature roadmap and completed milestones (Phases 1 through 6). |
| ⚙️ [**Technical Specification**](docs/TECHNICAL_SPECIFICATION.md) | System architecture, planned vs. actual time-lock mechanics, and design tokens. |
| 🚀 [**Production Deployment Guide**](docs/DEPLOYMENT_LIGHTSAIL.md) | AWS Lightsail / Docker deployment guide with Nginx reverse proxy. |

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
