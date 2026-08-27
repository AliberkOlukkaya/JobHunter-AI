from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.jobs import router as jobs_router
from .routes.digests import router as digests_router
from .routes.applications import router as applications_router

app = FastAPI(title="JobHunter AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(jobs_router)
app.include_router(digests_router)
app.include_router(applications_router)
