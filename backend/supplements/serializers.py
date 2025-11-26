from rest_framework import serializers
from .models import (
    Product, Purchase, PurchaseItem,
    Customer, Sale, SaleItem, InventoryTransaction,
    SystemSettings
)


class SystemSettingsSerializer(serializers.ModelSerializer):
    usd_to_gtq_rate = serializers.DecimalField(max_digits=10, decimal_places=4, coerce_to_string=False)

    class Meta:
        model = SystemSettings
        fields = ['id', 'usd_to_gtq_rate', 'last_updated']
        read_only_fields = ['id', 'last_updated']


class ProductSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.ReadOnlyField()
    average_cost_gtq = serializers.ReadOnlyField()
    current_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)

    class Meta:
        model = Product
        fields = '__all__'


class CustomerSerializer(serializers.ModelSerializer):
    sales_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'address', 'notes', 'sales_count', 'created_at', 'updated_at']

    def get_sales_count(self, obj):
        return obj.sales.count()


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    product_brand = serializers.CharField(source='product.brand_name', read_only=True)
    unit_cost = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)

    class Meta:
        model = PurchaseItem
        fields = ['id', 'purchase', 'product', 'product_name', 'product_brand', 'quantity', 'unit_cost', 'discount', 'total_price']


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)

    # Direct fields with coerce_to_string=False
    weight_lb = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    estimated_shipping = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    estimated_taxes = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    real_shipping = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True, required=False, coerce_to_string=False)
    real_taxes = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True, required=False, coerce_to_string=False)

    # Calculated cost fields (USD)
    product_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    estimated_logistic_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    real_logistic_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, allow_null=True, coerce_to_string=False)
    estimated_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    real_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, allow_null=True, coerce_to_string=False)
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)

    # GTQ conversion
    total_cost_gtq = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)

    class Meta:
        model = Purchase
        fields = [
            'id', 'order_id',
            'purchase_date', 'delivery_date', 'status', 'weight_lb',
            'estimated_shipping', 'estimated_taxes',
            'real_shipping', 'real_taxes',
            'notes', 'items',
            'product_cost', 'estimated_logistic_cost', 'real_logistic_cost',
            'estimated_total', 'real_total', 'total_cost', 'total_cost_gtq',
            'created_at', 'updated_at'
        ]


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    unit_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    profit = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)

    class Meta:
        model = SaleItem
        fields = ['id', 'sale', 'product', 'product_name', 'quantity', 'unit_price', 'unit_cost', 'total_price', 'total_cost', 'profit']

    def validate(self, attrs):
        product = attrs.get('product')
        quantity = attrs.get('quantity')

        if product and quantity:
            if quantity > product.current_stock:
                raise serializers.ValidationError({
                    'quantity': f'Insufficient stock for {product.product_name}. Available: {product.current_stock}, Requested: {quantity}'
                })
        return attrs


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    total_revenue = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    profit = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)

    # Customer relationship
    customer_data = CustomerSerializer(source='customer', read_only=True)
    display_customer_name = serializers.SerializerMethodField()
    display_customer_phone = serializers.SerializerMethodField()
    display_customer_email = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'customer', 'customer_data', 'customer_name', 'customer_phone', 'customer_email',
            'display_customer_name', 'display_customer_phone', 'display_customer_email',
            'sale_date', 'status', 'notes', 'items',
            'total_revenue', 'total_cost', 'profit',
            'created_at', 'updated_at'
        ]

    def get_display_customer_name(self, obj):
        return obj.get_customer_name()

    def get_display_customer_phone(self, obj):
        return obj.get_customer_phone()

    def get_display_customer_email(self, obj):
        return obj.get_customer_email()


class InventoryTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = '__all__'
