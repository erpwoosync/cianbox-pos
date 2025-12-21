"""Script para probar la inicialización de la base de datos."""
import sys
sys.path.insert(0, 'src')

from src.db.database import Base, get_engine, init_database

# Primero eliminar el archivo de la BD
import os
db_path = "data/cianbox_pos.db"
if os.path.exists(db_path):
    os.remove(db_path)
    print(f"Base de datos eliminada: {db_path}")

# Importar modelos manualmente
from src.models import (
    User, Tenant, Branch, Category, Brand, Product,
    ProductPrice, PriceList, Promotion, OfflineQueue,
    AppConfig, Device
)

# Verificar que los modelos están registrados en Base.metadata
print(f"\nTablas registradas en Base.metadata:")
for table in Base.metadata.tables:
    print(f"  - {table}")

# Crear engine y tablas
engine = get_engine()
Base.metadata.create_all(bind=engine)

print(f"\nBase de datos creada correctamente")

# Verificar tablas creadas
import sqlite3
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print(f"\nTablas en la base de datos ({len(tables)}):")
for t in tables:
    print(f"  - {t}")
conn.close()
