"""FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.whatsapp import router as whatsapp_router
from app.db.database import Base, engine
from app.db import models  # noqa: F401 - ensures models are registered on Base before create_all

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # MVP: create tables directly from the models on startup. A real
    # deployment would use Alembic migrations instead.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Invoice Guard", version="0.1.0", lifespan=lifespan)

app.include_router(whatsapp_router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
