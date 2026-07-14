#!/usr/bin/env python3
"""Refresh the checked-in Bangumi cache without third-party dependencies."""

import json
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_URL = "https://api.bgm.tv/v0/users/1024520/collections"
DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "bangumi.json"
LIMIT = 30


def fetch_page(offset: int) -> list[dict]:
    query = urlencode(
        {
            "subject_type": 2,
            "type": 2,
            "limit": LIMIT,
            "offset": offset,
        }
    )
    request = Request(
        f"{API_URL}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "haoyuehx.github.io/1.0 (https://haoyuehx.github.io/)",
        },
    )
    with urlopen(request, timeout=20) as response:
        payload = json.load(response)
    return payload.get("data", [])


def fetch_bangumi_data() -> list[dict]:
    items: list[dict] = []
    offset = 0
    while True:
        page = fetch_page(offset)
        items.extend(page)
        if len(page) < LIMIT:
            return items
        offset += LIMIT


def write_atomically(items: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(dir=DATA_FILE.parent, prefix="bangumi-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(items, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temp_name, DATA_FILE)
    except Exception:
        Path(temp_name).unlink(missing_ok=True)
        raise


def main() -> int:
    try:
        items = fetch_bangumi_data()
        if not items:
            raise RuntimeError("API returned no collections")
        write_atomically(items)
        print(f"Updated {DATA_FILE} with {len(items)} entries")
        return 0
    except Exception as error:
        print(f"Bangumi refresh failed; keeping the existing cache: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
