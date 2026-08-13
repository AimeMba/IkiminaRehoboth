from rest_framework.response import Response


def ensure_member_is_active(member):
    if not member.is_active:
        return Response(
            {"error": "This member is inactive (exited)."},
            status=400
        )
    return None

