# Run interactively from a trusted PowerShell terminal. No key is read from arguments or files.
$ErrorActionPreference = 'Stop'
$previousKey = [Environment]::GetEnvironmentVariable('MODEL_API_KEY', 'Process')
$previousModel = [Environment]::GetEnvironmentVariable('META_TEXT_MODEL', 'Process')
$previousBase = [Environment]::GetEnvironmentVariable('MODEL_API_BASE_URL', 'Process')
$previousProvenance = [Environment]::GetEnvironmentVariable('META_KEY_PROVENANCE', 'Process')
$keyPointer = [IntPtr]::Zero
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is unavailable.' }
    $model = Read-Host 'Enter the exact production-configured model ID (not a secret)'
    if ($model -notmatch '^[A-Za-z0-9_./-]{1,100}$') { throw 'Invalid model ID.' }
    Write-Host 'Key provenance: 1 = you independently verified this exact key is the production key; 2 = separate or unverified.'
    $choice = Read-Host 'Enter 1 or 2'
    if ($choice -notin @('1', '2')) { throw 'Invalid provenance selection.' }
    $secureKey = Read-Host 'Enter the Meta key locally (input is hidden)' -AsSecureString
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($plainKey)) { throw 'No key was entered.' }
    [Environment]::SetEnvironmentVariable('MODEL_API_KEY', $plainKey, 'Process')
    [Environment]::SetEnvironmentVariable('META_TEXT_MODEL', $model, 'Process')
    [Environment]::SetEnvironmentVariable('MODEL_API_BASE_URL', 'https://api.meta.ai/v1', 'Process')
    [Environment]::SetEnvironmentVariable('META_KEY_PROVENANCE', $(if ($choice -eq '1') { 'operator_attests_production' } else { 'independent_or_unverified' }), 'Process')
    $plainKey = $null
    & node --experimental-strip-types (Join-Path $PSScriptRoot 'meta-context-diagnostic.ts')
    $diagnosticExitCode = $LASTEXITCODE
} catch {
    Write-Error 'Diagnostic could not start. Check Node.js and the prompted inputs.' -ErrorAction Continue
    $diagnosticExitCode = 1
} finally {
    if ($keyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
    $plainKey = $null
    [Environment]::SetEnvironmentVariable('MODEL_API_KEY', $previousKey, 'Process')
    [Environment]::SetEnvironmentVariable('META_TEXT_MODEL', $previousModel, 'Process')
    [Environment]::SetEnvironmentVariable('MODEL_API_BASE_URL', $previousBase, 'Process')
    [Environment]::SetEnvironmentVariable('META_KEY_PROVENANCE', $previousProvenance, 'Process')
}
exit $diagnosticExitCode
