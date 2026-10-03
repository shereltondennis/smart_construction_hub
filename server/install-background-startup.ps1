$ErrorActionPreference = 'Stop'

$appPath = 'C:\Users\USER\smart_construction_hub\server\publish\SmartConstructionHub.Api.exe'
$startupFile = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\SmartConstructionHubApi.vbs'
$logDirectory = Join-Path $PSScriptRoot 'logs'
$stdoutLog = Join-Path $logDirectory 'background-api.out.log'
$stderrLog = Join-Path $logDirectory 'background-api.error.log'

if (-not (Test-Path -LiteralPath $appPath)) {
    throw "The published API was not found at $appPath."
}

$securePassword = Read-Host 'Enter the sch_app SQL password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ([string]::IsNullOrWhiteSpace($password)) { throw 'A database password is required.' }

    [Environment]::SetEnvironmentVariable('SCH_SQL_PASSWORD', $password, 'User')
    $env:SCH_SQL_PASSWORD = $password
    $vbsLauncher = @"
Set shell = CreateObject("WScript.Shell")
shell.Run ""$appPath --urls http://localhost:5050"", 0, False
"@
    Set-Content -LiteralPath $startupFile -Value $vbsLauncher -Encoding ASCII

    $listener = Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }

    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    Remove-Item -LiteralPath $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $appPath -ArgumentList '--urls', 'http://localhost:5050' -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    Start-Sleep -Seconds 5
    if (-not (Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue)) {
        $details = (Get-Content -LiteralPath $stdoutLog, $stderrLog -Raw -ErrorAction SilentlyContinue) -join "`n"
        throw "The background API did not start. Error: $details"
    }
    Write-Host 'Smart Construction Hub now starts silently in the background when you sign in.' -ForegroundColor Green
    Write-Host 'You may close this PowerShell window.' -ForegroundColor Green
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
