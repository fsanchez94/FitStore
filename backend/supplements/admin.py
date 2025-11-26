from django.contrib import admin
from .models import (
    Product, Purchase, PurchaseItem, CostLayer,
    Customer, Sale, SaleItem, InventoryTransaction
)


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 1
    fields = ['product', 'quantity', 'unit_cost']


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 1
    fields = ['product', 'quantity', 'unit_price', 'unit_cost']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['id', 'product_name', 'brand_name', 'product_type', 'current_stock',
                    'current_price', 'average_cost', 'last_purchase_cost', 'is_low_stock']
    search_fields = ['product_name', 'brand_name', 'product_type', 'description']
    list_filter = ['product_type', 'brand_name', 'created_at']
    readonly_fields = ['created_at', 'updated_at', 'average_cost', 'average_cost_gtq']
    fieldsets = (
        ('Product Information', {
            'fields': ('product_name', 'brand_name', 'product_type', 'url', 'description')
        }),
        ('Nutritional Information', {
            'fields': ('amount_per_serving', 'serving_size', 'units_per_container', 'weight_g')
        }),
        ('Inventory', {
            'fields': ('unit', 'current_stock', 'min_stock_level')
        }),
        ('Pricing', {
            'fields': ('current_price',)
        }),
        ('Cost Tracking (FIFO)', {
            'fields': ('average_cost', 'average_cost_gtq', 'last_purchase_cost', 'last_purchase_date')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def is_low_stock(self, obj):
        return obj.is_low_stock
    is_low_stock.boolean = True


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['id', 'order_id', 'purchase_date', 'delivery_date', 'status', 'weight_lb', 'total_cost_display']
    list_filter = ['status', 'purchase_date']
    search_fields = ['order_id', 'notes']
    inlines = [PurchaseItemInline]
    readonly_fields = ['created_at', 'updated_at', 'product_cost', 'estimated_logistic_cost',
                       'real_logistic_cost', 'estimated_total', 'real_total', 'total_cost']
    fieldsets = (
        ('Order Information', {
            'fields': ('order_id', 'purchase_date', 'delivery_date', 'status', 'weight_lb')
        }),
        ('Estimated Logistics (From Calculator)', {
            'fields': ('estimated_shipping', 'estimated_taxes', 'estimated_logistic_cost', 'estimated_total')
        }),
        ('Real Logistics (From Invoice)', {
            'fields': ('real_shipping', 'real_taxes', 'real_logistic_cost', 'real_total'),
            'classes': ('collapse',)
        }),
        ('Cost Summary', {
            'fields': ('product_cost', 'total_cost')
        }),
        ('Additional Information', {
            'fields': ('notes', 'created_at', 'updated_at')
        }),
    )

    def total_cost_display(self, obj):
        return f"${obj.total_cost:.2f}"
    total_cost_display.short_description = 'Total Cost'


@admin.register(PurchaseItem)
class PurchaseItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'purchase', 'product', 'quantity', 'unit_cost']
    list_filter = ['purchase__purchase_date']
    search_fields = ['product__product_name', 'purchase__id']


@admin.register(CostLayer)
class CostLayerAdmin(admin.ModelAdmin):
    list_display = ['id', 'product', 'product_brand', 'base_unit_cost', 'allocated_logistics_per_unit', 'unit_cost',
                    'unit_cost_gtq', 'quantity_remaining', 'original_quantity', 'logistics_allocated', 'created_at']
    list_filter = ['created_at', 'product', 'logistics_allocated']
    search_fields = ['product__product_name', 'product__brand_name']

    def product_brand(self, obj):
        return obj.product.brand_name or '-'
    product_brand.short_description = 'Brand'
    readonly_fields = ['created_at', 'base_unit_cost', 'allocated_logistics_per_unit',
                       'unit_cost', 'unit_cost_gtq', 'logistics_allocated']
    ordering = ['product', 'created_at']
    fieldsets = (
        ('Product & Purchase', {
            'fields': ('product', 'purchase_item')
        }),
        ('Cost Breakdown (USD)', {
            'fields': ('base_unit_cost', 'allocated_logistics_per_unit', 'unit_cost', 'logistics_allocated')
        }),
        ('Cost (GTQ)', {
            'fields': ('unit_cost_gtq',)
        }),
        ('Quantity', {
            'fields': ('quantity_remaining', 'original_quantity')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        }),
    )

    def has_add_permission(self, request):
        # Cost layers should only be created automatically, not manually
        return False


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'phone', 'email', 'sales_count', 'created_at']
    search_fields = ['name', 'phone', 'email']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Customer Information', {
            'fields': ('name', 'phone', 'email', 'address')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def sales_count(self, obj):
        return obj.sales.count()
    sales_count.short_description = 'Total Sales'


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'get_display_customer', 'sale_date', 'status', 'total_revenue_display', 'profit_display', 'created_at']
    list_filter = ['status', 'sale_date']
    search_fields = ['customer__name', 'customer_name', 'customer_email', 'notes']
    inlines = [SaleItemInline]
    readonly_fields = ['created_at', 'updated_at', 'total_revenue', 'total_cost', 'profit']
    fieldsets = (
        ('Customer', {
            'fields': ('customer', 'customer_name', 'customer_phone', 'customer_email')
        }),
        ('Sale Information', {
            'fields': ('sale_date', 'status', 'notes')
        }),
        ('Financials', {
            'fields': ('total_revenue', 'total_cost', 'profit')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def get_display_customer(self, obj):
        return obj.get_customer_name()
    get_display_customer.short_description = 'Customer'

    def total_revenue_display(self, obj):
        return f"${obj.total_revenue:.2f}"
    total_revenue_display.short_description = 'Revenue'

    def profit_display(self, obj):
        return f"${obj.profit:.2f}"
    profit_display.short_description = 'Profit'


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'sale', 'product', 'product_brand', 'quantity', 'unit_price', 'unit_cost']
    list_filter = ['sale__sale_date']
    search_fields = ['product__product_name', 'product__brand_name', 'sale__id']

    def product_brand(self, obj):
        return obj.product.brand_name or '-'
    product_brand.short_description = 'Brand'


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'product', 'product_brand', 'transaction_type', 'quantity_change', 'quantity_after', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['product__product_name', 'product__brand_name', 'notes']
    readonly_fields = ['created_at']

    def product_brand(self, obj):
        return obj.product.brand_name or '-'
    product_brand.short_description = 'Brand'
