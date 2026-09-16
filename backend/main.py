import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import router as auth_router
from routes.message_shooter import router as message_shooter_router
from routes.lead_distributor import router as lead_distributor_router

app = FastAPI(
    title="Automation Dashboard API",
    description="Real estate broker automation",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth_router)
app.include_router(message_shooter_router)
app.include_router(lead_distributor_router)

@app.get("/")
async def root():
    return {"message": "Automation Dashboard API is running!"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)