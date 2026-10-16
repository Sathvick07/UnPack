from django.urls import path
from .views import (
    HealthCheckView,
    AnalyzeLabelView,
    VerifyFieldsView,
    RegisterView,
    LoginView,
    LogoutView,
    CurrentUserView,
    UserProfileView,
)

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('analyze-label/', AnalyzeLabelView.as_view(), name='analyze-label'),
    path('verify-fields/', VerifyFieldsView.as_view(), name='verify-fields'),
    # Authentication endpoints
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    # User profile & onboarding endpoints
    path('profile/', UserProfileView.as_view(), name='user-profile'),
]
