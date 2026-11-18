# Mati Bolts Center — Inventory and Sales

A staff-operated inventory and sales management system using a static HTML/CSS/JavaScript frontend, an Express API, and Supabase PostgreSQL.

## Requirements

- Node.js 18 or newer
- A Supabase project with its PostgreSQL database available to the backend

## Setup

1. In your Supabase project, open **SQL Editor** and run `database/schema.sql`, followed by `database/seed.sql`.
2. In `backend/`, install dependencies and create your local environment file:

   ```powershell
   cd backend
   npm install
   Copy-Item .env.example .env
   ```

3. In the Supabase dashboard, copy the PostgreSQL connection URI from **Project Settings → Database → Connection string** and set it as `SUPABASE_DB_URL` in `backend/.env`. Use the session pooler URI if your deployment needs IPv4 connectivity. Keep its database password private; URL-encode special characters in the password. Also set a random `JWT_SECRET` of at least 32 characters and a unique initial admin password of at least 12 characters. PowerShell can generate a secret with:

   ```powershell
   $bytes = New-Object byte[] 48
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

   The backend connects directly to Supabase PostgreSQL using this server-side connection URI. Do not put the database password, Supabase service-role key, or connection URI in frontend code or commit `.env`.
4. Create the first administrator:

   ```powershell
   npm run seed:users
   ```

5. Start the server and open the application:

   ```powershell
   npm start
   ```

   Open `http://localhost:3000`. The Express server serves the frontend and API from one origin. For access from other computers, set `HOST=0.0.0.0` in `.env`, allow the chosen port through the host firewall, and open the server's LAN address from those computers.

To check JavaScript syntax after setup, run `npm run check` from `backend/`.

The initial admin credentials are the values in `.env`; keep `.env` private and change the initial password after the first sign-in. Do not deploy with the example secret.

## Included workflows

- Role-protected sign-in and administrator account management
- Product, category, supplier, and customer records
- Sales with server-side prices, stock validation, and transactional stock deduction
- Transactional stock-in, order history, cancellation with stock restoration
- Dashboard, sales reports, and low-stock report

All protected API routes require a bearer token. Business calculations and inventory changes happen in the backend; the frontend never connects directly to Supabase.

## Frontend files

- `frontend/js/app.js` starts the app and connects page renderers.
- `frontend/js/core.js` contains shared state, API, navigation, and dialog helpers.
- `frontend/js/dashboard.js`, `inventory.js`, `sales.js`, `orders.js`, `stock-in.js`, `contacts.js`, `reports.js`, and `users.js` contain their respective page logic.
- `frontend/css/` separates base styles, layout, components, and responsive rules.
