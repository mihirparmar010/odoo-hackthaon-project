from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/public", tags=["Public Sharing"])


@router.get("/trips/{share_token}", response_model=schemas.TripDetailOut)
def view_public_trip(share_token: str, db: Session = Depends(get_db)):
    trip = (
        db.query(models.Trip)
        .options(joinedload(models.Trip.stops).joinedload(models.Stop.city))
        .options(joinedload(models.Trip.stops).joinedload(models.Stop.activities))
        .filter(models.Trip.share_token == share_token)
        .first()
    )
    if not trip or not trip.is_public:
        raise HTTPException(status_code=404, detail="Trip not found or not public")
    return trip


@router.post("/trips/{share_token}/copy", response_model=schemas.TripOut)
def copy_public_trip(
    share_token: str,
    new_owner_id: int,
    db: Session = Depends(get_db),
):
    """Copy a public trip (with all stops & activities) into another user's account."""
    original = (
        db.query(models.Trip)
        .filter(models.Trip.share_token == share_token, models.Trip.is_public == True)  # noqa: E712
        .first()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Trip not found or not public")

    new_owner = db.query(models.User).filter(models.User.id == new_owner_id).first()
    if not new_owner:
        raise HTTPException(status_code=404, detail="Target user not found")

    copy = models.Trip(
        owner_id=new_owner.id,
        name=f"{original.name} (copy)",
        description=original.description,
        start_date=original.start_date,
        end_date=original.end_date,
        cover_photo=original.cover_photo,
        is_public=False,
    )
    db.add(copy)
    db.flush()

    for stop in original.stops:
        new_stop = models.Stop(
            trip_id=copy.id,
            city_id=stop.city_id,
            order_index=stop.order_index,
            start_date=stop.start_date,
            end_date=stop.end_date,
            transport_cost=stop.transport_cost,
            stay_cost=stop.stay_cost,
            meals_cost=stop.meals_cost,
        )
        db.add(new_stop)
        db.flush()
        for act in stop.activities:
            db.add(models.StopActivity(
                stop_id=new_stop.id,
                activity_catalog_id=act.activity_catalog_id,
                name=act.name,
                cost=act.cost,
                day_date=act.day_date,
                time_of_day=act.time_of_day,
                notes=act.notes,
            ))

    db.commit()
    db.refresh(copy)
    return copy
