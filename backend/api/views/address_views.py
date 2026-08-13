# api/views/address_views.py
from rest_framework import generics, permissions
from django.shortcuts import get_object_or_404
from django.db.models import CharField
from django.db.models.functions import Cast
from ..models import Location
from ..serializers.address_serializers import LocationSerializer, LocationHierarchySerializer

# =====================================================
# PERMISSIONS CLASS BASED ON USER ROLE
# =====================================================
class IsAdminOrManager(permissions.BasePermission):
    """
    Only ADMIN or MANAGER can access certain endpoints
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'MANAGER']


# =====================================================
# LIST PROVINCES
# =====================================================
class ProvinceListAPIView(generics.ListAPIView):
    queryset = Location.objects.filter(type="PROVINCE").order_by("name")
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]  # all roles can view provinces


# =====================================================
# LIST DISTRICTS BY PROVINCE
# =====================================================
class DistrictListAPIView(generics.ListAPIView):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        province_id = self.request.query_params.get('province_id')
        if not province_id:
            return Location.objects.none()
        province_id_str = str(province_id)
        return (
            Location.objects.filter(type="DISTRICT")
            .annotate(id_str=Cast("id", output_field=CharField()))
            .filter(id_str__startswith=province_id_str)
            .order_by("name")
        )


# =====================================================
# LIST SECTORS BY DISTRICT
# =====================================================
class SectorListAPIView(generics.ListAPIView):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        district_id = self.request.query_params.get('district_id')
        if not district_id:
            return Location.objects.none()
        district_id_str = str(district_id)
        return (
            Location.objects.filter(type="SECTOR")
            .annotate(id_str=Cast("id", output_field=CharField()))
            .filter(id_str__startswith=district_id_str)
            .order_by("name")
        )


# =====================================================
# LIST CELLS BY SECTOR
# =====================================================
class CellListAPIView(generics.ListAPIView):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        sector_id = self.request.query_params.get('sector_id')
        if not sector_id:
            return Location.objects.none()
        sector_id_str = str(sector_id)
        return (
            Location.objects.filter(type="CELL")
            .annotate(id_str=Cast("id", output_field=CharField()))
            .filter(id_str__startswith=sector_id_str)
            .order_by("name")
        )


# =====================================================
# LIST VILLAGES BY CELL
# =====================================================
class VillageListAPIView(generics.ListAPIView):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        cell_id = self.request.query_params.get('cell_id')
        if not cell_id:
            return Location.objects.none()
        cell_id_str = str(cell_id)
        return (
            Location.objects.filter(type="VILLAGE")
            .annotate(id_str=Cast("id", output_field=CharField()))
            .filter(id_str__startswith=cell_id_str)
            .order_by("name")
        )


# =====================================================
# OPTIONAL: FULL HIERARCHY OF A VILLAGE
# =====================================================
class VillageHierarchyAPIView(generics.RetrieveAPIView):
    serializer_class = LocationHierarchySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        village_id = self.kwargs.get('village_id')
        return get_object_or_404(Location, id=village_id, type="VILLAGE")

