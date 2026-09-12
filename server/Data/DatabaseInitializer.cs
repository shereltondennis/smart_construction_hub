using Microsoft.EntityFrameworkCore;
using SmartConstructionHub.Api.Models;

namespace SmartConstructionHub.Api.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(ConstructionDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('ProjectWorkers', 'Position') IS NULL ALTER TABLE ProjectWorkers ADD Position NVARCHAR(120) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF OBJECT_ID('WorkerPayments', 'U') IS NULL CREATE TABLE WorkerPayments (Id INT IDENTITY PRIMARY KEY, WorkerId INT NOT NULL, ProjectId INT NOT NULL, PaymentDate DATETIME2 NOT NULL, Amount DECIMAL(18,2) NOT NULL, PaymentMethod NVARCHAR(40), ReceiptNumber NVARCHAR(80) NOT NULL UNIQUE, Notes NVARCHAR(500), FOREIGN KEY (WorkerId) REFERENCES Workers(Id) ON DELETE CASCADE, FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE);");

        if (await db.Clients.AnyAsync())
        {
            return;
        }

        var client = new Client
        {
            FullName = "John Doe",
            PhoneNumber = "+231 888 827 060",
            Email = "info.smartconstructionhub@gmail.com",
            PropertyLocation = "Paynesville, Monrovia, Liberia"
        };

        var project = new Project
        {
            ProjectNumber = "PRJ-001",
            Name = "Willow Creek Residence",
            TypeOfWork = "New house construction",
            Location = "Paynesville, Monrovia",
            StartDate = new DateOnly(2026, 9, 1),
            ExpectedCompletionDate = new DateOnly(2027, 3, 1),
            Status = "In progress",
            ContractAmount = 25000,
            Client = client
        };

        var estimate = new Estimate
        {
            EstimateNumber = "EST-001",
            Project = project,
            Status = "Approved",
            Items = new List<EstimateItem>
            {
                new() { Material = "Cement", Quantity = 80, Unit = "bags", UnitPrice = 12.50m },
                new() { Material = "2x4 Plank", Quantity = 50, Unit = "pcs", UnitPrice = 5.00m },
                new() { Material = "Roofing Sheets", Quantity = 8, Unit = "bundles", UnitPrice = 140.00m }
            }
        };

        db.Clients.Add(client);
        db.Projects.Add(project);
        db.Estimates.Add(estimate);
        db.Payments.Add(new Payment
        {
            Project = project,
            PaymentDate = DateTime.UtcNow.AddDays(-2),
            Amount = 4500,
            PaymentMethod = "Mobile money",
            ReceiptNumber = "RC-0001"
        });
        db.Materials.AddRange(
            new Material { Name = "Cement", Unit = "bags", QuantityPurchased = 120, QuantityUsed = 40, Supplier = "Monrovia Building Supply", PurchasePrice = 12.50m },
            new Material { Name = "2x4 Plank", Unit = "pcs", QuantityPurchased = 80, QuantityUsed = 30, Supplier = "Bernard Farm Timber", PurchasePrice = 5.00m });

        await db.SaveChangesAsync();
    }
}
