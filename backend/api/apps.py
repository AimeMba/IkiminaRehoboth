from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    # âœ… Ibi nibyo bigaragara muri Admin
    verbose_name = "IKIMINA REHOBOTH MANAGEMENT"

    def ready(self):
        from . import signals  # noqa: F401

