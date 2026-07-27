# State licensing registry files

Registries the import workflow (`.github/workflows/import-licensing.yml`)
matches against the shops database. Two kinds of sources:

## Auto-downloaded (no file needed here)

- **New York** — DMV "Vehicle Repair Shops Across New York State"
  (data.ny.gov dataset `icjc-x44x`), downloaded fresh on every run.

## Drop-in files (states without a public bulk download)

- **California** — `ca_registry.csv` (place it in this directory).
  The Bureau of Automotive Repair licenses ~35,000 Automotive Repair
  Dealers, but publishes no bulk file. Obtain the licensee list via a free
  public records request: https://www.bar.ca.gov/public-records
  (ask for the current Automotive Repair Dealer licensee list as CSV).
  Any column layout works as long as it includes a business/facility name
  column and a ZIP column — the importer detects columns from the header
  row. Commit the file and run the workflow; re-request a fresh copy every
  quarter or so.

## States investigated with nothing to import

- **Colorado** — Colorado does not license general auto repair shops
  (the Auto Industry Division licenses vehicle *dealers*; the DMV's
  "repair shop registration" exists only for the abandoned-vehicle
  process and has no public roster). Colorado shops therefore keep the
  honest "Data source not connected" state for licensing.
