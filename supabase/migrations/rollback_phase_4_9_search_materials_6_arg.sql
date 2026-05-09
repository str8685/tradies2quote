-- ROLLBACK ONLY — restore the 6-argument search_materials RPC.
--
-- This file is the explicit rollback for
-- supabase/migrations/20260509_phase_4_9_hclass_hard_filter.sql.
-- It drops the 7-argument variant and re-creates the previous 6-argument
-- function body byte-equivalent to what production ran before Phase 4.9
-- (project ref guiovuqccbzlbacaxepd).
--
-- DO NOT APPLY UNLESS A ROLLBACK IS REQUIRED.
--
-- The matcher's safe-wrapper falls back to identity passthrough when the
-- RPC signature is wrong, so the recommended first-line rollback is to
-- unset MATERIAL_MATCHING_ENABLED and redeploy. Apply this SQL only when
-- the new 7-arg function body itself misbehaves on production data.
--
-- Apply via Supabase MCP:
--   mcp__supabase__apply_migration(name='rollback_phase_4_9_search_materials_6_arg', ...)
-- against project_ref=guiovuqccbzlbacaxepd.

drop function if exists public.search_materials(text, text, text, text, text, int, text);
drop function if exists public.search_materials(text, text, text, text, text, int);

create function public.search_materials(
  p_query    text,
  p_country  text default 'NZ',
  p_category text default null,
  p_brand    text default null,
  p_supplier text default null,
  p_limit    int  default 25
) returns table (
  id uuid, user_id uuid, name text, brand text, category text, unit text,
  price numeric, attributes jsonb, match_source text, match_score real, tier_rank int
) language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  q_norm text := lower(trim(coalesce(p_query, '')));
  uid    uuid := auth.uid();
  lim    int  := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if q_norm = '' then return; end if;
  return query
  with matches as (
    -- Direct name match
    select m.id, m.user_id, m.name, m.brand, m.category, m.unit,
           m.default_unit_price as price, m.attributes,
           case when m.user_id is not null and m.user_id = uid then 'direct_user' else 'direct_global' end as match_source,
           similarity(coalesce(m.normalized_name, lower(m.name)), q_norm) as match_score,
           case when m.user_id is not null and m.user_id = uid then 1 else 3 end as tier_rank
    from public.materials m
    where m.active
      and (p_country  is null or m.country  = p_country)
      and (p_category is null or m.category = p_category)
      and (p_brand    is null or m.brand    = p_brand)
      and (p_supplier is null or m.supplier = p_supplier)
      and similarity(coalesce(m.normalized_name, lower(m.name)), q_norm) > 0.2
      and (m.user_id is null or m.user_id = uid)

    union all

    -- Alias match
    select m.id, m.user_id, m.name, m.brand, m.category, m.unit,
           m.default_unit_price as price, m.attributes,
           case when m.user_id is not null and m.user_id = uid then 'alias_user' else 'alias_global' end,
           similarity(a.normalized_alias, q_norm),
           case when m.user_id is not null and m.user_id = uid then 2 else 4 end
    from public.material_aliases a
    join public.materials m on m.id = a.material_id
    where m.active
      and (p_country  is null or m.country  = p_country)
      and (p_category is null or m.category = p_category)
      and (p_brand    is null or m.brand    = p_brand)
      and (p_supplier is null or m.supplier = p_supplier)
      and similarity(a.normalized_alias, q_norm) > 0.3
      and (m.user_id is null or m.user_id = uid)
  ),
  ranked as (
    select mt.*, row_number() over (partition by mt.id order by mt.tier_rank asc, mt.match_score desc) as rn
    from matches mt
  )
  select r.id, r.user_id, r.name, r.brand, r.category, r.unit, r.price, r.attributes,
         r.match_source, r.match_score, r.tier_rank
  from ranked r where r.rn = 1
  order by r.tier_rank asc, r.match_score desc
  limit lim;
end; $$;

revoke all on function public.search_materials(text, text, text, text, text, int) from public, anon;
grant  execute on function public.search_materials(text, text, text, text, text, int) to authenticated;
