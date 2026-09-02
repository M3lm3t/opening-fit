$ErrorActionPreference='Stop'
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
Get-ChildItem $dir/openingfit-missions-production-* | ForEach-Object { if([IO.File]::ReadAllText($_.FullName) -match '(?i)(service_role_key\s*=|eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?://[^\s]+:[^\s]+@)'){throw "secret-like content: $($_.Name)"} }
Write-Output 'Mission dark-launch artifacts validated.'
