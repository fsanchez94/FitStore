from django.db.models.signals import pre_save, post_save, pre_delete, post_delete
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal
from .models import SaleItem, CostLayer, Product, InventoryTransaction, SystemSettings, Purchase


@receiver(pre_save, sender=SaleItem)
def calculate_fifo_cost(sender, instance, **kwargs):
    """
    Calculate FIFO cost for a sale item before saving.
    Consumes cost layers from oldest to newest.
    """
    # Skip if this is an update (not a new instance)
    if instance.pk is not None:
        return

    # Skip if unit_cost is already set (manual override)
    if instance.unit_cost and instance.unit_cost > 0:
        return

    product = instance.product
    quantity_needed = instance.quantity

    # Get cost layers for this product, ordered by creation (FIFO)
    cost_layers = CostLayer.objects.filter(
        product=product,
        quantity_remaining__gt=0
    ).order_by('created_at')

    if not cost_layers.exists():
        # No cost layers available - use average cost as fallback
        instance.unit_cost = product.average_cost_gtq
        return

    total_cost = Decimal('0')
    remaining_quantity = quantity_needed

    # Consume cost layers using FIFO
    for layer in cost_layers:
        if remaining_quantity <= 0:
            break

        # How much can we take from this layer?
        quantity_from_layer = min(remaining_quantity, layer.quantity_remaining)

        # Add cost from this layer
        total_cost += quantity_from_layer * layer.unit_cost_gtq

        # Reduce remaining quantity
        remaining_quantity -= quantity_from_layer

    # If we couldn't fulfill the entire quantity from cost layers
    if remaining_quantity > 0:
        # Use average cost for the remaining quantity
        total_cost += remaining_quantity * product.average_cost_gtq

    # Calculate weighted average unit cost
    instance.unit_cost = total_cost / quantity_needed


@receiver(post_save, sender=SaleItem)
def update_inventory_and_cost_layers(sender, instance, created, **kwargs):
    """
    After saving a sale item:
    1. Reduce inventory
    2. Consume cost layers (FIFO)
    3. Create inventory transaction

    Uses atomic transaction with row locking to prevent race conditions.
    """
    # Only process new sale items
    if not created:
        return

    quantity_sold = instance.quantity

    with transaction.atomic():
        # Lock the product row to prevent concurrent modifications
        product = Product.objects.select_for_update().get(id=instance.product_id)

        # Safety check: ensure we don't go negative
        if product.current_stock < quantity_sold:
            raise ValueError(f"Insufficient stock for {product.product_name}. Available: {product.current_stock}, Requested: {quantity_sold}")

        # Lock and consume cost layers using FIFO
        cost_layers = CostLayer.objects.select_for_update().filter(
            product=product,
            quantity_remaining__gt=0
        ).order_by('created_at')

        remaining_quantity = quantity_sold

        for layer in cost_layers:
            if remaining_quantity <= 0:
                break

            # How much to consume from this layer?
            quantity_from_layer = min(remaining_quantity, layer.quantity_remaining)

            # Reduce the layer's remaining quantity
            layer.quantity_remaining -= quantity_from_layer
            layer.save()

            # Reduce our remaining quantity
            remaining_quantity -= quantity_from_layer

        # Update product inventory
        product.current_stock -= quantity_sold
        product.save()

        # Create inventory transaction
        InventoryTransaction.objects.create(
            product=product,
            transaction_type='sale',
            quantity_change=-quantity_sold,
            quantity_after=product.current_stock,
            reference_id=instance.sale.id,
            notes=f"Sale #{instance.sale.id} - {instance.product.product_name}"
        )


