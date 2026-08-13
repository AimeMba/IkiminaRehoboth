"""
Django settings for backend project.
"""

from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

try:
    from celery.schedules import crontab
    CELERY_AVAILABLE = True
except Exception:
    CELERY_AVAILABLE = False

    def crontab(*args, **kwargs):
        return None
# =====================================================
# BASE
# =====================================================
BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    value = os.getenv(name, default) or ""
    return [item.strip() for item in value.split(",") if item.strip()]

# =====================================================
# SECURITY
# =====================================================
DJANGO_ENV = os.getenv("DJANGO_ENV", "development").strip().lower()
DEBUG = env_bool("DEBUG", DJANGO_ENV != "production")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DJANGO_ENV != "production":
        SECRET_KEY = "django-insecure-local-development-only"
    else:
        raise ImproperlyConfigured("SECRET_KEY environment variable is required in production.")

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "127.0.0.1,localhost" if DEBUG else "")

# =====================================================
# APPLICATIONS
# =====================================================
INSTALLED_APPS = [
    # Django core
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'dal',
    'dal_select2',
    # "smart_selects",
    # Third-party
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',

    # Local apps
    'api',
]

if CELERY_AVAILABLE:
    INSTALLED_APPS.append('django_celery_beat')

# =====================================================
# MIDDLEWARE
# =====================================================
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# =====================================================
# URL & WSGI
# =====================================================
ROOT_URLCONF = 'backend.urls'

WSGI_APPLICATION = 'backend.wsgi.application'

# =====================================================
# TEMPLATES
# =====================================================
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# =====================================================
# DATABASE (PostgreSQL)
# =====================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}
# =====================================================
# AUTH USER MODEL (CRITICAL)
# =====================================================
AUTH_USER_MODEL = 'api.User'

# =====================================================
# PASSWORD VALIDATION
# =====================================================
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# =====================================================
# INTERNATIONALIZATION
# =====================================================
LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Africa/Kigali'

USE_I18N = True
USE_TZ = True
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_BEAT_SCHEDULE = {
    "generate-late-saving-fines-midnight": {
        "task": "api.tasks.generate_late_fines",
        "schedule": crontab(minute=0, hour=0),
    },
    "send-saving-reminders-midnight": {
        "task": "api.tasks.send_saving_reminders",
        "schedule": crontab(minute=0, hour=0),
    },
    "send-loan-reminders-midnight": {
        "task": "api.tasks.send_loan_reminders",
        "schedule": crontab(minute=0, hour=0),
    },
}
if not CELERY_AVAILABLE:
    CELERY_BEAT_SCHEDULE = {}
SMS_ENABLED = os.getenv("SMS_ENABLED", "false").lower() == "true"
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "")
SMS_SENDER_ID = os.getenv("SMS_SENDER_ID", "IKIMINA")

# Member saving choice change window (inclusive) for current year
# Defaults: January 1 -> January 5
SAVING_CHOICE_CHANGE_START_MONTH = int(os.getenv("SAVING_CHOICE_CHANGE_START_MONTH", 1))
SAVING_CHOICE_CHANGE_START_DAY = int(os.getenv("SAVING_CHOICE_CHANGE_START_DAY", 1))
SAVING_CHOICE_CHANGE_END_MONTH = int(os.getenv("SAVING_CHOICE_CHANGE_END_MONTH", 1))
SAVING_CHOICE_CHANGE_END_DAY = int(os.getenv("SAVING_CHOICE_CHANGE_END_DAY", 5))

# =====================================================
# STATIC & MEDIA FILES (PHOTO & BIOMETRIC)
# =====================================================
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]


MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# =====================================================
# CORS
# =====================================================
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", DEBUG)
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)

# HTTPS / browser hardening (safe defaults; override via env where needed)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
USE_X_FORWARDED_HOST = env_bool("USE_X_FORWARDED_HOST", False)
if env_bool("USE_SECURE_PROXY_SSL_HEADER", False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if not DEBUG:
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)

