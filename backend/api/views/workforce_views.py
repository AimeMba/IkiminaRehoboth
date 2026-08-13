from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from ..models import Department, Employee, Member
from ..permissions.role_permissions import BlockMembers, IsAdmin, IsAdminFinanceOrAuditor
from ..serializers.employee_serializers_v2 import DepartmentSerializer, EmployeeSerializer
from ..services.transaction_logger import log_transaction


class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset = Department.objects.all().order_by("name")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, BlockMembers, IsAdminFinanceOrAuditor]

    def perform_create(self, serializer):
        department = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="Department",
            related_object_id=department.id,
            description=f"Created department {department.name}",
            request=self.request,
        )


class DepartmentDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, BlockMembers, IsAdminFinanceOrAuditor]

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsAuthenticated(), IsAdmin()]
        return [permission() for permission in self.permission_classes]

    def perform_update(self, serializer):
        department = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="Department",
            related_object_id=department.id,
            description=f"Updated department {department.name}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        department_id = instance.id
        department_name = instance.name
        try:
            super().perform_destroy(instance)
        except ProtectedError as exc:
            raise ValidationError(
                {
                    "detail": (
                        "This department cannot be deleted because it is still referenced by "
                        f"{len(getattr(exc, 'protected_objects', []))} related record(s)."
                    )
                }
            ) from exc
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="DELETE",
            related_model="Department",
            related_object_id=department_id,
            description=f"Deleted department {department_name}",
            request=self.request,
        )


class EmployeeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, BlockMembers, IsAdminFinanceOrAuditor]

    def get_queryset(self):
        queryset = Employee.objects.select_related("user", "member__user", "department").order_by("-id")

        is_active = self.request.query_params.get("is_active")
        department = self.request.query_params.get("department")
        search = (self.request.query_params.get("search") or "").strip().lower()

        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))

        if department:
            queryset = queryset.filter(department_id=department)

        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(member__national_id__icontains=search)
                | Q(department__name__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        employee = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="CREATE",
            related_model="Employee",
            related_object_id=employee.id,
            amount=employee.salary,
            description=f"Created employee record #{employee.id}",
            request=self.request,
        )


class EmployeeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Employee.objects.select_related("user", "member__user", "department")
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, BlockMembers, IsAdminFinanceOrAuditor]

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsAuthenticated(), IsAdmin()]
        return [permission() for permission in self.permission_classes]

    def perform_update(self, serializer):
        employee = serializer.save()
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="UPDATE",
            related_model="Employee",
            related_object_id=employee.id,
            amount=employee.salary,
            description=f"Updated employee record #{employee.id}",
            request=self.request,
        )

    def perform_destroy(self, instance):
        employee_id = instance.id
        try:
            super().perform_destroy(instance)
        except ProtectedError as exc:
            raise ValidationError(
                {
                    "detail": (
                        "This employee record cannot be deleted because salary payment history "
                        f"still exists for {len(getattr(exc, 'protected_objects', []))} related record(s)."
                    )
                }
            ) from exc
        log_transaction(
            user=self.request.user,
            transaction_type="SYSTEM",
            action="DELETE",
            related_model="Employee",
            related_object_id=employee_id,
            description=f"Deleted employee record #{employee_id}",
            request=self.request,
        )


class EmployeeFormOptionsAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, BlockMembers, IsAdminFinanceOrAuditor]

    def get(self, request, *args, **kwargs):
        User = get_user_model()

        departments = [
            {
                "id": department.id,
                "name": department.name,
                "base_salary": department.base_salary,
            }
            for department in Department.objects.all().order_by("name")
        ]

        users = [
            {
                "id": user.id,
                "label": (
                    f"{(user.get_full_name() or user.username)} "
                    f"({user.username})"
                ).strip(),
                "role": user.role,
            }
            for user in User.objects.filter(is_active=True).order_by("username")
        ]

        members = [
            {
                "id": member.id,
                "label": (
                    f"{(member.user.get_full_name() or member.user.username)} "
                    f"({member.national_id})"
                ).strip(),
            }
            for member in Member.objects.select_related("user").filter(is_active=True).order_by("user__username")
        ]

        return Response(
            {
                "departments": departments,
                "users": users,
                "members": members,
            }
        )

