from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import serializers
from .models import UserProfile, ConsumptionRecord


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'full_name',
            'age_range',
            'height_cm',
            'weight_kg',
            'allergy_status',
            'allergies',
            'dietary_preferences',
            'health_conditions',
            'onboarding_completed',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class UserDetailSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(username__iexact=normalized_email).exists() or User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized_email

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        email = validated_data['email'].strip().lower()
        password = validated_data['password']
        full_name = validated_data['full_name'].strip()

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=full_name
        )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.full_name = full_name
        profile.save()
        user.refresh_from_db()

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            raise serializers.ValidationError("Both email and password are required.")

        user = authenticate(username=email, password=password)
        if not user:
            # Also try matching by email field if username differed
            try:
                user_obj = User.objects.get(email__iexact=email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None

        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        data['user'] = user
        return data


class ConsumptionRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsumptionRecord
        fields = [
            'id',
            'product_name',
            'scan_id',
            'servings_consumed',
            'serving_size',
            'serving_unit',
            'basis_used',
            'consumption_date',
            'consumption_time',
            'nutrients_snapshot',
            'reference_system',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'consumption_time', 'created_at', 'updated_at']


class CreateConsumptionRecordSerializer(serializers.Serializer):
    product_name = serializers.CharField(max_length=255, default='Scanned Food Product', trim_whitespace=True)
    scan_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    servings_consumed = serializers.FloatField(required=True, min_value=0.01)
    serving_size = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    serving_unit = serializers.CharField(max_length=50, required=False, allow_blank=True, default='serving')
    basis_used = serializers.ChoiceField(choices=['per_serving', 'per_100g'], default='per_serving')
    consumption_date = serializers.DateField(required=False)
    nutrition_facts = serializers.DictField(required=False, default=dict)
    nutrients_snapshot = serializers.DictField(required=False, default=dict)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    idempotency_key = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')

    def validate_servings_consumed(self, value):
        if value <= 0:
            raise serializers.ValidationError("Servings consumed must be greater than zero.")
        if value > 100:
            raise serializers.ValidationError("Unusually large serving quantity. Please verify the amount.")
        return value
