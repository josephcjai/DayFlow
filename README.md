# DayFlow ⏳✨

> A focus-driven, 30-minute time-blocking daily scheduler, habit ledger, and productivity analytics application.

![DayFlow Banner](https://img.shields.shields.io/badge/DayFlow-v2.0.0-blueviolet?style=for-the-badge)
![License](https://img.shields.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.shields.io/badge/Status-Active_Development-brightgreen?style=for-the-badge)

---

## 🌟 Overview

**DayFlow** digitizes manual multi-tab schedule spreadsheets into a streamlined, high-performance web and mobile application. Built specifically for high-discipline routines, skill acquisition, and time optimization, DayFlow allows users to schedule future 30-minute time blocks, track actual time spent, and dynamically edit tasks at any point—even after completion.

---

## ✨ Key Features

- ⏰ **30-Minute Time-Blocking Calendar Grid**: Intuitive daily/weekly view with 30-minute slot granularity (04:00 AM – 11:00 PM).
- ⏱️ **Planned vs. Actual Time Tracking**: Enter planned activities in advance, then log exact minutes spent (0–30+ mins).
- ✏️ **Fully Editable Task History**: Modify task names, categories, actual durations, and completion statuses anytime—even after completion.
- 🏷️ **Categorical Tagging & Color Coding**: Organizes tasks across `Learning` (WPF, WCF, React, Angular, COBOL), `Work`, `Household`, `Family`, `Health & Meal`, and `Travel`.
- 📊 **Focus Analytics Dashboard**: Visual summary of total scheduled vs. actual hours spent per category with productivity scores.
- 📓 **Habit & Discipline Ledger**: Instant logging for habit enforcement (post-meal logging, non-working hours tracking, discipline rules).
- 📋 **Weekly Notes & To-Do Checklist**: Dedicated workspace for freeform weekly notes and priority items.
- 💾 **Local & Offline Persistence**: Automatic sync to browser storage with JSON import/export capabilities.

---

## 📁 Repository Structure

```
DayFlow/
├── doc/
│   └── TECHNICAL_SPECIFICATION.md   # Comprehensive system architecture & spec
├── index.html                        # DayFlow Web Application markup
├── styles.css                        # Design system, glassmorphism & layouts
├── app.js                            # Core application logic & state engine
├── README.md                         # Project overview and quickstart guide
└── .gitignore                        # Standard git ignore configuration
```

---

## 🚀 Quick Start (Web Application)

DayFlow Web App runs directly in any modern browser without external build dependencies.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/josephcjai/DayFlow.git
   cd DayFlow
   ```
2. **Open in Browser**:
   - Simply double click `index.html` or open it with your browser of choice.
   - Alternatively, serve via a local HTTP server:
     ```bash
     npx serve ./
     ```
3. **Usage**:
   - Click on any 30-minute time slot to schedule a task or log actual time.
   - Use the **Habit Ledger** tab to quickly log daily routine actions.
   - Open **Focus Analytics** to inspect weekly category breakdowns.

---

## 📄 Technical Specification & Roadmap

For in-depth details on the relational database model (PostgreSQL schema), Node.js backend integration, and cross-platform Flutter mobile deployment, refer to the [Technical Specification Document](file:///c:/githubrepo/myrepos/DayFlow/doc/TECHNICAL_SPECIFICATION.md).

### Roadmap
- [x] **Phase 1**: Technical Specification & Web Application (Interactive Grid, Editable History, Habit Ledger, Local Storage).
- [ ] **Phase 2**: Node.js / Express REST API and PostgreSQL database backend.
- [ ] **Phase 3**: Cross-platform Flutter Mobile Application (Android & iOS).
- [ ] **Phase 4**: Real-time cloud sync & notification alerts.

---

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.
