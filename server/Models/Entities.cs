namespace SmartConstructionHub.Api.Models;

public class Client
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? PropertyLocation { get; set; }
    public string? Notes { get; set; }
    public ICollection<Project> Projects { get; set; } = new List<Project>();
}

public class Project
{
    public int Id { get; set; }
    public string ProjectNumber { get; set; } = "";
    public int ClientId { get; set; }
    public Client Client { get; set; } = null!;
    public string Name { get; set; } = "";
    public string? TypeOfWork { get; set; }
    public string? Location { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? ExpectedCompletionDate { get; set; }
    public string Status { get; set; } = "Planning";
    public decimal ContractAmount { get; set; }
    public ICollection<HousePlan> HousePlans { get; set; } = new List<HousePlan>();
    public ICollection<Estimate> Estimates { get; set; } = new List<Estimate>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<ProjectPhoto> Photos { get; set; } = new List<ProjectPhoto>();
    public ICollection<ProjectWorker> Workers { get; set; } = new List<ProjectWorker>();
    public ICollection<ProjectDocument> Documents { get; set; } = new List<ProjectDocument>();
}

public class HousePlan
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Name { get; set; } = "";
    public string? FilePath { get; set; }
    public int? Bedrooms { get; set; }
    public int? Bathrooms { get; set; }
    public string? RoofDesign { get; set; }
    public decimal? BuildingArea { get; set; }
    public string? Dimensions { get; set; }
}

public class Estimate
{
    public int Id { get; set; }
    public string EstimateNumber { get; set; } = "";
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Draft";
    public ICollection<EstimateItem> Items { get; set; } = new List<EstimateItem>();
}

public class EstimateItem
{
    public int Id { get; set; }
    public int EstimateId { get; set; }
    public Estimate Estimate { get; set; } = null!;
    public string Material { get; set; } = "";
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public decimal Total => Quantity * UnitPrice;
}

public class Payment
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public DateTime PaymentDate { get; set; }
    public decimal Amount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReceiptNumber { get; set; }
    public string? Notes { get; set; }
}

public class Material
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Unit { get; set; } = "";
    public decimal QuantityPurchased { get; set; }
    public decimal QuantityUsed { get; set; }
    public string? Supplier { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal QuantityRemaining => QuantityPurchased - QuantityUsed;
}

public class Worker
{
    public int Id { get; set; }
    public string WorkerNumber { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? Phone { get; set; }
    public string? Skill { get; set; }
    public decimal Rate { get; set; }
    public string RatePeriod { get; set; } = "Daily";
    public ICollection<ProjectWorker> Projects { get; set; } = new List<ProjectWorker>();
}

public class ProjectWorker
{
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public int WorkerId { get; set; }
    public Worker Worker { get; set; } = null!;
    public decimal AmountPaid { get; set; }
    public string? AttendanceNotes { get; set; }
}

public class ProjectDocument
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Name { get; set; } = "";
    public string DocumentType { get; set; } = "";
    public string FilePath { get; set; } = "";
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class ProjectPhoto
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Category { get; set; } = "During Construction";
    public string FilePath { get; set; } = "";
    public string? Caption { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
