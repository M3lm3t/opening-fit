-- READ-ONLY verification for the Mission assignment composite-to-jsonb repair.
WITH
fn AS (
 SELECT p.*,pg_get_userbyid(p.proowner) owner,
        md5(regexp_replace(lower(pg_get_functiondef(p.oid)),'\s+',' ','g')) definition_hash
 FROM pg_proc p
 WHERE p.oid=to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)')
),
acl AS (
 SELECT coalesce(array_agg(r.rolname::text ORDER BY r.rolname::text) FILTER (WHERE a.privilege_type='EXECUTE' AND r.oid IS NOT NULL),'{}') roles,
        coalesce(bool_or(a.grantee=0 AND a.privilege_type='EXECUTE'),false) public_execute
 FROM fn p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 LEFT JOIN pg_roles r ON r.oid=a.grantee
),
candidate AS (
 SELECT m.*,
        CASE WHEN (m.confidence->>'score') ~ '^[0-9]+(?:\.[0-9]+)?$' THEN (m.confidence->>'score')::numeric END confidence_score
 FROM public.openingfit_missions m WHERE m.status='candidate'
),
state AS (
 SELECT
  (SELECT count(*) FROM candidate) candidate_count,
  (SELECT count(*) FROM candidate WHERE NOT is_primary AND assigned_at IS NULL AND confidence_score>=70
    AND baseline_cutoff_at IS NOT NULL AND (last_evidence_at IS NULL OR baseline_cutoff_at>=last_evidence_at)) assignable_count,
  (SELECT count(*) FROM public.openingfit_missions WHERE is_primary AND status IN ('assigned','learning','awaiting_evidence','improving','needs_review')) active_count,
  (SELECT count(*) FROM public.openingfit_mission_allowances) allowance_count,
  (SELECT count(*) FROM public.openingfit_mission_status_events WHERE to_status='assigned') assignment_transition_count,
  (SELECT count(*) FROM public.openingfit_mission_events WHERE event_name='mission_assigned') assignment_event_count
),
checks(check_name,expected_value,actual_value,pass,reason) AS (
 SELECT 'function_exists','one','count='||count(*),(count(*)=1),'function_missing_or_duplicated' FROM fn
 UNION ALL SELECT 'definition_hash','f39bdc12016b0b7e8ac21d6d705ca3c4',coalesce(max(definition_hash),'missing'),coalesce(bool_and(definition_hash='f39bdc12016b0b7e8ac21d6d705ca3c4'),false),'definition_mismatch' FROM fn
 UNION ALL SELECT 'composite_conversion','to_jsonb_transition',coalesce(bool_or(pg_get_functiondef(oid) LIKE '%assigned:=to_jsonb(public.transition_openingfit_mission(%')::text,'false'),coalesce(bool_or(pg_get_functiondef(oid) LIKE '%assigned:=to_jsonb(public.transition_openingfit_mission(%'),false),'conversion_missing' FROM fn
 UNION ALL SELECT 'owner','postgres',coalesce(max(owner),'missing'),coalesce(bool_and(owner='postgres'),false),'owner_mismatch' FROM fn
 UNION ALL SELECT 'return_type','jsonb',coalesce(max(pg_get_function_result(oid)),'missing'),coalesce(bool_and(pg_get_function_result(oid)='jsonb'),false),'return_type_mismatch' FROM fn
 UNION ALL SELECT 'security','definer',coalesce(bool_and(prosecdef)::text,'false'),coalesce(bool_and(prosecdef),false),'security_mismatch' FROM fn
 UNION ALL SELECT 'volatility','volatile',coalesce(max(provolatile::text),'missing'),coalesce(bool_and(provolatile='v'),false),'volatility_mismatch' FROM fn
 UNION ALL SELECT 'strictness','not_strict',coalesce(bool_and(NOT proisstrict)::text,'false'),coalesce(bool_and(NOT proisstrict),false),'strictness_mismatch' FROM fn
 UNION ALL SELECT 'parallel','unsafe',coalesce(max(proparallel::text),'missing'),coalesce(bool_and(proparallel='u'),false),'parallel_mismatch' FROM fn
 UNION ALL SELECT 'search_path','public',coalesce(max(array_to_string(proconfig,',')),'missing'),coalesce(bool_and(proconfig=ARRAY['search_path=public']::text[]),false),'search_path_mismatch' FROM fn
 UNION ALL SELECT 'identity_arguments','exact',coalesce(max(pg_get_function_identity_arguments(oid)),'missing'),coalesce(bool_and(pg_get_function_identity_arguments(oid)='p_user_id uuid, p_mission_id uuid, p_paid_access boolean, p_idempotency_key text'),false),'arguments_mismatch' FROM fn
 UNION ALL SELECT 'explicit_execute_acl','postgres/service_role',array_to_string(roles,','),(roles=ARRAY['postgres','service_role']::text[]),'acl_mismatch' FROM acl
 UNION ALL SELECT 'public_execute','false',public_execute::text,NOT public_execute,'public_execute_unexpected' FROM acl
 UNION ALL SELECT 'anon_execute','false',has_function_privilege('anon','public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)','EXECUTE')::text,NOT has_function_privilege('anon','public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)','EXECUTE'),'anon_execute_unexpected'
 UNION ALL SELECT 'authenticated_execute','false',has_function_privilege('authenticated','public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)','EXECUTE')::text,NOT has_function_privilege('authenticated','public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)','EXECUTE'),'authenticated_execute_unexpected'
 UNION ALL SELECT 'service_role_execute','true',has_function_privilege('service_role','public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)','EXECUTE')::text,has_function_privilege('service_role','public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)','EXECUTE'),'service_execute_missing'
 UNION ALL SELECT 'transition_hash','7c8d8b5dfb4aab094b3bdb41db9c6580',md5(regexp_replace(lower(pg_get_functiondef('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'::regprocedure)),'\s+',' ','g')),md5(regexp_replace(lower(pg_get_functiondef('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'::regprocedure)),'\s+',' ','g'))='7c8d8b5dfb4aab094b3bdb41db9c6580','transition_changed'
 UNION ALL SELECT 'event_function_hash','a3cbdd46903dff71b0855aaf706d3593',md5(regexp_replace(lower(pg_get_functiondef('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'::regprocedure)),'\s+',' ','g')),md5(regexp_replace(lower(pg_get_functiondef('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'::regprocedure)),'\s+',' ','g'))='a3cbdd46903dff71b0855aaf706d3593','event_function_changed'
 UNION ALL SELECT 'identity_function_hash','9153a90cead25ad724928ab0390371c5',md5(regexp_replace(lower(pg_get_functiondef('public.openingfit_protect_mission_identity()'::regprocedure)),'\s+',' ','g')),md5(regexp_replace(lower(pg_get_functiondef('public.openingfit_protect_mission_identity()'::regprocedure)),'\s+',' ','g'))='9153a90cead25ad724928ab0390371c5','identity_function_changed'
 UNION ALL SELECT 'identity_trigger_hash','abd2a5218506df1b9d3a2d31f3d7dcc8',(SELECT md5(regexp_replace(lower(pg_get_triggerdef(oid)),'\s+',' ','g')) FROM pg_trigger WHERE tgrelid='public.openingfit_missions'::regclass AND tgname='openingfit_protect_mission_identity' AND NOT tgisinternal),(SELECT md5(regexp_replace(lower(pg_get_triggerdef(oid)),'\s+',' ','g')) FROM pg_trigger WHERE tgrelid='public.openingfit_missions'::regclass AND tgname='openingfit_protect_mission_identity' AND NOT tgisinternal)='abd2a5218506df1b9d3a2d31f3d7dcc8','identity_trigger_changed'
 UNION ALL SELECT 'candidate_inventory','exactly_one','count='||candidate_count,(candidate_count=1),'candidate_inventory_changed' FROM state
 UNION ALL SELECT 'candidate_assignable','exactly_one','count='||assignable_count,(assignable_count=1),'candidate_not_assignable' FROM state
 UNION ALL SELECT 'active_missions','zero','count='||active_count,(active_count=0),'active_mission_present' FROM state
 UNION ALL SELECT 'allowance_side_effects','zero','count='||allowance_count,(allowance_count=0),'allowance_changed'
 FROM state
 UNION ALL SELECT 'assignment_transition_side_effects','zero','count='||assignment_transition_count,(assignment_transition_count=0),'transition_changed' FROM state
 UNION ALL SELECT 'assignment_event_side_effects','zero','count='||assignment_event_count,(assignment_event_count=0),'event_changed' FROM state
)
SELECT check_name,expected_value,actual_value,pass,CASE WHEN pass THEN 'ok' ELSE reason END reason
FROM checks ORDER BY check_name;
