$ErrorActionPreference = 'Stop'

$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
$appPath = 'C:\Users\USER\smart_construction_hub\server\publish\SmartConstructionHub.Api.exe'
$securePassword = Read-Host 'Choose a new password for sch_app' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ($password.Length -lt 8) { throw 'Choose a password with at least eight characters.' }

    $escapedPassword = $password.Replace("'", "''")
    & $sqlcmd -S '.\SQLEXPRESS' -E -C -b -Q "ALTER LOGIN [sch_app] WITH PASSWORD = N'$escapedPassword';"
    if ($LASTEXITCODE -ne 0) { throw 'The SQL login password could not be reset.' }

    [Environment]::SetEnvironmentVariable('SCH_SQL_PASSWORD', $password, 'User')
    $env:SCH_SQL_PASSWORD = $password
    $listener = Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }
    Start-Process -FilePath $appPath -ArgumentList '--urls', 'http://localhost:5050' -WindowStyle Hidden
    Start-Sleep -Seconds 5
    if (-not (Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue)) {
        throw 'The password was reset, but the API did not start. Run the background setup again.'
    }
    Write-Host 'Password reset and background API started successfully.' -ForegroundColor Green
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
