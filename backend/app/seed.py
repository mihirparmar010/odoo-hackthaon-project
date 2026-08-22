from sqlalchemy.orm import Session
from . import models

CITIES = [
    # name, country, region, cost_index, popularity
    ("Paris", "France", "Europe", 75, 95),
    ("Rome", "Italy", "Europe", 65, 90),
    ("Barcelona", "Spain", "Europe", 60, 88),
    ("Bangkok", "Thailand", "Asia", 30, 85),
    ("Bali", "Indonesia", "Asia", 35, 87),
    ("Tokyo", "Japan", "Asia", 80, 92),
    ("Goa", "India", "Asia", 25, 80),
    ("Jaipur", "India", "Asia", 20, 70),
    ("New York", "USA", "North America", 90, 93),
    ("Cape Town", "South Africa", "Africa", 40, 75),
    ("Dubai", "UAE", "Middle East", 70, 82),
    ("Amsterdam", "Netherlands", "Europe", 68, 78),
]

# activities keyed by city name: (name, category, cost, duration_hours, description)
ACTIVITIES = {
    "Paris": [
        ("Eiffel Tower Visit", "sightseeing", 30, 2, "Iconic tower with city views."),
        ("Louvre Museum Tour", "culture", 20, 3, "World-famous art museum."),
        ("Seine River Cruise", "sightseeing", 25, 1.5, "Evening cruise along the Seine."),
    ],
    "Rome": [
        ("Colosseum Tour", "culture", 25, 2, "Ancient Roman amphitheater."),
        ("Vatican Museums", "culture", 30, 3, "Art and history in Vatican City."),
        ("Food Walking Tour", "food", 40, 3, "Taste local Roman specialties."),
    ],
    "Barcelona": [
        ("Sagrada Familia", "sightseeing", 26, 2, "Gaudi's unfinished masterpiece."),
        ("Tapas Crawl", "food", 35, 3, "Bar-hopping tapas tour."),
        ("Beach Day", "leisure", 0, 4, "Relax at Barceloneta Beach."),
    ],
    "Bangkok": [
        ("Grand Palace Tour", "culture", 15, 2, "Historic royal palace complex."),
        ("Street Food Tour", "food", 20, 3, "Sample Bangkok's famous street food."),
        ("Chao Phraya Cruise", "sightseeing", 10, 1.5, "River cruise through the city."),
    ],
    "Bali": [
        ("Surfing Lesson", "adventure", 25, 2, "Beginner surf lesson at Kuta beach."),
        ("Ubud Rice Terrace Trek", "adventure", 15, 3, "Trek through iconic rice paddies."),
        ("Temple Hopping", "culture", 10, 4, "Visit Bali's most scenic temples."),
    ],
    "Tokyo": [
        ("Shibuya & Shinjuku Tour", "sightseeing", 20, 3, "Explore Tokyo's iconic districts."),
        ("Sushi Making Class", "food", 60, 2, "Learn to make sushi from a chef."),
        ("teamLab Digital Art", "culture", 35, 2, "Immersive digital art museum."),
    ],
    "Goa": [
        ("Beach Hopping", "leisure", 0, 4, "Explore Goa's best beaches."),
        ("Water Sports", "adventure", 30, 2, "Jet-ski, parasailing, and more."),
        ("Old Goa Churches Tour", "culture", 10, 2, "Portuguese colonial heritage sites."),
    ],
    "Jaipur": [
        ("Amber Fort Visit", "culture", 12, 3, "Majestic hilltop fort."),
        ("City Palace Tour", "culture", 10, 2, "Royal residence and museum."),
        ("Local Bazaar Shopping", "leisure", 0, 2, "Shop for textiles and jewelry."),
    ],
    "New York": [
        ("Statue of Liberty Tour", "sightseeing", 25, 3, "Ferry ride and iconic statue."),
        ("Broadway Show", "culture", 100, 3, "Watch a live Broadway performance."),
        ("Central Park Walk", "leisure", 0, 2, "Stroll through the famous park."),
    ],
    "Cape Town": [
        ("Table Mountain Hike", "adventure", 20, 4, "Hike or cable car to the summit."),
        ("Cape Point Tour", "sightseeing", 35, 5, "Scenic coastal drive and views."),
        ("Wine Tasting", "food", 30, 3, "Tour Stellenbosch wine estates."),
    ],
    "Dubai": [
        ("Desert Safari", "adventure", 50, 4, "Dune bashing and Bedouin camp dinner."),
        ("Burj Khalifa Observation Deck", "sightseeing", 40, 1.5, "World's tallest building."),
        ("Dubai Mall & Fountain Show", "leisure", 0, 2, "Shopping and fountain show."),
    ],
    "Amsterdam": [
        ("Canal Cruise", "sightseeing", 18, 1.5, "See the city from its canals."),
        ("Van Gogh Museum", "culture", 20, 2, "Extensive Van Gogh collection."),
        ("Bike Tour", "adventure", 25, 3, "Cycle through the city like a local."),
    ],
}


def seed_if_empty(db: Session):
    if db.query(models.City).first():
        return  # already seeded

    name_to_city = {}
    for name, country, region, cost_index, popularity in CITIES:
        city = models.City(
            name=name, country=country, region=region,
            cost_index=cost_index, popularity=popularity,
        )
        db.add(city)
        db.flush()
        name_to_city[name] = city

    for city_name, activities in ACTIVITIES.items():
        city = name_to_city.get(city_name)
        if not city:
            continue
        for name, category, cost, duration, desc in activities:
            db.add(models.ActivityCatalog(
                city_id=city.id, name=name, category=category,
                cost=cost, duration_hours=duration, description=desc,
            ))

    db.commit()