@receiver(post_delete, sender=SaleItem)
def restore_inventory_on_delete(sender, instance, **kwargs):
    """
    When a sale item is deleted:
    1. Restore product inventory
    2. Delete associated inventory transaction
    3. Create a new cost layer to restore the cost
    """
    product = instance.product
    quantity_to_restore = instance.quantity

    # Get sale_id safely (might be None if sale was already deleted via CASCADE)
    try:
        sale_id = instance.sale.id if instance.sale else None
    except Exception:
        sale_id = None

    print(f"[SaleItem Delete] Restoring {quantity_to_restore} units of {product.product_name}, sale_id={sale_id}")

    # Restore product inventory (always do this)
    product.current_stock += quantity_to_restore
    product.save()

    # Delete associated inventory transaction
    if sale_id:
        deleted_count, _ = InventoryTransaction.objects.filter(
            product=product,
            transaction_type='sale',
            reference_id=sale_id,
            quantity_change=-quantity_to_restore
        ).delete()
        print(f"[SaleItem Delete] Deleted {deleted_count} inventory transaction(s)")

    # Determine the cost to use for restoration
    unit_cost_gtq = instance.unit_cost
    if not unit_cost_gtq or unit_cost_gtq <= 0:
        # Fallback to product's average cost
        unit_cost_gtq = product.average_cost_gtq or Decimal('0')
        print(f"[SaleItem Delete] unit_cost was 0, using fallback: {unit_cost_gtq}")

    # Only create cost layer if we have a valid cost
    if unit_cost_gtq > 0:
        settings = SystemSettings.get_settings()
        unit_cost_usd = unit_cost_gtq / settings.usd_to_gtq_rate

        CostLayer.objects.create(
            product=product,
            purchase_item=None,  # This is a restoration, not from a purchase
            unit_cost=unit_cost_usd,
            unit_cost_gtq=unit_cost_gtq,
            base_unit_cost=unit_cost_usd,
            allocated_logistics_per_unit=Decimal('0'),
            logistics_allocated=True,
            quantity_remaining=quantity_to_restore,
            original_quantity=quantity_to_restore
        )
        print(f"[SaleItem Delete] Created cost layer with unit_cost_gtq={unit_cost_gtq}")
    else:
        print(f"[SaleItem Delete] Warning: No valid cost available, skipping cost layer creation")

    # Update product's average cost
    product.update_average_cost()

    # Create inventory transaction for the restoration
    InventoryTransaction.objects.create(
        product=product,
        transaction_type='adjustment',
        quantity_change=quantity_to_restore,
        quantity_after=product.current_stock,
        reference_id=sale_id,
        notes=f"Restored from deleted Sale #{sale_id or 'unknown'} - {product.product_name}"
    )
    print(f"[SaleItem Delete] Restoration complete. New stock: {product.current_stock}")


@receiver(pre_delete, sender=Purchase)
def reverse_purchase_on_delete(sender, instance, **kwargs):
    """
    Before a purchase is deleted:
    1. If received, reverse inventory for each item
    2. Delete associated cost layers
    3. Delete associated inventory transactions
    """
    # Only need to reverse if purchase was received
    if instance.status != 'received':
        print(f"[Purchase Delete] Purchase #{instance.id} was not received, no inventory to reverse")
        return

    print(f"[Purchase Delete] Reversing received Purchase #{instance.id}")

    # Store items data before they get deleted by CASCADE
    items_data = []
    for item in instance.items.all():
        items_data.append({
            'product': item.product,
            'quantity': item.quantity,
            'item_id': item.id
        })

    for item_info in items_data:
        product = item_info['product']
        quantity_to_remove = item_info['quantity']

        print(f"[Purchase Delete] Reversing {quantity_to_remove} units of {product.product_name}")

        # 1. Reduce product inventory
        product.current_stock -= quantity_to_remove
        if product.current_stock < 0:
            product.current_stock = Decimal('0')  # Safety: don't go negative
        product.save()

        # 2. Delete cost layers linked to this purchase item
        deleted_layers, _ = CostLayer.objects.filter(purchase_item_id=item_info['item_id']).delete()
        print(f"[Purchase Delete] Deleted {deleted_layers} cost layer(s)")

        # 3. Update product average cost
        product.update_average_cost()

    # 4. Delete inventory transactions for this purchase
    deleted_txns, _ = InventoryTransaction.objects.filter(
        transaction_type='purchase',
        reference_id=instance.id
    ).delete()
    print(f"[Purchase Delete] Deleted {deleted_txns} inventory transaction(s)")

    # 5. Create adjustment transaction to record the reversal
    for item_info in items_data:
        product = item_info['product']
        product.refresh_from_db()  # Get updated stock value
        InventoryTransaction.objects.create(
            product=product,
            transaction_type='adjustment',
            quantity_change=-item_info['quantity'],
            quantity_after=product.current_stock,
            reference_id=instance.id,
            notes=f"Reversed from deleted Purchase #{instance.id} - {product.product_name}"
        )

    print(f"[Purchase Delete] Reversal complete")
