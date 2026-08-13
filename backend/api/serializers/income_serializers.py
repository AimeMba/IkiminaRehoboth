from rest_framework import serializers
from ..models import IncomeCategory, Income

class IncomeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomeCategory
        fields = ('id', 'name')

    def validate_name(self, value):
        normalized = str(value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Category name is required.")
        queryset = IncomeCategory.objects.filter(name__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("An income category with this name already exists.")
        return normalized


class IncomeSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.username", read_only=True)

    class Meta:
        model = Income
        fields = (
            'id', 'category', 'category_name', 'amount', 'description',
            'income_date', 'related_model', 'related_object_id', 'recorded_by', 'recorded_by_name'
        )
        read_only_fields = ('income_date', 'related_model', 'related_object_id', 'recorded_by')

