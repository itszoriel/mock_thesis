#!/usr/bin/env python3
"""Seed Zambales municipalities/barangays and municipal admin accounts.

Usage:
    # Ensure DATABASE_URL points to your Postgres/SQLite database
    # Example (PowerShell):
    #   $env:DATABASE_URL = "postgresql+psycopg://user:pass@host/db?sslmode=require"
    # Then run:
    #   python apps/api/scripts/seed_admins_locations.py \
    #       --locations data/locations/philippines_full_locations.json \
    #       --municipality-meta data/locations/zambales_municipalities.json \
    #       --admins-file data/admins_gmails.txt

The script is idempotent: it will upsert municipalities, replace their
barangay listings using the provided dataset, and create admin accounts for
each municipality listed in ``admins_gmails.txt`` when they do not yet exist.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Dict, Iterable, List, Tuple


# Ensure project root is importable (../../.. from this file)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '../../..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.app import create_app  # noqa: E402
from apps.api import db  # noqa: E402
from apps.api.models.municipality import Municipality, Barangay  # noqa: E402

# Reuse helper functions for admin parsing/creation
try:  # pragma: no cover - direct import from companion script
    from apps.api.scripts.reset_and_seed import (  # type: ignore
        parse_markdown_admins_table,
        create_admin_accounts_from_entries,
    )
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "Unable to import admin seeding helpers from reset_and_seed.py"
    ) from exc


def slugify(value: str) -> str:
    """Convert a string into a filesystem/URL friendly slug."""

    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-")


def load_zambales_data(
    locations_path: str, meta_path: str
) -> List[Tuple[str, Dict[str, str], List[str]]]:
    """Load Zambales municipalities and barangays from the provided files."""

    if not os.path.exists(locations_path):
        raise FileNotFoundError(f"Locations file not found: {locations_path}")
    if not os.path.exists(meta_path):
        raise FileNotFoundError(f"Municipality meta file not found: {meta_path}")

    with open(locations_path, "r", encoding="utf-8") as f:
        provinces = json.load(f)

    zambales = provinces.get("Zambales")
    if not isinstance(zambales, dict):
        raise ValueError("Zambales section not found or invalid in locations file")

    with open(meta_path, "r", encoding="utf-8") as f:
        municipality_meta = json.load(f)

    payload: List[Tuple[str, Dict[str, str], List[str]]] = []
    for muni_name, barangays in zambales.items():
        if muni_name not in municipality_meta:
            raise ValueError(
                f"Missing PSGC metadata for municipality '{muni_name}' in {meta_path}"
            )
        if not isinstance(barangays, Iterable):
            raise ValueError(f"Barangay list invalid for municipality '{muni_name}'")

        meta = municipality_meta[muni_name]
        payload.append((muni_name, meta, list(barangays)))

    return payload


def upsert_municipalities(payload: List[Tuple[str, Dict[str, str], List[str]]]) -> None:
    """Upsert municipalities and replace barangay listings."""

    created = 0
    updated = 0
    barangays_created = 0

    for muni_name, meta, barangays in payload:
        slug = slugify(muni_name)
        psgc_code = meta.get("psgc_code")
        if not psgc_code:
            raise ValueError(f"PSGC code missing for municipality '{muni_name}'")

        municipality = Municipality.query.filter_by(slug=slug).first()
        if municipality is None:
            municipality = Municipality(
                name=muni_name,
                slug=slug,
                psgc_code=psgc_code,
                description=meta.get("description") or f"Municipality of {muni_name}",
                is_active=True,
            )
            db.session.add(municipality)
            db.session.flush()
            created += 1
        else:
            municipality.name = muni_name
            municipality.slug = slug
            municipality.psgc_code = psgc_code
            municipality.is_active = True
            if not municipality.description:
                municipality.description = f"Municipality of {muni_name}"
            updated += 1

            # Remove existing barangays so we can replace with the dataset
            db.session.query(Barangay).filter_by(municipality_id=municipality.id).delete(
                synchronize_session=False
            )
            db.session.flush()

            # Replace current barangays with incoming dataset
            for brgy in municipality.barangays.all():
                db.session.delete(brgy)

        seen_slugs = set()
        for idx, brgy_name in enumerate(barangays, start=1):
            brgy_name = brgy_name.strip()
            if not brgy_name:
                continue

            base_slug = slugify(brgy_name) or f"barangay-{idx}"
            brgy_slug = base_slug
            suffix = 2
            while brgy_slug in seen_slugs:
                brgy_slug = f"{base_slug}-{suffix}"
                suffix += 1
            seen_slugs.add(brgy_slug)

            brgy_psgc = f"{psgc_code}{idx:03d}" if psgc_code else None

            barangay = Barangay(
                name=brgy_name,
                slug=brgy_slug,
                municipality_id=municipality.id,
                psgc_code=brgy_psgc or f"{municipality.id:02d}{idx:03d}",
                is_active=True,
            )
            db.session.add(barangay)
            barangays_created += 1

    db.session.commit()
    print(
        "Municipalities upserted: "
        f"created={created}, updated={updated}, barangays inserted={barangays_created}"
    )


def seed_admin_accounts(admins_file: str) -> None:
    """Create municipal admin accounts from the Markdown table."""

    entries = parse_markdown_admins_table(admins_file)
    if not entries:
        print(f"! No admin entries parsed from {admins_file}")
        return

    created, skipped = create_admin_accounts_from_entries(entries)
    print(
        "Admin accounts summary: "
        f"created={created}, skipped(existing/not matched)={skipped}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Zambales geo data and admin accounts")
    parser.add_argument(
        "--locations",
        default=os.path.join(PROJECT_ROOT, "data", "locations", "philippines_full_locations.json"),
        help="Path to the full locations JSON file",
    )
    parser.add_argument(
        "--municipality-meta",
        default=os.path.join(PROJECT_ROOT, "data", "locations", "zambales_municipalities.json"),
        help="Path to the Zambales municipality metadata JSON",
    )
    parser.add_argument(
        "--admins-file",
        default=os.path.join(PROJECT_ROOT, "data", "admins_gmails.txt"),
        help="Path to the Markdown table of admin accounts",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="Override SQLAlchemy database URL (optional)",
    )

    args = parser.parse_args()

    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Provide --database-url or configure the environment."
        )
    print(f"Using DATABASE_URL={db_url}")

    app = create_app()
    with app.app_context():
        print("\n" + "=" * 64)
        print("MUNLINK ZAMBALES - GEO + ADMIN SEED")
        print("=" * 64 + "\n")

        payload = load_zambales_data(args.locations, args.municipality_meta)
        upsert_municipalities(payload)
        seed_admin_accounts(args.admins_file)

        print("\nAll requested data seeded successfully.\n")


if __name__ == "__main__":
    main()


