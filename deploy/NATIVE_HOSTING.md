# Native Node.js Deployment Guide (No Docker Required)

This runbook explains how to host **Proxima** natively on any Node.js server (Linux/macOS) without using Docker.

---

## 1. Prerequisites

- **Node.js 20+** (`node -v`)
- **npm 10+** (`npm -v`)
- **SQLite 3**

---

## 2. Quick Setup

Run the following commands in the project root directory:

```bash
# 1. Install dependencies in backend and frontend
cd backend && npm install && npx prisma generate && cd ..
cd frontend && npm install && cd ..

# 2. Configure environment (.env)
cp .env.example .env
```

Edit `.env` to specify your URLs, secret key, and Proxmox details:
```env
ENCRYPTION_KEY=<generated-64-hex-key>
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:4000
BIND_ADDR=0.0.0.0
```

---

## 3. Build Project

Build both backend and frontend for production:

```bash
npm run build
```

---

## 4. Run Server Natively

### Option A: Using PM2 (Recommended for Production)

```bash
# Install PM2 globally if needed
npm install -g pm2

# Start both frontend & backend with PM2
pm2 start deploy/pm2.config.js

# Save process list to auto-start on server reboot
pm2 save
pm2 startup
```

### Option B: Running directly with Node

```bash
# Terminal 1 (Backend API)
npm run start:backend

# Terminal 2 (Frontend WebUI)
npm run start:frontend
```

---

## 5. Proxmox Infrastructure Auto-Discovery

Once logged in as Administrator:
1. Open the **Virtual Machines** page in Proxima.
2. Click **"Sync Proxmox Infra"**.
3. Proxima will query your Proxmox cluster and automatically import all pre-existing QEMU VMs and LXC containers into your dashboard!
