import uuid
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, Text
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_token():
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    language = Column(String, default="en")
    created_at = Column(DateTime, default=datetime.utcnow)

    trips = relationship("Trip", back_populates="owner", cascade="all, delete-orphan")


class City(Base):
    """Catalog of discoverable cities (seeded once, searchable)."""
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    country = Column(String, index=True, nullable=False)
    region = Column(String)
    cost_index = Column(Float, default=50.0)   # 0-100, higher = pricier
    popularity = Column(Integer, default=0)     # 0-100

    activities = relationship("ActivityCatalog", back_populates="city")


class ActivityCatalog(Base):
    """Catalog of discoverable activities per city (seeded, searchable)."""
    __tablename__ = "activity_catalog"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, index=True)  # sightseeing, food, adventure, culture...
    cost = Column(Float, default=0.0)
    duration_hours = Column(Float, default=1.0)
    description = Column(Text, default="")

    city = relationship("City", back_populates="activities")


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    start_date = Column(Date)
    end_date = Column(Date)
    cover_photo = Column(String, default="")
    budget_limit = Column(Float, default=0)
    is_public = Column(Boolean, default=False)
    share_token = Column(String, unique=True, index=True, default=gen_token)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="trips")
    stops = relationship(
        "Stop", back_populates="trip",
        cascade="all, delete-orphan", order_by="Stop.order_index"
    )


class Stop(Base):
    """A city visited within a trip, with its own date range and cost estimates."""
    __tablename__ = "stops"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    order_index = Column(Integer, default=0)
    start_date = Column(Date)
    end_date = Column(Date)
    transport_cost = Column(Float, default=0.0)
    stay_cost = Column(Float, default=0.0)
    meals_cost = Column(Float, default=0.0)

    trip = relationship("Trip", back_populates="stops")
    city = relationship("City")
    activities = relationship(
        "StopActivity", back_populates="stop", cascade="all, delete-orphan"
    )


class StopActivity(Base):
    """An activity assigned to a specific stop (either from the catalog or custom)."""
    __tablename__ = "stop_activities"

    id = Column(Integer, primary_key=True, index=True)
    stop_id = Column(Integer, ForeignKey("stops.id"), nullable=False)
    activity_catalog_id = Column(Integer, ForeignKey("activity_catalog.id"), nullable=True)
    name = Column(String, nullable=False)
    cost = Column(Float, default=0.0)
    day_date = Column(Date, nullable=True)
    time_of_day = Column(String, default="")  # free text e.g. "10:00 AM"
    notes = Column(Text, default="")

    stop = relationship("Stop", back_populates="activities")
    catalog_activity = relationship("ActivityCatalog")