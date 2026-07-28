#!/usr/bin/env python3
"""State licensing importer: match official repair-shop registries against
our shops table and mark matches as state-licensed.

Currently supported: New York (DMV "Vehicle Repair Shops Across New York
State", dataset icjc-x44x on data.ny.gov — public records of facilities
licensed under Vehicle & Traffic Law). The registry is downloaded as CSV by
the workflow; this script only does offline matching between two CSVs.

Matching policy (deliberately conservative):
  - A registry record and a shop match when they share a ZIP code AND their
    normalized names are highly similar (or moderately similar with the same
    street number).
  - Only positive matches are written (state_licensed = true). A shop that
    fails to match is left NULL ("data source not connected"), never false:
    absence of a fuzzy match is not evidence a real business is unlicensed.

Usage:
  python scripts/import_licensing.py --registry ny_registry.csv \
      --shops shops_export.csv --out matches.csv

The shops export must have columns: id,name,address (see the workflow).
Column names in the registry CSV are detected from the header row, so minor
schema changes upstream don't break the import.
"""
import argparse
import csv
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher

STOP_WORDS = {
    'INC', 'LLC', 'CORP', 'CO', 'LTD', 'THE', 'OF', 'AND', '&',
    'INCORPORATED', 'COMPANY', 'CORPORATION',
}


def normalize_name(name: str) -> str:
    s = re.sub(r'[^A-Z0-9 ]', ' ', name.upper())
    tokens = [t for t in s.split() if t not in STOP_WORDS]
    return ' '.join(tokens)


def zip5(text: str) -> str | None:
    m = re.findall(r'\b(\d{5})(?:-\d{4})?\b', text or '')
    return m[-1] if m else None


def street_number(text: str) -> str | None:
    m = re.match(r'\s*(\d+)', text or '')
    return m.group(1) if m else None


def find_column(headers: list[str], *candidates: str) -> str | None:
    """Find a header containing any candidate substring, case-insensitive and
    treating underscores as spaces (SODA API exports use snake_case)."""
    lowered = {re.sub(r'[_\s]+', ' ', h.lower()).strip(): h for h in headers}
    for cand in candidates:
        for low, orig in lowered.items():
            if cand in low:
                return orig
    return None


def load_registry(path: str, type_contains: str | None = None):
    with open(path, newline='', encoding='utf-8-sig', errors='replace') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        name_col = find_column(headers, 'facility name', 'business name', 'dba', 'name')
        zip_col = find_column(headers, 'zip')
        street_col = find_column(headers, 'street', 'address line 1', 'address')
        status_col = find_column(headers, 'status')
        type_col = find_column(headers, 'license type', 'business type', 'record type', 'type')
        type_re = re.compile(type_contains, re.I) if type_contains else None
        if type_re and not type_col:
            print('WARNING: --type-contains given but no type column found; keeping all rows')
        if not name_col or not zip_col:
            print(f'ERROR: could not locate name/zip columns in registry headers: {headers}')
            sys.exit(1)
        print(f'registry columns → name: {name_col!r}, zip: {zip_col!r}, street: {street_col!r}, status: {status_col!r}')
        active = re.compile(r'clear|current|active|valid|good standing', re.I)
        skipped_status = 0
        skipped_type = 0
        by_zip: dict[str, list[tuple[str, str | None]]] = defaultdict(list)
        total = 0
        for row in reader:
            # Registries that mix license types (CT lists dealers AND
            # repairers) are narrowed to the requested type.
            if type_re and type_col:
                if not type_re.search(row.get(type_col) or ''):
                    skipped_type += 1
                    continue
            # When the registry includes a license status, only count
            # active-looking licenses (e.g. DCA uses "Clear").
            if status_col and (row.get(status_col) or '').strip():
                if not active.search(row[status_col]):
                    skipped_status += 1
                    continue
            z = zip5(row.get(zip_col) or '')
            name = normalize_name(row.get(name_col) or '')
            if not z or not name:
                continue
            street = street_number(row.get(street_col) or '') if street_col else None
            by_zip[z].append((name, street))
            total += 1
        print(f'registry records indexed: {total} across {len(by_zip)} zips'
              + (f' ({skipped_status} skipped by license status)' if skipped_status else '')
              + (f' ({skipped_type} skipped by license type)' if skipped_type else ''))
        return by_zip


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--registry', required=True, help='state registry CSV (downloaded by workflow)')
    ap.add_argument('--shops', required=True, help='CSV export of shops: id,name,address')
    ap.add_argument('--out', default='matches.csv')
    ap.add_argument('--strong', type=float, default=0.82, help='similarity accepted on its own')
    ap.add_argument('--weak', type=float, default=0.6, help='similarity accepted with same street number')
    ap.add_argument('--type-contains', default=None,
                    help='only count registry rows whose license-type column matches this regex '
                         "(e.g. 'repair' for registries that mix dealers and repairers)")
    args = ap.parse_args()

    registry = load_registry(args.registry, type_contains=args.type_contains)

    matched = 0
    considered = 0
    with open(args.shops, newline='', encoding='utf-8') as f, open(args.out, 'w', newline='') as out:
        writer = csv.writer(out)
        writer.writerow(['shop_id', 'state_licensed'])
        for row in csv.DictReader(f):
            z = zip5(row['address'])
            if not z or z not in registry:
                continue
            considered += 1
            shop_name = normalize_name(row['name'])
            shop_street = street_number(row['address'])
            best = 0.0
            best_street_ok = False
            for reg_name, reg_street in registry[z]:
                ratio = SequenceMatcher(None, shop_name, reg_name).ratio()
                if ratio > best:
                    best = ratio
                    best_street_ok = bool(shop_street and reg_street and shop_street == reg_street)
            if best >= args.strong or (best >= args.weak and best_street_ok):
                writer.writerow([row['id'], 'true'])
                matched += 1

    print(f'shops in covered zips: {considered}; matched as licensed: {matched}')
    print(f'wrote {args.out}')


if __name__ == '__main__':
    main()
