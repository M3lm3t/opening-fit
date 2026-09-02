$ErrorActionPreference='Stop'
function Assert-DoBlockSyntax([string]$text,[string]$tag,[string]$label){
 $escaped=[regex]::Escape($tag)
 $pattern='(?is)DO \$'+$escaped+'\$ begin\s+(.*?)\s+end \$'+$escaped+'\$;'
 $match=[regex]::Match($text,$pattern)
 if(-not $match.Success){throw "$label incomplete $tag DO block"}
 $body=$match.Groups[1].Value.Trim()
 if(-not $body.EndsWith(';')){throw "$label unterminated $tag PL/pgSQL statement"}
 if($body -match '(?is)^select\s' -and $body -notmatch '(?is)\binto\b'){throw "$label destination-less SELECT in $tag"}
}
function Assert-FunctionBlockSyntax([string]$text,[string]$label){
 $matches=[regex]::Matches($text,'(?is)create\s+(?:or\s+replace\s+)?function\b(?:(?!\$\$).)*?language\s+plpgsql(?:(?!\$\$).)*?\bas\s+\$\$(.*?)\$\$\s*;')
 foreach($match in $matches){
  if($match.Groups[1].Value.TrimEnd() -notmatch '(?is)\bend\s*;\s*$'){throw "$label has a function body without END; before the closing dollar quote"}
 }
}
$malformed='DO $precondition$ begin select 1 end $precondition$;'
$rejected=$false
try { Assert-DoBlockSyntax $malformed 'precondition' 'regression fixture' } catch { $rejected=$true }
if(-not $rejected){throw 'validator accepted malformed precondition regression fixture'}
$invalidFunction="create function public.invalid_fixture() returns void language plpgsql as `$`$ begin perform 1; end `$`$;"
$rejected=$false
try { Assert-FunctionBlockSyntax $invalidFunction 'regression fixture' } catch { $rejected=$true }
if(-not $rejected){throw 'validator accepted exact invalid end $$; regression fixture'}
$root=Split-Path -Parent $PSScriptRoot
$dir=Join-Path $root 'release-artifacts'
$readOnly=@('openingfit-missions-production-baseline-inspection.sql','openingfit-missions-production-001-verification.sql','openingfit-missions-production-001-checkpoint-inspection.sql','openingfit-missions-production-002-verification.sql','openingfit-missions-production-003-verification.sql','openingfit-missions-production-004-verification.sql','openingfit-missions-production-final-security-audit.sql')
foreach($name in $readOnly){
 $text=[IO.File]::ReadAllText((Join-Path $dir $name));
 if($text -match '(?im)^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke|do)\b'){throw "$name is not read-only"}
 if($text -notmatch '(?im)^\s*select\b'){throw "$name has no SELECT"}
}
$expected=@{'001'='9A63F98DD176FF685B642305A41CD5144BFFCDADA65839999645A24783791C7E';'002'='8EE99CA86E2DB640FD378ABA2F21CC24BE7E209F0DED2691B20AFA4A2A7519BA';'003'='64BF2C323496F7857C9B0CD6ACA8D7397D0BC1768E058A3A67769CED58169A5F';'004'='29137DC5989F57BCB641663E059DCB9F5BC208228999657921F1900D13EA8AEB'}
foreach($n in $expected.Keys){
 $wrapper=[IO.File]::ReadAllText((Join-Path $dir "openingfit-missions-production-$n-execute.sql"));
 $source=Get-ChildItem (Join-Path $root "supabase/migrations/202608310${n}_*.sql");
 if((Get-FileHash -Algorithm SHA256 $source).Hash -ne $expected[$n]){throw "source checksum $n"}
 if($wrapper -notmatch '(?im)^BEGIN;' -or $wrapper -notmatch '(?im)^COMMIT;\s*$' -or $wrapper.IndexOf('DO $assert$') -gt $wrapper.LastIndexOf('COMMIT;')){throw "transaction/assertion $n"}
 if(-not $wrapper.Contains([IO.File]::ReadAllText($source.FullName))){throw "source logic missing $n"}
 if($wrapper -match 'supabase_migrations\.schema_migrations|OPENINGFIT_MISSIONS_ENABLED\s*=\s*true'){throw "unsafe wrapper $n"}
 if($wrapper -notmatch 'frtjfvhiimgruenqcuon'){throw "target warning $n"}
 if($n -eq '001'){Assert-FunctionBlockSyntax $wrapper "wrapper $n"}
}
function Get-SqlStatements([string]$sql){
 $items=[Collections.Generic.List[string]]::new(); $b=[Text.StringBuilder]::new(); $i=0; $mode='normal'; $tag=''
 while($i -lt $sql.Length){
  $c=$sql[$i]; $next=if($i+1 -lt $sql.Length){$sql[$i+1]}else{[char]0}
  if($mode -eq 'line'){if($c -eq "`n"){$mode='normal'};$i++;continue}
  if($mode -eq 'block'){if($c -eq '*' -and $next -eq '/'){$mode='normal';$i+=2}else{$i++};continue}
  if($mode -eq 'single'){[void]$b.Append($c);if($c -eq "'" -and $next -eq "'"){[void]$b.Append($next);$i+=2;continue};if($c -eq "'"){$mode='normal'};$i++;continue}
  if($mode -eq 'double'){[void]$b.Append($c);if($c -eq '"' -and $next -eq '"'){[void]$b.Append($next);$i+=2;continue};if($c -eq '"'){$mode='normal'};$i++;continue}
  if($mode -eq 'dollar'){if($sql.Substring($i).StartsWith($tag)){[void]$b.Append($tag);$i+=$tag.Length;$mode='normal'}else{[void]$b.Append($c);$i++};continue}
  if($c -eq '-' -and $next -eq '-'){$mode='line';$i+=2;continue}
  if($c -eq '/' -and $next -eq '*'){$mode='block';$i+=2;continue}
  if($c -eq "'"){$mode='single';[void]$b.Append($c);$i++;continue}
  if($c -eq '"'){$mode='double';[void]$b.Append($c);$i++;continue}
  if($c -eq '$'){$m=[regex]::Match($sql.Substring($i),'^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$');if($m.Success){$tag=$m.Value;$mode='dollar';[void]$b.Append($tag);$i+=$tag.Length;continue}}
  if($c -eq ';'){$value=$b.ToString().Trim();if($value){$items.Add($value+';')};[void]$b.Clear();$i++;continue}
  [void]$b.Append($c);$i++
 }
 if($mode -ne 'normal'){throw "Unbalanced SQL lexical state: $mode"}
 if($b.ToString().Trim()){throw 'Executable SQL does not end at a statement boundary'}
 return $items
}
$sourcePath=Join-Path $root 'supabase/migrations/202608310001_openingfit_missions_foundation.sql'
$sourceText=[IO.File]::ReadAllText($sourcePath); $sourceStatements=@(Get-SqlStatements $sourceText); $splitStatements=@()
foreach($stageName in @('001a','001b','001c')){
 $path=Join-Path $dir "openingfit-missions-production-$stageName-execute.sql"; $text=[IO.File]::ReadAllText($path)
 if([Text.Encoding]::UTF8.GetByteCount($text) -ge 10000){throw "$stageName exceeds 10,000 bytes"}
 if($text -notmatch '(?im)^BEGIN;' -or $text -notmatch '(?im)^COMMIT;\s*$'){throw "$stageName transaction boundary"}
 if(([regex]::Matches($text,'\$precondition\$').Count -ne 2) -or ([regex]::Matches($text,'\$assert\$').Count -ne 2)){throw "$stageName dollar quote imbalance"}
 foreach($tag in @('precondition','assert')){
 Assert-DoBlockSyntax $text $tag $stageName
 }
 if($stageName -eq '001c'){Assert-FunctionBlockSyntax $text $stageName}
 $begin='-- SOURCE MIGRATION 001 STAGE BEGIN';$end='-- SOURCE MIGRATION 001 STAGE END';$a=$text.IndexOf($begin)+$begin.Length;$z=$text.IndexOf($end)
 if($a -lt $begin.Length -or $z -le $a){throw "$stageName source markers"}
 $splitStatements += @(Get-SqlStatements $text.Substring($a,$z-$a))
 if($text -match 'supabase_migrations\.schema_migrations|OPENINGFIT_MISSIONS_ENABLED\s*=\s*true|OPENINGFIT_MISSIONS_ROLLOUT_PERCENT'){throw "$stageName unsafe content"}
}
if($sourceStatements.Count -ne $splitStatements.Count){throw '001 statement count mismatch'}
$missing=@($sourceStatements | Where-Object {$_ -cnotin $splitStatements})
$unexpected=@($splitStatements | Where-Object {$_ -cnotin $sourceStatements})
if($missing.Count -or $unexpected.Count){throw '001 statement coverage mismatch'}
$duplicates=$splitStatements|Group-Object|Where-Object Count -gt 1;if($duplicates){throw '001 source statement duplicated'}
$rlsLast=($splitStatements | Select-String -Pattern '^alter table public\.openingfit_mission_status_events enable row level security;' -CaseSensitive).LineNumber
$firstRevoke=($splitStatements | Select-String -Pattern '^revoke all on public\.openingfit_missions from public, anon, authenticated;' -CaseSensitive).LineNumber
$firstPolicy=($splitStatements | Select-String -Pattern '^create policy openingfit_missions_select_own' -CaseSensitive).LineNumber
if(-not $rlsLast -or $firstRevoke -ne $rlsLast+1 -or $firstPolicy -le $firstRevoke){throw '001 approved RLS/revoke split reallocation order mismatch'}
foreach($name in @('openingfit-missions-production-001a-verification.sql','openingfit-missions-production-001b-verification.sql','openingfit-missions-production-001c-verification.sql','openingfit-missions-production-001a-containment-verification.sql')){$text=[IO.File]::ReadAllText((Join-Path $dir $name));if($text -match '(?im)^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke|do)\b'){throw "$name is not read-only"}}
$stageAExecute=[IO.File]::ReadAllText((Join-Path $dir 'openingfit-missions-production-001a-execute.sql'))
$stageAVerify=[IO.File]::ReadAllText((Join-Path $dir 'openingfit-missions-production-001a-verification.sql'))
foreach($text in @($stageAExecute,$stageAVerify)){
 if($text -match "(?is)indexname\s+like\s+'openingfit_mission%'"){throw '001A uses unsafe aggregate index-prefix contract'}
 foreach($indexName in @('openingfit_missions_one_primary_active_idx','openingfit_missions_current_lookup_idx','openingfit_missions_history_idx','openingfit_missions_position_idx','openingfit_missions_source_report_idx','openingfit_mission_attempts_history_idx','openingfit_mission_encounters_verification_idx','openingfit_mission_status_events_history_idx')){
  if(-not $text.Contains($indexName)){throw "001A exact index contract missing $indexName"}
 }
 if($text -notmatch 'CREATE UNIQUE INDEX openingfit_missions_one_primary_active_idx'){throw '001A exact unique index property missing'}
}
if($stageAVerify -notmatch 'WHERE \(is_primary AND' -or $stageAVerify -notmatch 'WHERE \(source_report_id IS NOT NULL\)'){throw '001A verification exact partial-index properties missing'}
foreach($label in @('stage_absent','stage_partial','stage_complete','stage_complete_but_uncontained')){if(-not $stageAVerify.Contains($label)){throw "001A classification missing $label"}}
$containmentExecute=[IO.File]::ReadAllText((Join-Path $dir 'openingfit-missions-production-001a-containment-execute.sql'))
$containmentVerify=[IO.File]::ReadAllText((Join-Path $dir 'openingfit-missions-production-001a-containment-verification.sql'))
foreach($text in @($containmentExecute,$containmentVerify)){if([Text.Encoding]::UTF8.GetByteCount($text) -ge 10000){throw '001A containment artifact exceeds 10,000 bytes'};foreach($name in @('openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events')){if(-not $text.Contains($name)){throw "containment missing exact table $name"}}}
if($containmentExecute -notmatch '(?im)^BEGIN;' -or $containmentExecute -notmatch '(?im)^COMMIT;\s*$' -or $containmentExecute -notmatch '(?i)revoke all on table .* from public,anon,authenticated;' -or $containmentExecute -match '(?im)^\s*(create|alter|drop|insert|update|delete|truncate|grant)\b'){throw 'containment execution mutation scope invalid'}
foreach($privilege in @('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')){if(-not $containmentExecute.Contains("('$privilege')") -or -not $containmentVerify.Contains("('$privilege')")){throw "containment missing has_table_privilege coverage for $privilege"}}
foreach($label in @('containment_absent','containment_partial','containment_complete')){if(-not $containmentVerify.Contains($label)){throw "containment classification missing $label"}}
$stageBExecute=[IO.File]::ReadAllText((Join-Path $dir 'openingfit-missions-production-001b-execute.sql'))
if($stageBExecute -notmatch 'clean contained 001A is required'){throw '001B clean-contained precondition missing'}
$stageCPath=Join-Path $dir 'openingfit-missions-production-001c-execute.sql'
if((Get-FileHash -Algorithm SHA256 $stageCPath).Hash -ne '05D545F448656E027CC182EF9CB5CA4D3AF73AE9507ECF89AA3FF6FB6839A45B'){throw '001C artifact changed'}
$psqlRunbook=[IO.File]::ReadAllText((Join-Path $dir 'openingfit-missions-production-001c-psql-runbook.md'))
foreach($requiredText in @('db.frtjfvhiimgruenqcuon.supabase.co','postgres.frtjfvhiimgruenqcuon','ON_ERROR_STOP=1','-f $artifact','-f $verification','-f $checkpoint','post_001b_complete','Get-FileHash','-W','PGSSLMODE','pg_is_in_recovery','do not rerun')){if(-not $psqlRunbook.Contains($requiredText)){throw "001C psql runbook missing $requiredText"}}
if($psqlRunbook -notmatch 'port 6543 is prohibited|Never use port 6543' -or $psqlRunbook -match '(?i)(postgres(?:ql)?://|PGPASSWORD\s*=|\[YOUR-PASSWORD\]|service_role_key\s*=|eyJ[A-Za-z0-9_-]{20,})'){throw '001C psql runbook has unsafe connection or credential guidance'}
Get-ChildItem $dir/openingfit-missions-production-* | ForEach-Object { if([IO.File]::ReadAllText($_.FullName) -match '(?i)(service_role_key\s*=|eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?://[^\s]+:[^\s]+@)'){throw "secret-like content: $($_.Name)"} }
Write-Output 'Mission dark-launch artifacts validated.'
