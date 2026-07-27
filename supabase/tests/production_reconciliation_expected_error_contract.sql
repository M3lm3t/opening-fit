-- Local-only regression coverage for strict expected-error handling.
-- Every helper is transaction-local and the final rollback removes it.
begin;

create function pg_temp.openingfit_assert_exact_failure(
  p_sql text,
  p_expected_state text,
  p_expected_message text
)
returns void
language plpgsql
as $function$
declare
  caught_state text;
  caught_message text;
begin
  begin
    execute p_sql;
    raise exception 'Expected protected operation unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> p_expected_state or caught_message <> p_expected_message then
      raise;
    end if;
  end;
end
$function$;

create function pg_temp.openingfit_assert_rethrown(
  p_case text,
  p_sql text,
  p_rethrown_state text,
  p_rethrown_message text
)
returns void
language plpgsql
as $function$
declare
  caught_state text;
  caught_message text;
begin
  begin
    perform pg_temp.openingfit_assert_exact_failure(
      p_sql,
      '42501',
      'Paid OpeningFit access is required for this feature'
    );
    raise exception 'Regression case unexpectedly passed: %', p_case;
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> p_rethrown_state or caught_message <> p_rethrown_message then
      raise exception 'Regression case % returned [%] %, expected [%] %',
        p_case, caught_state, caught_message, p_rethrown_state, p_rethrown_message;
    end if;
  end;
end
$function$;

create function pg_temp.openingfit_raise_expected()
returns void language plpgsql as $function$
begin
  raise exception 'Paid OpeningFit access is required for this feature'
    using errcode = '42501';
end
$function$;

create function pg_temp.openingfit_raise_wrong_state()
returns void language plpgsql as $function$
begin
  raise exception 'Paid OpeningFit access is required for this feature'
    using errcode = 'P0001';
end
$function$;

create function pg_temp.openingfit_raise_wrong_message()
returns void language plpgsql as $function$
begin
  raise exception 'Different authorization failure' using errcode = '42501';
end
$function$;

create function pg_temp.openingfit_raise_unrelated()
returns void language plpgsql as $function$
begin
  raise exception 'Unrelated check constraint failure' using errcode = '23514';
end
$function$;

-- The precise expected authorization contract is accepted.
select pg_temp.openingfit_assert_exact_failure(
  'select pg_temp.openingfit_raise_expected()',
  '42501',
  'Paid OpeningFit access is required for this feature'
);

-- No error, wrong state, wrong message, and unrelated errors must all escape
-- the matcher unchanged. The outer helper verifies their exact contracts.
select pg_temp.openingfit_assert_rethrown(
  'no error',
  'select 1',
  'P0001',
  'Expected protected operation unexpectedly succeeded'
);
select pg_temp.openingfit_assert_rethrown(
  'incorrect SQLSTATE',
  'select pg_temp.openingfit_raise_wrong_state()',
  'P0001',
  'Paid OpeningFit access is required for this feature'
);
select pg_temp.openingfit_assert_rethrown(
  'correct SQLSTATE with wrong message',
  'select pg_temp.openingfit_raise_wrong_message()',
  '42501',
  'Different authorization failure'
);
select pg_temp.openingfit_assert_rethrown(
  'unrelated constraint error',
  'select pg_temp.openingfit_raise_unrelated()',
  '23514',
  'Unrelated check constraint failure'
);

rollback;

do $block$
begin
  if to_regprocedure('pg_temp.openingfit_assert_exact_failure(text,text,text)') is not null
     or to_regprocedure('pg_temp.openingfit_raise_expected()') is not null then
    raise exception 'Expected-error regression helpers survived rollback';
  end if;
end
$block$;
