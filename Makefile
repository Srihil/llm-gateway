.PHONY: help setup infra-up infra-down dev seed migrate test lint demo

help:
	@echo "LLM Gateway — available targets:"
	@echo "  setup        Install Python dependencies"
	@echo "  infra-up     Start Postgres, Redis, Prometheus, Grafana, Jaeger"
	@echo "  infra-down   Stop all infra containers"
	@echo "  dev          Run gateway in development mode"
	@echo "  seed         Seed database with teams and providers"
	@echo "  migrate      Run Alembic migrations"
	@echo "  test         Run unit and integration tests"
	@echo "  lint         Run ruff linter"
	@echo "  demo         Run all 9 demo scenarios"
	@echo "  gen-key      Generate a Fernet secret key"

setup:
	pip install -e ".[dev]"

infra-up:
	docker compose -f infra/docker-compose.yml up -d
	@echo "Waiting for services to be ready..."
	@sleep 3
	@echo "Services ready. Grafana: http://localhost:3000 (admin/admin)"
	@echo "Jaeger:   http://localhost:16686"
	@echo "Prometheus: http://localhost:9090"

infra-down:
	docker compose -f infra/docker-compose.yml down

dev: infra-up
	uvicorn gateway.main:app --reload --host 0.0.0.0 --port 8000

seed:
	python scripts/seed.py

migrate:
	alembic upgrade head

test:
	pytest tests/ -v --cov=gateway --cov-report=term-missing

lint:
	ruff check gateway/ tests/

demo:
	python scripts/demo_scenarios.py

gen-key:
	@python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
