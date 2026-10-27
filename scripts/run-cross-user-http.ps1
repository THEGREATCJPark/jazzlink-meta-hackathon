# Interactive manual operator flow; never writes credentials to disk.
$ErrorActionPreference = 'Stop'
$result = 1
function Read-SecretValue([string] $label) {
  $secure = Read-Host $label -AsSecureString
  return [System.Net.NetworkCredential]::new('', $secure).Password
}
try {
  $env:JAZZLINK_TEST_ADMIN_KEY = Read-SecretValue 'Supabase server-only admin key for inlotwlppvrscyjncbbb'
  $env:JAZZLINK_TEST_PUBLISHABLE_KEY = Read-SecretValue 'Supabase publishable key for inlotwlppvrscyjncbbb'
  $env:JAZZLINK_HTTP_TEST = 'yes'
  node "$PSScriptRoot/test-cross-user-http.mjs"
  $result = $LASTEXITCODE
} finally {
  Remove-Item Env:JAZZLINK_TEST_ADMIN_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:JAZZLINK_TEST_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:JAZZLINK_HTTP_TEST -ErrorAction SilentlyContinue
}
exit $result
