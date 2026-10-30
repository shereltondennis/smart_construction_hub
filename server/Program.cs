using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Azure.Identity;
using Azure.Extensions.AspNetCore.DataProtection.Blobs;
using Azure.Extensions.AspNetCore.DataProtection.Keys;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.IO;
using System.Text.Json.Serialization;
using SmartConstructionHub.Api.Data;
using SmartConstructionHub.Api.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddEnvironmentVariables();
builder.Host.UseWindowsService();

var frontendOrigins = builder.Configuration.GetSection("Frontend:Origins").Get<string[]>() ?? [];
if (builder.Environment.IsDevelopment())
{
    frontendOrigins = frontendOrigins.Concat(["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:8000", "http://127.0.0.1:8000"]).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
}
var adminEmail = builder.Configuration["Admin:Email"] ?? Environment.GetEnvironmentVariable("SCH_ADMIN_EMAIL");
var adminPasswordHash = builder.Configuration["Admin:PasswordHash"] ?? Environment.GetEnvironmentVariable("SCH_ADMIN_PASSWORD_HASH");
if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPasswordHash))
{
    throw new InvalidOperationException("Configure Admin:Email and Admin:PasswordHash before starting the API.");
}

var databaseConnection = builder.Configuration.GetConnectionString("ConstructionDatabase")
    ?? throw new InvalidOperationException("The ConstructionDatabase connection string is missing.");
var databasePassword = Environment.GetEnvironmentVariable("SCH_SQL_PASSWORD");
if (string.IsNullOrWhiteSpace(databasePassword))
{
    throw new InvalidOperationException("Set the SCH_SQL_PASSWORD environment variable before starting the API.");
}

var connectionBuilder = new SqlConnectionStringBuilder(databaseConnection)
{
    IntegratedSecurity = false,
    Password = databasePassword,
    Encrypt = SqlConnectionEncryptOption.Mandatory,
    TrustServerCertificate = builder.Environment.IsDevelopment()
};

builder.Services.AddDbContext<ConstructionDbContext>(options =>
    options.UseSqlServer(connectionBuilder.ConnectionString));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.WithOrigins(frontendOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "sch.admin.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.None;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("SmartConstructionHub");
var dataProtectionBlobUri = builder.Configuration["DataProtection:BlobUri"];
var dataProtectionKeyUri = builder.Configuration["DataProtection:KeyIdentifier"];
if (!string.IsNullOrWhiteSpace(dataProtectionBlobUri) && !string.IsNullOrWhiteSpace(dataProtectionKeyUri))
{
    dataProtection.PersistKeysToAzureBlobStorage(new Uri(dataProtectionBlobUri), new DefaultAzureCredential());
    dataProtection.ProtectKeysWithAzureKeyVault(new Uri(dataProtectionKeyUri), new DefaultAzureCredential());
}
else if (!builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException("Production requires DataProtection:BlobUri and DataProtection:KeyIdentifier for shared, encrypted cookie keys.");
}
else if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
}
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseCors("Frontend");
app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") &&
        (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method) || HttpMethods.IsDelete(context.Request.Method)))
    {
        var isLogin = context.Request.Path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase);
        if (!isLogin && context.Request.Headers.Origin.Count > 0 &&
            !frontendOrigins.Contains(context.Request.Headers.Origin.ToString(), StringComparer.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
    }
    await next();
});
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ConstructionDbContext>();
    await DatabaseInitializer.InitializeAsync(db);
}

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", service = "Smart Construction Hub API" })).AllowAnonymous();

app.MapPost("/api/auth/login", async (AdminLoginRequest request, HttpContext context) =>
{
    if (!string.Equals(request.Email?.Trim(), adminEmail, StringComparison.OrdinalIgnoreCase) || !VerifyPassword(request.Password ?? "", adminPasswordHash))
        return Results.Unauthorized();

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, adminEmail),
        new Claim(ClaimTypes.Name, builder.Configuration["Admin:DisplayName"] ?? "Administrator"),
        new Claim(ClaimTypes.Role, "Administrator")
    };
    await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
        new AuthenticationProperties { IsPersistent = false, AllowRefresh = true });
    return Results.Ok(new { name = claims[1].Value, email = adminEmail });
}).AllowAnonymous();

