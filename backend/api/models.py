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
