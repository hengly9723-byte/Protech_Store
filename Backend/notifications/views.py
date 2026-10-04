from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from .models import Notification, AuditLog
from .serializers import NotificationSerializer, AuditLogSerializer
from accounts.permissions import IsAdminOrSuperUser


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationListView(APIView):
    """
    GET /api/notifications — Logged-in user's notifications.
    Query params: ?unread=true, ?type=order_update
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)

        if request.query_params.get('unread') in ('true', '1', 'True'):
            qs = qs.filter(read_at__isnull=True)

        notif_type = request.query_params.get('type')
        if notif_type:
            qs = qs.filter(type=notif_type)

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = NotificationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class NotificationReadView(APIView):
    """
    PATCH /api/notifications/<id>/read
    Marks a single notification as read.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        try:
            notif = Notification.objects.get(id=id, user=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        if not notif.read_at:
            notif.read_at = timezone.now()
            notif.save()

        return Response({
            "message": "Notification marked as read.",
            "notification": NotificationSerializer(notif).data
        }, status=status.HTTP_200_OK)

    def post(self, request, id):
        return self.patch(request, id)


class NotificationReadAllView(APIView):
    """
    POST /api/notifications/read-all
    Marks all unread notifications of the user as read.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated_count = Notification.objects.filter(
            user=request.user,
            read_at__isnull=True
        ).update(read_at=timezone.now())

        return Response({
            "message": f"All unread notifications marked as read ({updated_count} updated)."
        }, status=status.HTTP_200_OK)


class AuditLogListView(APIView):
    """
    GET /api/audit-logs — Admin-only view to browse system audit trail.
    """
    permission_classes = [IsAdminOrSuperUser]

    def get(self, request):
        qs = AuditLog.objects.select_related('user').all()

        entity_type = request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)

        action = request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)

        user_id = request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AuditLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
