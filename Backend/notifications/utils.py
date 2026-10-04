import json
from decimal import Decimal
import uuid
from .models import AuditLog


def sanitize_value(val):
    if isinstance(val, (uuid.UUID, Decimal)):
        return str(val)
    if isinstance(val, dict):
        return {k: sanitize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [sanitize_value(v) for v in val]
    return val


def log_audit(action: str, entity_type: str, entity_id=None, user=None, old_values=None, new_values=None, ip_address=None):
    """
    Reusable audit logging helper function.
    Safely captures JSON serializable old and new values.
    """
    try:
        clean_old = sanitize_value(old_values) if old_values else None
        clean_new = sanitize_value(new_values) if new_values else None

        return AuditLog.objects.create(
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=clean_old,
            new_values=clean_new,
            ip_address=ip_address
        )
    except Exception:
        # Failsafe: logging should never break core transaction flow
        return None
