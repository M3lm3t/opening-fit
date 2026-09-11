-- PRODUCTION WARNING: target project frtjfvhiimgruenqcuon only.
-- Repairs only the proven composite-to-jsonb assignment defect. No table rows are touched.
-- Stop on any precondition failure; the transaction must roll back.
BEGIN;

DO $precondition$
DECLARE
  fn oid := to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)');
  acl_roles text[];
BEGIN
  IF fn IS NULL THEN RAISE EXCEPTION 'assignment repair precondition: function missing'; END IF;
  IF (SELECT md5(regexp_replace(lower(pg_get_functiondef(fn)),'\s+',' ','g')))
       NOT IN ('30dbcf29a48c79c62d4a06ce2f279660','f39bdc12016b0b7e8ac21d6d705ca3c4')
     OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=fn) <> 'postgres'
     OR (SELECT NOT prosecdef OR provolatile<>'v' OR proisstrict OR proparallel<>'u'
           OR proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
           OR pg_get_function_result(oid)<>'jsonb'
           OR pg_get_function_identity_arguments(oid)<>'p_user_id uuid, p_mission_id uuid, p_paid_access boolean, p_idempotency_key text'
         FROM pg_proc WHERE oid=fn)
  THEN RAISE EXCEPTION 'assignment repair precondition: unexpected function contract'; END IF;
  SELECT array_agg(r.rolname::text ORDER BY r.rolname::text) INTO acl_roles
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  JOIN pg_roles r ON r.oid=a.grantee
  WHERE p.oid=fn AND a.privilege_type='EXECUTE';
  IF acl_roles IS DISTINCT FROM ARRAY['postgres','service_role']::text[]
     OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=fn AND a.grantee=0 AND a.privilege_type='EXECUTE')
     OR has_function_privilege('anon',fn,'EXECUTE')
     OR has_function_privilege('authenticated',fn,'EXECUTE')
     OR NOT has_function_privilege('service_role',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'assignment repair precondition: unexpected execute privileges'; END IF;
  IF md5(regexp_replace(lower(pg_get_functiondef('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'::regprocedure)),'\s+',' ','g')) <> '7c8d8b5dfb4aab094b3bdb41db9c6580'
     OR md5(regexp_replace(lower(pg_get_functiondef('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'::regprocedure)),'\s+',' ','g')) <> 'a3cbdd46903dff71b0855aaf706d3593'
     OR md5(regexp_replace(lower(pg_get_functiondef('public.openingfit_protect_mission_identity()'::regprocedure)),'\s+',' ','g')) <> '9153a90cead25ad724928ab0390371c5'
     OR (SELECT md5(regexp_replace(lower(pg_get_triggerdef(oid)),'\s+',' ','g')) FROM pg_trigger
         WHERE tgrelid='public.openingfit_missions'::regclass AND tgname='openingfit_protect_mission_identity' AND NOT tgisinternal)
        <> 'abd2a5218506df1b9d3a2d31f3d7dcc8'
  THEN RAISE EXCEPTION 'assignment repair precondition: dependency contract changed'; END IF;
END
$precondition$;

create or replace function public.assign_openingfit_mission_with_allowance(p_user_id uuid,p_mission_id uuid,p_paid_access boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare allowance public.openingfit_mission_allowances; mission public.openingfit_missions; assigned jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 insert into public.openingfit_mission_allowances(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into allowance from public.openingfit_mission_allowances where user_id=p_user_id for update;
 if not p_paid_access and allowance.assignment_count>0 and allowance.next_available_at>now() then
  return jsonb_build_object('assigned',false,'reasonCode','free_allowance_exhausted','nextMissionAvailableAt',allowance.next_available_at);
 end if;
 select * into mission from public.openingfit_missions where id=p_mission_id and user_id=p_user_id for update;
 if mission.id is null or mission.status<>'candidate' then raise exception 'Mission not assignable'; end if;
 assigned:=to_jsonb(public.transition_openingfit_mission(p_user_id,p_mission_id,'assigned','candidate_selected',null,p_idempotency_key,'{}'));
 update public.openingfit_mission_allowances set assignment_count=assignment_count+1,last_assigned_at=now(),next_available_at=case when p_paid_access then null else now()+interval '30 days' end,updated_at=now() where user_id=p_user_id;
 perform public.record_openingfit_mission_event(p_user_id,p_mission_id,'mission_assigned','mission-assigned:'||p_mission_id||':'||(mission.generation)::text,jsonb_build_object('status','assigned'));
 return jsonb_build_object('assigned',true,'mission',assigned);
end; $$;

DO $postcondition$
DECLARE
  fn oid := 'public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)'::regprocedure;
  acl_roles text[];
BEGIN
  IF (SELECT md5(regexp_replace(lower(pg_get_functiondef(fn)),'\s+',' ','g'))) <> 'f39bdc12016b0b7e8ac21d6d705ca3c4'
     OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=fn) <> 'postgres'
     OR (SELECT NOT prosecdef OR provolatile<>'v' OR proisstrict OR proparallel<>'u'
           OR proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[] OR pg_get_function_result(oid)<>'jsonb'
         FROM pg_proc WHERE oid=fn)
  THEN RAISE EXCEPTION 'assignment repair postcondition: function mismatch'; END IF;
  SELECT array_agg(r.rolname::text ORDER BY r.rolname::text) INTO acl_roles
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  JOIN pg_roles r ON r.oid=a.grantee
  WHERE p.oid=fn AND a.privilege_type='EXECUTE';
  IF acl_roles IS DISTINCT FROM ARRAY['postgres','service_role']::text[]
     OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=fn AND a.grantee=0 AND a.privilege_type='EXECUTE')
     OR has_function_privilege('anon',fn,'EXECUTE')
     OR has_function_privilege('authenticated',fn,'EXECUTE') OR NOT has_function_privilege('service_role',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'assignment repair postcondition: execute privileges changed'; END IF;
  IF md5(regexp_replace(lower(pg_get_functiondef('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'::regprocedure)),'\s+',' ','g')) <> '7c8d8b5dfb4aab094b3bdb41db9c6580'
     OR md5(regexp_replace(lower(pg_get_functiondef('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'::regprocedure)),'\s+',' ','g')) <> 'a3cbdd46903dff71b0855aaf706d3593'
     OR md5(regexp_replace(lower(pg_get_functiondef('public.openingfit_protect_mission_identity()'::regprocedure)),'\s+',' ','g')) <> '9153a90cead25ad724928ab0390371c5'
  THEN RAISE EXCEPTION 'assignment repair postcondition: dependency changed'; END IF;
END
$postcondition$;

COMMIT;
