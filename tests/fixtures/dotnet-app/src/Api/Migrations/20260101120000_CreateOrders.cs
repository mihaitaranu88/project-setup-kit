using Microsoft.EntityFrameworkCore.Migrations;

public partial class CreateOrders : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.CreateTable(name: "Orders", columns: table => new { Id = table.Column<int>() });
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "Orders");
}
