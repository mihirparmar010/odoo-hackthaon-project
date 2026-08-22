# GlobeTrotter Backend (FastAPI + SQLite)

Minimal, fast backend covering every core GlobeTrotter feature:
auth, trips, itinerary (stops + activities), city/activity discovery
search, budget breakdown, public sharing, and a dashboard summary.

## Why this stack
- **FastAPI** — auto-generates interactive docs (`/docs`), fast to write, fast to run.
- **SQLite** — a real relational database with zero setup (one file, no server to
  install). Swap one line in `app/database.py` for Postgres later; nothing
  else changes because SQLAlchemy abstracts the SQL.
- **SQLAlchemy** — the "relational database" requirement: Users, Trips, Stops,
  Activities are proper linked tables with foreign keys, not JSON blobs.
- **JWT (python-jose) + bcrypt (passlib)** — standard, secure auth without
  needing a separate auth service.

## 1. Install

```bash
cd globetrotter
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000
- Interactive docs (Swagger UI — test every endpoint from the browser):
  http://localhost:8000/docs

On first run it creates `globetrotter.db` (SQLite file) and auto-seeds
12 sample cities with activities so search works immediately.

## 3. How the features map to endpoints

| Screen (from your spec)          | Endpoint(s) |
|-----------------------------------|-------------|
| Login / Signup                    | `POST /auth/signup`, `POST /auth/login` |
| Dashboard / Home                  | `GET /dashboard` |
| Create Trip                       | `POST /trips` |
| My Trips (list)                   | `GET /trips` |
| Itinerary Builder (add stops)     | `POST /trips/{id}/stops`, `PATCH /trips/stops/{id}`, `DELETE /trips/stops/{id}` |
| Itinerary View                    | `GET /trips/{id}` (full nested trip → stops → activities) |
| City Search                       | `GET /cities?q=&country=&region=&max_cost_index=` |
| Activity Search                   | `GET /activities?q=&category=&max_cost=`, `GET /cities/{id}/activities` |
| Assign activity to a stop         | `POST /trips/stops/{stop_id}/activities` |
| Trip Budget & Cost Breakdown      | `GET /trips/{id}/budget?daily_limit=` |
| Trip Calendar / Timeline          | Same as Itinerary View — `activities` carry `day_date` + `time_of_day`, group by date on the frontend |
| Shared/Public Itinerary View      | `GET /public/trips/{share_token}` (no login needed) |
| Copy a public trip                | `POST /public/trips/{share_token}/copy?new_owner_id=` |
| User Profile / Settings           | `GET /auth/me`, `PATCH /auth/me`, `DELETE /auth/me` |

Admin/Analytics dashboard was marked optional in your spec — not built here to
keep this minimal; easy to add later as a `/admin` router with `func.count()`
queries over the same tables.

## 4. Project structure

```
app/
  main.py              FastAPI app, startup seeding, dashboard endpoint
  database.py          SQLite engine/session setup
  models.py            SQLAlchemy tables (User, City, ActivityCatalog,
                        Trip, Stop, StopActivity)
  schemas.py            Pydantic request/response shapes
  auth.py              password hashing + JWT
  seed.py              sample cities/activities, loaded once on first run
  routers/
    auth_router.py     signup/login/profile
    trips_router.py    trip + stop + activity CRUD + budget
    discovery_router.py city/activity search
    public_router.py   public share view + copy trip
```

## 5. Auth in Swagger UI
Click "Authorize" in `/docs`, or just pass the header manually:
```
Authorization: Bearer <access_token from /auth/login response>
```

## 6. Notes / what to change before production
- `SECRET_KEY` in `app/auth.py` is a placeholder — set it from an environment
  variable (e.g. `os.environ["JWT_SECRET"]`).
- CORS is wide open (`allow_origins=["*"]`) for local dev — restrict it to
  your actual frontend origin later.
- Cover-photo upload only stores a URL/path string right now — wire up actual
  file storage (local disk or S3) if you need real image uploads.
