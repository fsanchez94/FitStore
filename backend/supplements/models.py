from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class SystemSettings(models.Model):
    """
    Singleton model for system-wide settings.
    Only one instance should exist.
    """
    usd_to_gtq_rate = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=Decimal('7.7500'),
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text="Exchange rate: 1 USD = X GTQ"
    )
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System Settings"
        verbose_name_plural = "System Settings"

    def __str__(self):
        return f"Exchange Rate: 1 USD = {self.usd_to_gtq_rate} GTQ"

    def save(self, *args, **kwargs):
        # Ensure only one instance exists (singleton pattern)
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Get or create the singleton settings instance"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class Product(models.Model):
    # Supplement-specific fields
    product_type = models.CharField(max_length=100, blank=True)
    product_name = models.CharField(max_length=200)
    brand_name = models.CharField(max_length=200, blank=True)
    url = models.URLField(max_length=500, blank=True)
    amount_per_serving = models.CharField(max_length=100, blank=True)
    serving_size = models.CharField(max_length=100, blank=True)
    units_per_container = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))]
    )
    weight_g = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))]
    )

    # Legacy fields (retained for backward compatibility)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=50, default='unit')  # e.g., bottle, box, kg

    # Inventory tracking fields
    current_stock = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    min_stock_level = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )

    # Cost tracking fields (for FIFO)
    average_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Weighted average cost across all cost layers"
    )
    last_purchase_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Most recent purchase unit cost"
    )
    last_purchase_date = models.DateTimeField(null=True, blank=True, help_text="When last purchased")

    # Selling price (in GTQ)
    current_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Current selling price in GTQ"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.product_name

    @property
    def is_low_stock(self):
        return self.current_stock <= self.min_stock_level

    @property
    def average_cost_gtq(self):
        """Average cost converted to GTQ using current exchange rate"""
        settings = SystemSettings.get_settings()
        return self.average_cost * settings.usd_to_gtq_rate

    def get_fifo_cost(self, quantity):
        """
        Calculate FIFO cost for selling a given quantity in GTQ.
        Returns (total_cost_gtq, average_unit_cost_gtq) tuple.
        """
        from django.db.models import Sum

        remaining_qty = Decimal(str(quantity))
        total_cost_gtq = Decimal('0')

        # Get cost layers ordered by creation date (FIFO - oldest first)
        layers = self.cost_layers.filter(quantity_remaining__gt=0).order_by('created_at')

        for layer in layers:
            if remaining_qty <= 0:
                break

            # Take from this layer (using GTQ cost)
            qty_from_layer = min(remaining_qty, layer.quantity_remaining)
            total_cost_gtq += qty_from_layer * layer.unit_cost_gtq
            remaining_qty -= qty_from_layer

        if remaining_qty > 0:
            # Not enough inventory in cost layers
            # Fall back to average cost for remaining quantity (convert USD to GTQ)
            settings = SystemSettings.get_settings()
            total_cost_gtq += remaining_qty * self.average_cost * settings.usd_to_gtq_rate

        avg_unit_cost_gtq = total_cost_gtq / Decimal(str(quantity)) if quantity > 0 else Decimal('0')
        return (total_cost_gtq, avg_unit_cost_gtq)

    def update_average_cost(self):
        """Recalculate weighted average cost from all active cost layers"""
        from django.db.models import Sum, F
        from django.db.models.functions import Coalesce

        # Sum of (quantity_remaining * unit_cost) for all layers
        total_value = self.cost_layers.aggregate(
            total=Coalesce(Sum(F('quantity_remaining') * F('unit_cost')), Decimal('0'))
        )['total']

        # Sum of all quantity_remaining
        total_qty = self.cost_layers.aggregate(
            total=Coalesce(Sum('quantity_remaining'), Decimal('0'))
        )['total']

        if total_qty > 0:
            self.average_cost = total_value / total_qty
        else:
            self.average_cost = Decimal('0')

        self.save(update_fields=['average_cost'])

    class Meta:
        ordering = ['product_name']
        constraints = [
            models.CheckConstraint(
                check=models.Q(current_stock__gte=0),
                name='product_stock_non_negative'
            )
        ]


