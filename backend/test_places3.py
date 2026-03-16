import asyncio

from dotenv import load_dotenv

load_dotenv()
from services.gemini_client import parse_contextual_intent
from services.places_service import contextual_places_search


async def main():
    intent = "quiet cafe with wifi"
    intent_parsed = await parse_contextual_intent(intent)
    keywords = intent_parsed.get("keywords", [intent])
    print(f"Keywords: {keywords}")

    # Williamsburg coordinates
    lat, lng = 40.7081, -73.9571
    radius = 0.4

    res = await contextual_places_search(lat, lng, radius, keywords)
    print("Result:", res)

if __name__ == "__main__":
    asyncio.run(main())
