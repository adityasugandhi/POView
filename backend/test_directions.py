import asyncio
import os

import httpx
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

async def test_directions():
    if not API_KEY:
        print("Error: GOOGLE_MAPS_API_KEY not found in environment.")
        return

    url = "https://maps.googleapis.com/maps/api/directions/json"

    # Test coordinates: Times Square to Empire State Building
    params = {
        "origin": "40.7580,-73.9855",
        "destination": "40.7484,-73.9857",
        "mode": "walking",
        "key": API_KEY
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            data = response.json()
            status = data.get("status")
            print(f"Directions API Test Result Status: {status}")

            if status == "OK" and len(data.get("routes", [])) > 0:
                print("SUCCESS: Directions API returned valid route data.")
            elif status == "REQUEST_DENIED":
                print(f"FAILED: {data.get('error_message', 'No specific error message provided.')}")
            else:
                print(f"Other Status - Please review JSON output: {status}")

        except Exception as e:
            print(f"HTTP/Network Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_directions())
