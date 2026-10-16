from django.urls import path
from .views import HealthCheckView, AnalyzeLabelView, VerifyFieldsView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('analyze-label/', AnalyzeLabelView.as_view(), name='analyze-label'),
    path('verify-fields/', VerifyFieldsView.as_view(), name='verify-fields'),
]
