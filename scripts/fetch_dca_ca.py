#!/usr/bin/env python3
"""Download California's Automotive Repair Dealer registry from DCA's
public licensee-lists Box folder and convert it to a drop-in registry CSV.

BAR's Public Records Act response (Aug 2026) declined to compile a list and
instead pointed to the DCA "Public Information - Licensee Lists" page
(www.dca.ca.gov/consumers/public_info/), which embeds a public Box folder
refreshed at the start of each month, one subfolder per board. The page's own
token endpoint (www.dca.ca.gov/boxToken/getToken) grants read access, and the
AutomotiveRepair_1310 folder holds AutomotiveRepair_Data*.xls — which, despite
the extension, is tab-separated text with License Type, Org/Last Name,
Address Line 1, City, Zip and License Status columns.

Only "Automotive Repair Dealer" rows are kept (the folder mixes in smog-check
technician licenses, which are individuals, not shops). ZIPs are emitted as
5 digits because DCA publishes undashed ZIP+4 values that a \b-anchored
5-digit regex cannot split.

Usage: python scripts/fetch_dca_ca.py --out data/licensing/ca_registry.csv
"""
import argparse
import csv
import io
import json
import sys
import urllib.request

TOKEN_URL = 'https://www.dca.ca.gov/boxToken/getToken'
ROOT_FOLDER = '66089580694'  # DCA "Public Information" Box folder
BAR_FOLDER_PREFIX = 'AutomotiveRepair'
ARD_TYPE = 'Automotive Repair Dealer'

OUT_COLUMNS = ['business name', 'street', 'city', 'zip', 'license status']


def _request(url: str, token: str | None = None, raw: bool = False):
    headers = {'User-Agent': 'Mozilla/5.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read() if raw else json.load(resp)


def fetch_data_files() -> list[str]:
    """Return the decoded TSV text of every AutomotiveRepair_Data* file."""
    token = _request(TOKEN_URL, raw=True).decode().strip().strip('"')
    items = _request(f'https://api.box.com/2.0/folders/{ROOT_FOLDER}/items?limit=1000', token)
    bar = next((it for it in items['entries']
                if it['type'] == 'folder' and it['name'].startswith(BAR_FOLDER_PREFIX)), None)
    if not bar:
        raise RuntimeError(f'no {BAR_FOLDER_PREFIX}* folder in DCA Box root')
    sub = _request(f"https://api.box.com/2.0/folders/{bar['id']}/items?limit=1000", token)
    data_files = sorted(
        (it for it in sub['entries'] if it['type'] == 'file' and '_Data' in it['name']),
        key=lambda it: it['name'])
    if not data_files:
        raise RuntimeError(f"no _Data files in {bar['name']}")
    texts = []
    for f in data_files:
        raw = _request(f"https://api.box.com/2.0/files/{f['id']}/content", token, raw=True)
        print(f"downloaded {f['name']}: {len(raw)} bytes")
        texts.append(raw.decode('utf-8', 'replace'))
    return texts


def convert(tsv_texts: list[str]) -> list[list[str]]:
    """Filter to active-form ARD rows and reshape for import_licensing.py."""
    rows = []
    for text in tsv_texts:
        reader = csv.DictReader(io.StringIO(text), delimiter='\t')
        for rec in reader:
            if (rec.get('License Type') or '').strip() != ARD_TYPE:
                continue
            name = (rec.get('Org/Last Name') or '').strip()
            zip_digits = ''.join(c for c in (rec.get('Zip') or '') if c.isdigit())[:5]
            if not name or len(zip_digits) < 5:
                continue
            rows.append([
                name,
                (rec.get('Address Line 1') or '').strip(),
                (rec.get('City') or '').strip(),
                zip_digits,
                (rec.get('License Status') or '').strip(),
            ])
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    rows = convert(fetch_data_files())
    if len(rows) < 1000:
        # A real ARD roster is ~40k+; a tiny result means the feed moved or broke.
        print(f'ERROR: only {len(rows)} ARD rows — refusing to overwrite with a stub')
        sys.exit(1)
    with open(args.out, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(OUT_COLUMNS)
        writer.writerows(rows)
    print(f'wrote {args.out}: {len(rows)} Automotive Repair Dealer rows')


if __name__ == '__main__':
    main()
