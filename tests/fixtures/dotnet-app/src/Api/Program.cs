var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/health", () => "ok");
app.MapGet("/orders", () => Results.Ok()).RequireAuthorization();
app.Run();
