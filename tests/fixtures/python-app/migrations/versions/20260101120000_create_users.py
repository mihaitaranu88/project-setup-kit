from alembic import op
import sqlalchemy as sa

revision = "20260101120000"
down_revision = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.Integer, primary_key=True))


def downgrade() -> None:
    op.drop_table("users")
