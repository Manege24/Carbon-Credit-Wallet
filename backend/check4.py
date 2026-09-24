from app.main import app

for route in app.routes:
    if hasattr(route, "methods"):
        print(list(route.methods), route.path)