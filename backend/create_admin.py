"""Create a Buyer or Admin account (these are provisioned directly, per the approved design).

    python create_admin.py ADMIN admin1 MyPassword123
    python create_admin.py BUYER  buyer1 MyPassword123
"""
import sys
import uuid

from app.core.database import SessionLocal
from app.core.security import hash_password
import app.models  # noqa: F401
from app.models.enums import AccountRole
from app.models.platform_account import PlatformAccount


def main() -> None:
    if len(sys.argv) != 4:
        print("Usage: python create_admin.py <ADMIN|BUYER> <username> <password>")
        sys.exit(1)
    role_arg, username, password = sys.argv[1], sys.argv[2], sys.argv[3]
    role = AccountRole(role_arg.upper())
    db = SessionLocal()
    try:
        db.add(PlatformAccount(account_id=uuid.uuid4(), role=role, display_name=username,
                               username=username, password_hash=hash_password(password)))
        db.commit()
        print(f"Created {role.value} account '{username}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()