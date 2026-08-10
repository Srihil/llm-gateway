"""initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("api_key_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("monthly_budget_usd", sa.Numeric(10, 4), nullable=False, server_default="10.0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "team_policies",
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("max_rpm", sa.Integer, server_default="60"),
        sa.Column("max_tpm", sa.Integer, server_default="100000"),
        sa.Column("allowed_models", JSON, nullable=True),
        sa.Column("routing_strategy", sa.String(50), server_default="priority"),
    )

    op.create_table(
        "providers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("base_url", sa.String(255), nullable=False),
        sa.Column("api_key_encrypted", sa.Text, nullable=True),
        sa.Column("priority", sa.Integer, server_default="100"),
        sa.Column("is_enabled", sa.Boolean, server_default="true"),
        sa.Column("models_config", JSON, nullable=True),
    )

    op.create_table(
        "usage_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("request_id", sa.String(36), nullable=False, index=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("provider_id", UUID(as_uuid=True), sa.ForeignKey("providers.id"), nullable=True),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("input_tokens", sa.Integer, server_default="0"),
        sa.Column("output_tokens", sa.Integer, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 8), server_default="0"),
        sa.Column("latency_ms", sa.Integer, server_default="0"),
        sa.Column("cached", sa.Boolean, server_default="false"),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), index=True),
    )

    op.create_table(
        "budget_usage",
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("period_month", sa.Date, primary_key=True),
        sa.Column("spent_usd", sa.Numeric(10, 4), server_default="0"),
        sa.Column("request_count", sa.Integer, server_default="0"),
    )


def downgrade():
    op.drop_table("budget_usage")
    op.drop_table("usage_records")
    op.drop_table("providers")
    op.drop_table("team_policies")
    op.drop_table("teams")
