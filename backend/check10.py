import sqlite3
con = sqlite3.connect("dev.db")
for row in con.execute("SELECT username, account_id, role FROM platform_accounts"):
    print(row)