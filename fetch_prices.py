#!/usr/bin/env python3
"""
Fuel price fetcher for Spritpreisbremse.

Fetches daily average prices from:
  - Austria:  E-Control Spritpreisrechner API (no key required)
  - Germany:  Tankerkoenig API (free key at https://onboarding.tankerkoenig.de)

Usage:
    TANKERKOENIG_API_KEY=your_key python fetch_prices.py

The script is idempotent: if today's date already exists in data.json it exits
without making any changes. Safe to call multiple times per day.
"""

import json
import os
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Inside Docker, DATA_DIR=/app/data (mounted host volume).
# Locally (no env var), falls back to src/data.json in the repo.
_data_dir = os.environ.get("DATA_DIR")
DATA_FILE = Path(_data_dir) / "data.json" if _data_dir else Path(__file__).parent / "src" / "data.json"

# meta.json always lives in src/ so Vite can import it at build time.
META_FILE = Path(__file__).parent / "src" / "meta.json"

# Fixed reference date: 2026-03-31 = 100 for all indices.
# Update these if the benchmark date is ever changed in App.jsx.
INDEX_BASE = {
    "at_e10":    1.94,
    "at_diesel": 2.26,
    "de_e10":    2.141,
    "de_diesel": 2.342,
}

# Austrian Bundesland codes used by the E-Control API
# 1=Burgenland, 2=Kärnten, 3=Niederösterreich, 4=Oberösterreich,
# 5=Salzburg, 6=Steiermark, 7=Tirol, 8=Vorarlberg, 9=Wien
AT_REGION_CODES = list(range(1, 10))

