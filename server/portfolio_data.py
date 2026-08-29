import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "portfolio.json"


def load_data() -> dict:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
