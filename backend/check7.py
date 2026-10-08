import sqlite3

con = sqlite3.connect("dev.db")


def show(title, sql):
    print("\n" + title)
    for row in con.execute(sql):
        print("  ", row)


show("NDVI scans (date, ndvi, tile_source):", "SELECT scan_date, round(ndvi_value, 3), tile_source FROM ndvi_scans ORDER BY scan_date")
show("Carbon tokens (kg, status):", "SELECT quantity_kg_co2, status FROM carbon_tokens")
show("Ledger (type, amount):", "SELECT entry_type, amount FROM ledger_entries")
show("Plot status:", "SELECT status FROM tree_plots")
show("Imagery sources:", "SELECT source_name FROM imagery_sources")
show("Engine configs (cloud %, drop threshold):", "SELECT cloud_cover_threshold_pct, drop_threshold FROM ndvi_engine_configs")