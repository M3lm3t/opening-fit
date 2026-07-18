-- Trusted database enforcement for paid workspaces. Existing rows are retained;
-- access returns automatically when a subscription is active again.

create or replace function public.openingfit_has_paid_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or exists (
      select 1
      from public.premium_entitlements entitlement
      where entitlement.user_id = auth.uid()
        and (
          (
            entitlement.access_type = 'lifetime'
            and (entitlement.is_grandfathered_lifetime is true or entitlement.status in ('active', 'trialing'))
          )
          or (
            entitlement.access_type in ('monthly_subscription', 'annual_subscription')
            and (
              entitlement.status in ('active', 'trialing')
              or (
                entitlement.status = 'canceled'
                and entitlement.current_period_end > now()
              )
              or (
                entitlement.status = 'past_due'
                and entitlement.premium_since is not null
                and entitlement.current_period_end > now()
              )
            )
          )
        )
    );
$$;

revoke all on function public.openingfit_has_paid_access() from public, anon;
grant execute on function public.openingfit_has_paid_access() to authenticated, service_role;

create or replace function public.require_openingfit_paid_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.openingfit_has_paid_access() then
    raise exception 'Paid OpeningFit access is required for this feature' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare protected_table text;
begin
  foreach protected_table in array array['repertoire', 'weekly_training_plans'] loop
    if to_regclass(format('public.%I', protected_table)) is not null then
      execute format('drop trigger if exists require_paid_mutation on public.%I', protected_table);
      execute format('create trigger require_paid_mutation before insert or update or delete on public.%I for each row execute function public.require_openingfit_paid_mutation()', protected_table);
    end if;
  end loop;
end;
$$;

drop policy if exists repertoire_select_own on public.repertoire;
create policy repertoire_select_own on public.repertoire for select to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists repertoire_insert_own on public.repertoire;
create policy repertoire_insert_own on public.repertoire for insert to authenticated
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists repertoire_update_own on public.repertoire;
create policy repertoire_update_own on public.repertoire for update to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access())
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists weekly_training_plans_select_own on public.weekly_training_plans;
create policy weekly_training_plans_select_own on public.weekly_training_plans for select to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_select_own on public.report_history;
create policy report_history_select_own on public.report_history for select to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_insert_own on public.report_history;
create policy report_history_insert_own on public.report_history for insert to authenticated
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_update_own on public.report_history;
create policy report_history_update_own on public.report_history for update to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access())
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_delete_own on public.report_history;
create policy report_history_delete_own on public.report_history for delete to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop trigger if exists require_paid_mutation on public.report_history;
create trigger require_paid_mutation before insert or update or delete on public.report_history
for each row execute function public.require_openingfit_paid_mutation();
