import os
import httpx
from typing import List, Dict, Any, Optional

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "YOUR_API_KEY_HERE")

# Module-level persistent HTTP client for connection reuse
_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=10.0)
    return _http_client


def _build_photo_url(photo_name: str) -> str:
    """Build a Google Places photo URL from the photo resource name."""
    return f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=400&key={API_KEY}"

async def get_autocomplete_predictions(input_text: str, lat: Optional[float] = None, lng: Optional[float] = None) -> List[Dict[str, Any]]:
    """Secure backend proxy for Google Places Autocomplete API to hide the API key.

    Args:
        input_text: The search query text.
        lat: Optional latitude to bias results toward (viewport center).
        lng: Optional longitude to bias results toward (viewport center).
    """
    url = "https://places.googleapis.com/v1/places:autocomplete"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {"input": input_text}

    if lat is not None and lng is not None:
        payload["locationBias"] = {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 50000.0,
            }
        }
    
    client = _get_client()
    try:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("suggestions", [])
    except Exception as e:
        print(f"Error fetching autocomplete: {e}")
        return []

async def get_places_details(place_id: str) -> Dict[str, Any]:
    """Retrieve details for a specific Google Place ID using Places API (New)."""
    # Clean the ID to remove any 'places/' prefixes that the autocomplete might return
    clean_id = place_id.replace("places/", "")
    url = f"https://places.googleapis.com/v1/places/{clean_id}"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "displayName,location,viewport,formattedAddress,types"
    }

    client = _get_client()
    try:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        return {
            "name": data.get("displayName", {}).get("text", ""),
            "geometry": {
                "location": {
                    "lat": data.get("location", {}).get("latitude"),
                    "lng": data.get("location", {}).get("longitude")
                },
                "viewport": data.get("viewport")
            },
            "formatted_address": data.get("formattedAddress", ""),
            "type": data.get("types", [""])[0] if data.get("types") else ""
        }
    except Exception as e:
        print(f"Error fetching place details: {e}")
        return {}

async def get_nearby_places(lat: float, lng: float, radius: float = 1000.0) -> List[Dict[str, Any]]:
    """Retrieve an array of points of interest around the coordinates using Places API (New)."""
    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.priceLevel,places.primaryType",
        "Content-Type": "application/json"
    }
    
    payload = {
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng
                },
                "radius": radius
            }
        }
    }

    client = _get_client()
    try:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        places_result = response.json()
    except Exception as e:
        print(f"Error fetching nearby places: {e}")
        return []
    
    results = places_result.get("places", [])
    
    # Deterministic Data Stripping
    stripped_data = []
    for place in results:
        p_type = place.get("primaryType", "")
        if p_type in ["locality", "political", "neighborhood", "administrative_area_level_1", "administrative_area_level_2"]:
            continue
            
        stripped_data.append({
            "name": place.get("displayName", {}).get("text", ""),
            "lat": place.get("location", {}).get("latitude"),
            "lng": place.get("location", {}).get("longitude"),
            "rating": place.get("rating", 0.0),
            "price_level": place.get("priceLevel", "PRICE_LEVEL_UNSPECIFIED"),
            "primary_type": p_type
        })
        
    return stripped_data

def format_context_payload(location_details: Dict, nearby_places: List[Dict]) -> str:
    """Formats the dense token representation for Gemini."""
    
    # Assess if we have data scarcity
    entity_count = len(nearby_places)
    scarcity_override = ""
    
    if entity_count < 5:
        # Dynamic threshold instruction override as mandated
        scarcity_override = (
            "CRITICAL CONTEXT: The provided location demonstrates extreme commercial scarcity "
            "(fewer than 5 notable entities). Do not interpret this strictly as a failure. "
            "Shift your paradigm to focus on evaluating its potential for privacy, access to natural "
            "surroundings, architectural spacing, and the lifestyle appeal of low-density environments. "
        )
        
    payload = f"{scarcity_override}\n"
    payload += f"Location: {location_details.get('name')} | Address: {location_details.get('formatted_address')} | Type: {location_details.get('type')}\n"
    payload += f"Geometry: lat: {location_details.get('geometry', {}).get('location', {}).get('lat')}, lng: {location_details.get('geometry', {}).get('location', {}).get('lng')}\n"
    payload += "--- SURROUNDING POINTS OF INTEREST ---\n"
    
    for place in nearby_places:
        payload += f"- {place['name']} (Type: {place['primary_type']}, Rating: {place['rating']}/5.0, Price Level: {place['price_level']}) | lat: {place['lat']}, lng: {place['lng']}\n"
        
    return payload

