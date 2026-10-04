import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = (
        ('order_update', 'Order Update'),
        ('stock_alert', 'Stock Alert'),
        ('promotion', 'Promotion'),
        ('system', 'System'),
        ('account', 'Account'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_column='user_id'
    )
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, null=True)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='system', blank=True, null=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.email}: {self.title} ({'Read' if self.is_read else 'Unread'})"

    @property
    def is_read(self):
        return self.read_at is not None


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        db_column='user_id'
    )
    action = models.CharField(max_length=50)  # create, update, delete, status_change
    entity_type = models.CharField(max_length=50)  # product, order, refund, role, etc.
    entity_id = models.UUIDField(null=True, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        actor = self.user.email if self.user else "System"
        return f"[{self.action.upper()}] {self.entity_type} ({self.entity_id}) by {actor} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"
