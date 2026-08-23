from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(tags=["Discovery"])


@router.get("/cities", response_model=List[schemas.CityOut])
def search_cities(
    q: Optional[str] = Query(None, description="Search by city name"),
    country: Optional[str] = None,
    region: Optional[str] = None,
    max_cost_index: Optional[float] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.City)
    if q:
        query = query.filter(models.City.name.ilike(f"%{q}%"))
    if country:
        query = query.filter(models.City.country.ilike(f"%{country}%"))
    if region:
        query = query.filter(models.City.region.ilike(f"%{region}%"))
    if max_cost_index is not None:
        query = query.filter(models.City.cost_index <= max_cost_index)
    return query.order_by(models.City.popularity.desc()).limit(50).all()


@router.get("/cities/{city_id}/activities", response_model=List[schemas.ActivityCatalogOut])
def city_activities(
    city_id: int,
    category: Optional[str] = None,
    max_cost: Optional[float] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.ActivityCatalog).filter(
        models.ActivityCatalog.city_id == city_id
    )
    if category:
        query = query.filter(models.ActivityCatalog.category.ilike(f"%{category}%"))
    if max_cost is not None:
        query = query.filter(models.ActivityCatalog.cost <= max_cost)
    return query.all()


@router.get("/activities", response_model=List[schemas.ActivityCatalogOut])
def search_activities(
    q: Optional[str] = Query(None, description="Search by activity name"),
    category: Optional[str] = None,
    max_cost: Optional[float] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.ActivityCatalog)
    if q:
        query = query.filter(models.ActivityCatalog.name.ilike(f"%{q}%"))
    if category:
        query = query.filter(models.ActivityCatalog.category.ilike(f"%{category}%"))
    if max_cost is not None:
        query = query.filter(models.ActivityCatalog.cost <= max_cost)
    return query.limit(50).all()