app.MapPost("/api/auth/logout", async (HttpContext context) =>
{
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/auth/me", (ClaimsPrincipal user) => Results.Ok(new
{
    name = user.FindFirstValue(ClaimTypes.Name) ?? "Administrator",
    email = user.FindFirstValue(ClaimTypes.NameIdentifier)
})).RequireAuthorization();

app.MapGet("/api/dashboard", async (ConstructionDbContext db) =>
{
    var projects = await db.Projects.AsNoTracking().ToListAsync();
    var paymentsThisMonth = await db.Payments.Where(x => x.PaymentDate.Month == DateTime.UtcNow.Month && x.PaymentDate.Year == DateTime.UtcNow.Year).SumAsync(x => (decimal?)x.Amount) ?? 0;
    var paid = await db.Payments.GroupBy(x => x.ProjectId).Select(x => new { ProjectId = x.Key, Paid = x.Sum(p => p.Amount) }).ToListAsync();
    return Results.Ok(new
    {
        ActiveProjects = projects.Count(x => x.Status != "Complete"),
        CompletedProjects = projects.Count(x => x.Status == "Complete"),
        TotalOutstanding = projects.Sum(x => x.ContractAmount) - paid.Sum(x => x.Paid),
        PaymentsThisMonth = paymentsThisMonth,
        MaterialsInInventory = await db.Materials.CountAsync()
    });
});
app.MapGet("/api/company-balance", async (ConstructionDbContext db) =>
{
    var balance = await db.CompanyBalances.AsNoTracking().SingleAsync(item => item.Id == 1);
    return Results.Ok(new { amount = balance.Amount });
});

app.MapGet("/api/clients", async (ConstructionDbContext db) => await db.Clients.AsNoTracking().Include(x => x.Projects).ToListAsync());
app.MapPost("/api/clients", async (Client client, ConstructionDbContext db) => { db.Clients.Add(client); await db.SaveChangesAsync(); return Results.Created($"/api/clients/{client.Id}", client); });
app.MapPut("/api/clients/{id:int}", async (int id, Client input, ConstructionDbContext db) =>
{
    var client = await db.Clients.FindAsync(id);
    if (client is null) return Results.NotFound();
    client.FullName = input.FullName.Trim();
    client.PhoneNumber = input.PhoneNumber?.Trim();
    client.Email = input.Email?.Trim();
    client.Address = input.Address?.Trim();
    client.PropertyLocation = input.PropertyLocation?.Trim();
    client.Notes = input.Notes?.Trim();
    await db.SaveChangesAsync();
    return Results.Ok(client);
});

app.MapGet("/api/projects", async (ConstructionDbContext db) => await db.Projects.AsNoTracking().Include(x => x.Client).Include(x => x.Payments).Select(x => new
{
    x.Id,
    x.ProjectNumber,
    x.Name,
    x.TypeOfWork,
    x.Location,
    x.Status,
    x.ContractAmount,
    Client = new { x.Client.Id, x.Client.FullName, x.Client.Email, x.Client.PhoneNumber },
    Payments = x.Payments.Select(payment => new { payment.Id, payment.PaymentDate, payment.Amount, payment.PaymentMethod, payment.ReceiptNumber }),
    Workers = x.Workers.Select(assignment => new { assignment.WorkerId, assignment.Position, assignment.AmountPaid, assignment.AttendanceNotes, Worker = new { assignment.Worker.Id, assignment.Worker.WorkerNumber, assignment.Worker.FullName, assignment.Worker.Phone, assignment.Worker.Skill, assignment.Worker.Rate, assignment.Worker.RatePeriod } })
}).ToListAsync());
app.MapGet("/api/projects/{id:int}", async (int id, ConstructionDbContext db) => await db.Projects.AsNoTracking().Include(x => x.Client).Include(x => x.HousePlans).Include(x => x.Estimates).ThenInclude(x => x.Items).Include(x => x.Payments).Include(x => x.Photos).Include(x => x.Documents).SingleOrDefaultAsync(x => x.Id == id) is { } project ? Results.Ok(project) : Results.NotFound());
app.MapPost("/api/projects", async (Project project, ConstructionDbContext db) => { db.Projects.Add(project); await db.SaveChangesAsync(); return Results.Created($"/api/projects/{project.Id}", project); });
app.MapPut("/api/projects/{id:int}", async (int id, Project input, ConstructionDbContext db) => { var project = await db.Projects.FindAsync(id); if (project is null) return Results.NotFound(); project.Name = input.Name; project.Status = input.Status; project.ContractAmount = input.ContractAmount; project.Location = input.Location; project.TypeOfWork = input.TypeOfWork; project.ExpectedCompletionDate = input.ExpectedCompletionDate; await db.SaveChangesAsync(); return Results.Ok(project); });

