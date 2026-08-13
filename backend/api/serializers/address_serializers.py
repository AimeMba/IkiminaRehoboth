# api/serializers/address_serializers.py
from rest_framework import serializers
from ..models import Location

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ('id', 'type', 'name')


class LocationHierarchySerializer(serializers.ModelSerializer):
    parent_province = serializers.SerializerMethodField()
    parent_district = serializers.SerializerMethodField()
    parent_sector = serializers.SerializerMethodField()
    parent_cell = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ('id', 'type', 'name', 'parent_province', 'parent_district', 'parent_sector', 'parent_cell')

    def get_parent_province(self, obj):
        if obj.type == "PROVINCE":
            return None
        elif obj.type in ["DISTRICT", "SECTOR", "CELL", "VILLAGE"]:
            return self._get_parent_by_type(obj, "PROVINCE")
        return None

    def get_parent_district(self, obj):
        if obj.type == "DISTRICT":
            return None
        elif obj.type in ["SECTOR", "CELL", "VILLAGE"]:
            return self._get_parent_by_type(obj, "DISTRICT")
        return None

    def get_parent_sector(self, obj):
        if obj.type == "SECTOR":
            return None
        elif obj.type in ["CELL", "VILLAGE"]:
            return self._get_parent_by_type(obj, "SECTOR")
        return None

    def get_parent_cell(self, obj):
        if obj.type == "CELL":
            return None
        elif obj.type == "VILLAGE":
            return self._get_parent_by_type(obj, "CELL")
        return None

    def _get_parent_by_type(self, obj, parent_type):
        """
        Hierarchy logic based on id structure:
        Example id mapping:
        PROVINCE: 1 digit
        DISTRICT: 2+ digits, first digit = province id
        SECTOR: 4 digits, first 2 digits = district id
        CELL: 6 digits, first 4 digits = sector id
        VILLAGE: 8 digits, first 6 digits = cell id
        """
        target_length = {"PROVINCE": 1, "DISTRICT": 2, "SECTOR": 4, "CELL": 6, "VILLAGE": 8}[parent_type]
        parent_id = str(obj.id)[:target_length]
        try:
            return Location.objects.get(id=int(parent_id)).name
        except Location.DoesNotExist:
            return None

