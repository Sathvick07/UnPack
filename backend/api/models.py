from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    ALLERGY_STATUS_CHOICES = [
        ('none', 'No known allergies reported'),
        ('unanswered', 'No answer provided'),
        ('uncertain', 'Uncertain allergy information'),
        ('specified', 'Specific allergies selected'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=255, blank=True, default='')
    age_range = models.CharField(max_length=50, blank=True, default='')
    height_cm = models.FloatField(null=True, blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    allergy_status = models.CharField(
        max_length=50,
        choices=ALLERGY_STATUS_CHOICES,
        default='unanswered'
    )
    allergies = models.JSONField(default=list, blank=True)
    dietary_preferences = models.JSONField(default=list, blank=True)
    health_conditions = models.JSONField(default=list, blank=True)
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"UserProfile({self.user.username})"


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


class ConsumptionRecord(models.Model):
    """
    Confirmed food consumption ledger entry.
    Preserves exact portion calculations, date of intake, and calculated nutrient snapshots.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consumption_records')
    product_name = models.CharField(max_length=255, default='Scanned Food Product')
    scan_id = models.CharField(max_length=100, blank=True, default='')
    servings_consumed = models.FloatField(default=1.0)
    serving_size = models.CharField(max_length=100, blank=True, default='')
    serving_unit = models.CharField(max_length=50, blank=True, default='serving')
    basis_used = models.CharField(max_length=50, default='per_serving')  # 'per_serving' or 'per_100g'
    consumption_date = models.DateField(db_index=True)  # User's local calendar date YYYY-MM-DD
    consumption_time = models.DateTimeField(auto_now_add=True)
    nutrients_snapshot = models.JSONField(default=dict)  # Calculated nutrient contributions for this portion
    reference_system = models.CharField(max_length=100, default='FSSAI_ICMR_2020')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-consumption_time']
        indexes = [
            models.Index(fields=['user', 'consumption_date']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.product_name} ({self.servings_consumed} servings on {self.consumption_date})"