app.MapGet("/api/estimates", async (ConstructionDbContext db) => await db.Estimates.AsNoTracking().Include(x => x.Project).Include(x => x.Items).ToListAsync());
app.MapPost("/api/estimates", async (Estimate estimate, ConstructionDbContext db) => { db.Estimates.Add(estimate); await db.SaveChangesAsync(); return Results.Created($"/api/estimates/{estimate.Id}", estimate); });
app.MapGet("/api/payments", async (ConstructionDbContext db) => await db.Payments.AsNoTracking().OrderByDescending(x => x.PaymentDate).Select(payment => new
{
    payment.Id,
    payment.ProjectId,
    payment.PaymentDate,
    payment.Amount,
    payment.PaymentMethod,
    payment.ReceiptNumber,
    payment.MainBalanceBefore,
    payment.MainBalanceAfter,
    payment.Notes,
    payment.ReceiptCopyFileName,
    payment.ReceiptCopyContentType,
    Project = new { payment.Project.ProjectNumber, payment.Project.Name, Client = new { payment.Project.Client.FullName } }
}).ToListAsync());
app.MapGet("/api/payments/{id:int}/receipt-copy", async (int id, ConstructionDbContext db) =>
{
    var copy = await db.Payments.AsNoTracking().Where(payment => payment.Id == id)
        .Select(payment => new { payment.ReceiptCopyData, payment.ReceiptCopyContentType, payment.ReceiptCopyFileName }).SingleOrDefaultAsync();
    return copy?.ReceiptCopyData is { Length: > 0 }
        ? Results.File(copy.ReceiptCopyData, copy.ReceiptCopyContentType ?? "application/octet-stream")
        : Results.NotFound();
});
app.MapPost("/api/payments", async (Payment payment, ConstructionDbContext db) =>
{
    if (payment.Amount <= 0 || payment.ProjectId <= 0)
    {
        return Results.BadRequest(new { message = "A project and a payment amount greater than zero are required." });
    }

    if (payment.ReceiptCopyData is { Length: > 8_388_608 } ||
        (payment.ReceiptCopyData is not null && !new[] { "image/jpeg", "image/png", "image/webp", "application/pdf" }.Contains(payment.ReceiptCopyContentType, StringComparer.OrdinalIgnoreCase)))
    {
        return Results.BadRequest(new { message = "The receipt copy must be a JPEG, PNG, WebP, or PDF file no larger than 8 MB." });
    }

    var project = await db.Projects.FindAsync(payment.ProjectId);
    if (project is null)
    {
        return Results.BadRequest(new { message = "The selected project could not be found." });
    }

    payment.PaymentDate = payment.PaymentDate == default ? DateTime.UtcNow : payment.PaymentDate;
    var companyBalance = await db.CompanyBalances.SingleAsync(item => item.Id == 1);
    payment.MainBalanceBefore = companyBalance.Amount;
    companyBalance.Amount += payment.Amount;
    payment.MainBalanceAfter = companyBalance.Amount;
    payment.ReceiptNumber = null;
    project.Status = "In progress";
    db.Payments.Add(payment);
    await db.SaveChangesAsync();
    payment.ReceiptNumber = $"SCH-{payment.Id:D6}";
    await db.SaveChangesAsync();
    return Results.Created($"/api/payments/{payment.Id}", new { payment.Id, payment.ReceiptNumber, payment.ReceiptCopyFileName, payment.ReceiptCopyContentType });
});
app.MapPut("/api/payments/{id:int}", async (int id, Payment input, ConstructionDbContext db) =>
{
    if (input.Amount <= 0)
    {
        return Results.BadRequest(new { message = "The payment amount must be greater than zero." });
    }

    var payment = await db.Payments.FindAsync(id);
    if (payment is null)
    {
        return Results.NotFound();
    }

    payment.PaymentDate = input.PaymentDate == default ? payment.PaymentDate : input.PaymentDate;
    var difference = input.Amount - payment.Amount;
    var companyBalance = await db.CompanyBalances.SingleAsync(item => item.Id == 1);
    if (difference > companyBalance.Amount)
    {
        return Results.BadRequest(new { message = "The updated payment would exceed the available main balance." });
    }
    companyBalance.Amount += difference;
    payment.Amount = input.Amount;
    payment.MainBalanceAfter = companyBalance.Amount;
    payment.PaymentMethod = input.PaymentMethod;
    payment.Notes = input.Notes;
    await db.SaveChangesAsync();
    return Results.Ok(payment);
});
app.MapGet("/api/materials", async (ConstructionDbContext db) => await db.Materials.AsNoTracking().ToListAsync());
app.MapPost("/api/materials", async (Material material, ConstructionDbContext db) => { db.Materials.Add(material); await db.SaveChangesAsync(); return Results.Created($"/api/materials/{material.Id}", material); });
app.MapGet("/api/workers", async (ConstructionDbContext db) => await db.Workers.AsNoTracking().Include(x => x.Projects).ThenInclude(x => x.Project).ToListAsync());
app.MapPut("/api/workers/{id:int}", async (int id, Worker input, ConstructionDbContext db) =>
{
    var worker = await db.Workers.FindAsync(id);
    if (worker is null) return Results.NotFound();
    worker.FullName = input.FullName.Trim();
    worker.Phone = input.Phone?.Trim();
    worker.Address = input.Address?.Trim();
    worker.Skill = input.Skill?.Trim();
    worker.Position = input.Position?.Trim();
    worker.EmploymentType = input.EmploymentType;
    worker.DateHired = input.DateHired;
    worker.EmergencyContactName = input.EmergencyContactName?.Trim();
    worker.EmergencyContactPhone = input.EmergencyContactPhone?.Trim();
    worker.IdDocumentType = input.IdDocumentType?.Trim();
    worker.IdDocumentNumber = input.IdDocumentNumber?.Trim();
    worker.PhotoDataUrl = input.PhotoDataUrl;
    worker.Rate = input.Rate;
    worker.RatePeriod = input.RatePeriod;
    worker.Status = input.Status;
    worker.AttendanceStatus = input.AttendanceStatus;
    worker.AttendanceNotes = input.AttendanceNotes?.Trim();
    worker.WorkHours = input.WorkHours;
    worker.AmountOwed = input.AmountOwed;
    await db.SaveChangesAsync();
    return Results.Ok(worker);
});
app.MapGet("/api/worker-attendance/dates", async (ConstructionDbContext db) => await db.WorkerAttendance.AsNoTracking()
    .Select(record => record.AttendanceDate)
    .Distinct()
    .OrderByDescending(date => date)
    .ToListAsync());
