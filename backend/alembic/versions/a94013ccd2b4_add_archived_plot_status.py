"""add archived plot status

Revision ID: a94013ccd2b4
Revises: 7ab49d4558d2
Create Date: 2026-11-03 02:13:26.177953

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a94013ccd2b4'
down_revision: Union[str, None] = '7ab49d4558d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE plot_status ADD VALUE IF NOT EXISTS 'archived'")
    # SQLite stores enums as text, so nothing to do there


def downgrade() -> None:
    pass  # removing an enum value is not supported; archived rows stay valid
