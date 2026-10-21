import sqlite3

con = sqlite3.connect("dev.db")
PLOT = "7cb9b592fb8c405fb05619d9a15e8425"  # SQLite stores ids without dashes

print("Scans for the Karura test plot:")
for row in con.execute(
    "SELECT scan_date, round(ndvi_value, 3), cloud_cover_pct, tile_source "
    "FROM ndvi_scans WHERE plot_id = ? ORDER BY scan_date", (PLOT,)
):
    print("  ", row)