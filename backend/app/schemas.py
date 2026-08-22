from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Auth / User ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr
    language: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- City / Activity catalog ----------
class CityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    country: str
    region: Optional[str] = None
    cost_index: float
    popularity: int


class ActivityCatalogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    city_id: int
    name: str
    category: str
    cost: float
    duration_hours: float
    description: str


# ---------- Trip ----------
class TripCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    cover_photo: Optional[str] = ""


class TripUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    cover_photo: Optional[str] = None
    is_public: Optional[bool] = None


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    start_date: Optional[date]
    end_date: Optional[date]
    cover_photo: str
    is_public: bool
    share_token: str
    created_at: datetime


# ---------- Stop ----------
class StopCreate(BaseModel):
    city_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_index: Optional[int] = 0
    transport_cost: Optional[float] = 0.0
    stay_cost: Optional[float] = 0.0
    meals_cost: Optional[float] = 0.0


class StopUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_index: Optional[int] = None
    transport_cost: Optional[float] = None
    stay_cost: Optional[float] = None
    meals_cost: Optional[float] = None


class StopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    trip_id: int
    city: CityOut
    order_index: int
    start_date: Optional[date]
    end_date: Optional[date]
    transport_cost: float
    stay_cost: float
    meals_cost: float


# ---------- Stop Activity ----------
class StopActivityCreate(BaseModel):
    activity_catalog_id: Optional[int] = None
    name: Optional[str] = None   # required if activity_catalog_id not given
    cost: Optional[float] = None
    day_date: Optional[date] = None
    time_of_day: Optional[str] = ""
    notes: Optional[str] = ""


class StopActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stop_id: int
    name: str
    cost: float
    day_date: Optional[date]
    time_of_day: str
    notes: str


# ---------- Composite / detail views ----------
class StopDetailOut(StopOut):
    activities: List[StopActivityOut] = []


class TripDetailOut(TripOut):
    stops: List[StopDetailOut] = []


class BudgetBreakdown(BaseModel):
    total: float
    transport: float
    stay: float
    meals: float
    activities: float
    per_day_average: float
    days: int
    over_budget_days: List[str] = []
