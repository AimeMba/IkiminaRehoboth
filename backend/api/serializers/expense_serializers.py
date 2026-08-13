from rest_framework import serializers
from ..models import ExpenseCategory, Expense


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = (
            'id',
            'name',
        )

    def validate_name(self, value):
        normalized = str(value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Category name is required.")
        queryset = ExpenseCategory.objects.filter(name__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("An expense category with this name already exists.")
        return normalized


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name',
        read_only=True
    )
    recorded_by_username = serializers.CharField(
        source='recorded_by.username',
        read_only=True
    )

    class Meta:
        model = Expense
        fields = (
            'id',
            'category',
            'category_name',
            'amount',
            'description',
            'expense_date',
            'recorded_by',
            'recorded_by_username',
        )
        read_only_fields = ('recorded_by',)

