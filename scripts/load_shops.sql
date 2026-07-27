-- Upsert an Overture extraction (shops.csv from ingest_overture.py) into the
-- shops table. Run via psql:
--   psql "$SUPABASE_DB_URL" -f scripts/load_shops.sql
-- after: \copy shops_staging from 'shops.csv' with (format csv, header true, null '')

create temp table if not exists shops_staging (
  id text,
  name text,
  categories text[],
  address text,
  phone text,
  website text,
  lat double precision,
  lng double precision,
  specialties text[]
);

insert into public.shops (id, name, categories, address, phone, website, lat, lng, specialties)
select id, name, coalesce(categories, '{general}'), coalesce(address, ''), coalesce(phone, ''),
       website, lat, lng, specialties
from shops_staging
on conflict (id) do update set
  name = excluded.name,
  categories = excluded.categories,
  address = excluded.address,
  phone = excluded.phone,
  website = excluded.website,
  lat = excluded.lat,
  lng = excluded.lng,
  specialties = excluded.specialties,
  updated_at = now();

drop table shops_staging;
