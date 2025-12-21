import sqlite3
conn = sqlite3.connect("data/cianbox_pos.db")
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print(f"Tablas encontradas: {len(tables)}")
for t in tables:
    print(f"  - {t}")
conn.close()
