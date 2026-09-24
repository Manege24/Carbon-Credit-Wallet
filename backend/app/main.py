from fastapi import FastAPI
from app.core.config import settings
from app.routers import admin, auth, plots, sync, tokens

docs_kwargs = {} if settings.expose_api_docs else {"docs_url": None, "redoc_url": None}
app = FastAPI(title="Carbon Credit Wallet API", version="0.2.0", **docs_kwargs)

app.include_router(auth.router)
app.include_router(plots.router)
app.include_router(tokens.router)
app.include_router(admin.router)
app.include_router(sync.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}