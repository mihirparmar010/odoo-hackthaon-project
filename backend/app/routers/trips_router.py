from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/trips", tags=["Trips"])


def _get_owned_trip(trip_id: int, user: models.User, db: Session) -> models.Trip:
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    return trip


def _get_owned_stop(stop_id: int, user: models.User, db: Session) -> models.Stop:
    stop = db.query(models.Stop).filter(models.Stop.id == stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    if stop.trip.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    return stop


# ---------------- Trip CRUD ----------------

@router.post("", response_model=schemas.TripOut)
def create_trip(
    trip_in: schemas.TripCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    trip = models.Trip(owner_id=current_user.id, **trip_in.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("", response_model=List[schemas.TripOut])
def list_my_trips(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Trip)
        .filter(models.Trip.owner_id == current_user.id)
        .order_by(models.Trip.start_date)
        .all()
    )


@router.get("/{trip_id}", response_model=schemas.TripDetailOut)
def get_trip(
    trip_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    trip = (
        db.query(models.Trip)
        .options(joinedload(models.Trip.stops).joinedload(models.Stop.city))
        .options(joinedload(models.Trip.stops).joinedload(models.Stop.activities))
        .filter(models.Trip.id == trip_id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    return trip


@router.patch("/{trip_id}", response_model=schemas.TripOut)
def update_trip(
    trip_id: int,
    trip_update: schemas.TripUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    trip = _get_owned_trip(trip_id, current_user, db)
    for field, value in trip_update.model_dump(exclude_unset=True).items():
        setattr(trip, field, value)
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    trip = _get_owned_trip(trip_id, current_user, db)
    db.delete(trip)
    db.commit()
    return None


# ---------------- Stops (itinerary builder) ----------------

@router.post("/{trip_id}/stops", response_model=schemas.StopOut)
def add_stop(
    trip_id: int,
    stop_in: schemas.StopCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    trip = _get_owned_trip(trip_id, current_user, db)
    city = db.query(models.City).filter(models.City.id == stop_in.city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    stop = models.Stop(trip_id=trip.id, **stop_in.model_dump())
    db.add(stop)
    db.commit()
    db.refresh(stop)
    return stop


@router.patch("/stops/{stop_id}", response_model=schemas.StopOut)
def update_stop(
    stop_id: int,
    stop_update: schemas.StopUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    stop = _get_owned_stop(stop_id, current_user, db)
    for field, value in stop_update.model_dump(exclude_unset=True).items():
        setattr(stop, field, value)
    db.commit()
    db.refresh(stop)
    return stop


@router.delete("/stops/{stop_id}", status_code=204)
def delete_stop(
    stop_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    stop = _get_owned_stop(stop_id, current_user, db)
    db.delete(stop)
    db.commit()
    return None


# ---------------- Activities assigned to a stop ----------------

@router.post("/stops/{stop_id}/activities", response_model=schemas.StopActivityOut)
def add_activity_to_stop(
    stop_id: int,
    activity_in: schemas.StopActivityCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    stop = _get_owned_stop(stop_id, current_user, db)

    name = activity_in.name
    cost = activity_in.cost or 0.0

    if activity_in.activity_catalog_id:
        catalog = db.query(models.ActivityCatalog).filter(
            models.ActivityCatalog.id == activity_in.activity_catalog_id
        ).first()
        if not catalog:
            raise HTTPException(status_code=404, detail="Catalog activity not found")
        name = name or catalog.name
        cost = activity_in.cost if activity_in.cost is not None else catalog.cost

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Provide either activity_catalog_id or a custom name",
        )

    activity = models.StopActivity(
        stop_id=stop.id,
        activity_catalog_id=activity_in.activity_catalog_id,
        name=name,
        cost=cost,
        day_date=activity_in.day_date,
        time_of_day=activity_in.time_of_day or "",
        notes=activity_in.notes or "",
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/activities/{stop_activity_id}", status_code=204)
def remove_activity(
    stop_activity_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    activity = db.query(models.StopActivity).filter(
        models.StopActivity.id == stop_activity_id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    if activity.stop.trip.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    db.delete(activity)
    db.commit()
    return None


# ---------------- Budget breakdown ----------------

@router.get("/{trip_id}/budget", response_model=schemas.BudgetBreakdown)
def get_budget(
    trip_id: int,
    daily_limit: float = 0,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    trip = _get_owned_trip(trip_id, current_user, db)

    transport = stay = meals = activities_cost = 0.0
    daily_totals = {}  # date -> cost, for over-budget-day detection

    for stop in trip.stops:
        transport += stop.transport_cost
        stay += stop.stay_cost
        meals += stop.meals_cost

        if stop.start_date and stop.end_date:
            n_days = max((stop.end_date - stop.start_date).days, 1)
            per_day_stop_cost = (stop.transport_cost + stop.stay_cost + stop.meals_cost) / n_days
            for i in range(n_days):
                day = stop.start_date + timedelta(days=i)
                daily_totals[day] = daily_totals.get(day, 0) + per_day_stop_cost

        for act in stop.activities:
            activities_cost += act.cost
            if act.day_date:
                daily_totals[act.day_date] = daily_totals.get(act.day_date, 0) + act.cost

    total = transport + stay + meals + activities_cost
    days = len(daily_totals) or (
        max((trip.end_date - trip.start_date).days, 1)
        if trip.start_date and trip.end_date else 1
    )
    per_day_avg = total / days if days else 0

    over_budget_days = []
    if daily_limit > 0:
        over_budget_days = [
            d.isoformat() for d, cost in daily_totals.items() if cost > daily_limit
        ]

    return schemas.BudgetBreakdown(
        total=round(total, 2),
        transport=round(transport, 2),
        stay=round(stay, 2),
        meals=round(meals, 2),
        activities=round(activities_cost, 2),
        per_day_average=round(per_day_avg, 2),
        days=days,
        over_budget_days=sorted(over_budget_days),
    )
