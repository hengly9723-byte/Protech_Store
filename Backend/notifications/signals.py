from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .utils import log_audit

# Import models dynamically or safely
from catalog.models import Product
from orders.models import Order, Refund
from accounts.models import Role


@receiver(post_save, sender=Product)
def audit_product_save(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    new_values = {
        'name': instance.name,
        'sku': instance.sku,
        'base_price': str(instance.base_price) if instance.base_price is not None else None,
        'status': instance.status,
        'is_active': instance.is_active,
    }
    log_audit(
        action=action,
        entity_type='product',
        entity_id=instance.id,
        new_values=new_values
    )


@receiver(post_save, sender=Order)
def audit_order_save(sender, instance, created, **kwargs):
    action = 'create' if created else 'status_change'
    new_values = {
        'order_number': instance.order_number,
        'status': instance.status,
        'payment_status': instance.payment_status,
        'fulfillment_status': instance.fulfillment_status,
        'total': str(instance.total),
    }
    log_audit(
        action=action,
        entity_type='order',
        entity_id=instance.id,
        user=instance.user,
        new_values=new_values
    )


@receiver(post_save, sender=Refund)
def audit_refund_save(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    new_values = {
        'order_id': str(instance.order_id),
        'amount': str(instance.amount),
        'status': instance.status,
        'reason': instance.reason,
    }
    log_audit(
        action=action,
        entity_type='refund',
        entity_id=instance.id,
        user=instance.processed_by,
        new_values=new_values
    )


@receiver(post_save, sender=Role)
def audit_role_save(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    new_values = {
        'name': instance.name,
        'description': instance.description,
    }
    log_audit(
        action=action,
        entity_type='role',
        entity_id=instance.id,
        new_values=new_values
    )
