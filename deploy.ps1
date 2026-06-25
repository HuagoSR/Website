param(
	[string]$RemoteHost = "123.56.132.139",
	[int]$Port = 54322,
	[string]$User = "huagosr",
	[string]$RemoteSiteDir = "/home/huagosr/my_website/html",
	[string]$RemoteBackupDir = "/home/huagosr/my_website/html_backup",
	[string]$RemoteContainer = "secure-nginx"
)

$ErrorActionPreference = "Stop"

function Get-PnpmCommand {
	$commands = @(
		(Get-Command pnpm.cmd -ErrorAction SilentlyContinue),
		(Get-Command pnpm -ErrorAction SilentlyContinue)
	) | Where-Object { $_ }

	if ($commands.Count -gt 0) {
		return $commands[0].Source
	}

	$fallback = Join-Path $env:APPDATA "npm\pnpm.cmd"
	if (Test-Path $fallback) {
		return $fallback
	}

	throw "pnpm was not found. Please install pnpm first."
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distDir = Join-Path $projectRoot "dist"
$remote = "${User}@${RemoteHost}"
$pnpmCommand = Get-PnpmCommand

Write-Host ""
Write-Host "==> Step 1/4: Building the site locally"
& $pnpmCommand "build"

if (-not (Test-Path $distDir)) {
	throw "The dist directory was not created: $distDir"
}

Write-Host ""
Write-Host "==> Step 2/4: Backing up the current site on the server"
$backupCommand = "rm -rf '{0}' && cp -r '{1}' '{0}' && find '{1}' -mindepth 1 -maxdepth 1 ! -name '.htpasswd_saves' -exec rm -rf {{}} +" -f $RemoteBackupDir, $RemoteSiteDir
& ssh -p $Port $remote $backupCommand

Write-Host ""
Write-Host "==> Step 3/4: Uploading the new dist files"
& scp -P $Port -r "$distDir/." "${remote}:$RemoteSiteDir/"

Write-Host ""
Write-Host "==> Step 4/4: Reloading nginx inside the Docker container"
& ssh -p $Port $remote "docker exec $RemoteContainer nginx -s reload"

Write-Host ""
Write-Host "Done."
Write-Host "Site URL: https://huago.cloud"
