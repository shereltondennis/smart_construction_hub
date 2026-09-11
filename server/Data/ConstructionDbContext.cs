using Microsoft.EntityFrameworkCore;
using SmartConstructionHub.Api.Models;

namespace SmartConstructionHub.Api.Data;

public class ConstructionDbContext(DbContextOptions<ConstructionDbContext> options) : DbContext(options)
{
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<HousePlan> HousePlans => Set<HousePlan>();
    public DbSet<Estimate> Estimates => Set<Estimate>();
    public DbSet<EstimateItem> EstimateItems => Set<EstimateItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Worker> Workers => Set<Worker>();
    public DbSet<ProjectWorker> ProjectWorkers => Set<ProjectWorker>();
    public DbSet<ProjectDocument> Documents => Set<ProjectDocument>();
    public DbSet<ProjectPhoto> Photos => Set<ProjectPhoto>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Client>().Property(x => x.FullName).HasMaxLength(160).IsRequired();
        modelBuilder.Entity<Project>().HasIndex(x => x.ProjectNumber).IsUnique();
        modelBuilder.Entity<Project>().Property(x => x.ContractAmount).HasPrecision(18, 2);
        modelBuilder.Entity<Estimate>().HasIndex(x => x.EstimateNumber).IsUnique();
        modelBuilder.Entity<EstimateItem>().Property(x => x.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<EstimateItem>().Property(x => x.UnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<Payment>().Property(x => x.Amount).HasPrecision(18, 2);
        modelBuilder.Entity<HousePlan>().Property(x => x.BuildingArea).HasPrecision(18, 2);
        modelBuilder.Entity<Material>().Property(x => x.PurchasePrice).HasPrecision(18, 2);
        modelBuilder.Entity<Material>().Property(x => x.QuantityPurchased).HasPrecision(18, 3);
        modelBuilder.Entity<Material>().Property(x => x.QuantityUsed).HasPrecision(18, 3);
        modelBuilder.Entity<Worker>().Property(x => x.Rate).HasPrecision(18, 2);
        modelBuilder.Entity<ProjectWorker>().Property(x => x.AmountPaid).HasPrecision(18, 2);
        modelBuilder.Entity<ProjectWorker>().HasKey(x => new { x.ProjectId, x.WorkerId });
        modelBuilder.Entity<Project>().HasOne(x => x.Client).WithMany(x => x.Projects).HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Estimate>().HasMany(x => x.Items).WithOne(x => x.Estimate).HasForeignKey(x => x.EstimateId).OnDelete(DeleteBehavior.Cascade);
    }
}