async def contextual_places_search(lat: float, lng: float, radius_miles: float, keywords: List[str]) -> Dict[str, Any]:
    """Search Google Places using keywords extracted by Gemini, restricted by radius."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.editorialSummary,places.primaryType,places.photos,places.reviews,places.regularOpeningHours,places.internationalPhoneNumber,places.websiteUri,places.formattedAddress,places.priceLevel,places.userRatingCount",
        "Content-Type": "application/json"
    }

    radius_miles = min(radius_miles, 50.0)  # hard cap at 50 miles
    radius_meters = radius_miles * 1609.34
    text_query = " ".join(keywords)

    # Text Search locationRestriction requires a rectangle — compute a bounding box.
    # 1 degree of latitude ≈ 111 km.
    import math
    lat_offset = radius_meters / 111000.0
    lng_offset = radius_meters / (111000.0 * math.cos(math.radians(lat)))
    
    south = lat - lat_offset
    north = lat + lat_offset
    west = lng - lng_offset
    east = lng + lng_offset
    
    payload = {
        "textQuery": text_query,
        "locationRestriction": {
            "rectangle": {
                "low": {
                    "latitude": south,
                    "longitude": west
                },
                "high": {
                    "latitude": north,
                    "longitude": east
                }
            }
        },
        "maxResultCount": 20
    }

    client = _get_client()
    try:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        places_result = response.json()
    except Exception as e:
        print(f"Error fetching contextual places: {e}"); print(getattr(e, "response", type("obj", (object,), {"text": ""})).text)
        return {}
            
    results = places_result.get("places", [])
    if not results:
        return []
        
    structured_results = []
    
    for place in results:
        description = place.get("editorialSummary", {}).get("text", "A place matching your criteria.")
        description = description.encode('ascii', 'ignore').decode('ascii').strip()
        name = place.get("displayName", {}).get("text", "").encode('ascii', 'ignore').decode('ascii').strip()
        
        # Extract photo URLs (up to 5)
        photo_urls = [_build_photo_url(p["name"]) for p in place.get("photos", [])[:5]]

        # Extract reviews (up to 3)
        reviews = []
        for rev in place.get("reviews", [])[:3]:
            rev_text = rev.get("text", {}).get("text", "") if isinstance(rev.get("text"), dict) else str(rev.get("text", ""))
            reviews.append({
                "authorName": rev.get("authorAttribution", {}).get("displayName", "Anonymous"),
                "rating": rev.get("rating", 0),
                "text": rev_text[:200],
                "timeAgo": rev.get("relativePublishTimeDescription", ""),
            })

        structured_results.append({
            "name": name,
            "lat": place.get("location", {}).get("latitude"),
            "lng": place.get("location", {}).get("longitude"),
            "rating": place.get("rating", 0.0),
            "description": description,
            "photoUrls": photo_urls,
            "reviews": reviews,
            "address": place.get("formattedAddress", ""),
            "phone": place.get("internationalPhoneNumber", ""),
            "website": place.get("websiteUri", ""),
            "hours": place.get("regularOpeningHours", {}).get("weekdayDescriptions", []),
            "priceLevel": place.get("priceLevel", ""),
            "ratingCount": place.get("userRatingCount", 0),
        })
        
    return structured_results

async def reverse_geocode(lat: float, lng: float) -> dict:
    """Convert lat/lng to a place ID and display name via Google Geocoding API."""
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "latlng": f"{lat},{lng}",
        "key": API_KEY,
    }

    client = _get_client()
    try:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])
        if not results:
            return {}

        # Prefer locality-level results for cleaner display names,
        # fall back to whatever Google returns first (most specific)
        preferred_types = ("locality", "neighborhood", "sublocality")
        best = next(
            (r for r in results if any(t in r.get("types", []) for t in preferred_types)),
            results[0],
        )
        return {
            "place_id": best.get("place_id", ""),
            "formatted_address": best.get("formatted_address", ""),
        }
    except Exception as e:
        print(f"Error reverse geocoding: {e}")
        return {}


async def get_directions(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    """Fetch routing directions using Google Maps Routes API v2."""
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline"
    }

    payload = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": origin_lat,
                    "longitude": origin_lng
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": dest_lat,
                    "longitude": dest_lng
                }
            }
        },
        "travelMode": "WALK"
    }

    client = _get_client()
    try:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        if "routes" in data and len(data["routes"]) > 0:
            return data["routes"][0].get("polyline", {}).get("encodedPolyline", "")
        else:
            print(f"Routes API returned no routes or error: {data}")
            return ""
    except Exception as e:
        print(f"Error fetching directions via Routes API: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response Body: {e.response.text}")
        return ""
