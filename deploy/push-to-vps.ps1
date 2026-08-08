# Deploy frontend + server to Hostinger VPS (OpenSSH required)
# Usage:
#   $env:VPS_HOST = "187.77.129.179"
#   $env:VPS_USER = "root"
#   $env:VPS_KEY  = "$env:USERPROFILE\.ssh\id_ed25519"   # optional
#   .\deploy\push-to-vps.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:Path = "C:\Program Files\nodejs;" + $env:Path

$HostName = if ($env:VPS_HOST) { $env:VPS_HOST } else { "187.77.129.179" }
$User = if ($env:VPS_USER) { $env:VPS_USER } else { "root" }
$Key = $env:VPS_KEY
$Remote = "${User}@${HostName}"
$App = "/var/www/dhatterwal"

$sshArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($Key -and (Test-Path $Key)) {
  $sshArgs = @("-i", $Key) + $sshArgs
}

Write-Host "==> Build frontend (same-origin VITE_API_URL)"
if (-not (Test-Path ".env.production")) {
  Set-Content -Path ".env.production" -Value "VITE_API_URL=`n" -Encoding utf8
}
npm run build

Write-Host "==> Ensure remote dirs"
& ssh @sshArgs $Remote "mkdir -p $App/dist $App/server $App/deploy"

Write-Host "==> Upload dist/"
& scp @sshArgs -r "$Root\dist\*" "${Remote}:${App}/dist/"

Write-Host "==> Upload server/ (no .env, no node_modules, no pglite)"
$tmp = Join-Path $env:TEMP "dhatterwal-server-upload"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
robocopy "$Root\server" $tmp /E /XD node_modules data\pglite .git /XF .env /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
& scp @sshArgs -r "$tmp\*" "${Remote}:${App}/server/"
Remove-Item $tmp -Recurse -Force

Write-Host "==> Upload deploy/"
& scp @sshArgs -r "$Root\deploy\*" "${Remote}:${App}/deploy/"

Write-Host "==> npm ci + prisma + pm2 reload"
$remoteCmd = @"
set -e
cd $App/server
npm ci --omit=dev
npx prisma generate
npx prisma db push
cd $App
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
curl -s http://127.0.0.1:8787/health
echo
"@
& ssh @sshArgs $Remote $remoteCmd

Write-Host "==> Done. Open http://${HostName}/ and login (API = same VPS)."
