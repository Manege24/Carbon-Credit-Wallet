from app.core.database import Base
import app.models

print(sorted(Base.metadata.tables.keys()))