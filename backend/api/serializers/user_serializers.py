from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
User = get_user_model()


# =====================================
# User Serializers
# =====================================
class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'email', 'first_name', 'last_name']

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        role = attrs.get("role")
        if role == User.Roles.MANAGER:
            manager_exists = User.objects.filter(role=User.Roles.MANAGER).exists()
            if manager_exists:
                raise serializers.ValidationError(
                    {"role": "Only one MANAGER account is allowed in the system."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        admin_user = request.user if request else None
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role=validated_data['role'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            created_by=admin_user
        )
        return user

class UserListSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'role',
            'is_active',
            'locked_by_system',
            'failed_login_attempts',
            'failed_login_last_at',
            'locked_at',
            'created_by',
            'date_joined',
        ]

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value

class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name']
        extra_kwargs = {'username': {'required': False}}

