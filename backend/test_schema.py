from google import genai
from google.genai import types
from pydantic import BaseModel


class ScoreDetail(BaseModel):
    value: int
    note: str

class Scores(BaseModel):
    walkability: ScoreDetail

class Profile(BaseModel):
    name: str
    scores: Scores

from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

print("Testing Pydantic Schema...")
try:
    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents="Give me a simple profile for New York.",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=Profile,
            temperature=0.4
        )
    )
    print("Pydantic Success:", response.text)
except Exception as e:
    print("Pydantic Error!!!", e)

print("\n----------------\nTesting Raw Dict...")
raw_schema = {
    "type": "OBJECT",
    "properties": {
        "name": {"type": "STRING"},
        "scores": {
            "type": "OBJECT",
            "properties": {
                "walkability": {
                    "type": "OBJECT",
                    "properties": {
                        "value": {"type": "INTEGER"},
                        "note": {"type": "STRING"}
                    }
                }
            }
        }
    }
}

try:
    response2 = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents="Give me a simple profile for New York.",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=raw_schema,
            temperature=0.4
        )
    )
    print("Raw Dict Success:", response2.text)
except Exception as e:
    print("Raw Dict Error!!!", e)
