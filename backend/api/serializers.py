# from rest_framework import serializers
# from django.contrib.auth import get_user_model
# from django.db.models import Sum
# from .models import (
#     Location,
#     Member, Client, Biometric, MembershipFee,
#     SavingCategory, SavingCycle, MemberSavingChoice, MonthlySaving,
#     Loan, LoanRepayment, FineRule, Fine,
#     Department, Employee, ExpenseCategory, Expense, TransactionLog
# )

# User = get_user_model()

# # =====================================
# # JWT Token Serializer
# # =====================================
# from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
#     @classmethod
#     def get_token(cls, user):
#         token = super().get_token(user)
#         token['role'] = user.role
#         return token

# # =====================================
# # User Serializers
# # =====================================
# class UserCreateSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(write_only=True)

#     class Meta:
#         model = User
#         fields = ['username', 'password', 'role', 'email', 'first_name', 'last_name']

#     def create(self, validated_data):
#         request = self.context.get('request')
#         admin_user = request.user if request else None
#         user = User.objects.create_user(
#             username=validated_data['username'],
#             password=validated_data['password'],
#             role=validated_data['role'],
#             email=validated_data.get('email', ''),
#             first_name=validated_data.get('first_name', ''),
#             last_name=validated_data.get('last_name', ''),
#             created_by=admin_user
#         )
#         return user

# class UserListSerializer(serializers.ModelSerializer):
#     created_by = serializers.CharField(source='created_by.username', read_only=True)

#     class Meta:
#         model = User
#         fields = ['id', 'username', 'email', 'role', 'is_active', 'created_by', 'date_joined']

# class PasswordChangeSerializer(serializers.Serializer):
#     old_password = serializers.CharField(write_only=True, required=False)
#     new_password = serializers.CharField(write_only=True)

# class ProfileUpdateSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = User
#         fields = ['username', 'email', 'first_name', 'last_name']
#         extra_kwargs = {'username': {'required': False}}

# # =====================================
# # Address / Location Serializers
# # =====================================



# # =====================================
# # Members & Clients
# # =====================================
# class MemberSerializer(serializers.ModelSerializer):
#     province = ProvinceSerializer(read_only=True)
#     district = DistrictSerializer(read_only=True)
#     sector = SectorSerializer(read_only=True)
#     cell = CellSerializer(read_only=True)
#     village = VillageSerializer(read_only=True)

#     province_id = serializers.PrimaryKeyRelatedField(
#         queryset=Province.objects.all(), source='province', write_only=True
#     )
#     district_id = serializers.PrimaryKeyRelatedField(
#         queryset=District.objects.all(), source='district', write_only=True
#     )
#     sector_id = serializers.PrimaryKeyRelatedField(
#         queryset=Sector.objects.all(), source='sector', write_only=True
#     )
#     cell_id = serializers.PrimaryKeyRelatedField(
#         queryset=Cell.objects.all(), source='cell', write_only=True
#     )
#     village_id = serializers.PrimaryKeyRelatedField(
#         queryset=Village.objects.all(), source='village', write_only=True
#     )

#     class Meta:
#         model = Member
#         fields = '__all__'

# class ClientSerializer(serializers.ModelSerializer):
#     province = ProvinceSerializer(read_only=True)
#     district = DistrictSerializer(read_only=True)
#     sector = SectorSerializer(read_only=True)
#     cell = CellSerializer(read_only=True)
#     village = VillageSerializer(read_only=True)

#     province_id = serializers.PrimaryKeyRelatedField(
#         queryset=Province.objects.all(), source='province', write_only=True
#     )
#     district_id = serializers.PrimaryKeyRelatedField(
#         queryset=District.objects.all(), source='district', write_only=True
#     )
#     sector_id = serializers.PrimaryKeyRelatedField(
#         queryset=Sector.objects.all(), source='sector', write_only=True
#     )
#     cell_id = serializers.PrimaryKeyRelatedField(
#         queryset=Cell.objects.all(), source='cell', write_only=True
#     )
#     village_id = serializers.PrimaryKeyRelatedField(
#         queryset=Village.objects.all(), source='village', write_only=True
#     )

#     class Meta:
#         model = Client
#         fields = '__all__'

# class BiometricSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Biometric
#         fields = '__all__'

# class MembershipFeeSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = MembershipFee
#         fields = '__all__'

# # =====================================
# # Savings
# # =====================================
# class SavingCategorySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = SavingCategory
#         fields = '__all__'

# class SavingCycleSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = SavingCycle
#         fields = '__all__'

# class MemberSavingChoiceSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = MemberSavingChoice
#         fields = '__all__'

# class MonthlySavingSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = MonthlySaving
#         fields = '__all__'

# # =====================================
# # Loans
# # =====================================
# class LoanSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Loan
#         fields = '__all__'

# class LoanRepaymentSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = LoanRepayment
#         fields = '__all__'

# # =====================================
# # Fines & Rules
# # =====================================
# class FineRuleSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = FineRule
#         fields = '__all__'

# class FineSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Fine
#         fields = '__all__'

# # =====================================
# # Employees & Expenses
# # =====================================
# class DepartmentSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Department
#         fields = '__all__'

# class EmployeeSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Employee
#         fields = '__all__'

# class ExpenseCategorySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = ExpenseCategory
#         fields = '__all__'

# class ExpenseSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Expense
#         fields = '__all__'

# class TransactionLogSerializer(serializers.ModelSerializer):
#     user = serializers.SerializerMethodField()

#     class Meta:
#         model = TransactionLog
#         fields = [
#             'id',
#             'user',
#             'transaction_type',
#             'action',
#             'related_model',
#             'related_object_id',
#             'amount',
#             'description',
#             'created_at',
#         ]
#         read_only_fields = fields

#     def get_user(self, obj):
#         if obj.user:
#             return {
#                 "id": obj.user.id,
#                 "username": obj.user.username,
#                 "email": obj.user.email,
#                 "role": obj.user.role,
#             }
#         return None