app.MapGet("/api/worker-attendance", async (DateOnly date, ConstructionDbContext db) => await db.WorkerAttendance.AsNoTracking()
    .Where(record => record.AttendanceDate == date)
    .Select(record => new { record.Id, record.WorkerId, WorkerNumber = record.Worker.WorkerNumber, record.AttendanceDate, record.Status, record.WorkHours, record.Notes })
    .ToListAsync());
app.MapPost("/api/worker-attendance", async (WorkerAttendance input, ConstructionDbContext db) =>
{
    var validStatuses = new[] { "Not recorded", "Present", "Absent", "On leave" };
    if (input.WorkerId <= 0 || input.AttendanceDate == default || !validStatuses.Contains(input.Status) || input.WorkHours < 0 || input.WorkHours > 24)
    {
        return Results.BadRequest(new { message = "A worker, valid date, attendance status, and hours from 0 to 24 are required." });
    }

    var worker = await db.Workers.FindAsync(input.WorkerId);
    if (worker is null) return Results.NotFound(new { message = "The selected worker could not be found." });

    var record = await db.WorkerAttendance.SingleOrDefaultAsync(existing => existing.WorkerId == input.WorkerId && existing.AttendanceDate == input.AttendanceDate);
    if (record is null)
    {
        record = new WorkerAttendance { WorkerId = input.WorkerId, AttendanceDate = input.AttendanceDate };
        db.WorkerAttendance.Add(record);
    }

    record.Status = input.Status;
    record.WorkHours = input.WorkHours;
    record.Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim();
    worker.AttendanceStatus = record.Status;
    worker.AttendanceNotes = record.Notes;
    await db.SaveChangesAsync();

    return Results.Ok(new { record.Id, record.WorkerId, worker.WorkerNumber, record.AttendanceDate, record.Status, record.WorkHours, record.Notes });
});
app.MapPost("/api/workers/accrue", async (DateOnly throughDate, ConstructionDbContext db) =>
{
    if (throughDate == default || throughDate > DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)))
    {
        return Results.BadRequest(new { message = "A valid accrual date is required." });
    }

    var workers = await db.Workers.Where(worker => worker.Status == "Active" && worker.DateHired != null && worker.DateHired <= throughDate && (worker.RatePeriod == "Daily" || worker.RatePeriod == "Weekly")).ToListAsync();
    foreach (var worker in workers)
    {
        var firstUncounted = worker.LastPayAccrualDate?.AddDays(1) ?? worker.DateHired!.Value;
        if (firstUncounted < worker.DateHired!.Value) firstUncounted = worker.DateHired.Value;
        if (firstUncounted > throughDate) continue;

        var payableDays = 0;
        for (var day = firstUncounted; day <= throughDate; day = day.AddDays(1))
        {
            if (day.DayOfWeek != DayOfWeek.Sunday) payableDays++;
        }

        if (payableDays > 0)
        {
            var perDay = worker.RatePeriod == "Weekly" ? worker.Rate / 6m : worker.Rate;
            worker.AmountOwed += Math.Round(perDay * payableDays, 2, MidpointRounding.AwayFromZero);
        }

        worker.LastPayAccrualDate = throughDate;
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { workersAccrued = workers.Count });
});
app.MapPost("/api/workers", async (Worker worker, ConstructionDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(worker.WorkerNumber) || string.IsNullOrWhiteSpace(worker.FullName) || worker.Rate <= 0 ||
        (worker.RatePeriod is "Daily" or "Weekly" && worker.DateHired is null))
    {
        return Results.BadRequest(new { message = "Worker ID, name, a positive pay rate, and hire date for daily or weekly workers are required." });
    }

    if (await db.Workers.AnyAsync(existing => existing.WorkerNumber == worker.WorkerNumber))
    {
        return Results.Conflict(new { message = "A worker with this ID already exists." });
    }

    worker.LastPayAccrualDate = worker.DateHired?.AddDays(-1);
    db.Workers.Add(worker);
    await db.SaveChangesAsync();
    return Results.Created($"/api/workers/{worker.Id}", worker);
});
app.MapGet("/api/worker-payments", async (ConstructionDbContext db) => await db.WorkerPayments.AsNoTracking().OrderByDescending(x => x.PaymentDate).Select(payment => new
{
    payment.Id,
    payment.WorkerId,
    payment.ProjectId,
    payment.PaymentDate,
    payment.Amount,
    payment.WorkerBalanceBefore,
    payment.WorkerBalanceAfter,
    payment.MainBalanceBefore,
    payment.MainBalanceAfter,
    payment.PaymentMethod,
    payment.ReceiptNumber,
    payment.Notes,
    payment.ReceiptCopyFileName,
    payment.ReceiptCopyContentType,
    Worker = new { payment.Worker.FullName, payment.Worker.WorkerNumber },
    Project = new { payment.Project.ProjectNumber, payment.Project.Name }
}).ToListAsync());
app.MapGet("/api/worker-payments/{id:int}/receipt-copy", async (int id, ConstructionDbContext db) =>
{
    var copy = await db.WorkerPayments.AsNoTracking().Where(payment => payment.Id == id)
        .Select(payment => new { payment.ReceiptCopyData, payment.ReceiptCopyContentType, payment.ReceiptCopyFileName }).SingleOrDefaultAsync();
    return copy?.ReceiptCopyData is { Length: > 0 }
        ? Results.File(copy.ReceiptCopyData, copy.ReceiptCopyContentType ?? "application/octet-stream")
        : Results.NotFound();
});
app.MapPost("/api/worker-payments", async (WorkerPayment payment, ConstructionDbContext db) =>
{
    if (payment.WorkerId <= 0 || payment.ProjectId <= 0 || payment.Amount <= 0)
    {
        return Results.BadRequest(new { message = "A worker, project, and payment amount greater than zero are required." });
    }

    if (payment.ReceiptCopyData is { Length: > 8_388_608 } ||
        (payment.ReceiptCopyData is not null && !new[] { "image/jpeg", "image/png", "image/webp", "application/pdf" }.Contains(payment.ReceiptCopyContentType, StringComparer.OrdinalIgnoreCase)))
    {
        return Results.BadRequest(new { message = "The receipt copy must be a JPEG, PNG, WebP, or PDF file no larger than 8 MB." });
    }

    var worker = await db.Workers.FindAsync(payment.WorkerId);
    if (worker is null || !await db.Projects.AnyAsync(project => project.Id == payment.ProjectId))
    {
        return Results.BadRequest(new { message = "The selected worker or project could not be found." });
    }

    payment.PaymentDate = payment.PaymentDate == default ? DateTime.UtcNow : payment.PaymentDate;
    payment.ReceiptNumber = string.IsNullOrWhiteSpace(payment.ReceiptNumber) ? $"WRC-{DateTime.UtcNow:yyyyMMddHHmmssfff}" : payment.ReceiptNumber;
    var companyBalance = await db.CompanyBalances.SingleAsync(item => item.Id == 1);
    payment.WorkerBalanceBefore = worker.AmountOwed;
    if (payment.Amount > worker.AmountOwed)
    {
        return Results.BadRequest(new { message = "The payment cannot exceed the worker's outstanding balance." });
    }

    if (payment.Amount > companyBalance.Amount)
    {
        return Results.BadRequest(new { message = "The payment cannot exceed the available main balance." });
    }

    payment.WorkerBalanceAfter = worker.AmountOwed - payment.Amount;
    payment.MainBalanceBefore = companyBalance.Amount;
    payment.MainBalanceAfter = companyBalance.Amount - payment.Amount;
    worker.AmountOwed = payment.WorkerBalanceAfter;
    companyBalance.Amount = payment.MainBalanceAfter;
    db.WorkerPayments.Add(payment);
    await db.SaveChangesAsync();
    return Results.Created($"/api/worker-payments/{payment.Id}", new { payment.Id, payment.ReceiptNumber, payment.ReceiptCopyFileName, payment.ReceiptCopyContentType, payment.WorkerBalanceBefore, payment.WorkerBalanceAfter, payment.MainBalanceBefore, payment.MainBalanceAfter });
});
app.MapGet("/api/documents", async (ConstructionDbContext db) => await db.Documents.AsNoTracking().Include(x => x.Project).ToListAsync());
app.MapGet("/api/photos", async (ConstructionDbContext db) => await db.Photos.AsNoTracking().Include(x => x.Project).ToListAsync());
app.MapPost("/api/project-workers", async (ProjectWorker assignment, ConstructionDbContext db) =>
{
    if (!await db.Projects.AnyAsync(project => project.Id == assignment.ProjectId) || !await db.Workers.AnyAsync(worker => worker.Id == assignment.WorkerId))
    {
        return Results.BadRequest(new { message = "The selected worker or project could not be found." });
    }

    if (await db.ProjectWorkers.AnyAsync(item => item.ProjectId == assignment.ProjectId && item.WorkerId == assignment.WorkerId))
    {
        return Results.Conflict(new { message = "This worker is already assigned to the selected project." });
    }

    db.ProjectWorkers.Add(assignment);
    await db.SaveChangesAsync();
    return Results.Created($"/api/project-workers/{assignment.ProjectId}/{assignment.WorkerId}", assignment);
});

app.Run();

static bool VerifyPassword(string password, string encodedHash)
{
    var parts = encodedHash.Split(':', 2);
    if (parts.Length != 2) return false;
    try
    {
        var salt = Convert.FromBase64String(parts[0]);
        var expected = Convert.FromBase64String(parts[1]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 600_000, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
    catch (FormatException) { return false; }
}

record AdminLoginRequest(string? Email, string? Password);
