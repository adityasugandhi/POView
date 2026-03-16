import asyncio

import polyline
from dotenv import load_dotenv

load_dotenv() # Load variables FIRST

# Now import the service so os.getenv inside it captures the loaded variables
from services.places_service import get_directions


async def fetch_route(lat, lng, rec_lat, rec_lng):
    try:
        directions = await get_directions(lat, lng, rec_lat, rec_lng)
        print("Raw Encoded Polyline string length:", len(directions) if directions else "None")
        path = polyline.decode(directions) if directions else [
            [lat, lng],
            [rec_lat, rec_lng]
        ]
        return path
    except Exception as e:
        print(f"Directions API fallback to straight line: {e}")
        return [
            [lat, lng],
            [rec_lat, rec_lng]
        ]

if __name__ == "__main__":
    path = asyncio.run(fetch_route(40.7300, -73.9950, 40.7350, -73.9900))
    print("Result path length:", len(path))
    if len(path) == 2:
        print("Fell back to straight line.")
    else:
        print("Successfully decoded path.")
