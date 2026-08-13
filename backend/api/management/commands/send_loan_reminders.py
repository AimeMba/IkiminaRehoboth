from django.core.management.base import BaseCommand

from api.services.reminder_service import send_loan_payment_reminders


class Command(BaseCommand):
    help = "Send loan repayment reminders on day 4 (or --force anytime)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Send reminders regardless of day of month",
        )

    def handle(self, *args, **options):
        result = send_loan_payment_reminders(force=options["force"])
        self.stdout.write(str(result))

