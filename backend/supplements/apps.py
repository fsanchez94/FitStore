from django.apps import AppConfig


class SupplementsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'supplements'

    def ready(self):
        import supplements.signals
