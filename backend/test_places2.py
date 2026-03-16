import asyncio

from dotenv import load_dotenv

load_dotenv()
from services.places_service import contextual_places_search


async def main():
    print("Testing...")
    res = await contextual_places_search(40.71, -73.96, 0.4, ["quiet cafe"])
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
