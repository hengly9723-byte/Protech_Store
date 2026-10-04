from rest_framework import serializers
from .models import Notification, AuditLog


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'type',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = ['id', 'title', 'message', 'type', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'user_email',
            'action',
            'entity_type',
            'entity_id',
            'old_values',
            'new_values',
            'ip_address',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'user_email',
            'action',
            'entity_type',
            'entity_id',
            'old_values',
            'new_values',
            'ip_address',
            'created_at',
        ]
