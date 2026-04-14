#!/usr/bin/env python3
"""
Manual backfill for missing dates.

Usage:
    python3 backfill.py --date 2026-04-12 \
        --at-e10 1.74 --at-diesel 2.10 \
        --de-e10 2.08 --de-diesel 2.26

The entry is inserted in chronological order. If the date already
exists the script exits without making changes.
"""

import argparse
import json
from pathlib import Path

DATA_FILE = Path(__file__).parent / "src" / "data.json"

INDEX_BASE = {
    "at_e10":    1.94,
    "at_diesel": 2.26,
    "de_e10":    2.141,
    "de_diesel": 2.342,
}


def main():
    parser = argparse.ArgumentParser(description="Backfill a missing price entry")
    parser.add_argument("--date",       required=True,  help="ISO date, e.g. 2026-04-12")
    parser.add_argument("--at-e10",     required=True,  type=float)
    parser.add_argument("--at-diesel",  required=True,  type=float)
    parser.add_argument("--de-e10",     required=True,  type=float)
    parser.add_argument("--de-diesel",  required=True,  type=float)
    args = parser.parse_args()

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    if any(row["date"] == args.date for row in data):
        print(f"Entry for {args.date} already exists — nothing to do.")
        return

    entry = {
        "date":             args.date,
        "at_e10":           args.at_e10,
        "at_diesel":        args.at_diesel,
        "de_e10":           args.de_e10,
        "de_diesel":        args.de_diesel,
        "at_e10_index":     (args.at_e10    / INDEX_BASE["at_e10"])    * 100,
        "at_diesel_index":  (args.at_diesel / INDEX_BASE["at_diesel"]) * 100,
        "de_e10_index":     (args.de_e10    / INDEX_BASE["de_e10"])    * 100,
        "de_diesel_index":  (args.de_diesel / INDEX_BASE["de_diesel"]) * 100,
        "spread_e10":       args.at_e10    - args.de_e10,
        "spread_diesel":    args.at_diesel - args.de_diesel,
    }

    data.append(entry)
    data.sort(key=lambda r: r["date"])

    DATA_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Inserted entry for {args.date} into {DATA_FILE}")


if __name__ == "__main__":
    main()
