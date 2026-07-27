-- POST-MIGRATION-1, rollback-only. Set openingfit.smoke_free_user to a
-- designated non-customer profile UUID in the same database session.
begin;
create temporary table openingfit_original_profile as
select * from public.profiles
where user_id=current_setting('openingfit.smoke_free_user')::uuid;
do $block$ begin
  if (select count(*) from openingfit_original_profile) <> 1 then
    raise exception 'Designated smoke profile does not exist';
  end if;
  if exists (select 1 from openingfit_original_profile where coalesce(is_premium, false)) then
    raise exception 'STOP: designated foundation account is not free';
  end if;
  if exists (select 1 from public.premium_entitlements where user_id=current_setting('openingfit.smoke_free_user')::uuid)
    then raise exception 'STOP: designated foundation account already has an entitlement'; end if;
end $block$;
select set_config('request.jwt.claim.role','service_role',true);
update public.profiles set is_premium=not coalesce(is_premium,false)
where user_id=current_setting('openingfit.smoke_free_user')::uuid;
do $block$ begin
  if not exists (
    select 1 from public.profiles p join openingfit_original_profile o using(user_id)
    where p.is_premium is distinct from o.is_premium
  ) then raise exception 'Service-role premium-profile guard smoke failed'; end if;
end $block$;
update public.profiles p
set is_premium = o.is_premium
from openingfit_original_profile o
where p.user_id = o.user_id;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',current_setting('openingfit.smoke_free_user'),true);
do $block$
declare
  caught_state text;
  caught_message text;
begin
  begin
    update public.profiles set is_premium=true
    where user_id=current_setting('openingfit.smoke_free_user')::uuid;
    raise exception 'Authenticated self-upgrade unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> 'P0001'
       or caught_message <> 'profiles.is_premium can only be updated by trusted server code' then
      raise;
    end if;
  end;
end $block$;
rollback;
