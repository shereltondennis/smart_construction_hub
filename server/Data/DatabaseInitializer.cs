using Microsoft.EntityFrameworkCore;
using SmartConstructionHub.Api.Models;

namespace SmartConstructionHub.Api.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(ConstructionDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('ProjectWorkers', 'Position') IS NULL ALTER TABLE ProjectWorkers ADD Position NVARCHAR(120) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Payments', 'ReceiptCopyFileName') IS NULL ALTER TABLE Payments ADD ReceiptCopyFileName NVARCHAR(260) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Payments', 'ReceiptCopyContentType') IS NULL ALTER TABLE Payments ADD ReceiptCopyContentType NVARCHAR(100) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Payments', 'ReceiptCopyData') IS NULL ALTER TABLE Payments ADD ReceiptCopyData VARBINARY(MAX) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Payments', 'MainBalanceBefore') IS NULL ALTER TABLE Payments ADD MainBalanceBefore DECIMAL(18,2) NOT NULL CONSTRAINT DF_Payments_MainBalanceBefore DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Payments', 'MainBalanceAfter') IS NULL ALTER TABLE Payments ADD MainBalanceAfter DECIMAL(18,2) NOT NULL CONSTRAINT DF_Payments_MainBalanceAfter DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'Address') IS NULL ALTER TABLE Workers ADD Address NVARCHAR(300) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'EmploymentType') IS NULL ALTER TABLE Workers ADD EmploymentType NVARCHAR(40) NOT NULL CONSTRAINT DF_Workers_EmploymentType DEFAULT N'Full-time';");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'DateHired') IS NULL ALTER TABLE Workers ADD DateHired DATE NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'Position') IS NULL ALTER TABLE Workers ADD Position NVARCHAR(120) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'LastPayAccrualDate') IS NULL ALTER TABLE Workers ADD LastPayAccrualDate DATE NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'EmergencyContactName') IS NULL ALTER TABLE Workers ADD EmergencyContactName NVARCHAR(160) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'EmergencyContactPhone') IS NULL ALTER TABLE Workers ADD EmergencyContactPhone NVARCHAR(40) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'IdDocumentType') IS NULL ALTER TABLE Workers ADD IdDocumentType NVARCHAR(80) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'IdDocumentNumber') IS NULL ALTER TABLE Workers ADD IdDocumentNumber NVARCHAR(100) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'PhotoDataUrl') IS NULL ALTER TABLE Workers ADD PhotoDataUrl NVARCHAR(MAX) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'AttendanceStatus') IS NULL ALTER TABLE Workers ADD AttendanceStatus NVARCHAR(30) NOT NULL CONSTRAINT DF_Workers_AttendanceStatus DEFAULT N'Not recorded';");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'AttendanceNotes') IS NULL ALTER TABLE Workers ADD AttendanceNotes NVARCHAR(500) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'WorkHours') IS NULL ALTER TABLE Workers ADD WorkHours DECIMAL(18,2) NOT NULL CONSTRAINT DF_Workers_WorkHours DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'AmountOwed') IS NULL ALTER TABLE Workers ADD AmountOwed DECIMAL(18,2) NOT NULL CONSTRAINT DF_Workers_AmountOwed DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('Workers', 'Status') IS NULL ALTER TABLE Workers ADD Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Workers_Status DEFAULT N'Active';");
        await db.Database.ExecuteSqlRawAsync("IF OBJECT_ID('WorkerAttendance', 'U') IS NULL CREATE TABLE WorkerAttendance (Id INT IDENTITY PRIMARY KEY, WorkerId INT NOT NULL, AttendanceDate DATE NOT NULL, Status NVARCHAR(30) NOT NULL DEFAULT N'Not recorded', WorkHours DECIMAL(18,2) NOT NULL DEFAULT 0, Notes NVARCHAR(500), CONSTRAINT FK_WorkerAttendance_Workers FOREIGN KEY (WorkerId) REFERENCES Workers(Id) ON DELETE CASCADE, CONSTRAINT UQ_WorkerAttendance_Worker_Date UNIQUE (WorkerId, AttendanceDate));");
        await db.Database.ExecuteSqlRawAsync("IF OBJECT_ID('WorkerPayments', 'U') IS NULL CREATE TABLE WorkerPayments (Id INT IDENTITY PRIMARY KEY, WorkerId INT NOT NULL, ProjectId INT NOT NULL, PaymentDate DATETIME2 NOT NULL, Amount DECIMAL(18,2) NOT NULL, PaymentMethod NVARCHAR(40), ReceiptNumber NVARCHAR(80) NOT NULL UNIQUE, Notes NVARCHAR(500), FOREIGN KEY (WorkerId) REFERENCES Workers(Id) ON DELETE CASCADE, FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE);");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'ReceiptCopyFileName') IS NULL ALTER TABLE WorkerPayments ADD ReceiptCopyFileName NVARCHAR(260) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'ReceiptCopyContentType') IS NULL ALTER TABLE WorkerPayments ADD ReceiptCopyContentType NVARCHAR(100) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'ReceiptCopyData') IS NULL ALTER TABLE WorkerPayments ADD ReceiptCopyData VARBINARY(MAX) NULL;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'WorkerBalanceBefore') IS NULL ALTER TABLE WorkerPayments ADD WorkerBalanceBefore DECIMAL(18,2) NOT NULL CONSTRAINT DF_WorkerPayments_WorkerBalanceBefore DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'WorkerBalanceAfter') IS NULL ALTER TABLE WorkerPayments ADD WorkerBalanceAfter DECIMAL(18,2) NOT NULL CONSTRAINT DF_WorkerPayments_WorkerBalanceAfter DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'MainBalanceBefore') IS NULL ALTER TABLE WorkerPayments ADD MainBalanceBefore DECIMAL(18,2) NOT NULL CONSTRAINT DF_WorkerPayments_MainBalanceBefore DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF COL_LENGTH('WorkerPayments', 'MainBalanceAfter') IS NULL ALTER TABLE WorkerPayments ADD MainBalanceAfter DECIMAL(18,2) NOT NULL CONSTRAINT DF_WorkerPayments_MainBalanceAfter DEFAULT 0;");
        await db.Database.ExecuteSqlRawAsync("IF OBJECT_ID('CompanyBalances', 'U') IS NULL CREATE TABLE CompanyBalances (Id INT NOT NULL PRIMARY KEY CHECK (Id = 1), Amount DECIMAL(18,2) NOT NULL DEFAULT 0);");
        await db.Database.ExecuteSqlRawAsync("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_WorkerPayments_ReceiptNumber' AND object_id = OBJECT_ID('WorkerPayments')) CREATE UNIQUE INDEX UX_WorkerPayments_ReceiptNumber ON WorkerPayments(ReceiptNumber);");
        if (!await db.CompanyBalances.AnyAsync())
        {
            var received = await db.Payments.SumAsync(payment => (decimal?)payment.Amount) ?? 0;
            var paidToWorkers = await db.WorkerPayments.SumAsync(payment => (decimal?)payment.Amount) ?? 0;
            db.CompanyBalances.Add(new CompanyBalance { Id = 1, Amount = received - paidToWorkers });
            await db.SaveChangesAsync();
        }

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
