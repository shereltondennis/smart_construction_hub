using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Text.Json.Serialization;
using SmartConstructionHub.Api.Data;
using SmartConstructionHub.Api.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddEnvironmentVariables();
builder.Host.UseWindowsService();

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
    Password = databasePassword
};

builder.Services.AddDbContext<ConstructionDbContext>(options =>
    options.UseSqlServer(connectionBuilder.ConnectionString));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.SetIsOriginAllowed(origin => origin == "null" || origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase)).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseCors("Frontend");
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

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", service = "Smart Construction Hub API" }));

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

app.MapGet("/api/clients", async (ConstructionDbContext db) => await db.Clients.AsNoTracking().Include(x => x.Projects).ToListAsync());
app.MapPost("/api/clients", async (Client client, ConstructionDbContext db) => { db.Clients.Add(client); await db.SaveChangesAsync(); return Results.Created($"/api/clients/{client.Id}", client); });

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
app.MapGet("/api/payments", async (ConstructionDbContext db) => await db.Payments.AsNoTracking().Include(x => x.Project).OrderByDescending(x => x.PaymentDate).ToListAsync());
app.MapPost("/api/payments", async (Payment payment, ConstructionDbContext db) =>
{
    if (payment.Amount <= 0 || payment.ProjectId <= 0)
    {
        return Results.BadRequest(new { message = "A project and a payment amount greater than zero are required." });
    }

    var project = await db.Projects.FindAsync(payment.ProjectId);
    if (project is null)
    {
        return Results.BadRequest(new { message = "The selected project could not be found." });
    }

    payment.PaymentDate = payment.PaymentDate == default ? DateTime.UtcNow : payment.PaymentDate;
    payment.ReceiptNumber = null;
    project.Status = "In progress";
    db.Payments.Add(payment);
    await db.SaveChangesAsync();
    payment.ReceiptNumber = $"SCH-{payment.Id:D6}";
    await db.SaveChangesAsync();
    return Results.Created($"/api/payments/{payment.Id}", payment);
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
    payment.Amount = input.Amount;
    payment.PaymentMethod = input.PaymentMethod;
    payment.Notes = input.Notes;
    await db.SaveChangesAsync();
    return Results.Ok(payment);
});
app.MapGet("/api/materials", async (ConstructionDbContext db) => await db.Materials.AsNoTracking().ToListAsync());
app.MapPost("/api/materials", async (Material material, ConstructionDbContext db) => { db.Materials.Add(material); await db.SaveChangesAsync(); return Results.Created($"/api/materials/{material.Id}", material); });
app.MapGet("/api/workers", async (ConstructionDbContext db) => await db.Workers.AsNoTracking().Include(x => x.Projects).ThenInclude(x => x.Project).Include(x => x.Payments).ThenInclude(x => x.Project).ToListAsync());
app.MapGet("/api/worker-payments", async (ConstructionDbContext db) => await db.WorkerPayments.AsNoTracking().Include(x => x.Worker).Include(x => x.Project).OrderByDescending(x => x.PaymentDate).ToListAsync());
app.MapPost("/api/worker-payments", async (WorkerPayment payment, ConstructionDbContext db) =>
{
    if (payment.WorkerId <= 0 || payment.ProjectId <= 0 || payment.Amount <= 0)
    {
        return Results.BadRequest(new { message = "A worker, project, and payment amount greater than zero are required." });
    }

    var worker = await db.Workers.FindAsync(payment.WorkerId);
    if (worker is null || !await db.Projects.AnyAsync(project => project.Id == payment.ProjectId))
    {
        return Results.BadRequest(new { message = "The selected worker or project could not be found." });
    }

    payment.PaymentDate = payment.PaymentDate == default ? DateTime.UtcNow : payment.PaymentDate;
    payment.ReceiptNumber = string.IsNullOrWhiteSpace(payment.ReceiptNumber) ? $"WRC-{DateTime.UtcNow:yyyyMMddHHmmssfff}" : payment.ReceiptNumber;
    worker.AmountOwed = Math.Max(0, worker.AmountOwed - payment.Amount);
    db.WorkerPayments.Add(payment);
    await db.SaveChangesAsync();
    return Results.Created($"/api/worker-payments/{payment.Id}", payment);
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
