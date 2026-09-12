$ErrorActionPreference = 'Stop'

$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
$server = '.\SQLEXPRESS'
$login = 'sch_app'

if (-not (Test-Path -LiteralPath $sqlcmd)) {
    throw 'SQL Server command-line tools were not found on this computer.'
}

$integratedOnly = (& $sqlcmd -S $server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(int, SERVERPROPERTY('IsIntegratedSecurityOnly'));" | Select-Object -Last 1).Trim()
if ($integratedOnly -eq '1') {
    throw 'SQL Server is configured for Windows Authentication only. In SQL Server Management Studio, enable SQL Server and Windows Authentication mode, restart SQL Server (SQLEXPRESS), then run this script again.'
}

$securePassword = Read-Host "Choose a password for the SQL login $login" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ($password.Length -lt 8) {
        throw 'Choose a password with at least eight characters.'
    }

    $escapedPassword = $password.Replace("'", "''")
    $query = @"
IF DB_ID(N'SmartConstructionHub') IS NULL
    CREATE DATABASE [SmartConstructionHub];
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$login')
    CREATE LOGIN [$login] WITH PASSWORD = N'$escapedPassword', CHECK_POLICY = ON;
USE [SmartConstructionHub];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$login')
    CREATE USER [$login] FOR LOGIN [$login];
ALTER ROLE [db_owner] ADD MEMBER [$login];
"@

    & $sqlcmd -S $server -E -C -b -Q $query
    if ($LASTEXITCODE -ne 0) { throw 'SQL Server did not create the login. Your Windows account may not have SQL Server administrator permission.' }

    $env:SCH_SQL_PASSWORD = $password
    Set-Location $PSScriptRoot
    Write-Host 'SQL login created. Starting Smart Construction Hub API...' -ForegroundColor Green
    dotnet run --urls http://localhost:5050
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
