# Mati Bolts Center — Inventory and Sales

A staff-operated inventory and sales management system using a React frontend, an Express API, and the Supabase Data API.

## Requirements

- Node.js 22 or newer
- A Supabase project with its PostgreSQL database available to the backend

## Setup

1. In your Supabase project, enable the **Data API**. In the SQL Editor, run `database/schema.sql`, `database/seed.sql`, and then `database/data-api-functions.sql`, in that order.
2. In `backend/`, install dependencies and create your local environment file:

   ```powershell
   cd backend
   npm install
   Copy-Item .env.example .env
   ```

3. In `backend/.env`, set `SUPABASE_URL` to your project URL and `SUPABASE_SERVICE_ROLE_KEY` to the server-only service role key from **Project Settings → API Keys**. Keep the service role key private; never put it in frontend code or share it. The backend uses the Data API for all table access. Set a random `JWT_SECRET` of at least 32 characters and a unique initial admin password of at least 12 characters. PowerShell can generate a JWT secret with:

   ```powershell
   $bytes = New-Object byte[] 48
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

   Keep `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` private, and do not commit `.env`. The schema enables row-level security and grants table access only to the backend's service role; the Data API functions are also restricted to that role.
4. Create the first administrator:

   ```powershell
   npm run seed:users
   ```

5. Install the frontend dependencies and build the React app:

   ```powershell
   npm --prefix ../frontend install
   npm --prefix ../frontend run build
   ```

6. Start the server and open the application:

   ```powershell
   npm start
   ```

   Open `http://localhost:3000`. The Express server serves the frontend and API from one origin. For access from other computers, set `HOST=0.0.0.0` in `.env`, allow the chosen port through the host firewall, and open the server's LAN address from those computers.

To check the backend JavaScript after setup, run `npm run check` from `backend/`. To rebuild the frontend later, run `npm run build:frontend` from `backend/`.

For frontend development with Vite, start the backend with `npm start` in `backend/`, then run `npm install` and `npm run dev` in `frontend/`. The Vite server proxies `/api` requests to the backend.

The initial admin credentials are the values in `.env`; keep `.env` private and change the initial password after the first sign-in. Do not deploy with the example secret.

## Included workflows

- Role-protected sign-in and administrator account management
- Product, category, supplier, and customer records
- Sales with server-side prices, stock validation, and transactional stock deduction
- Transactional stock-in, order history, cancellation with stock restoration
- Dashboard, sales reports, and low-stock report

All protected API routes require a bearer token. Business calculations and inventory changes happen in the backend; the frontend never connects directly to Supabase. The service role key is used only by the backend and bypasses RLS, so it must remain server-side.

## Frontend files

- `frontend/src/main.jsx` mounts the React application.
- `frontend/src/App.jsx` contains sign-in, navigation, shared dialogs, and API access.
- `frontend/src/pages.jsx` contains the dashboard, inventory, sales, orders, stock-in, contacts, reports, and user-management pages.
- `frontend/vite.config.js` configures the development server and API proxy.
- `frontend/css/` separates base styles, layout, components, and responsive rules.
