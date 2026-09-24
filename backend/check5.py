import sqlite3

con = sqlite3.connect("dev.db")
tables = [row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print(sorted(tables))