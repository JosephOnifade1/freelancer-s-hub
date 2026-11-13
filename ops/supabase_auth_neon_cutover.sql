-- Operator-only cutover, NOT executed by this application or in Phase 2H.
-- Backup/review first. Retires only the exact legacy trigger shipped by this repo.
-- Auth accounts, sessions, passwords, OAuth and email flows are NOT removed.
begin;
do $$
declare function_name text;
begin
 select n.nspname||'.'||p.proname into function_name from pg_trigger t
 join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
 where t.tgrelid='auth.users'::regclass and t.tgname='on_auth_user_created' and not t.tgisinternal;
 if function_name='public.handle_new_user' then
   execute 'drop trigger on_auth_user_created on auth.users';
 elsif function_name is not null then
   raise exception 'Custom auth provisioning trigger found: review manually before cutover';
 end if;
end $$;
-- No DROP TABLE, user creation, role mutation, or historical application-data deletion.
commit;
