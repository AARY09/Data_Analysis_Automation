import os
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root only
_project_root = Path(__file__).resolve().parent.parent.parent
_env_path = _project_root / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)


def _clean_env(value: str) -> str:
    return (value or "").strip().strip('"').strip("'")


API_KEY = _clean_env(os.getenv("OPENROUTER_API_KEY", ""))
MODEL = _clean_env(os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"))

BASE_URL = "https://openrouter.ai/api/v1"


def call_llm(prompt: str, system_prompt: str = None) -> str:
    if not API_KEY:
        raise Exception("OPENROUTER_API_KEY not found. Add it to .env in the project root.")

    url = f"{BASE_URL}/chat/completions"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "agentic-eda"
    }

    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt or "Return ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    print("🔑 KEY:", API_KEY[:10])
    print("📡 MODEL:", MODEL)

    res = requests.post(url, headers=headers, json=body)

    print("STATUS:", res.status_code)
    print("RAW:", res.text)

    if res.status_code != 200:
        raise Exception(f"LLM ERROR {res.status_code}: {res.text}")

    data = res.json()

    return data["choices"][0]["message"]["content"]