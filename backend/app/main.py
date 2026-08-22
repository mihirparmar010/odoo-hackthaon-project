from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, auth
from .database import engine, get_db, SessionLocal
from .seed import seed_if_empty
from .routers import auth_router, trips_router, discovery_router, public_router

# Creates all tables on first run (SQLite file: globetrotter.db)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="GlobeTrotter API", version="1.0.0")

# Wide-open CORS for local development; tighten this for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


app.include_router(auth_router.router)
app.include_router(trips_router.router)
app.include_router(discovery_router.router)
app.include_router(public_router.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "GlobeTrotter API is running. See /docs"}


@app.get("/dashboard")
def dashboard(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Home screen: upcoming trips, popular cities, quick budget snapshot."""
    upcoming_trips = (
        db.query(models.Trip)
        .filter(models.Trip.owner_id == current_user.id)
        .order_by(models.Trip.start_date)
        .limit(5)
        .all()
    )
    popular_cities = (
        db.query(models.City).order_by(models.City.popularity.desc()).limit(6).all()
    )
    trip_count = (
        db.query(func.count(models.Trip.id))
        .filter(models.Trip.owner_id == current_user.id)
        .scalar()
    )

    return {
        "welcome_message": f"Welcome back, {current_user.name}!",
        "total_trips": trip_count,
        "upcoming_trips": [
            {"id": t.id, "name": t.name, "start_date": t.start_date, "end_date": t.end_date}
            for t in upcoming_trips
        ],
        "recommended_destinations": [
            {"id": c.id, "name": c.name, "country": c.country} for c in popular_cities
        ],
    }
