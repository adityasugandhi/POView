import asyncio

from dotenv import load_dotenv

load_dotenv()
from services.places_service import get_places_details


async def main():
    print("Testing get_places_details with Autocomplete place_id...")
    # This is the exact ID returned by the autocomplete for Williamsburg
    res = await get_places_details("ChIJQSrBBv1bwokRbNfFHCnyeYI")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
