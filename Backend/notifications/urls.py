from django.urls import path
from .views import (
    NotificationListView,
    NotificationReadView,
    NotificationReadAllView,
    AuditLogListView,
)

urlpatterns = [
    # Notification endpoints
    path('notifications/read-all', NotificationReadAllView.as_view(), name='notifications-read-all'),
    path('notifications/read-all/', NotificationReadAllView.as_view(), name='notifications-read-all-slash'),
    path('notifications/<uuid:id>/read', NotificationReadView.as_view(), name='notification-mark-read'),
    path('notifications/<uuid:id>/read/', NotificationReadView.as_view(), name='notification-mark-read-slash'),
    path('notifications', NotificationListView.as_view(), name='notifications-list'),
    path('notifications/', NotificationListView.as_view(), name='notifications-list-slash'),

    # Audit log endpoints (admin only)
    path('audit-logs', AuditLogListView.as_view(), name='audit-logs-list'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit-logs-list-slash'),
]
