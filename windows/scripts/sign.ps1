# Signs one file in place with Daybook's code-signing certificate, held by
# SSL.com eSigner (windows/README.md, Signing). Tauri runs it for the app, its
# uninstaller and both installers, when the release workflow passes it as
# bundle.windows.signCommand; a build without it stays unsigned.
#
#   powershell -File windows/scripts/sign.ps1 <file>
#
# Needs CODE_SIGN_TOOL_PATH (an unzipped CodeSignTool) and the four ESIGNER_*
# values from the eSigner account. Never prints them.
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = 'Stop'

foreach ($name in 'CODE_SIGN_TOOL_PATH', 'ESIGNER_USERNAME', 'ESIGNER_PASSWORD', 'ESIGNER_CREDENTIAL_ID', 'ESIGNER_TOTP_SECRET') {
  if (-not [Environment]::GetEnvironmentVariable($name)) { throw "$name isn't set, so $File can't be signed." }
}

$tool = Join-Path $env:CODE_SIGN_TOOL_PATH 'CodeSignTool.bat'
& $tool sign `
  "-username=$env:ESIGNER_USERNAME" `
  "-password=$env:ESIGNER_PASSWORD" `
  "-credential_id=$env:ESIGNER_CREDENTIAL_ID" `
  "-totp_secret=$env:ESIGNER_TOTP_SECRET" `
  "-input_file_path=$File" `
  -override

# CodeSignTool can exit 0 after an error, so ask Windows whether the file is signed.
$signature = Get-AuthenticodeSignature -FilePath $File
if ($signature.Status -ne 'Valid') {
  throw "$File isn't signed after CodeSignTool ran: $($signature.Status) $($signature.StatusMessage)"
}
Write-Output "Signed $File as $($signature.SignerCertificate.Subject)"
