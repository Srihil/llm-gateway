from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from gateway.config import get_settings

settings = get_settings()
_tracer: trace.Tracer | None = None


def setup_tracing(app=None) -> None:
    global _tracer
    if not settings.otel_enabled:
        return

    resource = Resource(attributes={SERVICE_NAME: "llm-gateway"})
    provider = TracerProvider(resource=resource)

    exporter = OTLPSpanExporter(endpoint=settings.otel_endpoint, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    _tracer = trace.get_tracer("llm-gateway")

    if app is not None:
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)


def get_tracer() -> trace.Tracer:
    return _tracer or trace.get_tracer("llm-gateway")