if DJANGO_ENV == "production":
    if not ALLOWED_HOSTS:
        raise ImproperlyConfigured("ALLOWED_HOSTS must be set in production.")
    if CORS_ALLOW_ALL_ORIGINS:
        raise ImproperlyConfigured("CORS_ALLOW_ALL_ORIGINS must remain disabled in production.")
    if not SESSION_COOKIE_SECURE or not CSRF_COOKIE_SECURE:
        raise ImproperlyConfigured("Secure session and CSRF cookies are required in production.")
    if not SECURE_SSL_REDIRECT:
        raise ImproperlyConfigured("SECURE_SSL_REDIRECT must be enabled in production.")

# =====================================================
# DJANGO REST FRAMEWORK
# =====================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
        "api.permissions.active_member_permission.IsActiveMember",
    ),
    'DEFAULT_THROTTLE_RATES': {
        'login': os.getenv("THROTTLE_LOGIN_RATE", "5/min"),
    },
}

# =====================================================
# SIMPLE JWT
# =====================================================
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# =====================================================
# DEFAULT PRIMARY KEY
# =====================================================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =====================================================
# JAZZMIN SETTINGS
# =====================================================
JAZZMIN_SETTINGS = {
    "site_title": "IKIMINA REHOBOTH ADMIN",
    "site_header": "IKIMINA REHOBOTH",
    "site_brand": "IKIMINA REHOBOTH",
    "site_logo": "logos/LogoIR.png",
    "login_logo": "logos/LogoIR.png",
    "login_logo_dark": True,
    "welcome_sign": "IKIMINA REHOBOTH MANAGEMENT SYSTEM",
    "copyright": "(c) Ikimina Rehoboth",
    "list_per_page": 50,
    "search_model": [
        "api.User",
        "api.Member",
        "api.Client",
        "api.Loan",
        "api.MonthlySaving",
        "api.TransactionLog",
    ],
    "topmenu_links": [
        {"name": "Dashboard", "url": "admin:index"},
        {"app": "api"},
        {"model": "api.User"},
    ],
    "usermenu_links": [
        {"model": "api.User"},
    ],
    "show_sidebar": True,
    "navigation_expanded": True,
    "order_with_respect_to": [
        "api.User",
        "api.Location",
        "api.Member",
        "api.MemberExit",
        "api.Client",
        "api.Biometric",
        "api.MembershipFee",
        "api.SavingCategory",
        "api.MemberSavingChoice",
        "api.SavingChoiceChangeRequest",
        "api.MonthlySaving",
        "api.LoanType",
        "api.Loan",
        "api.LoanRepayment",
        "api.FineRule",
        "api.Fine",
        "api.IncomeCategory",
        "api.Income",
        "api.ExpenseCategory",
        "api.Expense",
        "api.Department",
        "api.Employee",
        "api.SalaryPayment",
        "api.AnnualClosing",
        "api.MemberAnnualProfit",
        "api.TransactionLog",
        "auth.Group",
    ],
    "custom_links": {
        "api": [
            {"name": "Financial - Income", "url": "admin:api_income_changelist", "icon": "fas fa-arrow-down"},
            {"name": "Financial - Expenses", "url": "admin:api_expense_changelist", "icon": "fas fa-arrow-up"},
            {"name": "Financial - Loans", "url": "admin:api_loan_changelist", "icon": "fas fa-hand-holding-usd"},
            {"name": "Financial - Repayments", "url": "admin:api_loanrepayment_changelist", "icon": "fas fa-money-check-alt"},
            {"name": "Financial - Fines", "url": "admin:api_fine_changelist", "icon": "fas fa-exclamation-circle"},
            {"name": "Savings - Monthly", "url": "admin:api_monthlysaving_changelist", "icon": "fas fa-piggy-bank"},
            {"name": "Savings - Categories", "url": "admin:api_savingcategory_changelist", "icon": "fas fa-layer-group"},
            {"name": "Employee - Staff", "url": "admin:api_employee_changelist", "icon": "fas fa-user-cog"},
            {"name": "Employee - Payroll", "url": "admin:api_salarypayment_changelist", "icon": "fas fa-wallet"},
            {"name": "Members - Active", "url": "admin:api_member_changelist", "icon": "fas fa-user-friends"},
            {"name": "Members - Exits", "url": "admin:api_memberexit_changelist", "icon": "fas fa-door-open"},
            {"name": "Reports - Annual Closing", "url": "admin:api_annualclosing_changelist", "icon": "fas fa-chart-line"},
            {"name": "Security - Transaction Logs", "url": "admin:api_transactionlog_changelist", "icon": "fas fa-clipboard-list"},
        ],
    },
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.Group": "fas fa-users",
        "api": "fas fa-database",
        "api.User": "fas fa-user-shield",
        "api.RoleAssignmentHistory": "fas fa-user-clock",
        "api.StaffAccountHolderHistory": "fas fa-id-badge",
        "api.Location": "fas fa-map-marked-alt",
        "api.Member": "fas fa-user-friends",
        "api.MemberExit": "fas fa-door-open",
        "api.Client": "fas fa-user-tie",
        "api.Biometric": "fas fa-fingerprint",
        "api.MembershipFee": "fas fa-id-card",
        "api.SavingCategory": "fas fa-layer-group",
        "api.MemberSavingChoice": "fas fa-check-circle",
        "api.SavingChoiceChangeRequest": "fas fa-random",
        "api.MonthlySaving": "fas fa-piggy-bank",
        "api.LoanType": "fas fa-percent",
        "api.Loan": "fas fa-hand-holding-usd",
        "api.LoanRequest": "fas fa-file-signature",
        "api.LoanRepayment": "fas fa-money-check-alt",
        "api.FineRule": "fas fa-balance-scale",
        "api.Fine": "fas fa-exclamation-circle",
        "api.IncomeCategory": "fas fa-tags",
        "api.Income": "fas fa-arrow-down",
        "api.Department": "fas fa-sitemap",
        "api.Employee": "fas fa-user-cog",
        "api.SalaryPayment": "fas fa-wallet",
        "api.ExpenseCategory": "fas fa-tags",
        "api.Expense": "fas fa-arrow-up",
        "api.TransactionLog": "fas fa-clipboard-list",
        "api.Notification": "fas fa-bell",
        "api.AnnualClosing": "fas fa-chart-line",
        "api.MemberAnnualProfit": "fas fa-coins",
        "api.MemberProfitPayout": "fas fa-hand-holding-usd",
        "api.MemberProfitRequest": "fas fa-file-invoice-dollar",
        "api.MemberWithdrawal": "fas fa-money-bill-wave",
        "api.MemberCertificateApproval": "fas fa-certificate",
    },
    "default_icon_parents": "fas fa-folder-open",
    "default_icon_children": "fas fa-circle",
    "related_modal_active": False,
    "show_ui_builder": False,
    "changeform_format": "vertical_tabs",
    "changeform_format_overrides": {
        "api.User": "collapsible",
        "auth.Group": "vertical_tabs",
        "api.Member": "vertical_tabs",
        "api.Client": "vertical_tabs",
        "api.Loan": "vertical_tabs",
    },
    "language_chooser": False,
}

# Login security
AUTH_MAX_FAILED_ATTEMPTS = int(os.getenv("AUTH_MAX_FAILED_ATTEMPTS", 3))
AUTH_FAILED_ATTEMPTS_WINDOW_MINUTES = int(
    os.getenv("AUTH_FAILED_ATTEMPTS_WINDOW_MINUTES", 10)
)
# =====================================================
# JAZZMIN UI TWEAKS
# =====================================================
JAZZMIN_UI_TWEAKS = {
    # TEXT SIZES
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": False,
    "brand_small_text": False,

    # COLORS
    "brand_colour": "navbar-dark",
    "accent": "accent-lime",
    "navbar": "navbar-primary navbar-dark",

    # LAYOUT
    "no_navbar_border": False,
    "navbar_fixed": False,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": False,

    # SIDEBAR
    "sidebar": "sidebar-dark-navy",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": False,

    # THEME
    "theme": "darkly",
    "dark_mode_theme": "slate",

    # BUTTONS
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
}


