-- One-time cleanup of noise rows that predate a tighter ingest filter.
--
-- The monthly Overture ingest is an upsert, so tightening EXCLUDE_NAME in
-- scripts/ingest_overture.py stops *new* noise but leaves rows already in
-- the database. This script removes them with the same two patterns,
-- translated to Postgres regex syntax (Python \b → Postgres \y).
--
-- Run section (a) first and eyeball the count and samples. Expect roughly
-- a hundred rows in a large metro and low thousands nationwide. If the
-- preview is far larger than that, STOP — the pattern is probably matching
-- something legitimate — and fix the regex before running (b).
--
-- Keep these two patterns in sync with ingest_overture.py.

-- ————————————————————————————————————————————————————————————————
-- (a) PREVIEW — read only
-- ————————————————————————————————————————————————————————————————
with noise as (
  select id, name, address
  from public.shops
  where name ~* 'towing|tow truck|locksmith|key maker|car key|auto key|car wash|junk car|cash for|salvage|wrecking|scrap|window tint|tinting|\ytints?\y|detail(ing)?|vinyl wrap|wraps?\y|car audio|stereo|upholster|auto parts|parts store|\yboat|\ymarine|rv sales|trailer sales|\yrental|showroom|car show|boat show'
    and name !~* 'repair|mechanic|automotive|auto care|car care|auto service|service|garage|body|tire|brake|muffler|transmission|lube|auto glass|collision|diagnostic'
)
select
  (select count(*) from noise) as would_delete_nationwide,
  (select count(*) from noise n join public.shops s on s.id = n.id
     where st_dwithin(s.geog, st_setsrid(st_makepoint(-104.9903, 39.7392), 4326)::geography, 40000)) as would_delete_denver_40km;

with noise as (
  select id, name, address
  from public.shops
  where name ~* 'towing|tow truck|locksmith|key maker|car key|auto key|car wash|junk car|cash for|salvage|wrecking|scrap|window tint|tinting|\ytints?\y|detail(ing)?|vinyl wrap|wraps?\y|car audio|stereo|upholster|auto parts|parts store|\yboat|\ymarine|rv sales|trailer sales|\yrental|showroom|car show|boat show'
    and name !~* 'repair|mechanic|automotive|auto care|car care|auto service|service|garage|body|tire|brake|muffler|transmission|lube|auto glass|collision|diagnostic'
)
select name, address from noise order by random() limit 20;

-- ————————————————————————————————————————————————————————————————
-- (b) DELETE — only after the preview above looks right.
--     Single statement, so it is atomic. Child rows are removed
--     explicitly (the FKs also cascade) and counted.
-- ————————————————————————————————————————————————————————————————
with noise as (
  select id
  from public.shops
  where name ~* 'towing|tow truck|locksmith|key maker|car key|auto key|car wash|junk car|cash for|salvage|wrecking|scrap|window tint|tinting|\ytints?\y|detail(ing)?|vinyl wrap|wraps?\y|car audio|stereo|upholster|auto parts|parts store|\yboat|\ymarine|rv sales|trailer sales|\yrental|showroom|car show|boat show'
    and name !~* 'repair|mechanic|automotive|auto care|car care|auto service|service|garage|body|tire|brake|muffler|transmission|lube|auto glass|collision|diagnostic'
),
del_enrichment as (
  delete from public.enrichment where shop_id in (select id from noise) returning 1
),
del_trust as (
  delete from public.trust_signals where shop_id in (select id from noise) returning 1
),
del_shops as (
  delete from public.shops where id in (select id from noise) returning 1
)
select
  (select count(*) from del_shops)      as shops_deleted,
  (select count(*) from del_enrichment) as enrichment_deleted,
  (select count(*) from del_trust)      as trust_signals_deleted;
