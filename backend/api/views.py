# from rest_framework_simplejwt.views import TokenObtainPairView
# from .serializers import (
#     MyTokenObtainPairSerializer,
#     UserCreateSerializer,
#     UserListSerializer,
#     PasswordChangeSerializer,
#     ProfileUpdateSerializer
# )
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.response import Response
# from rest_framework import status
# from .permissions import IsAdmin
# from django.contrib.auth import get_user_model
# from rest_framework_simplejwt.tokens import RefreshToken
# User = get_user_model()
# from django.db.models import Q
# from rest_framework_simplejwt.token_blacklist.models import (
#     OutstandingToken,
#     BlacklistedToken
# )

# # -------------------------------
# # JWT Token View
# # -------------------------------
# class MyTokenObtainPairView(TokenObtainPairView):
#     serializer_class = MyTokenObtainPairSerializer

# # -------------------------------
# # Admin creates user
# # -------------------------------
# @api_view(['POST'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def admin_create_user(request):
#     serializer = UserCreateSerializer(data=request.data, context={'request': request})
#     if serializer.is_valid():
#         serializer.save()
#         return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# # -------------------------------
# # List all users (Admin)
# # -------------------------------
# @api_view(['GET'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def list_users(request):
#     users = User.objects.all().order_by('-date_joined')
#     serializer = UserListSerializer(users, many=True)
#     return Response(serializer.data)


# # -------------------------------
# # Update user role or is_active (Admin)
# # -------------------------------
# @api_view(['PATCH'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def update_user(request, user_id):
#     try:
#         user = User.objects.get(id=user_id)
#     except User.DoesNotExist:
#         return Response(
#             {"detail": "User not found"},
#             status=status.HTTP_404_NOT_FOUND
#         )

#     # Prevent admin from deactivating themselves
#     if user.id == request.user.id and request.data.get('is_active') is False:
#         return Response(
#             {"detail": "You cannot deactivate your own account"},
#             status=status.HTTP_400_BAD_REQUEST
#         )

#     data = request.data
#     updated_fields = []

#     # Update role
#     if 'role' in data:
#         user.role = data['role']
#         updated_fields.append('role')

#     # Update active status
#     if 'is_active' in data:
#         is_active = data['is_active']
#         user.is_active = is_active
#         updated_fields.append('is_active')

#         # ðŸ”¥ Force logout if deactivated
#         if is_active is False:
#             tokens = OutstandingToken.objects.filter(user=user)
#             for token in tokens:
#                 BlacklistedToken.objects.get_or_create(token=token)

#     user.save()

#     return Response(
#         {
#             "message": "User updated successfully",
#             "updated_fields": updated_fields
#         },
#         status=status.HTTP_200_OK
#     )


# # -------------------------------
# # Deactivate user (Admin)
# # -------------------------------
# @api_view(['POST'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def deactivate_user(request, user_id):
#     try:
#         user = User.objects.get(id=user_id)
#     except User.DoesNotExist:
#         return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

#     user.is_active = False
#     user.save()
#     return Response({"message": "User deactivated successfully"})

# # -------------------------------
# # Admin resets password for any user
# # -------------------------------
# @api_view(['POST'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def admin_reset_password(request, user_id):
#     try:
#         user = User.objects.get(id=user_id)
#     except User.DoesNotExist:
#         return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

#     serializer = PasswordChangeSerializer(data=request.data)
#     if serializer.is_valid():
#         user.set_password(serializer.validated_data['new_password'])
#         user.save()
#         return Response({"message": f"Password for {user.username} reset successfully"})
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# # -------------------------------
# # Current logged-in user
# # -------------------------------
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def current_user(request):
#     serializer = UserListSerializer(request.user)
#     return Response(serializer.data)

# # -------------------------------
# # Change password (logged-in user)
# # -------------------------------
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def change_password(request):
#     serializer = PasswordChangeSerializer(data=request.data)
#     if serializer.is_valid():
#         user = request.user
#         # Validate old password
#         if not user.check_password(serializer.validated_data['old_password']):
#             return Response({"detail": "Old password is incorrect"}, status=status.HTTP_400_BAD_REQUEST)
#         user.set_password(serializer.validated_data['new_password'])
#         user.save()
#         return Response({"message": "Password updated successfully"})
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# # -------------------------------
# # Update profile (logged-in user)
# # -------------------------------
# @api_view(['PATCH'])
# @permission_classes([IsAuthenticated])
# def update_profile(request):
#     serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
#     if serializer.is_valid():
#         serializer.save()
#         return Response({"message": "Profile updated successfully"})
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# # -------------------------------
# # Delete user (Admin only)
# # -------------------------------
# @api_view(['DELETE'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def delete_user(request, user_id):
#     try:
#         user = User.objects.get(id=user_id)
#     except User.DoesNotExist:
#         return Response(
#             {"detail": "User not found"},
#             status=status.HTTP_404_NOT_FOUND
#         )

#     # Prevent admin from deleting themselves
#     if user.id == request.user.id:
#         return Response(
#             {"detail": "You cannot delete your own account"},
#             status=status.HTTP_400_BAD_REQUEST
#         )

#     user.delete()
#     return Response(status=status.HTTP_204_NO_CONTENT)

# # -------------------------------
# # Search user (Admin only)
# # -------------------------------
# @api_view(['GET'])
# @permission_classes([IsAuthenticated, IsAdmin])
# def search_users(request):
#     search = request.query_params.get('search')
#     role = request.query_params.get('role')
#     is_active = request.query_params.get('is_active')

#     users = User.objects.all()

#     if search:
#         users = users.filter(
#             Q(username__icontains=search) |
#             Q(email__icontains=search)|
#             Q(first_name__icontains=search) |
#             Q(last_name__icontains=search)
#         )

#     if role:
#         users = users.filter(role=role)

#     if is_active is not None:
#         users = users.filter(is_active=is_active.lower() == 'true')

#     serializer = UserListSerializer(users.order_by('-date_joined'), many=True)
#     return Response(serializer.data)

# # -------------------------------
# # LOGOUT API
# # -------------------------------
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def logout(request):
#     try:
#         refresh_token = request.data.get("refresh")
#         token = RefreshToken(refresh_token)
#         token.blacklist()
#         return Response({"message": "Logged out successfully"})
#     except Exception:
#         return Response(
#             {"detail": "Invalid refresh token"},
#             status=status.HTTP_400_BAD_REQUEST
#         )

