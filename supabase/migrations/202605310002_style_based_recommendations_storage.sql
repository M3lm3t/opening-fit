alter table public.report_history
add column if not exists style_profile jsonb,
add column if not exists style_based_recommendations jsonb;
