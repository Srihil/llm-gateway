import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    monthly_budget_usd: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=Decimal("10.0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    policy: Mapped[Optional["TeamPolicy"]] = relationship("TeamPolicy", back_populates="team", uselist=False, cascade="all, delete-orphan")
    usage_records: Mapped[list["UsageRecord"]] = relationship("UsageRecord", back_populates="team")
    budget_usage: Mapped[list["BudgetUsage"]] = relationship("BudgetUsage", back_populates="team")


class TeamPolicy(Base):
    __tablename__ = "team_policies"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    max_rpm: Mapped[int] = mapped_column(Integer, default=60)
    max_tpm: Mapped[int] = mapped_column(Integer, default=100_000)
    allowed_models: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # None = all models allowed
    routing_strategy: Mapped[str] = mapped_column(String(50), default="priority")

    team: Mapped["Team"] = relationship("Team", back_populates="policy")


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)  # lower = higher priority
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    models_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    usage_records: Mapped[list["UsageRecord"]] = relationship("UsageRecord", back_populates="provider")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 8), default=Decimal("0"))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # success|error|rate_limited|budget_exceeded
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    team: Mapped["Team"] = relationship("Team", back_populates="usage_records")
    provider: Mapped[Optional["Provider"]] = relationship("Provider", back_populates="usage_records")


class BudgetUsage(Base):
    __tablename__ = "budget_usage"

    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    period_month: Mapped[date] = mapped_column(Date, primary_key=True)
    spent_usd: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"))
    request_count: Mapped[int] = mapped_column(Integer, default=0)

    team: Mapped["Team"] = relationship("Team", back_populates="budget_usage")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
