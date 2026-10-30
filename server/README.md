# Smart Construction Hub API

ASP.NET Core 10 Web API backed by SQL Server and Entity Framework Core.

## Prerequisites

- .NET 10 SDK
- SQL Server Express, Developer, or SQL Server LocalDB
- Optional: `dotnet-ef` CLI tool

## Local setup

1. Local development uses SQL Server Windows Authentication. The API connects as the Windows account running it; no SQL username or password is stored or required. That Windows account must be allowed to connect to the SQL Server instance and create/use the `SmartConstructionHub` database.
2. Start the API from PowerShell with:

```powershell
.\server\start-local-api.ps1
```

Keep that window open while using the app. `reset-sql-password.ps1` remains as a compatibility shortcut and now starts the API without asking for a SQL password.
3. The API creates the configured database and seeds one connected sample project automatically on first start. You can also create it manually with `Database/schema.sql`.

For a migration-based production workflow, use:

```powershell
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate
dotnet ef database update
```

4. To start the API directly instead of using the helper:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --urls http://localhost:5050
```

Open Swagger at `http://localhost:5050/swagger`.

The site in the parent folder uses this API for its project list and project creation. By default it connects to `http://localhost:5050/api`. To use a different API host, define `window.SCH_API_BASE_URL` before `app.js` loads, for example:

```html
<script>window.SCH_API_BASE_URL = 'https://your-api-host/api';</script>
<script src="app.js"></script>
```

## Production setup

The API now authenticates administrators with an HttpOnly cookie. All `/api/*` routes require a signed-in administrator except `/api/health` and `/api/auth/login`. Do not expose the app until production secrets and origins are configured.

1. Create Azure SQL Database and an Azure App Service for .NET 10. Set `ASPNETCORE_ENVIRONMENT=Production`. Prefer serving the frontend and API under one custom site origin (for example, front end at `https://app.example.com`, API at `https://app.example.com/api` through a reverse proxy) so browser cookie policies work reliably.
2. Configure App Service settings (or Azure Key Vault references):
   - `ConnectionStrings__ConstructionDatabase`: Azure SQL connection string **without** a password.
   - `SCH_SQL_PASSWORD`: SQL login password.
   - `Frontend__Origins__0`: exact frontend origin, such as `https://your-app.azurestaticapps.net` (no trailing slash).
   - `Admin__Email`: administrator's email.
   - `Admin__DisplayName`: name shown in the app.
   - `SCH_ADMIN_PASSWORD_HASH`: generated PBKDF2 hash. Run this locally, then enter the returned `SCH_ADMIN_PASSWORD_HASH` as an App Service secret. Never commit the output:

     ```powershell
     .\Generate-ProductionSecrets.ps1 -Password 'a-long-unique-password'
     ```
   - `DataProtection__BlobUri`: shared Azure Blob URI for the ASP.NET Data Protection key ring.
   - `DataProtection__KeyIdentifier`: Azure Key Vault key URI used to encrypt the shared key ring.
   - Enable the App Service managed identity and grant it Blob Data Contributor on the key-ring container plus Key Vault Crypto User on the key.
3. Set Azure SQL firewall/network rules to allow the App Service, and use a least-privilege database login. Ensure the schema is initialized using a controlled database migration/deployment step.
4. Publish the frontend over HTTPS. Set the GitHub repository variable `SCH_API_BASE_URL` to `https://your-api-host/api`; the Pages workflow injects it before `app.js` loads. If using Azure Static Web Apps, configure the equivalent build-time API base URL in that deployment instead.
5. Cookies are configured `SameSite=None; Secure` in production. HTTPS is required. If using separate hosts, configure the exact frontend origin and test cookie behavior in your target browsers; same-origin proxying is preferred.

The old browser-only credentials are no longer used. The API accepts the single administrator configured in App Service settings. The API intentionally fails to start if administrator identity or password hash is missing.

For a production hash, the script uses PBKDF2-HMAC-SHA256 with 600,000 iterations and a random salt. The plain password is not stored by the API.

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
