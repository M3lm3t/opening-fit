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
$malformed='DO $precondition$ begin select 1 end $precondition$;'
$rejected=$false
try { Assert-DoBlockSyntax $malformed 'precondition' 'regression fixture' } catch { $rejected=$true }
if(-not $rejected){throw 'validator accepted malformed precondition regression fixture'}
$root=Split-Path -Parent $PSScriptRoot
$dir=Join-Path $root 'release-artifacts'
$readOnly=@('openingfit-missions-production-baseline-inspection.sql','openingfit-missions-production-001-verification.sql','openingfit-missions-production-002-verification.sql','openingfit-missions-production-003-verification.sql','openingfit-missions-production-004-verification.sql','openingfit-missions-production-final-security-audit.sql')
foreach($name in $readOnly){
 $text=[IO.File]::ReadAllText((Join-Path $dir $name));
 if($text -match '(?im)^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke|do)\b'){throw "$name is not read-only"}
 if($text -notmatch '(?im)^\s*select\b'){throw "$name has no SELECT"}
}
$expected=@{'001'='59D2FD81213240A4B98B4AE5A467B6830825B69448BA29AB87B0E03490A2E352';'002'='8EE99CA86E2DB640FD378ABA2F21CC24BE7E209F0DED2691B20AFA4A2A7519BA';'003'='64BF2C323496F7857C9B0CD6ACA8D7397D0BC1768E058A3A67769CED58169A5F';'004'='29137DC5989F57BCB641663E059DCB9F5BC208228999657921F1900D13EA8AEB'}
foreach($n in $expected.Keys){
 $wrapper=[IO.File]::ReadAllText((Join-Path $dir "openingfit-missions-production-$n-execute.sql"));
 $source=Get-ChildItem (Join-Path $root "supabase/migrations/202608310${n}_*.sql");
 if((Get-FileHash -Algorithm SHA256 $source).Hash -ne $expected[$n]){throw "source checksum $n"}
 if($wrapper -notmatch '(?im)^BEGIN;' -or $wrapper -notmatch '(?im)^COMMIT;\s*$' -or $wrapper.IndexOf('DO $assert$') -gt $wrapper.LastIndexOf('COMMIT;')){throw "transaction/assertion $n"}
 if(-not $wrapper.Contains([IO.File]::ReadAllText($source.FullName))){throw "source logic missing $n"}
 if($wrapper -match 'supabase_migrations\.schema_migrations|OPENINGFIT_MISSIONS_ENABLED\s*=\s*true'){throw "unsafe wrapper $n"}
 if($wrapper -notmatch 'frtjfvhiimgruenqcuon'){throw "target warning $n"}
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
 $begin='-- SOURCE MIGRATION 001 STAGE BEGIN';$end='-- SOURCE MIGRATION 001 STAGE END';$a=$text.IndexOf($begin)+$begin.Length;$z=$text.IndexOf($end)
 if($a -lt $begin.Length -or $z -le $a){throw "$stageName source markers"}
 $splitStatements += @(Get-SqlStatements $text.Substring($a,$z-$a))
 if($text -match 'supabase_migrations\.schema_migrations|OPENINGFIT_MISSIONS_ENABLED\s*=\s*true|OPENINGFIT_MISSIONS_ROLLOUT_PERCENT'){throw "$stageName unsafe content"}
}
if($sourceStatements.Count -ne $splitStatements.Count){throw '001 statement count mismatch'}
for($i=0;$i -lt $sourceStatements.Count;$i++){if($sourceStatements[$i] -cne $splitStatements[$i]){throw "001 statement coverage/order mismatch at $i"}}
$duplicates=$splitStatements|Group-Object|Where-Object Count -gt 1;if($duplicates){throw '001 source statement duplicated'}
foreach($name in @('openingfit-missions-production-001a-verification.sql','openingfit-missions-production-001b-verification.sql','openingfit-missions-production-001c-verification.sql')){$text=[IO.File]::ReadAllText((Join-Path $dir $name));if($text -match '(?im)^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke|do)\b'){throw "$name is not read-only"};if($text -notmatch "stage_absent" -or $text -notmatch "stage_partial" -or $text -notmatch "stage_complete"){throw "$name classification missing"}}
Get-ChildItem $dir/openingfit-missions-production-* | ForEach-Object { if([IO.File]::ReadAllText($_.FullName) -match '(?i)(service_role_key\s*=|eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?://[^\s]+:[^\s]+@)'){throw "secret-like content: $($_.Name)"} }
Write-Output 'Mission dark-launch artifacts validated.'
