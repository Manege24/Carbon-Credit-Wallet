# Mobile-Based Carbon Credit Wallet

Offline-first mobile wallet for smallholder farmers. Tree survival is verified
with Sentinel-2 satellite imagery (NDVI), and verified trees earn carbon credit tokens.

## Structure
- `backend/` - FastAPI + SQLAlchemy backend: auth, plots, tokens, ledger, NDVI verification engine
- `frontend/` - React Native (Expo SDK 58) farmer app: registration, login, home dashboard,
  plot and tree-batch recording, plot detail, satellite history, notifications,
  offline storage with automatic sync, auto-logout on expired session
- Buyers and Admins use the API directly (Swagger UI)

## Run the backend
```
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Swagger UI: http://localhost:8000/docs

Copy `backend/.env.example` to `backend/.env` and set the values. Never commit `.env`.
Set `IMAGERY_PROVIDER=stub` (simulated) or `copernicus` (real Sentinel-2 data).

## Run the app
```
cd frontend
npx expo start --clear
```
Copy `frontend/.env.example` to `frontend/.env` and set `EXPO_PUBLIC_API_URL`
to your PC's Wi-Fi address (check with `ipconfig`). Phone and PC must be on the same network.

## Tests
```
cd backend
python -m pytest -v
```