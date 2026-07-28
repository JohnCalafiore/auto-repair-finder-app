#!/usr/bin/env python3
"""Download a full Socrata dataset as CSV via the SODA API with paging.

The one-shot export endpoint (api/views/<id>/rows.csv) silently truncates on
some portals (observed: data.ct.gov returned 138 rows of a multi-thousand-row
dataset), so we page through the resource endpoint instead and stop when a
page comes back short. Records are parsed and re-emitted with the csv module
so quoted fields containing newlines survive. Column names from SODA are
snake_case; the matcher's header detection normalizes underscores.

Usage: python scripts/fetch_socrata.py --domain data.ny.gov --dataset icjc-x44x --out ny.csv
"""
import argparse
import csv
import io
import urllib.request

PAGE = 50000


def fetch_page(domain: str, dataset: str, offset: int) -> list[list[str]]:
    url = (f'https://{domain}/resource/{dataset}.csv'
           f'?$limit={PAGE}&$offset={offset}&$order=:id')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 TrueWrench-ingest'})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode('utf-8', errors='replace')
    return list(csv.reader(io.StringIO(text)))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--domain', required=True)
    ap.add_argument('--dataset', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    rows_written = 0
    offset = 0
    with open(args.out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        while True:
            rows = fetch_page(args.domain, args.dataset, offset)
            if not rows:
                break
            header, data = rows[0], [r for r in rows[1:] if any(cell.strip() for cell in r)]
            if offset == 0:
                writer.writerow(header)
            writer.writerows(data)
            rows_written += len(data)
            print(f'  page at offset {offset}: {len(data)} rows')
            if len(data) < PAGE:
                break
            offset += PAGE
    print(f'wrote {args.out}: {rows_written} data rows')


if __name__ == '__main__':
    main()