TANKERKOENIG_KEY = os.environ.get("TANKERKOENIG_API_KEY", "")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch_json(url: str):
    req = urllib.request.Request(
        url, headers={"User-Agent": "Spritpreisbremse-Fetcher/1.0"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Austria — E-Control Spritpreisrechner API
# ---------------------------------------------------------------------------

def fetch_at_prices() -> dict:
    """
    Queries each Bundesland and returns the unweighted national mean for
    Super (E10) and Diesel.

    E-Control API docs: https://api.e-control.at/sprit/1.0/doc/
    Fuel type codes: SUP = Super 95 / E10,  DIE = Diesel
    """
    e10_prices    = []
    diesel_prices = []

    for code in AT_REGION_CODES:
        for fuel_code, bucket in (("SUP", e10_prices), ("DIE", diesel_prices)):
            url = (
                "https://api.e-control.at/sprit/1.0/search/gas-stations/by-region"
                f"?code={code}&type=BL&fuelType={fuel_code}&includeClosed=false"
            )
            try:
                stations = fetch_json(url)
                for station in stations:
                    for p in station.get("prices", []):
                        amount = p.get("amount")
                        if amount and amount > 0:
                            bucket.append(float(amount))
            except Exception as exc:
                print(
                    f"  [warn] E-Control fetch failed (code={code}, fuel={fuel_code}): {exc}",
                    file=sys.stderr,
                )

    if not e10_prices:
        raise RuntimeError("E-Control: no E10 prices returned — check API or region codes")
    if not diesel_prices:
        raise RuntimeError("E-Control: no diesel prices returned — check API or region codes")

    return {
        "at_e10":    round(sum(e10_prices)    / len(e10_prices),    3),
        "at_diesel": round(sum(diesel_prices) / len(diesel_prices), 3),
    }


# ---------------------------------------------------------------------------
# Germany — Tankerkoenig API
# ---------------------------------------------------------------------------

# Representative cities spread across Germany (lat, lng).
# The list endpoint returns up to ~10 open stations per query within the given
# radius. Querying ~15 geographically spread cities yields a solid national
# sample of ~100-150 stations.
DE_SAMPLE_CITIES = [
    (52.52,  13.40),   # Berlin
    (53.55,  10.00),   # Hamburg
    (48.14,  11.58),   # Munich
    (50.94,   6.96),   # Cologne
    (50.11,   8.68),   # Frankfurt
    (48.78,   9.18),   # Stuttgart
    (51.51,   7.46),   # Dortmund
    (51.34,  12.37),   # Leipzig
    (51.05,  13.74),   # Dresden
    (49.45,  11.08),   # Nuremberg
    (52.37,   9.73),   # Hanover
    (53.08,   8.80),   # Bremen
    (47.99,   7.84),   # Freiburg
    (54.32,  10.13),   # Kiel
    (50.98,  11.03),   # Erfurt
]
DE_RADIUS_KM = 10


def fetch_de_prices() -> dict:
    """
    Queries Tankerkoenig list endpoint for a spread of German cities and
    returns the mean E10 and Diesel price across all open stations found.

    Requires a free API key from https://onboarding.tankerkoenig.de
    Set via environment variable: TANKERKOENIG_API_KEY

    Note: activate the key via the confirmation email before first use.
    """
    if not TANKERKOENIG_KEY:
        raise RuntimeError(
            "TANKERKOENIG_API_KEY is not set. "
            "Register for a free key at https://onboarding.tankerkoenig.de"
        )

    e10_prices    = []
    diesel_prices = []
    seen_ids      = set()   # avoid double-counting stations near city borders

    for lat, lng in DE_SAMPLE_CITIES:
        url = (
            "https://creativecommons.tankerkoenig.de/json/list.php"
            f"?lat={lat}&lng={lng}&rad={DE_RADIUS_KM}&type=all&sort=dist"
            f"&apikey={TANKERKOENIG_KEY}"
        )
        try:
            data = fetch_json(url)
            if not data.get("ok"):
                print(
                    f"  [warn] Tankerkoenig: {data.get('message', 'unknown error')} "
                    f"(lat={lat}, lng={lng})",
                    file=sys.stderr,
                )
                continue
            for s in data.get("stations", []):
                sid = s.get("id")
                if sid in seen_ids:
                    continue
                seen_ids.add(sid)
                if s.get("e10") and s["e10"] > 0:
                    e10_prices.append(float(s["e10"]))
                if s.get("diesel") and s["diesel"] > 0:
                    diesel_prices.append(float(s["diesel"]))
        except Exception as exc:
            print(
                f"  [warn] Tankerkoenig fetch failed (lat={lat}, lng={lng}): {exc}",
                file=sys.stderr,
            )

    if not e10_prices:
        raise RuntimeError("Tankerkoenig: no E10 prices returned — check API key activation")
    if not diesel_prices:
        raise RuntimeError("Tankerkoenig: no Diesel prices returned — check API key activation")

    return {
        "de_e10":    round(sum(e10_prices)    / len(e10_prices),    3),
        "de_diesel": round(sum(diesel_prices) / len(diesel_prices), 3),
    }


# ---------------------------------------------------------------------------
# Entry assembly
# ---------------------------------------------------------------------------

def calc_index(price: float, base: float) -> float:
    """Returns price relative to the base date (base = 100)."""
    return (price / base) * 100


def build_entry(today: str, at: dict, de: dict) -> dict:
    entry = {"date": today}
    entry.update(at)
    entry.update(de)

    entry["at_e10_index"]    = calc_index(at["at_e10"],    INDEX_BASE["at_e10"])
    entry["at_diesel_index"] = calc_index(at["at_diesel"], INDEX_BASE["at_diesel"])
    entry["de_e10_index"]    = calc_index(de["de_e10"],    INDEX_BASE["de_e10"])
    entry["de_diesel_index"] = calc_index(de["de_diesel"], INDEX_BASE["de_diesel"])

    # Spread: AT − DE (negative = AT cheaper than DE)
    entry["spread_e10"]    = at["at_e10"]    - de["de_e10"]
    entry["spread_diesel"] = at["at_diesel"] - de["de_diesel"]

    return entry


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def write_meta() -> None:
    """Write the current UTC timestamp to meta.json so the UI can display it."""
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    META_FILE.write_text(
        json.dumps({"lastFetch": fetched_at}, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    today = date.today().isoformat()

    existing: list = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    if any(row["date"] == today for row in existing):
        print(f"Entry for {today} already exists — nothing to do.")
        write_meta()   # still record the cron run time so the UI stays current
        return

    print(f"Fetching prices for {today} …")

    at = fetch_at_prices()
    print(f"  AT  E10={at['at_e10']:.3f} €  Diesel={at['at_diesel']:.3f} €")

    de = fetch_de_prices()
    print(f"  DE  E10={de['de_e10']:.3f} €  Diesel={de['de_diesel']:.3f} €")

    entry = build_entry(today, at, de)
    existing.append(entry)

    DATA_FILE.write_text(
        json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    write_meta()
    print(f"Done — appended entry for {today} to {DATA_FILE}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