class PriceHistory(models.Model):
    """
    Tracks price changes for products.
    Simple audit trail of when prices were changed.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='price_history'
    )
    old_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Previous price in GTQ"
    )
    new_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="New price in GTQ"
    )
    changed_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_date']
        verbose_name = "Price History"
        verbose_name_plural = "Price Histories"

    def __str__(self):
        return f"{self.product.product_name}: Q{self.old_price} → Q{self.new_price} ({self.changed_date.strftime('%Y-%m-%d')})"


class Purchase(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    ]

    # Basic Information
    order_id = models.CharField(max_length=100, blank=True, help_text="Amazon Order Number")
    purchase_date = models.DateField()
    delivery_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    weight_lb = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Shipment weight in pounds"
    )
    notes = models.TextField(blank=True)

    # Estimated Logistics (from shipping calculator)
    estimated_shipping = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )
    estimated_taxes = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))]
    )

    # Real Logistics (from actual invoice)
    real_shipping = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))]
    )
    real_taxes = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))]
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        order_display = f"Order {self.order_id}" if self.order_id else f"Purchase #{self.id}"
        return f"{order_display} ({self.purchase_date})"

    @property
    def product_cost(self):
        """Sum of all purchase items (unit_cost × quantity)"""
        return sum(item.total_price for item in self.items.all())

    @property
    def estimated_logistic_cost(self):
        """Estimated shipping + taxes"""
        return self.estimated_shipping + self.estimated_taxes

    @property
    def real_logistic_cost(self):
        """Real shipping + taxes (if available)"""
        if self.real_shipping is not None and self.real_taxes is not None:
            return self.real_shipping + self.real_taxes
        return None

    @property
    def estimated_total(self):
        """Product cost + estimated logistic cost"""
        return self.product_cost + self.estimated_logistic_cost

    @property
    def real_total(self):
        """Product cost + real logistic cost (if available)"""
        real_logistic = self.real_logistic_cost
        if real_logistic is not None:
            return self.product_cost + real_logistic
        return None

    @property
    def total_cost(self):
        """Use real total if available, otherwise estimated total"""
        return self.real_total if self.real_total is not None else self.estimated_total

    @property
    def total_cost_gtq(self):
        """Total cost converted to GTQ using current exchange rate"""
        settings = SystemSettings.get_settings()
        return self.total_cost * settings.usd_to_gtq_rate

    def allocate_logistics_costs(self):
        """
        Allocate real logistics costs (shipping + taxes) to cost layers
        based on product value (proportional allocation).
        Only runs if real_shipping and real_taxes are both set.
        """
        # Check if real logistics costs are available
        if self.real_shipping is None or self.real_taxes is None:
            return False

        # Total logistics to allocate
        total_logistics = self.real_shipping + self.real_taxes

        if total_logistics == 0:
            return False

        # Get total product cost for proportional allocation
        total_product_cost = self.product_cost

        if total_product_cost == 0:
            return False

        # Allocate to each cost layer
        for item in self.items.all():
            # Get the cost layer for this purchase item
            try:
                cost_layer = item.cost_layer

                # Skip if already allocated
                if cost_layer.logistics_allocated:
                    continue

                # Calculate this item's share of logistics
                # Share = (Item's Product Cost / Total Product Cost) × Total Logistics
                item_product_cost = item.quantity * item.unit_cost
                logistics_share = (item_product_cost / total_product_cost) * total_logistics

                # Calculate per-unit logistics cost
                logistics_per_unit = logistics_share / item.quantity

                # Update cost layer
                cost_layer.allocated_logistics_per_unit = logistics_per_unit
                cost_layer.unit_cost = cost_layer.base_unit_cost + logistics_per_unit
                cost_layer.logistics_allocated = True
                cost_layer.save()

                # Update product's average cost and last purchase cost
                product = item.product
                product.last_purchase_cost = cost_layer.unit_cost
                product.update_average_cost()
                product.save(update_fields=['last_purchase_cost'])

            except CostLayer.DoesNotExist:
                # No cost layer exists (purchase not received yet)
                continue

        return True

    def save(self, *args, **kwargs):
        """Override save to allocate logistics when real costs are entered"""
        # Check if this is an update (not a new purchase)
        is_update = self.pk is not None

        if is_update:
            # Get the old instance to check if real costs just changed
            try:
                old_instance = Purchase.objects.get(pk=self.pk)
                real_costs_just_added = (
                    (old_instance.real_shipping is None or old_instance.real_taxes is None) and
                    (self.real_shipping is not None and self.real_taxes is not None)
                )
            except Purchase.DoesNotExist:
                real_costs_just_added = False
        else:
            real_costs_just_added = False

        # Save the purchase first
        super().save(*args, **kwargs)

        # Allocate logistics if real costs were just added
        if real_costs_just_added and self.status == 'received':
            self.allocate_logistics_costs()

    class Meta:
        ordering = ['-purchase_date']


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Discount applied to total item cost (not per unit)"
    )

    @property
    def total_price(self):
        return (self.quantity * self.unit_cost) - self.discount

    def __str__(self):
        return f"{self.product.product_name} - {self.quantity} units"

    class Meta:
        ordering = ['product__product_name']


class CostLayer(models.Model):
    """
    Tracks individual purchase batches for FIFO cost calculation.
    Each purchase creates a cost layer that is consumed oldest-first when selling.
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='cost_layers')
    purchase_item = models.ForeignKey(
        PurchaseItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cost_layer',
        help_text="The purchase item that created this cost layer"
    )
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Total cost per unit in USD (base + allocated logistics)"
    )
    unit_cost_gtq = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Total cost per unit in GTQ (converted from USD)"
    )
    base_unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Base product cost per unit (before logistics)"
    )
    allocated_logistics_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Allocated shipping + taxes per unit"
    )
    logistics_allocated = models.BooleanField(
        default=False,
        help_text="Whether logistics costs have been allocated to this layer"
    )
    quantity_remaining = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="How many units are left in this batch"
    )
    original_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Initial quantity from purchase"
    )
    created_at = models.DateTimeField(auto_now_add=True, help_text="Date received (for FIFO ordering)")

    def __str__(self):
        return f"{self.product.product_name} - {self.quantity_remaining}/{self.original_quantity} @ ${self.unit_cost} (Q{self.unit_cost_gtq})"

    class Meta:
        ordering = ['created_at']  # FIFO: oldest first
        indexes = [
            models.Index(fields=['product', 'created_at']),
        ]


