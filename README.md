# Mobile-Based Carbon Credit Wallet

Offline-first mobile wallet for smallholder farmers. Tree survival is verified
with Sentinel-2 satellite imagery (NDVI), and verified trees earn carbon credit tokens.

## Structure
- `backend/` - FastAPI + SQLAlchemy backend (Sprints 2-3): auth, plots, tokens, ledger, NDVI engine
- `frontend/` - React Native (Expo) farmer app (Sprint 4-5): login, plots, tree batches, balance, history, offline sync
- `android/` - earlier Kotlin prototype, kept only on branch `sprint4-android-app`

## Run the backend