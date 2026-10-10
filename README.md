# Every Complaint Heard — Gujarat Metro Triage System

**Hackathon Problem Statement:** PS-07 (Smart Operations & Passenger Experience)  
**Goal:** An offline-first, local-AI powered complaint triage and management system for Station Controllers.

## 🚀 The Solution

"Every Complaint Heard" is a modern, offline-first back-office dashboard designed for Gujarat Metro Station Controllers. It solves the critical bottleneck of manually reading, translating, and prioritizing thousands of passenger complaints across multiple languages.

### Key Features
- **Multilingual Support:** Seamlessly handles complaints in Gujarati, Hindi, English, and mixed languages.
- **Offline-First Local AI:** Powered by a local Ollama model (`llama3.1`) running entirely on the station controller's machine. **No internet connection or cloud API is required**, ensuring absolute data privacy and 100% uptime even during network outages.
- **Deterministic Safety Fallback:** If the AI model goes down or misses a critical keyword, a deterministic offline keyword-matcher instantly flags safety emergencies (e.g., "fire", "smoke", "accident") guaranteeing no emergency goes unnoticed.
- **Automated Triage:** Automatically assigns complaints to departments (Lifts, Ticketing, Cleanliness, Safety, Staff) and assigns an Urgency Score (0-100).
- **AI Draft Replies:** Generates a polite, context-aware reply in the passenger's original language, awaiting the controller's single-click approval.
- **Safe Synchronization:** Complaints queue up locally in SQLite and safely sync to a central server only when network connectivity is verified, preventing data loss.

## 🛠 Technology Stack

### Backend
- **Python & FastAPI**: For a lightning-fast, highly concurrent API server.
- **SQLite & SQLAlchemy (Async)**: For robust, file-based local persistence that survives restarts without needing a heavy database installation.
- **Ollama**: Local LLM runner executing inference entirely on-device.
- **Pytest**: 38 automated test cases ensuring reliability.

### Frontend
- **React & Vite**: Extremely fast frontend scaffolding and Hot Module Replacement.
- **Vanilla CSS (Glassmorphic Design)**: A highly polished, custom CSS design system tailored for a premium, native-app feel without bloated UI libraries.
- **Recharts**: For real-time, interactive dashboard analytics.
- **Lucide Icons**: Clean and modern iconography.

## 📂 Project Structure

```text
every-complaint-heard/
│
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # API endpoints (complaints, dashboard, sync)
│   │   ├── core/             # AI Engine, Sync Service, Deterministic Classifier
│   │   ├── db/               # SQLite Models, SQLAlchemy engine
│   │   └── main.py           # Application entry point
│   ├── data/                 # Sample multilingual complaint JSONs
│   ├── tests/                # 38 Automated Pytest scenarios
│   └── requirements.txt      # Python dependencies
│
└── frontend/                 # React UI Application
    ├── src/
    │   ├── components/       # Reusable UI components (Badges, Cards, Sidebar)
    │   ├── pages/            # Dashboard, List View, Import, Detail Views
    │   ├── api.js            # Axios client for backend communication
    │   ├── index.css         # Global Design System
    │   └── main.jsx          # React Entry point
    └── vite.config.js        # Vite bundler config
```

## 💻 How to Run Locally

### 1. Start the Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

### 3. Run Automated Tests
```bash
cd backend
python -m pytest tests/ -v
```

## 🎭 The Passenger Workflow (Behind the Scenes)
1. Passenger submits a complaint via the Metro App, a Kiosk, or speaks to a ticket agent.
2. The text is fed into this triage system.
3. Within milliseconds, the AI reads it, translates the intent, scores the urgency, and drafts a native-language reply.
4. The Station Controller sees the flashing alert on their dashboard, clicks it, reviews the AI's draft, and clicks "Approve".
5. The approved reply is marked ready to be dispatched back to the passenger's mobile app.

---
*Built for the Gujarat Metro Hackathon 2026*
