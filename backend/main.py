import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine
from backend.models import Base
from backend.routes.auth import router as auth_router
from backend.routes.calling import router as calling_router
from backend.routes.lead_distributor import router as lead_distributor_router
from backend.routes.message_shooter import router as message_shooter_router
from backend.routes.test import router as test_router
from backend.services.scheduler_service import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Automation Dashboard API",
    description="Real estate broker automation platform",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(message_shooter_router)
app.include_router(lead_distributor_router)
app.include_router(calling_router)
app.include_router(test_router)


@app.get("/")
async def root():
    return {"service": "automation-dashboard", "status": "running", "version": app.version}


@app.get("/health")
async def health():
    return {"status": "ok"}
