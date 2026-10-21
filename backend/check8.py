import sqlite3

con = sqlite3.connect("dev.db")
PLOT = "02582176a2ca4feda1170539f47c16bf"

print("NDVI scans:")
for row in con.execute(
    "SELECT scan_date, round(ndvi_value, 3) FROM ndvi_scans WHERE plot_id = ? ORDER BY scan_date", (PLOT,)
):
    print("  ", row)

print("Carbon tokens (kg, status):")
for row in con.execute("SELECT quantity_kg_co2, status FROM carbon_tokens"):
    print("  ", row)