class Customer(models.Model):
    """
    Customer entity for tracking customer information and sales history.
    """
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class Sale(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    # Customer relationship (nullable to support both linked and manual entry)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
        help_text="Linked customer record (optional)"
    )

    # Manual customer entry fields (for backwards compatibility and quick entry)
    customer_name = models.CharField(max_length=200, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)
    customer_email = models.EmailField(blank=True)

    # Sale details
    sale_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        customer = self.get_customer_name()
        return f"Sale #{self.id} - {customer} ({self.sale_date})"

    def get_customer_name(self):
        """Get customer name from linked customer or manual entry"""
        if self.customer:
            return self.customer.name
        return self.customer_name or "Walk-in Customer"

    def get_customer_phone(self):
        """Get customer phone from linked customer or manual entry"""
        if self.customer:
            return self.customer.phone
        return self.customer_phone

    def get_customer_email(self):
        """Get customer email from linked customer or manual entry"""
        if self.customer:
            return self.customer.email
        return self.customer_email

    @property
    def total_revenue(self):
        return sum(item.total_price for item in self.items.all())

    @property
    def total_cost(self):
        return sum(item.total_cost for item in self.items.all())

    @property
    def profit(self):
        return self.total_revenue - self.total_cost

    class Meta:
        ordering = ['-sale_date']


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="FIFO cost calculated from cost layers"
    )

    @property
    def total_price(self):
        return self.quantity * self.unit_price

    @property
    def total_cost(self):
        return self.quantity * self.unit_cost

    @property
    def profit(self):
        return self.total_price - self.total_cost

    def __str__(self):
        return f"{self.product.product_name} - {self.quantity} units"

    class Meta:
        ordering = ['product__product_name']


class InventoryTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('purchase', 'Purchase'),
        ('sale', 'Sale'),
        ('adjustment', 'Manual Adjustment'),
    ]

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    quantity_change = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_after = models.DecimalField(max_digits=10, decimal_places=2)
    reference_id = models.IntegerField(null=True, blank=True)  # ID of Purchase or Sale
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.product_name} - {self.transaction_type} ({self.quantity_change})"

    class Meta:
        ordering = ['-created_at']
