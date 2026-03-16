import asyncio

from dotenv import load_dotenv

from services.places_service import get_directions

load_dotenv()

async def test():
    # Times Sq to Empire State
    polyline = await get_directions(40.7580, -73.9855, 40.7484, -73.9857)
    if polyline:
        print(f"SUCCESS! Got Polyline: {polyline[:50]}...")
    else:
        print("FAILED to get polyline.")

if __name__ == "__main__":
    asyncio.run(test())
