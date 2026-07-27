-- Local-only failure fixture: an accidental permissive anon policy must make
-- the complete smoke matrix fail rather than treating query execution alone
-- as sufficient evidence of safe anonymous access.
create policy smoke_failure_anonymous_report_visibility
on public.report_history for select to anon
using (true);
