try:
    from .celery import app as celery_app
except Exception:  # pragma: no cover - local dev may run without celery installed
    celery_app = None

__all__ = ("celery_app",)
