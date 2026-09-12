# Smart Construction Hub API

ASP.NET Core 10 Web API backed by SQL Server and Entity Framework Core.

## Prerequisites

- .NET 10 SDK
- SQL Server Express, Developer, or SQL Server LocalDB
- Optional: `dotnet-ef` CLI tool

## Configure and run

1. The project uses SQL Server authentication. The login name and server are in `appsettings.json`; its password is intentionally not stored there. Before starting the API, set it for your Windows account:

```powershell
[Environment]::SetEnvironmentVariable('SCH_SQL_PASSWORD', 'your-password-here', 'User')
```

Close and reopen PowerShell after running that command. For the current PowerShell session only, use:

```powershell
$env:SCH_SQL_PASSWORD = 'your-password-here'
```

Update `appsettings.json` if your SQL Server instance or login name differs.
2. The API creates the configured database and seeds one connected sample project automatically on first start. You can also create it manually with `Database/schema.sql`.

For a migration-based production workflow, use:

```powershell
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate
dotnet ef database update
```

3. Start the API:

```powershell
dotnet run --urls http://localhost:5050
```

Open Swagger at `http://localhost:5050/swagger`.

The browser prototype in the parent folder is still static. To connect it to this API, replace its in-memory data loading with requests to `http://localhost:5050/api/dashboard`, `/api/projects`, `/api/clients`, and the other routes below.

## Main endpoints

- `GET /api/dashboard`
- `GET|POST /api/clients`
- `GET|POST|PUT /api/projects`
- `GET|POST /api/estimates`
- `GET|POST /api/payments`
- `GET|POST /api/materials`
- `GET /api/workers`
- `GET /api/documents`
- `GET /api/photos`
