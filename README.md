# Mobile-Based Carbon Credit Wallet

An offline-first mobile wallet for smallholder farmers. Tree survival is verified
from Sentinel-2 satellite imagery (NDVI), and verified trees earn carbon credit tokens
that corporate buyers can purchase.

## Architecture

- **Farmer app** (`frontend/`): React Native with Expo SDK 58 and TypeScript.
  Works offline: plots and tree batches are saved on the phone (SQLite) and uploaded automatically.
- **Backend API** (`backend/`): Python, FastAPI, SQLAlchemy, Alembic.
  JWT authentication with rotating refresh tokens for farmers, role-based access (Farmer, Buyer, Admin).
- **Database:** PostgreSQL in production (hosted on Neon), SQLite for local development.
- **Verification engine:** NDVI computed from Sentinel-2 imagery (Copernicus), with a simulated
  provider for development and demos.
- **Hosting:** API on Render, database on Neon.
- Buyers and Admins use the API directly through Swagger UI (`/docs`).

## Features

- Farmer: register, log in, record plots (GPS) with trees, view credits, satellite history,
  notifications, archive plots, offline sync.
- Buyer: view available credits, purchase whole tokens, view own purchases.
- Admin: ledger, NDVI trend charts, verification reports, run verification, suspend or reactivate farmers.

## Run the backend locally

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python create_admin.py ADMIN admin1 <password>
python -m uvicorn app.main:app --port 8000 --reload
```
Swagger UI: http://localhost:8000/docs

Settings live in `backend/.env` (never commit it). Use `IMAGERY_PROVIDER=stub` for simulated
imagery or `copernicus` for real Sentinel-2 data.

## Run the app

```
cd frontend
npm install
copy .env.example .env
npx expo start --clear
```
Set `EXPO_PUBLIC_API_URL` in `frontend/.env` to the API address (the hosted HTTPS URL, or your PC's
address when running locally).

Standalone Android build: `eas build -p android --profile preview`.

## Tests

```
cd backend
python -m pytest -v
```

## Known limitations

- Sentinel-2 pixels are 10 m, while plots are small, and NDVI measures greenness, not tree survival.
- Tokens are sold whole and only once; farmer balance means unsold credits.
- No payment integration, in-app notifications only, no rate limiting or MFA.
- Free hosting sleeps when idle, so the first request can take about a minute.

## Future work

SMS one-time passwords, push notifications, split tokens, restoring archived plots,
Swahili, mobile payments, an admin web console.