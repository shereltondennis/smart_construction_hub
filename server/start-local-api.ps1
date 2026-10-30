$ErrorActionPreference = 'Stop'
$projectPath = Join-Path $PSScriptRoot 'SmartConstructionHub.Api.csproj'
$env:ASPNETCORE_ENVIRONMENT = 'Development'

Write-Host 'Starting API with Windows Authentication for SQL Server. No SQL password is required.' -ForegroundColor Green
Write-Host 'Leave this window open while using the app. Press Ctrl+C to stop the API.'
dotnet run --project $projectPath --urls http://localhost:5050
