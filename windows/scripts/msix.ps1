# Packages the built app (target/release/daybook.exe) as Daybook.msix for the
# Microsoft Store, with windows/msix/AppxManifest.xml. The Store signs it on
# upload, so this package stays unsigned and only installs through the Store.
#
#   powershell -File windows/scripts/msix.ps1 <output.msix>
#
# The package identity comes from Partner Center (Product identity), through
# MSIX_IDENTITY_NAME, MSIX_PUBLISHER and MSIX_PUBLISHER_DISPLAY_NAME. Without
# them it uses placeholders: the package builds, but the Store won't take it.
param([Parameter(Mandatory = $true)][string]$Output)
$ErrorActionPreference = 'Stop'

$windows = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $windows 'target\release\daybook.exe'
if (-not (Test-Path $exe)) { throw "$exe isn't built yet: run cargo tauri build first." }

$config = Get-Content (Join-Path $windows 'tauri.conf.json') -Raw | ConvertFrom-Json
$version = "$($config.version).0" # the Store wants four parts, the last one 0

$identity = if ($env:MSIX_IDENTITY_NAME) { $env:MSIX_IDENTITY_NAME } else { 'Daybook.Preview' }
$publisher = if ($env:MSIX_PUBLISHER) { $env:MSIX_PUBLISHER } else { 'CN=Daybook Preview' }
$publisherName = if ($env:MSIX_PUBLISHER_DISPLAY_NAME) { $env:MSIX_PUBLISHER_DISPLAY_NAME } else { 'Daybook' }
if (-not $env:MSIX_IDENTITY_NAME) { Write-Warning 'MSIX_IDENTITY_NAME is not set: built with a placeholder identity the Store will refuse.' }

# The package's files: the app, its logos and the manifest.
$layout = Join-Path ([IO.Path]::GetTempPath()) "daybook-msix-$PID"
if (Test-Path $layout) { Remove-Item $layout -Recurse -Force }
New-Item -ItemType Directory -Path $layout | Out-Null
Copy-Item $exe -Destination $layout
Copy-Item (Join-Path $windows 'msix\Assets') -Destination $layout -Recurse

$manifest = Get-Content (Join-Path $windows 'msix\AppxManifest.xml') -Raw
$manifest = $manifest.Replace('{{IDENTITY_NAME}}', [Security.SecurityElement]::Escape($identity))
$manifest = $manifest.Replace('{{PUBLISHER_DISPLAY_NAME}}', [Security.SecurityElement]::Escape($publisherName))
$manifest = $manifest.Replace('{{PUBLISHER}}', [Security.SecurityElement]::Escape($publisher))
$manifest = $manifest.Replace('{{VERSION}}', $version)
Set-Content -Path (Join-Path $layout 'AppxManifest.xml') -Value $manifest -Encoding utf8

# makeappx comes with the Windows SDK; take the newest x64 one.
$makeappx = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe" |
  Sort-Object { [version]$_.Directory.Parent.Name } -Descending |
  Select-Object -First 1
if (-not $makeappx) { throw 'makeappx.exe not found: install the Windows 10/11 SDK.' }

& $makeappx.FullName pack /o /d $layout /p $Output
if ($LASTEXITCODE -ne 0) { throw "makeappx failed with exit code $LASTEXITCODE." }
Remove-Item $layout -Recurse -Force
Write-Output "Packaged $Output ($identity $version)"
