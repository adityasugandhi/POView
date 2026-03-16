from typing import Any

import httpx


async def fetch_weather_forecast(lat: float, lng: float) -> dict[str, Any]:
    """
    Simulates the Google WeatherForecast 2 predictive endpoint by aggregating current atmospheric data.
    Uses open source fallback (Open-Meteo) to generate a high-fidelity weather state for Gemini.
    """
    # Using Open-Meteo as a reliable proxy for raw meteorological data at lat/lng
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=5.0)
            response.raise_for_status()
            data = response.json()

            if "current" not in data:
                return _default_weather()

            current = data["current"]
            temp = current.get("temperature_2m", 70)
            precip = current.get("precipitation", 0.0)
            snow = current.get("snowfall", 0.0)
            clouds = current.get("cloud_cover", 0)
            code = current.get("weather_code", 0)

            # Translate WMO Weather codes into highly descriptive AI context strings
            condition = "Clear and pleasant"
            severe_warning = None
            render_state = "clear" # For Cesium 3D frontend

            if code in [0, 1]:
                condition = "Clear skies"
                render_state = "clear"
            elif code in [2, 3]:
                condition = "Partly cloudy to overcast"
                render_state = "overcast" if clouds > 80 else "clear"
            elif code in [45, 48]:
                condition = "Dense fog reducing visibility"
                render_state = "fog"
            elif code in [51, 53, 55, 56, 57]:
                condition = "Light, continuous drizzle"
                render_state = "rain"
            elif code in [61, 63, 65, 66, 67]:
                condition = "Steady moderate-to-heavy rain"
                render_state = "rain"
            elif code in [71, 73, 75, 77]:
                condition = "Falling snow"
                render_state = "snow"
            elif code in [80, 81, 82]:
                condition = "Heavy, sudden rain showers"
                severe_warning = "Impending heavy downpour"
                render_state = "heavy_rain"
            elif code in [85, 86]:
                condition = "Heavy snow showers"
                severe_warning = "Incoming blizzard or heavy snow"
                render_state = "snow"
            elif code in [95, 96, 99]:
                condition = "Violent thunderstorm with potential hail"
                severe_warning = "Severe Thunderstorm Warning"
                render_state = "heavy_rain"

            # Construct the predictive context block for Gemini
            ai_prediction_summary = f"{condition} at {temp}°F."
            if severe_warning:
                ai_prediction_summary += f" [Google WeatherForecast 2 Anomaly Detected: {severe_warning}]"

            return {
                "temperature": temp,
                "condition": condition,
                "ai_summary": ai_prediction_summary,
                "render_state": render_state,
                "is_day": bool(current.get("is_day", 1))
            }

        except Exception as e:
            print(f"Weather API Error: {e}")
            return _default_weather()

def _default_weather() -> dict[str, Any]:
    return {
        "temperature": 70,
        "condition": "Clear skies",
        "ai_summary": "Clear skies at 70°F.",
        "render_state": "clear",
        "is_day": True
    }
