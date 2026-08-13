from rest_framework import serializers
from django.utils import timezone

from ..models import (
    SalaryPayment,
    Expense,
    ExpenseCategory
)


# =====================================================
# SALARY PAYMENT SERIALIZER
# =====================================================

class SalaryPaymentSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField(read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    paid_by_name = serializers.CharField(source="paid_by.username", read_only=True)

    class Meta:
        model = SalaryPayment
        fields = [
            "id",
            "employee",
            "employee_name",
            "department_name",
            "amount",
            "paid_on",
            "paid_by",
            "paid_by_name",
        ]

        read_only_fields = ["paid_by"]

    def get_employee_name(self, obj):
        if not obj.employee:
            return ""
        if obj.employee.user:
            full_name = obj.employee.user.get_full_name().strip()
            return full_name or obj.employee.user.username
        if obj.employee.member and obj.employee.member.user:
            full_name = obj.employee.member.user.get_full_name().strip()
            return full_name or obj.employee.member.user.username
        if obj.employee.external_full_name:
            return obj.employee.external_full_name
        return f"Employee #{obj.employee_id}"

    def validate(self, attrs):
        employee = attrs["employee"]
        amount = attrs["amount"]

        if not employee.is_active:
            raise serializers.ValidationError("Cannot pay salary to an inactive employee.")

        if amount <= 0:
            raise serializers.ValidationError("Salary amount must be greater than zero.")

        if amount != employee.salary:
            raise serializers.ValidationError(
                f"Salary payment must match department salary: {employee.salary}."
            )

        return attrs

    def create(self, validated_data):
        """
        Save SalaryPayment + Automatically record Expense
        """
        request = self.context["request"]

        # =====================================================
        # Create Salary Payment
        # =====================================================
        salary_payment = SalaryPayment.objects.create(
            paid_by=request.user,
            paid_on=timezone.localdate(),
            **validated_data
        )

        # =====================================================
        # Automatically record Expense
        # =====================================================
        category, _ = ExpenseCategory.objects.get_or_create(
            name="Salary Payment"
        )

        Expense.objects.create(
            category=category,
            amount=salary_payment.amount,
            description=f"Salary payment #{salary_payment.id} to employee #{salary_payment.employee_id}",
            expense_date=salary_payment.paid_on,
            recorded_by=request.user
        )

        return salary_payment

    def update(self, instance, validated_data):
        amount_before = instance.amount
        paid_on_before = instance.paid_on
        updated = super().update(instance, validated_data)

        if updated.amount != amount_before or updated.paid_on != paid_on_before:
            category, _ = ExpenseCategory.objects.get_or_create(name="Salary Payment")
            expense = Expense.objects.filter(
                category=category,
                description=f"Salary payment #{updated.id} to employee #{updated.employee_id}",
            ).first()
            if expense:
                expense.amount = updated.amount
                expense.expense_date = updated.paid_on
                expense.recorded_by = updated.paid_by
                expense.save(update_fields=["amount", "expense_date", "recorded_by"])

        return updated


