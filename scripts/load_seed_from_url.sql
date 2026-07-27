-- Load the committed Philadelphia seed (public/seed/philly_shops.json) into
-- the shops table by having Postgres fetch it from the deployed site. Useful
-- for seeding a fresh database before the first full Actions ingest runs.
--
-- Run in the Supabase SQL editor (or via MCP execute_sql):
--   1. create extension if not exists http with schema extensions;
--   2. this file.

with payload as (
  select content::jsonb as j
  from extensions.http_get('https://truewrench.vercel.app/seed/philly_shops.json')
)
insert into public.shops (id, name, categories, address, phone, website, lat, lng, specialties)
select
  e->>'id',
  e->>'name',
  coalesce((select array_agg(x) from jsonb_array_elements_text(e->'categories') x), '{general}'),
  coalesce(e->>'address', ''),
  coalesce(e->>'phone', ''),
  e->>'website',
  (e->>'lat')::double precision,
  (e->>'lng')::double precision,
  case
    when e->'specialties' is null or e->'specialties' = 'null'::jsonb then null
    else (select array_agg(x) from jsonb_array_elements_text(e->'specialties') x)
  end
from payload, jsonb_array_elements(payload.j) e
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
