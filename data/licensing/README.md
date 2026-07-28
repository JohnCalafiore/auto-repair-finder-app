# State licensing registry files

Registries the import workflow (`.github/workflows/import-licensing.yml`)
matches against the shops database. Three kinds of sources:

## Auto-downloaded (nothing to do)

- **New York** — DMV "Vehicle Repair Shops Across New York State"
  (data.ny.gov dataset `icjc-x44x`), downloaded fresh on every run.
- **Connecticut** — DMV "Licensed Automobile Dealers And Repairers"
  (data.ct.gov dataset `apne-w8c6`). The step is wired with
  `--type-contains repair` (the dataset mixes dealers and repairers),
  but as of 2026-07 the published dataset contains only ~138 rows, all
  dealer-type — a stub of CT's real multi-thousand roster — so CT
  currently yields no matches. The step is harmless and will pick up
  data automatically if the state repopulates the feed; alternatively,
  request the full repairer list from CT DMV and drop it in as
  `ct_registry.csv` alongside the other drop-in states. Note: CT
  licenses are often issued in a corporate name while the shop operates
  under a DBA, so conservative matching will undercount.

## Drop-in files (states without a public bulk download)

Place the file in this directory, commit, and run the workflow. Any
column layout works as long as it includes a business/facility name and
a ZIP; license-status columns (Active/Clear/etc.) are respected
automatically.

- **California** — `ca_registry.csv`. The Bureau of Automotive Repair
  licenses ~35,000 Automotive Repair Dealers but publishes no bulk file.
  Free public records request: https://www.bar.ca.gov/public-records
  (ask for the current ARD licensee list as CSV).
- **Florida** — `fl_registry.csv`. FDACS registers all paid repair shops
  under the Motor Vehicle Repair Act. Request the current registration
  list via the FDACS public records portal:
  https://fdacs.mycusthelp.com/WEBAPP/ (ask for the current Motor
  Vehicle Repair registration list as CSV).
- **Michigan** — `mi_registry.csv`. The Secretary of State licenses
  repair facilities and maintains a public facility listing
  (https://www.michigan.gov/sos/industry-services/repair-facilities);
  download the current listing there, or request it from the SOS
  Business Licensing Section, and save as CSV.

## States investigated with nothing to import

- **Colorado** — Colorado does not license general auto repair shops
  (the Auto Industry Division licenses vehicle *dealers*; the DMV's
  "repair shop registration" exists only for the abandoned-vehicle
  process and has no public roster). Colorado shops therefore keep the
  honest "Data source not connected" state for licensing.
- **Texas** — no statewide repair shop license.
