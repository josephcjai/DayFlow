# DayFlow ⏳✨

> A focus-driven, 30-minute time-blocking daily scheduler, habit ledger, and productivity analytics application.

![DayFlow Banner](https://img.shields.shields.io/badge/DayFlow-v2.2.0-blueviolet?style=for-the-badge)
![License](https://img.shields.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.shields.io/badge/Status-Active_Development-brightgreen?style=for-the-badge)

---

## 🌟 Overview

**DayFlow** digitizes manual multi-tab schedule spreadsheets into a streamlined, high-performance web and mobile application. Built specifically for high-discipline routines, skill acquisition, and time optimization, DayFlow allows users to schedule future 30-minute time blocks, track actual time spent, and dynamically edit tasks at any point—even after completion.

---

## ✨ Key Features

- ⏰ **30-Minute Time-Blocking Calendar Grid**: Intuitive daily/weekly view with 30-minute slot granularity (04:00 AM – 11:00 PM).
- 📌 **Planned Task vs. Actual Task Separation**: Explicit baseline plan tracking with editable actual execution history.
- 🔒 **Scheduled Time-Lock Baseline**: Automatically locks baseline planned tasks once scheduled slot time has passed.
- ⏱️ **Planned vs. Actual Time Tracking**: Enter planned activities in advance, then log exact minutes spent (0–30+ mins).
- 🏷️ **Categorical Tagging & Color Coding**: Organizes tasks across `Learning` (WPF, WCF, React, Angular, COBOL), `Work`, `Household`, `Family`, `Health & Meal`, and `Travel`.
- 📊 **Focus Analytics Dashboard**: Visual summary of total scheduled vs. actual hours spent per category with productivity scores.
- ⚡ **Habit & Discipline Ledger**: Instant logging for habit enforcement (post-meal logging, non-working hours tracking, discipline rules).
- 📓 **Weekly Notes & To-Do Checklist**: Dedicated workspace for freeform weekly notes and priority items.
- 🌐 **Express REST API & PostgreSQL Backend**: Scalable backend API server running on port 5000 with offline localStorage fallback.

---

## 📁 Repository Structure

```
DayFlow/
├── doc/
│   ├── TECHNICAL_SPECIFICATION.md   # Comprehensive system architecture & spec
│   └── DEPLOYMENT_LIGHTSAIL.md      # AWS Lightsail server deployment guide
├── server/                          # Phase 2: Node.js Express REST API Server
│   ├── src/
│   │   ├── db/                     # PostgreSQL pool connection & schema DDL
│   │   ├── routes/                 # Express REST API route handlers
│   │   └── server.ts               # Server bootstrap (Port 5000)
│   ├── package.json
│   └── tsconfig.json
├── src/                             # Modular Web Application Assets
│   ├── css/styles.css
│   ├── data/initialData.js
│   └── js/ (app.js, grid.js, modal.js, state.js, habits.js, analytics.js, notes.js, apiClient.js)
├── index.html                       # Web application entry point
├── README.md                        # Project overview and quickstart guide
└── .gitignore                        # Standard git ignore configuration
```

---

## 🚀 Quick Start

### 1. Launching the Web Application (Frontend)
```bash
python -m http.server 8080
```
Navigate to `http://localhost:8080` in your web browser.

### 2. Running the Backend API Server (Node.js / Express)
```bash
cd server
npm install
npm run dev
```
The REST API server runs at `http://localhost:5000/api`.

---

## 📄 Technical Specification & Roadmap

For in-depth details on the relational database model (PostgreSQL schema), Node.js backend integration, and cross-platform Flutter mobile deployment, refer to the [Technical Specification Document](file:///c:/githubrepo/myrepos/DayFlow/doc/TECHNICAL_SPECIFICATION.md).

### Roadmap
- [x] **Phase 1**: Technical Specification & Web Application (Interactive Grid, Planned vs Actual Tasks, Habit Ledger, Local Storage).
- [x] **Phase 2**: Node.js / Express REST API and PostgreSQL database backend.
- [ ] **Phase 3**: Cross-platform Flutter Mobile Application (Android & iOS).
- [ ] **Phase 4**: Real-time cloud sync & notification alerts.

---

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.
