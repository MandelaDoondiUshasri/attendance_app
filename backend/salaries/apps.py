from django.apps import AppConfig


class SalariesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'salaries'
    verbose_name = 'Payroll & Salaries'

    def ready(self):
        try:
            import salaries.signals  # noqa: F401
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to load salaries signals: {e}")
