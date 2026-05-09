-- Phase 4.9 — H-class hard filter inside search_materials.
--
-- Adds p_treatment_class as the 7th argument; when non-null, BOTH the
-- direct-match and alias-match CTEs filter rows by
-- attributes->>'treatment_class' = p_treatment_class. This eliminates
-- the V9 collapse where a description containing "h3 framing 90x45"
-- was outranked by H1.2 framing rows on trigram similarity.
--
-- This file is the verbatim SQL applied to the Supabase dev branch
-- (project_ref wkspwsorlgwkuwjajsce) via mcp__supabase__apply_migration
-- under the migration name `phase_4_9_hclass_hard_filter`.
--
-- DO NOT APPLY TO PRODUCTION until Stage 4 is ready for production
-- cutover. The function's signature changes from 6 args to 7 args, so
-- production code calling the new shape against the old function would
-- error — the matcher's safe wrapper catches that and falls back to
-- identity passthrough, preserving the Stage 3 invariant.

drop function if exists public.search_materials(text, text, text, text, text, int);
drop function if exists public.search_materials(text, text, text, text, text, int, text);

create function public.search_materials(
  p_query           text,
  p_country         text default 'NZ',
  p_category        text default null,
  p_brand           text default null,
  p_supplier        text default null,
  p_limit           int  default 25,
  p_treatment_class text default null
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
      and (p_country         is null or m.country  = p_country)
      and (p_category        is null or m.category = p_category)
      and (p_brand           is null or m.brand    = p_brand)
      and (p_supplier        is null or m.supplier = p_supplier)
      -- HARD FILTER on treatment_class when caller specifies it
      and (p_treatment_class is null or m.attributes->>'treatment_class' = p_treatment_class)
      and similarity(coalesce(m.normalized_name, lower(m.name)), q_norm) > 0.2
      and (m.user_id is null or m.user_id = uid)

    union all

    -- Alias match (same hard filter on treatment_class)
    select m.id, m.user_id, m.name, m.brand, m.category, m.unit,
           m.default_unit_price as price, m.attributes,
           case when m.user_id is not null and m.user_id = uid then 'alias_user' else 'alias_global' end,
           similarity(a.normalized_alias, q_norm),
           case when m.user_id is not null and m.user_id = uid then 2 else 4 end
    from public.material_aliases a
    join public.materials m on m.id = a.material_id
    where m.active
      and (p_country         is null or m.country  = p_country)
      and (p_category        is null or m.category = p_category)
      and (p_brand           is null or m.brand    = p_brand)
      and (p_supplier        is null or m.supplier = p_supplier)
      and (p_treatment_class is null or m.attributes->>'treatment_class' = p_treatment_class)
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

revoke all on function public.search_materials(text, text, text, text, text, int, text) from public, anon;
grant  execute on function public.search_materials(text, text, text, text, text, int, text) to authenticated;
