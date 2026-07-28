#!/usr/bin/env python3
"""Overture Maps → shops.csv for the TrueWrench database.

Reads the Overture places theme (GeoParquet on public S3) with DuckDB,
filters to US auto-repair categories, maps them onto the app's service
categories, infers make specialties from business names, and writes a CSV
ready for `psql \\copy` into the staging table (see load_shops.sql).

Usage:
  python scripts/ingest_overture.py [--release 2026-07-22.0] [--out shops.csv]

Intended to run in GitHub Actions (see .github/workflows/ingest-overture.yml)
where egress to S3 is unrestricted; a full US extraction reads a few GB of
parquet and takes on the order of 10–20 minutes.
"""
import argparse
import csv
import re

import duckdb

# Overture category → app ServiceCategory (src/types.ts)
CATEGORY_MAP = {
    'automotive_repair': 'general',
    'automotive_services_and_repair': 'general',
    'automotive': 'general',
    'auto_body_shop': 'body',
    'auto_glass_service': 'body',
    'auto_restoration_services': 'body',
    'tire_dealer_and_repair': 'tires',
    'tire_shop': 'tires',
    'tire_repair_shop': 'tires',
    'oil_change_station': 'oil',
    'transmission_repair': 'transmission',
    'auto_electrical_repair': 'electrical',
    'car_inspection': 'inspection',
    'smog_check_station': 'inspection',
    'auto_customization': 'speed',
}

NAME_CATS = [
    ('body', re.compile(r'\b(body|collision|paint|dent)\b', re.I)),
    ('transmission', re.compile(r'transmission|drivetrain', re.I)),
    ('tires', re.compile(r'\btire|wheel|alignment', re.I)),
    ('exhaust', re.compile(r'muffler|exhaust', re.I)),
    ('oil', re.compile(r'oil change|lube', re.I)),
    ('brakes', re.compile(r'\bbrake', re.I)),
    ('speed', re.compile(r'performance|speed|tuning|dyno|racing', re.I)),
    ('electrical', re.compile(r'auto electric|diagnostic', re.I)),
    ('inspection', re.compile(r'inspection|emission', re.I)),
]

NAME_SPECS = [
    ('bmw', re.compile(r'\bbmw\b|mini cooper', re.I)),
    ('mercedes', re.compile(r'mercedes|benz', re.I)),
    ('audi-vw', re.compile(r'\baudi\b|volkswagen|\bvw\b|porsche', re.I)),
    ('volvo', re.compile(r'\bvolvo\b', re.I)),
    ('toyota', re.compile(r'toyota|lexus', re.I)),
    ('honda', re.compile(r'honda|acura', re.I)),
    ('nissan', re.compile(r'nissan|infiniti', re.I)),
    ('subaru', re.compile(r'subaru', re.I)),
    ('mazda', re.compile(r'mazda', re.I)),
    ('ford', re.compile(r'\bford\b|lincoln', re.I)),
    ('gm', re.compile(r'chevy|chevrolet|gmc|cadillac|buick', re.I)),
    ('mopar', re.compile(r'dodge|\bram\b|jeep|chrysler|mopar', re.I)),
    ('hyundai-kia', re.compile(r'hyundai|\bkia\b|genesis', re.I)),
    ('tesla', re.compile(r'tesla', re.I)),
]


# Noise filters: Overture's auto categories include businesses that aren't
# repair shops (towing-only, locksmiths, car washes, junk/salvage) and some
# mis-geocoded foreign listings. Names matching EXCLUDE are dropped unless
# they also look like a real repair business (KEEP_OVERRIDE).
EXCLUDE_NAME = re.compile(
    r'towing|tow truck|locksmith|key maker|car key|auto key|car wash|junk car'
    r'|cash for|salvage|wrecking|scrap', re.I)
KEEP_OVERRIDE = re.compile(
    r'repair|mechanic|auto care|auto service|service center|garage|body|tire'
    r'|brake|muffler|transmission|lube|collision|diagnostic', re.I)
LATIN = re.compile(r'[A-Za-z]')
# CJK/kana/Hangul in a US listing's primary name almost always marks a
# mis-geocoded foreign business (e.g. a Taiwanese dealership placed in NYC).
NON_US_SCRIPT = re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]')


def pg_array(items):
    if not items:
        return None
    return '{' + ','.join('"' + i.replace('"', '') + '"' for i in items) + '}'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--release', default='2026-07-22.0')
    ap.add_argument('--out', default='shops.csv')
    args = ap.parse_args()

    con = duckdb.connect()
    con.execute('INSTALL httpfs; LOAD httpfs;')
    con.execute("SET s3_region='us-west-2';")

    cats_sql = ', '.join(f"'{c}'" for c in CATEGORY_MAP)
    src = f's3://overturemaps-us-west-2/release/{args.release}/theme=places/type=place/*'
    rows = con.execute(
        f"""
        SELECT id,
               names.primary AS name,
               categories.primary AS category,
               phones[1] AS phone,
               websites[1] AS website,
               addresses[1].freeform AS addr,
               addresses[1].locality AS locality,
               addresses[1].region AS region,
               addresses[1].postcode AS postcode,
               (bbox.ymin + bbox.ymax) / 2 AS lat,
               (bbox.xmin + bbox.xmax) / 2 AS lng
        FROM read_parquet('{src}')
        WHERE addresses[1].country = 'US'
          AND categories.primary IN ({cats_sql})
          AND names.primary IS NOT NULL
        """
    ).fetchall()
    print(f'extracted {len(rows)} US auto-repair places')

    seen = set()
    with open(args.out, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'name', 'categories', 'address', 'phone', 'website', 'lat', 'lng', 'specialties'])
        dropped = 0
        for (pid, name, category, phone, website, addr, locality, region, postcode, lat, lng) in rows:
            if pid in seen or not name:
                continue
            name = name.strip()[:120]
            # Require a ZIP (mis-geocoded listings usually lack one), a
            # Latin-script name, and a name that isn't excluded-only.
            if not postcode or not LATIN.search(name) or NON_US_SCRIPT.search(name) or (
                EXCLUDE_NAME.search(name) and not KEEP_OVERRIDE.search(name)
            ):
                dropped += 1
                continue
            seen.add(pid)
            cats = [CATEGORY_MAP[category]]
            for c, rx in NAME_CATS:
                if c not in cats and rx.search(name):
                    cats.append(c)
            specs = [s for s, rx in NAME_SPECS if rx.search(name)]
            address = ', '.join(p for p in [addr, locality, region, postcode] if p)[:200]
            w.writerow([
                pid, name, pg_array(cats[:3]), address, (phone or '')[:25],
                (website or '')[:200] or None, round(lat, 6), round(lng, 6), pg_array(specs),
            ])
    print(f'wrote {args.out} ({len(seen)} rows, {dropped} dropped by noise filters)')


if __name__ == '__main__':
    main()
