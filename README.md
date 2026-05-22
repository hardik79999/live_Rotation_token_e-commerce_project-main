# 🛒 ShopHub — Production-Ready Modular Monolith E-Commerce Marketplace

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-lightgrey?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18.3-blue?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-purple?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind--v4.0-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

ShopHub is a production-grade, highly secure, and feature-rich multi-vendor e-commerce marketplace built using a modern **modular monolith architecture**. It integrates real-time messaging, lightning-fast full-text search, automatic currency exchange caching, secure JWT-based double-cookie token rotation, and Progressive Web App (PWA) capabilities.

---

## 🏗️ Architecture & Features

### 🔑 Security & Session Engineering (Double-Cookie Token Rotation)
- **Zero-Trust Token Management**: Double-cookie JWT authentication strategy using HTTP-only, secure, SameSite cookies.
- **CSRF Defense**: Dual CSRF token pattern (access & refresh) with auto-proactive refresh triggers on mutating requests (POST, PUT, DELETE).
- **Silent Login Flow**: Page refreshes trigger a seamless behind-the-scenes session restoration via token renewal without user interruption.

### ⚡ Backend Engine
- **Flask Monolith Blueprinting**: Clean separation of modules via Flask Blueprints (`auth`, `admin`, `seller`, `user`, `chat`, `search`, `currency`).
- **Concurrent WebSockets**: Built on **Eventlet** and **Flask-SocketIO** for real-time buyer-seller chat rooms.
- **Background Scheduler**: Lightweight scheduler for automated operations (abandoned carts, coupon expiration).
- **Meilisearch Full-Text Search**: In-memory full-text search indexing with real-time updates and synchronization.
- **Caching & Rate Limiting**: Redis-backed cache layer with safe degradation to in-process memory when Redis is offline. Rate limiting on sensitive endpoints.

### 🎨 Frontend Engineering
- **State Management**: Scalable and modular Zustand stores (`auth`, `cart`, `currency`, `theme`, `translation`).
- **PWA & Service Workers**: Implemented with VitePWA featuring offline caching strategies, background synchronization, and custom installation prompts.
- **Dynamic Localization (i18n)**: Client-side internationalization with support for 20+ languages and real-time LTR/RTL layout switching.
- **Theming**: System-matching native dark/light theme engine.

---

## 📂 Repository Structure

```
├── start_ngrok.sh               # Local Tunneling & Auto-Config Script
├── start_frontend.sh            # Script to run frontend dev server
├── backend/                     # Backend Modular Monolith Folder
│   ├── app.py                   # Application Entrypoint & Socket.IO Listener
│   ├── config.py                # Schema-Validated App Settings
│   ├── seed.py                  # Database Seed Script (100+ categories & mock users)
│   ├── sync_search.py           # Meilisearch Data Synchronization Engine
│   ├── requirements.txt         # Backend Dependencies
│   ├── start_backend.sh         # Script to run backend Flask server
│   ├── ngrok.yml                # ngrok configuration file
│   ├── migrations/              # Database Migrations folder
│   └── shop/                    # Backend Application Source
│       ├── extensions.py        # Extensions Initialization (db, jwt, socketio, mail)
│       ├── models.py            # SQLAlchemy DB Models (MySQL/SQLite compatible)
│       ├── auth/                # Auth Blueprint & Controller
│       ├── admin/               # Admin Operations & Dashboard endpoints
│       ├── seller/              # Seller Product & Order management
│       ├── user/                # Buyer Cart, Checkout, Profile, and Orders
│       ├── chat/                # WebSocket Real-Time Chat Engine
│       ├── search/              # Meilisearch Router & Client
│       └── currency/            # Exchange Rate Manager & Caching
└── frontend/                    # Frontend React SPA Source
    ├── src/
    │   ├── api/                 # Axios clients & Interceptors (CORS, Token Refresh)
    │   ├── components/          # Reusable UI Atoms & Layout Organisms
    │   ├── store/               # Zustand Global State Containers
    │   └── pages/               # Routed View Components (Buyer, Seller, Admin)
    ├── vite.config.ts           # Build & PWA Configurations
    └── package.json             # NPM package definitions
```

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Python 3.10+**
- **Node.js 18+ / npm 10+**
- **MySQL / SQLite**
- **Meilisearch Server** (optional, fallback supported)

---

### 🔧 1. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Set up virtual environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install requirements**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**:
   Copy `.env.example` to `.env` and fill in your parameters:
   ```bash
   SECRET_KEY=your_secure_random_key
   JWT_SECRET_KEY=your_secure_random_jwt_key
   DATABASE_URL=mysql+pymysql://user:pass@localhost/ecommerce_db
   ```

5. **Database migration & Seeding**:
   Create tables and seed roles, categories, and dummy stores:
   ```bash
   python seed.py --wipe
   ```

6. **Start Flask Server**:
   ```bash
   ./start_backend.sh
   ```

---

### 🎨 2. Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Build and Start Dev Server**:
   To start the Vite dev server with Hot Module Replacement (HMR):
   ```bash
   npm run dev
   ```
   To build production-ready optimized static files:
   ```bash
   npm run build
   ```

---

### 🌐 3. Tunneling with ngrok (Highly Recommended for Mobile & OAuth Tests)

To expose the application to the internet (allowing OAuth callbacks, Webhooks, and testing on physical mobile devices):
```bash
./start_ngrok.sh
```
This script automatically starts an ngrok tunnel, detects the backend/frontend URLs, rewrites `.env.local` for Vite, updates your Flask `FRONTEND_ORIGINS` CORS configuration, and launches the services.

---

## 🔒 JWT Cookie Rotation Mechanics

ShopHub implements a secure authentication flow designed to prevent XSS (Cross-Site Scripting) and CSRF (Cross-Site Request Forgery) attacks:

```mermaid
sequenceDiagram
    participant Browser as React App
    participant Interceptor as Axios Interceptor
    participant Server as Flask Backend

    Browser->>Interceptor: Mutating API Request (POST /api/user/cart)
    alt Access Token Expired (no csrf_access_token)
        Interceptor->>Server: POST /api/auth/refresh-token (with Refresh Cookie)
        Server-->>Interceptor: Set-Cookie: csrf_access_token & csrf_refresh_token
        Interceptor->>Browser: Request Queue Retried
    end
    Interceptor->>Server: Send Request + X-CSRF-TOKEN Header
    Server-->>Browser: 200 OK Response
```

- **HTTP-Only Cookies**: JWT tokens (`access_token` and `refresh_token`) are marked `HttpOnly`, preventing extraction via `document.cookie` (defense against XSS).
- **CSRF Tokens**: The backend sends unique CSRF token hashes in the cookie payload which are parsed and sent back via the `X-CSRF-TOKEN` header on all mutating state modifications.

---

## 🛠️ Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, branch names, and pull request procedures.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
