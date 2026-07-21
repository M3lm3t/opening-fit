do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_entitlements'::regclass
      and conname = 'premium_entitlements_classification_shape_check'
  ) then
    raise exception 'Failed manual grant left its test constraint change applied';
  end if;
  if exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000007'
  ) then
    raise exception 'Failed manual grant left an entitlement row applied';
  end if;
end;
$$;
